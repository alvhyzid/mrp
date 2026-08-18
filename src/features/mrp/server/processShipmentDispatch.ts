import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canManageShipments } from '@/lib/roles';
import { ALLOWED_IMAGE_MIME_TO_EXT, EXT_TO_IMAGE_MIME, detectImageExtFromBytes, isContentLengthTooLarge } from '@/lib/imageUpload';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

const MAX_SIZE_BYTES = 5 * 1024 * 1024;

// Transisi draft->shipped SEKARANG WAJIB lewat sini, BUKAN updateShipmentStatus.ts lagi
// (lihat ALLOWED_TARGET_STATUSES di sana) — karena butuh foto bukti pengiriman WAJIB
// diupload dulu (migration 20260817190000). Foto diupload ke storage SEBELUM status
// diubah; kalau upload sukses baru UPDATE status dijalankan — trigger
// process_shipment_shipped() (migration 20260817140000, diperluas 20260817180000)
// yang mengurangi stok + generate pod_token tetap jalan APA ADANYA lewat 1 UPDATE
// statement ini, tidak direstrukturisasi sama sekali.
export async function processShipmentDispatch(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);

    if (!canManageShipments(appUser.role)) {
      return { status: 403, body: { error: 'Role Anda tidak punya izin memproses pengiriman.' } };
    }
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    if (isContentLengthTooLarge(request, MAX_SIZE_BYTES)) {
      return { status: 413, body: { error: 'Ukuran file maksimal 5MB.' } };
    }

    const formData = await request.formData();
    const shipmentId = Number(formData.get('shipment_id'));
    const file = formData.get('photo');

    if (!shipmentId) {
      return { status: 400, body: { error: 'ID pengiriman tidak valid.' } };
    }
    if (!(file instanceof File)) {
      return { status: 400, body: { error: 'Foto bukti pengiriman wajib diunggah.' } };
    }
    if (file.size > MAX_SIZE_BYTES) {
      return { status: 400, body: { error: 'Ukuran file maksimal 5MB.' } };
    }
    if (!(file.type in ALLOWED_IMAGE_MIME_TO_EXT)) {
      return { status: 400, body: { error: 'Format file tidak didukung. Gunakan PNG, JPG, atau WEBP.' } };
    }

    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);
    // Content-Type yang diklaim client bisa dipalsukan — cek isi file sebenarnya
    // (magic bytes) sebelum disimpan, bukan cuma percaya header.
    const sniffedExt = detectImageExtFromBytes(fileBuffer);
    if (!sniffedExt) {
      return { status: 400, body: { error: 'Format file tidak didukung. Gunakan PNG, JPG, atau WEBP.' } };
    }

    const adminClient = getAdminClient();

    const { data: shipment, error: shipmentError } = await adminClient
      .from('shipments')
      .select('shipment_id, company_id, status')
      .eq('shipment_id', shipmentId)
      .maybeSingle();
    if (shipmentError) return { status: 500, body: { error: shipmentError.message } };
    if (!shipment || shipment.company_id !== appUser.company_id) {
      return { status: 404, body: { error: 'Pengiriman tidak ditemukan di perusahaan Anda.' } };
    }
    if (shipment.status !== 'draft') {
      return { status: 400, body: { error: `Pengiriman berstatus "${shipment.status}" — hanya pengiriman draft yang bisa diproses.` } };
    }

    const path = `${appUser.company_id}/${shipmentId}/dispatch-${Date.now()}.${sniffedExt}`;
    const { error: uploadError } = await adminClient.storage
      .from('shipment-dispatch-photos')
      .upload(path, fileBuffer, { contentType: EXT_TO_IMAGE_MIME[sniffedExt], upsert: false });
    if (uploadError) {
      return { status: 500, body: { error: uploadError.message } };
    }
    const { data: publicUrlData } = adminClient.storage.from('shipment-dispatch-photos').getPublicUrl(path);
    const dispatchPhotoUrl = publicUrlData.publicUrl;

    const { data: updated, error: updateError } = await adminClient
      .from('shipments')
      .update({ status: 'shipped', dispatch_photo_url: dispatchPhotoUrl })
      .eq('shipment_id', shipmentId)
      .eq('status', 'draft')
      .select('shipment_id, status, dispatch_photo_url')
      .single();

    if (updateError) {
      return { status: 400, body: { error: updateError.message } };
    }

    return { status: 200, body: { shipment_id: updated.shipment_id, status: updated.status, dispatch_photo_url: updated.dispatch_photo_url } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}
