import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canViewFinancialData } from '@/lib/roles';
import { computeStandardCostPerUnit } from './computeStandardCostPerUnit';
import { computeStandardLaborCostPerUnit } from './computeStandardLaborCostPerUnit';
import { formatCurrency, formatNumberId } from '@/lib/currency';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

interface VarianceItem {
  item_code: string;
  name: string;
  impact: number; // negatif = mengurangi margin, positif = menambah margin
  detail: string;
}

interface VarianceCategory {
  category: string;
  label: string;
  total_impact: number;
  complete: boolean; // false = ada bagian yang belum bisa dihitung dari data yang ada
  incomplete_reason: string | null;
  items: VarianceItem[];
}

// Margin Watch Lapis 1 (baseline margin per order, dikunci sekali seperti
// snapshot standar K8/feasibility) + Lapis 2 (pembongkaran selisih margin
// AKTUAL berjalan jadi 5 kategori). PRINSIP YANG TIDAK BOLEH DILANGGAR: setiap
// angka WAJIB dihitung dari data nyata (BOM, lots, PO, work_order_consumption,
// work_order_step_progress) -- kalau datanya belum ada, kategori itu ditandai
// TIDAK LENGKAP dengan alasan eksplisit, TIDAK diam-diam dianggap 0.
export async function getMarginWatch(request: NextRequest, salesOrderLineId: number): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!canViewFinancialData(appUser.role)) {
      return { status: 403, body: { error: 'Role Anda tidak punya akses ke Margin Watch.' } };
    }
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const adminClient = getAdminClient();

    const { data: soLine, error: soLineError } = await adminClient
      .from('sales_order_lines')
      .select('sales_order_line_id, sales_order_id, item_id, qty_ordered, unit_price')
      .eq('sales_order_line_id', salesOrderLineId)
      .maybeSingle();
    if (soLineError) return { status: 500, body: { error: soLineError.message } };
    if (!soLine) return { status: 404, body: { error: 'Baris sales order tidak ditemukan.' } };

    const { data: so, error: soError } = await adminClient.from('sales_orders').select('sales_order_id, company_id').eq('sales_order_id', soLine.sales_order_id).maybeSingle();
    if (soError) return { status: 500, body: { error: soError.message } };
    if (!so || so.company_id !== appUser.company_id) return { status: 404, body: { error: 'Sales order tidak ditemukan di perusahaan Anda.' } };

    const { data: item, error: itemError } = await adminClient.from('items').select('item_id, item_code, name').eq('item_id', soLine.item_id).maybeSingle();
    if (itemError) return { status: 500, body: { error: itemError.message } };
    if (!item) return { status: 404, body: { error: 'Item tidak ditemukan.' } };

    // ===== LAPIS 1 — baseline margin. Sesi 0C (21 Agu 2026): MEMBACA panel ini
    // TIDAK PERNAH lagi menulis apa pun -- baseline HANYA lahir lewat aksi
    // eksplisit terpisah (lockMarginBaseline.ts), bergerbang peran finansial +
    // kelengkapan data biaya. Kalau belum pernah dikunci, angka di bawah
    // dihitung LIVE (persis rumus yang sama) dan dikembalikan dengan locked:false
    // -- TIDAK disimpan, supaya tidak ada "baseline" yang lahir diam-diam dari
    // sekadar membuka panel. Lihat HANDOFF.md Sesi 0/0B/0C untuk investigasi
    // lengkap kenapa perilaku lama (insert-on-view) diubah.
    const { data: existingSnapshot, error: snapshotReadError } = await adminClient
      .from('sales_order_line_margin_snapshots')
      .select('*')
      .eq('sales_order_line_id', salesOrderLineId)
      .is('archived_at', null)
      .maybeSingle();
    if (snapshotReadError) return { status: 500, body: { error: snapshotReadError.message } };

    const isLocked = !!existingSnapshot;
    let snapshot: {
      unit_price: number;
      standard_material_cost_per_unit: number | null;
      standard_packaging_cost_per_unit: number | null;
      standard_labor_cost_per_unit: number | null;
      cost_data_complete: boolean;
      missing_cost_item_codes: string[] | null;
      unverified_cost_item_codes: string[] | null;
      labor_cost_complete: boolean;
      labor_cost_notes: string[] | null;
      margin_floor_threshold: number | null;
      created_at: string | null;
      locked_by: number | null;
      relock_reason: string | null;
    };
    if (existingSnapshot) {
      snapshot = existingSnapshot;
    } else {
      const cost = await computeStandardCostPerUnit(adminClient, appUser.company_id, item.item_id);
      const labor = await computeStandardLaborCostPerUnit(adminClient, appUser.company_id, item.item_id);
      snapshot = {
        unit_price: soLine.unit_price,
        standard_material_cost_per_unit: cost.materialCostPerUnit,
        standard_packaging_cost_per_unit: cost.packagingCostPerUnit,
        standard_labor_cost_per_unit: labor.costPerUnit,
        cost_data_complete: cost.complete,
        missing_cost_item_codes: cost.missingCostItemCodes,
        unverified_cost_item_codes: cost.unverifiedCostItemCodes,
        labor_cost_complete: labor.complete,
        labor_cost_notes: labor.notes,
        margin_floor_threshold: null,
        created_at: null,
        locked_by: null,
        relock_reason: null
      };
    }

    let lockedByName: string | null = null;
    if (isLocked && snapshot.locked_by) {
      const { data: lockedByUser } = await adminClient.from('users').select('name').eq('user_id', snapshot.locked_by).maybeSingle();
      lockedByName = lockedByUser?.name ?? null;
    }

    const qtyOrdered = Number(soLine.qty_ordered);
    const standardMaterialCost = Number(snapshot.standard_material_cost_per_unit ?? 0);
    const standardPackagingCost = Number(snapshot.standard_packaging_cost_per_unit ?? 0);
    const standardLaborCost = Number(snapshot.standard_labor_cost_per_unit ?? 0);
    const standardCostPerUnitKnown = standardMaterialCost + standardPackagingCost + standardLaborCost;
    const standardMarginPerUnit = Number(snapshot.unit_price) - standardCostPerUnitKnown;
    const standardMarginTotal = standardMarginPerUnit * qtyOrdered;

    // ===== Data mentah dipakai berulang di Lapis 2 =====
    const { data: workOrders } = await adminClient.from('work_orders').select('work_order_id').eq('sales_order_line_id', salesOrderLineId);
    const workOrderIds = (workOrders ?? []).map((w) => w.work_order_id);

    const { data: allItems } = await adminClient.from('items').select('item_id, item_code, name, type, standard_cost').eq('company_id', appUser.company_id);
    const itemById = new Map((allItems ?? []).map((i) => [i.item_id, i]));

    // Eksplosi BOM per-unit (rasio kebutuhan tiap leaf per 1 unit output) --
    // dipakai untuk kategori 1 (harga) dan 2 (pemakaian).
    const { data: activeBoms } = await adminClient.from('boms').select('bom_id, parent_item_id').eq('company_id', appUser.company_id).eq('status', 'active');
    const bomByParent = new Map((activeBoms ?? []).map((b) => [b.parent_item_id, b]));
    const bomIds = (activeBoms ?? []).map((b) => b.bom_id);
    const { data: bomLines } = bomIds.length
      ? await adminClient.from('bom_lines').select('bom_id, component_item_id, qty_per_unit_output').in('bom_id', bomIds)
      : { data: [] as { bom_id: number; component_item_id: number; qty_per_unit_output: number }[] };
    const linesByBom = new Map<number, { bom_id: number; component_item_id: number; qty_per_unit_output: number }[]>();
    for (const line of bomLines ?? []) {
      if (!linesByBom.has(line.bom_id)) linesByBom.set(line.bom_id, []);
      linesByBom.get(line.bom_id)!.push(line);
    }
    const leafRatioPerUnit = new Map<number, number>();
    const visiting = new Set<number>();
    function explodeRatio(itemId: number, qtyPerUnit: number) {
      if (visiting.has(itemId)) return;
      visiting.add(itemId);
      const bom = bomByParent.get(itemId);
      if (bom) {
        for (const line of linesByBom.get(bom.bom_id) ?? []) explodeRatio(line.component_item_id, qtyPerUnit * Number(line.qty_per_unit_output));
      } else {
        leafRatioPerUnit.set(itemId, (leafRatioPerUnit.get(itemId) ?? 0) + qtyPerUnit);
      }
      visiting.delete(itemId);
    }
    explodeRatio(item.item_id, 1);

    // Rincian biaya kemasan PER KOMPONEN (27 Agu 2026, Bagian D MLVT) --
    // standard_packaging_cost_per_unit di atas cuma TOTAL; leafRatioPerUnit sudah
    // dihitung untuk kategori 1/2 di bawah, jadi dipakai ulang di sini supaya
    // pengguna bisa lihat komponen kemasan mana yang menyumbang biaya berapa
    // (mis. MLVT: 10 sachet x Rp469,85 + 1 box x Rp2.500), bukan cuma angka lump-sum.
    const packagingBreakdown = [...leafRatioPerUnit.entries()]
      .map(([leafItemId, ratio]) => {
        const leafItem = itemById.get(leafItemId);
        if (!leafItem || leafItem.type !== 'packaging') return null;
        const unitCost = leafItem.standard_cost !== null && leafItem.standard_cost !== undefined ? Number(leafItem.standard_cost) : null;
        return {
          item_code: leafItem.item_code,
          name: leafItem.name,
          qty_per_unit_output: ratio,
          unit_cost: unitCost,
          cost_per_unit_output: unitCost !== null ? ratio * unitCost : null
        };
      })
      .filter((row): row is { item_code: string; name: string; qty_per_unit_output: number; unit_cost: number | null; cost_per_unit_output: number | null } => row !== null)
      .sort((a, b) => (b.cost_per_unit_output ?? 0) - (a.cost_per_unit_output ?? 0));

    // ===== Kategori 1 — Selisih HARGA bahan/kemasan =====
    const priceCategory = await computePriceVarianceCategory(adminClient, appUser.company_id, leafRatioPerUnit, itemById, qtyOrdered);

    // ===== Kategori 2 — Selisih PEMAKAIAN bahan =====
    const usageCategory = await computeUsageVarianceCategory(adminClient, workOrderIds, leafRatioPerUnit, itemById);

    // ===== Kategori 3 — Selisih REJECT =====
    const rejectCategory = await computeRejectVarianceCategory(adminClient, workOrderIds, item, standardCostPerUnitKnown, snapshot.cost_data_complete);

    // ===== Kategori 4 & 5 — SDM aktual + Lembur/shift tambahan (TANPA standar, lihat catatan) =====
    const { laborCategory, overtimeCategory } = await computeLaborCategories(adminClient, workOrderIds);

    const categories: VarianceCategory[] = [priceCategory, usageCategory, rejectCategory, laborCategory, overtimeCategory];
    categories.sort((a, b) => Math.abs(b.total_impact) - Math.abs(a.total_impact));

    const totalVarianceImpact = categories.reduce((sum, c) => sum + c.total_impact, 0);
    const projectedMarginTotal = standardMarginTotal + totalVarianceImpact;
    const projectionComplete = snapshot.cost_data_complete && categories.every((c) => c.complete);

    // ===== Peringatan ambang (Lapis 2) — fungsi mandiri khusus (lihat migration
    // 20260820190000 kenapa upsert_department_alert/resolve_department_alerts
    // TIDAK dipakai di sini — keduanya butuh related_work_order_id/related_item_id
    // yang tidak berlaku untuk alert level sales_order_line ini). =====
    const { error: alertError } = await adminClient.rpc('upsert_margin_threshold_alert', {
      p_sales_order_line_id: salesOrderLineId,
      p_item_code: item.item_code,
      p_projected_margin: projectedMarginTotal,
      p_threshold: snapshot.margin_floor_threshold !== null && snapshot.margin_floor_threshold !== undefined ? Number(snapshot.margin_floor_threshold) : null
    });
    if (alertError) return { status: 500, body: { error: alertError.message } };

    return {
      status: 200,
      body: {
        item_code: item.item_code,
        item_name: item.name,
        qty_ordered: qtyOrdered,
        unit_price: Number(snapshot.unit_price),
        standard_material_cost_per_unit: standardMaterialCost,
        standard_packaging_cost_per_unit: standardPackagingCost,
        packaging_breakdown: packagingBreakdown,
        standard_labor_cost_per_unit: Number(snapshot.standard_labor_cost_per_unit ?? 0),
        labor_cost_complete: snapshot.labor_cost_complete,
        labor_cost_notes: snapshot.labor_cost_notes ?? [],
        cost_data_complete: snapshot.cost_data_complete,
        missing_cost_item_codes: snapshot.missing_cost_item_codes ?? [],
        unverified_cost_item_codes: snapshot.unverified_cost_item_codes ?? [],
        standard_margin_per_unit: standardMarginPerUnit,
        standard_margin_total: standardMarginTotal,
        margin_floor_threshold: snapshot.margin_floor_threshold !== null ? Number(snapshot.margin_floor_threshold) : null,
        categories,
        total_variance_impact: totalVarianceImpact,
        projected_margin_total: projectedMarginTotal,
        projection_complete: projectionComplete && snapshot.labor_cost_complete,
        snapshot_taken_at: snapshot.created_at,
        locked: isLocked,
        locked_by_name: lockedByName,
        relock_reason: snapshot.relock_reason
      }
    };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

type ItemRow = { item_id: number; item_code: string; name: string; type: string; standard_cost: number | null };

async function computePriceVarianceCategory(
  adminClient: ReturnType<typeof getAdminClient>,
  companyId: number,
  leafRatioPerUnit: Map<number, number>,
  itemById: Map<number, ItemRow>,
  qtyOrdered: number
): Promise<VarianceCategory> {
  const leafItemIds = Array.from(leafRatioPerUnit.keys());
  const items: VarianceItem[] = [];
  let totalImpact = 0;
  let incompleteCount = 0;

  if (leafItemIds.length > 0) {
    // Prioritas sinyal harga AKTUAL: (a) lot yang SUDAH dikonsumsi (rata-rata
    // tertimbang unit_cost sungguhan), (b) PO supplier yang belum diterima
    // (harga sudah pasti dari negosiasi, walau barang belum masuk gudang --
    // ini yang menangkap kasus Box Drinkme SEBELUM barang diterima, persis
    // temuan manual sebelumnya), (c) tidak ada sinyal -- dilewati, BUKAN
    // dianggap sama dengan standar.
    const { data: lots } = await adminClient.from('lots').select('item_id, quantity_on_hand, unit_cost').in('item_id', leafItemIds).eq('company_id', companyId);
    const avgActualCostByItem = new Map<number, number>();
    const lotsByItem = new Map<number, { qty: number; cost: number }[]>();
    for (const lot of lots ?? []) {
      if (lot.unit_cost === null) continue;
      const list = lotsByItem.get(lot.item_id) ?? [];
      list.push({ qty: Number(lot.quantity_on_hand), cost: Number(lot.unit_cost) });
      lotsByItem.set(lot.item_id, list);
    }
    for (const [itemId, rows] of lotsByItem) {
      const totalQty = rows.reduce((s, r) => s + r.qty, 0);
      if (totalQty > 0) avgActualCostByItem.set(itemId, rows.reduce((s, r) => s + r.qty * r.cost, 0) / totalQty);
    }

    const { data: pendingPos } = await adminClient.from('purchase_orders').select('purchase_order_id').eq('company_id', companyId).in('status', ['ordered', 'partially_received']);
    const pendingPoIds = (pendingPos ?? []).map((p) => p.purchase_order_id);
    const poEtaSourceByItem = new Map<number, number>();
    if (pendingPoIds.length > 0) {
      const { data: poLines } = await adminClient
        .from('purchase_order_lines')
        .select('purchase_order_id, item_id, qty_ordered, qty_received, unit_price')
        .in('item_id', leafItemIds)
        .in('purchase_order_id', pendingPoIds);
      for (const line of poLines ?? []) {
        if (Number(line.qty_received) < Number(line.qty_ordered) && line.unit_price !== null) {
          if (!poEtaSourceByItem.has(line.item_id)) poEtaSourceByItem.set(line.item_id, Number(line.unit_price));
        }
      }
    }

    for (const [itemId, ratioPerUnit] of leafRatioPerUnit) {
      const item = itemById.get(itemId);
      if (!item || item.standard_cost === null) {
        incompleteCount += 1;
        continue;
      }
      const actualPrice = avgActualCostByItem.get(itemId) ?? poEtaSourceByItem.get(itemId);
      if (actualPrice === undefined) continue; // belum ada sinyal harga aktual -- tidak masuk daftar (bukan 0)
      const qtyNeeded = ratioPerUnit * qtyOrdered;
      const priceDiff = actualPrice - Number(item.standard_cost);
      const impact = -priceDiff * qtyNeeded; // harga aktual lebih mahal -> impact negatif ke margin
      if (Math.abs(impact) < 0.5) continue;
      totalImpact += impact;
      items.push({
        item_code: item.item_code,
        name: item.name,
        impact,
        detail: `Standar ${formatCurrency(Number(item.standard_cost))} vs aktual ${formatCurrency(actualPrice)} × ${formatNumberId(qtyNeeded)} unit${avgActualCostByItem.has(itemId) ? '' : ' (dari PO belum diterima)'}`
      });
    }
  }

  items.sort((a, b) => a.impact - b.impact);
  return {
    category: 'harga_bahan',
    label: 'Selisih Harga Bahan/Kemasan',
    total_impact: totalImpact,
    complete: incompleteCount === 0,
    incomplete_reason: incompleteCount > 0 ? `${incompleteCount} bahan belum punya harga master (standard_cost) — tidak dihitung.` : null,
    items
  };
}

async function computeUsageVarianceCategory(
  adminClient: ReturnType<typeof getAdminClient>,
  workOrderIds: number[],
  leafRatioPerUnit: Map<number, number>,
  itemById: Map<number, ItemRow>
): Promise<VarianceCategory> {
  if (workOrderIds.length === 0) {
    return { category: 'pemakaian_bahan', label: 'Selisih Pemakaian Bahan', total_impact: 0, complete: true, incomplete_reason: 'Belum ada Work Order berjalan untuk order ini.', items: [] };
  }

  const { data: outputs } = await adminClient.from('work_order_outputs').select('qty').in('work_order_id', workOrderIds).eq('output_type', 'main_output');
  const qtyOutputSoFar = (outputs ?? []).reduce((s, o) => s + Number(o.qty), 0);

  const { data: consumption } = await adminClient.from('work_order_consumption').select('component_lot_id, qty_consumed').in('work_order_id', workOrderIds);
  const lotIds = Array.from(new Set((consumption ?? []).map((c) => c.component_lot_id)));
  const { data: lots } = lotIds.length ? await adminClient.from('lots').select('lot_id, item_id').in('lot_id', lotIds) : { data: [] as { lot_id: number; item_id: number }[] };
  const itemIdByLotId = new Map((lots ?? []).map((l) => [l.lot_id, l.item_id]));

  const actualConsumedByItem = new Map<number, number>();
  for (const row of consumption ?? []) {
    const itemId = itemIdByLotId.get(row.component_lot_id);
    if (!itemId) continue;
    actualConsumedByItem.set(itemId, (actualConsumedByItem.get(itemId) ?? 0) + Number(row.qty_consumed));
  }

  if (qtyOutputSoFar <= 0) {
    return { category: 'pemakaian_bahan', label: 'Selisih Pemakaian Bahan', total_impact: 0, complete: true, incomplete_reason: 'Belum ada output tercatat — belum bisa dibandingkan dengan standar.', items: [] };
  }

  const items: VarianceItem[] = [];
  let totalImpact = 0;
  let incompleteCount = 0;
  for (const [itemId, actualQty] of actualConsumedByItem) {
    const item = itemById.get(itemId);
    if (!item) continue;
    const ratio = leafRatioPerUnit.get(itemId);
    if (ratio === undefined) continue; // dipakai tapi bukan bagian BOM item ini (mis. dipakai WO lain campur) -- dilewati
    if (item.standard_cost === null) {
      incompleteCount += 1;
      continue;
    }
    const standardNeeded = ratio * qtyOutputSoFar;
    const diff = actualQty - standardNeeded;
    if (Math.abs(diff) < 0.01) continue;
    const impact = -diff * Number(item.standard_cost); // pakai lebih banyak dari standar -> impact negatif
    totalImpact += impact;
    items.push({
      item_code: item.item_code,
      name: item.name,
      impact,
      detail: `Standar untuk ${qtyOutputSoFar.toLocaleString('id-ID', { maximumFractionDigits: 2 })} unit output: ${standardNeeded.toLocaleString('id-ID', { maximumFractionDigits: 2 })} — aktual dipakai ${actualQty.toLocaleString('id-ID', { maximumFractionDigits: 2 })}`
    });
  }

  items.sort((a, b) => a.impact - b.impact);
  return {
    category: 'pemakaian_bahan',
    label: 'Selisih Pemakaian Bahan',
    total_impact: totalImpact,
    complete: incompleteCount === 0,
    incomplete_reason: incompleteCount > 0 ? `${incompleteCount} bahan yang dipakai belum punya harga master.` : null,
    items
  };
}

async function computeRejectVarianceCategory(
  adminClient: ReturnType<typeof getAdminClient>,
  workOrderIds: number[],
  topItem: { item_id: number; base_uom?: string },
  standardCostPerUnitKnown: number,
  costDataComplete: boolean
): Promise<VarianceCategory> {
  if (workOrderIds.length === 0) {
    return { category: 'reject', label: 'Selisih Reject', total_impact: 0, complete: true, incomplete_reason: 'Belum ada Work Order berjalan untuk order ini.', items: [] };
  }

  const { data: progress } = await adminClient
    .from('work_order_step_progress')
    .select('routing_step_id, qty_reject, uom, work_order_id')
    .in('work_order_id', workOrderIds)
    .not('qty_reject', 'is', null);

  const { data: topItemRow } = await adminClient.from('items').select('base_uom').eq('item_id', topItem.item_id).maybeSingle();
  const topUom = topItemRow?.base_uom ?? null;

  let totalRejectInTopUom = 0;
  let otherUomRejectCount = 0;
  const stepIdsSeen = new Set<number>();
  for (const row of progress ?? []) {
    if (row.qty_reject === null) continue;
    stepIdsSeen.add(row.routing_step_id);
    if (topUom && row.uom === topUom) {
      totalRejectInTopUom += Number(row.qty_reject);
    } else {
      otherUomRejectCount += 1;
    }
  }

  const { data: stepNames } = stepIdsSeen.size ? await adminClient.from('routing_steps').select('routing_step_id, step_name').in('routing_step_id', Array.from(stepIdsSeen)) : { data: [] };
  const stepNameById = new Map((stepNames ?? []).map((s) => [s.routing_step_id, s.step_name]));

  const items: VarianceItem[] = [];
  if (totalRejectInTopUom > 0 && costDataComplete) {
    const impact = -totalRejectInTopUom * standardCostPerUnitKnown;
    items.push({
      item_code: '-',
      name: `Reject (satuan ${topUom})`,
      impact,
      detail: `${formatNumberId(totalRejectInTopUom)} ${topUom} reject × biaya standar ${formatCurrency(standardCostPerUnitKnown)}/unit`
    });
  }

  const incompleteReasons: string[] = [];
  if (otherUomRejectCount > 0) incompleteReasons.push(`${otherUomRejectCount} baris reject di satuan tahap-antara (bukan satuan jual "${topUom}") — dampak rupiahnya belum bisa dihitung tanpa data konversi.`);
  if (totalRejectInTopUom > 0 && !costDataComplete) incompleteReasons.push('Ada reject di satuan jual, tapi biaya standar belum lengkap (lihat missing_cost_item_codes) — dampak rupiah tidak dihitung.');

  return {
    category: 'reject',
    label: 'Selisih Reject',
    total_impact: items.reduce((s, i) => s + i.impact, 0),
    complete: incompleteReasons.length === 0 && (progress ?? []).length > 0,
    incomplete_reason: incompleteReasons.length > 0 ? incompleteReasons.join(' ') : (progress ?? []).length === 0 ? 'Belum ada data reject tercatat.' : null,
    items
  };
}

async function computeLaborCategories(
  adminClient: ReturnType<typeof getAdminClient>,
  workOrderIds: number[]
): Promise<{ laborCategory: VarianceCategory; overtimeCategory: VarianceCategory }> {
  const emptyLabor: VarianceCategory = {
    category: 'sdm',
    label: 'Biaya SDM Aktual (belum ada pembanding standar)',
    total_impact: 0,
    complete: false,
    incomplete_reason: 'Belum ada Work Order berjalan untuk order ini.',
    items: []
  };
  const emptyOvertime: VarianceCategory = {
    category: 'lembur_shift',
    label: 'Lembur & Shift Tambahan',
    total_impact: 0,
    complete: true,
    incomplete_reason: null,
    items: []
  };
  if (workOrderIds.length === 0) return { laborCategory: emptyLabor, overtimeCategory: emptyOvertime };

  const { data: batches } = await adminClient.from('production_batches').select('production_batch_id, batch_number').in('work_order_id', workOrderIds);
  const batchIds = (batches ?? []).map((b) => b.production_batch_id);
  const batchNumberById = new Map((batches ?? []).map((b) => [b.production_batch_id, b.batch_number]));

  if (batchIds.length === 0) {
    return {
      laborCategory: { ...emptyLabor, incomplete_reason: 'Belum ada batch produksi untuk order ini.' },
      overtimeCategory: emptyOvertime
    };
  }

  let totalLaborCost = 0;
  for (const batchId of batchIds) {
    const { data: cost } = await adminClient.rpc('compute_production_batch_labor_cost', { p_production_batch_id: batchId });
    totalLaborCost += Number(cost ?? 0);
  }

  // "Lembur/shift tambahan" -- penanda is_overtime EKSPLISIT, PLUS jam di shift
  // yang mulai sore/malam (>=14:00) sebagai proksi generik "shift tambahan"
  // (tidak hardcode nama "Shift 2" -- perusahaan lain mungkin menamainya
  // beda; jam mulai lebih realistis generik).
  const { data: assignments } = await adminClient
    .from('work_order_assignments')
    .select('work_order_assignment_id, production_batch_id, actual_hours, is_overtime, shift_id, employee_id')
    .in('production_batch_id', batchIds)
    .not('status', 'in', '(absent,replaced)');

  const shiftIds = Array.from(new Set((assignments ?? []).map((a) => a.shift_id).filter((id): id is number => !!id)));
  const { data: shifts } = shiftIds.length
    ? await adminClient.from('shifts').select('shift_id, name, start_time, end_time').in('shift_id', shiftIds)
    : { data: [] as { shift_id: number; name: string; start_time: string; end_time: string }[] };
  const shiftById = new Map((shifts ?? []).map((s) => [s.shift_id, s]));

  const employeeIds = Array.from(new Set((assignments ?? []).map((a) => a.employee_id)));
  const { data: employees } = employeeIds.length ? await adminClient.from('employees').select('employee_id, wage_type, wage_rate').in('employee_id', employeeIds) : { data: [] as { employee_id: number; wage_type: string; wage_rate: number }[] };
  const employeeById = new Map((employees ?? []).map((e) => [e.employee_id, e]));

  const { data: calendarSettings } = await adminClient
    .from('company_settings')
    .select('setting_key, setting_value')
    .in('setting_key', ['work_calendar_weekday_hours', 'work_calendar_saturday_hours']);
  const weekdayHours = Number(calendarSettings?.find((s) => s.setting_key === 'work_calendar_weekday_hours')?.setting_value ?? 7);

  let extraShiftAndOvertimeCost = 0;
  const overtimeItems: VarianceItem[] = [];
  for (const a of assignments ?? []) {
    const shift = a.shift_id ? shiftById.get(a.shift_id) : null;
    const startHour = shift ? Number(shift.start_time.split(':')[0]) : null;
    const isExtraShift = startHour !== null && startHour >= 14;
    if (!a.is_overtime && !isExtraShift) continue;

    const employee = employeeById.get(a.employee_id);
    if (!employee) continue;
    const hours = Number(a.actual_hours ?? 0);
    let rate = 0;
    // Estimasi biaya baris ini: kalau daily + ada shift, pola sama dengan
    // compute_production_batch_labor_cost (pembagi jam shift); kalau tidak,
    // pakai jam kerja weekday default sebagai pembagi (perilaku lama).
    if (employee.wage_type === 'hourly') rate = Number(employee.wage_rate);
    else if (employee.wage_type === 'daily') {
      const divisor = shift ? timeDiffHoursFromStrings(shift.start_time, shift.end_time) || weekdayHours : weekdayHours;
      rate = Number(employee.wage_rate) / divisor;
    } else continue; // monthly/piece_rate tidak relevan utk "jam lembur tambahan"

    const cost = hours * rate;
    extraShiftAndOvertimeCost += cost;
    overtimeItems.push({
      item_code: '-',
      name: batchNumberById.get(a.production_batch_id) ?? `Batch #${a.production_batch_id}`,
      impact: -cost,
      detail: `${hours} jam${a.is_overtime ? ' (ditandai lembur)' : shift ? ` (shift ${shift.name})` : ''} × ${formatCurrency(rate, { maxDecimals: 0 })}/jam`
    });
  }

  const laborCategory: VarianceCategory = {
    category: 'sdm',
    label: 'Biaya SDM Aktual (belum ada pembanding standar)',
    total_impact: -totalLaborCost,
    complete: false,
    incomplete_reason: 'Routing belum menyimpan jumlah orang standar per tahap — biaya SDM AKTUAL ditampilkan apa adanya, TANPA dibandingkan ke standar.',
    items: [{ item_code: '-', name: 'Total biaya SDM aktual seluruh batch order ini', impact: -totalLaborCost, detail: `${batchIds.length} batch produksi` }]
  };

  const overtimeCategory: VarianceCategory = {
    category: 'lembur_shift',
    label: 'Lembur & Shift Tambahan',
    total_impact: -extraShiftAndOvertimeCost,
    complete: true,
    incomplete_reason: overtimeItems.length === 0 ? null : null,
    items: overtimeItems.sort((a, b) => a.impact - b.impact)
  };

  return { laborCategory, overtimeCategory };
}

function timeDiffHoursFromStrings(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return (eh * 60 + em - (sh * 60 + sm)) / 60;
}
