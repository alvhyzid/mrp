import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canViewFinancialData } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Dipakai halaman Work Order untuk memilih lot bahan yang mau dipakai — bisa
// difilter ke sekumpulan item_id sekaligus (komponen-komponen BOM satu WO).
export async function listLots(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);

    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const itemIdsParam = request.nextUrl.searchParams.get('item_ids');
    const itemIds = itemIdsParam
      ? itemIdsParam
          .split(',')
          .map((value) => Number(value.trim()))
          .filter((value) => Number.isInteger(value) && value > 0)
      : null;

    const adminClient = getAdminClient();
    let query = adminClient
      .from('lots')
      .select('lot_id, item_id, lot_number, expiry_date, produced_or_received_date, quantity_on_hand, source_type, status, unit_cost, source_customer_purchase_order_id')
      .eq('company_id', appUser.company_id)
      .eq('status', 'available')
      .gt('quantity_on_hand', 0)
      .order('expiry_date', { ascending: true, nullsFirst: false });

    if (itemIds && itemIds.length > 0) {
      query = query.in('item_id', itemIds);
    }

    const { data: lots, error } = await query;
    if (error) {
      return { status: 500, body: { error: error.message } };
    }

    const cpoIds = Array.from(new Set((lots ?? []).map((lot) => lot.source_customer_purchase_order_id).filter((id): id is number => !!id)));

    let customerIdByCpoId = new Map<number, number>();
    if (cpoIds.length > 0) {
      const { data: cpos } = await adminClient.from('customer_purchase_orders').select('customer_purchase_order_id, customer_id').in('customer_purchase_order_id', cpoIds);
      customerIdByCpoId = new Map((cpos ?? []).map((cpo) => [cpo.customer_purchase_order_id, cpo.customer_id]));
    }

    const canSeeCost = canViewFinancialData(appUser.role);
    const result = (lots ?? []).map((lot) => ({
      ...lot,
      unit_cost: canSeeCost ? lot.unit_cost : null,
      source_customer_id: lot.source_customer_purchase_order_id ? customerIdByCpoId.get(lot.source_customer_purchase_order_id) ?? null : null
    }));

    return { status: 200, body: { lots: result } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}
