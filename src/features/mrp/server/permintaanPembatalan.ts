import type { NextRequest } from 'next/server';
import { getCurrentUser, getUserScopedClient, parseBearerToken } from '@/lib/supabaseServer';

// WS-SALES-CANCEL — permintaan & keputusan pembatalan.
//
// SELURUHNYA lewat fungsi basis data, dengan alasan yang sama seperti aksi PO klien:
// jejak keputusan ditulis trigger yang membaca konteks dari setelan sesi, dan konteks
// itu hanya bisa dipasang di dalam satu transaksi -- yaitu di dalam fungsi.
//
// Memakai `update` dari sini akan tetap mengubah status DAN tetap mencatat barisnya,
// hanya TANPA pelaku dan TANPA alasan. Jejaknya terlihat ada, isinya kosong.

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Pesannya sudah Bahasa Indonesia dan sudah bisa dibaca orang pabrik; yang
// diterjemahkan hanya KODE STATUS-nya.
function statusUntukPesan(pesan: string): number {
  if (pesan.includes('tidak ditemukan di perusahaan Anda')) return 404;
  if (pesan.includes('Hanya Manager atau General Manager')) return 403;
  if (pesan.includes('Pemohon tidak boleh memutuskan')) return 403;
  if (pesan.includes('tidak mewakili departemen')) return 403;
  if (pesan.includes('hanya boleh dipakai departemen')) return 403;
  if (pesan.includes('membutuhkan sesi login')) return 401;
  if (pesan.includes('tidak membawa konteks perusahaan')) return 403;
  if (pesan.includes('Kategori alasan tidak dikenali')) return 400;
  if (pesan.includes('mewajibkan catatan tambahan')) return 400;
  if (pesan.includes('menunggu keputusan')) return 409;
  if (pesan.includes('sudah dibatalkan')) return 400;
  if (pesan.includes('sudah diputuskan')) return 409;
  return 500;
}

export async function ajukanPembatalan(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    const accessToken = await parseBearerToken(request);
    if (!appUser.company_id) return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };

    const body = await request.json();
    const entity = typeof body.entity === 'string' ? body.entity : '';
    const recordId = Number(body.record_id);
    const kategori = typeof body.reason_category === 'string' ? body.reason_category.trim() : '';
    const catatan = typeof body.reason_note === 'string' ? body.reason_note.trim() : '';

    if (!entity || !recordId) return { status: 400, body: { error: 'Dokumen wajib dipilih.' } };
    if (!kategori) return { status: 400, body: { error: 'Kategori alasan wajib dipilih.', field: 'reason_category' } };

    const { data, error } = await getUserScopedClient(accessToken).rpc('ajukan_pembatalan', {
      p_entity: entity, p_record_id: recordId, p_reason_category: kategori, p_reason_note: catatan || null
    });
    if (error) {
      const field = error.message.includes('mewajibkan catatan tambahan') ? 'reason_note' : undefined;
      return { status: statusUntukPesan(error.message), body: field ? { error: error.message, field } : { error: error.message } };
    }
    return { status: 200, body: { success: true, cancellation_request_id: data } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

export async function putuskanPembatalan(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    const accessToken = await parseBearerToken(request);
    if (!appUser.company_id) return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };

    const body = await request.json();
    const requestId = Number(body.cancellation_request_id);
    const keputusan = typeof body.keputusan === 'string' ? body.keputusan : '';
    const kategori = typeof body.reason_category === 'string' ? body.reason_category.trim() : '';
    const catatan = typeof body.reason_note === 'string' ? body.reason_note.trim() : '';

    if (!requestId) return { status: 400, body: { error: 'Permintaan wajib dipilih.' } };
    if (!['approved', 'rejected'].includes(keputusan)) return { status: 400, body: { error: 'Keputusan harus disetujui atau ditolak.' } };
    if (!kategori) return { status: 400, body: { error: 'Kategori alasan wajib dipilih.', field: 'reason_category' } };

    const { error } = await getUserScopedClient(accessToken).rpc('putuskan_pembatalan', {
      p_cancellation_request_id: requestId, p_keputusan: keputusan, p_reason_category: kategori, p_reason_note: catatan || null
    });
    if (error) {
      const field = error.message.includes('mewajibkan catatan tambahan') ? 'reason_note' : undefined;
      return { status: statusUntukPesan(error.message), body: field ? { error: error.message, field } : { error: error.message } };
    }
    return { status: 200, body: { success: true } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}
