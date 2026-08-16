import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canAdjustStock } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

const reasonCodes = ['stock_opname_variance', 'damaged', 'other'];

// Penyesuaian stok manual — akses sengaja lebih sempit dari dashboard Warehouse
// biasa (canAdjustStock, bukan canAccessWarehouseDashboard), lihat catatan di
// src/lib/roles.ts. Update lots.quantity_on_hand + insert stock_movements
// dikerjakan ATOMIK oleh fungsi database record_manual_stock_adjustment()
// (migrasi 20260817120000), bukan 2 query terpisah dari sini.
export async function recordStockAdjustment(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);

    if (!canAdjustStock(appUser.role)) {
      return { status: 403, body: { error: 'Role Anda tidak punya izin melakukan penyesuaian stok manual.' } };
    }
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const body = await request.json();
    const lotId = Number(body.lot_id);
    const qtyDelta = Number(body.qty_delta);
    const reasonCode = String(body.reason_code ?? '').trim();
    const notes = body.notes ? String(body.notes).trim() : null;

    if (!lotId) {
      return { status: 400, body: { error: 'Lot wajib dipilih.' } };
    }
    if (!Number.isFinite(qtyDelta) || qtyDelta === 0) {
      return { status: 400, body: { error: 'Jumlah penyesuaian wajib diisi dan tidak boleh 0.' } };
    }
    if (!reasonCodes.includes(reasonCode)) {
      return { status: 400, body: { error: 'Alasan penyesuaian wajib dipilih.' } };
    }
    if (reasonCode === 'other' && !notes) {
      return { status: 400, body: { error: 'Alasan "Lainnya" wajib diisi catatan bebasnya.' } };
    }

    const adminClient = getAdminClient();

    const { data: lot, error: lotError } = await adminClient
      .from('lots')
      .select('lot_id, company_id, item_id, lot_number, status')
      .eq('lot_id', lotId)
      .maybeSingle();
    if (lotError) return { status: 500, body: { error: lotError.message } };
    if (!lot || lot.company_id !== appUser.company_id) {
      return { status: 404, body: { error: 'Lot tidak ditemukan di perusahaan Anda.' } };
    }
    if (lot.status !== 'available') {
      return { status: 400, body: { error: 'Lot ini berstatus tidak tersedia (bukan available) — tidak bisa disesuaikan.' } };
    }

    const { data: result, error: rpcError } = await adminClient
      .rpc('record_manual_stock_adjustment', {
        p_lot_id: lotId,
        p_qty_delta: qtyDelta,
        p_reason_code: reasonCode,
        p_notes: notes,
        p_created_by: appUser.user_id
      })
      .single();

    if (rpcError) {
      return { status: 400, body: { error: rpcError.message } };
    }

    const row = result as { out_lot_id: number; out_quantity_on_hand: number; out_stock_movement_id: number };
    return {
      status: 200,
      body: {
        success: true,
        lot_id: row.out_lot_id,
        quantity_on_hand: row.out_quantity_on_hand,
        stock_movement_id: row.out_stock_movement_id
      }
    };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}
