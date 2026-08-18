import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canProposeProductionStandard } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// K8 bagian D.3 (Fase Produksi Nyata) — GERBANG KELENGKAPAN: hanya batch dengan
// log SEMUA tahap routing-nya berstatus 'completed' boleh jadi bahan belajar
// standar produksi. Tidak ada kolom "batch completed" yang pernah diisi kode
// aplikasi manapun (dicek sebelum menulis fungsi ini) — jadi "batch selesai"
// dianggap dari sudut pandang yang bisa dibuktikan sekarang: SEMUA tahap
// routing-nya sudah tercatat selesai di work_order_step_progress, bukan dari
// kolom status production_batches (yang memang tidak pernah dipakai).
export async function learnFromBatch(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!canProposeProductionStandard(appUser.role)) {
      return { status: 403, body: { error: 'Role Anda tidak punya akses untuk mengajukan sampel standar produksi.' } };
    }
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const body = await request.json();
    const productionBatchId = Number(body.production_batch_id);
    if (!productionBatchId) {
      return { status: 400, body: { error: 'production_batch_id wajib diisi.' } };
    }

    const adminClient = getAdminClient();

    const { data: batch, error: batchError } = await adminClient
      .from('production_batches')
      .select('production_batch_id, company_id, work_order_id')
      .eq('production_batch_id', productionBatchId)
      .maybeSingle();
    if (batchError) return { status: 500, body: { error: batchError.message } };
    if (!batch || batch.company_id !== appUser.company_id) {
      return { status: 404, body: { error: 'Batch produksi tidak ditemukan di perusahaan Anda.' } };
    }

    const { data: workOrder, error: woError } = await adminClient
      .from('work_orders')
      .select('work_order_id, item_id, routing_id')
      .eq('work_order_id', batch.work_order_id)
      .maybeSingle();
    if (woError) return { status: 500, body: { error: woError.message } };
    if (!workOrder?.routing_id) {
      return { status: 400, body: { error: 'Work order batch ini tidak punya routing — tidak bisa dicek kelengkapan tahapnya.' } };
    }

    const { data: routingSteps, error: stepsError } = await adminClient
      .from('routing_steps')
      .select('routing_step_id, sequence_no')
      .eq('routing_id', workOrder.routing_id)
      .order('sequence_no', { ascending: true });
    if (stepsError) return { status: 500, body: { error: stepsError.message } };
    if (!routingSteps || routingSteps.length === 0) {
      return { status: 400, body: { error: 'Routing item ini belum punya tahap — tidak bisa dicek kelengkapan.' } };
    }

    const { data: progressRows, error: progressError } = await adminClient
      .from('work_order_step_progress')
      .select('routing_step_id, status, qty_input, qty_recorded, started_at, completed_at, work_order_step_progress_id')
      .eq('production_batch_id', productionBatchId)
      .order('work_order_step_progress_id', { ascending: false });
    if (progressError) return { status: 500, body: { error: progressError.message } };

    const latestByStep = new Map<number, (typeof progressRows)[number]>();
    for (const row of progressRows ?? []) {
      if (!latestByStep.has(row.routing_step_id)) latestByStep.set(row.routing_step_id, row);
    }

    const missingStepIds = routingSteps.filter((rs) => latestByStep.get(rs.routing_step_id)?.status !== 'completed').map((rs) => rs.routing_step_id);

    if (missingStepIds.length > 0) {
      const { error: exclusionError } = await adminClient.from('production_standard_exclusions').insert([
        {
          company_id: appUser.company_id,
          production_batch_id: productionBatchId,
          item_id: workOrder.item_id,
          reason: 'Log tahap tidak lengkap — ada tahap routing yang belum berstatus completed di work_order_step_progress.',
          missing_routing_step_ids: missingStepIds
        }
      ]);
      if (exclusionError) return { status: 500, body: { error: exclusionError.message } };
      return {
        status: 200,
        body: {
          excluded: true,
          reason: 'Batch ini TIDAK dijadikan sampel belajar karena log tahapnya belum lengkap.',
          missing_routing_step_ids: missingStepIds
        }
      };
    }

    // Lolos gerbang kelengkapan — hitung sampel per metrik dari data batch nyata.
    const orderedSteps = routingSteps.map((rs) => ({ ...rs, progress: latestByStep.get(rs.routing_step_id)! }));
    const firstStep = orderedSteps[0];
    const lastStep = orderedSteps[orderedSteps.length - 1];

    const proposalsCreated: Record<string, unknown>[] = [];

    // unit_per_batch — level item, dari total output main_output batch ini.
    const { data: outputs, error: outputError } = await adminClient
      .from('work_order_outputs')
      .select('qty, output_type')
      .eq('production_batch_id', productionBatchId)
      .eq('output_type', 'main_output');
    if (outputError) return { status: 500, body: { error: outputError.message } };
    const unitPerBatchSample = (outputs ?? []).reduce((sum, o) => sum + Number(o.qty), 0);
    if (unitPerBatchSample > 0) {
      const { error: rpcError } = await adminClient.rpc('propose_production_standard', {
        p_company_id: appUser.company_id,
        p_item_id: workOrder.item_id,
        p_routing_step_id: null,
        p_metric_key: 'unit_per_batch',
        p_new_sample: unitPerBatchSample
      });
      if (rpcError) return { status: 500, body: { error: rpcError.message } };
      proposalsCreated.push({ metric_key: 'unit_per_batch', sample: unitPerBatchSample });
    }

    // yield_percentage — level item, tahap terakhir (qty_recorded) ÷ tahap pertama (qty_input).
    if (firstStep.progress.qty_input && Number(firstStep.progress.qty_input) > 0 && lastStep.progress.qty_recorded !== null) {
      const yieldSample = (Number(lastStep.progress.qty_recorded) / Number(firstStep.progress.qty_input)) * 100;
      const { error: rpcError } = await adminClient.rpc('propose_production_standard', {
        p_company_id: appUser.company_id,
        p_item_id: workOrder.item_id,
        p_routing_step_id: null,
        p_metric_key: 'yield_percentage',
        p_new_sample: yieldSample
      });
      if (rpcError) return { status: 500, body: { error: rpcError.message } };
      proposalsCreated.push({ metric_key: 'yield_percentage', sample: yieldSample });
    }

    // active_duration_minutes — PER TAHAP, dari completed_at - started_at.
    for (const step of orderedSteps) {
      if (step.progress.started_at && step.progress.completed_at) {
        const minutes = (new Date(step.progress.completed_at).getTime() - new Date(step.progress.started_at).getTime()) / 60000;
        if (minutes > 0) {
          const { error: rpcError } = await adminClient.rpc('propose_production_standard', {
            p_company_id: appUser.company_id,
            p_item_id: workOrder.item_id,
            p_routing_step_id: step.routing_step_id,
            p_metric_key: 'active_duration_minutes',
            p_new_sample: minutes
          });
          if (rpcError) return { status: 500, body: { error: rpcError.message } };
          proposalsCreated.push({ metric_key: 'active_duration_minutes', routing_step_id: step.routing_step_id, sample: minutes });
        }
      }
    }

    return { status: 200, body: { excluded: false, samples_submitted: proposalsCreated } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}
