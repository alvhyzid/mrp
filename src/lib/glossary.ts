// Glossary terpusat (Sesi 6, 21 Agu 2026) — SATU SUMBER KEBENARAN untuk
// menerjemahkan identifier teknis (nama tabel/kolom database, nilai enum
// mentah, slug peran) menjadi label & kalimat yang bisa dibaca pemilik
// pabrik tanpa merasa sedang membaca kode. Keluhan nyata yang melatari ini:
// "Kolom `unit_price` di tabel `customer_purchase_order_lines` (numeric)"
// dan "saya sendiri sebagai pemilik tidak paham karena saat membaca itu
// seperti membaca hasil coding yg ditulis didalam system, bukan yg muncul
// di UI."
//
// SELURUH komponen UI WAJIB mengambil label dari sini — DILARANG menyebar
// string label baru langsung di komponen (kalau tersebar, istilah yang sama
// bisa punya nama berbeda di halaman berbeda). Kalau istilah sudah punya
// baris di Kamus (`kamus_terms`), label di sini WAJIB sama persis dengan
// jawaban Kamus (Kamus adalah rujukan, bukan pesaing) — lihat komentar di
// tiap kelompok di bawah untuk status penyelarasan itu.
//
// Halaman Kamus & panel Asal-Usul (ProvenanceInfoButton) TETAP menampilkan
// identifier teknis, TAPI di balik pengungkap "Detail Teknis" tertutup
// (hanya company_admin) — glossary ini yang dipakai utk lapisan tampilan
// utamanya (lihat humanizeProvenanceText() di bawah, dipakai
// provenance-info-button.tsx).

// ============================================================================
// NAMA TABEL (entity) -> nama bisnis
// ============================================================================
export const ENTITY_LABELS: Record<string, string> = {
  companies: 'Perusahaan',
  subscription_plans: 'Paket Langganan',
  users: 'Pengguna',
  document_signatures: 'Tanda Tangan Dokumen',
  invitations: 'Undangan Tim',
  production_plants: 'Pabrik/Lokasi Produksi',
  shifts: 'Shift Kerja',
  production_disruptions: 'Gangguan Produksi',
  employees: 'Karyawan',
  employee_attendance: 'Rekap Absensi',
  company_settings: 'Pengaturan Perusahaan',
  items: 'Item',
  boms: 'BOM (Resep)',
  bom_lines: 'Baris BOM',
  work_centers: 'Lini/Stasiun Kerja',
  routings: 'Routing (Alur Produksi)',
  routing_steps: 'Tahap Routing',
  routing_step_standard_crew: 'Standar Kru Lini',
  production_standards: 'Standar Produksi',
  production_standard_proposals: 'Usulan Standar Produksi',
  production_standard_samples: 'Sampel Standar Produksi',
  production_standard_exclusions: 'Pengecualian Standar Produksi',
  formula_templates: 'Template Formula',
  lots: 'Lot Stok',
  lot_genealogy: 'Telusur Asal Bahan',
  stock_movements: 'Pergerakan Stok',
  suppliers: 'Pemasok',
  purchase_orders: 'PO Supplier',
  purchase_order_lines: 'Baris PO Supplier',
  goods_receipts: 'Penerimaan Barang',
  goods_receipt_lines: 'Baris Penerimaan Barang',
  customers: 'Pelanggan',
  customer_purchase_orders: 'PO Klien',
  customer_purchase_order_lines: 'Baris PO Klien',
  customer_po_approvals: 'Persetujuan PO Klien',
  sales_orders: 'Sales Order',
  sales_order_lines: 'Baris Sales Order',
  sales_order_line_feasibility_snapshots: 'Baseline Kelayakan Jadwal',
  sales_order_line_margin_snapshots: 'Baseline Margin Watch',
  shipments: 'Pengiriman',
  shipment_lines: 'Baris Pengiriman',
  delivery_confirmations: 'Bukti Penerimaan',
  production_batches: 'Batch Produksi',
  production_batch_routing_step_snapshots: 'Tahap Routing Beku per Batch',
  production_batch_standard_crew_snapshots: 'Standar Kru Beku per Batch',
  production_batch_bom_line_snapshots: 'Baris BOM Beku per Batch',
  work_orders: 'Work Order',
  work_order_outputs: 'Hasil Produksi',
  work_order_consumption: 'Pemakaian Bahan',
  work_order_assignments: 'Penugasan Kerja',
  work_order_step_progress: 'Progres Tahap Produksi',
  system_alerts: 'Peringatan Sistem',
  status_transition_rules: 'Aturan Transisi Status',
  status_transition_log: 'Riwayat Transisi Status',
  invoices: 'Tagihan Langganan',
  kamus_terms: 'Istilah Kamus',
  kamus_term_history: 'Riwayat Istilah Kamus',
  kamus_routing_rules: 'Aturan Penugasan Kamus',
  ai_project_phases: 'Fase Proyek AI',
  ai_project_tasks: 'Tugas Proyek AI',
  ai_project_checklist_items: 'Item Checklist Proyek AI',
  ai_project_progress_snapshots: 'Riwayat Progres Proyek AI',
  ai_capabilities: 'Kemampuan AI',
  ai_capability_requirements: 'Prasyarat Kemampuan AI',
  ai_capability_status: 'Status Kemampuan AI',
  ai_capability_overrides: 'Override Kemampuan AI',
  ai_answer_feedback: 'Umpan Balik Jawaban AI',
  attendance_events: 'Kejadian Absensi',
  attendance_devices: 'Perangkat Absensi',
  attendance_corrections: 'Koreksi Absensi',
  leave_requests: 'Pengajuan Cuti',
  kpi_registry: 'Daftar KPI',
  kpi_snapshots: 'Riwayat Nilai KPI',
  kpi_actions: 'Aksi Perbaikan KPI',
  kpi_responsibilities: 'Penanggung Jawab KPI',
  kpi_registry_history: 'Riwayat Perubahan KPI',
  document_types: 'Jenis Dokumen',
  documents: 'Dokumen',
  document_links: 'Tautan Dokumen',
  document_access_log: 'Riwayat Akses Dokumen'
};

// ============================================================================
// NAMA KOLOM (field) -> label bisnis, generik lintas-tabel (kolom dengan nama
// yang sama biasanya berarti sama, mis. unit_price selalu "Harga Satuan" apa
// pun tabelnya). Override per-tabel taruh di FIELD_LABELS_BY_ENTITY di bawah
// kalau makna sebuah kolom BEDA tergantung tabelnya.
// ============================================================================
export const FIELD_LABELS: Record<string, string> = {
  company_id: 'ID Perusahaan',
  user_id: 'ID Pengguna',
  name: 'Nama',
  email: 'Email',
  industry_type: 'Jenis Industri',
  unit_price: 'Harga Satuan',
  unit_cost: 'Biaya Satuan',
  standard_cost: 'Biaya Standar',
  qty_per_unit_output: 'Rasio Bahan per Unit Hasil',
  qty_ordered: 'Jumlah Dipesan',
  qty_shipped: 'Jumlah Dikirim',
  qty_received: 'Jumlah Diterima',
  qty_consumed: 'Jumlah Dipakai',
  qty_reject: 'Jumlah Reject',
  qty_recorded: 'Jumlah Tercatat',
  qty_input: 'Jumlah Masuk',
  quantity_on_hand: 'Stok Tersedia',
  planned_qty: 'Jumlah Rencana',
  buffer_percentage: 'Persentase Buffer',
  standard_yield_qty: 'Jumlah Hasil Standar',
  standard_yield_basis_note: 'Keterangan Asal Angka Hasil Standar',
  standard_yield_source: 'Sumber Angka Hasil Standar',
  active_duration_minutes: 'Durasi Aktif',
  wait_duration_minutes: 'Durasi Tunggu',
  duration_per_unit_minutes: 'Laju per Unit',
  capacity_hours_per_day: 'Kapasitas per Hari',
  unit_count: 'Jumlah Unit Mesin',
  work_center_id: 'Lini/Stasiun Kerja',
  routing_step_id: 'Tahap Routing',
  is_blocking: 'Sifat Menghambat',
  metric_key: 'Kunci Metrik',
  term_key: 'Kunci Istilah',
  progress_source: 'Sumber Progres',
  readiness_percent: 'Persentase Kesiapan',
  monthly_overhead_baseline: 'Baseline Overhead Bulanan',
  overhead_allocation: 'Alokasi Overhead',
  wage_type: 'Jenis Upah',
  wage_rate: 'Tarif Upah',
  bpjs_kesehatan_enrolled: 'Status Terdaftar BPJS Kesehatan',
  bpjs_contribution_basis: 'Basis Iuran BPJS',
  bpjs_wage_basis_floor: 'Batas Bawah Basis Upah BPJS',
  bpjs_wage_basis_ceiling: 'Batas Atas Basis Upah BPJS',
  output_type: 'Jenis Hasil',
  doc_type: 'Jenis Dokumen',
  doc_number: 'Nomor Dokumen',
  issued_date: 'Tanggal Terbit',
  expiry_date: 'Tanggal Kedaluwarsa',
  payment_status: 'Status Pembayaran',
  approval_status: 'Status Persetujuan',
  work_order_id: 'Work Order',
  production_batch_id: 'Batch Produksi',
  sales_order_line_id: 'Baris Sales Order',
  production_disruption_id: 'Gangguan Produksi',
  production_standard_proposal_id: 'Usulan Standar Produksi',
  purchase_order_id: 'PO Supplier',
  confirmation_text: 'Teks Konfirmasi',
  manual_percent: 'Persentase Manual',
  domain: 'Kategori Data',
  entity: 'Tabel',
  field: 'Kolom',
  scope: 'Cakupan',
  event_type: 'Jenis Kejadian',
  leave_type: 'Jenis Cuti',
  status: 'Status',
  role: 'Peran',
  sensitivity: 'Tingkat Kerahasiaan',
  severity: 'Tingkat Keparahan'
};

// Override spesifik "entity.field" kalau makna kolom itu beda dari makna
// generiknya di FIELD_LABELS di atas untuk tabel tertentu.
export const FIELD_LABELS_BY_ENTITY: Record<string, string> = {
  'ai_project_tasks.progress_source': 'Sumber Progres Tugas'
};

// ============================================================================
// PERAN (role, users.role) -> label bisnis. WAJIB dipakai di seluruh dropdown/
// badge peran -- JANGAN pernah tampilkan slug mentah (mis. "ppic_manager").
// ============================================================================
export const ROLE_LABELS: Record<string, string> = {
  company_admin: 'Admin Perusahaan',
  general_manager: 'General Manager',
  admin_staff: 'Staf Admin',
  production_manager: 'Manajer Produksi',
  production_staff: 'Staf Produksi',
  ppic_manager: 'Manajer PPIC',
  ppic_staff: 'Staf PPIC',
  finance_manager: 'Manajer Finance',
  finance_staff: 'Staf Finance',
  purchasing_manager: 'Manajer Purchasing',
  purchasing_staff: 'Staf Purchasing',
  warehouse_manager: 'Manajer Gudang',
  warehouse_staff: 'Staf Gudang',
  hr_manager: 'Manajer HRD',
  hr_staff: 'Staf HRD',
  viewer: 'Pengamat (Lihat Saja)'
};

export function getRoleLabel(role: string | null | undefined): string {
  if (!role) return '-';
  return ROLE_LABELS[role] ?? role;
}

// ============================================================================
// NILAI ENUM lintas-tabel yang sering bocor mentah (status universal, jenis
// departemen, dst). Status yang MAKNANYA beda per konteks (mis. kpi_actions.
// status) tetap sebaiknya punya map lokal di halamannya sendiri -- ini cuma
// menampung yang benar-benar dipakai berulang di banyak tempat.
// ============================================================================
export const COMMON_STATUS_LABELS: Record<string, string> = {
  draft: 'Draf',
  active: 'Aktif',
  archived: 'Diarsipkan',
  processed: 'Diproses',
  confirmed: 'Dikonfirmasi',
  new: 'Baru',
  pending: 'Menunggu',
  approved: 'Disetujui',
  rejected: 'Ditolak',
  planned: 'Direncanakan',
  in_progress: 'Berjalan',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
  paused: 'Dijeda',
  shipped: 'Dikirim',
  delivered: 'Diterima',
  on_hold: 'Ditunda',
  partial: 'Sebagian',
  trial: 'Uji Coba',
  suspended: 'Ditangguhkan',
  invited: 'Diundang'
};

export const DEPARTMENT_LABELS: Record<string, string> = {
  production: 'Produksi',
  ppic: 'PPIC',
  finance: 'Finance',
  purchasing: 'Purchasing',
  warehouse: 'Gudang',
  hr: 'HRD',
  management: 'Manajemen',
  fat: 'FAT (Uji Terima)',
  rnd: 'R&D'
};

export const ATTENDANCE_EVENT_TYPE_LABELS: Record<string, string> = {
  IN: 'Masuk',
  OUT: 'Pulang',
  BREAK_START: 'Mulai Istirahat',
  BREAK_END: 'Selesai Istirahat'
};

export const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: 'Cuti Tahunan',
  sick: 'Sakit',
  unpaid: 'Tanpa Gaji',
  other: 'Lainnya'
};

// ============================================================================
// Helper: label field, dicoba entity-specific dulu baru generik, terakhir
// jatuh balik ke field mentah (dirapikan jadi Title Case) kalau memang belum
// terdaftar -- supaya tetap TIDAK PERNAH menampilkan underscore mentah walau
// istilahnya belum sempat dikurasi manual.
// ============================================================================
export function getFieldLabel(field: string | null | undefined, entity?: string | null): string {
  if (!field) return '-';
  if (entity) {
    const specific = FIELD_LABELS_BY_ENTITY[`${entity}.${field}`];
    if (specific) return specific;
  }
  if (FIELD_LABELS[field]) return FIELD_LABELS[field];
  return titleCaseFromSnake(field);
}

export function getEntityLabel(entity: string | null | undefined): string {
  if (!entity) return '-';
  return ENTITY_LABELS[entity] ?? titleCaseFromSnake(entity);
}

function titleCaseFromSnake(s: string): string {
  return s
    .split('.')
    .pop()!
    .split('_')
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

// Judul manusia untuk 1 baris Kamus (kamus_terms) -- format persis contoh
// yang diminta: "Harga Satuan (Baris PO Klien)" untuk scope FIELD, atau cuma
// nama metrik utk scope METRIC/RULE/RELATION (yang tidak punya field kolom).
export function getKamusTermTitle(term: { scope: string; entity: string | null; field: string | null; term_key: string }): string {
  if (term.scope === 'FIELD' && term.entity && term.field) {
    return `${getFieldLabel(term.field, term.entity)} (${getEntityLabel(term.entity)})`;
  }
  if (term.scope === 'RELATION' && term.entity) {
    return getEntityLabel(term.entity);
  }
  // METRIC/RULE: term_key biasanya "metric.xxx" atau "rule.xxx" -- ambil
  // bagian setelah titik, title-case-kan.
  const afterDot = term.term_key.includes('.') ? term.term_key.split('.').slice(1).join('.') : term.term_key;
  return titleCaseFromSnake(afterDot);
}

// ============================================================================
// Humanisasi teks bebas (dipakai ProvenanceInfoButton utk "Rumus"/"Nilai
// Input"/"Dokumen Sumber") -- mengganti token snake_case yang DIKENALI
// glossary ini dengan labelnya, token yang TIDAK dikenal dibiarkan apa adanya
// (tidak memperburuk, sekadar tidak sempat dikurasi). Non-admin TIDAK PERNAH
// melihat versi mentahnya sama sekali (lihat provenance-info-button.tsx --
// versi asli hanya dikirim ke "Detail Teknis" yang tertutup untuk selain
// company_admin).
// ============================================================================
// Dua pola terpisah, DIURUTKAN (dotted dulu, baru bare) -- pola dotted
// SENGAJA tidak mensyaratkan underscore di sisi kiri titik (banyak nama tabel
// seperti "items"/"boms"/"lots" satu kata saja) supaya "items.standard_cost"
// ikut cocok, bukan cuma "standard_cost"-nya sendirian (yang kehilangan
// konteks tabelnya). Aman dari salah tangkap kalimat biasa karena tanda titik
// akhir kalimat SELALU diikuti spasi ("...ini. Kalimat lain") -- pola di
// bawah TIDAK mengizinkan spasi di sekitar titik sama sekali.
const DOTTED_TOKEN_RE = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)*\.[a-z][a-z0-9]*(?:_[a-z0-9]+)*\b/g;
const BARE_SNAKE_TOKEN_RE = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/g;

// Draf otomatis Kamus (generateKamusBacklog.ts) ditulis dengan pola tetap
// "[PERLU KONFIRMASI] Kolom `x` di tabel `y` (tipe data)." -- keluhan nyata
// pemilik produk PERSIS soal kalimat ini. entity/field SUDAH tersimpan
// terpisah di baris kamus_terms itu sendiri, jadi di sini disusun ulang dari
// situ (bukan mem-parsing string tersimpan) supaya hasilnya konsisten dengan
// judul kartu (getKamusTermTitle). Draf yang BUKAN pola otomatis ini (ditulis
// manusia lain/versi mendatang) tetap lewat humanizeProvenanceText() sebagai
// jaring pengaman generik.
export function humanizeKamusDraft(term: { ai_draft: string | null; entity: string | null; field: string | null }): string | null {
  if (!term.ai_draft) return null;
  if (term.ai_draft.startsWith('[PERLU KONFIRMASI]') && term.entity && term.field) {
    return `Ini kolom "${getFieldLabel(term.field, term.entity)}" pada data ${getEntityLabel(term.entity)} -- belum ada penjelasan makna bisnisnya dari manusia, murni tebakan awal dari nama kolomnya.`;
  }
  return humanizeProvenanceText(term.ai_draft);
}

export function humanizeProvenanceText(raw: string): string {
  const afterDotted = raw.replace(DOTTED_TOKEN_RE, (token) => {
    const [ent, fld] = token.split('.');
    if (ENTITY_LABELS[ent] && fld) {
      return `${getFieldLabel(fld, ent)} (${getEntityLabel(ent)})`;
    }
    return token;
  });
  return afterDotted.replace(BARE_SNAKE_TOKEN_RE, (token) => {
    if (ENTITY_LABELS[token]) return getEntityLabel(token);
    if (FIELD_LABELS[token]) return FIELD_LABELS[token];
    return token;
  });
}
