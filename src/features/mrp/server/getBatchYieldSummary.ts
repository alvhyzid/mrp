import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Ringkasan Yield per Batch: seluruh tahap routing berurutan dengan input →
// output → % susut masing-masing, PLUS total yield keseluruhan batch = output
// tahap TERAKHIR (urutan routing, bukan sekadar "yang terakhir dicatat") ÷
// input tahap PERTAMA × 100%. Kalau tahap pertama/terakhir belum punya progres
// tercatat, total_yield_pct null (belum bisa dihitung).
export async function getBatchYieldSummary(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const productionBatchId = Number(request.nextUrl.searchParams.get('production_batch_id'));
    if (!productionBatchId) {
      return { status: 400, body: { error: 'Batch produksi wajib diisi.' } };
    }

    const adminClient = getAdminClient();

    const { data: batch, error: batchError } = await adminClient
      .from('production_batches')
      .select('production_batch_id, company_id, batch_number, work_order_id')
      .eq('production_batch_id', productionBatchId)
      .maybeSingle();
    if (batchError) return { status: 500, body: { error: batchError.message } };
    if (!batch || batch.company_id !== appUser.company_id) {
      return { status: 404, body: { error: 'Batch produksi tidak ditemukan.' } };
    }

    const { data: workOrder, error: woError } = await adminClient
      .from('work_orders')
      .select('work_order_id, routing_id')
      .eq('work_order_id', batch.work_order_id)
      .maybeSingle();
    if (woError) return { status: 500, body: { error: woError.message } };
    if (!workOrder || !workOrder.routing_id) {
      return { status: 200, body: { batch_number: batch.batch_number, steps: [], total_yield_pct: null } };
    }

    const { data: routingSteps, error: stepsError } = await adminClient
      .from('routing_steps')
      .select('routing_step_id, sequence_no, step_name')
      .eq('routing_id', workOrder.routing_id)
      .order('sequence_no', { ascending: true });
    if (stepsError) return { status: 500, body: { error: stepsError.message } };

    const { data: progressRows, error: progressError } = await adminClient
      .from('work_order_step_progress')
      .select('work_order_step_progress_id, routing_step_id, status, qty_input, uom_input, qty_recorded, qty_reject, reject_reason, uom')
      .eq('production_batch_id', productionBatchId)
      .order('work_order_step_progress_id', { ascending: false });
    if (progressError) return { status: 500, body: { error: progressError.message } };

    // Baris TERBARU per tahap (bisa ada >1 baris kalau tahap diulang) — hasil
    // query sudah diurutkan terbaru dulu, jadi ambil kemunculan pertama saja.
    const latestByStep = new Map<number, (typeof progressRows)[number]>();
    for (const row of progressRows ?? []) {
      if (!latestByStep.has(row.routing_step_id)) latestByStep.set(row.routing_step_id, row);
    }

    const steps = (routingSteps ?? []).map((rs) => {
      const progress = latestByStep.get(rs.routing_step_id) ?? null;
      const qtyInput = progress?.qty_input ?? null;
      const qtyRecorded = progress?.qty_recorded ?? null;
      const shrinkagePct = qtyInput !== null && qtyInput > 0 && qtyRecorded !== null ? Math.round(((qtyInput - qtyRecorded) / qtyInput) * 10000) / 100 : null;
      const qtyReject = progress?.qty_reject ?? null;
      // % dari total susut (input - output baik) yang merupakan REJECT
      // spesifik — sisanya susut proses biasa (evaporasi dsb). Cuma bisa
      // dihitung kalau ada susut sama sekali (pembagi > 0).
      const rejectShareOfShrinkagePct =
        qtyReject !== null && qtyInput !== null && qtyRecorded !== null && qtyInput - qtyRecorded > 0 ? Math.round((qtyReject / (qtyInput - qtyRecorded)) * 10000) / 100 : null;
      return {
        routing_step_id: rs.routing_step_id,
        sequence_no: rs.sequence_no,
        step_name: rs.step_name,
        status: progress?.status ?? null,
        qty_input: qtyInput,
        uom_input: progress?.uom_input ?? null,
        qty_recorded: qtyRecorded,
        qty_reject: qtyReject,
        reject_reason: progress?.reject_reason ?? null,
        uom: progress?.uom ?? null,
        shrinkage_pct: shrinkagePct,
        reject_share_of_shrinkage_pct: rejectShareOfShrinkagePct
      };
    });

    const totalReject = steps.reduce((sum, s) => sum + (s.qty_reject ?? 0), 0);

    const firstStep = steps[0] ?? null;
    const lastStep = steps[steps.length - 1] ?? null;
    const totalYieldPct =
      firstStep && lastStep && firstStep.qty_input !== null && firstStep.qty_input > 0 && lastStep.qty_recorded !== null
        ? Math.round((lastStep.qty_recorded / firstStep.qty_input) * 10000) / 100
        : null;

    return {
      status: 200,
      body: {
        batch_number: batch.batch_number,
        steps,
        total_yield_pct: totalYieldPct,
        total_reject: totalReject
      }
    };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}
