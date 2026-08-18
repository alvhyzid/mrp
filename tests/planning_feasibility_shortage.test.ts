import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { explodeBomRequirements } from '../src/features/mrp/server/explodeBomRequirements';

// Fase Produksi Nyata, P2 — sebelum ini, kekurangan bahan HANYA dicek 1 level di
// getPlanningFeasibility.ts, yang melewatkan kasus nyata SAS005: Maltodextrin
// dipakai LANGSUNG di adonan Drinkme DAN sebagai carrier di dalam 5 premix
// WIP-nya sekaligus -- baru ketahuan kurang kalau kedua pemakaian dijumlah.
// Test ini membuktikan eksplosi berjenjang menjumlahkan KEDUA pemakaian dengan
// benar, dengan fixture kecil yang meniru pola yang sama (bukan mengulang
// verifikasi manual SAS005 yang sudah dilakukan langsung terhadap data dev asli).

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Environment variables NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for tests.');
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

describe('Fase Produksi Nyata P2 — eksplosi BOM berjenjang untuk deteksi kekurangan bahan', () => {
  let companyId: number;
  let plantId: number;
  let topItemId: number;
  let premixItemId: number;
  let rawAItemId: number;
  let rawBItemId: number;

  beforeAll(async () => {
    const { data: company, error: companyError } = await adminClient
      .from('companies')
      .insert([{ name: 'ShortageExplodeTestCorp', industry_type: 'manufacturing', status: 'trial' }])
      .select('company_id')
      .single();
    if (companyError) throw new Error(companyError.message);
    companyId = company.company_id;

    const { data: plant, error: plantError } = await adminClient
      .from('production_plants')
      .insert([{ company_id: companyId, name: 'Plant ShortageExplodeTest', is_active: true }])
      .select('production_plant_id')
      .single();
    if (plantError) throw new Error(plantError.message);
    plantId = plant.production_plant_id;

    const { data: items, error: itemsError } = await adminClient
      .from('items')
      .insert([
        { company_id: companyId, item_code: 'SHORT-TEST-TOP', name: 'Produk Jadi', type: 'finished_good', base_uom: 'pcs', purchase_uom: 'pcs', uom_conversion_factor: 1 },
        { company_id: companyId, item_code: 'SHORT-TEST-PREMIX', name: 'Premix Pemanis Uji', type: 'wip', base_uom: 'g', purchase_uom: 'g', uom_conversion_factor: 1 },
        { company_id: companyId, item_code: 'SHORT-TEST-RAWA', name: 'Bahan A (dipakai ganda)', type: 'raw_material', base_uom: 'g', purchase_uom: 'g', uom_conversion_factor: 1 },
        { company_id: companyId, item_code: 'SHORT-TEST-RAWB', name: 'Bahan B (cukup)', type: 'raw_material', base_uom: 'g', purchase_uom: 'g', uom_conversion_factor: 1 }
      ])
      .select('item_id, item_code');
    if (itemsError) throw new Error(itemsError.message);
    topItemId = items!.find((i) => i.item_code === 'SHORT-TEST-TOP')!.item_id;
    premixItemId = items!.find((i) => i.item_code === 'SHORT-TEST-PREMIX')!.item_id;
    rawAItemId = items!.find((i) => i.item_code === 'SHORT-TEST-RAWA')!.item_id;
    rawBItemId = items!.find((i) => i.item_code === 'SHORT-TEST-RAWB')!.item_id;

    // BOM top: 1 unit produk = 1g Bahan A LANGSUNG + 0.5g Premix.
    const { data: bomTop, error: bomTopError } = await adminClient
      .from('boms')
      .insert([{ company_id: companyId, parent_item_id: topItemId, version: 1, standard_yield_qty: 1, standard_yield_uom: 'pcs', status: 'active' }])
      .select('bom_id')
      .single();
    if (bomTopError) throw new Error(bomTopError.message);
    const { error: bomTopLinesError } = await adminClient.from('bom_lines').insert([
      { bom_id: bomTop.bom_id, component_item_id: rawAItemId, qty_per_unit_output: 1, uom: 'g' },
      { bom_id: bomTop.bom_id, component_item_id: premixItemId, qty_per_unit_output: 0.5, uom: 'g' }
    ]);
    if (bomTopLinesError) throw new Error(bomTopLinesError.message);

    // BOM premix: 1g premix = 0.6g Bahan A (carrier) + 0.4g Bahan B (aktif).
    const { data: bomPremix, error: bomPremixError } = await adminClient
      .from('boms')
      .insert([{ company_id: companyId, parent_item_id: premixItemId, version: 1, standard_yield_qty: 1, standard_yield_uom: 'g', status: 'active' }])
      .select('bom_id')
      .single();
    if (bomPremixError) throw new Error(bomPremixError.message);
    const { error: bomPremixLinesError } = await adminClient.from('bom_lines').insert([
      { bom_id: bomPremix.bom_id, component_item_id: rawAItemId, qty_per_unit_output: 0.6, uom: 'g' },
      { bom_id: bomPremix.bom_id, component_item_id: rawBItemId, qty_per_unit_output: 0.4, uom: 'g' }
    ]);
    if (bomPremixLinesError) throw new Error(bomPremixLinesError.message);

    const { error: lotsError } = await adminClient.from('lots').insert([
      { company_id: companyId, production_plant_id: plantId, item_id: rawAItemId, lot_number: 'SHORT-TEST-LOT-A', quantity_on_hand: 120, source_type: 'purchased', status: 'available' },
      { company_id: companyId, production_plant_id: plantId, item_id: rawBItemId, lot_number: 'SHORT-TEST-LOT-B', quantity_on_hand: 1000, source_type: 'purchased', status: 'available' }
    ]);
    if (lotsError) throw new Error(lotsError.message);
  });

  afterAll(async () => {
    const { data: boms } = await adminClient.from('boms').select('bom_id').eq('company_id', companyId);
    const bomIds = (boms ?? []).map((b) => b.bom_id);
    const cleanupSteps: Array<[string, () => any]> = [
      ['bom_lines', () => adminClient.from('bom_lines').delete().in('bom_id', bomIds.length ? bomIds : [-1])],
      ['lots', () => adminClient.from('lots').delete().eq('company_id', companyId)],
      ['boms', () => adminClient.from('boms').delete().eq('company_id', companyId)],
      ['items', () => adminClient.from('items').delete().eq('company_id', companyId)],
      ['production_plants', () => adminClient.from('production_plants').delete().eq('company_id', companyId)],
      ['companies', () => adminClient.from('companies').delete().eq('company_id', companyId)]
    ];
    for (const [label, run] of cleanupSteps) {
      const { error } = await run();
      if (error) throw new Error(`Cleanup failed at ${label}: ${error.message}`);
    }
  });

  it('menjumlahkan pemakaian LANGSUNG + pemakaian sebagai carrier di premix, bukan cuma level teratas', async () => {
    const qtyOrdered = 100;
    const { shortages, toProduce } = await explodeBomRequirements(adminClient, companyId, topItemId, qtyOrdered);

    // Kebutuhan Bahan A = (100 * 1) langsung + (100 * 0.5 * 0.6) lewat premix = 100 + 30 = 130.
    // Stok 120 -> kurang 10. INI YANG SEBELUMNYA TERLEWAT kalau cuma cek 1 level
    // (1 level saja akan bilang stok 120 vs kebutuhan langsung 100 = CUKUP, salah).
    const rawA = shortages.find((s) => s.item_id === rawAItemId);
    expect(rawA).toBeDefined();
    expect(rawA!.needed).toBeCloseTo(130, 5);
    expect(rawA!.available).toBe(120);
    expect(rawA!.short).toBeCloseTo(10, 5);

    // Bahan B: kebutuhan 100*0.5*0.4 = 20, stok 1000 -> CUKUP, tidak boleh muncul di shortages.
    const rawB = shortages.find((s) => s.item_id === rawBItemId);
    expect(rawB).toBeUndefined();

    // Premix: punya BOM aktif sendiri -> masuk "perlu diproduksi", BUKAN kekurangan beli.
    const premix = toProduce.find((c) => c.item_id === premixItemId);
    expect(premix).toBeDefined();
    expect(premix!.qty_needed).toBeCloseTo(50, 5); // 100 * 0.5
    expect(shortages.find((s) => s.item_id === premixItemId)).toBeUndefined();
  });
});
