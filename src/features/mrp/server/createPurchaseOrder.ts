import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canManagePurchasing } from '@/lib/roles';
import { parsePurchaseOrderInput } from './purchaseOrderValidation';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

export async function createPurchaseOrder(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!canManagePurchasing(appUser.role)) {
      return { status: 403, body: { error: 'Role Anda tidak punya izin membuat PO ke supplier.' } };
    }
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const body = await request.json();
    const { data: parsed, error: parseError } = parsePurchaseOrderInput(body);
    if (parseError || !parsed) return { status: 400, body: { error: parseError ?? 'Input tidak valid.' } };

    const adminClient = getAdminClient();

    const { data: supplier, error: supplierError } = await adminClient.from('suppliers').select('supplier_id, company_id').eq('supplier_id', parsed.supplier_id).maybeSingle();
    if (supplierError) return { status: 500, body: { error: supplierError.message } };
    if (!supplier || supplier.company_id !== appUser.company_id) return { status: 400, body: { error: 'Supplier tidak valid.' } };

    const { data: plant, error: plantError } = await adminClient.from('production_plants').select('production_plant_id, company_id').eq('production_plant_id', parsed.production_plant_id).maybeSingle();
    if (plantError) return { status: 500, body: { error: plantError.message } };
    if (!plant || plant.company_id !== appUser.company_id) return { status: 400, body: { error: 'Lokasi pabrik tidak valid.' } };

    const itemIds = Array.from(new Set(parsed.lines.map((l) => l.item_id)));
    const { data: items, error: itemsError } = await adminClient.from('items').select('item_id, company_id').in('item_id', itemIds);
    if (itemsError) return { status: 500, body: { error: itemsError.message } };
    const validItemIds = new Set((items ?? []).filter((i) => i.company_id === appUser.company_id).map((i) => i.item_id));
    if (validItemIds.size !== itemIds.length) return { status: 400, body: { error: 'Salah satu item pada baris PO tidak valid.' } };

    const { data: po, error: poError } = await adminClient
      .from('purchase_orders')
      .insert([{ company_id: appUser.company_id, supplier_id: parsed.supplier_id, production_plant_id: parsed.production_plant_id, status: 'ordered', expected_date: parsed.expected_date }])
      .select('purchase_order_id')
      .single();
    if (poError) return { status: 500, body: { error: poError.message } };

    const { error: linesError } = await adminClient.from('purchase_order_lines').insert(
      parsed.lines.map((line) => ({
        purchase_order_id: po.purchase_order_id,
        item_id: line.item_id,
        qty_ordered: line.qty_ordered,
        unit_price: line.unit_price
      }))
    );
    if (linesError) {
      await adminClient.from('purchase_orders').delete().eq('purchase_order_id', po.purchase_order_id);
      return { status: 500, body: { error: linesError.message } };
    }

    return { status: 201, body: { purchase_order_id: po.purchase_order_id } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}
