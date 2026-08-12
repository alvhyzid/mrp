import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Ringkasan stok saat ini per item per plant, dihitung langsung dari tabel lots
// yang sama dipakai modul Work Order/consumption — bukan tabel terpisah (Prinsip
// Desain #8). Tidak menampilkan unit_cost sama sekali (dashboard Warehouse murni
// operasional, bukan finansial), jadi tidak perlu masking di sini.
export async function listStockSummary(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);

    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const adminClient = getAdminClient();

    const { data: lots, error: lotsError } = await adminClient
      .from('lots')
      .select('item_id, production_plant_id, quantity_on_hand, status')
      .eq('company_id', appUser.company_id)
      .eq('status', 'available');

    if (lotsError) {
      return { status: 500, body: { error: lotsError.message } };
    }

    const { data: items, error: itemsError } = await adminClient
      .from('items')
      .select('item_id, item_code, name, base_uom, type, min_stock_level, reorder_point')
      .eq('company_id', appUser.company_id);
    if (itemsError) {
      return { status: 500, body: { error: itemsError.message } };
    }

    const { data: plants, error: plantsError } = await adminClient
      .from('production_plants')
      .select('production_plant_id, name')
      .eq('company_id', appUser.company_id);
    if (plantsError) {
      return { status: 500, body: { error: plantsError.message } };
    }

    const itemsById = new Map((items ?? []).map((i) => [i.item_id, i]));
    const plantsById = new Map((plants ?? []).map((p) => [p.production_plant_id, p]));

    const totalsByKey = new Map<string, { item_id: number; production_plant_id: number; total_qty: number; lot_count: number }>();
    for (const lot of lots ?? []) {
      const key = `${lot.item_id}:${lot.production_plant_id}`;
      const existing = totalsByKey.get(key) ?? { item_id: lot.item_id, production_plant_id: lot.production_plant_id, total_qty: 0, lot_count: 0 };
      existing.total_qty += Number(lot.quantity_on_hand);
      existing.lot_count += 1;
      totalsByKey.set(key, existing);
    }

    const result = Array.from(totalsByKey.values()).map((row) => {
      const item = itemsById.get(row.item_id);
      const minStock = item?.min_stock_level ? Number(item.min_stock_level) : 0;
      return {
        item_id: row.item_id,
        item_code: item?.item_code ?? null,
        item_name: item?.name ?? null,
        item_type: item?.type ?? null,
        base_uom: item?.base_uom ?? null,
        min_stock_level: item?.min_stock_level ?? null,
        reorder_point: item?.reorder_point ?? null,
        production_plant_id: row.production_plant_id,
        production_plant_name: plantsById.get(row.production_plant_id)?.name ?? null,
        total_qty: row.total_qty,
        lot_count: row.lot_count,
        is_below_min_stock: minStock > 0 && row.total_qty < minStock
      };
    });

    result.sort((a, b) => (a.item_code ?? '').localeCompare(b.item_code ?? ''));

    return { status: 200, body: { stockSummary: result } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}
