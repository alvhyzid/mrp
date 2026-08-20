import type { SupabaseClient } from '@supabase/supabase-js';

// Baris METRIC (bukan hasil scan skema -- formula bisnis, bukan 1 kolom) --
// dikutip PERSIS dari docs/spesifikasi-aturan-biaya-v1.md §3 "Rumus v1", TIDAK
// DITEBAK (instruksi eksplisit §3.4 dokumen kamus: "Dilarang menebak untuk
// scope METRIC yang sudah didefinisikan di spesifikasi biaya -- kutip
// definisi resminya").
const METRIC_TERMS: { term_key: string; ai_draft: string; domain?: string; suggested_role?: string }[] = [
  {
    term_key: 'metric.biaya_bahan_batch',
    ai_draft:
      'Kutipan resmi (docs/spesifikasi-aturan-biaya-v1.md §3): "Biaya bahan batch = Σ (qty bahan aktual terpakai × harga per unit LOT yang dipakai) + Σ (qty premix aktual × biaya per unit LOT premix). Bahan milik client: qty tercatat, biaya = 0."'
  },
  {
    term_key: 'metric.biaya_produksi_per_unit',
    domain: 'uang',
    suggested_role: 'finance',
    ai_draft:
      'KPI (docs/rencana-kerja-kpi.md §3.1 & §4 #2): biaya produksi per unit per produk = (biaya bahan standar/unit + biaya kemasan standar/unit + biaya SDM standar/unit) untuk item finished_good tsb, dari computeStandardCostPerUnit.ts + computeStandardLaborCostPerUnit.ts (rumus SAMA dgn Margin Watch "Biaya standar"). Dasar quotation & deteksi kenaikan biaya diam-diam. Kartu KPI menampilkan rata-rata lintas produk aktif + rincian per produk.'
  },
  {
    term_key: 'metric.yield_per_tahap_produk',
    domain: 'kuantitas',
    suggested_role: 'produksi',
    ai_draft:
      'KPI (docs/rencana-kerja-kpi.md §3.2 & §4 #4): yield = output tahap TERAKHIR (baik, sudah dikurangi reject) ÷ input tahap PERTAMA × 100%, PERSIS rumus getBatchYieldSummary.ts, dirata-rata lintas batch SELESAI dalam periode. attribution_level = LINI/PROSES (BUKAN individu operator -- dipengaruhi lot bahan, mesin, tahap sebelumnya, bukan kendali satu orang).'
  },
  {
    term_key: 'metric.margin_kontribusi_persen',
    domain: 'uang',
    suggested_role: 'finance',
    ai_draft:
      'KPI (permintaan pemilik produk 25 Agu 2026): Margin Kontribusi (Rupiah) ÷ Total nilai jual × 100. Data SAMA dengan metric.margin_kontribusi, cuma dinyatakan persentase. Target 35% berasal dari kebijakan GPM tim finance. CATATAN PENTING: GPM (Gross Profit Margin) dihitung setelah SELURUH harga pokok termasuk overhead pabrik, sedangkan Margin Kontribusi belum dikurangi overhead (aturan K2 -- overhead hanya masuk di Laba Operasional bulanan). Karena itu angka Margin Kontribusi % SELALU LEBIH TINGGI dari GPM sesungguhnya -- kalau angka ini sudah di bawah 35%, kondisi sebenarnya lebih buruk lagi. Dipasang tetap sebagai peringatan dini konservatif ke arah yang benar, bukan pengukur GPM yang presisi.'
  },
  {
    term_key: 'metric.nilai_persediaan',
    domain: 'uang',
    suggested_role: 'finance',
    ai_draft:
      'KPI (docs/rencana-kerja-kpi.md §3.1 & §4 #5): nilai persediaan = Σ (quantity_on_hand × unit_cost) seluruh lot berstatus available, company ini, SEMUA lokasi. "Uang yang tidur di gudang." Dihitung HARIAN (prasyarat inventory turnover/DIO nanti).'
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
  },
  // Cicilan KPI-0 (25 Agu 2026, tumpangan §5 rencana-kerja-kpi.md) -- 7 KPI kategori B
  // sisa dari paket awal 12 (#6-12). INI BACKLOG DRAF_AI SAJA, BUKAN rumus final/KPI
  // hidup -- rumusnya baru dibangun & divalidasi contoh hitung manual pemilik KPI di
  // sesi KPI-2/KPI-3 (masih digerbang SAS001 & SAS005 terkirim). Routing per aturan
  // yang sudah ada: uang->Finance, produksi->SPV, pengiriman->PPIC, supplier->Purchasing.
  {
    term_key: 'metric.otd',
    domain: 'kuantitas',
    suggested_role: 'ppic',
    ai_draft:
      'KPI backlog (docs/rencana-kerja-kpi.md §3.4 & §4 #6, BELUM final): On-Time Delivery = jumlah kiriman tepat waktu (vs tanggal janji sales_orders) ÷ total kiriman × 100%. Sumber data: shipments + tanggal janji SO. Benchmark katalog: ~95% baik, 98% kelas dunia -- BUKAN target resmi sampai divalidasi PPIC/Sales.'
  },
  {
    term_key: 'metric.production_attainment',
    domain: 'kuantitas',
    suggested_role: 'ppic',
    ai_draft:
      'KPI backlog (docs/rencana-kerja-kpi.md §4 #7, BELUM final): Production attainment = qty aktual diproduksi ÷ qty rencana (planned_qty) per periode × 100%. Sumber data: production_batches (planned_qty vs actual dari work_order_outputs). Frekuensi harian per katalog.'
  },
  {
    term_key: 'metric.downtime_persen_pareto',
    domain: 'proses',
    suggested_role: 'production',
    ai_draft:
      'KPI backlog (docs/rencana-kerja-kpi.md §3.2 & §4 #8, BELUM final): Downtime % = total jam henti (production_disruptions, dari started_at s/d resolved_at) ÷ jam rencana kerja periode itu × 100%, diurai per disruption_type (Pareto) -- kategori changeover BARU ditambahkan 25 Agu 2026 supaya punya riwayat sejak sekarang. PRASYARAT: disiplin klasifikasi downtime (KPI DISIPLIN terpisah, KPI-2).'
  },
  {
    term_key: 'metric.rejection_persen',
    domain: 'kuantitas',
    suggested_role: 'production',
    ai_draft:
      'KPI backlog (docs/rencana-kerja-kpi.md §3.3 & §4 #9, BELUM final): Rejection/scrap % = qty reject/gagal ÷ total qty diproses per periode × 100%. Sumber data kandidat: work_order_outputs (output non-finished_good/waste) + flag `production_batches.rework` (BARU ditambahkan 25 Agu 2026). Pemilik katalog: QC (belum ada department "qc" terpisah di sistem ini -- dirutekan ke production sampai ada keputusan lain).'
  },
  {
    term_key: 'metric.cycle_time_order_kirim',
    domain: 'proses',
    suggested_role: 'ppic',
    ai_draft:
      'KPI backlog (docs/rencana-kerja-kpi.md §4 #10, BELUM final): Cycle time order->kirim = rata-rata (tanggal shipment pertama SO − tanggal SO dibuat) per periode. Menumpang keluaran Process Mining Fase 0.4 (transisi status sales_orders) -- BUKAN dihitung dari nol.'
  },
  {
    term_key: 'metric.stock_out_events',
    domain: 'kuantitas',
    suggested_role: 'warehouse',
    ai_draft:
      'KPI backlog (docs/rencana-kerja-kpi.md §4 #11, BELUM final): Stock-out events = jumlah kejadian quantity_on_hand suatu item menyentuh 0 (atau alert stock_depletion_forecast terealisasi) dalam periode. Pemilik katalog: Gudang/Purchasing.'
  },
  {
    term_key: 'metric.supplier_otd',
    domain: 'kuantitas',
    suggested_role: 'purchasing',
    ai_draft:
      'KPI backlog (docs/rencana-kerja-kpi.md §3.4 & §4 #12, BELUM final): Supplier OTD = kedatangan goods_receipts tepat/sebelum tanggal janji purchase_order_lines ÷ total PO diterima per supplier per periode × 100%. Dasar negosiasi & seleksi supplier.'
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
    domain: m.domain ?? 'uang',
    suggested_role: m.suggested_role ?? 'finance',
    status: 'DRAF_AI',
    ai_draft: m.ai_draft
  }));

  const { data: inserted, error } = await adminClient.from('kamus_terms').upsert(rows, { onConflict: 'company_id,term_key', ignoreDuplicates: true }).select('kamus_term_id');
  if (error) throw new Error(`Gagal insert kamus_terms (METRIC): ${error.message}`);

  return { inserted: inserted?.length ?? 0, skippedExisting: rows.length - (inserted?.length ?? 0) };
}
