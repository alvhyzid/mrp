import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { computeProcessMiningInsights } from '../src/features/process-mining/server/computeProcessMiningInsights';
import { getProcessMiningDashboard } from '../src/features/process-mining/server/getProcessMiningDashboard';
import { cleanupCompanyCascade } from './testCompanyCleanup';

// Process Mining (Fase 0.4, docs/langkah-membangun-fitur-ai.md) -- TANPA LLM,
// query & agregasi atas status_transition_log yang SUDAH ADA. PRINSIP UTAMA
// yang diuji: (1) data KOSONG/SEDIKIT tidak pernah menghasilkan angka
// menyesatkan -- selalu "belum cukup" eksplisit; (2) role non-leadership
// ditolak total.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const roleTestPassword = process.env.DEBUG_ROLE_TEST_PASSWORD;

if (!supabaseUrl || !anonKey || !serviceRoleKey || !roleTestPassword) {
  throw new Error('Environment variables NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY and DEBUG_ROLE_TEST_PASSWORD must be set for tests.');
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

function makeRequest(url: string, token: string, method: string): NextRequest {
  return new NextRequest(url, { method, headers: { Authorization: `Bearer ${token}` } });
}

describe('Process Mining — insight dari status_transition_log nyata, jujur soal keterbatasan data', () => {
  let companyId: number;
  let adminToken: string;
  let warehouseToken: string;

  async function loginToken(email: string): Promise<string> {
    const client: SupabaseClient = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
    const { data, error } = await client.auth.signInWithPassword({ email, password: roleTestPassword! });
    if (error) throw new Error(`Login failed for ${email}: ${error.message}`);
    return data.session.access_token;
  }

  beforeAll(async () => {
    const { data: company } = await adminClient
      .from('companies')
      .insert([{ name: 'ProcessMiningTestCorp', industry_type: 'manufacturing', status: 'trial' }])
      .select('company_id')
      .single();
    companyId = company!.company_id;

    for (const [email, role, fullName] of [
      ['admin.processminingtest@debug.mrp', 'company_admin', 'Admin ProcessMiningTest'],
      ['warehouse.processminingtest@debug.mrp', 'warehouse_staff', 'Gudang ProcessMiningTest']
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
      await adminClient.from('users').upsert([{ auth_uid: authUid, company_id: companyId, name: fullName, email, role, status: 'active' }], { onConflict: 'auth_uid' });
    }
    adminToken = await loginToken('admin.processminingtest@debug.mrp');
    warehouseToken = await loginToken('warehouse.processminingtest@debug.mrp');
  });

  afterAll(async () => {
    const { data: users } = await adminClient.from('users').select('auth_uid').eq('company_id', companyId);
    const cleanupSteps: Array<[string, () => any]> = [
      ['status_transition_log', () => adminClient.from('status_transition_log').delete().eq('company_id', companyId)],
      ['users', () => adminClient.from('users').delete().eq('company_id', companyId)],
      ...(users ?? []).map((u): [string, () => any] => [`auth:${u.auth_uid}`, () => adminClient.auth.admin.deleteUser(u.auth_uid)])
    ];
    await cleanupCompanyCascade(adminClient, companyId, cleanupSteps);
  });

  it('(NEGATIF) TANPA data transisi sama sekali -> "belum ada" eksplisit, BUKAN angka kosong yang menyesatkan', async () => {
    const result = await computeProcessMiningInsights(adminClient, companyId);
    expect(result.total_transitions).toBe(0);
    expect(result.status_durations).toEqual([]);
    expect(result.notes[0]).toContain('Belum ada satu pun transisi');
  });

  it('(NEGATIF) sampel durasi < 3 -> avg_duration_hours NULL, bukan angka dari 1-2 titik yang menyesatkan', async () => {
    // 1 record dgn 2 transisi berurutan (1 sampel durasi utk status "in_progress").
    await adminClient.from('status_transition_log').insert([
      { company_id: companyId, table_name: 'work_orders', record_id: 1, from_status: 'planned', to_status: 'in_progress', changed_at: '2026-08-01T00:00:00Z' },
      { company_id: companyId, table_name: 'work_orders', record_id: 1, from_status: 'in_progress', to_status: 'completed', changed_at: '2026-08-02T00:00:00Z' }
    ]);
    const result = await computeProcessMiningInsights(adminClient, companyId);
    expect(result.total_transitions).toBe(2);
    const duration = result.status_durations.find((d) => d.status === 'in_progress');
    expect(duration).toBeDefined();
    expect(duration!.sample_count).toBe(1);
    expect(duration!.avg_duration_hours).toBeNull(); // < 3 sampel -> TIDAK dihitung sbg angka pasti
    expect(result.notes.some((n) => n.includes('data belum cukup'))).toBe(true);
  });

  it('dgn >=3 sampel -> durasi dihitung PERSIS dari selisih waktu nyata, bukan diperkirakan', async () => {
    // Tambah 2 record lagi dgn transisi serupa (total 3 sampel "in_progress": 24 jam, 48 jam, 12 jam).
    await adminClient.from('status_transition_log').insert([
      { company_id: companyId, table_name: 'work_orders', record_id: 2, from_status: 'planned', to_status: 'in_progress', changed_at: '2026-08-01T00:00:00Z' },
      { company_id: companyId, table_name: 'work_orders', record_id: 2, from_status: 'in_progress', to_status: 'completed', changed_at: '2026-08-03T00:00:00Z' }, // 48 jam
      { company_id: companyId, table_name: 'work_orders', record_id: 3, from_status: 'planned', to_status: 'in_progress', changed_at: '2026-08-01T00:00:00Z' },
      { company_id: companyId, table_name: 'work_orders', record_id: 3, from_status: 'in_progress', to_status: 'completed', changed_at: '2026-08-01T12:00:00Z' } // 12 jam
    ]);
    const result = await computeProcessMiningInsights(adminClient, companyId);
    const duration = result.status_durations.find((d) => d.status === 'in_progress');
    expect(duration!.sample_count).toBe(3);
    // rata-rata (24+48+12)/3 = 28 jam.
    expect(duration!.avg_duration_hours).toBeCloseTo(28, 1);
  });

  it('(NEGATIF) role gudang membuka dashboard -> ditolak total', async () => {
    const req = makeRequest('http://localhost/api/process-mining', warehouseToken, 'GET');
    const result = await getProcessMiningDashboard(req);
    expect(result.status).toBe(403);
  });

  it('company_admin BISA membuka dashboard, isolasi antar company terjaga', async () => {
    const req = makeRequest('http://localhost/api/process-mining', adminToken, 'GET');
    const result = await getProcessMiningDashboard(req);
    expect(result.status).toBe(200);
    const body = result.body as any;
    expect(body.total_transitions).toBe(6); // hanya milik company test ini, bukan company lain
  });
});
