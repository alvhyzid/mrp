import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Alur 1 (3.4) — "dua pintu masuk, satu data": dipanggil dari layar Supplier
// (?supplier_id=) DAN dari layar Item (?item_id=), keduanya membaca tabel
// yang sama.
export async function listSupplierItemPrices(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const url = new URL(request.url);
    const supplierId = url.searchParams.get('supplier_id');
    const itemId = url.searchParams.get('item_id');
    if (!supplierId && !itemId) {
      return { status: 400, body: { error: 'Wajib menyertakan supplier_id atau item_id.' } };
    }

    const adminClient = getAdminClient();
    let query = adminClient
      .from('supplier_item_prices')
      .select('supplier_item_price_id, supplier_id, item_id, supplier_item_code, supplier_item_name, reference_price, price_valid_from, min_order_qty, min_order_uom, lead_time_days_override, notes, updated_at')
      .eq('company_id', appUser.company_id);
    if (supplierId) query = query.eq('supplier_id', Number(supplierId));
    if (itemId) query = query.eq('item_id', Number(itemId));

    const { data, error } = await query.order('updated_at', { ascending: false });
    if (error) return { status: 500, body: { error: error.message } };

    const supplierIds = Array.from(new Set((data ?? []).map((r) => r.supplier_id)));
    const itemIds = Array.from(new Set((data ?? []).map((r) => r.item_id)));
    const [suppliersRes, itemsRes] = await Promise.all([
      supplierIds.length ? adminClient.from('suppliers').select('supplier_id, name').in('supplier_id', supplierIds) : Promise.resolve({ data: [] as { supplier_id: number; name: string }[], error: null }),
      itemIds.length ? adminClient.from('items').select('item_id, item_code, name, base_uom').in('item_id', itemIds) : Promise.resolve({ data: [] as { item_id: number; item_code: string; name: string; base_uom: string }[], error: null })
    ]);
    if (suppliersRes.error) return { status: 500, body: { error: suppliersRes.error.message } };
    if (itemsRes.error) return { status: 500, body: { error: itemsRes.error.message } };

    const supplierById = new Map((suppliersRes.data ?? []).map((s) => [s.supplier_id, s]));
    const itemById = new Map((itemsRes.data ?? []).map((i) => [i.item_id, i]));

    const prices = (data ?? []).map((row) => ({
      ...row,
      supplier_name: supplierById.get(row.supplier_id)?.name ?? null,
      item_code: itemById.get(row.item_id)?.item_code ?? null,
      item_name: itemById.get(row.item_id)?.name ?? null,
      item_base_uom: itemById.get(row.item_id)?.base_uom ?? null
    }));

    return { status: 200, body: { prices } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}
