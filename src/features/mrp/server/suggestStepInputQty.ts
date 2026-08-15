import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Saran qty_input saat operator MULAI suatu tahap — HANYA saran, tetap bisa
// diedit di form (lihat recordWorkOrderStepProgress, yang menyimpan apa pun
// yang operator masukkan, bukan angka ini). Sumbernya:
// - qty_recorded (output) tahap SEBELUMNYA pada production_batch yang SAMA,
//   kalau tahap sebelumnya sudah punya progres tercatat.
// - Kalau ini tahap pertama, ATAU tahap sebelumnya belum punya progres sama
//   sekali, jatuh balik ke production_batches.planned_qty batch ini.
export async function suggestStepInputQty(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const productionBatchId = Number(request.nextUrl.searchParams.get('production_batch_id'));
    const routingStepId = Number(request.nextUrl.searchParams.get('routing_step_id'));
    if (!productionBatchId || !routingStepId) {
      return { status: 400, body: { error: 'production_batch_id dan routing_step_id wajib diisi.' } };
    }

    const adminClient = getAdminClient();

    const { data: batch, error: batchError } = await adminClient
      .from('production_batches')
      .select('production_batch_id, company_id, planned_qty, uom')
      .eq('production_batch_id', productionBatchId)
      .maybeSingle();
    if (batchError) return { status: 500, body: { error: batchError.message } };
    if (!batch || batch.company_id !== appUser.company_id) {
      return { status: 404, body: { error: 'Batch produksi tidak ditemukan.' } };
    }

    const { data: step, error: stepError } = await adminClient
      .from('routing_steps')
      .select('routing_step_id, routing_id, sequence_no')
      .eq('routing_step_id', routingStepId)
      .maybeSingle();
    if (stepError) return { status: 500, body: { error: stepError.message } };
    if (!step) return { status: 404, body: { error: 'Tahap routing tidak ditemukan.' } };

    const { data: prevSteps, error: prevError } = await adminClient
      .from('routing_steps')
      .select('routing_step_id, sequence_no')
      .eq('routing_id', step.routing_id)
      .lt('sequence_no', step.sequence_no)
      .order('sequence_no', { ascending: false })
      .limit(1);
    if (prevError) return { status: 500, body: { error: prevError.message } };
    const prevStep = prevSteps?.[0];

    if (prevStep) {
      const { data: prevProgress, error: prevProgressError } = await adminClient
        .from('work_order_step_progress')
        .select('qty_recorded, uom')
        .eq('production_batch_id', productionBatchId)
        .eq('routing_step_id', prevStep.routing_step_id)
        .not('qty_recorded', 'is', null)
        .order('work_order_step_progress_id', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (prevProgressError) return { status: 500, body: { error: prevProgressError.message } };
      if (prevProgress && prevProgress.qty_recorded !== null) {
        return { status: 200, body: { suggested_qty: prevProgress.qty_recorded, suggested_uom: prevProgress.uom, source: 'previous_step' } };
      }
    }

    return { status: 200, body: { suggested_qty: batch.planned_qty, suggested_uom: batch.uom, source: 'planned_qty' } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}
