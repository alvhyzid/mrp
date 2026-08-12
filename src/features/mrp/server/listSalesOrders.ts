import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canViewFinancialData } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

export async function listSalesOrders(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);

    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const adminClient = getAdminClient();
    const canSeeCost = canViewFinancialData(appUser.role);

    const { data: salesOrders, error: soError } = await adminClient
      .from('sales_orders')
      .select('sales_order_id, so_number, customer_id, production_plant_id, status, created_at')
      .eq('company_id', appUser.company_id)
      .order('created_at', { ascending: false });

    if (soError) return { status: 500, body: { error: soError.message } };
    if (!salesOrders || salesOrders.length === 0) {
      return { status: 200, body: { salesOrders: [] } };
    }

    const soIds = salesOrders.map((so) => so.sales_order_id);
    const customerIds = Array.from(new Set(salesOrders.map((so) => so.customer_id)));

    const [linesRes, customersRes, itemsRes, workOrdersRes] = await Promise.all([
      adminClient.from('sales_order_lines').select('sales_order_line_id, sales_order_id, item_id, qty_ordered, unit_price').in('sales_order_id', soIds),
      adminClient.from('customers').select('customer_id, name').in('customer_id', customerIds),
      adminClient.from('items').select('item_id, item_code, name, base_uom').eq('company_id', appUser.company_id),
      adminClient.from('work_orders').select('sales_order_line_id, planned_qty').not('sales_order_line_id', 'is', null)
    ]);

    if (linesRes.error) return { status: 500, body: { error: linesRes.error.message } };
    if (customersRes.error) return { status: 500, body: { error: customersRes.error.message } };
    if (itemsRes.error) return { status: 500, body: { error: itemsRes.error.message } };
    if (workOrdersRes.error) return { status: 500, body: { error: workOrdersRes.error.message } };

    const customersById = new Map((customersRes.data ?? []).map((c) => [c.customer_id, c]));
    const itemsById = new Map((itemsRes.data ?? []).map((i) => [i.item_id, i]));

    const woPlannedByLineId = new Map<number, number>();
    for (const wo of workOrdersRes.data ?? []) {
      if (!wo.sales_order_line_id) continue;
      woPlannedByLineId.set(wo.sales_order_line_id, (woPlannedByLineId.get(wo.sales_order_line_id) ?? 0) + Number(wo.planned_qty));
    }

    const linesBySoId = new Map<number, typeof linesRes.data>();
    for (const line of linesRes.data ?? []) {
      const list = linesBySoId.get(line.sales_order_id) ?? [];
      list.push(line);
      linesBySoId.set(line.sales_order_id, list);
    }

    const result = salesOrders.map((so) => ({
      sales_order_id: so.sales_order_id,
      so_number: so.so_number,
      customer_id: so.customer_id,
      customer_name: customersById.get(so.customer_id)?.name ?? null,
      production_plant_id: so.production_plant_id,
      status: so.status,
      lines: (linesBySoId.get(so.sales_order_id) ?? []).map((line) => {
        const item = itemsById.get(line.item_id);
        return {
          sales_order_line_id: line.sales_order_line_id,
          item_id: line.item_id,
          item_code: item?.item_code ?? null,
          item_name: item?.name ?? null,
          item_base_uom: item?.base_uom ?? null,
          qty_ordered: line.qty_ordered,
          unit_price: canSeeCost ? line.unit_price : null,
          qty_already_planned_in_wo: woPlannedByLineId.get(line.sales_order_line_id) ?? 0
        };
      })
    }));

    return { status: 200, body: { salesOrders: result } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}
