import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canManageWorkOrder } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

export async function recordWorkOrderConsumption(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);

    if (!canManageWorkOrder(appUser.role)) {
      return { status: 403, body: { error: 'Role Anda tidak punya izin mencatat pemakaian bahan.' } };
    }

    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const body = await request.json();
    const workOrderId = Number(body.work_order_id);
    const productionBatchId = Number(body.production_batch_id);
    const lotId = Number(body.component_lot_id);
    const qtyConsumed = Number(body.qty_consumed);

    if (!workOrderId || !lotId) {
      return { status: 400, body: { error: 'Work Order dan lot bahan wajib dipilih.' } };
    }
    // production_batch_id WAJIB untuk pencatatan baru — pemakaian bahan sekarang
    // dicatat di level batch (docs: "pencatatan detail sekarang di level batch,
    // bukan langsung di level WO"). Kolomnya tetap nullable di DB supaya baris lama
    // (dari sebelum production_batches ada) tetap valid.
    if (!productionBatchId) {
      return { status: 400, body: { error: 'Batch produksi wajib dipilih — buat batch dulu kalau belum ada.' } };
    }
    if (Number.isNaN(qtyConsumed) || qtyConsumed <= 0) {
      return { status: 400, body: { error: 'Jumlah pemakaian harus lebih besar dari 0.' } };
    }

    const adminClient = getAdminClient();

    const { data: wo, error: woError } = await adminClient
      .from('work_orders')
      .select('work_order_id, company_id')
      .eq('work_order_id', workOrderId)
      .maybeSingle();
    if (woError) return { status: 500, body: { error: woError.message } };
    if (!wo || wo.company_id !== appUser.company_id) {
      return { status: 404, body: { error: 'Work Order tidak ditemukan.' } };
    }

    const { data: batch, error: batchError } = await adminClient
      .from('production_batches')
      .select('production_batch_id, work_order_id, company_id')
      .eq('production_batch_id', productionBatchId)
      .maybeSingle();
    if (batchError) return { status: 500, body: { error: batchError.message } };
    if (!batch || batch.company_id !== appUser.company_id || batch.work_order_id !== workOrderId) {
      return { status: 404, body: { error: 'Batch produksi tidak ditemukan untuk Work Order ini.' } };
    }

    const { data: lot, error: lotError } = await adminClient
      .from('lots')
      .select('lot_id, company_id, quantity_on_hand, status')
      .eq('lot_id', lotId)
      .maybeSingle();
    if (lotError) return { status: 500, body: { error: lotError.message } };
    if (!lot || lot.company_id !== appUser.company_id) {
      return { status: 404, body: { error: 'Lot bahan tidak ditemukan.' } };
    }
    if (lot.status !== 'available') {
      return { status: 400, body: { error: 'Lot ini berstatus tidak tersedia (bukan available).' } };
    }
    if (qtyConsumed > Number(lot.quantity_on_hand)) {
      return { status: 400, body: { error: `Jumlah pemakaian (${qtyConsumed}) melebihi stok tersedia di lot ini (${lot.quantity_on_hand}).` } };
    }

    const { error: insertError } = await adminClient
      .from('work_order_consumption')
      .insert([{ work_order_id: workOrderId, production_batch_id: productionBatchId, component_lot_id: lotId, qty_consumed: qtyConsumed }]);

    if (insertError) {
      return { status: 500, body: { error: insertError.message } };
    }

    return { status: 200, body: { success: true } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}
