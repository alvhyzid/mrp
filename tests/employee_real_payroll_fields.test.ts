import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createEmployee } from '../src/features/hr/server/createEmployee';
import { updateEmployee } from '../src/features/hr/server/updateEmployee';
import { listEmployees } from '../src/features/hr/server/listEmployees';
import { cleanupCompanyCascade } from './testCompanyCleanup';

// Perintah Gabungan A-F, Bagian C (21 Agu 2026) -- kolom payroll nyata baru di
// employees (kode karyawan pabrik, status kepegawaian, PTKP, TER, tunjangan
// harian, kepesertaan BPJS Kesehatan). PRINSIP UTAMA yang diuji: field
// finansial baru (PTKP/TER/tunjangan/BPJS) ikut aturan privasi gaji yang SAMA
// dengan wage_rate -- bukan gerbang baru yang lebih longgar; dan validasi
// menolak nilai tidak valid alih-alih diam-diam menyimpan data rusak.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const roleTestPassword = process.env.DEBUG_ROLE_TEST_PASSWORD;

if (!supabaseUrl || !anonKey || !serviceRoleKey || !roleTestPassword) {
  throw new Error('Environment variables NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY and DEBUG_ROLE_TEST_PASSWORD must be set for tests.');
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

function makeRequest(url: string, token: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
}

describe('Employee real payroll fields (Bagian C) — validasi + privasi data finansial', () => {
  let companyId: number;
  let hrManagerToken: string;
  let prodStaffToken: string;
  let createdEmployeeId: number;

  async function loginToken(email: string): Promise<string> {
    const client: SupabaseClient = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
    const { data, error } = await client.auth.signInWithPassword({ email, password: roleTestPassword! });
    if (error) throw new Error(`Login failed for ${email}: ${error.message}`);
    return data.session.access_token;
  }

  beforeAll(async () => {
    const { data: company, error: companyError } = await adminClient
      .from('companies')
      .insert([{ name: 'PayrollFieldsTestCorp', industry_type: 'manufacturing', status: 'trial' }])
      .select('company_id')
      .single();
    if (companyError) throw new Error(companyError.message);
    companyId = company.company_id;

    for (const [email, role, fullName] of [
      ['hrmanager.payrollfieldstest@debug.mrp', 'hr_manager', 'HR Manager PayrollFieldsTest'],
      ['prodstaff.payrollfieldstest@debug.mrp', 'production_staff', 'Prod Staff PayrollFieldsTest']
    ] as const) {
      const { data: authUser, error: authUserError } = await adminClient.auth.admin.createUser({
        email,
        password: roleTestPassword,
        email_confirm: true,
        user_metadata: { full_name: fullName }
      });
      let authUid: string;
      if (authUserError && !authUserError.message.includes('already been registered')) throw new Error(authUserError.message);
      if (authUser?.user) {
        authUid = authUser.user.id;
      } else {
        const { data } = await adminClient.auth.admin.listUsers({ perPage: 100, page: 1 });
        authUid = data!.users.find((u: any) => u.email === email)!.id;
      }
      const { error: appUserError } = await adminClient
        .from('users')
        .upsert([{ auth_uid: authUid, company_id: companyId, name: fullName, email, role, status: 'active' }], { onConflict: 'auth_uid' });
      if (appUserError) throw new Error(appUserError.message);
    }

    hrManagerToken = await loginToken('hrmanager.payrollfieldstest@debug.mrp');
    prodStaffToken = await loginToken('prodstaff.payrollfieldstest@debug.mrp');
  });

  afterAll(async () => {
    const { data: users } = await adminClient.from('users').select('user_id, auth_uid').eq('company_id', companyId);
    const cleanupSteps: Array<[string, () => any]> = [
      ['employees', () => adminClient.from('employees').delete().eq('company_id', companyId)],
      ['users', () => adminClient.from('users').delete().eq('company_id', companyId)],
      ...(users ?? []).map((u): [string, () => any] => [`auth:${u.auth_uid}`, () => adminClient.auth.admin.deleteUser(u.auth_uid)])
    ];
    await cleanupCompanyCascade(adminClient, companyId, cleanupSteps);
  });

  it('HR manager membuat karyawan dgn field payroll nyata lengkap (kode pabrik, status kepegawaian, PTKP, TER, tunjangan, BPJS)', async () => {
    const req = makeRequest('http://localhost/api/employees', hrManagerToken, 'POST', {
      name: 'Karyawan Uji Payroll',
      position: 'Operator Produksi',
      department: 'production',
      wage_type: 'monthly',
      wage_rate: 1500000,
      factory_employee_code: '2508999',
      employment_status: 'kontrak',
      ptkp_status: 'TK/0',
      ter_category: 'TER A',
      ter_rate_percent: 0.5,
      daily_meal_allowance: 10000,
      daily_transport_allowance: 10000,
      bpjs_kesehatan_enrolled: true
    });
    const result = await createEmployee(req);
    expect(result.status).toBe(200);

    const { data: row } = await adminClient.from('employees').select('*').eq('company_id', companyId).eq('factory_employee_code', '2508999').single();
    createdEmployeeId = row.employee_id;
    expect(row.employment_status).toBe('kontrak');
    expect(row.ptkp_status).toBe('TK/0');
    expect(Number(row.ter_rate_percent)).toBeCloseTo(0.5, 2);
    expect(Number(row.daily_meal_allowance)).toBeCloseTo(10000, 2);
    expect(row.bpjs_kesehatan_enrolled).toBe(true);
  });

  it('(NEGATIF) employment_status tidak valid ditolak, TIDAK diam-diam tersimpan sebagai nilai lain', async () => {
    const req = makeRequest('http://localhost/api/employees', hrManagerToken, 'POST', {
      name: 'Karyawan Status Salah',
      wage_type: 'monthly',
      wage_rate: 1000000,
      employment_status: 'tetap' // bukan salah satu dari kontrak/phl/freelance
    });
    const result = await createEmployee(req);
    expect(result.status).toBe(400);
    expect(result.body.error).toMatch(/[Ss]tatus kepegawaian/);

    const { count } = await adminClient.from('employees').select('employee_id', { count: 'exact', head: true }).eq('company_id', companyId).eq('name', 'Karyawan Status Salah');
    expect(count).toBe(0);
  });

  it('(NEGATIF) tunjangan negatif ditolak (bukan disimpan sebagai nilai negatif yang tidak masuk akal)', async () => {
    const req = makeRequest('http://localhost/api/employees', hrManagerToken, 'POST', {
      name: 'Karyawan Tunjangan Negatif',
      wage_type: 'monthly',
      wage_rate: 1000000,
      daily_meal_allowance: -5000
    });
    const result = await createEmployee(req);
    expect(result.status).toBe(400);
    expect(result.body.error).toMatch(/[Tt]unjangan makan/);
  });

  it('field PTKP/TER/tunjangan/BPJS ikut privasi wage_rate — role tanpa akses HR TIDAK melihatnya (bukan cuma wage_rate yang disembunyikan)', async () => {
    const req = makeRequest('http://localhost/api/employees', prodStaffToken, 'GET');
    const result = await listEmployees(req);
    expect(result.status).toBe(200);
    const body = result.body as any;
    const row = body.employees.find((e: any) => e.employee_id === createdEmployeeId);
    expect(row).toBeTruthy();
    expect(row.wage_rate).toBeNull();
    expect(row.ptkp_status).toBeNull();
    expect(row.ter_category).toBeNull();
    expect(row.ter_rate_percent).toBeNull();
    expect(row.daily_meal_allowance).toBeNull();
    expect(row.bpjs_kesehatan_enrolled).toBeNull();
    // Field non-finansial TETAP terlihat (kode karyawan, status kepegawaian bukan data gaji).
    expect(row.factory_employee_code).toBe('2508999');
    expect(row.employment_status).toBe('kontrak');
  });

  it('update (nonaktifkan) tetap mempertahankan field payroll yang sudah ada saat field itu dikirim ulang', async () => {
    const req = makeRequest('http://localhost/api/employees', hrManagerToken, 'PATCH', {
      employee_id: createdEmployeeId,
      name: 'Karyawan Uji Payroll',
      position: 'Operator Produksi',
      department: 'production',
      wage_type: 'monthly',
      wage_rate: 1500000,
      factory_employee_code: '2508999',
      employment_status: 'kontrak',
      ptkp_status: 'TK/0',
      ter_category: 'TER A',
      ter_rate_percent: 0.5,
      is_active: false
    });
    const result = await updateEmployee(req);
    expect(result.status).toBe(200);

    const { data: row } = await adminClient.from('employees').select('is_active, ptkp_status').eq('employee_id', createdEmployeeId).single();
    expect(row!.is_active).toBe(false);
    expect(row!.ptkp_status).toBe('TK/0');
  });
});
