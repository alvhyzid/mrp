import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// K8 bagian D.1 — daftar usulan MENUNGGU keputusan, dengan nilai lama vs usulan
// vs dampak (persentase perubahan) supaya planner tidak perlu menghitung sendiri
// sebelum mengesahkan.
export async function listProductionStandardProposals(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const adminClient = getAdminClient();

    const { data: proposals, error } = await adminClient
      .from('production_standard_proposals')
      .select('production_standard_proposal_id, item_id, routing_step_id, metric_key, old_value, old_source, proposed_value, calculation_method, sample_count, status, created_at, updated_at')
      .eq('company_id', appUser.company_id)
      .eq('status', 'pending')
      .order('updated_at', { ascending: false });
    if (error) return { status: 500, body: { error: error.message } };

    const itemIds = [...new Set((proposals ?? []).map((p) => p.item_id))];
    const { data: items } = itemIds.length ? await adminClient.from('items').select('item_id, item_code, name').in('item_id', itemIds) : { data: [] };
    const itemsById = new Map((items ?? []).map((i) => [i.item_id, i]));

    const stepIds = [...new Set((proposals ?? []).map((p) => p.routing_step_id).filter((id): id is number => id !== null))];
    const { data: steps } = stepIds.length ? await adminClient.from('routing_steps').select('routing_step_id, step_name').in('routing_step_id', stepIds) : { data: [] };
    const stepsById = new Map((steps ?? []).map((s) => [s.routing_step_id, s]));

    const result = (proposals ?? []).map((p) => {
      const oldVal = p.old_value === null ? null : Number(p.old_value);
      const changePct = oldVal !== null && oldVal !== 0 ? ((Number(p.proposed_value) - oldVal) / Math.abs(oldVal)) * 100 : null;
      return {
        production_standard_proposal_id: p.production_standard_proposal_id,
        item_id: p.item_id,
        item_code: itemsById.get(p.item_id)?.item_code ?? null,
        item_name: itemsById.get(p.item_id)?.name ?? null,
        routing_step_id: p.routing_step_id,
        routing_step_name: p.routing_step_id ? stepsById.get(p.routing_step_id)?.step_name ?? null : null,
        metric_key: p.metric_key,
        old_value: oldVal,
        old_source: p.old_source,
        proposed_value: Number(p.proposed_value),
        calculation_method: p.calculation_method,
        sample_count: p.sample_count,
        change_pct: changePct === null ? null : Math.round(changePct * 100) / 100,
        will_flip_to_dipelajari: p.old_source !== 'DIPELAJARI',
        created_at: p.created_at,
        updated_at: p.updated_at
      };
    });

    return { status: 200, body: { proposals: result } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}
