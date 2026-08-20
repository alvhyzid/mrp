import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { runKpiSeed } from '../src/features/kpi/server/runKpiSeed';
import { listKpiCards } from '../src/features/kpi/server/listKpiCards';
import { updateKpiTarget } from '../src/features/kpi/server/updateKpiTarget';
import { updateKpiVisibility } from '../src/features/kpi/server/updateKpiVisibility';
import { getMyKpi } from '../src/features/kpi/server/getMyKpi';

// Modul KPI (KPI-1) -- docs/rencana-kerja-kpi.md + penyerahan-opus-fitur-kpi.md +
// revisi-kpi-visibilitas-tanggung-jawab.md. PRINSIP UTAMA yang diuji: (a) nilai
// KPI TIDAK PERNAH bisa ditulis langsung (cuma AUTO dari data lewat server
// function); (b) target KPI DISIPLIN terkunci, tidak bisa diubah tenant; (c1)
// KPI attribution_level=LINI tidak punya jalur rincian per individu (nilai sama
// utk semua orang di role/departemen yang sama); (c2) "KPI Saya" milik user lain
// ditolak kecuali pemohon manager/HR/leadership; (c3) perubahan visibility/
// attribution_level tercatat kpi_registry_history.

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

describe('Modul KPI (KPI-1) — registry, snapshot, kartu, KPI Saya', () => {
  let companyId: number;
  let plantId: number;
  let adminToken: string;
  let financeToken: string;
  let prodManagerToken: string;
  let staffAToken: string;
  let staffBToken: string;
  let anonAuthClient: SupabaseClient;
  let userIdByEmail: Map<string, number>;

  async function loginToken(email: string): Promise<{ token: string; client: SupabaseClient }> {
    const client: SupabaseClient = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
    const { data, error } = await client.auth.signInWithPassword({ email, password: roleTestPassword! });
    if (error) throw new Error(`Login failed for ${email}: ${error.message}`);
    return { token: data.session.access_token, client };
  }

  beforeAll(async () => {
    const { data: company } = await adminClient.from('companies').insert([{ name: 'KpiModuleTestCorp', industry_type: 'manufacturing', status: 'trial' }]).select('company_id').single();
    companyId = company!.company_id;

    const { data: plant } = await adminClient.from('production_plants').insert([{ company_id: companyId, name: 'Plant Uji KPI' }]).select('production_plant_id').single();
    plantId = plant!.production_plant_id;

    const accounts: [string, string, string][] = [
      ['admin.kpimoduletest@debug.mrp', 'company_admin', 'Admin KpiModuleTest'],
      ['finance.kpimoduletest@debug.mrp', 'finance_manager', 'Finance KpiModuleTest'],
      ['prodmgr.kpimoduletest@debug.mrp', 'production_manager', 'ProdManager KpiModuleTest'],
      ['staffa.kpimoduletest@debug.mrp', 'production_staff', 'Staff A KpiModuleTest'],
      ['staffb.kpimoduletest@debug.mrp', 'production_staff', 'Staff B KpiModuleTest']
    ];
    for (const [email, role, fullName] of accounts) {
      const { data: authUser, error: authUserError } = await adminClient.auth.admin.createUser({ email, password: roleTestPassword, email_confirm: true, user_metadata: { full_name: fullName } });
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

    const { data: usersData } = await adminClient.from('users').select('user_id, email').eq('company_id', companyId);
    userIdByEmail = new Map((usersData ?? []).map((u) => [u.email, u.user_id]));

    await adminClient
      .from('employees')
      .insert([
        { company_id: companyId, production_plant_id: plantId, name: 'Staff A', department: 'production', wage_type: 'monthly', wage_rate: 4000000, linked_user_id: userIdByEmail.get('staffa.kpimoduletest@debug.mrp') },
        { company_id: companyId, production_plant_id: plantId, name: 'Staff B', department: 'production', wage_type: 'monthly', wage_rate: 4000000, linked_user_id: userIdByEmail.get('staffb.kpimoduletest@debug.mrp') }
      ]);

    const adminLogin = await loginToken('admin.kpimoduletest@debug.mrp');
    adminToken = adminLogin.token;
    anonAuthClient = adminLogin.client;
    financeToken = (await loginToken('finance.kpimoduletest@debug.mrp')).token;
    prodManagerToken = (await loginToken('prodmgr.kpimoduletest@debug.mrp')).token;
    staffAToken = (await loginToken('staffa.kpimoduletest@debug.mrp')).token;
    staffBToken = (await loginToken('staffb.kpimoduletest@debug.mrp')).token;
  });

  afterAll(async () => {
    await adminClient.from('kpi_registry_history').delete().in('kpi_registry_id', (await adminClient.from('kpi_registry').select('kpi_registry_id').eq('company_id', companyId)).data?.map((r) => r.kpi_registry_id) ?? []);
    await adminClient.from('kpi_actions').delete().eq('company_id', companyId);
    await adminClient.from('kpi_responsibilities').delete().eq('company_id', companyId);
    await adminClient.from('kpi_snapshots').delete().eq('company_id', companyId);
    await adminClient.from('kpi_registry').delete().eq('company_id', companyId);
    await adminClient.from('kamus_terms').delete().eq('company_id', companyId);
    await adminClient.from('employees').delete().eq('company_id', companyId);
    await adminClient.from('production_plants').delete().eq('company_id', companyId);
    const { data: users } = await adminClient.from('users').select('auth_uid').eq('company_id', companyId);
    await adminClient.from('users').delete().eq('company_id', companyId);
    for (const u of users ?? []) await adminClient.auth.admin.deleteUser(u.auth_uid);
    await adminClient.from('companies').delete().eq('company_id', companyId);
  });

  it('seed idempoten: 5 KPI kategori A + baris kamus METRIC terkait, dijalankan 2x tanpa duplikasi', async () => {
    const res1 = await runKpiSeed(makeRequest('http://x/api/kpi/seed', adminToken, 'POST'));
    expect(res1.status).toBe(200);
    expect((res1.body.registry as any).registryInserted).toBe(5);

    const res2 = await runKpiSeed(makeRequest('http://x/api/kpi/seed', adminToken, 'POST'));
    expect(res2.status).toBe(200);
    expect((res2.body.registry as any).registryInserted).toBe(0); // idempoten -- 0 baris baru run kedua

    const { data: registryRows } = await adminClient.from('kpi_registry').select('metric_key, target_value, kind').eq('company_id', companyId);
    expect(registryRows?.length).toBe(5);
    // Sanity: target GPM 35% SENGAJA TIDAK diterapkan (unit mismatch Rupiah vs %,
    // dilaporkan HANDOFF, bukan dipaksakan) -- semua target_value masih null.
    expect(registryRows?.every((r) => r.target_value === null)).toBe(true);
    expect(registryRows?.every((r) => r.kind === 'HASIL')).toBe(true);
  });

  it('kartu KPI: company_admin melihat 5 kartu dgn provenance + definisi + tanggung jawab terisi', async () => {
    const res = await listKpiCards(makeRequest('http://x/api/kpi', adminToken, 'GET'));
    expect(res.status).toBe(200);
    const cards = res.body.cards as any[];
    expect(cards.length).toBe(5);
    const margin = cards.find((c) => c.metric_key === 'metric.margin_kontribusi');
    expect(margin.provenance.formula).toBeTruthy();
    expect(margin.definition).toBeTruthy();
    expect(margin.responsibilities.some((r: any) => r.responsibility === 'PEMILIK')).toBe(true);
    // Nilai persediaan HARIAN, laba/margin BULANAN, yield MINGGUAN -- frekuensi tersimpan benar.
    const inventory = cards.find((c) => c.metric_key === 'metric.nilai_persediaan');
    expect(inventory.frequency).toBe('HARIAN');
    const yieldCard = cards.find((c) => c.metric_key === 'metric.yield_per_tahap_produk');
    expect(yieldCard.frequency).toBe('MINGGUAN');
    expect(yieldCard.attribution_level).toBe('LINI'); // instruksi eksplisit: JANGAN individu
  });

  it('kartu KPI: production_staff HANYA melihat KPI yg relevan (bukan KPI finansial)', async () => {
    const res = await listKpiCards(makeRequest('http://x/api/kpi', staffAToken, 'GET'));
    expect(res.status).toBe(200);
    const cards = res.body.cards as any[];
    // production_staff bukan owner_role manapun dan bukan finance -- KPI kategori A
    // semua owner_role finance_manager/company_admin/production_manager/warehouse_manager,
    // production_staff TIDAK match satupun (canViewKpi: bukan leadership, bukan owner_role
    // KPI manapun, bukan finance utk KPI uang) -- verifikasi gerbang benar2 menyaring.
    expect(cards.length).toBe(0);
  });

  it('kartu KPI: production_manager (pemilik KPI yield) melihat yield tapi TIDAK KPI finansial murni finance', async () => {
    const res = await listKpiCards(makeRequest('http://x/api/kpi', prodManagerToken, 'GET'));
    expect(res.status).toBe(200);
    const cards = res.body.cards as any[];
    expect(cards.some((c: any) => c.metric_key === 'metric.yield_per_tahap_produk')).toBe(true);
    expect(cards.some((c: any) => c.metric_key === 'metric.laba_operasional_bulanan')).toBe(false);
  });

  it('SKENARIO NEGATIF (a): set nilai KPI langsung lewat client authenticated biasa -> ditolak (RLS default-deny)', async () => {
    const { data: registryRow } = await adminClient.from('kpi_registry').select('kpi_registry_id').eq('company_id', companyId).eq('metric_key', 'metric.margin_kontribusi').single();
    const { data: existingSnapshot } = await adminClient.from('kpi_snapshots').select('kpi_snapshot_id').eq('company_id', companyId).eq('metric_key', 'metric.margin_kontribusi').limit(1).maybeSingle();

    // Coba INSERT baris kpi_snapshots BARU langsung lewat client authenticated (bukan
    // admin client, bukan lewat server function) -- tidak ada policy insert utk
    // authenticated di tabel ini sama sekali, jadi HARUS gagal/0 baris.
    const { data: insertResult, error: insertError } = await anonAuthClient
      .from('kpi_snapshots')
      .insert([{ company_id: companyId, metric_key: 'metric.margin_kontribusi', period_start: '2020-01-01', period_end: '2020-01-31', value: 999999999 }])
      .select('kpi_snapshot_id');
    expect(insertResult === null || insertResult.length === 0).toBe(true);

    if (existingSnapshot) {
      // Coba UPDATE baris yg sudah ada juga harus gagal/0 baris terupdate.
      const { data: updateResult } = await anonAuthClient.from('kpi_snapshots').update({ value: 999999999 }).eq('kpi_snapshot_id', existingSnapshot.kpi_snapshot_id).select('kpi_snapshot_id');
      expect(updateResult === null || updateResult.length === 0).toBe(true);
    }
    expect(!!insertError || insertResult?.length === 0 || insertResult === null).toBe(true);
    void registryRow;
  });

  it('SKENARIO NEGATIF (b): target KPI DISIPLIN terkunci, TIDAK bisa diubah walau oleh company_admin', async () => {
    // Tidak ada KPI DISIPLIN di antara 5 kategori A (semua HASIL) -- buat SATU baris
    // uji DISIPLIN khusus test ini utk membuktikan gerbangnya, bukan menguji data
    // yang kebetulan tidak ada.
    const { data: disciplineKpi } = await adminClient
      .from('kpi_registry')
      .insert([
        {
          company_id: companyId,
          // metric_key BEDA dari yg sudah dipakai 5 KPI kategori A (unique(company_id,metric_key))
          // -- reuse baris kamus yg sudah ada dari seed METRIC bawaan (FK komposit).
          metric_key: 'metric.biaya_bahan_batch',
          kind: 'DISIPLIN',
          pillar: 'RECORD',
          owner_role: 'company_admin',
          frequency: 'HARIAN',
          attribution_level: 'PERUSAHAAN',
          target_value: 100
        }
      ])
      .select('kpi_registry_id')
      .single();

    const res = await updateKpiTarget(makeRequest('http://x/api/kpi/x/target', adminToken, 'PATCH', { target_value: 50 }), disciplineKpi!.kpi_registry_id);
    expect(res.status).toBe(400);
    expect(String(res.body.error)).toContain('DISIPLIN');

    const { data: unchanged } = await adminClient.from('kpi_registry').select('target_value').eq('kpi_registry_id', disciplineKpi!.kpi_registry_id).single();
    expect(Number(unchanged!.target_value)).toBe(100); // tidak berubah

    await adminClient.from('kpi_registry').delete().eq('kpi_registry_id', disciplineKpi!.kpi_registry_id);
  });

  it('SKENARIO NEGATIF (c1): KPI attribution_level=LINI (yield) TIDAK punya jalur rincian per individu -- nilainya SATU angka agregat, bukan bisa dipecah per operator', async () => {
    // production_manager = owner_role yield -- BERHAK melihatnya via "KPI Saya".
    const res = await getMyKpi(makeRequest('http://x/api/kpi/saya', prodManagerToken, 'GET'));
    expect(res.status).toBe(200);
    const yieldEntry = (res.body.kpis as any[]).find((k) => k.metric_key === 'metric.yield_per_tahap_produk');
    expect(yieldEntry).toBeTruthy();
    expect(yieldEntry.attribution_level).toBe('LINI');
    // Bentuk data structural HANYA number|null -- tidak ada shape array/object per
    // karyawan yang bisa dipecah jadi "rincian individu" -- ini yang membuktikan
    // "tidak ada jalurnya", bukan cuma diblokir role.
    expect(yieldEntry.value === null || typeof yieldEntry.value === 'number').toBe(true);
    expect(yieldEntry.note).toContain('belum ada pemecahan per individu');

    // Staff A/B production_staff BIASA (bukan pemilik/kontributor terdaftar KPI
    // manapun) tidak melihat yield sama sekali lewat "KPI Saya" mereka sendiri --
    // owner_role yield = production_manager, bukan production_staff.
    const resStaffA = await getMyKpi(makeRequest('http://x/api/kpi/saya', staffAToken, 'GET'));
    expect((resStaffA.body.kpis as any[]).find((k) => k.metric_key === 'metric.yield_per_tahap_produk')).toBeUndefined();
  });

  it('SKENARIO NEGATIF (c2): pegawai A membuka "KPI Saya" milik pegawai B -> ditolak (bukan manager/HR/leadership)', async () => {
    const userBId = userIdByEmail.get('staffb.kpimoduletest@debug.mrp');
    const res = await getMyKpi(makeRequest(`http://x/api/kpi/saya?user_id=${userBId}`, staffAToken, 'GET'));
    expect(res.status).toBe(403);
  });

  it('KONTROL POSITIF (c2): production_manager (manager departemen production) BOLEH membuka "KPI Saya" staf production', async () => {
    const userAId = userIdByEmail.get('staffa.kpimoduletest@debug.mrp');
    const res = await getMyKpi(makeRequest(`http://x/api/kpi/saya?user_id=${userAId}`, prodManagerToken, 'GET'));
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('production_staff');
  });

  it('SKENARIO NEGATIF (c3): perubahan visibility & attribution_level tercatat kpi_registry_history', async () => {
    const { data: yieldKpi } = await adminClient.from('kpi_registry').select('kpi_registry_id, visibility, attribution_level').eq('company_id', companyId).eq('metric_key', 'metric.yield_per_tahap_produk').single();

    const res = await updateKpiVisibility(makeRequest('http://x/api/kpi/x/visibility', adminToken, 'PATCH', { visibility: ['DIRI', 'ATASAN'] }), yieldKpi!.kpi_registry_id);
    expect(res.status).toBe(200);

    const { data: historyRows } = await adminClient.from('kpi_registry_history').select('field_changed, old_value, new_value').eq('kpi_registry_id', yieldKpi!.kpi_registry_id).eq('field_changed', 'visibility');
    expect(historyRows?.length).toBeGreaterThan(0);
    expect(historyRows![0].new_value).toContain('DIRI');

    // Bukan leadership -> ditolak, sekaligus membuktikan gerbang role tetap berlaku.
    const resDenied = await updateKpiVisibility(makeRequest('http://x/api/kpi/x/visibility', financeToken, 'PATCH', { attribution_level: 'INDIVIDU' }), yieldKpi!.kpi_registry_id);
    expect(resDenied.status).toBe(403);
  });
});
