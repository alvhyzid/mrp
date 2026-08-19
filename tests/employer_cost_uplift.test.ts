import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { getEmployerCostConfig, computeMonthlyEmployerUplift } from '../src/features/mrp/server/computeEmployerCostUplift';
import { computeStandardLaborCostPerUnit } from '../src/features/mrp/server/computeStandardLaborCostPerUnit';

// Perintah Gabungan A-F, Bagian D (21 Agu 2026) -- model biaya pemberi kerja
// (BPJS Kesehatan+JKK+JKM+JHT) di atas gaji pokok, basis di-clamp ke
// [floor, ceiling] tenant. Angka acuan LANGSUNG dari contoh nyata pemilik
// produk: gaji Rp3.500.000 (di bawah floor Rp3.737.000) -> JKK Rp33.260,
// JKM Rp11.211 (basis dipakai = floor, BUKAN gaji individu).

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Environment variables NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for tests.');
}
const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

describe('computeMonthlyEmployerUplift — basis di-clamp floor/ceiling, bukan gaji individu', () => {
  const config = {
    wageBasisFloor: 3737000,
    wageBasisCeiling: 9000000,
    bpjsKesehatanRatePercent: 4,
    jkkRatePercent: 0.89,
    jkmRatePercent: 0.3,
    jhtRatePercent: 3.7
  };

  it('gaji DI BAWAH floor (Rp3.500.000, mis. Dina) -> basis dipakai FLOOR, cocok dgn JKK/JKM nyata dari pemilik produk', () => {
    const result = computeMonthlyEmployerUplift(3500000, true, config);
    expect(result.clampedBasis).toBe(3737000);
    const jkk = 3737000 * 0.0089;
    const jkm = 3737000 * 0.003;
    expect(jkk).toBeCloseTo(33259.3, 0);
    expect(jkm).toBeCloseTo(11211, 0);
  });

  it('(NEGATIF) gaji DI ATAS ceiling (mis. Direktur Rp20.000.000) -> basis DIPOTONG ke ceiling, BUKAN dihitung dari gaji penuh', () => {
    const belowCeiling = computeMonthlyEmployerUplift(9000000, true, config);
    const aboveCeiling = computeMonthlyEmployerUplift(20000000, true, config);
    expect(aboveCeiling.clampedBasis).toBe(9000000);
    // Uplift utk gaji 9jt dan 20jt HARUS SAMA PERSIS (basis di-cap) -- kalau kode
    // salah pakai gaji mentah, angka 20jt akan jauh lebih besar dari 9jt.
    expect(aboveCeiling.upliftAmount).toBeCloseTo(belowCeiling.upliftAmount, 2);
  });

  it('(NEGATIF) bpjs_kesehatan_enrolled=null (belum dikonfirmasi) TIDAK diikutkan Kesehatan, TAPI JKK/JKM/JHT tetap dihitung + catatan eksplisit muncul', () => {
    const enrolledTrue = computeMonthlyEmployerUplift(3500000, true, config);
    const enrolledNull = computeMonthlyEmployerUplift(3500000, null, config);
    const enrolledFalse = computeMonthlyEmployerUplift(3500000, false, config);
    expect(enrolledNull.notes.length).toBeGreaterThan(0);
    expect(enrolledNull.upliftAmount).toBeLessThan(enrolledTrue.upliftAmount);
    // null (belum dikonfirmasi) TIDAK diam-diam disamakan dgn false (dikonfirmasi TIDAK ikut) --
    // dari SISI ANGKA keduanya kebetulan sama (Kesehatan sama-sama 0), tapi notes HARUS beda.
    expect(enrolledNull.upliftAmount).toBeCloseTo(enrolledFalse.upliftAmount, 2);
    expect(enrolledFalse.notes.length).toBe(0);
  });
});

describe('computeStandardLaborCostPerUnit — kru wage_type=monthly ikut biaya pemberi kerja', () => {
  let companyId: number;
  let plantId: number;
  let itemId: number;

  beforeAll(async () => {
    const { data: company } = await adminClient
      .from('companies')
      .insert([{ name: 'EmployerUpliftTestCorp', industry_type: 'manufacturing', status: 'trial' }])
      .select('company_id')
      .single();
    companyId = company!.company_id;

    const { data: plant } = await adminClient
      .from('production_plants')
      .insert([{ company_id: companyId, name: 'Plant EmployerUpliftTest', is_active: true }])
      .select('production_plant_id')
      .single();
    plantId = plant!.production_plant_id;

    const { data: item } = await adminClient
      .from('items')
      .insert([{ company_id: companyId, item_code: 'UPLIFT-TOP', name: 'Item Uji Uplift', type: 'finished_good', base_uom: 'pcs', purchase_uom: 'pcs', uom_conversion_factor: 1 }])
      .select('item_id')
      .single();
    itemId = item!.item_id;

    const { data: bom } = await adminClient
      .from('boms')
      .insert([{ company_id: companyId, parent_item_id: itemId, version: 1, standard_yield_qty: 1, standard_yield_uom: 'pcs', status: 'active' }])
      .select('bom_id')
      .single();
    const { data: rawItem } = await adminClient
      .from('items')
      .insert([{ company_id: companyId, item_code: 'UPLIFT-RAW', name: 'Bahan Uji', type: 'raw_material', base_uom: 'g', purchase_uom: 'g', uom_conversion_factor: 1 }])
      .select('item_id')
      .single();
    await adminClient.from('bom_lines').insert([{ bom_id: bom!.bom_id, component_item_id: rawItem!.item_id, qty_per_unit_output: 1, uom: 'g' }]);

    const { data: routing } = await adminClient.from('routings').insert([{ company_id: companyId, item_id: itemId, version: 1 }]).select('routing_id').single();

    await adminClient.from('employees').insert([
      { company_id: companyId, production_plant_id: plantId, name: 'SPV Uplift Test', position: 'SPV', wage_type: 'monthly', wage_rate: 3500000, is_active: true, bpjs_kesehatan_enrolled: true }
    ]);

    await adminClient
      .from('routing_step_standard_crew')
      .insert([{ company_id: companyId, routing_id: routing!.routing_id, routing_step_id: null, role_label: 'SPV', wage_type: 'monthly', headcount: 1, hours_per_day: 7, is_full_day_dedicated: true, source: 'ESTIMASI_MANUAL' }]);

    await adminClient.from('production_standards').insert([
      { company_id: companyId, item_id: itemId, metric_key: 'unit_per_batch', value: 10, source: 'ESTIMASI_MANUAL', sample_count: 0 },
      { company_id: companyId, item_id: itemId, metric_key: 'batches_per_day', value: 1, source: 'ESTIMASI_MANUAL', sample_count: 0 }
    ]);
  });

  afterAll(async () => {
    const { data: boms } = await adminClient.from('boms').select('bom_id').eq('company_id', companyId);
    const bomIds = (boms ?? []).map((b) => b.bom_id);
    await adminClient.from('routing_step_standard_crew').delete().eq('company_id', companyId);
    await adminClient.from('production_standards').delete().eq('company_id', companyId);
    await adminClient.from('bom_lines').delete().in('bom_id', bomIds.length ? bomIds : [-1]);
    await adminClient.from('boms').delete().eq('company_id', companyId);
    await adminClient.from('routings').delete().eq('company_id', companyId);
    await adminClient.from('employees').delete().eq('company_id', companyId);
    await adminClient.from('items').delete().eq('company_id', companyId);
    await adminClient.from('production_plants').delete().eq('company_id', companyId);
    await adminClient.from('companies').delete().eq('company_id', companyId);
  });

  it('(NEGATIF) company BELUM punya konfigurasi BPJS di company_settings -> FALLBACK ke gaji pokok saja, TIDAK error, catatan eksplisit muncul', async () => {
    const { config, missingKeys } = await getEmployerCostConfig(adminClient, companyId);
    expect(config).toBeNull();
    expect(missingKeys.length).toBeGreaterThan(0);

    const result = await computeStandardLaborCostPerUnit(adminClient, companyId, itemId);
    // Tanpa konfigurasi: dailyCostPerPerson = wage_rate/hoursPerMonth*weekdayHours (fallback lama, tanpa uplift)
    const expectedNoUplift = (3500000 / 173.3333) * 7;
    const expectedCostPerUnit = expectedNoUplift / 1 / 10;
    expect(result.costPerUnit).toBeCloseTo(expectedCostPerUnit, 0);
    expect(result.notes.some((n) => n.includes('konfigurasi biaya pemberi kerja'))).toBe(true);
  });

  it('SETELAH company_settings BPJS diisi -> biaya SDM standar NAIK (ikut employer uplift), sesuai formula clamp+rate', async () => {
    await adminClient.from('company_settings').insert([
      { company_id: companyId, setting_key: 'bpjs_wage_basis_floor', setting_value: '3737000' },
      { company_id: companyId, setting_key: 'bpjs_wage_basis_ceiling', setting_value: '9000000' },
      { company_id: companyId, setting_key: 'bpjs_kesehatan_employer_rate_percent', setting_value: '4' },
      { company_id: companyId, setting_key: 'bpjs_jkk_employer_rate_percent', setting_value: '0.89' },
      { company_id: companyId, setting_key: 'bpjs_jkm_employer_rate_percent', setting_value: '0.30' },
      { company_id: companyId, setting_key: 'bpjs_jht_employer_rate_percent', setting_value: '3.7' }
    ]);

    const resultBefore = (3500000 / 173.3333) * 7 / 1 / 10;
    const result = await computeStandardLaborCostPerUnit(adminClient, companyId, itemId);
    expect(result.costPerUnit).toBeGreaterThan(resultBefore);

    // basis floor 3737000, rate JKK+JKM+JHT+Kesehatan = 0.89+0.30+3.7+4 = 8.89%
    const uplift = 3737000 * 0.0889;
    const expectedWithUplift = ((3500000 + uplift) / 173.3333) * 7 / 1 / 10;
    expect(result.costPerUnit).toBeCloseTo(expectedWithUplift, 0);

    await adminClient.from('company_settings').delete().eq('company_id', companyId);
  });
});

describe('compute_production_batch_labor_cost (SQL, sisi biaya SDM AKTUAL) — konsisten dgn sisi standar', () => {
  let companyId: number;
  let plantId: number;
  let employeeId: number;
  let workOrderId: number;
  let batchId: number;

  beforeAll(async () => {
    const { data: company } = await adminClient
      .from('companies')
      .insert([{ name: 'EmployerUpliftSqlTestCorp', industry_type: 'manufacturing', status: 'trial' }])
      .select('company_id')
      .single();
    companyId = company!.company_id;

    const { data: plant } = await adminClient
      .from('production_plants')
      .insert([{ company_id: companyId, name: 'Plant EmployerUpliftSqlTest', is_active: true }])
      .select('production_plant_id')
      .single();
    plantId = plant!.production_plant_id;

    const { data: item } = await adminClient
      .from('items')
      .insert([{ company_id: companyId, item_code: 'UPLIFT-SQL-FG', name: 'Item Uji Uplift SQL', type: 'finished_good', base_uom: 'pcs', purchase_uom: 'pcs', uom_conversion_factor: 1 }])
      .select('item_id')
      .single();

    const { data: bom } = await adminClient
      .from('boms')
      .insert([{ company_id: companyId, parent_item_id: item!.item_id, version: 1, standard_yield_qty: 1, standard_yield_uom: 'pcs', status: 'active' }])
      .select('bom_id')
      .single();

    const { data: wo } = await adminClient
      .from('work_orders')
      .insert([{ company_id: companyId, production_plant_id: plantId, item_id: item!.item_id, bom_id: bom!.bom_id, planned_qty: 10, status: 'in_progress' }])
      .select('work_order_id')
      .single();
    workOrderId = wo!.work_order_id;

    const { data: batch } = await adminClient
      .from('production_batches')
      .insert([{ company_id: companyId, work_order_id: workOrderId, batch_number: 'BATCH-UPLIFT-SQL-1', planned_qty: 10, uom: 'pcs', status: 'in_progress' }])
      .select('production_batch_id')
      .single();
    batchId = batch!.production_batch_id;

    const { data: employee } = await adminClient
      .from('employees')
      .insert([{ company_id: companyId, production_plant_id: plantId, name: 'SPV Uplift SQL Test', position: 'SPV', wage_type: 'monthly', wage_rate: 3500000, is_active: true, bpjs_kesehatan_enrolled: true }])
      .select('employee_id')
      .single();
    employeeId = employee!.employee_id;

    await adminClient.from('work_order_assignments').insert([{ work_order_id: workOrderId, production_batch_id: batchId, employee_id: employeeId, status: 'completed', actual_hours: 7, work_date: '2026-08-17' }]); // Senin, bukan Sabtu
  });

  afterAll(async () => {
    await adminClient.from('work_order_assignments').delete().eq('production_batch_id', batchId);
    await adminClient.from('production_batches').delete().eq('company_id', companyId);
    await adminClient.from('work_orders').delete().eq('company_id', companyId);
    await adminClient.from('boms').delete().eq('company_id', companyId);
    await adminClient.from('employees').delete().eq('company_id', companyId);
    await adminClient.from('items').delete().eq('company_id', companyId);
    await adminClient.from('production_plants').delete().eq('company_id', companyId);
    await adminClient.from('company_settings').delete().eq('company_id', companyId);
    await adminClient.from('companies').delete().eq('company_id', companyId);
  });

  it('TANPA konfigurasi BPJS -> biaya SDM aktual = gaji pokok saja (fallback lama, TIDAK error)', async () => {
    const { data: cost, error } = await adminClient.rpc('compute_production_batch_labor_cost', { p_production_batch_id: batchId });
    if (error) throw new Error(error.message);
    const expected = (3500000 / 173.3333) * 7;
    expect(Number(cost)).toBeCloseTo(expected, 0);
  });

  it('SETELAH konfigurasi BPJS diisi -> biaya SDM aktual NAIK, formula clamp+rate SAMA PERSIS dgn sisi standar (JS)', async () => {
    await adminClient.from('company_settings').insert([
      { company_id: companyId, setting_key: 'bpjs_wage_basis_floor', setting_value: '3737000' },
      { company_id: companyId, setting_key: 'bpjs_wage_basis_ceiling', setting_value: '9000000' },
      { company_id: companyId, setting_key: 'bpjs_kesehatan_employer_rate_percent', setting_value: '4' },
      { company_id: companyId, setting_key: 'bpjs_jkk_employer_rate_percent', setting_value: '0.89' },
      { company_id: companyId, setting_key: 'bpjs_jkm_employer_rate_percent', setting_value: '0.30' },
      { company_id: companyId, setting_key: 'bpjs_jht_employer_rate_percent', setting_value: '3.7' }
    ]);

    const { data: cost, error } = await adminClient.rpc('compute_production_batch_labor_cost', { p_production_batch_id: batchId });
    if (error) throw new Error(error.message);

    const upliftMonthly = 3737000 * 0.0889; // JKK+JKM+JHT+Kesehatan = 8.89%, basis floor (gaji 3.5jt < floor)
    const expected = ((3500000 + upliftMonthly) / 173.3333) * 7;
    expect(Number(cost)).toBeCloseTo(expected, 0);
  });
});
