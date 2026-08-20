import type { SupabaseClient } from '@supabase/supabase-js';

// 6 KPI kategori A (docs/rencana-kerja-kpi.md §4 #1-5 + Margin Kontribusi % 25 Agu
// 2026). target_value/benchmark_value SEMUA null (baseline dulu, target kemudian,
// prinsip "baseline dulu" §4 dokumen) -- TANPA KECUALI.
//
// RIWAYAT (target 35% SUDAH DICABUT 26 Agu 2026, dicatat supaya tidak dipasang
// ulang tanpa sadar): dokumen §3 "penyerahan-opus-fitur-kpi.md" awalnya menyebut
// GPM/margin 35% = target resmi perusahaan. 25 Agu 2026 sempat dipasang ke KPI
// "Margin Kontribusi %" (bukan KPI #1 yang berdenominasi Rupiah -- unit mismatch).
// 26 Agu 2026, keputusan pemilik produk: 35% itu angka dari KONTEKS SIMULASI PO
// lama (Gummy Zala/Drinkme), BUKAN kebijakan yang berlaku untuk studi kasus baru
// (MLVT) -- DICABUT SEPENUHNYA, bukan cuma diganti angka. Target margin sekarang
// diisi PER PRODUK/ORDER lewat updateKpiTarget.ts (baseline dulu, target
// kemudian -- SAMA seperti 5 KPI lain, tidak ada lagi KPI dengan target
// hardcode di seed). Kalau finance menetapkan kebijakan GPM baru utk MLVT
// kelak, itu masuk lewat alur updateKpiTarget yang SUDAH ADA (tercatat
// kpi_registry_history), bukan dipasang lagi di seed ini.
const KPI_DEFINITIONS = [
  {
    metric_key: 'metric.margin_kontribusi',
    kind: 'HASIL' as const,
    pillar: 'EFISIENSI' as const,
    owner_role: 'finance_manager',
    frequency: 'BULANAN' as const,
    // PERUSAHAAN: Σ margin kontribusi SELURUH pengiriman bulan ini -- satu angka
    // holistik, bukan angka yang adil dipecah per lini/individu tanpa konteks order.
    attribution_level: 'PERUSAHAAN' as const,
    visibility: ['ATASAN', 'DEPARTEMEN'],
    pemilik_role: 'finance_manager',
    kontributor_roles: ['ppic_manager']
  },
  {
    metric_key: 'metric.margin_kontribusi_persen',
    kind: 'HASIL' as const,
    pillar: 'EFISIENSI' as const,
    owner_role: 'finance_manager',
    frequency: 'BULANAN' as const,
    attribution_level: 'PERUSAHAAN' as const,
    visibility: ['ATASAN', 'DEPARTEMEN'],
    pemilik_role: 'finance_manager',
    kontributor_roles: ['ppic_manager']
    // Target/benchmark SENGAJA tidak diisi -- lihat riwayat GPM 35% di komentar
    // atas file ini (dicabut 26 Agu 2026). Baseline dulu, target kemudian, sama
    // seperti 5 KPI lain.
  },
  {
    metric_key: 'metric.biaya_produksi_per_unit',
    kind: 'HASIL' as const,
    pillar: 'EFISIENSI' as const,
    owner_role: 'finance_manager',
    frequency: 'BULANAN' as const,
    // LINI: angka ini INHERENTLY per-produk (rata-rata lintas produk menutupi
    // perbedaan nyata antar lini) -- LINI lebih jujur dari PERUSAHAAN di sini.
    attribution_level: 'LINI' as const,
    visibility: ['ATASAN', 'DEPARTEMEN'],
    pemilik_role: 'finance_manager',
    kontributor_roles: ['production_manager', 'purchasing_manager']
  },
  {
    metric_key: 'metric.laba_operasional_bulanan',
    kind: 'HASIL' as const,
    pillar: 'TRANSPARANSI' as const,
    owner_role: 'company_admin',
    frequency: 'BULANAN' as const,
    attribution_level: 'PERUSAHAAN' as const,
    visibility: ['ATASAN', 'DEPARTEMEN'],
    pemilik_role: 'company_admin',
    kontributor_roles: ['finance_manager']
  },
  {
    metric_key: 'metric.yield_per_tahap_produk',
    kind: 'HASIL' as const,
    pillar: 'OPTIMASI' as const,
    owner_role: 'production_manager',
    frequency: 'MINGGUAN' as const,
    // LINI (BUKAN individu -- instruksi eksplisit): dipengaruhi lot bahan, mesin,
    // tahap sebelumnya, bukan kendali satu operator.
    attribution_level: 'LINI' as const,
    visibility: ['ATASAN', 'DEPARTEMEN', 'PUBLIK_AGREGAT'],
    pemilik_role: 'production_manager',
    kontributor_roles: ['ppic_manager', 'warehouse_manager']
  },
  {
    metric_key: 'metric.nilai_persediaan',
    kind: 'HASIL' as const,
    pillar: 'RECORD' as const,
    owner_role: 'warehouse_manager',
    frequency: 'HARIAN' as const,
    attribution_level: 'PERUSAHAAN' as const,
    visibility: ['ATASAN', 'DEPARTEMEN'],
    pemilik_role: 'warehouse_manager',
    kontributor_roles: ['finance_manager']
  }
];

export async function seedKpiRegistry(adminClient: SupabaseClient, companyId: number): Promise<{ registryInserted: number; responsibilitiesInserted: number }> {
  const registryRows = KPI_DEFINITIONS.map((k, idx) => ({
    company_id: companyId,
    metric_key: k.metric_key,
    kind: k.kind,
    pillar: k.pillar,
    owner_role: k.owner_role,
    frequency: k.frequency,
    attribution_level: k.attribution_level,
    visibility: k.visibility,
    sort_order: idx,
    target_value: 'target_value' in k ? k.target_value : null,
    target_set_at: 'target_value' in k ? new Date().toISOString() : null,
    benchmark_label: 'benchmark_label' in k ? k.benchmark_label : null,
    benchmark_source: 'benchmark_source' in k ? k.benchmark_source : null
  }));

  const { data: inserted, error } = await adminClient.from('kpi_registry').upsert(registryRows, { onConflict: 'company_id,metric_key', ignoreDuplicates: true }).select('kpi_registry_id, metric_key');
  if (error) throw new Error(`Gagal seed kpi_registry: ${error.message}`);

  // Ambil ULANG semua baris (bukan cuma yang baru insert) supaya responsibilities
  // tetap ter-link dgn benar walau registry sudah ada dari run sebelumnya (idempoten).
  const { data: allRows, error: fetchError } = await adminClient.from('kpi_registry').select('kpi_registry_id, metric_key').eq('company_id', companyId);
  if (fetchError) throw new Error(`Gagal baca ulang kpi_registry: ${fetchError.message}`);
  const registryIdByMetricKey = new Map((allRows ?? []).map((r) => [r.metric_key, r.kpi_registry_id]));

  const responsibilityRows: { company_id: number; kpi_registry_id: number; role: string; responsibility: 'PEMILIK' | 'KONTRIBUTOR'; note: string | null }[] = [];
  for (const k of KPI_DEFINITIONS) {
    const registryId = registryIdByMetricKey.get(k.metric_key);
    if (!registryId) continue;
    responsibilityRows.push({ company_id: companyId, kpi_registry_id: registryId, role: k.pemilik_role, responsibility: 'PEMILIK', note: null });
    for (const role of k.kontributor_roles) {
      responsibilityRows.push({ company_id: companyId, kpi_registry_id: registryId, role, responsibility: 'KONTRIBUTOR', note: null });
    }
  }

  // kpi_responsibilities tidak punya unique constraint (many-to-many, boleh berubah
  // bebas) -- cek dulu supaya seed ulang tidak menggandakan baris yang sama.
  const { data: existingResp } = await adminClient.from('kpi_responsibilities').select('kpi_registry_id, role, responsibility').eq('company_id', companyId);
  const existingKeySet = new Set((existingResp ?? []).map((r) => `${r.kpi_registry_id}:${r.role}:${r.responsibility}`));
  const newRows = responsibilityRows.filter((r) => !existingKeySet.has(`${r.kpi_registry_id}:${r.role}:${r.responsibility}`));

  let respInserted = 0;
  if (newRows.length > 0) {
    const { data: insertedResp, error: respError } = await adminClient.from('kpi_responsibilities').insert(newRows).select('kpi_responsibility_id');
    if (respError) throw new Error(`Gagal insert kpi_responsibilities: ${respError.message}`);
    respInserted = insertedResp?.length ?? 0;
  }

  return { registryInserted: inserted?.length ?? 0, responsibilitiesInserted: respInserted };
}
