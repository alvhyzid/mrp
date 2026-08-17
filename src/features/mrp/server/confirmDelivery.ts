import type { NextRequest } from 'next/server';
import { getAdminClient } from '@/lib/supabaseServer';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

const ALLOWED_MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp'
};
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

    const formData = await request.formData();
    const file = formData.get('photo');
    const receivedByNameRaw = formData.get('received_by_name');

    if (!(file instanceof File)) {
      return { status: 400, body: { error: 'Foto bukti penerimaan wajib diunggah.' } };
    }
    const ext = ALLOWED_MIME_TO_EXT[file.type];
    if (!ext) {
      return { status: 400, body: { error: 'Format file tidak didukung. Gunakan PNG, JPG, atau WEBP.' } };
    }
    if (file.size > MAX_SIZE_BYTES) {
      return { status: 400, body: { error: 'Ukuran file maksimal 5MB.' } };
    }

    const receivedByName = typeof receivedByNameRaw === 'string' && receivedByNameRaw.trim() ? receivedByNameRaw.trim() : null;

    // Path pakai shipment_id + timestamp + random UUID (BUKAN cuma timestamp seperti
    // bucket internal lain) — bucket ini public-read tanpa autentikasi sama sekali
    // di sisi pembaca, jadi nama file sengaja dibuat tidak mudah ditebak/diurutkan.
    const path = `${shipment.shipment_id}/pod-${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await adminClient.storage
      .from('delivery-confirmation-photos')
      .upload(path, Buffer.from(arrayBuffer), { contentType: file.type, upsert: false });

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
