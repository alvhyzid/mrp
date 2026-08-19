import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { generateKamusBacklog } from '../src/features/kamus/server/generateKamusBacklog';
import { listKamusTerms } from '../src/features/kamus/server/listKamusTerms';
import { answerKamusTerm } from '../src/features/kamus/server/answerKamusTerm';
import { confirmKamusTerm } from '../src/features/kamus/server/confirmKamusTerm';
import { exportKamusMarkdown } from '../src/features/kamus/server/exportKamusMarkdown';

// Modul Kamus (K1, docs/rencana-modul-kamus-paralel.md BAGIAN 2). PRINSIP
// UTAMA yang diuji: (1) generator IDEMPOTEN (dijalankan 2x tidak menambah
// baris/menimpa jawaban), (2) kolom bermuatan gaji TIDAK PERNAH lolos ke
// backlog (dikecualikan total, dibuktikan query nyata bukan cuma dugaan),
// (3) konfirmasi "dua mata" HANYA leadership (skenario negatif eksplisit
// diminta dokumen), (4) jawaban manusia tidak bisa ditimpa lewat jalur biasa
// begitu dikonfirmasi.

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

describe('Modul Kamus (K1) — generator backlog, antrean jawab/konfirmasi, ekspor', () => {
  let companyId: number;
  let adminToken: string;
  let staffToken: string;

  async function loginToken(email: string): Promise<string> {
    const client: SupabaseClient = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
    const { data, error } = await client.auth.signInWithPassword({ email, password: roleTestPassword! });
    if (error) throw new Error(`Login failed for ${email}: ${error.message}`);
    return data.session.access_token;
  }

  beforeAll(async () => {
    const { data: company } = await adminClient
      .from('companies')
      .insert([{ name: 'KamusModuleTestCorp', industry_type: 'manufacturing', status: 'trial' }])
      .select('company_id')
      .single();
    companyId = company!.company_id;

    for (const [email, role, fullName] of [
      ['admin.kamustest@debug.mrp', 'company_admin', 'Admin KamusTest'],
      ['staff.kamustest@debug.mrp', 'warehouse_staff', 'Staff Gudang KamusTest']
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
    adminToken = await loginToken('admin.kamustest@debug.mrp');
    staffToken = await loginToken('staff.kamustest@debug.mrp');
  });

  afterAll(async () => {
    const { data: terms } = await adminClient.from('kamus_terms').select('kamus_term_id').eq('company_id', companyId);
    const termIds = (terms ?? []).map((t) => t.kamus_term_id);
    if (termIds.length) await adminClient.from('kamus_term_history').delete().in('kamus_term_id', termIds);
    await adminClient.from('kamus_terms').delete().eq('company_id', companyId);
    await adminClient.from('kamus_routing_rules').delete().eq('company_id', companyId);
    const { data: users } = await adminClient.from('users').select('auth_uid').eq('company_id', companyId);
    await adminClient.from('users').delete().eq('company_id', companyId);
    for (const u of users ?? []) await adminClient.auth.admin.deleteUser(u.auth_uid);
    await adminClient.from('companies').delete().eq('company_id', companyId);
  });

  it('generator menghasilkan backlog dari skema NYATA, prioritas 1 berisi kolom uang (bukan kosong/acak)', async () => {
    const result = await generateKamusBacklog(adminClient, companyId);
    expect(result.inserted).toBeGreaterThan(0);
    expect(result.countsByPriority[1]).toBeGreaterThan(0);

    const { data: p1 } = await adminClient.from('kamus_terms').select('term_key, domain').eq('company_id', companyId).eq('priority', 1).limit(5);
    expect(p1!.length).toBeGreaterThan(0);
    for (const row of p1!) expect(row.domain).toBe('uang');
  });

  it('(BUKTI 1) IDEMPOTEN — dijalankan lagi TIDAK menambah baris baru, jumlah persis sama', async () => {
    const { count: before } = await adminClient.from('kamus_terms').select('kamus_term_id', { count: 'exact', head: true }).eq('company_id', companyId);
    const secondRun = await generateKamusBacklog(adminClient, companyId);
    expect(secondRun.inserted).toBe(0);
    const { count: after } = await adminClient.from('kamus_terms').select('kamus_term_id', { count: 'exact', head: true }).eq('company_id', companyId);
    expect(after).toBe(before);
  });

  it('(BUKTI 2 / NEGATIF) kolom bermuatan gaji TIDAK PERNAH muncul di backlog — dibuktikan query nyata', async () => {
    const { data, count } = await adminClient
      .from('kamus_terms')
      .select('term_key', { count: 'exact' })
      .eq('company_id', companyId)
      .eq('entity', 'employees')
      .in('field', ['wage_rate', 'wage_type', 'ptkp_status', 'ter_category', 'ter_rate_percent', 'daily_meal_allowance', 'daily_transport_allowance', 'bpjs_kesehatan_enrolled', 'bpjs_contribution_basis', 'allowance_frequency']);
    expect(count).toBe(0);
    expect(data).toEqual([]);
  });

  it('menjawab pertanyaan (action=answer) -> status DIJAWAB, tercatat answered_by', async () => {
    const { data: term } = await adminClient.from('kamus_terms').select('kamus_term_id').eq('company_id', companyId).eq('priority', 1).limit(1).single();
    const req = makeRequest(`http://localhost/api/kamus/terms/${term!.kamus_term_id}/answer`, staffToken, 'PATCH', {
      action: 'answer',
      answer_plain: 'Ini harga jual per unit yang disepakati dengan customer.',
      answer_pitfall: 'Sering dikira sudah termasuk diskon, padahal belum.',
      answer_range: 'Wajar Rp10.000-Rp500.000, curiga kalau 0 atau negatif.'
    });
    const result = await answerKamusTerm(req, term!.kamus_term_id);
    expect(result.status).toBe(200);

    const { data: updated } = await adminClient.from('kamus_terms').select('status, answered_by, answer_plain').eq('kamus_term_id', term!.kamus_term_id).single();
    expect(updated!.status).toBe('DIJAWAB');
    expect(updated!.answered_by).not.toBeNull();
    expect(updated!.answer_plain).toContain('harga jual');

    const { data: history } = await adminClient.from('kamus_term_history').select('field_changed').eq('kamus_term_id', term!.kamus_term_id);
    expect(history!.some((h) => h.field_changed === 'status')).toBe(true);
    expect(history!.some((h) => h.field_changed === 'answer_plain')).toBe(true);

    return term!.kamus_term_id;
  });

  it('(NEGATIF 1, diminta eksplisit dokumen) role gudang mencoba KONFIRMASI jawaban -> ditolak', async () => {
    const { data: term } = await adminClient.from('kamus_terms').select('kamus_term_id').eq('company_id', companyId).eq('status', 'DIJAWAB').limit(1).single();
    const req = makeRequest(`http://localhost/api/kamus/terms/${term!.kamus_term_id}/confirm`, staffToken, 'PATCH');
    const result = await confirmKamusTerm(req, term!.kamus_term_id);
    expect(result.status).toBe(403);

    const { data: unchanged } = await adminClient.from('kamus_terms').select('status').eq('kamus_term_id', term!.kamus_term_id).single();
    expect(unchanged!.status).toBe('DIJAWAB');
  });

  it('company_admin BISA konfirmasi jawaban DIJAWAB -> status DIKONFIRMASI, confirmed_by tercatat', async () => {
    const { data: term } = await adminClient.from('kamus_terms').select('kamus_term_id').eq('company_id', companyId).eq('status', 'DIJAWAB').limit(1).single();
    const req = makeRequest(`http://localhost/api/kamus/terms/${term!.kamus_term_id}/confirm`, adminToken, 'PATCH');
    const result = await confirmKamusTerm(req, term!.kamus_term_id);
    expect(result.status).toBe(200);

    const { data: updated } = await adminClient.from('kamus_terms').select('status, confirmed_by').eq('kamus_term_id', term!.kamus_term_id).single();
    expect(updated!.status).toBe('DIKONFIRMASI');
    expect(updated!.confirmed_by).not.toBeNull();
  });

  it('(NEGATIF 2) jawaban yang SUDAH DIKONFIRMASI tidak bisa diubah lewat jalur jawab biasa (jawaban manusia tidak boleh ditimpa)', async () => {
    const { data: term } = await adminClient.from('kamus_terms').select('kamus_term_id').eq('company_id', companyId).eq('status', 'DIKONFIRMASI').limit(1).single();
    const req = makeRequest(`http://localhost/api/kamus/terms/${term!.kamus_term_id}/answer`, adminToken, 'PATCH', { action: 'answer', answer_plain: 'Coba timpa jawaban lama' });
    const result = await answerKamusTerm(req, term!.kamus_term_id);
    expect(result.status).toBe(400);
  });

  it('menugaskan ke departemen lain (action=assign) -- tidak menebak, cuma menandai + catatan opsional', async () => {
    const { data: term } = await adminClient.from('kamus_terms').select('kamus_term_id').eq('company_id', companyId).eq('status', 'DRAF_AI').limit(1).single();
    const req = makeRequest(`http://localhost/api/kamus/terms/${term!.kamus_term_id}/answer`, staffToken, 'PATCH', {
      action: 'assign',
      assigned_to_role: 'finance',
      assigned_note: 'Saya tidak tahu, tolong Finance yang jawab.'
    });
    const result = await answerKamusTerm(req, term!.kamus_term_id);
    expect(result.status).toBe(200);
    const { data: updated } = await adminClient.from('kamus_terms').select('assigned_to_role, assigned_note').eq('kamus_term_id', term!.kamus_term_id).single();
    expect(updated!.assigned_to_role).toBe('finance');
  });

  it('(BUKTI ekspor) markdown hasil ekspor berisi jawaban yang DIKONFIRMASI, dengan penjelasan+kesalahpahaman+nilai wajar', async () => {
    const req = makeRequest('http://localhost/api/kamus/export', adminToken, 'GET');
    const result = await exportKamusMarkdown(req);
    expect(result.status).toBe(200);
    const body = result.body as any;
    expect(body.totalConfirmed).toBeGreaterThan(0);
    expect(body.files['istilah.md']).toContain('harga jual');
    expect(body.files['istilah.md']).toContain('Sering dikira sudah termasuk diskon');
  });

  it('(NEGATIF) staf non-leadership TIDAK BISA mengekspor kamus', async () => {
    const req = makeRequest('http://localhost/api/kamus/export', staffToken, 'GET');
    const result = await exportKamusMarkdown(req);
    expect(result.status).toBe(403);
  });

  it('listKamusTerms mengembalikan hanya baris milik company sendiri (isolasi antar company)', async () => {
    const req = makeRequest('http://localhost/api/kamus', adminToken, 'GET', undefined);
    const result = await listKamusTerms(req, {});
    expect(result.status).toBe(200);
    const body = result.body as any;
    expect(body.terms.length).toBeGreaterThan(0);
    for (const term of body.terms) expect(term.company_id).toBe(companyId);
  });
});
