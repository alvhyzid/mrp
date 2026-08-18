import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canAdjustStock } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Saldo Awal Stok — mode BARU dari "Penyesuaian Stok Manual" (GELOMBANG 0B) untuk
// membuat LOT BARU tanpa goods receipt/PO, dipakai saat pemilik produk menginput
// data stok pabrik yang sudah ada sebelum sistem ini dipakai. Akses sama persis
// dengan penyesuaian stok biasa (canAdjustStock: warehouse_manager/staff + leadership).
export async function recordOpeningBalance(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);

    if (!canAdjustStock(appUser.role)) {
      return { status: 403, body: { error: 'Role Anda tidak punya izin membuat saldo awal stok.' } };
    }
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const body = await request.json();
    const itemId = Number(body.item_id);
    const productionPlantId = Number(body.production_plant_id);
    const qty = Number(body.qty);
    const supplierLotNumber = body.lot_number ? String(body.lot_number).trim() : '';
    const expiryDate = body.expiry_date ? String(body.expiry_date).trim() : null;
    const notes = body.notes ? String(body.notes).trim() : null;
    const unitCost = body.unit_cost !== undefined && body.unit_cost !== null && body.unit_cost !== '' ? Number(body.unit_cost) : null;

    if (!itemId) {
      return { status: 400, body: { error: 'Item wajib dipilih.' } };
    }
    if (!productionPlantId) {
      return { status: 400, body: { error: 'Plant/gudang wajib dipilih.' } };
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      return { status: 400, body: { error: 'Jumlah saldo awal wajib diisi dan lebih besar dari 0.' } };
    }
    if (unitCost !== null && (!Number.isFinite(unitCost) || unitCost < 0)) {
      return { status: 400, body: { error: 'Harga per unit tidak boleh negatif.' } };
    }

    const adminClient = getAdminClient();

    const { data: item, error: itemError } = await adminClient
      .from('items')
      .select('item_id, company_id, item_code, base_uom')
      .eq('item_id', itemId)
      .maybeSingle();
    if (itemError) return { status: 500, body: { error: itemError.message } };
    if (!item || item.company_id !== appUser.company_id) {
      return { status: 404, body: { error: 'Item tidak ditemukan di perusahaan Anda.' } };
    }

    const { data: plant, error: plantError } = await adminClient
      .from('production_plants')
      .select('production_plant_id, company_id')
      .eq('production_plant_id', productionPlantId)
      .maybeSingle();
    if (plantError) return { status: 500, body: { error: plantError.message } };
    if (!plant || plant.company_id !== appUser.company_id) {
      return { status: 404, body: { error: 'Plant/gudang tidak ditemukan di perusahaan Anda.' } };
    }

    // Nomor lot supplier opsional (persis seperti diminta) — kalau kosong, sistem
    // yang membuat nomor lot supaya kolom NOT NULL+unique (company_id, lot_number)
    // tetap terpenuhi tanpa memaksa user mengarang nomor.
    const lotNumber = supplierLotNumber || `SALDO-AWAL-${item.item_code}-${Date.now()}`;

    const { data: result, error: rpcError } = await adminClient
      .rpc('create_opening_balance_lot', {
        p_company_id: appUser.company_id,
        p_item_id: itemId,
        p_production_plant_id: productionPlantId,
        p_qty: qty,
        p_lot_number: lotNumber,
        p_expiry_date: expiryDate,
        p_notes: notes,
        p_created_by: appUser.user_id,
        p_unit_cost: unitCost
      })
      .single();

    if (rpcError) {
      return { status: 400, body: { error: rpcError.message } };
    }

    const row = result as { out_lot_id: number; out_lot_number: string; out_stock_movement_id: number };
    return {
      status: 200,
      body: {
        success: true,
        lot_id: row.out_lot_id,
        lot_number: row.out_lot_number,
        stock_movement_id: row.out_stock_movement_id
      }
    };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}
