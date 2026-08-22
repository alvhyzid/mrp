import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canSetWorkOrderStatus } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// PRD-12 (22 Agu 2026) — transisi MANUAL Work Order: in_progress->completed
// (PPIC/supervisor menyatakan selesai — SENGAJA tidak otomatis saat kuantitas
// terpenuhi, produksi sering meleset dari target); ->paused/cancelled (wajib
// alasan). planned->in_progress TIDAK di sini — itu OTOMATIS saat batch
// pertama dimulai (lihat startProductionBatch.ts). Legalitas transisi
// ditegakkan trigger enforce_status_transition() di database, pesan error
// diteruskan apa adanya.
const REASON_REQUIRED_STATUSES = ['paused', 'cancelled'];
const ALLOWED_TARGET_STATUSES = ['completed', 'paused', 'cancelled'];

export async function setWorkOrderStatus(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!canSetWorkOrderStatus(appUser.role)) {
      return { status: 403, body: { error: 'Role Anda tidak punya izin mengubah status Work Order ini.' } };
    }
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const body = await request.json();
    const workOrderId = Number(body.work_order_id);
    const status = String(body.status ?? '').trim();
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

    if (!workOrderId) {
      return { status: 400, body: { error: 'Work Order wajib diisi.' } };
    }
    if (!ALLOWED_TARGET_STATUSES.includes(status)) {
      return { status: 400, body: { error: 'Status tujuan tidak valid (harus completed, paused, atau cancelled).' } };
    }
    if (REASON_REQUIRED_STATUSES.includes(status) && !reason) {
      return { status: 400, body: { error: 'Alasan wajib diisi untuk menjeda atau membatalkan Work Order.' } };
    }

    const adminClient = getAdminClient();

    const { data: workOrder, error: woError } = await adminClient.from('work_orders').select('work_order_id, company_id').eq('work_order_id', workOrderId).maybeSingle();
    if (woError) return { status: 500, body: { error: woError.message } };
    if (!workOrder || workOrder.company_id !== appUser.company_id) {
      return { status: 404, body: { error: 'Work Order tidak ditemukan di perusahaan Anda.' } };
    }

    const { error: updateError } = await adminClient
      .from('work_orders')
      .update({ status, status_reason: reason || null })
      .eq('work_order_id', workOrderId);
    if (updateError) return { status: 400, body: { error: updateError.message } };

    return { status: 200, body: { success: true } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}
