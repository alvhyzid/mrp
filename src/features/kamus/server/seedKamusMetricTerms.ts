import type { SupabaseClient } from '@supabase/supabase-js';

// Baris METRIC (bukan hasil scan skema -- formula bisnis, bukan 1 kolom) --
// dikutip PERSIS dari docs/spesifikasi-aturan-biaya-v1.md §3 "Rumus v1", TIDAK
// DITEBAK (instruksi eksplisit §3.4 dokumen kamus: "Dilarang menebak untuk
// scope METRIC yang sudah didefinisikan di spesifikasi biaya -- kutip
// definisi resminya").
const METRIC_TERMS = [
  {
    term_key: 'metric.biaya_bahan_batch',
    ai_draft:
      'Kutipan resmi (docs/spesifikasi-aturan-biaya-v1.md §3): "Biaya bahan batch = Σ (qty bahan aktual terpakai × harga per unit LOT yang dipakai) + Σ (qty premix aktual × biaya per unit LOT premix). Bahan milik client: qty tercatat, biaya = 0."'
  },
  {
    term_key: 'metric.biaya_sdm_batch',
    ai_draft:
      'Kutipan resmi (docs/spesifikasi-aturan-biaya-v1.md §3): "Biaya SDM batch = Σ (jam tercatat per orang × tarif per jam orang itu)." [CATATAN 21 Agu 2026: sejak Bagian D/perbaikan basis pemberi kerja, tarif per jam sudah termasuk BPJS pemberi kerja untuk karyawan bulanan -- lihat routing_step_standard_crew & computeStandardLaborCostPerUnit.ts untuk detail terkini.]'
  },
  {
    term_key: 'metric.biaya_kemasan_order',
    ai_draft:
      'Kutipan resmi (docs/spesifikasi-aturan-biaya-v1.md §3): "Biaya kemasan order = Σ (qty kemasan aktual terpakai × harga per unit LOT)."'
  },
  {
    term_key: 'metric.sisa_reprocessable',
    ai_draft: 'Kutipan resmi (docs/spesifikasi-aturan-biaya-v1.md §3): "Sisa reprocessable = biaya 0, qty & lot tetap tercatat."'
  },
  {
    term_key: 'metric.biaya_produksi_order',
    ai_draft:
      'Kutipan resmi (docs/spesifikasi-aturan-biaya-v1.md §3): "Biaya produksi order = Σ biaya batch yang mengerjakan order + biaya kemasan."'
  },
  {
    term_key: 'metric.margin_kontribusi',
    ai_draft:
      'Kutipan resmi (docs/spesifikasi-aturan-biaya-v1.md §3): "Margin kontribusi = (harga jual × qty terkirim) − biaya produksi order." Dihitung PER PENGIRIMAN, bukan nunggu SO selesai total -- lihat get_sales_order_margin() & get_monthly_operating_profit().'
  },
  {
    term_key: 'metric.laba_operasional_bulanan',
    ai_draft:
      'Kutipan resmi (docs/spesifikasi-aturan-biaya-v1.md §3): "Laba operasional bln = Σ margin kontribusi bulan itu − total overhead bulan itu." [CATATAN 21 Agu 2026: "bulan" sekarang berarti PERIODE GAJIAN (26 s/d 25) kalau company_settings.payroll_period_start_day diisi, bukan lagi selalu bulan kalender -- lihat get_monthly_operating_profit().]'
  }
];

export async function seedKamusMetricTerms(adminClient: SupabaseClient, companyId: number): Promise<{ inserted: number; skippedExisting: number }> {
  const rows = METRIC_TERMS.map((m) => ({
    company_id: companyId,
    scope: 'METRIC',
    entity: null,
    field: null,
    term_key: m.term_key,
    priority: 1,
    domain: 'uang',
    suggested_role: 'finance',
    status: 'DRAF_AI',
    ai_draft: m.ai_draft
  }));

  const { data: inserted, error } = await adminClient.from('kamus_terms').upsert(rows, { onConflict: 'company_id,term_key', ignoreDuplicates: true }).select('kamus_term_id');
  if (error) throw new Error(`Gagal insert kamus_terms (METRIC): ${error.message}`);

  return { inserted: inserted?.length ?? 0, skippedExisting: rows.length - (inserted?.length ?? 0) };
}
