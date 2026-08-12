import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// PO ke supplier yang belum tuntas diterima — dipakai dashboard Warehouse untuk
// "barang perlu dikonfirmasi datang". Modul Purchasing (buat/edit PO ke supplier)
// belum dibangun; ini query baca murni ke tabel purchase_orders yang skemanya
// sudah ada, jadi akan kosong sampai modul itu dibangun dan mulai diisi datanya —
// bukan data palsu, memang belum ada transaksinya.
export async function listPurchaseOrdersPendingReceipt(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);

    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const adminClient = getAdminClient();

    const { data: pos, error: posError } = await adminClient
      .from('purchase_orders')
      .select('purchase_order_id, supplier_id, production_plant_id, status, order_date, expected_date')
      .eq('company_id', appUser.company_id)
      .in('status', ['draft', 'ordered', 'partially_received'])
      .order('expected_date', { ascending: true, nullsFirst: false });

    if (posError) {
      return { status: 500, body: { error: posError.message } };
    }

    if (!pos || pos.length === 0) {
      return { status: 200, body: { purchaseOrders: [] } };
    }

    const supplierIds = Array.from(new Set(pos.map((po) => po.supplier_id)));
    const plantIds = Array.from(new Set(pos.map((po) => po.production_plant_id)));
    const poIds = pos.map((po) => po.purchase_order_id);

    const [suppliersRes, plantsRes, linesRes] = await Promise.all([
      adminClient.from('suppliers').select('supplier_id, name').in('supplier_id', supplierIds),
      adminClient.from('production_plants').select('production_plant_id, name').in('production_plant_id', plantIds),
      adminClient.from('purchase_order_lines').select('purchase_order_id, item_id, qty_ordered, qty_received').in('purchase_order_id', poIds)
    ]);

    if (suppliersRes.error) return { status: 500, body: { error: suppliersRes.error.message } };
    if (plantsRes.error) return { status: 500, body: { error: plantsRes.error.message } };
    if (linesRes.error) return { status: 500, body: { error: linesRes.error.message } };

    const suppliersById = new Map((suppliersRes.data ?? []).map((s) => [s.supplier_id, s]));
    const plantsById = new Map((plantsRes.data ?? []).map((p) => [p.production_plant_id, p]));
    const lineCountByPoId = new Map<number, number>();
    for (const line of linesRes.data ?? []) {
      lineCountByPoId.set(line.purchase_order_id, (lineCountByPoId.get(line.purchase_order_id) ?? 0) + 1);
    }

    const result = pos.map((po) => ({
      purchase_order_id: po.purchase_order_id,
      supplier_name: suppliersById.get(po.supplier_id)?.name ?? null,
      production_plant_name: plantsById.get(po.production_plant_id)?.name ?? null,
      status: po.status,
      order_date: po.order_date,
      expected_date: po.expected_date,
      line_count: lineCountByPoId.get(po.purchase_order_id) ?? 0
    }));

    return { status: 200, body: { purchaseOrders: result } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}
