import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canManageWorkOrder } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

const outputTypes = ['main_output', 'reprocessable_waste', 'disposed_waste'];

interface OutputLineInput {
  qty: number;
  output_type: string;
  lot_number: string | null;
  expiry_date: string | null;
}

// Mencatat hasil produksi (WIP/FG, DAN sisa reprocessable/waste — 1 batch bisa
// menghasilkan lebih dari 1 output sekaligus, lihat docs prinsip #5) dari 1
// batch — tiap baris output bikin lot BARU (source_type 'produced'), baris
// work_order_outputs, stock_movement sendiri-sendiri, DAN yang penting:
// lot_genealogy (tiap lot output "dibuat dari" lot-lot yang sama yang
// dikonsumsi pada batch itu lewat work_order_consumption — SEMUA output dari
// 1 batch mewarisi genealogy yang sama, karena konsumsi bahannya tidak
// dipisah per output) — inti traceability BPOM/halal.
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

    if (!workOrderId || !productionBatchId) return { status: 400, body: { error: 'Work Order dan batch produksi wajib dipilih.' } };

    const rawOutputs = Array.isArray(body.outputs) ? body.outputs : body.qty !== undefined ? [{ qty: body.qty, output_type: body.output_type, lot_number: body.lot_number, expiry_date: body.expiry_date }] : [];
    if (rawOutputs.length === 0) return { status: 400, body: { error: 'Minimal 1 baris hasil produksi wajib diisi.' } };

    const outputLines: OutputLineInput[] = [];
    for (const raw of rawOutputs as Record<string, unknown>[]) {
      const qty = Number(raw.qty);
      const outputType = typeof raw.output_type === 'string' ? raw.output_type : 'main_output';
      if (!Number.isFinite(qty) || qty <= 0) return { status: 400, body: { error: 'Jumlah hasil produksi harus lebih besar dari 0 di setiap baris.' } };
      if (!outputTypes.includes(outputType)) return { status: 400, body: { error: 'Jenis output tidak valid.' } };
      outputLines.push({
        qty,
        output_type: outputType,
        lot_number: raw.lot_number ? String(raw.lot_number).trim() : null,
        expiry_date: raw.expiry_date ? String(raw.expiry_date).trim() : null
      });
    }

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

    // Genealogy dihitung SEKALI dari konsumsi batch ini (bukan per-output) — semua
    // output dari batch yang sama mewarisi baris genealogy yang identik, karena
    // work_order_consumption tidak membedakan "bahan ini dipakai untuk output A vs B".
    const { data: consumption, error: consumptionError } = await adminClient
      .from('work_order_consumption')
      .select('component_lot_id, qty_consumed')
      .eq('production_batch_id', productionBatchId);
    if (consumptionError) return { status: 500, body: { error: consumptionError.message } };

    const qtyByComponentLot = new Map<number, number>();
    for (const row of consumption ?? []) {
      qtyByComponentLot.set(row.component_lot_id, (qtyByComponentLot.get(row.component_lot_id) ?? 0) + Number(row.qty_consumed));
    }

    // Biaya lot output (spesifikasi-aturan-biaya-v1.md §1 K5/K6 & §3, §5 Contoh 1):
    // unit_cost lot = (Σ biaya bahan NON-KEMASAN batch INI + Σ biaya SDM batch INI) ÷
    // qty output UTAMA. Kemasan DIKONSUMSI lewat mekanisme yang SAMA (work_order_
    // consumption, K6 — dikonfirmasi GELOMBANG 0A) TAPI dihitung TERPISAH ke
    // packaging_cost (kolom sendiri, migration 20260818140000) — spec §5 Contoh 1
    // secara eksplisit menampilkan "Biaya produksi per botol" (bahan+SDM) dan
    // "Kemasan per botol" sebagai 2 angka TERPISAH, baru dijumlah di langkah Margin
    // (rumus §3: "Biaya produksi order = Σ biaya batch + biaya kemasan").
    let materialCost = 0;
    let packagingCost = 0;
    if (qtyByComponentLot.size > 0) {
      const componentLotIds = Array.from(qtyByComponentLot.keys());
      const { data: componentLots, error: componentLotsError } = await adminClient.from('lots').select('lot_id, unit_cost, item_id').in('lot_id', componentLotIds);
      if (componentLotsError) return { status: 500, body: { error: componentLotsError.message } };
      const componentItemIds = Array.from(new Set((componentLots ?? []).map((l) => l.item_id)));
      const { data: componentItems, error: componentItemsError } = await adminClient.from('items').select('item_id, type').in('item_id', componentItemIds);
      if (componentItemsError) return { status: 500, body: { error: componentItemsError.message } };
      const typeByItemId = new Map((componentItems ?? []).map((i) => [i.item_id, i.type]));
      const lotInfoById = new Map((componentLots ?? []).map((l) => [l.lot_id, l]));

      for (const [lotId, qty] of qtyByComponentLot.entries()) {
        const lotInfo = lotInfoById.get(lotId);
        const cost = qty * Number(lotInfo?.unit_cost ?? 0);
        if (lotInfo && typeByItemId.get(lotInfo.item_id) === 'packaging') {
          packagingCost += cost;
        } else {
          materialCost += cost;
        }
      }
    }

    // Biaya SDM batch — lewat compute_production_batch_labor_cost() (primitif internal
    // TANPA gate JWT, migration 20260818110000), SATU sumber kebenaran yang sama
    // dipakai fungsi tampilan Margin (get_production_batch_labor_cost_total/detail) —
    // endpoint ini jalan lewat service-role client yang tidak punya konteks JWT user,
    // jadi tidak bisa lolos gate privasi di fungsi tampilan (itu memang bukan tujuannya
    // di sini — nilai unit_cost yang tersimpan tetap dimask saat DIBACA lewat lots_secure).
    const { data: laborCostRaw, error: laborCostError } = await adminClient.rpc('compute_production_batch_labor_cost', { p_production_batch_id: productionBatchId });
    if (laborCostError) return { status: 500, body: { error: laborCostError.message } };
    const laborCost = Number(laborCostRaw ?? 0);

    const totalBatchCost = materialCost + laborCost;
    const totalMainOutputQty = outputLines.filter((l) => l.output_type === 'main_output').reduce((sum, l) => sum + l.qty, 0);
    const mainOutputUnitCost = totalMainOutputQty > 0 ? totalBatchCost / totalMainOutputQty : 0;
    const mainOutputPackagingCostPerUnit = totalMainOutputQty > 0 ? packagingCost / totalMainOutputQty : 0;

    const results: { work_order_output_id: number; lot_id: number; lot_number: string; output_type: string; qty: number; unit_cost: number; packaging_cost: number; genealogy_rows_created: number }[] = [];

    for (const line of outputLines) {
      const finalLotNumber = line.lot_number || `WO-${workOrderId}-${line.output_type.toUpperCase()}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      // K7: sisa reprocessable/disposed bernilai NOL — seluruh biaya batch dibebankan
      // ke output UTAMA saja (spesifikasi-aturan-biaya-v1.md §1 K7).
      const lineUnitCost = line.output_type === 'main_output' ? mainOutputUnitCost : 0;
      const linePackagingCost = line.output_type === 'main_output' ? mainOutputPackagingCostPerUnit : 0;

      const { data: newLot, error: lotError } = await adminClient
        .from('lots')
        .insert([
          {
            company_id: appUser.company_id,
            production_plant_id: wo.production_plant_id,
            item_id: wo.item_id,
            lot_number: finalLotNumber,
            expiry_date: line.expiry_date,
            produced_or_received_date: new Date().toISOString().slice(0, 10),
            quantity_on_hand: line.qty,
            source_type: 'produced',
            status: 'available',
            unit_cost: lineUnitCost,
            packaging_cost: linePackagingCost
          }
        ])
        .select('lot_id')
        .single();
      if (lotError) return { status: 500, body: { error: lotError.message } };

      const { data: output, error: outputError } = await adminClient
        .from('work_order_outputs')
        .insert([{ work_order_id: workOrderId, production_batch_id: productionBatchId, item_id: wo.item_id, shift_id: batch.shift_id, output_type: line.output_type, qty: line.qty, lot_id: newLot.lot_id }])
        .select('work_order_output_id')
        .single();
      if (outputError) return { status: 500, body: { error: outputError.message } };

      const { error: movementError } = await adminClient
        .from('stock_movements')
        .insert([{ company_id: appUser.company_id, lot_id: newLot.lot_id, movement_type: 'production_output', qty: line.qty, reference_doc: `WO-${workOrderId}`, created_by: appUser.user_id }]);
      if (movementError) return { status: 500, body: { error: movementError.message } };

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

      results.push({
        work_order_output_id: output.work_order_output_id,
        lot_id: newLot.lot_id,
        lot_number: finalLotNumber,
        output_type: line.output_type,
        qty: line.qty,
        unit_cost: lineUnitCost,
        packaging_cost: linePackagingCost,
        genealogy_rows_created: genealogyRowsCreated
      });
    }

    return { status: 201, body: { outputs: results } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}
