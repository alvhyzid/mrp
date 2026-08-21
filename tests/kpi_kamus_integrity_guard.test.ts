import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cleanupCompanyCascade } from './testCompanyCleanup';

// Sesi 5 (0.4, 21 Agu 2026) — pengawas ringan untuk anomali hilangnya baris
// kpi_registry/kamus_terms yang diselidiki di Sesi 0/0B/0C dan TETAP TIDAK
// TERLACAK penyebabnya. Tujuan test ini BUKAN mencari penyebab (sudah dicoba
// berkali-kali, tidak ditemukan) -- tujuannya supaya KALAU terulang, ketahuan
// hari itu juga lewat CI, bukan lewat pengguna yang melapor.
//
// Test pertama HANYA membaca (select) company_id=1 (PT ITM) -- TIDAK PERNAH
// insert/update/delete di sana, jadi tidak melanggar Invarian 9 (lihat
// testCompanyCleanup.ts) ataupun batas "data PT ITM hanya dibaca" Sesi 5.
// Untuk MEMBUKTIKAN pengawas ini benar-benar bisa gagal (bukan cuma selalu
// hijau), test kedua/ketiga menjalankan LOGIKA PEMERIKSAAN YANG SAMA di
// tenant uji terisolasi, sengaja menghapus satu baris, lalu memulihkannya.
//
// Daftar di bawah adalah SNAPSHOT kondisi nyata company_id=1 per 21 Agu 2026
// (diverifikasi manual lewat query langsung sebelum test ini ditulis): 6 KPI
// "kategori A" di kpi_registry (seedKpiRegistry.ts) + 11 istilah scope METRIC
// di kamus_terms. Kalau daftar ini SENGAJA berubah di masa depan (KPI baru
// ditambah lewat keputusan produk), perbarui array di bawah bersamaan dengan
// perubahan itu -- jangan hapus test ini.

const EXPECTED_KATEGORI_A_METRIC_KEYS = [
  'metric.margin_kontribusi',
  'metric.margin_kontribusi_persen',
  'metric.biaya_produksi_per_unit',
  'metric.laba_operasional_bulanan',
  'metric.yield_per_tahap_produk',
  'metric.nilai_persediaan'
];

const EXPECTED_KAMUS_METRIC_TERM_KEYS = [
  'metric.biaya_bahan_batch',
  'metric.biaya_kemasan_order',
  'metric.biaya_produksi_order',
  'metric.biaya_produksi_per_unit',
  'metric.biaya_sdm_batch',
  'metric.laba_operasional_bulanan',
  'metric.margin_kontribusi',
  'metric.margin_kontribusi_persen',
  'metric.nilai_persediaan',
  'metric.sisa_reprocessable',
  'metric.yield_per_tahap_produk'
];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Environment variables NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for tests.');
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

async function findMissingKpiRegistryKeys(client: SupabaseClient, companyId: number, expectedKeys: string[]): Promise<string[]> {
  const { data, error } = await client.from('kpi_registry').select('metric_key').eq('company_id', companyId).in('metric_key', expectedKeys);
  if (error) throw new Error(error.message);
  const present = new Set((data ?? []).map((r) => r.metric_key as string));
  return expectedKeys.filter((k) => !present.has(k));
}

async function findMissingKamusMetricKeys(client: SupabaseClient, companyId: number, expectedKeys: string[]): Promise<string[]> {
  const { data, error } = await client.from('kamus_terms').select('term_key').eq('company_id', companyId).eq('scope', 'METRIC').in('term_key', expectedKeys);
  if (error) throw new Error(error.message);
  const present = new Set((data ?? []).map((r) => r.term_key as string));
  return expectedKeys.filter((k) => !present.has(k));
}

describe('Pengawas integritas kpi_registry/kamus_terms company_id=1 (anomali Sesi 0, belum terlacak penyebabnya)', () => {
  it('6 KPI kategori A (kpi_registry) company_id=1 harus tetap lengkap', async () => {
    const missing = await findMissingKpiRegistryKeys(adminClient, 1, EXPECTED_KATEGORI_A_METRIC_KEYS);
    expect(missing, `Baris kpi_registry (company_id=1) hilang untuk metric_key: ${missing.join(', ')}`).toEqual([]);
  });

  it('11 istilah kamus_terms scope METRIC company_id=1 harus tetap lengkap', async () => {
    const missing = await findMissingKamusMetricKeys(adminClient, 1, EXPECTED_KAMUS_METRIC_TERM_KEYS);
    expect(missing, `Baris kamus_terms scope=METRIC (company_id=1) hilang untuk term_key: ${missing.join(', ')}`).toEqual([]);
  });
});

describe('Bukti negatif (5.0.b) -- pengawas benar-benar mendeteksi kehilangan baris, di tenant uji terisolasi (BUKAN company_id=1)', () => {
  let companyId: number;

  beforeAll(async () => {
    const { data: company } = await adminClient.from('companies').insert([{ name: 'KpiGuardNegativeTestCorp', industry_type: 'manufacturing', status: 'trial' }]).select('company_id').single();
    companyId = company!.company_id;

    // Seed SEMUA 11 istilah kamus_terms scope METRIC dulu (superset yang mencakup
    // 6 metric_key kategori A) -- kpi_registry.metric_key punya FK komposit ke
    // kamus_terms(company_id, term_key) (Doktrin: kamus adalah satu-satunya
    // sumber kebenaran rumus KPI), jadi baris kamus WAJIB ada lebih dulu.
    const kamusRows = EXPECTED_KAMUS_METRIC_TERM_KEYS.map((term_key) => ({
      company_id: companyId,
      scope: 'METRIC' as const,
      term_key,
      priority: 3,
      domain: 'uang' as const,
      status: 'DRAF_AI' as const
    }));
    const { error: kamusSeedError } = await adminClient.from('kamus_terms').insert(kamusRows);
    if (kamusSeedError) throw new Error(kamusSeedError.message);

    const kpiRows = EXPECTED_KATEGORI_A_METRIC_KEYS.map((metric_key, idx) => ({
      company_id: companyId,
      metric_key,
      kind: 'HASIL' as const,
      pillar: 'EFISIENSI' as const,
      owner_role: 'finance_manager',
      frequency: 'BULANAN' as const,
      attribution_level: 'PERUSAHAAN' as const,
      visibility: ['ATASAN'],
      sort_order: idx
    }));
    const { error: kpiSeedError } = await adminClient.from('kpi_registry').insert(kpiRows);
    if (kpiSeedError) throw new Error(kpiSeedError.message);
  });

  afterAll(async () => {
    const cleanupSteps: Array<[string, () => any]> = [
      ['kpi_responsibilities', () => adminClient.from('kpi_responsibilities').delete().eq('company_id', companyId)],
      ['kpi_registry', () => adminClient.from('kpi_registry').delete().eq('company_id', companyId)],
      ['kamus_terms', () => adminClient.from('kamus_terms').delete().eq('company_id', companyId)]
    ];
    await cleanupCompanyCascade(adminClient, companyId, cleanupSteps);
  });

  it('menghapus 1 baris kpi_registry lalu memulihkannya -- pengawas gagal saat hilang, lulus lagi setelah dipulihkan', async () => {
    // kondisi awal (lengkap, dari beforeAll): pengawas harus lulus.
    const missingBefore = await findMissingKpiRegistryKeys(adminClient, companyId, EXPECTED_KATEGORI_A_METRIC_KEYS);
    expect(missingBefore).toEqual([]);

    // hapus 1 baris -- simulasi persis anomali yang diselidiki Sesi 0.
    const { data: victim } = await adminClient.from('kpi_registry').select('kpi_registry_id').eq('company_id', companyId).eq('metric_key', 'metric.nilai_persediaan').single();
    await adminClient.from('kpi_registry').delete().eq('kpi_registry_id', victim!.kpi_registry_id);

    const missingAfterDelete = await findMissingKpiRegistryKeys(adminClient, companyId, EXPECTED_KATEGORI_A_METRIC_KEYS);
    expect(missingAfterDelete, `Baris kpi_registry hilang untuk metric_key: ${missingAfterDelete.join(', ')}`).toEqual(['metric.nilai_persediaan']);

    // pulihkan.
    const { error: restoreError } = await adminClient.from('kpi_registry').insert([
      { company_id: companyId, metric_key: 'metric.nilai_persediaan', kind: 'HASIL', pillar: 'RECORD', owner_role: 'warehouse_manager', frequency: 'HARIAN', attribution_level: 'PERUSAHAAN', visibility: ['ATASAN'], sort_order: 99 }
    ]);
    if (restoreError) throw new Error(restoreError.message);

    const missingAfterRestore = await findMissingKpiRegistryKeys(adminClient, companyId, EXPECTED_KATEGORI_A_METRIC_KEYS);
    expect(missingAfterRestore).toEqual([]);
  });

  it('menghapus 1 baris kamus_terms scope METRIC lalu memulihkannya -- pengawas gagal saat hilang, lulus lagi setelah dipulihkan', async () => {
    // kondisi awal (lengkap, dari beforeAll): pengawas harus lulus.
    const missingBefore = await findMissingKamusMetricKeys(adminClient, companyId, EXPECTED_KAMUS_METRIC_TERM_KEYS);
    expect(missingBefore).toEqual([]);

    const { data: victim } = await adminClient.from('kamus_terms').select('kamus_term_id').eq('company_id', companyId).eq('term_key', 'metric.sisa_reprocessable').single();
    await adminClient.from('kamus_terms').delete().eq('kamus_term_id', victim!.kamus_term_id);

    const missingAfterDelete = await findMissingKamusMetricKeys(adminClient, companyId, EXPECTED_KAMUS_METRIC_TERM_KEYS);
    expect(missingAfterDelete, `Baris kamus_terms scope=METRIC hilang untuk term_key: ${missingAfterDelete.join(', ')}`).toEqual(['metric.sisa_reprocessable']);

    const { error: restoreError } = await adminClient.from('kamus_terms').insert([
      { company_id: companyId, scope: 'METRIC', term_key: 'metric.sisa_reprocessable', priority: 3, domain: 'uang', status: 'DRAF_AI' }
    ]);
    if (restoreError) throw new Error(restoreError.message);

    const missingAfterRestore = await findMissingKamusMetricKeys(adminClient, companyId, EXPECTED_KAMUS_METRIC_TERM_KEYS);
    expect(missingAfterRestore).toEqual([]);
  });
});
