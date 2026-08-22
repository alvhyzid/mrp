import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createEmployee } from '../src/features/hr/server/createEmployee';
import { updateEmployee } from '../src/features/hr/server/updateEmployee';
import { listEmployees } from '../src/features/hr/server/listEmployees';
import { learnFromBatch } from '../src/features/mrp/server/learnFromBatch';
import { decideProductionStandardProposal } from '../src/features/mrp/server/decideProductionStandardProposal';
import { getPlanningFeasibility } from '../src/features/mrp/server/getPlanningFeasibility';
import { lockFeasibilityBaseline } from '../src/features/mrp/server/lockFeasibilityBaseline';
import { cleanupCompanyCascade, cleanupStaleFixtureByName } from './testCompanyCleanup';

// Fase Produksi Nyata (19 Agu 2026), PEKERJAAN 1 (create/edit Karyawan lewat UI)
// + PEKERJAAN 2 (pengerasan K8: proposal-approval, median, gerbang kelengkapan,
// snapshot standar per rencana). Fixture perusahaan TERPISAH ("ProduksiNyataTestCorp"),
// pola sama dengan RoleTestCorp di tests/role_hierarchy_financial_access.test.ts.
//
// Server functions dipanggil LANGSUNG (bukan lewat HTTP) dengan NextRequest asli
// (constructible standalone tanpa server Next.js jalan) supaya gerbang role +
// logic bisnis TERUJI PERSIS SEPERTI yang dijalankan API route sungguhan --
// bukan menduplikasi logic-nya di dalam test.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const roleTestPassword = process.env.DEBUG_ROLE_TEST_PASSWORD;

if (!supabaseUrl || !anonKey || !serviceRoleKey || !roleTestPassword) {
  throw new Error(
    'Environment variables NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY and DEBUG_ROLE_TEST_PASSWORD must be set for tests.'
  );
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

function makeRequest(url: string, token: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
}

describe('Fase Produksi Nyata — Employee CRUD (B-1) & K8 standard proposal workflow (D)', () => {
  let companyId: number;
  let plantId: number;

  let hrManagerAuthUid: string;
  let hrManagerToken: string;
  let generalManagerAuthUid: string;
  let generalManagerToken: string;
  let prodStaffAuthUid: string;
  let prodStaffToken: string;
  let ppicManagerAuthUid: string;
  let ppicManagerUserId: number;
  let ppicManagerToken: string;

  let itemId: number;
  let bomId: number;
  let routingId: number;
  let stepMixId: number;
  let stepPackId: number;
  let workOrderId: number;
  const batchIds: number[] = [];

  let feasItemId: number;
  let feasBomId: number;
  let customerId: number;
  let cpoId: number;
  let soId: number;
  let soLineId: number;

  let seedEmployeeId: number;

  async function findAuthUserByEmail(email: string) {
    let page = 1;
    while (true) {
      const { data, error } = await adminClient.auth.admin.listUsers({ perPage: 100, page });
      if (error) throw new Error(`Failed to list auth users: ${error.message}`);
      if (!data?.users?.length) return null;
      const found = data.users.find((u: any) => u.email === email);
      if (found) return found;
      if (!data.nextPage) return null;
      page += 1;
    }
  }

  async function getOrCreateAuthUser(email: string, fullName: string) {
    const existing = await findAuthUserByEmail(email);
    if (existing) return existing;
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password: roleTestPassword,
      email_confirm: true,
      user_metadata: { full_name: fullName }
    });
    if (error) throw new Error(`Failed to create auth user ${email}: ${error.message}`);
    return data.user;
  }

  async function loginToken(email: string): Promise<string> {
    const client: SupabaseClient = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
    const { data, error } = await client.auth.signInWithPassword({ email, password: roleTestPassword! });
    if (error) throw new Error(`Login failed for ${email}: ${error.message}`);
    return data.session.access_token;
  }

  beforeAll(async () => {
    // QA-01 X.2 (22 Agu 2026) -- pembersihan-saat-MULAI: kalau run sebelumnya
    // pernah dimatikan paksa (SIGKILL) di tengah file test ini, sisa dengan
    // nama yang sama disapu bersih di sini SEBELUM fixture baru dibuat --
    // jaminan yang tidak bergantung pada afterAll sempat berjalan atau tidak.
    await cleanupStaleFixtureByName(adminClient, 'ProduksiNyataTestCorp');

    const { data: company, error: companyError } = await adminClient
      .from('companies')
      .insert([{ name: 'ProduksiNyataTestCorp', industry_type: 'manufacturing', status: 'trial' }])
      .select('company_id')
      .single();
    if (companyError) throw new Error(`Failed to create fixture company: ${companyError.message}`);
    companyId = company.company_id;

    const { data: plant, error: plantError } = await adminClient
      .from('production_plants')
      .insert([{ company_id: companyId, name: 'Plant ProduksiNyataTest', is_active: true }])
      .select('production_plant_id')
      .single();
    if (plantError) throw new Error(`Failed to create fixture plant: ${plantError.message}`);
    plantId = plant.production_plant_id;

    const hrManagerUser = await getOrCreateAuthUser('hrmanager.produksinyatatest@debug.mrp', 'HR Manager ProduksiNyataTest');
    const generalManagerUser = await getOrCreateAuthUser('gm.produksinyatatest@debug.mrp', 'General Manager ProduksiNyataTest');
    const prodStaffUser = await getOrCreateAuthUser('prodstaff.produksinyatatest@debug.mrp', 'Production Staff ProduksiNyataTest');
    const ppicManagerUser = await getOrCreateAuthUser('ppicmanager.produksinyatatest@debug.mrp', 'PPIC Manager ProduksiNyataTest');
    hrManagerAuthUid = hrManagerUser.id;
    generalManagerAuthUid = generalManagerUser.id;
    prodStaffAuthUid = prodStaffUser.id;
    ppicManagerAuthUid = ppicManagerUser.id;

    const { data: appUsers, error: appUsersError } = await adminClient
      .from('users')
      .upsert(
        [
          { auth_uid: hrManagerAuthUid, company_id: companyId, name: 'HR Manager ProduksiNyataTest', email: 'hrmanager.produksinyatatest@debug.mrp', role: 'hr_manager', status: 'active' },
          { auth_uid: generalManagerAuthUid, company_id: companyId, name: 'General Manager ProduksiNyataTest', email: 'gm.produksinyatatest@debug.mrp', role: 'general_manager', status: 'active' },
          { auth_uid: prodStaffAuthUid, company_id: companyId, name: 'Production Staff ProduksiNyataTest', email: 'prodstaff.produksinyatatest@debug.mrp', role: 'production_staff', status: 'active' },
          { auth_uid: ppicManagerAuthUid, company_id: companyId, name: 'PPIC Manager ProduksiNyataTest', email: 'ppicmanager.produksinyatatest@debug.mrp', role: 'ppic_manager', status: 'active' }
        ],
        { onConflict: 'auth_uid' }
      )
      .select('user_id, auth_uid');
    if (appUsersError) throw new Error(`Failed to create fixture users: ${appUsersError.message}`);
    ppicManagerUserId = appUsers!.find((u) => u.auth_uid === ppicManagerAuthUid)!.user_id;

    hrManagerToken = await loginToken('hrmanager.produksinyatatest@debug.mrp');
    generalManagerToken = await loginToken('gm.produksinyatatest@debug.mrp');
    prodStaffToken = await loginToken('prodstaff.produksinyatatest@debug.mrp');
    ppicManagerToken = await loginToken('ppicmanager.produksinyatatest@debug.mrp');

    // --- Fixture item + BOM + routing (2 tahap: Mixing, Packing) untuk K8 ---
    const { data: item, error: itemError } = await adminClient
      .from('items')
      .insert([{ company_id: companyId, item_code: 'K8TEST-ITEM', name: 'Item K8 Test', type: 'finished_good', base_uom: 'pcs', purchase_uom: 'pcs', uom_conversion_factor: 1 }])
      .select('item_id')
      .single();
    if (itemError) throw new Error(`Failed to create fixture item: ${itemError.message}`);
    itemId = item.item_id;

    const { data: bom, error: bomError } = await adminClient
      .from('boms')
      .insert([{ company_id: companyId, parent_item_id: itemId, version: 1, standard_yield_qty: 1, standard_yield_uom: 'pcs', status: 'active' }])
      .select('bom_id')
      .single();
    if (bomError) throw new Error(`Failed to create fixture bom: ${bomError.message}`);
    bomId = bom.bom_id;

    const { data: routing, error: routingError } = await adminClient.from('routings').insert([{ company_id: companyId, item_id: itemId, version: 1 }]).select('routing_id').single();
    if (routingError) throw new Error(`Failed to create fixture routing: ${routingError.message}`);
    routingId = routing.routing_id;

    const { data: steps, error: stepsError } = await adminClient
      .from('routing_steps')
      .insert([
        { routing_id: routingId, sequence_no: 1, step_name: 'Mixing', active_duration_minutes: 60 },
        { routing_id: routingId, sequence_no: 2, step_name: 'Packing', active_duration_minutes: 30 }
      ])
      .select('routing_step_id, sequence_no');
    if (stepsError) throw new Error(`Failed to create fixture routing steps: ${stepsError.message}`);
    stepMixId = steps!.find((s) => s.sequence_no === 1)!.routing_step_id;
    stepPackId = steps!.find((s) => s.sequence_no === 2)!.routing_step_id;

    const { data: wo, error: woError } = await adminClient
      .from('work_orders')
      .insert([{ company_id: companyId, production_plant_id: plantId, item_id: itemId, bom_id: bomId, routing_id: routingId, planned_qty: 100, status: 'in_progress' }])
      .select('work_order_id')
      .single();
    if (woError) throw new Error(`Failed to create fixture work order: ${woError.message}`);
    workOrderId = wo.work_order_id;

    // 5 batch LENGKAP (dipakai uji median) + output main_output [98,99,101,102,50]
    // (1 nilai ekstrem) -- 1 batch TIDAK LENGKAP (dipakai uji gerbang kelengkapan).
    const outputQtys = [98, 99, 101, 102, 50];
    for (let i = 0; i < outputQtys.length; i++) {
      const { data: batch, error: batchError } = await adminClient
        .from('production_batches')
        .insert([{ company_id: companyId, work_order_id: workOrderId, batch_number: `K8TEST-BATCH-${i + 1}`, planned_qty: 100, uom: 'pcs', status: 'completed' }])
        .select('production_batch_id')
        .single();
      if (batchError) throw new Error(`Failed to create fixture batch ${i}: ${batchError.message}`);
      const batchId = batch.production_batch_id;
      batchIds.push(batchId);

      const startedAt = new Date('2026-08-19T00:00:00Z');
      const mixCompletedAt = new Date(startedAt.getTime() + 60 * 60000);
      const packCompletedAt = new Date(mixCompletedAt.getTime() + 30 * 60000);

      const { error: progressError } = await adminClient.from('work_order_step_progress').insert([
        {
          work_order_id: workOrderId,
          production_batch_id: batchId,
          routing_step_id: stepMixId,
          status: 'completed',
          qty_input: 100,
          uom_input: 'pcs',
          qty_recorded: 95,
          uom: 'pcs',
          started_at: startedAt.toISOString(),
          completed_at: mixCompletedAt.toISOString()
        },
        {
          work_order_id: workOrderId,
          production_batch_id: batchId,
          routing_step_id: stepPackId,
          status: 'completed',
          qty_input: 95,
          uom_input: 'pcs',
          qty_recorded: outputQtys[i],
          uom: 'pcs',
          started_at: mixCompletedAt.toISOString(),
          completed_at: packCompletedAt.toISOString()
        }
      ]);
      if (progressError) throw new Error(`Failed to create fixture step progress for batch ${i}: ${progressError.message}`);

      const { error: outputError } = await adminClient
        .from('work_order_outputs')
        .insert([{ work_order_id: workOrderId, production_batch_id: batchId, item_id: itemId, output_type: 'main_output', qty: outputQtys[i] }]);
      if (outputError) throw new Error(`Failed to create fixture output for batch ${i}: ${outputError.message}`);
    }

    // Batch ke-6: TIDAK LENGKAP -- tahap Mixing selesai, Packing TIDAK PERNAH dicatat.
    const { data: incompleteBatch, error: incompleteBatchError } = await adminClient
      .from('production_batches')
      .insert([{ company_id: companyId, work_order_id: workOrderId, batch_number: 'K8TEST-BATCH-INCOMPLETE', planned_qty: 100, uom: 'pcs', status: 'in_progress' }])
      .select('production_batch_id')
      .single();
    if (incompleteBatchError) throw new Error(`Failed to create incomplete fixture batch: ${incompleteBatchError.message}`);
    batchIds.push(incompleteBatch.production_batch_id);
    const { error: incompleteProgressError } = await adminClient
      .from('work_order_step_progress')
      .insert([{ work_order_id: workOrderId, production_batch_id: incompleteBatch.production_batch_id, routing_step_id: stepMixId, status: 'completed', qty_input: 100, uom_input: 'pcs', qty_recorded: 95, uom: 'pcs' }]);
    if (incompleteProgressError) throw new Error(`Failed to create incomplete fixture progress: ${incompleteProgressError.message}`);

    // Baseline standar ESTIMASI_MANUAL (dipakai buktikan flip TIDAK otomatis).
    const { error: standardError } = await adminClient
      .from('production_standards')
      .insert([{ company_id: companyId, item_id: itemId, metric_key: 'unit_per_batch', value: 100, source: 'ESTIMASI_MANUAL', sample_count: 0 }]);
    if (standardError) throw new Error(`Failed to create baseline standard: ${standardError.message}`);

    // --- Fixture terpisah untuk uji snapshot D-4 (feasibility) ---
    const { data: feasItem, error: feasItemError } = await adminClient
      .from('items')
      .insert([{ company_id: companyId, item_code: 'K8TEST-FEAS-ITEM', name: 'Item Feasibility K8 Test', type: 'finished_good', base_uom: 'pcs', purchase_uom: 'pcs', uom_conversion_factor: 1 }])
      .select('item_id')
      .single();
    if (feasItemError) throw new Error(`Failed to create fixture feas item: ${feasItemError.message}`);
    feasItemId = feasItem.item_id;

    const { data: feasBom, error: feasBomError } = await adminClient
      .from('boms')
      .insert([{ company_id: companyId, parent_item_id: feasItemId, version: 1, standard_yield_qty: 1, standard_yield_uom: 'pcs', status: 'active' }])
      .select('bom_id')
      .single();
    if (feasBomError) throw new Error(`Failed to create fixture feas bom: ${feasBomError.message}`);
    feasBomId = feasBom.bom_id;

    const { error: feasStandardsError } = await adminClient.from('production_standards').insert([
      { company_id: companyId, item_id: feasItemId, metric_key: 'unit_per_batch', value: 100, source: 'ESTIMASI_MANUAL', sample_count: 0 },
      { company_id: companyId, item_id: feasItemId, metric_key: 'batches_per_day', value: 4, source: 'ESTIMASI_MANUAL', sample_count: 0 }
    ]);
    if (feasStandardsError) throw new Error(`Failed to create feas standards: ${feasStandardsError.message}`);

    const { data: customer, error: customerError } = await adminClient.from('customers').insert([{ company_id: companyId, name: 'Customer K8Test' }]).select('customer_id').single();
    if (customerError) throw new Error(`Failed to create fixture customer: ${customerError.message}`);
    customerId = customer.customer_id;

    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { data: cpo, error: cpoError } = await adminClient
      .from('customer_purchase_orders')
      .insert([{ company_id: companyId, customer_id: customerId, po_number: 'K8TEST-PO-1', requested_ship_date: futureDate, status: 'processed' }])
      .select('customer_purchase_order_id')
      .single();
    if (cpoError) throw new Error(`Failed to create fixture cpo: ${cpoError.message}`);
    cpoId = cpo.customer_purchase_order_id;

    const { data: so, error: soError } = await adminClient
      .from('sales_orders')
      .insert([{ company_id: companyId, customer_purchase_order_id: cpoId, customer_id: customerId, production_plant_id: plantId, status: 'confirmed' }])
      .select('sales_order_id')
      .single();
    if (soError) throw new Error(`Failed to create fixture so: ${soError.message}`);
    soId = so.sales_order_id;

    const { data: soLine, error: soLineError } = await adminClient
      .from('sales_order_lines')
      .insert([{ sales_order_id: soId, item_id: feasItemId, qty_ordered: 500, unit_price: 1000 }])
      .select('sales_order_line_id')
      .single();
    if (soLineError) throw new Error(`Failed to create fixture so line: ${soLineError.message}`);
    soLineId = soLine.sales_order_line_id;

    // --- Fixture karyawan (dipakai uji nonaktifkan-bukan-hapus) ---
    const { data: seedEmployee, error: seedEmployeeError } = await adminClient
      .from('employees')
      .insert([{ company_id: companyId, production_plant_id: plantId, name: 'Karyawan Seed ProduksiNyataTest', position: 'Operator', department: 'production', wage_type: 'daily', wage_rate: 150000, is_active: true }])
      .select('employee_id')
      .single();
    if (seedEmployeeError) throw new Error(`Failed to create fixture employee: ${seedEmployeeError.message}`);
    seedEmployeeId = seedEmployee.employee_id;

    const { error: assignmentError } = await adminClient.from('work_order_assignments').insert([{ work_order_id: workOrderId, employee_id: seedEmployeeId, status: 'completed', actual_hours: 8 }]);
    if (assignmentError) throw new Error(`Failed to create fixture assignment: ${assignmentError.message}`);
  });

  afterAll(async () => {
    const cleanupSteps: Array<[string, () => any]> = [
      ['production_standard_exclusions', () => adminClient.from('production_standard_exclusions').delete().eq('company_id', companyId)],
      ['production_standard_proposals', () => adminClient.from('production_standard_proposals').delete().eq('company_id', companyId)],
      ['production_standard_samples', () => adminClient.from('production_standard_samples').delete().eq('company_id', companyId)],
      ['production_standards', () => adminClient.from('production_standards').delete().eq('company_id', companyId)],
      ['sales_order_line_feasibility_snapshots', () => adminClient.from('sales_order_line_feasibility_snapshots').delete().eq('company_id', companyId)],
      ['sales_order_lines', () => adminClient.from('sales_order_lines').delete().eq('sales_order_id', soId)],
      ['sales_orders', () => adminClient.from('sales_orders').delete().eq('company_id', companyId)],
      // customer_po_approvals dibuat OTOMATIS oleh trigger saat CPO status='processed'
      // di-insert (bukan cuma lewat alur app process_customer_purchase_order()) --
      // ditemukan lewat percobaan sungguhan di sini, pola sama dengan temuan
      // system_alerts/worker_absence di scripts/cleanup-demo-data.js sesi sebelumnya.
      ['customer_po_approvals', () => adminClient.from('customer_po_approvals').delete().eq('customer_purchase_order_id', cpoId)],
      ['customer_purchase_orders', () => adminClient.from('customer_purchase_orders').delete().eq('company_id', companyId)],
      ['customers', () => adminClient.from('customers').delete().eq('company_id', companyId)],
      ['work_order_assignments', () => adminClient.from('work_order_assignments').delete().eq('work_order_id', workOrderId)],
      ['work_order_step_progress', () => adminClient.from('work_order_step_progress').delete().eq('work_order_id', workOrderId)],
      ['work_order_outputs', () => adminClient.from('work_order_outputs').delete().eq('work_order_id', workOrderId)],
      ['production_batches', () => adminClient.from('production_batches').delete().eq('work_order_id', workOrderId)],
      // system_alerts: trigger readiness (worker_absence dkk, lihat catatan sama di
      // scripts/cleanup-demo-data.js) membuat alert BARU begitu work_order_assignments
      // dihapus di atas -- harus dibersihkan LAGI tepat sebelum hapus work_orders.
      ['system_alerts (pass 2)', () => adminClient.from('system_alerts').delete().eq('company_id', companyId)],
      ['work_orders', () => adminClient.from('work_orders').delete().eq('company_id', companyId)],
      ['routing_steps', () => adminClient.from('routing_steps').delete().eq('routing_id', routingId)],
      ['routings', () => adminClient.from('routings').delete().eq('company_id', companyId)],
      ['boms', () => adminClient.from('boms').delete().eq('company_id', companyId)],
      ['items', () => adminClient.from('items').delete().eq('company_id', companyId)],
      ['employees', () => adminClient.from('employees').delete().eq('company_id', companyId)],
      ['users', () => adminClient.from('users').delete().eq('company_id', companyId)],
      ['production_plants', () => adminClient.from('production_plants').delete().eq('company_id', companyId)],
      ['auth:hr_manager', () => adminClient.auth.admin.deleteUser(hrManagerAuthUid)],
      ['auth:general_manager', () => adminClient.auth.admin.deleteUser(generalManagerAuthUid)],
      ['auth:prod_staff', () => adminClient.auth.admin.deleteUser(prodStaffAuthUid)],
      ['auth:ppic_manager', () => adminClient.auth.admin.deleteUser(ppicManagerAuthUid)]
    ];
    await cleanupCompanyCascade(adminClient, companyId, cleanupSteps);
  });

  // ============================================================
  // PEKERJAAN 1 — Employee CRUD
  // ============================================================

  it('(a, positif) hr_manager: tambah karyawan baru berhasil, langsung muncul di listEmployees', async () => {
    const req = makeRequest('http://localhost/api/employees', hrManagerToken, 'POST', {
      name: 'Karyawan Baru ProduksiNyataTest',
      position: 'Operator Produksi',
      department: 'production',
      production_plant_id: plantId,
      wage_type: 'daily',
      wage_rate: 160000,
      is_active: true
    });
    const result = await createEmployee(req);
    expect(result.status).toBe(200);

    const listReq = makeRequest('http://localhost/api/employees', hrManagerToken, 'GET');
    const listResult = await listEmployees(listReq);
    expect(listResult.status).toBe(200);
    const created = (listResult.body.employees as any[]).find((e) => e.name === 'Karyawan Baru ProduksiNyataTest');
    expect(created).toBeTruthy();
    expect(created.is_active).toBe(true);
    expect(created.wage_rate).toBe(160000); // hr_manager berhak lihat gaji
  });

  it('(b, negatif) general_manager: coba TAMBAH karyawan -> 403 (bukan role HR)', async () => {
    const req = makeRequest('http://localhost/api/employees', generalManagerToken, 'POST', {
      name: 'Harus Gagal', wage_type: 'daily', wage_rate: 100000
    });
    const result = await createEmployee(req);
    expect(result.status).toBe(403);
  });

  it('(b, negatif) general_manager: coba UBAH gaji karyawan yang ada -> 403', async () => {
    const req = makeRequest('http://localhost/api/employees', generalManagerToken, 'PATCH', {
      employee_id: seedEmployeeId, name: 'Karyawan Seed ProduksiNyataTest', wage_type: 'daily', wage_rate: 999999
    });
    const result = await updateEmployee(req);
    expect(result.status).toBe(403);
  });

  it('(b, negatif) general_manager: employees_secure -> wage_rate ter-mask null (tidak bisa LIHAT gaji individual)', async () => {
    const client: SupabaseClient = createClient(supabaseUrl!, anonKey!, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${generalManagerToken}` } }
    });
    const { data, error } = await client.from('employees_secure').select('wage_rate').eq('employee_id', seedEmployeeId).single();
    expect(error).toBeNull();
    expect(data!.wage_rate).toBeNull();
  });

  it('(c, negatif) production_staff: coba tambah & ubah karyawan -> 403 keduanya', async () => {
    const createReq = makeRequest('http://localhost/api/employees', prodStaffToken, 'POST', { name: 'Harus Gagal 2', wage_type: 'daily', wage_rate: 100000 });
    expect((await createEmployee(createReq)).status).toBe(403);

    const updateReq = makeRequest('http://localhost/api/employees', prodStaffToken, 'PATCH', { employee_id: seedEmployeeId, name: 'X', wage_type: 'daily', wage_rate: 1 });
    expect((await updateEmployee(updateReq)).status).toBe(403);
  });

  it('(d) hr_manager: nonaktifkan karyawan yang punya labor log -> sukses, riwayat assignment TETAP UTUH', async () => {
    const req = makeRequest('http://localhost/api/employees', hrManagerToken, 'PATCH', {
      employee_id: seedEmployeeId,
      name: 'Karyawan Seed ProduksiNyataTest',
      department: 'production',
      wage_type: 'daily',
      wage_rate: 150000,
      is_active: false
    });
    const result = await updateEmployee(req);
    expect(result.status).toBe(200);

    const { data: employee } = await adminClient.from('employees').select('is_active').eq('employee_id', seedEmployeeId).single();
    expect(employee!.is_active).toBe(false);

    const { data: assignments, error } = await adminClient.from('work_order_assignments').select('work_order_assignment_id, employee_id, actual_hours').eq('employee_id', seedEmployeeId);
    expect(error).toBeNull();
    expect(assignments).toHaveLength(1);
    expect(Number(assignments![0].actual_hours)).toBe(8);
  });

  // ============================================================
  // PEKERJAAN 2 — K8 hardening
  // ============================================================

  it('(b, negatif) batch dengan log tahap TIDAK lengkap -> DIKECUALIKAN, dilaporkan, TIDAK jadi sampel', async () => {
    const incompleteBatchId = batchIds[batchIds.length - 1];
    const req = makeRequest('http://localhost/api/production-batches/learn-standard-sample', prodStaffToken, 'POST', { production_batch_id: incompleteBatchId });
    const result = await learnFromBatch(req);
    expect(result.status).toBe(200);
    expect(result.body.excluded).toBe(true);
    expect(result.body.missing_routing_step_ids).toEqual([stepPackId]);

    const { data: exclusions } = await adminClient.from('production_standard_exclusions').select('*').eq('production_batch_id', incompleteBatchId);
    expect(exclusions).toHaveLength(1);

    const { data: proposalsForThisBatch } = await adminClient.from('production_standard_proposals').select('*').eq('company_id', companyId).eq('metric_key', 'unit_per_batch');
    expect(proposalsForThisBatch ?? []).toHaveLength(0); // belum ada usulan sama sekali di titik ini
  });

  it('(a+d) 5 batch lengkap (1 nilai ekstrem) -> usulan MEDIAN dibuat, standar TETAP ESTIMASI_MANUAL sampai disahkan', async () => {
    for (const batchId of batchIds.slice(0, 5)) {
      const req = makeRequest('http://localhost/api/production-batches/learn-standard-sample', prodStaffToken, 'POST', { production_batch_id: batchId });
      const result = await learnFromBatch(req);
      expect(result.status).toBe(200);
      expect(result.body.excluded).toBe(false);
    }

    // Standar TETAP ESTIMASI_MANUAL/value=100 -- flip TIDAK terjadi otomatis.
    const { data: standard } = await adminClient.from('production_standards').select('value, source, sample_count').eq('company_id', companyId).eq('item_id', itemId).eq('metric_key', 'unit_per_batch').single();
    expect(standard!.source).toBe('ESTIMASI_MANUAL');
    expect(Number(standard!.value)).toBe(100);

    // Usulan pending: median dari [98,99,101,102,50] = 99 (BUKAN mean=90 yang tertarik nilai ekstrem 50).
    const { data: proposal } = await adminClient
      .from('production_standard_proposals')
      .select('*')
      .eq('company_id', companyId)
      .eq('item_id', itemId)
      .eq('metric_key', 'unit_per_batch')
      .eq('status', 'pending')
      .single();
    expect(proposal!.calculation_method).toBe('median');
    expect(Number(proposal!.proposed_value)).toBe(99);
    expect(proposal!.sample_count).toBe(5);
  });

  it('(negatif) production_staff (boleh propose, TIDAK boleh decide): coba sahkan usulan -> 403', async () => {
    const { data: proposal } = await adminClient
      .from('production_standard_proposals')
      .select('production_standard_proposal_id')
      .eq('company_id', companyId)
      .eq('item_id', itemId)
      .eq('metric_key', 'unit_per_batch')
      .eq('status', 'pending')
      .single();
    const req = makeRequest('http://localhost/api/production-standards/proposals/decide', prodStaffToken, 'POST', {
      production_standard_proposal_id: proposal!.production_standard_proposal_id,
      decision: 'approved'
    });
    const result = await decideProductionStandardProposal(req);
    expect(result.status).toBe(403);
  });

  it('ppic_manager (planner): sahkan usulan -> standar berubah jadi DIPELAJARI/99, tercatat siapa & kapan', async () => {
    const { data: proposal } = await adminClient
      .from('production_standard_proposals')
      .select('production_standard_proposal_id')
      .eq('company_id', companyId)
      .eq('item_id', itemId)
      .eq('metric_key', 'unit_per_batch')
      .eq('status', 'pending')
      .single();
    const req = makeRequest('http://localhost/api/production-standards/proposals/decide', ppicManagerToken, 'POST', {
      production_standard_proposal_id: proposal!.production_standard_proposal_id,
      decision: 'approved'
    });
    const result = await decideProductionStandardProposal(req);
    expect(result.status).toBe(200);

    const { data: standard } = await adminClient
      .from('production_standards')
      .select('value, source, last_approved_by, last_approved_at')
      .eq('company_id', companyId)
      .eq('item_id', itemId)
      .eq('metric_key', 'unit_per_batch')
      .single();
    expect(standard!.source).toBe('DIPELAJARI');
    expect(Number(standard!.value)).toBe(99);
    expect(standard!.last_approved_by).toBe(ppicManagerUserId);
    expect(standard!.last_approved_at).not.toBeNull();
  });

  it('REGRESI KEAMANAN: propose_production_standard() & decide_production_standard_proposal() TIDAK BISA dipanggil langsung lewat RPC oleh anon key ATAU authenticated biasa (harus lewat app layer/service_role saja)', async () => {
    // Ditemukan sungguhan sesi ini: migration 20260819110000 menulis "grant execute
    // ... to service_role" tapi TIDAK "revoke ... from public" -- Postgres diam-diam
    // tetap membiarkan PUBLIC (termasuk anon) menjalankan fungsi itu, yang berarti
    // siapa pun bisa mengesahkan/menolak usulan standar produksi TANPA login sama
    // sekali, dan memalsukan p_user_id (kolom decided_by) jadi siapa saja. Ditambal
    // di migration 20260819130000 (revoke eksplisit dari public/anon/authenticated).
    // Test ini mengunci perbaikannya supaya tidak diam-diam regresi lagi.
    const anonClient: SupabaseClient = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
    const anonResult = await anonClient.rpc('decide_production_standard_proposal', { p_proposal_id: 999999999, p_decision: 'approved', p_user_id: 1 });
    expect(anonResult.error).not.toBeNull();
    expect(anonResult.error!.code).toBe('42501'); // permission denied -- BUKAN pesan bisnis ("usulan tidak ditemukan")

    const authedClient: SupabaseClient = createClient(supabaseUrl!, anonKey!, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${ppicManagerToken}` } }
    });
    const authedResult = await authedClient.rpc('decide_production_standard_proposal', { p_proposal_id: 999999999, p_decision: 'approved', p_user_id: 1 });
    expect(authedResult.error).not.toBeNull();
    expect(authedResult.error!.code).toBe('42501'); // ppic_manager SUNGGUHAN pun tetap ditolak lewat jalur RPC langsung

    const anonProposeResult = await anonClient.rpc('propose_production_standard', { p_company_id: companyId, p_item_id: itemId, p_routing_step_id: null, p_metric_key: 'unit_per_batch', p_new_sample: 1 });
    expect(anonProposeResult.error).not.toBeNull();
    expect(anonProposeResult.error!.code).toBe('42501');
  });

  it('(c) snapshot standar per rencana: standar berubah SETELAH rencana dikunci -> angka rencana lama TIDAK berubah, muncul standard_drift', async () => {
    const req1 = makeRequest(`http://localhost/api/sales-order-lines/${soLineId}/planning-feasibility`, generalManagerToken, 'GET');
    // getPlanningFeasibility menerima (request, salesOrderLineId) langsung, bukan lewat routing param.
    const result1 = await getPlanningFeasibility(req1, soLineId);
    expect(result1.status).toBe(200);
    expect(result1.body.batches_needed).toBe(5); // 500 qty / 100 unit_per_batch
    expect(result1.body.standard_drift).toBeNull();
    // Sesi 0C (21 Agu 2026): membaca TIDAK LAGI mengunci -- rencana harus dikunci
    // lewat aksi eksplisit terpisah sebelum standard_snapshot_taken_at terisi.
    expect(result1.body.locked).toBe(false);
    expect(result1.body.standard_snapshot_taken_at).toBeNull();

    const lockReq = makeRequest('http://localhost/api/sales-order-lines/feasibility-baseline-lock', generalManagerToken, 'POST', { sales_order_line_id: soLineId });
    const lockResult = await lockFeasibilityBaseline(lockReq);
    expect(lockResult.status).toBe(200);

    const req1b = makeRequest(`http://localhost/api/sales-order-lines/${soLineId}/planning-feasibility`, generalManagerToken, 'GET');
    const result1b = await getPlanningFeasibility(req1b, soLineId);
    expect(result1b.body.locked).toBe(true);
    const snapshotTakenAt = result1b.body.standard_snapshot_taken_at;
    expect(snapshotTakenAt).toBeTruthy();

    // Standar berubah SETELAH rencana ini dihitung (simulasi hasil belajar/pin manual).
    const { error: changeError } = await adminClient
      .from('production_standards')
      .update({ value: 50 })
      .eq('company_id', companyId)
      .eq('item_id', feasItemId)
      .eq('metric_key', 'unit_per_batch');
    expect(changeError).toBeNull();

    const req2 = makeRequest(`http://localhost/api/sales-order-lines/${soLineId}/planning-feasibility`, generalManagerToken, 'GET');
    const result2 = await getPlanningFeasibility(req2, soLineId);
    expect(result2.status).toBe(200);
    // Angka rencana TETAP pakai standar lama (100), TIDAK diam-diam berubah ke 50.
    expect(result2.body.batches_needed).toBe(5);
    expect(result2.body.standard_snapshot_taken_at).toBe(snapshotTakenAt);
    // Tapi dampaknya DIBERITAHU.
    const drift = result2.body.standard_drift as any;
    expect(drift).not.toBeNull();
    expect(drift.unit_per_batch.used_in_plan).toBe(100);
    expect(drift.unit_per_batch.current).toBe(50);
  });
});
