-- Disposisi lengkap Arsitektur Sales (Bagian I) + DOC-04 retensi dokumen (0.8).
--
-- SUMBER: docs/FABRIX_Sales_Technical_Architecture_Fable5_v0_1.md (§1-§51) dan
-- docs/review-fable-sales-architecture.md. Keduanya sudah masuk repo dengan catatan
-- kepala bahwa isinya potret 20 Agu 2026 dan kebenaran status ada di Daftar Tugas ini.
--
-- TIDAK ADA MODUL SALES YANG DIBANGUN DI SINI. Ini murni pencatatan supaya tidak ada
-- konsep yang hilang, TANPA menenggelamkan pekerjaan yang sedang berjalan dengan 51
-- task per bagian.

-- ============================================================================
-- DOC-04 — KEBIJAKAN RETENSI DOKUMEN KEPATUHAN (0.8)
-- ============================================================================
insert into build_tasks (
  company_id, task_code, name, module_code, module_name, description, effect_description,
  urgency, tags, pic, status, origin, detail_pekerjaan, notes
)
select 1, 'DOC-04',
  'Kebijakan Retensi Dokumen Kepatuhan (COA, Sertifikat Halal, Izin Edar BPOM)',
  'DOC', 'Master Dokumen',
  'Berapa lama dokumen kepatuhan wajib disimpan belum ditentukan. Kolom retention_months pada ' ||
  'ketiga jenis dokumen item sengaja DIBIARKAN KOSONG.',
  'Ini keputusan perusahaan dengan KONSEKUENSI HUKUM, bukan keputusan teknis: salah retensi ' ||
  'berarti dokumen yang dibutuhkan auditor sudah terhapus, dan itu tidak bisa dibatalkan.',
  'penting',
  array['Data', 'Dokumentasi'],
  'Pemilik Produk',
  'menunggu',
  'temuan_claude',
  E'PERTANYAAN untuk pemilik produk — sebaiknya dikonfirmasikan ke pihak yang mengurus perizinan ' ||
  E'BPOM dan halal, bukan dijawab dari perkiraan:\n' ||
  E'a. Berapa lama masing-masing jenis dokumen (COA, Sertifikat Halal, Izin Edar BPOM) wajib disimpan?\n' ||
  E'b. Dihitung sejak DITERBITKAN, sejak KEDALUWARSA, atau sejak PRODUK TERAKHIR yang memakainya?\n' ||
  E'c. Setelah lewat masa retensi: dokumen dihapus, atau tetap disimpan dan hanya ditandai?\n\n' ||
  E'REKOMENDASI ARSITEK untuk (c): TETAP DISIMPAN dan ditandai, JANGAN dihapus otomatis. ' ||
  E'Menghapus dokumen kepatuhan secara otomatis adalah tindakan yang tidak bisa dibatalkan, dan ' ||
  E'biaya menyimpan berkas jauh lebih kecil daripada risiko kehilangan bukti.\n\n' ||
  E'SAMPAI DIJAWAB: kolom retention_months tetap KOSONG. JANGAN diisi angka apa pun.',
  'Lahir 24 Agu 2026 saat membangun MST-17. Versi pertama migrasi MST-17 sempat mengisi 60 dan 120 ' ||
  'bulan — angka karangan yang bahkan menyimpang dari pola jenis dokumen lain di sistem ini, yang ' ||
  'membiarkannya kosong. Dikoreksi sebelum diterapkan.'
where not exists (select 1 from build_tasks where task_code = 'DOC-04' and company_id = 1);

-- ============================================================================
-- SLS-00 — KEPUTUSAN STRATEGIS MODUL SALES (I.C)
--
-- Dicatat sebagai TASK, bukan sekadar komentar, karena keputusan yang hanya hidup di
-- percakapan terbukti berulang kali hilang di proyek ini.
-- ============================================================================
insert into build_tasks (
  company_id, task_code, name, module_code, module_name, description, effect_description,
  urgency, tags, pic, status, origin, detail_pekerjaan, notes
)
select 1, 'SLS-00',
  'KEPUTUSAN MODUL SALES — Peta Cakrawala, Bukan Program yang Dijalankan Sekarang',
  'SLS', 'Sales',
  'Catatan keputusan strategis yang mengikat SELURUH task SLS. Bukan pekerjaan yang dikerjakan; ' ||
  'dibaca sebelum membuka task SLS mana pun.',
  'Mencegah arsitektur Sales dibuka ulang tanpa sadar, dan mencegah lapisan komersial ditumpuk ' ||
  'di atas fondasi yang belum pernah dibuktikan utuh.',
  'tidak_mendesak',
  array['Dokumentasi'],
  'Pemilik Produk',
  'ditunda_sadar',
  'pemilik_produk',
  E'"Arsitektur Sales diterima sebagai PETA CAKRAWALA, bukan program yang dijalankan sekarang. ' ||
  E'Pemicu pembukaan: setelah SATU ORDER BERJALAN TUNTAS di sistem, dari PO klien sampai barang ' ||
  E'terkirim. Alasan: lapisan komersial tidak ditumpuk di atas fondasi yang belum pernah dibuktikan ' ||
  E'utuh. Dokumen sumber ditulis seolah greenfield; separuh arsitekturnya SUDAH ADA di FABRIX ' ||
  E'dengan nama berbeda — pakai peta padanan Bagian B tinjauan Fable, dan setiap duplikasi adalah cacat."\n\n' ||
  E'SYARAT CETAKAN UX (berlaku untuk SELURUH layar SLS, I.G): anatomi modal Carbon ' ||
  E'(header/body/footer lebar penuh), field medium 40px, ringkasan konfirmasi sebelum simpan untuk ' ||
  E'data BARU, responsive di 360/768/1280/1920 dengan tabel menggulir di wadahnya sendiri, dan ikon ' ||
  E'bantuan dibuka dengan KLIK bukan hover.',
  'Modul SLS dibuat 24 Agu 2026. BEDA dari modul PJL (Penjualan) yang sudah ada: PJL berisi alur ' ||
  'order yang SUDAH BERJALAN (PO klien -> Sales Order -> Work Order, halaman Sales Order). SLS ' ||
  'berisi lapisan KOMERSIAL yang belum ada (quotation, sampel, komplain, perubahan order). Jangan ' ||
  'memindahkan task antar keduanya tanpa alasan tertulis.'
where not exists (select 1 from build_tasks where task_code = 'SLS-00' and company_id = 1);

-- ============================================================================
-- SLS-01..SLS-05 — SATU TASK PER TAHAP (I.D), seluruhnya DITUNDA SADAR
-- ============================================================================
insert into build_tasks (
  company_id, task_code, name, module_code, module_name, description, effect_description,
  urgency, tags, pic, status, origin, detail_pekerjaan, ditunda_pemicu, notes
)
select 1, d.kode, d.nama, 'SLS', 'Sales', d.deskripsi, d.efek, 'tidak_mendesak',
  array['Data']::text[], 'Claude Code', 'ditunda_sadar', 'pemilik_produk', d.detail,
  'Setelah SATU ORDER BERJALAN TUNTAS di sistem, dari PO klien sampai barang terkirim (lihat SLS-00).',
  d.catatan
from (values
(
  'SLS-01',
  'SALES-1: Profil Produk Pelanggan, Duplikat Sales Order, Peringatan Duplikat Pelanggan',
  'Tahap pertama lapisan komersial: melihat produk dari sudut pandang pelanggan, menggandakan Sales Order yang berulang, dan memperingatkan saat pelanggan baru mirip dengan yang sudah ada.',
  'Order berulang tidak perlu diketik ulang dari nol, dan pelanggan kembar tidak lahir diam-diam lalu memecah riwayat order jadi dua.',
  E'MENCAKUP §5 (sebagian), §9 (sebagian), §14 (sebagian).\n\n' ||
  E'LINGKUPNYA LEBIH KECIL dari yang tertulis di tinjauan, karena dua bagian sudah ditangani:\n' ||
  E'- CustomerProduct SUDAH DIPISAH jadi task tersendiri dan NAIK ke antrean aktif — JANGAN duplikat di sini.\n' ||
  E'- Peran alamat & kontak pelanggan (address/contact roles) SUDAH SELESAI lewat PMB-07b.\n\n' ||
  E'WAJIB REUSE, jangan bangun ulang: halaman & CRUD Pelanggan (PMB-03), alamat tujuan kirim (PMB-07b), ' ||
  E'snapshot identitas mitra (PMB-07a), halaman Sales Order (PJL-02).\n\n' ||
  E'DUPLIKAT PELANGGAN: cukup PERINGATAN nama/NPWP mirip saat membuat pelanggan. Mesin penggabung ' ||
  E'(merge engine) TIDAK dibangun — lihat SLS-90.\n\n' ||
  E'LAMPIRAN SKENARIO WAJIB (aturan Fable): ambil minimal 2 kasus dari bank §44 dan 1 dari §45 sebagai ' ||
  E'skenario NEGATIF wajib saat paket ini dikerjakan.',
  'Dicatat 24 Agu 2026 dari §5/§9/§14. Status pelanggan BLOCKED dan SUSPENDED yang diusulkan §5 TIDAK BOLEH ditambahkan tanpa pemicu — lihat aturan di CLAUDE.md.'
),
(
  'SLS-02',
  'SALES-2: Quotation (Snapshot, Revisi, Persetujuan, Masa Berlaku) + Pricing Waterfall Ringkas',
  'Penawaran harga resmi ke pelanggan: dibekukan saat dikirim, bisa direvisi jadi versi baru, butuh persetujuan, dan punya masa berlaku. Harga yang disepakati ikut dibekukan di Sales Order.',
  'Harga yang pernah dijanjikan tidak bisa berubah diam-diam, dan selisih harga jual antar pelanggan bisa dijelaskan asal-usulnya.',
  E'MENCAKUP §11, §12, §14 (snapshot harga), §38 aturan SD-1 dan SD-12.\n\n' ||
  E'INI RUMAH DARI SD-12 (nilai komersial terkonfirmasi wajib berversi atau beku). Saat ini harga di ' ||
  E'Sales Order BELUM dibekukan, padahal identitas mitra sudah (PMB-07a) — jadi polanya sudah ada ' ||
  E'tinggal diterapkan ke harga.\n\n' ||
  E'WAJIB REUSE: pola snapshot identitas mitra (PMB-07a), pola snapshot BOM/routing per batch, ' ||
  E'panel Asal-Usul untuk menjelaskan asal angka harga.\n\n' ||
  E'PRICING WATERFALL RINGKAS, bukan penuh: harga dasar -> diskon -> harga akhir, dengan jejak siapa ' ||
  E'menyetujui. Struktur harga berlapis penuh menunggu kebutuhan nyata.\n\n' ||
  E'LAMPIRAN SKENARIO WAJIB: minimal 2 dari §44 + 1 dari §45 sebagai skenario negatif.',
  'Dicatat 24 Agu 2026 dari §11/§12. SD-1 (SO terkonfirmasi tidak mengubah riwayat quotation) baru jadi relevan begitu paket ini dikerjakan.'
),
(
  'SLS-03',
  'SALES-3: Alur Permintaan Sampel + Biaya Sampel Masuk Profitabilitas Pelanggan',
  'Permintaan sampel dari calon pelanggan dicatat sebagai alur tersendiri, dan biayanya ikut dihitung dalam profitabilitas pelanggan itu.',
  'Biaya sampel berhenti jadi biaya siluman. Pelanggan yang banyak minta sampel tapi jarang order akan terlihat apa adanya.',
  E'MENCAKUP §8, §32 (sebagian).\n\n' ||
  E'WAJIB REUSE: mesin biaya produksi yang sudah ada (biaya bahan + SDM + overhead per batch), ' ||
  E'katalog KPI untuk profitabilitas pelanggan. JANGAN bangun mesin biaya kedua khusus sampel.\n\n' ||
  E'Customer profitability (§32) TIDAK jadi modul analytics tersendiri — rumahnya KPI registry yang ' ||
  E'sudah ada, diperluas dengan biaya sampel dan biaya retur. Lihat SLS-90.\n\n' ||
  E'LAMPIRAN SKENARIO WAJIB: minimal 2 dari §44 + 1 dari §45 sebagai skenario negatif.',
  'Dicatat 24 Agu 2026 dari §8/§32.'
),
(
  'SLS-04',
  'SALES-4: Perubahan Sales Order + Analisis Dampak + Alokasi Lot ke Order + ATP',
  'Pelanggan mengubah order yang sudah berjalan: sistem menunjukkan dampaknya sebelum disetujui, mengikat lot/batch tertentu ke order tertentu, dan bisa menjanjikan tanggal yang memperhitungkan barang yang ditahan mutu.',
  'Perubahan order berhenti jadi negosiasi lisan yang dampaknya baru ketahuan saat produksi jalan.',
  E'MENCAKUP §16, §17, §21.\n\n' ||
  E'WAJIB REUSE — INI YANG PALING PENTING DI PAKET INI: mesin kelayakan (feasibility engine) yang ' ||
  E'SUDAH ADA. JANGAN bangun ulang analisis dampak dari nol. Yang dibutuhkan adalah memanggilnya ' ||
  E'dengan skenario "seandainya order diubah begini", bukan mesin kedua.\n\n' ||
  E'ALOKASI FORMAL lot/batch ke Sales Order: PERHATIAN, konsep reservasi/alokasi saat ini BELUM ADA ' ||
  E'sama sekali di skema (nol kolom, nol tabel). Jadi aturan SD-5 (reservasi tidak mengurangi stok ' ||
  E'fisik) belum dijaga test mana pun — test penjaganya WAJIB lahir bersama fitur ini.\n\n' ||
  E'ATP dengan quality-hold: barang yang ditahan mutu tidak boleh ikut dijanjikan.\n\n' ||
  E'LAMPIRAN SKENARIO WAJIB: minimal 2 dari §44 + 1 dari §45 sebagai skenario negatif.',
  'Dicatat 24 Agu 2026 dari §16/§17/§21. Terkait langsung dengan dua task pemeriksaan konkurensi (§45) dan pemetaan order-ke-batch (§44) yang dicatat terpisah.'
),
(
  'SLS-05',
  'SALES-5: Komplain Pelanggan sebagai NCR + Retur Ringkas + KPI Sales',
  'Komplain pelanggan masuk sebagai jenis baru dari catatan ketidaksesuaian (NCR) yang sudah ada, tertaut ke Sales Order / pengiriman / batch, dengan retur sederhana dan KPI penjualan.',
  'Komplain berhenti berhenti di percakapan WhatsApp dan bisa ditelusuri sampai batch produksi yang jadi sebabnya.',
  E'MENCAKUP §26 (ringkas), §27, §31 (sebagian).\n\n' ||
  E'WAJIB REUSE: struktur NCR yang SUDAH ADA — komplain adalah TIPE BARU dari NCR, bukan tabel baru. ' ||
  E'Telusur lot yang sudah terbukti (SD-13) dipakai untuk menautkan komplain ke batch.\n\n' ||
  E'RETUR RINGKAS, bukan RMA formal: RMA penuh menunggu bukti frekuensi retur (lihat SLS-90). ' ||
  E'Aturan SD-6 (qty terkirim tidak ditulis ulang) dan SD-7 (retur transaksi terpisah) jadi relevan ' ||
  E'begitu paket ini dikerjakan, dan test penjaganya wajib lahir bersamanya.\n\n' ||
  E'KPI sales masuk KPI registry yang sudah ada, BUKAN modul analytics tersendiri.\n\n' ||
  E'LAMPIRAN SKENARIO WAJIB: minimal 2 dari §44 + 1 dari §45 sebagai skenario negatif.',
  'Dicatat 24 Agu 2026 dari §26/§27/§31.'
)
) as d(kode, nama, deskripsi, efek, detail, catatan)
where not exists (select 1 from build_tasks b where b.task_code = d.kode and b.company_id = 1);

-- ============================================================================
-- SLS-90 — SATU TASK untuk SELURUH yang DIPARKIR (I.E), bukan satu-satu.
--
-- Tiap butir mencantumkan PEMICU-nya, supaya pembukaannya kelak berdasar kejadian
-- nyata, bukan perasaan bahwa "sudah waktunya".
-- ============================================================================
insert into build_tasks (
  company_id, task_code, name, module_code, module_name, description, effect_description,
  urgency, tags, pic, status, origin, detail_pekerjaan, ditunda_pemicu, notes
)
select 1, 'SLS-90',
  'Modul Sales yang DIPARKIR, Beserta Pemicu Pembukaannya',
  'SLS', 'Sales',
  'Kumpulan konsep dari arsitektur Sales yang SENGAJA tidak dibangun sekarang. Dicatat agar tidak ' ||
  'hilang, dan agar tidak dibuka ulang tanpa pemicu yang jelas.',
  'Mencegah dua kesalahan sekaligus: membangun sesuatu yang belum dibutuhkan, dan melupakan sesuatu ' ||
  'yang kelak dibutuhkan.',
  'tidak_mendesak',
  array['Dokumentasi'],
  'Pemilik Produk',
  'ditunda_sadar',
  'pemilik_produk',
  E'DITOLAK (bukan ditunda — bertentangan dengan keputusan yang sudah terkunci):\n' ||
  E'- FORECAST (§29-30). PT ITM contract manufacturer: demand DITERIMA dari PO klien, tidak diramal. ' ||
  E'Konsep forecast consumption disimpan hanya bila kelak ada kontrak blanket berkomitmen volume.\n' ||
  E'- EVENT BUS EKSTERNAL (§33). Tidak cocok untuk modular monolith. Bila kelak dibutuhkan: outbox ' ||
  E'ringan (tabel domain_events append-only), dan NAMA EVENT dari §33 DIPERTAHANKAN supaya migrasi ' ||
  E'kelak mekanis, bukan menulis ulang.\n' ||
  E'- MODUL ANALYTICS TERSENDIRI (§31). Rumahnya KPI registry yang sudah ada. Customer profitability ' ||
  E'(§32) masuk katalog KPI, diperluas dengan biaya sampel dan biaya retur.\n\n' ||
  E'DIPARKIR DENGAN PEMICU:\n' ||
  E'- Commission (§28) -> pemicu: karyawan sales pertama direkrut.\n' ||
  E'- Contract / Blanket Order (§13) -> pemicu: klien pertama meminta harga kontrak. SEMENTARA: satu ' ||
  E'field contract_ref di Sales Order.\n' ||
  E'- Product Configurator penuh (§9) -> pemicu: varian per produk lebih dari 3-5.\n' ||
  E'- Parent/child account (§5) -> pemicu: ada grup perusahaan nyata. SEMENTARA: satu kolom group_name.\n' ||
  E'- Multi-currency & multi-company (§40) -> pemicu: klien ekspor pertama.\n' ||
  E'- Duplicate merge engine (§5) -> SEMENTARA cukup peringatan nama/NPWP mirip saat membuat pelanggan (SLS-01).\n' ||
  E'- Pick/pack states penuh (§23) -> pemicu: gudang membutuhkannya.\n' ||
  E'- Lead/Opportunity funnel penuh (§6-7) -> pemicu: ada orang sales dedicated. SEMENTARA: satu ' ||
  E'entitas Prospek sederhana.\n' ||
  E'- Credit engine penuh (§5) -> menunggu modul invoice/AR. SEMENTARA: payment terms + penanda ' ||
  E'piutang bermasalah + blokir LUNAK saat membuat Sales Order.\n' ||
  E'- RMA formal (§26) -> pemicu: frekuensi retur membuktikan perlunya.\n' ||
  E'- Forecast consumption (§30, aturan SD-9) -> pemicu: ada kontrak blanket berkomitmen volume.',
  'Salah satu pemicu di atas terjadi. Tiap butir punya pemicunya sendiri — buka HANYA butir yang pemicunya terpenuhi, jangan seluruh task.',
  'Dicatat 24 Agu 2026. Sengaja SATU task berisi banyak butir, bukan satu task per butir: sebelas task ' ||
  'berstatus ditunda akan menenggelamkan pekerjaan yang benar-benar berjalan, dan itu justru membuat ' ||
  'Daftar Tugas lebih sulit dipakai.'
where not exists (select 1 from build_tasks where task_code = 'SLS-90' and company_id = 1);

-- ============================================================================
-- I.F.b & I.F.c — TASK PEMERIKSAAN, BUKAN modul sales.
--
-- Sengaja BUKAN modul SLS: keduanya menyentuh mesin yang BERJALAN HARI INI, jadi
-- menaruhnya di modul yang ditunda sadar akan membuatnya ikut tertunda padahal
-- risikonya nyata sekarang.
-- ============================================================================
insert into build_tasks (
  company_id, task_code, name, module_code, module_name, description, effect_description,
  urgency, tags, pic, status, origin, detail_pekerjaan, notes
)
select 1, d.kode, d.nama, d.modul_kode, d.modul_nama, d.deskripsi, d.efek, d.urgensi,
  array['Data','test']::text[], 'Claude Code', 'menunggu', 'temuan_claude', d.detail, d.catatan
from (values
(
  'AUD-16',
  'PEMERIKSAAN: Dua Order Bersamaan atas Stok yang Sama — Apakah Keduanya Lulus Kelayakan? (§45)',
  'AUD', 'Audit & Proses',
  'Belum diketahui apakah mesin kelayakan menahan dua Sales Order yang dikonfirmasi hampir bersamaan terhadap stok yang sama.',
  'Bila keduanya lulus, DUA PESANAN BISA DIJANJIKAN DARI BAHAN YANG SAMA, dan itu baru ketahuan saat produksi jalan — ketika janji ke pelanggan sudah terlanjur diberikan.',
  'penting',
  E'DUA SKENARIO YANG DIPERIKSA (§45):\n' ||
  E'1. Dua Sales Order dikonfirmasi hampir bersamaan terhadap stok yang sama -> apakah KEDUANYA lulus ' ||
  E'pemeriksaan kelayakan?\n' ||
  E'2. Dua pengiriman mengambil lot yang sama bersamaan -> bisakah stok jadi NEGATIF atau terhitung GANDA?\n\n' ||
  E'YANG WAJIB DITUNJUKKAN, bukan disimpulkan: KODENYA. Apakah ada penguncian baris / versi baris ' ||
  E'(row lock, optimistic version), atau murni baca-lalu-tulis tanpa penjaga?\n\n' ||
  E'BATAS TEGAS: LAPORKAN APA ADANYA LEBIH DULU. JANGAN memperbaiki sebelum temuannya dilaporkan — ' ||
  E'besar kecilnya masalah menentukan bentuk perbaikannya.',
  'Dicatat 24 Agu 2026 dari §45 arsitektur Sales. Bukan modul sales: menyentuh mesin kelayakan dan pengurangan stok yang SUDAH BERJALAN hari ini.'
),
(
  'AUD-17',
  'PEMERIKSAAN: Satu Batch untuk Dua Order, dan Satu Order dari Banyak Work Order (§44)',
  'AUD', 'Audit & Proses',
  'Belum diketahui apakah sistem mendukung, menolak, atau tidak memikirkan sama sekali dua pemetaan ini antara order dan produksi.',
  'Menentukan apakah rancangan pemecahan Work Order jadi batch perlu diubah SEBELUM dibangun lebih jauh — mengubahnya setelah ada data produksi jauh lebih mahal.',
  'penting',
  E'DUA KASUS YANG DIPERIKSA (§44), terkait LANGSUNG dengan rancangan pemecahan Work Order jadi batch:\n' ||
  E'1. Bisakah SATU batch produksi memenuhi DUA Sales Order berbeda? Bila ya: bagaimana biayanya ' ||
  E'dibagi, dan bagaimana telusur lot-nya tetap benar untuk kedua order?\n' ||
  E'2. Bisakah SATU Sales Order dipenuhi oleh BEBERAPA Work Order?\n\n' ||
  E'JAWABAN YANG DIHARAPKAN untuk masing-masing, pilih satu dan tunjukkan buktinya di kode: ' ||
  E'sistem MENDUKUNG / MENOLAK secara sadar / TIDAK MEMIKIRKANNYA sama sekali. Jawaban ketiga bukan aib — ' ||
  E'yang berbahaya adalah mengira sudah dipikirkan padahal belum.\n\n' ||
  E'BATAS TEGAS: LAPORKAN LEBIH DULU, jangan perbaiki.',
  'Dicatat 24 Agu 2026 dari §44 arsitektur Sales.'
),
(
  'AUD-18',
  'SD-11: Konfigurasi Pelanggan Tidak Boleh Memutasi Master Produksi (Aturan Kandidat-BOM)',
  'AUD', 'Audit & Proses',
  'Aturan §38 nomor 11 belum ada penjaganya. Perubahan spesifikasi dari sisi pelanggan tidak boleh langsung mengubah master BOM produksi.',
  'Tanpa aturan ini, permintaan satu pelanggan bisa diam-diam mengubah resep yang dipakai SELURUH order — termasuk order pelanggan lain yang sedang berjalan.',
  'penting',
  E'Perubahan dari sisi pelanggan menghasilkan KANDIDAT BOM, bukan mutasi langsung ke master. ' ||
  E'Kandidat baru jadi master lewat persetujuan yang tercatat.\n\n' ||
  E'WAJIB REUSE: pola snapshot BOM per batch yang sudah ada dan sudah terbukti ' ||
  E'(tests/production_batch_routing_bom_snapshot.test.ts) — batch berjalan sudah kebal terhadap ' ||
  E'perubahan master, jadi separuh jaminannya sudah ada. Yang belum: melarang mutasinya sejak awal.',
  'Dicatat 24 Agu 2026 dari §38 aturan 11. Statusnya BELUM ADA, bukan sebagian.'
),
(
  'AUD-19',
  'SD-12: Harga di Sales Order Belum Dibekukan, Padahal Identitas Mitra Sudah',
  'AUD', 'Audit & Proses',
  'Aturan §38 nomor 12 (nilai komersial terkonfirmasi wajib berversi atau beku) belum berlaku untuk HARGA. Identitas mitra sudah dibekukan lewat PMB-07a, harganya belum.',
  'Harga di order lama bisa ikut berubah saat harga master diubah, sehingga nilai order historis dan margin yang sudah dihitung bisa berubah sendiri di belakang layar.',
  'penting',
  E'POLANYA SUDAH ADA TINGGAL DITERAPKAN: snapshot identitas mitra (PMB-07a) sudah membekukan nama, ' ||
  E'alamat, dan NPWP pelanggan pada saat dokumen dibuat. Hal yang sama perlu berlaku untuk harga.\n\n' ||
  E'Bisa dikerjakan lebih awal dari SLS-02, ATAU jadi bagian pertamanya — keputusan urutan diserahkan ' ||
  E'ke saat pengerjaan. Yang penting jangan menunggu seluruh modul Quotation selesai, karena harga ' ||
  E'yang belum beku sudah berdampak HARI INI pada order yang berjalan.',
  'Dicatat 24 Agu 2026 dari §38 aturan 12. Ini satu-satunya aturan §38 yang belum berlaku DAN sudah berdampak sekarang, bukan menunggu modul baru.'
)
) as d(kode, nama, modul_kode, modul_nama, deskripsi, efek, urgensi, detail, catatan)
where not exists (select 1 from build_tasks b where b.task_code = d.kode and b.company_id = 1);

-- ============================================================================
-- INF-16 naik urgensi (0.12) — backup TIDAK mencakup berkas Storage.
-- ============================================================================
update build_tasks
set urgency = 'mendesak',
    notes = coalesce(notes, '') || E'\n\n' ||
      '24 Agu 2026 — urgensi dinaikkan ke MENDESAK. Alasan: MST-17 membuat dokumen kepatuhan (COA, ' ||
      'Sertifikat Halal, Izin Edar BPOM) mulai diunggah ke Storage. Sampai sebelum ini, "backup tidak ' ||
      'mencakup Storage" belum berdampak karena Storage praktis kosong. Begitu dokumen sungguhan ' ||
      'diunggah, kehilangan Storage berarti kehilangan BUKTI KEPATUHAN yang tidak bisa dibuat ulang.'
where task_code = 'INF-16' and company_id = 1;
