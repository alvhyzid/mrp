import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

export async function listWorkOrders(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);

    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const adminClient = getAdminClient();

    const { data: workOrders, error: woError } = await adminClient
      .from('work_orders')
      .select('work_order_id, production_plant_id, item_id, bom_id, routing_id, sales_order_line_id, planned_qty, status, priority, scheduled_start, scheduled_end, actual_start_at, actual_completed_at, created_at')
      .eq('company_id', appUser.company_id)
      .order('created_at', { ascending: false });

    if (woError) {
      return { status: 500, body: { error: woError.message } };
    }

    if (!workOrders || workOrders.length === 0) {
      return { status: 200, body: { workOrders: [] } };
    }

    const woIds = workOrders.map((wo) => wo.work_order_id);
    const itemIds = Array.from(new Set(workOrders.map((wo) => wo.item_id)));
    const soLineIds = Array.from(new Set(workOrders.map((wo) => wo.sales_order_line_id).filter((id): id is number => !!id)));
    const plantIds = Array.from(new Set(workOrders.map((wo) => wo.production_plant_id)));

    const [itemsRes, soLinesRes, plantsRes, readinessRes, consumptionRes] = await Promise.all([
      adminClient.from('items').select('item_id, item_code, name, base_uom').in('item_id', itemIds),
      soLineIds.length
        ? adminClient.from('sales_order_lines').select('sales_order_line_id, sales_order_id, qty_ordered').in('sales_order_line_id', soLineIds)
        : Promise.resolve({ data: [] as { sales_order_line_id: number; sales_order_id: number; qty_ordered: number }[], error: null }),
      adminClient.from('production_plants').select('production_plant_id, name').in('production_plant_id', plantIds),
      adminClient.from('work_orders_readiness').select('work_order_id, readiness, open_alert_count').in('work_order_id', woIds),
      adminClient.from('work_order_consumption').select('work_order_id, qty_consumed').in('work_order_id', woIds)
    ]);

    if (itemsRes.error) return { status: 500, body: { error: itemsRes.error.message } };
    if (soLinesRes.error) return { status: 500, body: { error: soLinesRes.error.message } };
    if (plantsRes.error) return { status: 500, body: { error: plantsRes.error.message } };
    if (readinessRes.error) return { status: 500, body: { error: readinessRes.error.message } };
    if (consumptionRes.error) return { status: 500, body: { error: consumptionRes.error.message } };

    const salesOrderIds = Array.from(new Set((soLinesRes.data ?? []).map((line) => line.sales_order_id)));
    const { data: salesOrders, error: soError } = salesOrderIds.length
      ? await adminClient.from('sales_orders').select('sales_order_id, so_number, customer_id').in('sales_order_id', salesOrderIds)
      : { data: [] as { sales_order_id: number; so_number: string; customer_id: number }[], error: null };
    if (soError) return { status: 500, body: { error: soError.message } };

    const itemsById = new Map((itemsRes.data ?? []).map((item) => [item.item_id, item]));
    const soLinesById = new Map((soLinesRes.data ?? []).map((line) => [line.sales_order_line_id, line]));
    const plantsById = new Map((plantsRes.data ?? []).map((plant) => [plant.production_plant_id, plant]));
    const readinessByWoId = new Map((readinessRes.data ?? []).map((r) => [r.work_order_id, r]));
    const soById = new Map((salesOrders ?? []).map((so) => [so.sales_order_id, so]));

    const consumedByWoId = new Map<number, number>();
    for (const row of consumptionRes.data ?? []) {
      consumedByWoId.set(row.work_order_id, (consumedByWoId.get(row.work_order_id) ?? 0) + Number(row.qty_consumed));
    }

    const result = workOrders.map((wo) => {
      const item = itemsById.get(wo.item_id);
      const soLine = wo.sales_order_line_id ? soLinesById.get(wo.sales_order_line_id) : null;
      const so = soLine ? soById.get(soLine.sales_order_id) : null;
      const readiness = readinessByWoId.get(wo.work_order_id);
      return {
        work_order_id: wo.work_order_id,
        item_id: wo.item_id,
        item_code: item?.item_code ?? null,
        item_name: item?.name ?? null,
        item_base_uom: item?.base_uom ?? null,
        bom_id: wo.bom_id,
        routing_id: wo.routing_id,
        production_plant_id: wo.production_plant_id,
        production_plant_name: plantsById.get(wo.production_plant_id)?.name ?? null,
        sales_order_line_id: wo.sales_order_line_id,
        so_number: so?.so_number ?? null,
        customer_id: so?.customer_id ?? null,
        planned_qty: wo.planned_qty,
        status: wo.status,
        priority: wo.priority,
        scheduled_start: wo.scheduled_start,
        scheduled_end: wo.scheduled_end,
        readiness: readiness?.readiness ?? wo.status,
        open_alert_count: readiness?.open_alert_count ?? 0,
        total_consumed_events: consumedByWoId.has(wo.work_order_id) ? consumedByWoId.get(wo.work_order_id) : 0
      };
    });

    return { status: 200, body: { workOrders: result } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}
