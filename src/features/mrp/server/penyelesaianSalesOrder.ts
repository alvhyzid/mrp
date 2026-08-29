import type { NextRequest } from 'next/server';
import { getCurrentUser, getUserScopedClient, parseBearerToken } from '@/lib/supabaseServer';

// PJL-03 — konfirmasi pemenuhan (PPIC) dan penutupan Sales Order (Manager/GM).
//
// SELURUHNYA lewat fungsi basis data, alasan yang sama seperti pembatalan: jejak keputusan
// ditulis trigger yang membaca konteks dari setelan sesi, dan konteks itu hanya bisa dipasang
// di dalam satu transaksi — yaitu di dalam fungsi.
//
// Memakai `update` dari sini akan tetap menutup order DAN tetap mencatat barisnya, hanya TANPA
// pelaku dan TANPA alasan. Jejaknya terlihat ada, isinya kosong.
//
// ATURAN BISNIS YANG DITEGAKKAN SERVER, bukan layar: penyelesaian berbasis PEMENUHAN, bukan
// pembayaran. Nol pemeriksaan pembayaran di jalur ini — dan itu disengaja.

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Pesannya sudah Bahasa Indonesia dan sudah bisa dibaca orang pabrik; yang diterjemahkan
// hanya KODE STATUS-nya.
function statusUntukPesan(pesan: string): number {
  if (pesan.includes('tidak ditemukan di perusahaan Anda')) return 404;
  if (pesan.includes('Hanya PPIC')) return 403;
  if (pesan.includes('Hanya Manager atau General Manager')) return 403;
  if (pesan.includes('tidak boleh menutup Sales Order yang sama')) return 403;
  if (pesan.includes('membutuhkan sesi login')) return 401;
  if (pesan.includes('tidak membawa konteks perusahaan')) return 403;
  if (pesan.includes('Kategori alasan tidak dikenali')) return 400;
  if (pesan.includes('mewajibkan catatan tambahan')) return 400;
  if (pesan.includes('hanya boleh dipakai departemen')) return 403;
  if (pesan.includes('PPIC belum mengonfirmasi')) return 409;
  if (pesan.includes('Keadaan pemenuhan berubah')) return 409;
  if (pesan.includes('Belum bisa dikonfirmasi')) return 409;
  if (pesan.includes('Belum bisa diselesaikan')) return 409;
  return 500;
}

async function jalankan(
  request: NextRequest,
  rpc: 'konfirmasi_pemenuhan_sales_order' | 'selesaikan_sales_order'
): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    const accessToken = await parseBearerToken(request);
    if (!appUser.company_id) return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };

    const body = await request.json();
    const salesOrderId = Number(body.sales_order_id);
    const kategori = typeof body.reason_category === 'string' ? body.reason_category.trim() : '';
    const catatan = typeof body.reason_note === 'string' ? body.reason_note.trim() : '';

    if (!salesOrderId) return { status: 400, body: { error: 'Sales Order wajib dipilih.' } };
    if (!kategori) return { status: 400, body: { error: 'Kategori alasan wajib dipilih.', field: 'reason_category' } };

    const { error } = await getUserScopedClient(accessToken).rpc(rpc, {
      p_sales_order_id: salesOrderId,
      p_reason_category: kategori,
      p_reason_note: catatan || null
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

export async function konfirmasiPemenuhanSalesOrder(request: NextRequest): Promise<ApiResult> {
  return jalankan(request, 'konfirmasi_pemenuhan_sales_order');
}

export async function selesaikanSalesOrder(request: NextRequest): Promise<ApiResult> {
  return jalankan(request, 'selesaikan_sales_order');
}
