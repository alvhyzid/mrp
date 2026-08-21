import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canManageWorkOrder } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Dipakai drag-and-drop di Gantt (docs/rencana-ams-mvp.md Bagian 3 poin 3) —
// SATU-SATUNYA yang boleh diubah lewat sini adalah planned_date. Akses disamakan
// persis dengan yang boleh bikin batch (createProductionBatch.ts), TIDAK dibuka
// lebih luas. Hanya batch status "planned" yang boleh dijadwalkan ulang — batch
// yang sudah berjalan/selesai TIDAK boleh digeser lagi, dicek di server (bukan
// cuma di UI) supaya tidak bisa dilewati.
export async function updateProductionBatchSchedule(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);

    if (!canManageWorkOrder(appUser.role)) {
      return { status: 403, body: { error: 'Role Anda tidak punya izin menjadwalkan ulang batch produksi.' } };
    }
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const body = await request.json();
    const batchId = Number(body.production_batch_id);
    if (!batchId) {
      return { status: 400, body: { error: 'Batch produksi wajib diisi.' } };
    }

    const plannedDate = typeof body.planned_date === 'string' ? body.planned_date.trim() : '';
    if (!plannedDate || !/^\d{4}-\d{2}-\d{2}$/.test(plannedDate)) {
      return { status: 400, body: { error: 'Format tanggal rencana tidak valid.' } };
    }

    const adminClient = getAdminClient();
    const { data: batch, error: batchError } = await adminClient
      .from('production_batches')
      .select('production_batch_id, company_id, status')
      .eq('production_batch_id', batchId)
      .maybeSingle();
    if (batchError) return { status: 500, body: { error: batchError.message } };
    if (!batch || batch.company_id !== appUser.company_id) {
      return { status: 404, body: { error: 'Batch produksi tidak ditemukan.' } };
    }
    if (batch.status !== 'planned') {
      return { status: 400, body: { error: 'Hanya batch berstatus "Direncanakan" yang bisa dijadwalkan ulang — batch ini sudah berjalan/selesai.' } };
    }

    const { error: updateError } = await adminClient.from('production_batches').update({ planned_date: plannedDate }).eq('production_batch_id', batchId);
    if (updateError) return { status: 500, body: { error: updateError.message } };

    return { status: 200, body: { success: true, production_batch_id: batchId, planned_date: plannedDate } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}
