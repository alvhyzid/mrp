import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canReopenWorkOrder } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// PRD-12 (22 Agu 2026) — jalan keluar bernama untuk pagar keamanan
// "batch baru DITOLAK pada WO completed/cancelled". Alasan WAJIB diisi dan
// TERCATAT (siapa, kapan, alasan) di work_order_reopen_log — APPEND-ONLY,
// tidak pernah ditimpa/dihapus (berapa kali sebuah WO dibuka kembali adalah
// informasi berguna). Beda dari pola peringatan+jejak biasa: di sini blokir
// KERAS karena taruhannya konsumsi bahan sungguhan dari gudang, bukan
// catatan yang bisa dikoreksi belakangan.
export async function reopenWorkOrder(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!canReopenWorkOrder(appUser.role)) {
      return { status: 403, body: { error: 'Role Anda tidak punya izin membuka kembali Work Order ini — hanya Admin Perusahaan atau Manajer Produksi.' } };
    }
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const body = await request.json();
    const workOrderId = Number(body.work_order_id);
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

    if (!workOrderId) {
      return { status: 400, body: { error: 'Work Order wajib diisi.' } };
    }
    if (!reason) {
      return { status: 400, body: { error: 'Alasan wajib diisi untuk membuka kembali Work Order.' } };
    }

    const adminClient = getAdminClient();

    const { data: workOrder, error: woError } = await adminClient.from('work_orders').select('work_order_id, company_id, status').eq('work_order_id', workOrderId).maybeSingle();
    if (woError) return { status: 500, body: { error: woError.message } };
    if (!workOrder || workOrder.company_id !== appUser.company_id) {
      return { status: 404, body: { error: 'Work Order tidak ditemukan di perusahaan Anda.' } };
    }
    if (workOrder.status !== 'completed' && workOrder.status !== 'cancelled') {
      return { status: 400, body: { error: 'Work Order ini belum selesai/dibatalkan — tidak perlu dibuka kembali.' } };
    }

    const previousStatus = workOrder.status;

    const { error: updateError } = await adminClient
      .from('work_orders')
      .update({ status: 'in_progress', status_reason: null })
      .eq('work_order_id', workOrderId);
    if (updateError) return { status: 400, body: { error: updateError.message } };

    const { error: logError } = await adminClient.from('work_order_reopen_log').insert([
      { company_id: appUser.company_id, work_order_id: workOrderId, previous_status: previousStatus, reopened_by: appUser.user_id, reason }
    ]);
    if (logError) return { status: 500, body: { error: logError.message } };

    return { status: 200, body: { success: true } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}
