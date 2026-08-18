import type { NextRequest } from 'next/server';
import { getAdminClient } from '@/lib/supabaseServer';
import { ALLOWED_IMAGE_MIME_TO_EXT, EXT_TO_IMAGE_MIME, detectImageExtFromBytes, isContentLengthTooLarge } from '@/lib/imageUpload';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

const MAX_SIZE_BYTES = 5 * 1024 * 1024;

const GENERIC_INVALID_MESSAGE = 'Link tidak valid atau pengiriman sudah dikonfirmasi sebelumnya.';

// Endpoint PUBLIK (Sesi 3, /pod/[token]) — TIDAK ADA getCurrentUser/JWT sama sekali,
// SENGAJA. Token+status divalidasi ULANG di sini (fresh, tidak percaya state
// halaman yang mungkin sudah lama terbuka di browser pengunjung) SEBELUM upload
// foto maupun transisi status dilakukan — mencegah submit basi/race condition.
export async function confirmDelivery(request: NextRequest, token: string): Promise<ApiResult> {
  if (!token || typeof token !== 'string') {
    return { status: 400, body: { error: GENERIC_INVALID_MESSAGE } };
  }

  try {
    const adminClient = getAdminClient();

    const { data: shipment, error: shipmentError } = await adminClient
      .from('shipments')
      .select('shipment_id, status')
      .eq('pod_token', token)
      .maybeSingle();

    if (shipmentError) {
      return { status: 500, body: { error: 'Terjadi kesalahan. Silakan coba lagi.' } };
    }
    if (!shipment || shipment.status !== 'shipped') {
      return { status: 404, body: { error: GENERIC_INVALID_MESSAGE } };
    }

    // Ditolak SEBELUM body dibaca penuh ke memori — mencegah endpoint publik ini
    // dipakai untuk membanjiri memori server dengan body raksasa yang toh akan
    // ditolak juga (percuma buffer-kan dulu baru cek ukurannya).
    if (isContentLengthTooLarge(request, MAX_SIZE_BYTES)) {
      return { status: 413, body: { error: 'Ukuran file maksimal 5MB.' } };
    }

    const formData = await request.formData();
    const file = formData.get('photo');
    const receivedByNameRaw = formData.get('received_by_name');

    if (!(file instanceof File)) {
      return { status: 400, body: { error: 'Foto bukti penerimaan wajib diunggah.' } };
    }
    if (file.size > MAX_SIZE_BYTES) {
      return { status: 400, body: { error: 'Ukuran file maksimal 5MB.' } };
    }
    if (!(file.type in ALLOWED_IMAGE_MIME_TO_EXT)) {
      return { status: 400, body: { error: 'Format file tidak didukung. Gunakan PNG, JPG, atau WEBP.' } };
    }
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);
    // Cek isi file yang SEBENARNYA (magic bytes), bukan cuma percaya Content-Type
    // yang diklaim client — Content-Type bisa dipalsukan bebas via curl/fetch manual.
    const sniffedExt = detectImageExtFromBytes(fileBuffer);
    if (!sniffedExt) {
      return { status: 400, body: { error: 'Format file tidak didukung. Gunakan PNG, JPG, atau WEBP.' } };
    }

    const receivedByName = typeof receivedByNameRaw === 'string' && receivedByNameRaw.trim() ? receivedByNameRaw.trim() : null;

    // Path pakai shipment_id + timestamp + random UUID (BUKAN cuma timestamp seperti
    // bucket internal lain) — bucket ini public-read tanpa autentikasi sama sekali
    // di sisi pembaca, jadi nama file sengaja dibuat tidak mudah ditebak/diurutkan.
    // Ekstensi diambil dari hasil sniff (isi asli file), bukan dari Content-Type klaim client.
    const path = `${shipment.shipment_id}/pod-${Date.now()}-${crypto.randomUUID()}.${sniffedExt}`;
    const { error: uploadError } = await adminClient.storage
      .from('delivery-confirmation-photos')
      .upload(path, fileBuffer, { contentType: EXT_TO_IMAGE_MIME[sniffedExt], upsert: false });

    if (uploadError) {
      return { status: 500, body: { error: 'Gagal mengunggah foto. Silakan coba lagi.' } };
    }

    const { data: publicUrlData } = adminClient.storage.from('delivery-confirmation-photos').getPublicUrl(path);
    const photoUrl = publicUrlData.publicUrl;

    const { error: rpcError } = await adminClient
      .rpc('confirm_delivery', {
        p_pod_token: token,
        p_photo_url: photoUrl,
        p_received_by_name: receivedByName
      })
      .single();

    if (rpcError) {
      // Termasuk kasus token dipakai 2x hampir bersamaan (row lock di confirm_delivery()
      // menjamin cuma 1 yang lolos) — pesan generik yang sama, tidak membocorkan detail.
      return { status: 409, body: { error: GENERIC_INVALID_MESSAGE } };
    }

    return { status: 200, body: { success: true } };
  } catch {
    return { status: 500, body: { error: 'Terjadi kesalahan. Silakan coba lagi.' } };
  }
}
