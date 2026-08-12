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

// Fixture perusahaan TERPISAH ("AttendanceTestCorp"), mengikuti pola SuperAdminCorp /
// RoleTestCorp yang sudah dipakai di tests lain — dibuat di beforeAll, dibersihkan
// total di afterAll.
describe('employee department scoping & attendance RLS verification', () => {
  let companyId: number;
  let plantId: number;
  let productionManagerAuthUid: string;
  let hrManagerAuthUid: string;
  let prodEmployeeUserAuthUid: string;
  let productionEmployeeId: number;
  let financeEmployeeId: number;
  let prodEmployeeSelfUserId: number;

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
    const { data, error } = await adminClient.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName } });
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
      .insert([{ name: 'AttendanceTestCorp', industry_type: 'manufacturing', status: 'trial' }])
      .select('company_id')
      .single();
    if (companyError) throw new Error(`Failed to create fixture company: ${companyError.message}`);
    companyId = company.company_id;

    const { data: plant, error: plantError } = await adminClient
      .from('production_plants')
      .insert([{ company_id: companyId, name: 'Plant AttendanceTest', is_active: true }])
      .select('production_plant_id')
      .single();
    if (plantError) throw new Error(`Failed to create fixture plant: ${plantError.message}`);
    plantId = plant.production_plant_id;

    const prodManagerUser = await getOrCreateAuthUser('prodmanager.attendtest@debug.mrp', roleTestPassword, 'Production Manager AttendTest');
    const hrManagerUser = await getOrCreateAuthUser('hrmanager.attendtest@debug.mrp', roleTestPassword, 'HR Manager AttendTest');
    const prodEmployeeUser = await getOrCreateAuthUser('prodemployee.attendtest@debug.mrp', roleTestPassword, 'Production Employee AttendTest');
    productionManagerAuthUid = prodManagerUser.id;
    hrManagerAuthUid = hrManagerUser.id;
    prodEmployeeUserAuthUid = prodEmployeeUser.id;

    const { data: appUsers, error: appUsersError } = await adminClient
      .from('users')
      .upsert(
        [
          { auth_uid: productionManagerAuthUid, company_id: companyId, name: 'Production Manager AttendTest', email: 'prodmanager.attendtest@debug.mrp', role: 'production_manager', status: 'active' },
          { auth_uid: hrManagerAuthUid, company_id: companyId, name: 'HR Manager AttendTest', email: 'hrmanager.attendtest@debug.mrp', role: 'hr_manager', status: 'active' },
          { auth_uid: prodEmployeeUserAuthUid, company_id: companyId, name: 'Production Employee AttendTest', email: 'prodemployee.attendtest@debug.mrp', role: 'production_staff', status: 'active' }
        ],
        { onConflict: 'auth_uid' }
      )
      .select('user_id, auth_uid');
    if (appUsersError) throw new Error(`Failed to create fixture users: ${appUsersError.message}`);
    prodEmployeeSelfUserId = appUsers!.find((u) => u.auth_uid === prodEmployeeUserAuthUid)!.user_id;

    const { data: prodEmployee, error: prodEmployeeError } = await adminClient
      .from('employees')
      .insert([{ company_id: companyId, production_plant_id: plantId, department: 'production', name: 'Operator Produksi AttendTest', position: 'Operator', wage_type: 'daily', wage_rate: 150000, linked_user_id: prodEmployeeSelfUserId, is_active: true }])
      .select('employee_id')
      .single();
    if (prodEmployeeError) throw new Error(`Failed to create production employee: ${prodEmployeeError.message}`);
    productionEmployeeId = prodEmployee.employee_id;

    const { data: financeEmployee, error: financeEmployeeError } = await adminClient
      .from('employees')
      .insert([{ company_id: companyId, department: 'finance', name: 'Staf Finance AttendTest', position: 'Finance Staff', wage_type: 'monthly', wage_rate: 6000000, is_active: true }])
      .select('employee_id')
      .single();
    if (financeEmployeeError) throw new Error(`Failed to create finance employee: ${financeEmployeeError.message}`);
    financeEmployeeId = financeEmployee.employee_id;

    const { error: attendanceError } = await adminClient.from('employee_attendance').insert([
      { company_id: companyId, employee_id: productionEmployeeId, attendance_date: '2026-08-13', check_in_at: '2026-08-13T01:00:00Z', status: 'present' },
      { company_id: companyId, employee_id: financeEmployeeId, attendance_date: '2026-08-13', check_in_at: '2026-08-13T01:00:00Z', status: 'present' }
    ]);
    if (attendanceError) throw new Error(`Failed to create fixture attendance rows: ${attendanceError.message}`);
  });

  afterAll(async () => {
    const steps: Array<[string, () => any]> = [
      ['employee_attendance', () => adminClient.from('employee_attendance').delete().eq('company_id', companyId)],
      ['employees', () => adminClient.from('employees').delete().eq('company_id', companyId)],
      ['users', () => adminClient.from('users').delete().eq('company_id', companyId)],
      ['production_plants', () => adminClient.from('production_plants').delete().eq('company_id', companyId)],
      ['companies', () => adminClient.from('companies').delete().eq('company_id', companyId)]
    ];
    for (const [label, run] of steps) {
      const { error } = await run();
      if (error) throw new Error(`Cleanup failed at ${label}: ${error.message}`);
    }
    await adminClient.auth.admin.deleteUser(productionManagerAuthUid);
    await adminClient.auth.admin.deleteUser(hrManagerAuthUid);
    await adminClient.auth.admin.deleteUser(prodEmployeeUserAuthUid);
  });

  it('production_manager: SELECT employee_attendance -> hanya lihat baris karyawan department production, TIDAK lihat department finance', async () => {
    const client = await signInAs('prodmanager.attendtest@debug.mrp');
    const { data, error } = await client.from('employee_attendance').select('employee_id').in('employee_id', [productionEmployeeId, financeEmployeeId]);
    expect(error).toBeNull();
    const employeeIds = (data ?? []).map((row: any) => row.employee_id);
    expect(employeeIds).toContain(productionEmployeeId);
    expect(employeeIds).not.toContain(financeEmployeeId);
  });

  it('hr_manager: SELECT employee_attendance -> lihat SEMUA department (production & finance)', async () => {
    const client = await signInAs('hrmanager.attendtest@debug.mrp');
    const { data, error } = await client.from('employee_attendance').select('employee_id').in('employee_id', [productionEmployeeId, financeEmployeeId]);
    expect(error).toBeNull();
    const employeeIds = (data ?? []).map((row: any) => row.employee_id);
    expect(employeeIds).toContain(productionEmployeeId);
    expect(employeeIds).toContain(financeEmployeeId);
  });

  it('karyawan sendiri: SELECT employee_attendance -> cuma baris dirinya sendiri', async () => {
    const client = await signInAs('prodemployee.attendtest@debug.mrp');
    const { data, error } = await client.from('employee_attendance').select('employee_id').in('employee_id', [productionEmployeeId, financeEmployeeId]);
    expect(error).toBeNull();
    const employeeIds = (data ?? []).map((row: any) => row.employee_id);
    expect(employeeIds).toEqual([productionEmployeeId]);
  });

  it('production_manager: TIDAK BISA insert/update employee_attendance (hanya boleh lihat, bukan kelola)', async () => {
    const client = await signInAs('prodmanager.attendtest@debug.mrp');
    const { error } = await client.from('employee_attendance').insert([{ company_id: companyId, employee_id: productionEmployeeId, attendance_date: '2026-08-14', status: 'present' }]);
    expect(error).not.toBeNull();
  });

  it('karyawan sendiri: BISA submit absensinya sendiri (self check-in)', async () => {
    const client = await signInAs('prodemployee.attendtest@debug.mrp');
    const { error } = await client.from('employee_attendance').insert([{ company_id: companyId, employee_id: productionEmployeeId, attendance_date: '2026-08-15', status: 'present', check_in_at: '2026-08-15T01:00:00Z' }]);
    expect(error).toBeNull();
  });

  it('pg_policies employee_attendance: ada policy select + 2 policy write (hr, self-submit)', async () => {
    const { data, error } = await adminClient.rpc('debug_list_policies', { p_table_name: 'employee_attendance' });
    expect(error).toBeNull();
    const policyNames = (data ?? []).map((row: any) => row.policyname).sort();
    expect(policyNames).toEqual(['employee_attendance_select', 'employee_attendance_self_submit', 'employee_attendance_write_hr']);
  });
});
