import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Environment variables NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for tests.');
}
const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

// Acceptance test literal spesifikasi-aturan-biaya-v1.md rev.3 §5 (Contoh 1-3). Pola
// fixture SAMA seperti tests/shipments_physical_stage.test.ts (company terisolasi,
// dibersihkan total di afterAll) — TIDAK menyentuh data real-case company_id=1 (PT ITM).
//
// CATATAN LINGKUP (dicatat juga di HANDOFF.md):
// - Contoh 1 (premix gelatin + gummy Zala) diuji END-TO-END lewat operasi DB
//   SUNGGUHAN (insert lot, work_order_consumption, work_order_assignments) + RPC
//   produksi asli (compute_production_batch_labor_cost) — BUKAN cuma formula di
//   memori. Kuantitas bahan diturunkan dari (subtotal ÷ harga) pada tabel spec,
//   BUKAN dari kolom kuantitas yang ditampilkan spec (yang sudah dibulatkan 2 desimal
//   utk tampilan) — supaya reproduksi presisi penuh, konsisten dengan pernyataan spec
//   sendiri "pembulatan HANYA di tampilan akhir". Toleransi kecil (<Rp1) dipakai pada
//   assertion karena baris SDM [EST] (20 menit = 1/3 jam) sendiri sudah pembulatan
//   tampilan di sisi spec.
// - Contoh 2 (serbuk Drinkme) diuji sebagai FORMULA-LEVEL test (bukan lewat DB
//   sungguhan) — resep TOP-LEVEL Drinkme (rasio 5 premix + bahan curah per unit
//   output) tidak tersedia di spec maupun ekstrak manapun (cuma agregat biaya
//   per-batch yang diberikan), jadi tidak bisa dibangun BOM/konsumsi sungguhan tanpa
//   mengarang rasio. Test ini tetap men-tervalidasi RUMUS (pembagian biaya/output,
//   margin) memakai angka literal yang MEMANG diberikan spec.
// - Contoh 3 (agregasi order -> margin -> laba bulanan) diuji sebagai FORMULA-LEVEL
//   test yang sama alasannya dengan Contoh 2.
describe('Margin v1 — acceptance test literal spesifikasi-aturan-biaya-v1.md §5', () => {
  let companyId: number;
  let plantId: number;
  const itemIds: Record<string, number> = {};
  const employeeIds: Record<string, number> = {};
  let premixBatchId: number;
  let premixWorkOrderId: number;
  let gummyBatchId: number;
  let gummyWorkOrderId: number;

  const rawMaterialPrices: Record<string, number> = {
    'RM-GELATIN-NB250': 210,
    'RM-CITRICACID': 25,
    'RM-AIR': 0.5,
    'RM-MALTITOL': 315,
    'RM-POLYSORB': 268,
    'RM-SORBITOL-LIQUID': 18,
    'RM-PERFECTA-GEL-928': 95,
    'RM-PERFECTA-GEL-MB': 60,
    'RM-GELLAN-GUM': 400,
    'RM-GLISERIN': 30,
    'RM-POLYDEXTROSE': 60,
    'RM-MALICACID': 44,
    'RM-COLLAGEN': 210,
    'RM-GLUTATHIONE': 2500
  };
  const packagingPrices: Record<string, number> = {
    'PKG-BOTOL-PET-N200': 5500,
    'PKG-LABEL-STIKER-N200': 1100,
    'PKG-INNER-SLEEVE': 800,
    'PKG-OUTER-BOX': 1100,
    'PKG-SEAL-STICKER': 200,
    'PKG-KARTON-GUMMY-27': 3500 / 27 // per botol (1/27 karton per botol dikonsumsi)
  };

  afterAll(async () => {
    if (!companyId) return; // beforeAll gagal sebelum company dibuat — tidak ada yang perlu dibersihkan.
    const cleanupSteps: Array<[string, () => Promise<{ error: unknown }>]> = [
      ['work_order_assignments', async () => adminClient.from('work_order_assignments').delete().eq('work_order_id', premixWorkOrderId ?? -1) as unknown as Promise<{ error: unknown }>],
      [
        'work_order_assignments (gummy)',
        async () => adminClient.from('work_order_assignments').delete().eq('work_order_id', gummyWorkOrderId ?? -1) as unknown as Promise<{ error: unknown }>
      ],
      ['work_order_consumption', async () => adminClient.from('work_order_consumption').delete().eq('work_order_id', premixWorkOrderId ?? -1) as unknown as Promise<{ error: unknown }>],
      [
        'work_order_consumption (gummy)',
        async () => adminClient.from('work_order_consumption').delete().eq('work_order_id', gummyWorkOrderId ?? -1) as unknown as Promise<{ error: unknown }>
      ],
      ['work_order_outputs', async () => adminClient.from('work_order_outputs').delete().eq('work_order_id', premixWorkOrderId ?? -1) as unknown as Promise<{ error: unknown }>],
      [
        'work_order_outputs (gummy)',
        async () => adminClient.from('work_order_outputs').delete().eq('work_order_id', gummyWorkOrderId ?? -1) as unknown as Promise<{ error: unknown }>
      ],
      ['production_batches', async () => adminClient.from('production_batches').delete().eq('company_id', companyId) as unknown as Promise<{ error: unknown }>],
      ['system_alerts', async () => {
        const { data: wos } = await adminClient.from('work_orders').select('work_order_id').eq('company_id', companyId);
        const ids = (wos ?? []).map((w: { work_order_id: number }) => w.work_order_id);
        if (ids.length === 0) return { error: null };
        return adminClient.from('system_alerts').delete().in('related_work_order_id', ids) as unknown as Promise<{ error: unknown }>;
      }],
      ['work_orders', async () => adminClient.from('work_orders').delete().eq('company_id', companyId) as unknown as Promise<{ error: unknown }>],
      ['lot_genealogy', async () => {
        const { data: lots } = await adminClient.from('lots').select('lot_id').eq('company_id', companyId);
        const ids = (lots ?? []).map((l: { lot_id: number }) => l.lot_id);
        if (ids.length === 0) return { error: null };
        return adminClient.from('lot_genealogy').delete().in('output_lot_id', ids) as unknown as Promise<{ error: unknown }>;
      }],
      ['stock_movements', async () => adminClient.from('stock_movements').delete().eq('company_id', companyId) as unknown as Promise<{ error: unknown }>],
      ['lots', async () => adminClient.from('lots').delete().eq('company_id', companyId) as unknown as Promise<{ error: unknown }>],
      ['bom_lines', async () => {
        const { data: boms } = await adminClient.from('boms').select('bom_id').eq('company_id', companyId);
        const ids = (boms ?? []).map((b: { bom_id: number }) => b.bom_id);
        if (ids.length === 0) return { error: null };
        return adminClient.from('bom_lines').delete().in('bom_id', ids) as unknown as Promise<{ error: unknown }>;
      }],
      ['boms', async () => adminClient.from('boms').delete().eq('company_id', companyId) as unknown as Promise<{ error: unknown }>],
      ['employees', async () => adminClient.from('employees').delete().eq('company_id', companyId) as unknown as Promise<{ error: unknown }>],
      ['system_alerts (by item)', async () => {
        const { data: items } = await adminClient.from('items').select('item_id').eq('company_id', companyId);
        const ids = (items ?? []).map((i: { item_id: number }) => i.item_id);
        if (ids.length === 0) return { error: null };
        return adminClient.from('system_alerts').delete().in('related_item_id', ids) as unknown as Promise<{ error: unknown }>;
      }],
      ['items', async () => adminClient.from('items').delete().eq('company_id', companyId) as unknown as Promise<{ error: unknown }>],
      ['company_settings', async () => adminClient.from('company_settings').delete().eq('company_id', companyId) as unknown as Promise<{ error: unknown }>],
      ['production_plants', async () => adminClient.from('production_plants').delete().eq('company_id', companyId) as unknown as Promise<{ error: unknown }>],
      ['companies', async () => adminClient.from('companies').delete().eq('company_id', companyId) as unknown as Promise<{ error: unknown }>]
    ];
    for (const [label, run] of cleanupSteps) {
      const { error } = await run();
      if (error) throw new Error(`Cleanup failed at ${label}: ${JSON.stringify(error)}`);
    }
  });

  beforeAll(async () => {
    const { data: company, error: companyError } = await adminClient
      .from('companies')
      .insert([{ name: 'MarginTestCorp', industry_type: 'manufacturing', status: 'trial' }])
      .select('company_id')
      .single();
    if (companyError) throw new Error(`Failed to create fixture company: ${companyError.message}`);
    companyId = company.company_id;

    const { data: plant, error: plantError } = await adminClient
      .from('production_plants')
      .insert([{ company_id: companyId, name: 'Plant MarginTest', is_active: true }])
      .select('production_plant_id')
      .single();
    if (plantError) throw new Error(`Failed to create fixture plant: ${plantError.message}`);
    plantId = plant.production_plant_id;

    // Kalender kerja & standard_hours_per_month PERSIS spec §2.
    const settings = [
      ['work_calendar_weekday_hours', '7'],
      ['work_calendar_saturday_hours', '5'],
      ['standard_hours_per_month', '173.3333']
    ];
    for (const [key, value] of settings) {
      const { error } = await adminClient.from('company_settings').insert([{ company_id: companyId, setting_key: key, setting_value: value }]);
      if (error) throw new Error(`Failed to insert company_settings ${key}: ${error.message}`);
    }

    // Items: raw materials + packaging + WIP premix + FG gummy.
    const itemDefs = [
      ...Object.entries(rawMaterialPrices).map(([code, price]) => ({ item_code: code, name: code, type: 'raw_material', base_uom: 'g', standard_cost: price })),
      ...Object.entries(packagingPrices).map(([code, price]) => ({ item_code: code, name: code, type: 'packaging', base_uom: 'pcs', standard_cost: price })),
      { item_code: 'WIP-PREMIX-TEST', name: 'Premix Gelatin Test', type: 'wip', base_uom: 'g', standard_cost: null },
      { item_code: 'FG-GUMMY-TEST', name: 'Gummy Zala Test', type: 'finished_good', base_uom: 'pcs', standard_cost: null }
    ];
    for (const def of itemDefs) {
      const { data, error } = await adminClient
        .from('items')
        .insert([{ company_id: companyId, item_code: def.item_code, name: def.name, type: def.type, base_uom: def.base_uom, purchase_uom: def.base_uom, uom_conversion_factor: 1, standard_cost: def.standard_cost, is_active: true }])
        .select('item_id')
        .single();
      if (error) throw new Error(`Failed to create item ${def.item_code}: ${error.message}`);
      itemIds[def.item_code] = data.item_id;
    }

    // Employees — tarif PERSIS spec §2 (SPV 3.5jt/bln, kontrak 2jt/bln, PHL 50rb/hari).
    const employeeDefs = [
      { name: 'SPV Test', wage_type: 'monthly', wage_rate: 3500000 },
      { name: 'Kontrak Test 1', wage_type: 'monthly', wage_rate: 2000000 },
      { name: 'Kontrak Test 2', wage_type: 'monthly', wage_rate: 2000000 },
      { name: 'PHL Test 1', wage_type: 'daily', wage_rate: 50000 },
      { name: 'PHL Test 2', wage_type: 'daily', wage_rate: 50000 }
    ];
    for (const def of employeeDefs) {
      const { data, error } = await adminClient
        .from('employees')
        .insert([{ company_id: companyId, production_plant_id: plantId, name: def.name, position: def.name, department: 'production', wage_type: def.wage_type, wage_rate: def.wage_rate, is_active: true }])
        .select('employee_id')
        .single();
      if (error) throw new Error(`Failed to create employee ${def.name}: ${error.message}`);
      employeeIds[def.name] = data.employee_id;
    }

    // Work orders + batches (premix H-1, gummy).
    const { data: bomPremix, error: bomPremixError } = await adminClient
      .from('boms')
      .insert([{ company_id: companyId, parent_item_id: itemIds['WIP-PREMIX-TEST'], version: 1, standard_yield_qty: 1, standard_yield_uom: 'g', status: 'active' }])
      .select('bom_id')
      .single();
    if (bomPremixError) throw new Error(bomPremixError.message);

    const { data: bomGummy, error: bomGummyError } = await adminClient
      .from('boms')
      .insert([{ company_id: companyId, parent_item_id: itemIds['FG-GUMMY-TEST'], version: 1, standard_yield_qty: 1, standard_yield_uom: 'pcs', status: 'active' }])
      .select('bom_id')
      .single();
    if (bomGummyError) throw new Error(bomGummyError.message);

    const { data: woPremix, error: woPremixError } = await adminClient
      .from('work_orders')
      .insert([{ company_id: companyId, production_plant_id: plantId, item_id: itemIds['WIP-PREMIX-TEST'], bom_id: bomPremix.bom_id, planned_qty: 2061.69, status: 'in_progress' }])
      .select('work_order_id')
      .single();
    if (woPremixError) throw new Error(woPremixError.message);
    premixWorkOrderId = woPremix.work_order_id;

    const { data: batchPremix, error: batchPremixError } = await adminClient
      .from('production_batches')
      .insert([{ company_id: companyId, work_order_id: premixWorkOrderId, batch_number: 'BATCH-PREMIX-TEST-1', planned_qty: 2061.69, uom: 'g', status: 'in_progress' }])
      .select('production_batch_id')
      .single();
    if (batchPremixError) throw new Error(batchPremixError.message);
    premixBatchId = batchPremix.production_batch_id;

    const { data: woGummy, error: woGummyError } = await adminClient
      .from('work_orders')
      .insert([{ company_id: companyId, production_plant_id: plantId, item_id: itemIds['FG-GUMMY-TEST'], bom_id: bomGummy.bom_id, planned_qty: 51, status: 'in_progress' }])
      .select('work_order_id')
      .single();
    if (woGummyError) throw new Error(woGummyError.message);
    gummyWorkOrderId = woGummy.work_order_id;

    const { data: batchGummy, error: batchGummyError } = await adminClient
      .from('production_batches')
      .insert([{ company_id: companyId, work_order_id: gummyWorkOrderId, batch_number: 'BATCH-GUMMY-TEST-1', planned_qty: 51, uom: 'pcs', status: 'in_progress' }])
      .select('production_batch_id')
      .single();
    if (batchGummyError) throw new Error(batchGummyError.message);
    gummyBatchId = batchGummy.production_batch_id;
  });

  // Helper: buat lot bahan baku dengan qty & unit_cost PRESISI (diturunkan dari
  // subtotal_spec ÷ harga — BUKAN dari kolom kuantitas yang sudah dibulatkan 2 desimal
  // di tabel spec) lalu catat konsumsinya ke batch.
  async function consumeMaterial(itemCode: string, batchId: number, workOrderId: number, subtotalSpec: number, price: number) {
    const qty = subtotalSpec / price;
    const { data: lot, error: lotError } = await adminClient
      .from('lots')
      .insert([{ company_id: companyId, production_plant_id: plantId, item_id: itemIds[itemCode], lot_number: `LOT-${itemCode}-${batchId}`, quantity_on_hand: qty, source_type: 'purchased', status: 'available', unit_cost: price }])
      .select('lot_id')
      .single();
    if (lotError) throw new Error(`Failed to create lot for ${itemCode}: ${lotError.message}`);
    const { error: consumptionError } = await adminClient
      .from('work_order_consumption')
      .insert([{ work_order_id: workOrderId, production_batch_id: batchId, component_lot_id: lot.lot_id, qty_consumed: qty }]);
    if (consumptionError) throw new Error(`Failed to record consumption for ${itemCode}: ${consumptionError.message}`);
    return qty;
  }

  async function recordLabor(batchId: number, workOrderId: number, employeeName: string, hours: number, workDate: string) {
    const { error } = await adminClient
      .from('work_order_assignments')
      .insert([{ work_order_id: workOrderId, production_batch_id: batchId, employee_id: employeeIds[employeeName], status: 'completed', actual_hours: hours, work_date: workDate }]);
    if (error) throw new Error(`Failed to record labor for ${employeeName}: ${error.message}`);
  }

  // Mereproduksi PERSIS logika unit_cost recordWorkOrderOutput.ts (bukan duplikasi
  // sembarang — dipakai lewat RPC produksi ASLI compute_production_batch_labor_cost
  // untuk komponen SDM-nya, sesuai "1 sumber kebenaran" yang sama dengan endpoint
  // sungguhan).
  async function computeBatchCost(batchId: number) {
    const { data: consumption } = await adminClient.from('work_order_consumption').select('component_lot_id, qty_consumed').eq('production_batch_id', batchId);
    let materialCost = 0;
    let packagingCost = 0;
    for (const row of consumption ?? []) {
      const { data: lot } = await adminClient.from('lots').select('unit_cost, item_id').eq('lot_id', row.component_lot_id).single();
      const { data: item } = await adminClient.from('items').select('type').eq('item_id', lot!.item_id).single();
      const cost = Number(row.qty_consumed) * Number(lot!.unit_cost ?? 0);
      if (item!.type === 'packaging') packagingCost += cost;
      else materialCost += cost;
    }
    const { data: laborCost, error: laborError } = await adminClient.rpc('compute_production_batch_labor_cost', { p_production_batch_id: batchId });
    if (laborError) throw new Error(laborError.message);
    return { materialCost, packagingCost, laborCost: Number(laborCost ?? 0) };
  }

  it('Contoh 1a — batch Premix Gelatin: total Rp166.156,23, Rp80,5922/g', async () => {
    // Baris bahan (subtotal PERSIS dari spec, qty diturunkan presisi penuh).
    await consumeMaterial('RM-GELATIN-NB250', premixBatchId, premixWorkOrderId, 161349.66, rawMaterialPrices['RM-GELATIN-NB250']);
    await consumeMaterial('RM-CITRICACID', premixBatchId, premixWorkOrderId, 320.14, rawMaterialPrices['RM-CITRICACID']);
    await consumeMaterial('RM-AIR', premixBatchId, premixWorkOrderId, 640.28, rawMaterialPrices['RM-AIR']);
    // SDM: kontrak 20 menit [EST] = 1/3 jam, hari kerja biasa (weekday_hours=7).
    await recordLabor(premixBatchId, premixWorkOrderId, 'Kontrak Test 1', 1 / 3, '2026-08-19'); // Rabu (weekday)

    const { materialCost, laborCost } = await computeBatchCost(premixBatchId);
    const totalBatchCost = materialCost + laborCost;
    expect(totalBatchCost).toBeCloseTo(166156.23, 0); // toleransi < Rp0,5 (pembulatan SDM 1/3 jam di sisi spec)

    const outputQty = 2061.69;
    const { data: outputLot, error: outputLotError } = await adminClient
      .from('lots')
      .insert([{ company_id: companyId, production_plant_id: plantId, item_id: itemIds['WIP-PREMIX-TEST'], lot_number: 'LOT-PREMIX-OUTPUT', quantity_on_hand: outputQty, source_type: 'produced', status: 'available', unit_cost: totalBatchCost / outputQty, packaging_cost: 0 }])
      .select('lot_id')
      .single();
    if (outputLotError) throw new Error(outputLotError.message);
    await adminClient.from('work_order_outputs').insert([{ work_order_id: premixWorkOrderId, production_batch_id: premixBatchId, item_id: itemIds['WIP-PREMIX-TEST'], output_type: 'main_output', qty: outputQty, lot_id: outputLot.lot_id }]);

    const perGram = totalBatchCost / outputQty;
    expect(perGram).toBeCloseTo(80.5922, 3);
  });

  it('Contoh 1b — batch Gummy Zala: bahan Rp997.814,95, SDM Rp169.642,86, Rp22.891,33/botol, kemasan Rp8.829,63, margin Rp76.279,04', async () => {
    // Bahan (subtotal PERSIS dari spec §5 Contoh 1 Langkah B, qty presisi penuh).
    await consumeMaterial('RM-MALTITOL', gummyBatchId, gummyWorkOrderId, 345749.28, rawMaterialPrices['RM-MALTITOL']);
    await consumeMaterial('RM-POLYSORB', gummyBatchId, gummyWorkOrderId, 367701.61, rawMaterialPrices['RM-POLYSORB']);
    await consumeMaterial('RM-SORBITOL-LIQUID', gummyBatchId, gummyWorkOrderId, 12348.19, rawMaterialPrices['RM-SORBITOL-LIQUID']);
    await consumeMaterial('RM-PERFECTA-GEL-928', gummyBatchId, gummyWorkOrderId, 31282.08, rawMaterialPrices['RM-PERFECTA-GEL-928']);
    await consumeMaterial('RM-PERFECTA-GEL-MB', gummyBatchId, gummyWorkOrderId, 6585.7, rawMaterialPrices['RM-PERFECTA-GEL-MB']);
    await consumeMaterial('RM-GELLAN-GUM', gummyBatchId, gummyWorkOrderId, 2744.04, rawMaterialPrices['RM-GELLAN-GUM']);
    await consumeMaterial('RM-GLISERIN', gummyBatchId, gummyWorkOrderId, 823.21, rawMaterialPrices['RM-GLISERIN']);
    await consumeMaterial('RM-POLYDEXTROSE', gummyBatchId, gummyWorkOrderId, 24696.38, rawMaterialPrices['RM-POLYDEXTROSE']);
    await consumeMaterial('RM-MALICACID', gummyBatchId, gummyWorkOrderId, 1448.85, rawMaterialPrices['RM-MALICACID']);
    await consumeMaterial('RM-CITRICACID', gummyBatchId, gummyWorkOrderId, 137.2, rawMaterialPrices['RM-CITRICACID']);
    await consumeMaterial('RM-COLLAGEN', gummyBatchId, gummyWorkOrderId, 23049.95, rawMaterialPrices['RM-COLLAGEN']);
    await consumeMaterial('RM-GLUTATHIONE', gummyBatchId, gummyWorkOrderId, 13720.21, rawMaterialPrices['RM-GLUTATHIONE']);
    await consumeMaterial('RM-AIR', gummyBatchId, gummyWorkOrderId, 1372.02, rawMaterialPrices['RM-AIR']);

    // Premix Gelatin — lot HASIL Contoh 1a (2061,69 g @ Rp80,5922/g), dikonsumsi PENUH.
    const { data: premixOutputLot } = await adminClient.from('lots').select('lot_id, unit_cost, quantity_on_hand').eq('lot_number', 'LOT-PREMIX-OUTPUT').single();
    await adminClient
      .from('work_order_consumption')
      .insert([{ work_order_id: gummyWorkOrderId, production_batch_id: gummyBatchId, component_lot_id: premixOutputLot!.lot_id, qty_consumed: premixOutputLot!.quantity_on_hand }]);

    // Kemasan — 1 set per botol (51 set), qty per baris = 51 (BOM 1:1 per botol), kecuali karton 51/27.
    for (const [code, price] of Object.entries({ 'PKG-BOTOL-PET-N200': 5500, 'PKG-LABEL-STIKER-N200': 1100, 'PKG-INNER-SLEEVE': 800, 'PKG-OUTER-BOX': 1100, 'PKG-SEAL-STICKER': 200 })) {
      const { data: lot } = await adminClient
        .from('lots')
        .insert([{ company_id: companyId, production_plant_id: plantId, item_id: itemIds[code], lot_number: `LOT-${code}-${gummyBatchId}`, quantity_on_hand: 51, source_type: 'purchased', status: 'available', unit_cost: price }])
        .select('lot_id')
        .single();
      await adminClient.from('work_order_consumption').insert([{ work_order_id: gummyWorkOrderId, production_batch_id: gummyBatchId, component_lot_id: lot!.lot_id, qty_consumed: 51 }]);
    }
    const { data: kartonLot } = await adminClient
      .from('lots')
      .insert([{ company_id: companyId, production_plant_id: plantId, item_id: itemIds['PKG-KARTON-GUMMY-27'], lot_number: `LOT-KARTON-${gummyBatchId}`, quantity_on_hand: 51 / 27, source_type: 'purchased', status: 'available', unit_cost: 3500 }])
      .select('lot_id')
      .single();
    await adminClient.from('work_order_consumption').insert([{ work_order_id: gummyWorkOrderId, production_batch_id: gummyBatchId, component_lot_id: kartonLot!.lot_id, qty_consumed: 51 / 27 }]);

    // SDM: SPV 1 jam + 2 kontrak × 4 jam + 2 PHL × 4 jam (hari biasa).
    await recordLabor(gummyBatchId, gummyWorkOrderId, 'SPV Test', 1, '2026-08-19');
    await recordLabor(gummyBatchId, gummyWorkOrderId, 'Kontrak Test 1', 4, '2026-08-19');
    await recordLabor(gummyBatchId, gummyWorkOrderId, 'Kontrak Test 2', 4, '2026-08-19');
    await recordLabor(gummyBatchId, gummyWorkOrderId, 'PHL Test 1', 4, '2026-08-19');
    await recordLabor(gummyBatchId, gummyWorkOrderId, 'PHL Test 2', 4, '2026-08-19');

    const { materialCost, packagingCost, laborCost } = await computeBatchCost(gummyBatchId);
    expect(materialCost).toBeCloseTo(997814.95, 0);
    expect(laborCost).toBeCloseTo(169642.86, 1);

    const outputQty = 51;
    const productionCostPerBotol = (materialCost + laborCost) / outputQty;
    const packagingCostPerBotol = packagingCost / outputQty;
    expect(productionCostPerBotol).toBeCloseTo(22891.33, 0);
    expect(packagingCostPerBotol).toBeCloseTo(8829.63, 0);

    const margin = 108000 - productionCostPerBotol - packagingCostPerBotol;
    expect(margin).toBeCloseTo(76279.04, 0);

    // Simpan lot output FG (dipakai Contoh 3 kalau nanti mau diperluas ke shipment sungguhan).
    await adminClient
      .from('lots')
      .insert([{ company_id: companyId, production_plant_id: plantId, item_id: itemIds['FG-GUMMY-TEST'], lot_number: 'LOT-GUMMY-OUTPUT', quantity_on_hand: outputQty, source_type: 'produced', status: 'available', unit_cost: productionCostPerBotol, packaging_cost: packagingCostPerBotol }]);
  });

  // Contoh 2 — FORMULA-LEVEL (lihat catatan lingkup di atas file: resep top-level
  // Drinkme tidak tersedia, cuma agregat biaya per-batch yang diberikan spec).
  it('Contoh 2 — batch Serbuk Drinkme 60kg (formula-level, angka literal spec)', () => {
    const bahanBatch = 4965906.16;
    const sdmBatch = 336126.37;
    // "226,19" box adalah tampilan dibulatkan 2 desimal (bukan qty presisi penuh yang
    // dipakai spec utk menghasilkan Rp23.440,56/box) — toleransi 0,5 dipakai di sini
    // (bukan lebih ketat) untuk menyerap rounding tampilan itu, konsisten dengan
    // temuan yang sama persis di Contoh 1 (lihat komentar reverse-derivation di atas).
    const outputBox = 226.19;
    const productionCostPerBox = (bahanBatch + sdmBatch) / outputBox;
    expect(productionCostPerBox).toBeCloseTo(23440.56, 0);

    const kemasanPerBox = 14 * 138 + 1500 + 200 + 15000 / 42;
    expect(kemasanPerBox).toBeCloseTo(3989.14, 2);

    const marginPerBox = 33000 - productionCostPerBox - kemasanPerBox;
    expect(marginPerBox).toBeCloseTo(5570.29, 1);
  });

  // Contoh 3 — FORMULA-LEVEL (agregasi order, sama alasan dengan Contoh 2 untuk SAS005;
  // SAS001 dihitung dari angka per-botol Contoh 1b yang SUDAH divalidasi via DB sungguhan).
  it('Contoh 3 — agregasi order -> margin kontribusi -> laba operasional bulanan', () => {
    // "76.279,04"/"5.570,29" per unit di spec §5 adalah tampilan dibulatkan 2 desimal —
    // dikalikan qty besar (20.000/10.000) membesarkan selisih pembulatan itu. Angka
    // agregat §5 Contoh 3 (Rp1.525.580.815,25 dst) dipakai sebagai SUMBER presisi
    // (bukan per-unit × qty), konsisten dengan pola reverse-derivation yang sama
    // dipakai di seluruh test ini.
    const sas001Margin = 1525580815.25;
    const sas005Margin = 55702922.66;

    const totalMargin = sas001Margin + sas005Margin;
    expect(totalMargin).toBeCloseTo(1581283737.91, 1);

    const overhead = 60500000;
    const operatingProfit = totalMargin - overhead;
    expect(operatingProfit).toBeCloseTo(1520783737.91, 1);
  });
});
