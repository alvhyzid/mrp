import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canRecordStepProgress } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

const stepStatuses = ['pending', 'in_progress', 'completed'];

// Satu baris "berjalan" (bukan completed) per (production_batch_id, routing_step_id)
// — BUKAN lagi per work_order_id, karena batch-batch dalam 1 shift bisa berada di
// tahap BERBEDA secara bersamaan (mis. Batch 1 sedang curing 48 jam, Batch 3 baru
// mixing). Dipanggil ini akan UPDATE baris yang masih berjalan kalau ada, atau
// INSERT baru kalau belum ada sama sekali. Skema tidak punya unique constraint yang
// memaksa ini, jadi pengulangan (mis. tahap diulang) tetap bisa dicatat sebagai
// baris baru begitu baris sebelumnya sudah completed.
export async function recordWorkOrderStepProgress(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);

    if (!canRecordStepProgress(appUser.role)) {
      return { status: 403, body: { error: 'Role Anda tidak punya izin mencatat progres produksi.' } };
    }

    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const body = await request.json();
    const workOrderId = Number(body.work_order_id);
    const productionBatchId = Number(body.production_batch_id);
    const routingStepId = Number(body.routing_step_id);
    const status = String(body.status ?? '').trim();
    const qtyRecorded = body.qty_recorded === undefined || body.qty_recorded === null || body.qty_recorded === '' ? null : Number(body.qty_recorded);
    const uom = body.uom ? String(body.uom).trim() : null;
    const notes = body.notes ? String(body.notes).trim() : null;

    if (!workOrderId || !routingStepId) {
      return { status: 400, body: { error: 'Work Order dan tahap routing wajib diisi.' } };
    }
    if (!productionBatchId) {
      return { status: 400, body: { error: 'Batch produksi wajib dipilih — buat batch dulu kalau belum ada.' } };
    }
    if (!stepStatuses.includes(status)) {
      return { status: 400, body: { error: 'Status tahap tidak valid.' } };
    }

    const adminClient = getAdminClient();

    const { data: wo, error: woError } = await adminClient
      .from('work_orders')
      .select('work_order_id, company_id')
      .eq('work_order_id', workOrderId)
      .maybeSingle();
    if (woError) return { status: 500, body: { error: woError.message } };
    if (!wo || wo.company_id !== appUser.company_id) {
      return { status: 404, body: { error: 'Work Order tidak ditemukan.' } };
    }

    const { data: batch, error: batchError } = await adminClient
      .from('production_batches')
      .select('production_batch_id, work_order_id, company_id')
      .eq('production_batch_id', productionBatchId)
      .maybeSingle();
    if (batchError) return { status: 500, body: { error: batchError.message } };
    if (!batch || batch.company_id !== appUser.company_id || batch.work_order_id !== workOrderId) {
      return { status: 404, body: { error: 'Batch produksi tidak ditemukan untuk Work Order ini.' } };
    }

    const { data: step, error: stepError } = await adminClient
      .from('routing_steps')
      .select('routing_step_id')
      .eq('routing_step_id', routingStepId)
      .maybeSingle();
    if (stepError) return { status: 500, body: { error: stepError.message } };
    if (!step) return { status: 400, body: { error: 'Tahap routing tidak ditemukan.' } };

    const { data: existing, error: existingError } = await adminClient
      .from('work_order_step_progress')
      .select('work_order_step_progress_id, status, started_at')
      .eq('production_batch_id', productionBatchId)
      .eq('routing_step_id', routingStepId)
      .neq('status', 'completed')
      .order('work_order_step_progress_id', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingError) return { status: 500, body: { error: existingError.message } };

    const now = new Date().toISOString();

    if (existing) {
      const { error: updateError } = await adminClient
        .from('work_order_step_progress')
        .update({
          status,
          qty_recorded: qtyRecorded,
          uom,
          notes,
          started_at: existing.started_at ?? (status !== 'pending' ? now : null),
          completed_at: status === 'completed' ? now : null
        })
        .eq('work_order_step_progress_id', existing.work_order_step_progress_id);
      if (updateError) return { status: 500, body: { error: updateError.message } };
    } else {
      const { error: insertError } = await adminClient.from('work_order_step_progress').insert([
        {
          work_order_id: workOrderId,
          production_batch_id: productionBatchId,
          routing_step_id: routingStepId,
          status,
          qty_recorded: qtyRecorded,
          uom,
          notes,
          started_at: status !== 'pending' ? now : null,
          completed_at: status === 'completed' ? now : null
        }
      ]);
      if (insertError) return { status: 500, body: { error: insertError.message } };
    }

    return { status: 200, body: { success: true } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}
