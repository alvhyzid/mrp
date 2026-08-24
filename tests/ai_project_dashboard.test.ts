import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { runAiProjectSeed } from '../src/features/ai-project/server/runAiProjectSeed';
import { getAiProjectDashboard } from '../src/features/ai-project/server/getAiProjectDashboard';
import { toggleAiProjectChecklistItem } from '../src/features/ai-project/server/toggleAiProjectChecklistItem';
import { setAiProjectTaskManualPercent } from '../src/features/ai-project/server/setAiProjectTaskManualPercent';
import { takeAiProjectSnapshot } from '../src/features/ai-project/server/takeAiProjectSnapshot';
import { cleanupCompanyCascade } from './testCompanyCleanup';
import { ensureAuthUser } from './ensureAuthUser';

// Dashboard Proyek AI (K1b, docs/instruksi-dashboard-proyek-ai.md). PRINSIP
// UTAMA yang diuji: (1) progres AUTO_QUERY dihitung dari data NYATA (kamus_terms),
// berubah begitu jawaban kamus dikonfirmasi -- bukan angka statis; (2) tugas
// AUTO_QUERY TIDAK BISA diisi manual lewat API (skenario negatif diminta
// eksplisit); (3) role di luar tim inti (leadership) DITOLAK total.

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

describe('Dashboard Proyek AI (K1b) — seed, progres AUTO_QUERY dari data nyata, gerbang akses', () => {
  let companyId: number;
  let adminToken: string;
  let productionToken: string;
  let kamusTermId: number;

  async function loginToken(email: string): Promise<string> {
    const client: SupabaseClient = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
    const { data, error } = await client.auth.signInWithPassword({ email, password: roleTestPassword! });
    if (error) throw new Error(`Login failed for ${email}: ${error.message}`);
    return data.session.access_token;
  }

  beforeAll(async () => {
    const { data: company } = await adminClient
      .from('companies')
      .insert([{ name: 'AiProjectDashboardTestCorp', industry_type: 'manufacturing', status: 'trial' }])
      .select('company_id')
      .single();
    companyId = company!.company_id;

    for (const [email, role, fullName] of [
      ['admin.aiprojecttest@debug.mrp', 'company_admin', 'Admin AiProjectTest'],
      ['production.aiprojecttest@debug.mrp', 'production_staff', 'Produksi AiProjectTest']
    ] as const) {
      // AUD-21 (25 Agu 2026): pembuatan pengguna auth SELALU lewat ensureAuthUser.
      // Bentuk hasilnya sengaja dipertahankan supaya kode di bawahnya tidak ikut berubah;
      // `error` selalu null karena ensureAuthUser sudah menangani "sudah terdaftar" sendiri.
      const { data: authUser, error: authUserError } = {
        data: { user: { id: await ensureAuthUser(adminClient, email, roleTestPassword, { full_name: fullName }) } },
        error: null as { message: string } | null
      };
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
    adminToken = await loginToken('admin.aiprojecttest@debug.mrp');
    productionToken = await loginToken('production.aiprojecttest@debug.mrp');

    // 4 baris kamus_terms prioritas 1-2 utk company test ini -- kosong dulu (0% progres).
    await adminClient.from('kamus_terms').insert([
      { company_id: companyId, scope: 'FIELD', entity: 'items', field: 'standard_cost', term_key: 'items.standard_cost', priority: 1, domain: 'uang', status: 'DRAF_AI' },
      { company_id: companyId, scope: 'FIELD', entity: 'items', field: 'min_stock_level', term_key: 'items.min_stock_level', priority: 2, domain: 'kuantitas', status: 'DRAF_AI' },
      { company_id: companyId, scope: 'FIELD', entity: 'boms', field: 'buffer_percentage', term_key: 'boms.buffer_percentage', priority: 2, domain: 'kuantitas', status: 'DRAF_AI' },
      { company_id: companyId, scope: 'FIELD', entity: 'lots', field: 'unit_cost', term_key: 'lots.unit_cost', priority: 1, domain: 'uang', status: 'DRAF_AI' }
    ]);
    const { data: term } = await adminClient.from('kamus_terms').select('kamus_term_id').eq('company_id', companyId).eq('term_key', 'items.standard_cost').single();
    kamusTermId = term!.kamus_term_id;
  });

  afterAll(async () => {
    const { data: users } = await adminClient.from('users').select('auth_uid').eq('company_id', companyId);
    const cleanupSteps: Array<[string, () => any]> = [
      ['ai_project_checklist_items', async () => adminClient.from('ai_project_checklist_items').delete().in(
        'ai_project_task_id',
        (await adminClient.from('ai_project_tasks').select('ai_project_task_id').eq('company_id', companyId)).data?.map((t) => t.ai_project_task_id) ?? [-1]
      )],
      ['ai_project_tasks', () => adminClient.from('ai_project_tasks').delete().eq('company_id', companyId)],
      ['ai_project_phases', () => adminClient.from('ai_project_phases').delete().eq('company_id', companyId)],
      ['ai_project_progress_snapshots', () => adminClient.from('ai_project_progress_snapshots').delete().eq('company_id', companyId)],
      ['kamus_term_history', async () => adminClient.from('kamus_term_history').delete().in(
        'kamus_term_id',
        (await adminClient.from('kamus_terms').select('kamus_term_id').eq('company_id', companyId)).data?.map((t) => t.kamus_term_id) ?? [-1]
      )],
      ['kamus_terms', () => adminClient.from('kamus_terms').delete().eq('company_id', companyId)],
      ['users', () => adminClient.from('users').delete().eq('company_id', companyId)],
      ...(users ?? []).map((u): [string, () => any] => [`auth:${u.auth_uid}`, () => adminClient.auth.admin.deleteUser(u.auth_uid)])
    ];
    await cleanupCompanyCascade(adminClient, companyId, cleanupSteps);
  });

  it('(NEGATIF) role produksi membuka dashboard -> ditolak total', async () => {
    const req = makeRequest('http://localhost/api/ai-project', productionToken, 'GET');
    const result = await getAiProjectDashboard(req);
    expect(result.status).toBe(403);
  });

  it('seed menghasilkan <=40 tugas (STOP CONDITION tidak terpicu), struktur fase 0-4 lengkap', async () => {
    const req = makeRequest('http://localhost/api/ai-project/seed', adminToken, 'POST');
    const result = await runAiProjectSeed(req);
    expect(result.status).toBe(200);
    const body = result.body as any;
    expect(body.totalTasks).toBeLessThanOrEqual(40);
    expect(body.stopConditionTriggered).toBe(false);

    const { data: phases } = await adminClient.from('ai_project_phases').select('code').eq('company_id', companyId);
    expect(phases!.map((p) => p.code).sort()).toEqual(['fase0', 'fase1', 'fase2', 'fase3', 'fase4']);
  });

  it('(BUKTI query nyata) progres fase0 dari API SAMA PERSIS dgn hitungan manual INDEPENDEN dari kamus_terms + ai_project_checklist_items', async () => {
    const req = makeRequest('http://localhost/api/ai-project', adminToken, 'GET');
    const result = await getAiProjectDashboard(req);
    const body = result.body as any;
    const fase0 = body.phases.find((p: any) => p.code === 'fase0');

    // Hitung manual INDEPENDEN (query langsung, BUKAN menyalin logika
    // computeAiProjectProgress.ts) -- robust terhadap perubahan isi seed,
    // supaya test ini benar-benar membandingkan ke data NYATA saat itu,
    // bukan angka yang dihardcode lalu jadi kadaluarsa begitu seed berubah.
    const { data: fase0Tasks } = await adminClient.from('ai_project_tasks').select('ai_project_task_id, weight_percent, progress_source').eq('company_id', companyId).eq('ai_project_phase_id', (await adminClient.from('ai_project_phases').select('ai_project_phase_id').eq('company_id', companyId).eq('code', 'fase0').single()).data!.ai_project_phase_id);

    let expectedFase0 = 0;
    for (const task of fase0Tasks!) {
      let taskPercent = 0;
      if (task.progress_source === 'CHECKLIST') {
        const { data: items } = await adminClient.from('ai_project_checklist_items').select('done').eq('ai_project_task_id', task.ai_project_task_id);
        const total = items!.length;
        const done = items!.filter((i) => i.done).length;
        taskPercent = total > 0 ? (done / total) * 100 : 0;
      }
      // AUTO_QUERY task (kamus.*) sengaja tidak dihitung ulang di sini --
      // sudah diuji terpisah di test "sebelum/sesudah jawab kamus" di bawah;
      // semuanya 0% di titik ini (belum ada kamus_terms yang DIKONFIRMASI).
      expectedFase0 += (taskPercent * Number(task.weight_percent)) / 100;
    }
    expect(fase0.progress_percent).toBeCloseTo(expectedFase0, 1);
  });

  it('(BUKTI sebelum/sesudah) menjawab+konfirmasi 1 pertanyaan kamus prioritas 1-2 -> progres kamus.p12 naik SESUAI hitungan', async () => {
    const reqBefore = makeRequest('http://localhost/api/ai-project', adminToken, 'GET');
    const before = ((await getAiProjectDashboard(reqBefore)).body as any).tasks.find((t: any) => t.progress_key === 'kamus.p12' || t.name === 'Kamus prioritas 1-2');
    expect(before.progress_percent).toBeCloseTo(0, 5); // 0 dari 4 baris confirmed dulu

    // Jawab + konfirmasi langsung lewat admin client (setara alur UI kamus, bukan menduplikasi endpoint kamus di test ini).
    await adminClient.from('kamus_terms').update({ status: 'DIKONFIRMASI', answer_plain: 'test', answered_by: 1, confirmed_by: 1 }).eq('kamus_term_id', kamusTermId);

    const reqAfter = makeRequest('http://localhost/api/ai-project', adminToken, 'GET');
    const after = ((await getAiProjectDashboard(reqAfter)).body as any).tasks.find((t: any) => t.name === 'Kamus prioritas 1-2');
    // 4 baris prioritas<=2 total, 1 confirmed sekarang -> 25%.
    expect(after.progress_percent).toBeCloseTo(25, 1);
    expect(after.progress_percent).toBeGreaterThan(before.progress_percent);
  });

  it('(NEGATIF, diminta eksplisit) coba set manual_percent utk tugas AUTO_QUERY lewat API -> ditolak', async () => {
    const { data: task } = await adminClient.from('ai_project_tasks').select('ai_project_task_id').eq('company_id', companyId).eq('code', 'f0-kamus-p12').single();
    const req = makeRequest(`http://localhost/api/ai-project/tasks/${task!.ai_project_task_id}/manual-percent`, adminToken, 'PATCH', { manual_percent: 99 });
    const result = await setAiProjectTaskManualPercent(req, task!.ai_project_task_id);
    expect(result.status).toBe(400);

    const { data: unchanged } = await adminClient.from('ai_project_tasks').select('manual_percent').eq('ai_project_task_id', task!.ai_project_task_id).single();
    expect(unchanged!.manual_percent).toBeNull();
  });

  it('mencentang item checklist -> progres tugas CHECKLIST naik, tercatat done_by', async () => {
    const { data: task } = await adminClient.from('ai_project_tasks').select('ai_project_task_id').eq('company_id', companyId).eq('code', 'f1-pilih-model').single();
    const { data: item } = await adminClient.from('ai_project_checklist_items').select('ai_project_checklist_item_id').eq('ai_project_task_id', task!.ai_project_task_id).limit(1).single();

    const req = makeRequest(`http://localhost/api/ai-project/checklist-items/${item!.ai_project_checklist_item_id}`, adminToken, 'PATCH', { done: true });
    const result = await toggleAiProjectChecklistItem(req, item!.ai_project_checklist_item_id);
    expect(result.status).toBe(200);

    const { data: updated } = await adminClient.from('ai_project_checklist_items').select('done, done_by').eq('ai_project_checklist_item_id', item!.ai_project_checklist_item_id).single();
    expect(updated!.done).toBe(true);
    expect(updated!.done_by).not.toBeNull();
  });

  it('(BUKTI snapshot) mengambil snapshot 2× -> 2 baris tersimpan dgn overall_percent nyata', async () => {
    const req1 = makeRequest('http://localhost/api/ai-project/snapshot', adminToken, 'POST');
    const r1 = await takeAiProjectSnapshot(req1);
    expect(r1.status).toBe(200);
    const req2 = makeRequest('http://localhost/api/ai-project/snapshot', adminToken, 'POST');
    const r2 = await takeAiProjectSnapshot(req2);
    expect(r2.status).toBe(200);

    const { data: snapshots, count } = await adminClient
      .from('ai_project_progress_snapshots')
      .select('ai_project_progress_snapshot_id, overall_percent, per_phase, taken_at', { count: 'exact' })
      .eq('company_id', companyId)
      .order('taken_at');

    // AUD-26 — DIAGNOSTIK, bukan hiasan. Test ini gagal berselang-seling di suite penuh
    // ("expected 1 to be 2") tapi LULUS 3 dari 3 saat dijalankan sendirian, dan 26 dari 26
    // bersama tetangganya. Penyisiran 25 Agu 2026 tidak menemukan mekanismenya: tabel ini
    // hanya ditulis takeAiProjectSnapshot (insert biasa, nol upsert), tidak punya kekangan
    // unik maupun pemicu, dan tidak ada berkas test lain yang menyentuhnya.
    //
    // Karena sebabnya belum ketahuan, yang bisa dilakukan adalah membuat kegagalan
    // BERIKUTNYA menjelaskan dirinya sendiri: cetak baris yang benar-benar ada beserta
    // waktunya, supaya terlihat apakah insert kedua tidak pernah mendarat atau justru
    // hilang sesudahnya. Menebak sudah dicoba dan gagal; mengukur belum.
    expect(
      count,
      `Diharapkan 2 snapshot untuk company ${companyId}, yang ada ${count}. ` +
        `Status panggilan: r1=${r1.status}, r2=${r2.status}. ` +
        `Baris yang benar-benar ada: ${JSON.stringify(snapshots)}`
    ).toBe(2);
    expect(Number(snapshots![0].overall_percent)).toBeGreaterThan(0);
    expect(snapshots![0].per_phase).toHaveProperty('fase0');
  });
});
