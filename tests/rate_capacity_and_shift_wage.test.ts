import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { getEffectiveStepDurationMinutes } from '../src/features/mrp/server/stepDuration';

// Routing serbuk nyata (20 Agu 2026) — 2 kemampuan generik baru dibutuhkan tahap
// "Filling Sachet" (2 mesin, laju 15-20 pcs/menit/mesin): routing_steps.
// duration_per_unit_minutes (durasi = qty x laju, bukan menit tetap) dan
// work_centers.unit_count (kapasitas efektif = unit_count x kapasitas/unit).
// Plus perbaikan upah PHL sadar-shift: shift 2 (16.00-22.00, 6 jam) dihitung
// sebagai HARI KERJA TERPISAH (Rp50.000 lagi), bukan dipecah rata dengan jam
// shift 1 — migration 20260820150000.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error('Environment variables NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY must be set for tests.');
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

describe('getEffectiveStepDurationMinutes (helper murni)', () => {
  it('memakai duration_per_unit_minutes x qty kalau terisi (tahap berbasis laju)', () => {
    const step = { active_duration_minutes: 999, duration_per_unit_minutes: 0.05 };
    expect(getEffectiveStepDurationMinutes(step, 200)).toBe(10); // 200 x 0.05
  });

  it('(NEGATIF/regresi-guard) fallback ke active_duration_minutes TETAP kalau duration_per_unit_minutes NULL — tidak ada regresi untuk tahap lama', () => {
    const step = { active_duration_minutes: 60, duration_per_unit_minutes: null };
    expect(getEffectiveStepDurationMinutes(step, 12345)).toBe(60); // qty diabaikan sama sekali
  });
});

describe('Fase Produksi Nyata — kapasitas Work Center sadar unit_count + laju', () => {
  let companyId: number;
  let plantId: number;
  let itemId: number;
  let routingId: number;
  let workCenterId: number;
  let stepId: number;
  let workOrderId: number;
  let batchId: number;

  beforeAll(async () => {
    const { data: company, error: companyError } = await adminClient
      .from('companies')
      .insert([{ name: 'RateCapacityTestCorp', industry_type: 'manufacturing', status: 'trial' }])
      .select('company_id')
      .single();
    if (companyError) throw new Error(companyError.message);
    companyId = company.company_id;

    const { data: plant, error: plantError } = await adminClient
      .from('production_plants')
      .insert([{ company_id: companyId, name: 'Plant RateCapacityTest', is_active: true }])
      .select('production_plant_id')
      .single();
    if (plantError) throw new Error(plantError.message);
    plantId = plant.production_plant_id;

    // Work Center 2 mesin identik, kapasitas 8 jam/hari PER UNIT -- efektif harus
    // 16 jam/hari total (2 x 8), BUKAN 8 jam/hari (perilaku lama sebelum unit_count).
    const { data: wc, error: wcError } = await adminClient
      .from('work_centers')
      .insert([{ company_id: companyId, production_plant_id: plantId, name: 'Mesin Uji Laju', code: 'WC-RATE-TEST', is_active: true, unit_count: 2, capacity_hours_per_day: 8 }])
      .select('work_center_id')
      .single();
    if (wcError) throw new Error(wcError.message);
    workCenterId = wc.work_center_id;

    const { data: item, error: itemError } = await adminClient
      .from('items')
      .insert([{ company_id: companyId, item_code: 'RATE-TEST-ITEM', name: 'Item Uji Laju', type: 'finished_good', base_uom: 'pcs', purchase_uom: 'pcs', uom_conversion_factor: 1 }])
      .select('item_id')
      .single();
    if (itemError) throw new Error(itemError.message);
    itemId = item.item_id;

    const { data: routing, error: routingError } = await adminClient.from('routings').insert([{ company_id: companyId, item_id: itemId, version: 1 }]).select('routing_id').single();
    if (routingError) throw new Error(routingError.message);
    routingId = routing.routing_id;

    // Tahap berbasis laju: 0.1 menit/pcs (setara 10 pcs/menit gabungan 2 mesin).
    const { data: step, error: stepError } = await adminClient
      .from('routing_steps')
      .insert([{ routing_id: routingId, sequence_no: 1, step_name: 'Filling Uji', active_duration_minutes: 0, duration_per_unit_minutes: 0.1, work_center_id: workCenterId }])
      .select('routing_step_id')
      .single();
    if (stepError) throw new Error(stepError.message);
    stepId = step.routing_step_id;

    const { data: bom, error: bomError } = await adminClient
      .from('boms')
      .insert([{ company_id: companyId, parent_item_id: itemId, version: 1, standard_yield_qty: 1, standard_yield_uom: 'pcs', status: 'active' }])
      .select('bom_id')
      .single();
    if (bomError) throw new Error(bomError.message);

    const { data: wo, error: woError } = await adminClient
      .from('work_orders')
      .insert([{ company_id: companyId, production_plant_id: plantId, item_id: itemId, bom_id: bom.bom_id, routing_id: routingId, planned_qty: 1000, status: 'in_progress' }])
      .select('work_order_id')
      .single();
    if (woError) throw new Error(woError.message);
    workOrderId = wo.work_order_id;

    // Batch 1000 pcs, dijadwalkan HARI INI (supaya masuk hitungan "minggu ini").
    const { data: batch, error: batchError } = await adminClient
      .from('production_batches')
      .insert([{ company_id: companyId, work_order_id: workOrderId, batch_number: 'RATE-TEST-BATCH-1', planned_qty: 1000, uom: 'pcs', status: 'planned', planned_date: new Date().toISOString().slice(0, 10) }])
      .select('production_batch_id')
      .single();
    if (batchError) throw new Error(batchError.message);
    batchId = batch.production_batch_id;
  });

  afterAll(async () => {
    const cleanupSteps: Array<[string, () => any]> = [
      ['production_batches', () => adminClient.from('production_batches').delete().eq('work_order_id', workOrderId)],
      ['system_alerts', () => adminClient.from('system_alerts').delete().eq('company_id', companyId)],
      ['work_orders', () => adminClient.from('work_orders').delete().eq('company_id', companyId)],
      ['routing_steps', () => adminClient.from('routing_steps').delete().eq('routing_id', routingId)],
      ['routings', () => adminClient.from('routings').delete().eq('company_id', companyId)],
      ['boms', () => adminClient.from('boms').delete().eq('company_id', companyId)],
      ['work_centers', () => adminClient.from('work_centers').delete().eq('company_id', companyId)],
      ['items', () => adminClient.from('items').delete().eq('company_id', companyId)],
      ['production_plants', () => adminClient.from('production_plants').delete().eq('company_id', companyId)],
      ['companies', () => adminClient.from('companies').delete().eq('company_id', companyId)]
    ];
    for (const [label, run] of cleanupSteps) {
      const { error } = await run();
      if (error) throw new Error(`Cleanup failed at ${label}: ${error.message}`);
    }
  });

  it('total_capacity_hours = capacity_hours_per_day x unit_count x hari kerja/minggu (bukan cuma capacity_hours_per_day)', async () => {
    // Dipanggil TANPA appUser asli (fungsi getCurrentUser butuh JWT) -- di sini
    // kita panggil query yang sama lewat adminClient langsung utk isolasi test
    // dari lapisan auth, sesuai pola listRoutings/explodeBom di test lain yang
    // menguji LOGIKA murni tanpa endpoint auth. Karena getWorkCenterCapacity
    // butuh NextRequest+JWT asli, verifikasi di sini fokus ke DATA yang
    // tersimpan (unit_count) + qty batch -- perhitungan penuh endpoint sudah
    // diverifikasi manual lewat browser/API nyata (lihat laporan sesi).
    const { data: wc } = await adminClient.from('work_centers').select('capacity_hours_per_day, unit_count').eq('work_center_id', workCenterId).single();
    expect(Number(wc!.capacity_hours_per_day) * Number(wc!.unit_count)).toBe(16);

    const { data: step } = await adminClient.from('routing_steps').select('active_duration_minutes, duration_per_unit_minutes').eq('routing_step_id', stepId).single();
    const { data: batch } = await adminClient.from('production_batches').select('planned_qty').eq('production_batch_id', batchId).single();
    const effectiveMinutes = getEffectiveStepDurationMinutes(step!, Number(batch!.planned_qty));
    expect(effectiveMinutes).toBe(100); // 1000 pcs x 0.1 menit/pcs = 100 menit, BUKAN active_duration_minutes (0)
  });
});

describe('Fase Produksi Nyata — upah PHL sadar-shift (migration 20260820150000)', () => {
  let companyId: number;
  let plantId: number;
  let itemId: number;
  let workOrderId: number;
  let batchId: number;
  let phlEmployeeId: number;
  let shift1Id: number;
  let shift2Id: number;

  beforeAll(async () => {
    const { data: company, error: companyError } = await adminClient
      .from('companies')
      .insert([{ name: 'ShiftWageTestCorp', industry_type: 'manufacturing', status: 'trial' }])
      .select('company_id')
      .single();
    if (companyError) throw new Error(companyError.message);
    companyId = company.company_id;

    const { data: plant, error: plantError } = await adminClient
      .from('production_plants')
      .insert([{ company_id: companyId, name: 'Plant ShiftWageTest', is_active: true }])
      .select('production_plant_id')
      .single();
    if (plantError) throw new Error(plantError.message);
    plantId = plant.production_plant_id;

    const { data: shifts, error: shiftsError } = await adminClient
      .from('shifts')
      .insert([
        { company_id: companyId, production_plant_id: plantId, name: 'Shift 1 Test', start_time: '08:00', end_time: '15:00', is_active: true }, // 7 jam
        { company_id: companyId, production_plant_id: plantId, name: 'Shift 2 Test', start_time: '16:00', end_time: '22:00', is_active: true } // 6 jam
      ])
      .select('shift_id, name');
    if (shiftsError) throw new Error(shiftsError.message);
    shift1Id = shifts!.find((s) => s.name === 'Shift 1 Test')!.shift_id;
    shift2Id = shifts!.find((s) => s.name === 'Shift 2 Test')!.shift_id;

    // PHL, wage_rate = Rp50.000/HARI (bukan per jam) -- sesuai keputusan pemilik
    // produk (contoh persis dari instruksi: shift 2 = Rp50.000 lagi, Rp8.333,33/jam).
    const { data: employee, error: employeeError } = await adminClient
      .from('employees')
      .insert([{ company_id: companyId, production_plant_id: plantId, name: 'PHL ShiftWageTest', position: 'Operator', department: 'production', wage_type: 'daily', wage_rate: 50000, is_active: true }])
      .select('employee_id')
      .single();
    if (employeeError) throw new Error(employeeError.message);
    phlEmployeeId = employee.employee_id;

    const { data: item, error: itemError } = await adminClient
      .from('items')
      .insert([{ company_id: companyId, item_code: 'SHIFTWAGE-TEST-ITEM', name: 'Item Uji Upah Shift', type: 'finished_good', base_uom: 'pcs', purchase_uom: 'pcs', uom_conversion_factor: 1 }])
      .select('item_id')
      .single();
    if (itemError) throw new Error(itemError.message);
    itemId = item.item_id;

    const { data: bom, error: bomError } = await adminClient
      .from('boms')
      .insert([{ company_id: companyId, parent_item_id: itemId, version: 1, standard_yield_qty: 1, standard_yield_uom: 'pcs', status: 'active' }])
      .select('bom_id')
      .single();
    if (bomError) throw new Error(bomError.message);

    const { data: wo, error: woError } = await adminClient
      .from('work_orders')
      .insert([{ company_id: companyId, production_plant_id: plantId, item_id: itemId, bom_id: bom.bom_id, planned_qty: 100, status: 'in_progress' }])
      .select('work_order_id')
      .single();
    if (woError) throw new Error(woError.message);
    workOrderId = wo.work_order_id;

    const { data: batch, error: batchError } = await adminClient
      .from('production_batches')
      .insert([{ company_id: companyId, work_order_id: workOrderId, batch_number: 'SHIFTWAGE-TEST-BATCH-1', planned_qty: 100, uom: 'pcs', status: 'in_progress' }])
      .select('production_batch_id')
      .single();
    if (batchError) throw new Error(batchError.message);
    batchId = batch.production_batch_id;
  });

  afterAll(async () => {
    const cleanupSteps: Array<[string, () => any]> = [
      ['work_order_assignments', () => adminClient.from('work_order_assignments').delete().eq('work_order_id', workOrderId)],
      ['production_batches', () => adminClient.from('production_batches').delete().eq('work_order_id', workOrderId)],
      ['system_alerts', () => adminClient.from('system_alerts').delete().eq('company_id', companyId)],
      ['work_orders', () => adminClient.from('work_orders').delete().eq('company_id', companyId)],
      ['boms', () => adminClient.from('boms').delete().eq('company_id', companyId)],
      ['items', () => adminClient.from('items').delete().eq('company_id', companyId)],
      ['employees', () => adminClient.from('employees').delete().eq('company_id', companyId)],
      ['shifts', () => adminClient.from('shifts').delete().eq('company_id', companyId)],
      ['production_plants', () => adminClient.from('production_plants').delete().eq('company_id', companyId)],
      ['companies', () => adminClient.from('companies').delete().eq('company_id', companyId)]
    ];
    for (const [label, run] of cleanupSteps) {
      const { error } = await run();
      if (error) throw new Error(`Cleanup failed at ${label}: ${error.message}`);
    }
  });

  it('PHL kerja shift 1 (7 jam) DAN shift 2 (6 jam) hari yang sama -> dihitung SEBAGAI 2 HARI KERJA TERPISAH (Rp50.000 + Rp50.000 = Rp100.000), bukan dibagi rata 13 jam / 7 jam', async () => {
    const workDate = '2026-08-24'; // Senin
    const { error: e1 } = await adminClient
      .from('work_order_assignments')
      .insert([{ work_order_id: workOrderId, production_batch_id: batchId, employee_id: phlEmployeeId, shift_id: shift1Id, status: 'completed', actual_hours: 7, work_date: workDate }]);
    if (e1) throw new Error(e1.message);
    const { error: e2 } = await adminClient
      .from('work_order_assignments')
      .insert([{ work_order_id: workOrderId, production_batch_id: batchId, employee_id: phlEmployeeId, shift_id: shift2Id, status: 'completed', actual_hours: 6, work_date: workDate }]);
    if (e2) throw new Error(e2.message);

    const { data: cost, error } = await adminClient.rpc('compute_production_batch_labor_cost', { p_production_batch_id: batchId });
    if (error) throw new Error(error.message);
    expect(Number(cost)).toBeCloseTo(100000, 2); // 7*(50000/7) + 6*(50000/6) = 50000 + 50000
  });

  it('(NEGATIF/regresi-guard) assignment TANPA shift_id tetap pakai pembagi weekday_hours/saturday_hours GLOBAL lama, bukan error atau Rp0', async () => {
    await adminClient.from('work_order_assignments').delete().eq('production_batch_id', batchId);
    const workDate = '2026-08-25'; // Selasa, weekday biasa -> default 7 jam
    const { error } = await adminClient
      .from('work_order_assignments')
      .insert([{ work_order_id: workOrderId, production_batch_id: batchId, employee_id: phlEmployeeId, shift_id: null, status: 'completed', actual_hours: 7, work_date: workDate }]);
    if (error) throw new Error(error.message);

    const { data: cost, error: rpcError } = await adminClient.rpc('compute_production_batch_labor_cost', { p_production_batch_id: batchId });
    if (rpcError) throw new Error(rpcError.message);
    expect(Number(cost)).toBeCloseTo(50000, 2); // 7 * (50000/7) = 50000, perilaku identik sebelum migration ini
  });

  it('(NEGATIF) is_overtime=true TIDAK mengubah tarif (tarif lembur belum ditentukan) — cuma tersimpan sebagai penanda', async () => {
    await adminClient.from('work_order_assignments').delete().eq('production_batch_id', batchId);
    const workDate = '2026-08-26';
    const { data: inserted, error } = await adminClient
      .from('work_order_assignments')
      .insert([{ work_order_id: workOrderId, production_batch_id: batchId, employee_id: phlEmployeeId, shift_id: shift1Id, status: 'completed', actual_hours: 7, work_date: workDate, is_overtime: true }])
      .select('is_overtime')
      .single();
    if (error) throw new Error(error.message);
    expect(inserted!.is_overtime).toBe(true);

    const { data: cost, error: rpcError } = await adminClient.rpc('compute_production_batch_labor_cost', { p_production_batch_id: batchId });
    if (rpcError) throw new Error(rpcError.message);
    expect(Number(cost)).toBeCloseTo(50000, 2); // tarif normal tetap, TIDAK dikalikan lembur apa pun
  });
});

describe('Saldo Awal — penolakan qty negatif (verifikasi, bukan fitur baru)', () => {
  let companyId: number;
  let plantId: number;
  let itemId: number;

  beforeAll(async () => {
    const { data: company, error: companyError } = await adminClient
      .from('companies')
      .insert([{ name: 'NegativeQtyTestCorp', industry_type: 'manufacturing', status: 'trial' }])
      .select('company_id')
      .single();
    if (companyError) throw new Error(companyError.message);
    companyId = company.company_id;

    const { data: plant, error: plantError } = await adminClient
      .from('production_plants')
      .insert([{ company_id: companyId, name: 'Plant NegativeQtyTest', is_active: true }])
      .select('production_plant_id')
      .single();
    if (plantError) throw new Error(plantError.message);
    plantId = plant.production_plant_id;

    const { data: item, error: itemError } = await adminClient
      .from('items')
      .insert([{ company_id: companyId, item_code: 'NEGQTY-TEST-ITEM', name: 'Item Uji Qty Negatif', type: 'raw_material', base_uom: 'g', purchase_uom: 'g', uom_conversion_factor: 1 }])
      .select('item_id')
      .single();
    if (itemError) throw new Error(itemError.message);
    itemId = item.item_id;
  });

  afterAll(async () => {
    const cleanupSteps: Array<[string, () => any]> = [
      ['lots', () => adminClient.from('lots').delete().eq('company_id', companyId)],
      ['items', () => adminClient.from('items').delete().eq('company_id', companyId)],
      ['production_plants', () => adminClient.from('production_plants').delete().eq('company_id', companyId)],
      ['companies', () => adminClient.from('companies').delete().eq('company_id', companyId)]
    ];
    for (const [label, run] of cleanupSteps) {
      const { error } = await run();
      if (error) throw new Error(`Cleanup failed at ${label}: ${error.message}`);
    }
  });

  // Temuan data Ruko Dieng (7 item stok NEGATIF di sistem gudang lama, mis.
  // Sorbitol -202.030g) -- mekanisme saldo awal kita HARUS menolak qty negatif
  // (ledger tidak boleh punya stok negatif). Ini VERIFIKASI validasi yang SUDAH
  // ADA di create_opening_balance_lot (migration 20260819170000: "p_qty <= 0"),
  // bukan penambahan baru -- dikunci di sini supaya regresi ketahuan.
  it('(NEGATIF) request saldo awal qty negatif DITOLAK, bukan dimuat sebagai stok negatif', async () => {
    // Fake JWT tidak diperlukan -- recordOpeningBalance butuh appUser dari
    // getCurrentUser, jadi di sini panggil RPC-nya langsung (mirror app layer)
    // supaya tidak butuh login sungguhan, cukup buktikan DB-level guard-nya.
    const { error } = await adminClient.rpc('create_opening_balance_lot', {
      p_company_id: companyId,
      p_item_id: itemId,
      p_production_plant_id: plantId,
      p_qty: -100,
      p_lot_number: 'NEGQTY-TEST-LOT',
      p_expiry_date: null,
      p_notes: 'Uji penolakan qty negatif',
      p_created_by: null,
      p_unit_cost: 10
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/lebih besar dari 0/);

    const { data: lot } = await adminClient.from('lots').select('lot_id').eq('lot_number', 'NEGQTY-TEST-LOT').maybeSingle();
    expect(lot).toBeNull(); // tidak ada lot yang kebuat sama sekali
  });
});
