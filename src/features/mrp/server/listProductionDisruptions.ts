import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Default cuma yang masih terbuka (resolved_at kosong) — ?include_resolved=1
// untuk lihat riwayat lengkap.
export async function listProductionDisruptions(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const includeResolved = request.nextUrl.searchParams.get('include_resolved') === '1';
    const adminClient = getAdminClient();

    let query = adminClient
      .from('production_disruptions')
      .select('production_disruption_id, disruption_type, production_plant_id, work_center_id, work_order_id, production_batch_id, routing_step_id, shift_id, started_at, resolved_at, description')
      .eq('company_id', appUser.company_id)
      .order('started_at', { ascending: false });
    if (!includeResolved) {
      query = query.is('resolved_at', null);
    }
    const { data: disruptions, error } = await query;
    if (error) return { status: 500, body: { error: error.message } };

    const plantIds = Array.from(new Set((disruptions ?? []).map((d) => d.production_plant_id)));
    const workCenterIds = Array.from(new Set((disruptions ?? []).map((d) => d.work_center_id).filter((id): id is number => !!id)));
    const workOrderIds = Array.from(new Set((disruptions ?? []).map((d) => d.work_order_id).filter((id): id is number => !!id)));

    const [plantsRes, workCentersRes, workOrdersRes] = await Promise.all([
      plantIds.length ? adminClient.from('production_plants').select('production_plant_id, name').in('production_plant_id', plantIds) : Promise.resolve({ data: [], error: null }),
      workCenterIds.length ? adminClient.from('work_centers').select('work_center_id, name').in('work_center_id', workCenterIds) : Promise.resolve({ data: [], error: null }),
      workOrderIds.length ? adminClient.from('work_orders').select('work_order_id, item_id').in('work_order_id', workOrderIds) : Promise.resolve({ data: [] as { work_order_id: number; item_id: number }[], error: null })
    ]);
    if (plantsRes.error) return { status: 500, body: { error: plantsRes.error.message } };
    if (workCentersRes.error) return { status: 500, body: { error: workCentersRes.error.message } };
    if (workOrdersRes.error) return { status: 500, body: { error: workOrdersRes.error.message } };

    const itemIds = Array.from(new Set((workOrdersRes.data ?? []).map((wo) => wo.item_id)));
    const { data: items, error: itemsError } = itemIds.length
      ? await adminClient.from('items').select('item_id, item_code').in('item_id', itemIds)
      : { data: [] as { item_id: number; item_code: string | null }[], error: null };
    if (itemsError) return { status: 500, body: { error: itemsError.message } };

    const plantsById = new Map((plantsRes.data ?? []).map((p) => [p.production_plant_id, p]));
    const workCentersById = new Map((workCentersRes.data ?? []).map((w) => [w.work_center_id, w]));
    const itemsById = new Map((items ?? []).map((i) => [i.item_id, i]));
    const workOrdersById = new Map((workOrdersRes.data ?? []).map((wo) => [wo.work_order_id, wo]));

    const result = (disruptions ?? []).map((d) => ({
      ...d,
      production_plant_name: plantsById.get(d.production_plant_id)?.name ?? null,
      work_center_name: d.work_center_id ? (workCentersById.get(d.work_center_id)?.name ?? null) : null,
      work_order_item_code: d.work_order_id ? (itemsById.get(workOrdersById.get(d.work_order_id)?.item_id ?? -1)?.item_code ?? null) : null
    }));

    return { status: 200, body: { disruptions: result } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}
