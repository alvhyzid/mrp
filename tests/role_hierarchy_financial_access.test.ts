import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

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

// Fixture perusahaan TERPISAH dari Company A/B debug tenant, mengikuti pola
// SuperAdminCorp di tests/super_admin.test.ts — semua dibuat di beforeAll dan
// dibersihkan total di afterAll, tidak pernah menumpuk data uji permanen.
describe('role hierarchy & financial-access RLS verification', () => {
  let companyId: number;
  let plantId: number;
  let itemId: number;
  let bomId: number;
  let workOrderId: number;
  let lotId: number;
  let employee1Id: number; // linked ke prodStaffAuthUid
  let employee2Id: number; // TIDAK terhubung ke user manapun ("karyawan lain")

  let financeAuthUid: string;
  let hrAuthUid: string;
  let prodStaffAuthUid: string;
  let prodManagerAuthUid: string;

  const EMPLOYEE1_WAGE = 200000;
  const EMPLOYEE2_WAGE = 175000;

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

  async function getOrCreateAuthUser(email: string, password: string, fullName: string) {
    const existing = await findAuthUserByEmail(email);
    if (existing) return existing;
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName }
    });
    if (error) throw new Error(`Failed to create auth user ${email}: ${error.message}`);
    return data.user;
  }

  async function signInAs(email: string): Promise<SupabaseClient> {
    const client = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
    const { data, error } = await client.auth.signInWithPassword({ email, password: roleTestPassword! });
    if (error) throw new Error(`Login failed for ${email}: ${error.message}`);
    return createClient(supabaseUrl!, anonKey!, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${data.session.access_token}` } }
    });
  }

  beforeAll(async () => {
    const { data: company, error: companyError } = await adminClient
      .from('companies')
      .insert([{ name: 'RoleTestCorp', industry_type: 'manufacturing', status: 'trial' }])
      .select('company_id')
      .single();
    if (companyError) throw new Error(`Failed to create fixture company: ${companyError.message}`);
    companyId = company.company_id;

    const { data: plant, error: plantError } = await adminClient
      .from('production_plants')
      .insert([{ company_id: companyId, name: 'Plant RoleTest', is_active: true }])
      .select('production_plant_id')
      .single();
    if (plantError) throw new Error(`Failed to create fixture plant: ${plantError.message}`);
    plantId = plant.production_plant_id;

    const financeUser = await getOrCreateAuthUser('finance.roletest@debug.mrp', roleTestPassword, 'Finance RoleTest');
    const hrUser = await getOrCreateAuthUser('hr.roletest@debug.mrp', roleTestPassword, 'HR RoleTest');
    const prodStaffUser = await getOrCreateAuthUser('prodstaff.roletest@debug.mrp', roleTestPassword, 'Production Staff RoleTest');
    const prodManagerUser = await getOrCreateAuthUser('prodmanager.roletest@debug.mrp', roleTestPassword, 'Production Manager RoleTest');
    financeAuthUid = financeUser.id;
    hrAuthUid = hrUser.id;
    prodStaffAuthUid = prodStaffUser.id;
    prodManagerAuthUid = prodManagerUser.id;

    const { data: appUsers, error: appUsersError } = await adminClient
      .from('users')
      .upsert(
        [
          { auth_uid: financeAuthUid, company_id: companyId, name: 'Finance RoleTest', email: 'finance.roletest@debug.mrp', role: 'finance_manager', status: 'active' },
          { auth_uid: hrAuthUid, company_id: companyId, name: 'HR RoleTest', email: 'hr.roletest@debug.mrp', role: 'hr_manager', status: 'active' },
          { auth_uid: prodStaffAuthUid, company_id: companyId, name: 'Production Staff RoleTest', email: 'prodstaff.roletest@debug.mrp', role: 'production_staff', status: 'active' },
          { auth_uid: prodManagerAuthUid, company_id: companyId, name: 'Production Manager RoleTest', email: 'prodmanager.roletest@debug.mrp', role: 'production_manager', status: 'active' }
        ],
        { onConflict: 'auth_uid' }
      )
      .select('user_id, auth_uid');
    if (appUsersError) throw new Error(`Failed to create fixture users: ${appUsersError.message}`);
    const prodStaffUserId = appUsers!.find((u) => u.auth_uid === prodStaffAuthUid)!.user_id;

    const { data: employee1, error: emp1Error } = await adminClient
      .from('employees')
      .insert([{ company_id: companyId, production_plant_id: plantId, name: 'Operator RoleTest 1', position: 'Operator Produksi', wage_type: 'daily', wage_rate: EMPLOYEE1_WAGE, linked_user_id: prodStaffUserId, is_active: true }])
      .select('employee_id')
      .single();
    if (emp1Error) throw new Error(`Failed to create employee1: ${emp1Error.message}`);
    employee1Id = employee1.employee_id;

    const { data: employee2, error: emp2Error } = await adminClient
      .from('employees')
      .insert([{ company_id: companyId, production_plant_id: plantId, name: 'Operator RoleTest 2 (rekan kerja)', position: 'Operator Produksi', wage_type: 'daily', wage_rate: EMPLOYEE2_WAGE, linked_user_id: null, is_active: true }])
      .select('employee_id')
      .single();
    if (emp2Error) throw new Error(`Failed to create employee2: ${emp2Error.message}`);
    employee2Id = employee2.employee_id;

    const { data: item, error: itemError } = await adminClient
      .from('items')
      .insert([{ company_id: companyId, item_code: 'ROLETEST-ITEM', name: 'Item RoleTest', type: 'raw_material', base_uom: 'g', purchase_uom: 'g', uom_conversion_factor: 1 }])
      .select('item_id')
      .single();
    if (itemError) throw new Error(`Failed to create fixture item: ${itemError.message}`);
    itemId = item.item_id;

    const { data: bom, error: bomError } = await adminClient
      .from('boms')
      .insert([{ company_id: companyId, parent_item_id: itemId, version: 1, standard_yield_qty: 1, standard_yield_uom: 'g', status: 'active' }])
      .select('bom_id')
      .single();
    if (bomError) throw new Error(`Failed to create fixture bom: ${bomError.message}`);
    bomId = bom.bom_id;

    const { data: workOrder, error: woError } = await adminClient
      .from('work_orders')
      .insert([{ company_id: companyId, production_plant_id: plantId, item_id: itemId, bom_id: bomId, planned_qty: 10, status: 'planned' }])
      .select('work_order_id')
      .single();
    if (woError) throw new Error(`Failed to create fixture work order: ${woError.message}`);
    workOrderId = workOrder.work_order_id;

    const { error: assignmentError } = await adminClient
      .from('work_order_assignments')
      .insert([{ work_order_id: workOrderId, employee_id: employee1Id, status: 'completed', actual_hours: 8 }]);
    if (assignmentError) throw new Error(`Failed to create fixture assignment: ${assignmentError.message}`);

    const { data: lot, error: lotError } = await adminClient
      .from('lots')
      .insert([{ company_id: companyId, production_plant_id: plantId, item_id: itemId, lot_number: 'LOT-ROLETEST-1', quantity_on_hand: 100, source_type: 'purchased', status: 'available' }])
      .select('lot_id')
      .single();
    if (lotError) throw new Error(`Failed to create fixture lot: ${lotError.message}`);
    lotId = lot.lot_id;
  });

  afterAll(async () => {
    // Urutan mengikuti arah foreign key (anak sebelum induk). stock_movements dibuat
    // otomatis oleh trigger saat work_order_consumption di-insert (lihat migration
    // 20260812155500) — sempat lupa dihapus di sini pada percobaan pertama, yang
    // menyebabkan delete lots gagal diam-diam dan RoleTestCorp tertinggal. Setiap
    // langkah sekarang mengecek error supaya kegagalan tidak lagi senyap.
    const cleanupSteps: Array<[string, () => any]> = [
      ['stock_movements', () => adminClient.from('stock_movements').delete().eq('company_id', companyId)],
      ['work_order_consumption', () => adminClient.from('work_order_consumption').delete().eq('work_order_id', workOrderId)],
      ['work_order_assignments', () => adminClient.from('work_order_assignments').delete().eq('work_order_id', workOrderId)],
      ['system_alerts', () => adminClient.from('system_alerts').delete().eq('company_id', companyId)],
      ['lots', () => adminClient.from('lots').delete().eq('company_id', companyId)],
      ['work_orders', () => adminClient.from('work_orders').delete().eq('company_id', companyId)],
      ['boms', () => adminClient.from('boms').delete().eq('company_id', companyId)],
      ['items', () => adminClient.from('items').delete().eq('company_id', companyId)],
      ['employees', () => adminClient.from('employees').delete().eq('company_id', companyId)],
      ['users', () => adminClient.from('users').delete().eq('company_id', companyId)],
      ['production_plants', () => adminClient.from('production_plants').delete().eq('company_id', companyId)],
      ['companies', () => adminClient.from('companies').delete().eq('company_id', companyId)]
    ];

    for (const [label, run] of cleanupSteps) {
      const { error } = await run();
      if (error) throw new Error(`Cleanup failed at ${label}: ${error.message}`);
    }

    await adminClient.auth.admin.deleteUser(financeAuthUid);
    await adminClient.auth.admin.deleteUser(hrAuthUid);
    await adminClient.auth.admin.deleteUser(prodStaffAuthUid);
    await adminClient.auth.admin.deleteUser(prodManagerAuthUid);
  });

  it('pg_policies employees: hanya ada policy INSERT & UPDATE, TIDAK ADA policy SELECT (default-deny)', async () => {
    const { data, error } = await adminClient.rpc('debug_list_policies', { p_table_name: 'employees' });
    expect(error).toBeNull();
    const commands = (data ?? []).map((row: any) => row.cmd).sort();
    expect(commands).toEqual(['INSERT', 'UPDATE']);
  });

  it('finance_manager: SELECT langsung ke tabel employees dasar -> 0 baris (diblok RLS)', async () => {
    const client = await signInAs('finance.roletest@debug.mrp');
    const { data, error } = await client.from('employees').select('employee_id, wage_rate').eq('company_id', companyId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('finance_manager: employees_secure -> wage_rate ikut ter-mask null juga (finance TIDAK termasuk yang boleh lihat gaji)', async () => {
    const client = await signInAs('finance.roletest@debug.mrp');
    const { data, error } = await client.from('employees_secure').select('employee_id, wage_rate').eq('employee_id', employee1Id).single();
    expect(error).toBeNull();
    expect(data!.wage_rate).toBeNull();
  });

  it('finance_manager: get_work_order_labor_cost_total() BERHASIL, angka total tanpa rincian per-orang', async () => {
    const client = await signInAs('finance.roletest@debug.mrp');
    const { data, error } = await client.rpc('get_work_order_labor_cost_total', { p_work_order_id: workOrderId });
    expect(error).toBeNull();
    expect(Number(data)).toBe(EMPLOYEE1_WAGE);
  });

  it('hr_manager: SELECT langsung ke tabel employees dasar -> 0 baris juga (base table terkunci untuk SEMUA role, termasuk HR)', async () => {
    const client = await signInAs('hr.roletest@debug.mrp');
    const { data, error } = await client.from('employees').select('employee_id, wage_rate').eq('company_id', companyId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('hr_manager: employees_secure -> lihat wage_rate SEMUA karyawan (akses penuh)', async () => {
    const client = await signInAs('hr.roletest@debug.mrp');
    const { data, error } = await client
      .from('employees_secure')
      .select('employee_id, wage_rate')
      .in('employee_id', [employee1Id, employee2Id])
      .order('employee_id');
    expect(error).toBeNull();
    const byId: Record<number, number> = Object.fromEntries(data!.map((r: any) => [r.employee_id, r.wage_rate]));
    expect(byId[employee1Id]).toBe(EMPLOYEE1_WAGE);
    expect(byId[employee2Id]).toBe(EMPLOYEE2_WAGE);
  });

  it('karyawan sendiri (production_staff, linked_user_id miliknya): lihat wage_rate sendiri, TAPI TIDAK BISA lihat gaji rekan kerja', async () => {
    const client = await signInAs('prodstaff.roletest@debug.mrp');
    const { data, error } = await client
      .from('employees_secure')
      .select('employee_id, wage_rate')
      .in('employee_id', [employee1Id, employee2Id])
      .order('employee_id');
    expect(error).toBeNull();
    const byId: Record<number, number | null> = Object.fromEntries(data!.map((r: any) => [r.employee_id, r.wage_rate]));
    expect(byId[employee1Id]).toBe(EMPLOYEE1_WAGE); // dirinya sendiri
    expect(byId[employee2Id]).toBeNull(); // rekan kerja, bukan dirinya
  });

  it('production_manager: employees_secure -> BISA lihat name/position (perlu untuk penugasan kerja), TAPI wage_rate/wage_type tetap null', async () => {
    const client = await signInAs('prodmanager.roletest@debug.mrp');
    const { data, error } = await client
      .from('employees_secure')
      .select('employee_id, name, position, wage_type, wage_rate')
      .in('employee_id', [employee1Id, employee2Id])
      .order('employee_id');
    expect(error).toBeNull();
    console.log('production_manager employees_secure raw result:', JSON.stringify(data, null, 2));
    expect(data).toHaveLength(2);
    for (const row of data!) {
      expect(row.name).not.toBeNull();
      expect(row.position).not.toBeNull();
      expect(row.wage_type).toBeNull();
      expect(row.wage_rate).toBeNull();
    }
  });

  it('work_order_consumption mengurangi lots.quantity_on_hand sesuai jumlah dipakai (before/after)', async () => {
    const { data: before, error: beforeError } = await adminClient.from('lots').select('quantity_on_hand').eq('lot_id', lotId).single();
    expect(beforeError).toBeNull();
    expect(Number(before!.quantity_on_hand)).toBe(100);

    const qtyConsumed = 37.5;
    const { error: consumeError } = await adminClient
      .from('work_order_consumption')
      .insert([{ work_order_id: workOrderId, component_lot_id: lotId, qty_consumed: qtyConsumed }]);
    expect(consumeError).toBeNull();

    const { data: after, error: afterError } = await adminClient.from('lots').select('quantity_on_hand').eq('lot_id', lotId).single();
    expect(afterError).toBeNull();
    expect(Number(after!.quantity_on_hand)).toBe(100 - qtyConsumed);
  });
});
