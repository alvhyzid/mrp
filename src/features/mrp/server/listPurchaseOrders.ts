import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canViewPurchaseOrderPrice } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

const statusLabels: Record<string, string> = { draft: 'Draft', ordered: 'Dipesan', partially_received: 'Sebagian Diterima', received: 'Diterima Penuh', cancelled: 'Batal' };

export async function listPurchaseOrders(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const adminClient = getAdminClient();
    const canSeePrice = canViewPurchaseOrderPrice(appUser.role);

    const { data: pos, error: poError } = await adminClient
      .from('purchase_orders')
      .select('purchase_order_id, supplier_id, production_plant_id, status, order_date, expected_date, supplier_name_snapshot, supplier_address_snapshot, supplier_npwp_snapshot')
      .eq('company_id', appUser.company_id)
      .order('order_date', { ascending: false });
    if (poError) return { status: 500, body: { error: poError.message } };
    if (!pos || pos.length === 0) return { status: 200, body: { purchaseOrders: [] } };

    const supplierIds = Array.from(new Set(pos.map((po) => po.supplier_id)));
    const plantIds = Array.from(new Set(pos.map((po) => po.production_plant_id)));
    const poIds = pos.map((po) => po.purchase_order_id);

    const [suppliersRes, plantsRes, linesRes] = await Promise.all([
      adminClient.from('suppliers').select('supplier_id, name').in('supplier_id', supplierIds),
      adminClient.from('production_plants').select('production_plant_id, name').in('production_plant_id', plantIds),
      adminClient.from('purchase_order_lines').select('purchase_order_line_id, purchase_order_id, item_id, qty_ordered, qty_received, unit_price').in('purchase_order_id', poIds)
    ]);
    if (suppliersRes.error) return { status: 500, body: { error: suppliersRes.error.message } };
    if (plantsRes.error) return { status: 500, body: { error: plantsRes.error.message } };
    if (linesRes.error) return { status: 500, body: { error: linesRes.error.message } };

    const itemIds = Array.from(new Set((linesRes.data ?? []).map((l) => l.item_id)));
    const { data: items, error: itemsError } = itemIds.length
      ? await adminClient.from('items').select('item_id, item_code, name, purchase_uom').in('item_id', itemIds)
      : { data: [] as { item_id: number; item_code: string | null; name: string; purchase_uom: string }[], error: null };
    if (itemsError) return { status: 500, body: { error: itemsError.message } };

    const suppliersById = new Map((suppliersRes.data ?? []).map((s) => [s.supplier_id, s]));
    const plantsById = new Map((plantsRes.data ?? []).map((p) => [p.production_plant_id, p]));
    const itemsById = new Map((items ?? []).map((i) => [i.item_id, i]));
    const linesByPoId = new Map<number, typeof linesRes.data>();
    for (const line of linesRes.data ?? []) {
      const list = linesByPoId.get(line.purchase_order_id) ?? [];
      list.push(line);
      linesByPoId.set(line.purchase_order_id, list);
    }

    const result = pos.map((po) => ({
      purchase_order_id: po.purchase_order_id,
      // PMB-07a — utamakan identitas beku saat PO terbit; fallback ke join hidup
      // HANYA untuk PO lama yang dibuat sebelum kolom snapshot ada (snapshot null).
      supplier_name: po.supplier_name_snapshot ?? suppliersById.get(po.supplier_id)?.name ?? null,
      supplier_address: po.supplier_address_snapshot ?? null,
      supplier_npwp: po.supplier_npwp_snapshot ?? null,
      // V.1 (22 Agu 2026) — PO terbit sebelum kolom snapshot ada: TIDAK diisi
      // dari data supplier hari ini (mengarang identitas saat terbit), ditandai
      // apa adanya supaya layar bisa menjelaskan kenapa alamat/NPWP kosong.
      identity_predates_snapshot: po.supplier_name_snapshot === null,
      production_plant_name: plantsById.get(po.production_plant_id)?.name ?? null,
      status: po.status,
      status_label: statusLabels[po.status] ?? po.status,
      order_date: po.order_date,
      expected_date: po.expected_date,
      lines: (linesByPoId.get(po.purchase_order_id) ?? []).map((l) => ({
        purchase_order_line_id: l.purchase_order_line_id,
        item_code: itemsById.get(l.item_id)?.item_code ?? null,
        item_name: itemsById.get(l.item_id)?.name ?? null,
        purchase_uom: itemsById.get(l.item_id)?.purchase_uom ?? null,
        qty_ordered: l.qty_ordered,
        qty_received: l.qty_received,
        unit_price: canSeePrice ? l.unit_price : null
      }))
    }));

    return { status: 200, body: { purchaseOrders: result } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}
