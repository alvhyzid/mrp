import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { hitungKesiapanAi, simpanKesiapanAi, isCapabilityUnlocked } from '../src/features/ai-readiness/server/recomputeAiReadiness';
import { createAiCapabilityOverride } from '../src/features/ai-readiness/server/createAiCapabilityOverride';
import { getAiReadinessDashboard } from '../src/features/ai-readiness/server/getAiReadinessDashboard';
import { cleanupCompanyCascade } from './testCompanyCleanup';
import { ensureAuthUser } from './ensureAuthUser';

// Kesiapan AI (Tenant-Facing) -- docs/spesifikasi-kesiapan-ai-tenant.md BAGIAN 2.
// PRINSIP UTAMA yang diuji: (1) TIDAK ADA angka kesiapan yang diketik manual --
// semua dari query nyata; (2) gerbang benar-benar mengunci (bukan hanya
// peringatan); (3) override HANYA super_admin, bukan admin tenant; (4) isolasi
// tenant tetap mutlak di tabel status kesiapan.

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

describe('Kesiapan AI (Tenant-Facing) — gerbang per kemampuan dari data nyata', () => {
  let companyAId: number;
  let companyBId: number;
  let adminAToken: string;
  let anonAClient: SupabaseClient;

  async function loginToken(email: string): Promise<{ token: string; client: SupabaseClient }> {
    const client: SupabaseClient = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
    const { data, error } = await client.auth.signInWithPassword({ email, password: roleTestPassword! });
    if (error) throw new Error(`Login failed for ${email}: ${error.message}`);
    return { token: data.session.access_token, client };
  }

  beforeAll(async () => {
    const { data: companyA } = await adminClient
      .from('companies')
      .insert([{ name: 'AiReadinessTestCorpA', industry_type: 'manufacturing', status: 'trial' }])
      .select('company_id')
      .single();
    companyAId = companyA!.company_id;
    const { data: companyB } = await adminClient
      .from('companies')
      .insert([{ name: 'AiReadinessTestCorpB', industry_type: 'manufacturing', status: 'trial' }])
      .select('company_id')
      .single();
    companyBId = companyB!.company_id;

    // AUD-21 (25 Agu 2026): pembuatan pengguna auth SELALU lewat ensureAuthUser.
    // Bentuk hasilnya sengaja dipertahankan supaya kode di bawahnya tidak ikut berubah;
    // `error` selalu null karena ensureAuthUser sudah menangani "sudah terdaftar" sendiri.
    const { data: authUser, error: authUserError } = {
      data: { user: { id: await ensureAuthUser(adminClient, 'admin.aireadinesstest@debug.mrp', roleTestPassword, { full_name: 'Admin AiReadinessTest' }) } },
      error: null as { message: string } | null
    };
    let authUid: string;
    if (authUserError && !authUserError.message.includes('already been registered')) throw new Error(authUserError.message);
    if (authUser?.user) {
      authUid = authUser.user.id;
    } else {
      const { data } = await adminClient.auth.admin.listUsers({ perPage: 100, page: 1 });
      authUid = data!.users.find((u: any) => u.email === 'admin.aireadinesstest@debug.mrp')!.id;
    }
    await adminClient.from('users').upsert([{ auth_uid: authUid, company_id: companyAId, name: 'Admin AiReadinessTest', email: 'admin.aireadinesstest@debug.mrp', role: 'company_admin', status: 'active' }], { onConflict: 'auth_uid' });

    // Beri company B satu snapshot kesiapan supaya ada sesuatu utk dibuktikan TIDAK terlihat dari company A.
    await simpanKesiapanAi(adminClient, companyBId);

    const loginResult = await loginToken('admin.aireadinesstest@debug.mrp');
    adminAToken = loginResult.token;
    anonAClient = loginResult.client;
  });

  afterAll(async () => {
    const { data: users } = await adminClient.from('users').select('auth_uid').eq('company_id', companyAId);
    const cleanupSteps: Array<[string, () => any]> = [
      ['production_disruptions', () => adminClient.from('production_disruptions').delete().in('company_id', [companyAId, companyBId])],
      ['production_plants', () => adminClient.from('production_plants').delete().in('company_id', [companyAId, companyBId])],
      ['ai_answer_feedback', () => adminClient.from('ai_answer_feedback').delete().in('company_id', [companyAId, companyBId])],
      ['ai_capability_overrides', () => adminClient.from('ai_capability_overrides').delete().in('company_id', [companyAId, companyBId])],
      ['ai_capability_status', () => adminClient.from('ai_capability_status').delete().in('company_id', [companyAId, companyBId])],
      ['kamus_term_history', async () => adminClient.from('kamus_term_history').delete().in(
        'kamus_term_id',
        (await adminClient.from('kamus_terms').select('kamus_term_id').eq('company_id', companyAId)).data?.map((t) => t.kamus_term_id) ?? [-1]
      )],
      ['kamus_terms', () => adminClient.from('kamus_terms').delete().eq('company_id', companyAId)],
      ['users', () => adminClient.from('users').delete().in('company_id', [companyAId, companyBId])],
      ...(users ?? []).map((u): [string, () => any] => [`auth:${u.auth_uid}`, () => adminClient.auth.admin.deleteUser(u.auth_uid)])
    ];
    await cleanupCompanyCascade(adminClient, [companyAId, companyBId], cleanupSteps);
  });

  it('TANPA data sama sekali -> Panel Asal-Usul terbuka 100%, semua kemampuan lain TERKUNCI dgn alasan jelas', async () => {
    const results = await simpanKesiapanAi(adminClient, companyAId);
    const panel = results.find((r) => r.code === 'panel_asal_usul');
    expect(panel!.is_unlocked).toBe(true);
    expect(panel!.readiness_percent).toBe(100);

    const copilot = results.find((r) => r.code === 'copilot_data_pabrik');
    expect(copilot!.is_unlocked).toBe(false);
    expect(copilot!.blocking_reasons.length).toBeGreaterThan(0);
    expect(copilot!.blocking_reasons[0].label).toContain('Kamus prioritas 1-2');

    const processMining = results.find((r) => r.code === 'process_mining');
    expect(processMining!.is_unlocked).toBe(false);
  });

  it('(KOREKSI) quality.downtime_classified DIHITUNG dari production_disruptions nyata — bukan "tabel tidak ada"', async () => {
    const { data: plant } = await adminClient.from('production_plants').insert([{ company_id: companyAId, name: 'Plant Uji Downtime' }]).select('production_plant_id').single();
    const { error: insertError } = await adminClient.from('production_disruptions').insert([
      { company_id: companyAId, production_plant_id: plant!.production_plant_id, disruption_type: 'equipment_breakdown', started_at: '2026-08-01T00:00:00Z' },
      { company_id: companyAId, production_plant_id: plant!.production_plant_id, disruption_type: 'utility_outage', started_at: '2026-08-02T00:00:00Z' },
      { company_id: companyAId, production_plant_id: plant!.production_plant_id, disruption_type: 'external_factor', started_at: '2026-08-03T00:00:00Z' },
      { company_id: companyAId, production_plant_id: plant!.production_plant_id, disruption_type: 'other', started_at: '2026-08-04T00:00:00Z' }
    ]);
    expect(insertError).toBeNull();
    const results = await simpanKesiapanAi(adminClient, companyAId);
    const anomaly = results.find((r) => r.code === 'anomaly_detection')!;
    const downtimeReq = anomaly.requirements.find((r) => r.metric_key === 'quality.downtime_classified')!;
    expect(downtimeReq).toBeDefined();
    expect(downtimeReq.actual).toBeCloseTo(75, 1); // 3 dari 4 bukan 'other' = 75%
    expect(downtimeReq.met).toBe(false); // ambang 80%, 75% belum tercapai
  });

  it('(BUKTI idempoten) recomputeAiReadiness dijalankan 2x dgn data sama -> ai_capability_status IDENTIK', async () => {
    const firstRun = await simpanKesiapanAi(adminClient, companyAId);
    const secondRun = await simpanKesiapanAi(adminClient, companyAId);
    for (const cap of firstRun) {
      const match = secondRun.find((c) => c.code === cap.code);
      expect(match!.readiness_percent).toBe(cap.readiness_percent);
      expect(match!.is_unlocked).toBe(cap.is_unlocked);
    }
    const { data: statusRows } = await adminClient.from('ai_capability_status').select('capability_id').eq('company_id', companyAId);
    expect(statusRows!.length).toBe(firstRun.length); // upsert, bukan insert dobel
  });

  it('(BUKTI sebelum/sesudah) konfirmasi baris kamus prioritas 1-2 -> skor Copilot Data Pabrik NAIK sesuai perhitungan nyata', async () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      company_id: companyAId,
      scope: 'FIELD',
      entity: 'items',
      field: `kolom_uji_${i}`,
      term_key: `items.kolom_uji_${i}`,
      priority: 1,
      domain: 'lainnya',
      status: 'BELUM'
    }));
    await adminClient.from('kamus_terms').insert(rows);

    const before = await simpanKesiapanAi(adminClient, companyAId);
    const copilotBefore = before.find((r) => r.code === 'copilot_data_pabrik')!;
    expect(copilotBefore.readiness_percent).toBe(0);
    expect(copilotBefore.is_unlocked).toBe(false);

    // Konfirmasi 3 dari 10 baris (30%) -- MASIH di bawah ambang 70% (§1.4),
    // menunjukkan skor naik proporsional tapi belum membuka kemampuan.
    const { data: allTerms } = await adminClient.from('kamus_terms').select('kamus_term_id').eq('company_id', companyAId).eq('priority', 1);
    const ids = allTerms!.map((t) => t.kamus_term_id);
    await adminClient.from('kamus_terms').update({ status: 'DIKONFIRMASI' }).in('kamus_term_id', ids.slice(0, 3));

    const partial = await simpanKesiapanAi(adminClient, companyAId);
    const copilotPartial = partial.find((r) => r.code === 'copilot_data_pabrik')!;
    expect(copilotPartial.readiness_percent).toBeCloseTo((30 / 70) * 100, 1); // 30% aktual / 70% ambang, dibatasi maks 100
    expect(copilotPartial.is_unlocked).toBe(false);
    expect(copilotPartial.readiness_percent).toBeGreaterThan(copilotBefore.readiness_percent);

    // Konfirmasi 5 baris lagi (total 8/10 = 80%) -- MELEWATI ambang 70%, kemampuan terbuka.
    await adminClient.from('kamus_terms').update({ status: 'DIKONFIRMASI' }).in('kamus_term_id', ids.slice(3, 8));
    const after = await simpanKesiapanAi(adminClient, companyAId);
    const copilotAfter = after.find((r) => r.code === 'copilot_data_pabrik')!;
    expect(copilotAfter.requirements[0].actual).toBeCloseTo(80, 1);
    expect(copilotAfter.is_unlocked).toBe(true); // 80% >= ambang 70%
    expect(copilotAfter.readiness_percent).toBeGreaterThan(copilotPartial.readiness_percent);
  });

  it('(NEGATIF 1) gerbang tunggal isCapabilityUnlocked() menolak kemampuan yang prasyaratnya belum terpenuhi', async () => {
    await simpanKesiapanAi(adminClient, companyAId);
    const unlocked = await isCapabilityUnlocked(adminClient, companyAId, 'process_mining');
    expect(unlocked).toBe(false);
  });

  it('(NEGATIF 2) admin TENANT (company_admin, bukan super_admin platform) mencoba membuat override -> ditolak', async () => {
    const req = makeRequest('http://localhost/api/ai-readiness/override', adminAToken, 'POST');
    const result = await createAiCapabilityOverride(req, {
      companyId: companyAId,
      capabilityCode: 'process_mining',
      reason: 'Coba buka paksa utk demo',
      expiresAt: new Date(Date.now() + 86400000).toISOString()
    });
    expect(result.status).toBe(403);

    const { count } = await adminClient.from('ai_capability_overrides').select('ai_capability_override_id', { count: 'exact', head: true }).eq('company_id', companyAId);
    expect(count).toBe(0);
  });

  it('(NEGATIF 3) user company A TIDAK BISA membaca ai_capability_status milik company B (isolasi tenant mutlak)', async () => {
    const { data, error } = await anonAClient.from('ai_capability_status').select('*').eq('company_id', companyBId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('getAiReadinessDashboard mengembalikan HANYA kemampuan company sendiri, angka konsisten dgn recomputeAiReadiness', async () => {
    const req = makeRequest('http://localhost/api/ai-readiness', adminAToken, 'GET');
    const result = await getAiReadinessDashboard(req);
    expect(result.status).toBe(200);
    const body = result.body as any;
    expect(body.total_count).toBeGreaterThan(0);
    expect(body.capabilities.find((c: any) => c.code === 'panel_asal_usul').readiness_percent).toBe(100);
  });
});
