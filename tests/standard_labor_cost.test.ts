import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { computeStandardLaborCostPerUnit } from '../src/features/mrp/server/computeStandardLaborCostPerUnit';

// Margin Watch Lapis 1 lanjutan — biaya SDM standar per unit dari
// routing_step_standard_crew (basis kru HARIAN ÷ batches_per_day, BUKAN
// active_duration_minutes tahap — keputusan pemilik produk 20 Agu 2026 setelah
// ditemukan basis lama akan double-count: kru dibayar per SHIFT, bukan per
// menit proses).

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Environment variables NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for tests.');
}
const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

describe('computeStandardLaborCostPerUnit — kru harian ÷ batches_per_day, berjenjang 2-tingkat', () => {
  let companyId: number;
  let plantId: number;
  let topItemId: number; // BOM 2-tingkat: topItem <- WIP <- (tanpa routing)
  let wipItemId: number;
  let routingTopId: number;
  let routingWipId: number;

  beforeAll(async () => {
    const { data: company, error: companyError } = await adminClient
      .from('companies')
      .insert([{ name: 'StandardLaborCostTestCorp', industry_type: 'manufacturing', status: 'trial' }])
      .select('company_id')
      .single();
    if (companyError) throw new Error(companyError.message);
    companyId = company.company_id;

    const { data: plant, error: plantError } = await adminClient
      .from('production_plants')
      .insert([{ company_id: companyId, name: 'Plant StandardLaborCostTest', is_active: true }])
      .select('production_plant_id')
      .single();
    if (plantError) throw new Error(plantError.message);
    plantId = plant.production_plant_id;

    const { data: items, error: itemsError } = await adminClient
      .from('items')
      .insert([
        { company_id: companyId, item_code: 'LABORCOST-TOP', name: 'Item Uji SDM Standar (Top)', type: 'finished_good', base_uom: 'pcs', purchase_uom: 'pcs', uom_conversion_factor: 1 },
        { company_id: companyId, item_code: 'LABORCOST-WIP', name: 'Item Uji SDM Standar (WIP)', type: 'wip', base_uom: 'pcs', purchase_uom: 'pcs', uom_conversion_factor: 1 },
        { company_id: companyId, item_code: 'LABORCOST-RAW', name: 'Bahan Tanpa Routing', type: 'raw_material', base_uom: 'g', purchase_uom: 'g', uom_conversion_factor: 1 }
      ])
      .select('item_id, item_code');
    if (itemsError) throw new Error(itemsError.message);
    topItemId = items!.find((i) => i.item_code === 'LABORCOST-TOP')!.item_id;
    wipItemId = items!.find((i) => i.item_code === 'LABORCOST-WIP')!.item_id;
    const rawItemId = items!.find((i) => i.item_code === 'LABORCOST-RAW')!.item_id;

    // BOM top: 1 unit top butuh 3 unit WIP (rasio harus ikut terbawa ke biaya SDM WIP).
    const { data: bomTop, error: bomTopError } = await adminClient
      .from('boms')
      .insert([{ company_id: companyId, parent_item_id: topItemId, version: 1, standard_yield_qty: 1, standard_yield_uom: 'pcs', status: 'active' }])
      .select('bom_id')
      .single();
    if (bomTopError) throw new Error(bomTopError.message);
    await adminClient.from('bom_lines').insert([{ bom_id: bomTop.bom_id, component_item_id: wipItemId, qty_per_unit_output: 3, uom: 'pcs' }]);

    // BOM WIP: 1 unit WIP butuh bahan mentah (tanpa routing sendiri -- leaf).
    const { data: bomWip, error: bomWipError } = await adminClient
      .from('boms')
      .insert([{ company_id: companyId, parent_item_id: wipItemId, version: 1, standard_yield_qty: 1, standard_yield_uom: 'pcs', status: 'active' }])
      .select('bom_id')
      .single();
    if (bomWipError) throw new Error(bomWipError.message);
    await adminClient.from('bom_lines').insert([{ bom_id: bomWip.bom_id, component_item_id: rawItemId, qty_per_unit_output: 5, uom: 'g' }]);

    const { data: routingTop, error: routingTopError } = await adminClient.from('routings').insert([{ company_id: companyId, item_id: topItemId, version: 1 }]).select('routing_id').single();
    if (routingTopError) throw new Error(routingTopError.message);
    routingTopId = routingTop.routing_id;

    const { data: routingWip, error: routingWipError } = await adminClient.from('routings').insert([{ company_id: companyId, item_id: wipItemId, version: 1 }]).select('routing_id').single();
    if (routingWipError) throw new Error(routingWipError.message);
    routingWipId = routingWip.routing_id;

    const { error: employeeError } = await adminClient
      .from('employees')
      .insert([{ company_id: companyId, production_plant_id: plantId, name: 'PHL LaborCostTest', position: 'Operator', department: 'production', wage_type: 'daily', wage_rate: 60000, is_active: true }]);
    if (employeeError) throw new Error(employeeError.message);

    // TOP: kru 2 orang, standar 2 batch/hari, 10 unit/batch -> kru harian
    // 2*60000=120000, per unit level ini = 120000/2/10 = 6000/unit.
    const { error: crewTopError } = await adminClient
      .from('routing_step_standard_crew')
      .insert([{ company_id: companyId, routing_id: routingTopId, routing_step_id: null, role_label: 'Operator Top', wage_type: 'daily', headcount: 2, hours_per_day: 7, is_full_day_dedicated: true, source: 'ESTIMASI_MANUAL' }]);
    if (crewTopError) throw new Error(crewTopError.message);
    const { error: standardsTopError } = await adminClient
      .from('production_standards')
      .insert([
        { company_id: companyId, item_id: topItemId, metric_key: 'unit_per_batch', value: 10, source: 'ESTIMASI_MANUAL', sample_count: 0 },
        { company_id: companyId, item_id: topItemId, metric_key: 'batches_per_day', value: 2, source: 'ESTIMASI_MANUAL', sample_count: 0 }
      ]);
    if (standardsTopError) throw new Error(standardsTopError.message);

    // WIP: kru 1 orang, standar 4 batch/hari, 5 unit/batch -> kru harian
    // 1*60000=60000, per unit level ini = 60000/4/5 = 3000/unit -- dikali rasio
    // 3 (3 WIP per 1 top) = 9000 kontribusi ke biaya SDM top.
    const { error: crewWipError } = await adminClient
      .from('routing_step_standard_crew')
      .insert([{ company_id: companyId, routing_id: routingWipId, routing_step_id: null, role_label: 'Operator WIP', wage_type: 'daily', headcount: 1, hours_per_day: 7, is_full_day_dedicated: true, source: 'ESTIMASI_MANUAL' }]);
    if (crewWipError) throw new Error(crewWipError.message);
    const { error: standardsWipError } = await adminClient
      .from('production_standards')
      .insert([
        { company_id: companyId, item_id: wipItemId, metric_key: 'unit_per_batch', value: 5, source: 'ESTIMASI_MANUAL', sample_count: 0 },
        { company_id: companyId, item_id: wipItemId, metric_key: 'batches_per_day', value: 4, source: 'ESTIMASI_MANUAL', sample_count: 0 }
      ]);
    if (standardsWipError) throw new Error(standardsWipError.message);
  });

  afterAll(async () => {
    const { data: boms } = await adminClient.from('boms').select('bom_id').eq('company_id', companyId);
    const bomIds = (boms ?? []).map((b) => b.bom_id);
    const cleanupSteps: Array<[string, () => any]> = [
      ['routing_step_standard_crew', () => adminClient.from('routing_step_standard_crew').delete().eq('company_id', companyId)],
      ['production_standards', () => adminClient.from('production_standards').delete().eq('company_id', companyId)],
      ['bom_lines', () => adminClient.from('bom_lines').delete().in('bom_id', bomIds.length ? bomIds : [-1])],
      ['boms', () => adminClient.from('boms').delete().eq('company_id', companyId)],
      ['routings', () => adminClient.from('routings').delete().eq('company_id', companyId)],
      ['employees', () => adminClient.from('employees').delete().eq('company_id', companyId)],
      ['items', () => adminClient.from('items').delete().eq('company_id', companyId)],
      ['production_plants', () => adminClient.from('production_plants').delete().eq('company_id', companyId)],
      ['companies', () => adminClient.from('companies').delete().eq('company_id', companyId)]
    ];
    for (const [label, run] of cleanupSteps) {
      const { error } = await run();
      if (error) throw new Error(`Cleanup failed at ${label}: ${error.message}`);
    }
  });

  it('menjumlahkan biaya SDM 2 TINGKAT (top + WIP), rasio top level TEPAT 1.0 (regresi-guard dobel-hitung)', async () => {
    const result = await computeStandardLaborCostPerUnit(adminClient, companyId, topItemId);
    // top: 120000/2/10=6000. WIP: 60000/4/5=3000 * rasio 3 = 9000. Total=15000.
    expect(result.costPerUnit).toBeCloseTo(15000, 2);
    expect(result.complete).toBe(true);
    expect(result.notes.some((n) => n.includes('rasio 1.000000'))).toBe(true);
    expect(result.notes.some((n) => n.includes('rasio 3.000000'))).toBe(true);
  });

  it('(NEGATIF) item TANPA BOM sama sekali — dilewati dgn catatan eksplisit, bukan dianggap 0 diam-diam tanpa penjelasan', async () => {
    const { data: noBomItem } = await adminClient
      .from('items')
      .insert([{ company_id: companyId, item_code: 'LABORCOST-NOBOM', name: 'Item Tanpa BOM', type: 'finished_good', base_uom: 'pcs', purchase_uom: 'pcs', uom_conversion_factor: 1 }])
      .select('item_id')
      .single();
    const result = await computeStandardLaborCostPerUnit(adminClient, companyId, noBomItem!.item_id);
    expect(result.complete).toBe(false);
    expect(result.costPerUnit).toBe(0);
    expect(result.notes.length).toBeGreaterThan(0);
    expect(result.notes[0]).toMatch(/tidak punya BOM aktif/);
    await adminClient.from('items').delete().eq('item_id', noBomItem!.item_id);
  });

  it('(NEGATIF) routing ADA tapi kru standar belum diisi — dilewati dgn catatan eksplisit, hasil tetap PARSIAL bukan gagal total', async () => {
    // Hapus kru WIP sementara -> level top tetap terhitung, level WIP dilewati.
    await adminClient.from('routing_step_standard_crew').delete().eq('routing_id', routingWipId);
    const result = await computeStandardLaborCostPerUnit(adminClient, companyId, topItemId);
    expect(result.complete).toBe(false); // ada level yg dilewati
    expect(result.costPerUnit).toBeCloseTo(6000, 2); // cuma kontribusi TOP, WIP dilewati (bukan dianggap 0 lalu dijumlah utuh 15000)
    expect(result.notes.some((n) => n.includes('komposisi kru standar belum diisi'))).toBe(true);

    // Kembalikan utk test lain (kalau ada yang jalan setelah ini dalam file sama).
    await adminClient
      .from('routing_step_standard_crew')
      .insert([{ company_id: companyId, routing_id: routingWipId, routing_step_id: null, role_label: 'Operator WIP', wage_type: 'daily', headcount: 1, hours_per_day: 7, is_full_day_dedicated: true, source: 'ESTIMASI_MANUAL' }]);
  });
});
