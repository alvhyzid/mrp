import type { SupabaseClient } from '@supabase/supabase-js';

// 5 KPI kategori A (docs/rencana-kerja-kpi.md §4 #1-5) -- semua sudah punya data,
// tinggal kartu. target_value/benchmark_value SEMUA null (baseline dulu, target
// kemudian, prinsip "baseline dulu" §4 dokumen). PENGECUALIAN yang DIPERIKSA sebelum
// dilewatkan: dokumen §3 "penyerahan-opus-fitur-kpi.md" menyebut GPM/margin 35% =
// target resmi perusahaan -- TAPI 35% adalah PERSENTASE (gross profit margin),
// sedangkan KPI #1 di sini ("Margin kontribusi per order") berdenominasi RUPIAH
// ABSOLUT (Harga jual - biaya variabel, rumus di kamus metric.margin_kontribusi).
// Menaruh target_value=35 di baris berdenominasi Rupiah akan menghasilkan "delta vs
// target" yang tidak masuk akal (35 dibanding puluhan juta Rupiah). TIDAK diterapkan
// -- dilaporkan di HANDOFF untuk klarifikasi pemilik produk, bukan dipaksakan.
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
    sort_order: idx
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
