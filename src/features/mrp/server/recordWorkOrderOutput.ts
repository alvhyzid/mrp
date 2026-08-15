import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canManageWorkOrder } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

const outputTypes = ['main_output', 'reprocessable_waste', 'disposed_waste'];

// Mencatat hasil produksi (WIP/FG) dari 1 batch — bikin lot BARU (source_type
// 'produced'), work_order_outputs, stock_movement, DAN yang penting:
// lot_genealogy (lot output ini "dibuat dari" lot-lot apa saja yang dikonsumsi
// pada batch YANG SAMA lewat work_order_consumption) — inti traceability
// BPOM/halal. Sebelum fungsi ini ditulis, work_order_outputs/lot_genealogy
// tidak pernah terisi sama sekali di sistem manapun.
export async function recordWorkOrderOutput(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!canManageWorkOrder(appUser.role)) {
      return { status: 403, body: { error: 'Role Anda tidak punya izin mencatat hasil produksi.' } };
    }
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const body = await request.json();
    const workOrderId = Number(body.work_order_id);
    const productionBatchId = Number(body.production_batch_id);
    const qty = Number(body.qty);
    const outputType = typeof body.output_type === 'string' ? body.output_type : 'main_output';
    const lotNumber = body.lot_number ? String(body.lot_number).trim() : null;
    const expiryDate = body.expiry_date ? String(body.expiry_date).trim() : null;

    if (!workOrderId || !productionBatchId) return { status: 400, body: { error: 'Work Order dan batch produksi wajib dipilih.' } };
    if (!Number.isFinite(qty) || qty <= 0) return { status: 400, body: { error: 'Jumlah hasil produksi harus lebih besar dari 0.' } };
    if (!outputTypes.includes(outputType)) return { status: 400, body: { error: 'Jenis output tidak valid.' } };

    const adminClient = getAdminClient();

    const { data: wo, error: woError } = await adminClient
      .from('work_orders')
      .select('work_order_id, company_id, production_plant_id, item_id')
      .eq('work_order_id', workOrderId)
      .maybeSingle();
    if (woError) return { status: 500, body: { error: woError.message } };
    if (!wo || wo.company_id !== appUser.company_id) return { status: 404, body: { error: 'Work Order tidak ditemukan.' } };

    const { data: batch, error: batchError } = await adminClient
      .from('production_batches')
      .select('production_batch_id, work_order_id, company_id, shift_id')
      .eq('production_batch_id', productionBatchId)
      .maybeSingle();
    if (batchError) return { status: 500, body: { error: batchError.message } };
    if (!batch || batch.company_id !== appUser.company_id || batch.work_order_id !== workOrderId) {
      return { status: 404, body: { error: 'Batch produksi tidak ditemukan untuk Work Order ini.' } };
    }

    const { data: item, error: itemError } = await adminClient.from('items').select('item_id, base_uom').eq('item_id', wo.item_id).maybeSingle();
    if (itemError) return { status: 500, body: { error: itemError.message } };
    if (!item) return { status: 400, body: { error: 'Item pada Work Order ini tidak valid.' } };

    const finalLotNumber = lotNumber || `WO-${workOrderId}-OUT-${Date.now()}`;

    const { data: newLot, error: lotError } = await adminClient
      .from('lots')
      .insert([
        {
          company_id: appUser.company_id,
          production_plant_id: wo.production_plant_id,
          item_id: wo.item_id,
          lot_number: finalLotNumber,
          expiry_date: expiryDate,
          produced_or_received_date: new Date().toISOString().slice(0, 10),
          quantity_on_hand: qty,
          source_type: 'produced',
          status: 'available'
        }
      ])
      .select('lot_id')
      .single();
    if (lotError) return { status: 500, body: { error: lotError.message } };

    const { data: output, error: outputError } = await adminClient
      .from('work_order_outputs')
      .insert([{ work_order_id: workOrderId, production_batch_id: productionBatchId, item_id: wo.item_id, shift_id: batch.shift_id, output_type: outputType, qty, lot_id: newLot.lot_id }])
      .select('work_order_output_id')
      .single();
    if (outputError) return { status: 500, body: { error: outputError.message } };

    const { error: movementError } = await adminClient
      .from('stock_movements')
      .insert([{ company_id: appUser.company_id, lot_id: newLot.lot_id, movement_type: 'production_output', qty, reference_doc: `WO-${workOrderId}`, created_by: appUser.user_id }]);
    if (movementError) return { status: 500, body: { error: movementError.message } };

    // Genealogy: lot output ini "dibuat dari" SEMUA lot yang tercatat dikonsumsi
    // pada BATCH yang sama (bisa lebih dari 1 baris kalau lot yang sama dipakai
    // berkali-kali — dijumlahkan jadi 1 baris genealogy per lot komponen).
    const { data: consumption, error: consumptionError } = await adminClient
      .from('work_order_consumption')
      .select('component_lot_id, qty_consumed')
      .eq('production_batch_id', productionBatchId);
    if (consumptionError) return { status: 500, body: { error: consumptionError.message } };

    const qtyByComponentLot = new Map<number, number>();
    for (const row of consumption ?? []) {
      qtyByComponentLot.set(row.component_lot_id, (qtyByComponentLot.get(row.component_lot_id) ?? 0) + Number(row.qty_consumed));
    }

    let genealogyRowsCreated = 0;
    if (qtyByComponentLot.size > 0) {
      const genealogyRows = Array.from(qtyByComponentLot.entries()).map(([componentLotId, qtyConsumed]) => ({
        output_lot_id: newLot.lot_id,
        component_lot_id: componentLotId,
        qty_consumed: qtyConsumed
      }));
      const { error: genealogyError } = await adminClient.from('lot_genealogy').insert(genealogyRows);
      if (genealogyError) return { status: 500, body: { error: genealogyError.message } };
      genealogyRowsCreated = genealogyRows.length;
    }

    return { status: 201, body: { work_order_output_id: output.work_order_output_id, lot_id: newLot.lot_id, lot_number: finalLotNumber, genealogy_rows_created: genealogyRowsCreated } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}
