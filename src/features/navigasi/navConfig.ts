// KONFIGURASI NAVIGASI FABRIX (NAV-01 / DS-04, 25 Agu 2026).
//
// BERKAS TYPESCRIPT BERTIPE DI REPO, BUKAN TABEL DATABASE. Navigasi per-tenant belum
// dibutuhkan; menaruhnya di database berarti membangun kemampuan yang tidak ada pemakainya
// sambil menambah satu tempat lagi yang bisa menyimpang.
//
// ============================================================================
// ATURAN PALING PENTING TENTANG BERKAS INI
// ============================================================================
// Kolom `status` diisi DARI HASIL AUDIT (docs/ar0-inventaris-as-is.md dan
// docs/nav-matriks-status-dan-konflik.md), BUKAN diketik dari ingatan dan BUKAN disalin dari
// dokumen arsitektur.
//
// Alasannya doktrin proyek yang sudah berulang: status yang diketik dari ingatan adalah status
// yang berbohong. Dan di sini bohongnya mahal — pengguna melihat menu, mengira fiturnya ada,
// lalu berhenti mencari cara lain.
//
// Bila sebuah halaman baru dibangun, ubah statusnya DI SINI di giliran kerja yang sama.
// Penjaganya: tests/nav_status_jujur.test.ts membandingkan setiap `href` dengan route yang
// benar-benar ada di App Router, dan gagal bila ada yang mengaku aktif padahal halamannya
// tidak ada.
//
// ============================================================================
// KENAPA ITEM YANG BELUM ADA TETAP DITAMPILKAN
// ============================================================================
// Keputusan pemilik produk 25 Agu 2026, membatalkan aturan Fable "item parkir tidak muncul di
// navigasi publik". Alasannya sah: belum ada pengguna di luar tim internal sama sekali — nol
// akun manusia sungguhan dari 16 peran. Menyembunyikan sesuatu dari pengguna yang belum ada
// tidak menghasilkan apa-apa; menampilkan seluruhnya justru memberi PETA apa yang akan
// dikerjakan.
//
// SATU HAL YANG TETAP: item yang keputusannya DITOLAK ditandai 'ditolak', BUKAN 'belum-ada'.
// Menampilkan hal yang sudah ditolak seolah direncanakan akan membuat seseorang mengira ia
// akan dibangun.
//
// ============================================================================
// BAHASA
// ============================================================================
// Label NAVIGASI memakai Bahasa Inggris (keputusan D-3, 25 Agu 2026), mengikuti penamaan
// workspace di dokumen Information Architecture. Label ISI HALAMAN tetap Bahasa Indonesia dari
// Kamus. Keduanya tidak bertentangan: navigasi adalah nama modul, isi halaman adalah yang
// dibaca orang pabrik.
// Keterangan status di bawah SENGAJA Bahasa Indonesia — ia dibaca sebagai kalimat, bukan
// sebagai nama modul.

export type StatusNav =
  /// Halamannya ada dan terbukti terbuka di peramban.
  | 'aktif'
  /// Kemampuannya ada, tapi menumpang di halaman lain — belum punya layar sendiri.
  | 'sebagian'
  /// Belum ada apa pun. Ini mayoritas.
  | 'belum-ada'
  /// Sudah diputuskan TIDAK dibangun. Berbeda dari 'belum-ada', dan perbedaannya penting.
  | 'ditolak'
  /// Sengaja ditunda dengan pemicu tertulis.
  | 'diparkir'
  /// Alat internal; bukan untuk pengguna biasa.
  | 'internal';

export interface ItemNav {
  label: string;
  /// Diisi HANYA bila halamannya benar-benar ada. Item tanpa href tidak bisa diklik.
  href?: string;
  status: StatusNav;
  /// Keterangan tambahan yang muncul di bawah label untuk status non-aktif. Menjawab
  /// "kenapa ini tidak bisa dibuka", bukan sekadar menyatakan bahwa ia tidak bisa.
  keterangan?: string;
}

export interface WorkspaceNav {
  label: string;
  items: ItemNav[];
}

/// URUTAN MENGIKUTI FREKUENSI PAKAI HARIAN DI PABRIK (keputusan D-5), bukan abjad dan bukan
/// urutan dokumen arsitektur. Manufacturing dan Supply Chain di atas.
///
/// Workspace yang isinya hampir seluruhnya kosong sengaja ditaruh di bawah — menaruhnya di
/// atas berarti orang melewati menu kosong setiap hari sebelum sampai ke pekerjaannya.
export const WORKSPACES: WorkspaceNav[] = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', href: '/dashboard', status: 'aktif' },
      { label: 'My Work', status: 'belum-ada' },
      { label: 'Notifications', status: 'sebagian', keterangan: 'Lonceng ada di header; halamannya belum' },
      { label: 'Tasks & Approvals', status: 'sebagian', keterangan: 'Persetujuan PO klien ada di halamannya sendiri' },
      { label: 'Recent Activity', status: 'belum-ada' }
    ]
  },
  {
    label: 'Manufacturing',
    items: [
      { label: 'Work Orders', href: '/work-orders', status: 'aktif' },
      { label: 'Production', href: '/production', status: 'aktif' },
      { label: 'Production Schedule', href: '/ppic', status: 'sebagian', keterangan: 'Ada di dalam PPIC' },
      { label: 'Scrap / Rework', status: 'sebagian', keterangan: 'Tercatat di hasil Work Order, belum punya layar' },
      { label: 'Dispatch Board', status: 'belum-ada' },
      { label: 'Subcontracting', status: 'belum-ada' },
      { label: 'Production Reports', status: 'belum-ada' }
    ]
  },
  {
    label: 'Supply Chain',
    items: [
      { label: 'Warehouse', href: '/warehouse', status: 'aktif' },
      { label: 'Shipments', href: '/shipments', status: 'aktif' },
      { label: 'Purchasing', href: '/purchasing', status: 'aktif' },
      { label: 'Goods Receipt', status: 'sebagian', keterangan: 'Ada di dalam Purchasing' },
      { label: 'Reservations', status: 'belum-ada', keterangan: 'Konsep reservasi belum ada sama sekali' },
      { label: 'Stock Movement', status: 'sebagian', keterangan: 'Ada di dalam Warehouse' },
      { label: 'Expiry', status: 'sebagian', keterangan: 'Ada di dalam Warehouse' },
      { label: 'Locations', status: 'belum-ada' },
      { label: 'Picking / Putaway / Transfer', status: 'belum-ada' },
      { label: 'Requisitions & RFQ', status: 'belum-ada' }
    ]
  },
  {
    label: 'Planning & APS',
    items: [
      { label: 'PPIC', href: '/ppic', status: 'aktif' },
      { label: 'Material Requirements', status: 'sebagian', keterangan: 'Ada di dalam PPIC dan Work Order' },
      { label: 'Sales Forecast', status: 'ditolak', keterangan: 'Ditolak — keputusan tercatat (SLS-90). Bukan ditunda' },
      { label: 'Scenario Planning', status: 'diparkir' },
      { label: 'Pegging', status: 'diparkir' },
      { label: 'MPS', status: 'belum-ada' },
      { label: 'Capacity / RCCP', status: 'belum-ada' },
      { label: 'Planned Orders', status: 'belum-ada' }
    ]
  },
  {
    label: 'Product & Engineering',
    items: [
      { label: 'Items', href: '/items', status: 'aktif' },
      { label: 'BOM', href: '/boms', status: 'aktif' },
      { label: 'Routing', href: '/routing', status: 'aktif' },
      { label: 'Specifications', status: 'belum-ada' },
      { label: 'Revisions & Effectivity', status: 'belum-ada' },
      { label: 'Engineering Changes', status: 'belum-ada' },
      { label: 'Product Variants', status: 'belum-ada' }
    ]
  },
  {
    label: 'Sales & CRM',
    items: [
      { label: 'Customers', href: '/customers', status: 'aktif' },
      { label: 'Customer PO', href: '/customer-purchase-orders', status: 'aktif' },
      { label: 'Sales Orders', href: '/sales-orders', status: 'aktif' },
      { label: 'Quotations', status: 'belum-ada' },
      { label: 'Pricing', status: 'sebagian', keterangan: 'Harga per pelanggan ada di dalam Items' },
      { label: 'Returns / RMA', status: 'belum-ada' },
      { label: 'Complaints', status: 'belum-ada' },
      { label: 'Leads & Opportunities', status: 'belum-ada' },
      { label: 'Sample Requests', status: 'belum-ada' }
    ]
  },
  {
    // WORKSPACE INI TIDAK ADA DI DOKUMEN IA, dan itu kekeliruan dokumen — bukan tambahan
    // karangan. Absensi dan kepegawaian SUDAH BERJALAN dan menopang seluruh perhitungan
    // biaya SDM. Menyalin sitemap apa adanya akan menghilangkan modul yang sudah dipakai.
    label: 'People',
    items: [
      { label: 'HR Dashboard', href: '/hr', status: 'aktif' },
      { label: 'Attendance', href: '/attendance', status: 'aktif' },
      { label: 'Payroll', status: 'sebagian', keterangan: 'Perhitungan ada di dalam HR Dashboard' },
      { label: 'Employees', status: 'sebagian', keterangan: 'Ada di dalam HR Dashboard' }
    ]
  },
  {
    label: 'Finance & Costing',
    items: [
      { label: 'Operating Profit', href: '/operating-profit', status: 'aktif' },
      { label: 'Standard Cost', status: 'sebagian', keterangan: 'Ada di dalam Items' },
      { label: 'Cost Variance', status: 'sebagian', keterangan: 'Ada di dalam Operating Profit' },
      { label: 'Actual Cost', status: 'belum-ada' },
      { label: 'WIP', status: 'belum-ada' },
      { label: 'Inventory Valuation', status: 'belum-ada' },
      { label: 'Invoices & Payments', status: 'belum-ada' },
      { label: 'General Ledger', status: 'belum-ada' }
    ]
  },
  {
    label: 'Data & Analytics',
    items: [
      { label: 'Company KPI', href: '/kpi', status: 'aktif' },
      { label: 'My KPI', href: '/kpi/saya', status: 'aktif' },
      { label: 'Process Mining', href: '/process-mining', status: 'aktif' },
      { label: 'Report Builder', status: 'diparkir', keterangan: 'Diparkir — belum ada pembuat laporan' },
      { label: 'Dashboard Builder', status: 'belum-ada' },
      { label: 'Import / Export', status: 'belum-ada' }
    ]
  },
  {
    label: 'AI',
    items: [
      { label: 'AI Project', href: '/ai-project', status: 'aktif' },
      { label: 'AI Readiness', href: '/ai-readiness', status: 'aktif' },
      { label: 'AI Assistant', status: 'belum-ada' },
      { label: 'AI Detection', status: 'belum-ada' },
      { label: 'AI Automation', status: 'belum-ada' }
    ]
  },
  {
    label: 'Traceability',
    items: [
      // Kandidat terkuat untuk dibangun berikutnya: datanya SUDAH terisi dan ini syarat
      // kepatuhan BPOM/halal, tapi tidak ada satu layar pun.
      { label: 'Lot Genealogy', status: 'sebagian', keterangan: 'Datanya sudah terisi, layarnya belum ada' },
      { label: 'Forward Trace', status: 'belum-ada' },
      { label: 'Backward Trace', status: 'belum-ada' },
      { label: 'Recall Analysis', status: 'belum-ada' }
    ]
  },
  {
    label: 'Quality',
    items: [
      // Catatan dari CLAUDE.md: belum ada petugas QC tersendiri -- tahap QC dikerjakan Spv
      // Produksi yang merangkap. Membangun workspace ini penuh sekarang berarti membangun
      // untuk peran yang belum ada.
      { label: 'Inspection Plans', status: 'belum-ada' },
      { label: 'Incoming Inspection', status: 'belum-ada' },
      { label: 'In-Process Inspection', status: 'belum-ada' },
      { label: 'Quality Hold', status: 'belum-ada' },
      { label: 'NCR & CAPA', status: 'belum-ada' }
    ]
  },
  {
    label: 'Maintenance',
    items: [
      { label: 'Equipment', status: 'diparkir' },
      { label: 'Preventive Maintenance', status: 'diparkir' },
      { label: 'Breakdown / Downtime', status: 'diparkir' },
      { label: 'Spare Parts', status: 'diparkir' }
    ]
  },
  {
    label: 'Integrations',
    items: [
      { label: 'API', status: 'belum-ada' },
      { label: 'Webhooks', status: 'belum-ada' },
      { label: 'Accounting', status: 'belum-ada' },
      { label: 'Shipping', status: 'belum-ada' }
    ]
  },
  {
    label: 'Control Tower',
    items: [
      { label: 'Executive Overview', status: 'belum-ada' },
      { label: 'Delivery Risk', status: 'belum-ada' },
      { label: 'Material Shortage', status: 'belum-ada' },
      { label: 'Capacity Risk', status: 'belum-ada' },
      { label: 'Exceptions', status: 'belum-ada' }
    ]
  },
  {
    label: 'Administration',
    items: [
      { label: 'Company Data', href: '/company', status: 'aktif' },
      { label: 'Calculation Settings', href: '/company/setelan', status: 'sebagian', keterangan: 'Sedang diperbaiki — belum bisa dibuka (AUD-35)' },
      { label: 'Team & Invitations', href: '/team', status: 'aktif' },
      { label: 'Documents', href: '/documents', status: 'aktif' },
      { label: 'Glossary Queue', href: '/kamus', status: 'aktif' },
      { label: 'Numbering / Sequences', status: 'belum-ada', keterangan: 'Nomor dihitung ulang dari jumlah baris; tidak ada penghitung tersimpan' },
      { label: 'Audit Log', status: 'belum-ada' },
      { label: 'Workflow & Approval', status: 'belum-ada' }
    ]
  },
  {
    // Hanya untuk pemilik produk dan tim internal. Bukan "mode kedua" -- sekadar satu
    // workspace tambahan di navigasi yang sama.
    label: 'Internal',
    items: [
      { label: "What's New", href: '/whats-new', status: 'aktif' },
      { label: 'Build Tasks', href: '/build-tasks', status: 'aktif' },
      { label: 'Debug Auth & RLS', href: '/debug', status: 'internal' },
      { label: 'Test Tenant', href: '/test-tenant', status: 'internal' }
    ]
  }
];

/// Keterangan yang dibaca manusia untuk tiap status. Dipakai penanda di menu DAN oleh
/// penjelasan yang muncul saat penandanya diklik.
export const ARTI_STATUS: Record<StatusNav, { singkat: string; panjang: string }> = {
  aktif: { singkat: '', panjang: 'Halaman ini sudah bisa dipakai.' },
  sebagian: {
    singkat: 'Sebagian',
    panjang: 'Kemampuannya sudah ada, tapi menumpang di halaman lain — belum punya layarnya sendiri.'
  },
  'belum-ada': {
    singkat: 'Belum ada',
    panjang: 'Belum dibangun. Namanya ditampilkan supaya terlihat apa yang akan dikerjakan, bukan supaya dikira sudah ada.'
  },
  ditolak: {
    singkat: 'Ditolak',
    panjang: 'Sudah diputuskan TIDAK dibangun, dan keputusannya tercatat. Ini berbeda dari "belum ada" — jangan menunggunya.'
  },
  diparkir: {
    singkat: 'Ditunda',
    panjang: 'Sengaja ditunda dengan pemicu tertulis. Akan dikerjakan bila pemicunya terpenuhi.'
  },
  internal: {
    singkat: 'Internal',
    panjang: 'Alat internal untuk membangun sistem, bukan untuk pekerjaan sehari-hari.'
  }
};

export function bisaDibuka(item: ItemNav): boolean {
  // 'sebagian' yang PUNYA href tetap bisa dibuka -- yang membuatnya sebagian adalah
  // kemampuannya menumpang di layar lain, bukan halamannya tidak ada.
  return Boolean(item.href);
}
