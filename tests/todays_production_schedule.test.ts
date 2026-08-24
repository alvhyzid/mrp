import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { listTodaysProductionBatches } from '../src/features/mrp/server/listTodaysProductionBatches';
import { cleanupCompanyCascade } from './testCompanyCleanup';
import { ensureAuthUser } from './ensureAuthUser';

// Fase Produksi Nyata, P3 — "Jadwal Hari Ini" untuk role Produksi, dengan isolasi
// plant: operator satu plant tidak boleh melihat batch plant lain. Fixture 2
// plant nyata dengan pola sama seperti Karanglo/Ruko Dieng (2 lokasi produksi
// berbeda dalam 1 company), masing-masing dengan operator sendiri yang ter-link
// employees.linked_user_id.

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

function makeRequest(url: string, token: string): NextRequest {
  return new NextRequest(url, { headers: { Authorization: `Bearer ${token}` } });
}

describe('Fase Produksi Nyata P3 — Jadwal Hari Ini dengan isolasi plant', () => {
  let companyId: number;
  let plantAId: number;
  let plantBId: number;
  let itemId: number;
  let workOrderAId: number;
  let workOrderBId: number;
  let batchAId: number;
  let batchBId: number;
  let batchAYesterdayInProgressId: number;

  let operatorAAuthUid: string;
  let operatorAToken: string;
  let operatorBAuthUid: string;
  let operatorBToken: string;
  let unlinkedManagerAuthUid: string;
  let unlinkedManagerToken: string;

  async function getOrCreateAuthUser(email: string, fullName: string) {
    let page = 1;
    while (true) {
      const { data, error } = await adminClient.auth.admin.listUsers({ perPage: 100, page });
      if (error) throw new Error(error.message);
      const found = data?.users?.find((u: any) => u.email === email);
      if (found) return found;
      if (!data?.nextPage) break;
      page += 1;
    }
    // AUD-21 (25 Agu 2026): pembuatan pengguna auth SELALU lewat ensureAuthUser.
    // Bentuk hasilnya sengaja dipertahankan supaya kode di bawahnya tidak ikut berubah;
    // `error` selalu null karena ensureAuthUser sudah menangani "sudah terdaftar" sendiri.
    const { data, error } = {
      data: { user: { id: await ensureAuthUser(adminClient, email, roleTestPassword, { full_name: fullName }) } },
      error: null as { message: string } | null
    };
    if (error) throw new Error(error.message);
    return data.user;
  }

  async function loginToken(email: string): Promise<string> {
    const client: SupabaseClient = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
    const { data, error } = await client.auth.signInWithPassword({ email, password: roleTestPassword! });
    if (error) throw new Error(`Login failed for ${email}: ${error.message}`);
    return data.session.access_token;
  }

  beforeAll(async () => {
    const { data: company, error: companyError } = await adminClient
      .from('companies')
      .insert([{ name: 'TodaysScheduleTestCorp', industry_type: 'manufacturing', status: 'trial' }])
      .select('company_id')
      .single();
    if (companyError) throw new Error(companyError.message);
    companyId = company.company_id;

    const { data: plants, error: plantsError } = await adminClient
      .from('production_plants')
      .insert([
        { company_id: companyId, name: 'Plant A TodaysScheduleTest', is_active: true },
        { company_id: companyId, name: 'Plant B TodaysScheduleTest', is_active: true }
      ])
      .select('production_plant_id, name');
    if (plantsError) throw new Error(plantsError.message);
    plantAId = plants!.find((p) => p.name === 'Plant A TodaysScheduleTest')!.production_plant_id;
    plantBId = plants!.find((p) => p.name === 'Plant B TodaysScheduleTest')!.production_plant_id;

    const operatorAUser = await getOrCreateAuthUser('operatora.todaysscheduletest@debug.mrp', 'Operator A TodaysScheduleTest');
    const operatorBUser = await getOrCreateAuthUser('operatorb.todaysscheduletest@debug.mrp', 'Operator B TodaysScheduleTest');
    const unlinkedManagerUser = await getOrCreateAuthUser('unlinkedmgr.todaysscheduletest@debug.mrp', 'Manager Unlinked TodaysScheduleTest');
    operatorAAuthUid = operatorAUser.id;
    operatorBAuthUid = operatorBUser.id;
    unlinkedManagerAuthUid = unlinkedManagerUser.id;

    const { data: appUsers, error: usersError } = await adminClient
      .from('users')
      .upsert(
        [
          { auth_uid: operatorAAuthUid, company_id: companyId, name: 'Operator A TodaysScheduleTest', email: 'operatora.todaysscheduletest@debug.mrp', role: 'production_staff', status: 'active' },
          { auth_uid: operatorBAuthUid, company_id: companyId, name: 'Operator B TodaysScheduleTest', email: 'operatorb.todaysscheduletest@debug.mrp', role: 'production_staff', status: 'active' },
          { auth_uid: unlinkedManagerAuthUid, company_id: companyId, name: 'Manager Unlinked TodaysScheduleTest', email: 'unlinkedmgr.todaysscheduletest@debug.mrp', role: 'production_manager', status: 'active' }
        ],
        { onConflict: 'auth_uid' }
      )
      .select('user_id, auth_uid');
    if (usersError) throw new Error(usersError.message);
    const operatorAUserId = appUsers!.find((u) => u.auth_uid === operatorAAuthUid)!.user_id;
    const operatorBUserId = appUsers!.find((u) => u.auth_uid === operatorBAuthUid)!.user_id;

    operatorAToken = await loginToken('operatora.todaysscheduletest@debug.mrp');
    operatorBToken = await loginToken('operatorb.todaysscheduletest@debug.mrp');
    unlinkedManagerToken = await loginToken('unlinkedmgr.todaysscheduletest@debug.mrp');

    // Operator A ter-link ke employee di Plant A; Operator B ter-link ke Plant B.
    // Manager sengaja TIDAK ter-link employee manapun (uji "tidak difilter kalau
    // tidak ter-link" -- leadership/akun uji tanpa employee record).
    const { error: employeesError } = await adminClient.from('employees').insert([
      { company_id: companyId, production_plant_id: plantAId, name: 'Operator A TodaysScheduleTest', position: 'Operator', wage_type: 'daily', wage_rate: 100000, linked_user_id: operatorAUserId, is_active: true },
      { company_id: companyId, production_plant_id: plantBId, name: 'Operator B TodaysScheduleTest', position: 'Operator', wage_type: 'daily', wage_rate: 100000, linked_user_id: operatorBUserId, is_active: true }
    ]);
    if (employeesError) throw new Error(employeesError.message);

    const { data: item, error: itemError } = await adminClient
      .from('items')
      .insert([{ company_id: companyId, item_code: 'TODAYSCHED-ITEM', name: 'Item TodaysScheduleTest', type: 'finished_good', base_uom: 'pcs', purchase_uom: 'pcs', uom_conversion_factor: 1 }])
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

    const { data: workOrders, error: woError } = await adminClient
      .from('work_orders')
      .insert([
        { company_id: companyId, production_plant_id: plantAId, item_id: itemId, bom_id: bom.bom_id, planned_qty: 60, status: 'in_progress' },
        { company_id: companyId, production_plant_id: plantBId, item_id: itemId, bom_id: bom.bom_id, planned_qty: 60, status: 'in_progress' }
      ])
      .select('work_order_id, production_plant_id');
    if (woError) throw new Error(woError.message);
    workOrderAId = workOrders!.find((w) => w.production_plant_id === plantAId)!.work_order_id;
    workOrderBId = workOrders!.find((w) => w.production_plant_id === plantBId)!.work_order_id;

    const today = new Date().toISOString().slice(0, 10);
    const { data: batches, error: batchesError } = await adminClient
      .from('production_batches')
      .insert([
        { company_id: companyId, work_order_id: workOrderAId, batch_number: 'TODAYSCHED-A-1', planned_qty: 60, uom: 'pcs', status: 'planned', planned_date: today },
        { company_id: companyId, work_order_id: workOrderBId, batch_number: 'TODAYSCHED-B-1', planned_qty: 60, uom: 'pcs', status: 'planned', planned_date: today },
        // Batch Plant A yang planned_date-nya KEMARIN tapi statusnya masih in_progress
        // -- harus TETAP muncul (belum selesai), bukan cuma yang planned_date persis hari ini.
        { company_id: companyId, work_order_id: workOrderAId, batch_number: 'TODAYSCHED-A-YESTERDAY', planned_qty: 60, uom: 'pcs', status: 'in_progress', planned_date: '2020-01-01' }
      ])
      .select('production_batch_id, batch_number');
    if (batchesError) throw new Error(batchesError.message);
    batchAId = batches!.find((b) => b.batch_number === 'TODAYSCHED-A-1')!.production_batch_id;
    batchBId = batches!.find((b) => b.batch_number === 'TODAYSCHED-B-1')!.production_batch_id;
    batchAYesterdayInProgressId = batches!.find((b) => b.batch_number === 'TODAYSCHED-A-YESTERDAY')!.production_batch_id;
  });

  afterAll(async () => {
    const cleanupSteps: Array<[string, () => any]> = [
      ['production_batches', () => adminClient.from('production_batches').delete().in('work_order_id', [workOrderAId, workOrderBId])],
      // Trigger readiness (worker_absence dkk) membuat system_alerts baru begitu
      // work_orders/batches disentuh -- lihat catatan sama di test file lain sesi ini.
      ['system_alerts', () => adminClient.from('system_alerts').delete().eq('company_id', companyId)],
      ['work_orders', () => adminClient.from('work_orders').delete().eq('company_id', companyId)],
      ['boms', () => adminClient.from('boms').delete().eq('company_id', companyId)],
      ['items', () => adminClient.from('items').delete().eq('company_id', companyId)],
      ['employees', () => adminClient.from('employees').delete().eq('company_id', companyId)],
      ['users', () => adminClient.from('users').delete().eq('company_id', companyId)],
      ['production_plants', () => adminClient.from('production_plants').delete().eq('company_id', companyId)],
      ['auth:operator_a', () => adminClient.auth.admin.deleteUser(operatorAAuthUid)],
      ['auth:operator_b', () => adminClient.auth.admin.deleteUser(operatorBAuthUid)],
      ['auth:unlinked_manager', () => adminClient.auth.admin.deleteUser(unlinkedManagerAuthUid)]
    ];
    await cleanupCompanyCascade(adminClient, companyId, cleanupSteps);
  });

  it('operator Plant A HANYA melihat batch Plant A (termasuk batch kemarin yang masih berjalan), TIDAK melihat batch Plant B', async () => {
    const req = makeRequest('http://localhost/api/production-batches/today', operatorAToken);
    const result = await listTodaysProductionBatches(req);
    expect(result.status).toBe(200);
    const batchIds = (result.body.batches as { production_batch_id: number }[]).map((b) => b.production_batch_id);
    expect(batchIds).toContain(batchAId);
    expect(batchIds).toContain(batchAYesterdayInProgressId);
    expect(batchIds).not.toContain(batchBId);
  });

  it('operator Plant B HANYA melihat batch Plant B, TIDAK melihat batch Plant A (isolasi 2 arah, bukan cuma 1 arah)', async () => {
    const req = makeRequest('http://localhost/api/production-batches/today', operatorBToken);
    const result = await listTodaysProductionBatches(req);
    expect(result.status).toBe(200);
    const batchIds = (result.body.batches as { production_batch_id: number }[]).map((b) => b.production_batch_id);
    expect(batchIds).toContain(batchBId);
    expect(batchIds).not.toContain(batchAId);
    expect(batchIds).not.toContain(batchAYesterdayInProgressId);
  });

  it('manager yang TIDAK ter-link employee manapun melihat batch KEDUA plant (tidak difilter)', async () => {
    const req = makeRequest('http://localhost/api/production-batches/today', unlinkedManagerToken);
    const result = await listTodaysProductionBatches(req);
    expect(result.status).toBe(200);
    expect(result.body.my_plant_id).toBeNull();
    const batchIds = (result.body.batches as { production_batch_id: number }[]).map((b) => b.production_batch_id);
    expect(batchIds).toContain(batchAId);
    expect(batchIds).toContain(batchBId);
  });
});
