-- BAGIAN 6 (H.4) / AUD-04 — "Kenapa Halaman Pelanggan Lolos Audit 2 Kali".
--
-- TEMUAN AKAR PENYEBAB (bukan dugaan awal task ini -- diverifikasi lewat git
-- history docs/audit-lubang-ui.md, bukan tebakan):
--
-- HIPOTESIS AWAL task ini ("apakah dropdown yang berfungsi membuat auditor
-- menganggap sudah ada jalan masuk") TERNYATA SALAH ALAMAT. Baris mentah
-- `customers` di docs/audit-lubang-ui.md SUDAH BENAR sejak audit PERTAMA
-- (Sesi 5, commit 518bfff): "hanya dropdown, tanpa halaman daftar" / Edit
-- "TIDAK ADA" -- dan TETAP benar di audit ULANG berbasis introspection skema
-- (Sesi 7, commit 4dd117c): ditandai [MASTER], "TIDAK ADA halaman daftar".
-- Auditnya TIDAK PERNAH salah baca data mentahnya.
--
-- Mekanisme SEBENARNYA (DUA hal berbeda, bukan satu):
--
-- 1. TIDAK ADA JALUR MEKANIS dari "baris di audit-lubang-ui.md" ke "baris di
--    build_tasks". build_tasks.origin untuk PMB-03 (task yang akhirnya
--    membangun halaman Pelanggan, "Alur 1") = 'pemilik_produk' -- task itu
--    lahir dari PERMINTAAN LANGSUNG pemilik produk, BUKAN dari promosi
--    otomatis/manual atas temuan yang sudah benar di audit-lubang-ui.md.
--    Artinya: sebuah baris audit bisa 100% benar isinya dan tetap tidak
--    pernah jadi task selama tidak ada manusia yang secara terpisah
--    menariknya jadi permintaan. Ini BUKAN kelas masalah "audit yang keliru"
--    -- ini kelas masalah "audit tanpa gigi" (findings tanpa forcing
--    function ke Daftar Tugas).
-- 2. docs/checklist-audit-jalan-kaki.md (audit jalan-kaki per peran) DISUSUN
--    BERBASIS ALUR KERJA HARIAN per peran (Gudang/Produksi SPV/Produksi
--    Operator/PPIC/Purchasing) -- TIDAK ADA satu pun bagian "PERAN: SALES/
--    PELANGGAN". Master data yang dipakai JARANG (menambah pelanggan baru,
--    bukan pekerjaan harian) secara STRUKTURAL tidak akan pernah muncul di
--    audit bergaya "jalan kaki satu hari kerja", karena audit ini disusun
--    per-LANGKAH-KERJA, bukan per-TABEL/LAYAR. Supplier kebetulan lolos
--    (langkah #5 peran Purchasing: "Daftarkan supplier baru") karena
--    supplier DIPAKAI di alur harian Purchasing -- pelanggan tidak dipakai
--    di alur harian siapa pun dalam checklist itu.
--
-- PERBAIKAN METODOLOGI:
-- - Audit per-tabel (docs/audit-lubang-ui.md) SUDAH mekanis sejak Sesi 7
--   (introspection skema, bukan ingatan) -- bagian ini TIDAK perlu ditulis
--   ulang lagi.
-- - Yang DITAMBAHKAN sekarang: setiap baris [MASTER]/[X] di audit-lubang-ui.md
--   dengan Buat=ya DAN Keluar bermasalah/tidak ada disapu SATU KALI lagi
--   secara mekanis terhadap build_tasks (dicari per nama tabel/fungsi) --
--   HASIL: 7 dari sekian baris TERNYATA belum pernah py task sama sekali
--   (lihat baris INSERT di bawah). Bukan janji proses otomatis permanen
--   (butuh tooling terpisah untuk itu) -- tapi minimal audit dan Daftar
--   Tugas disinkronkan MANUAL SATU KALI sekarang, dan gap-nya dicatat.
-- - docs/checklist-audit-jalan-kaki.md TIDAK ditambah bagian "PERAN:
--   SALES/PELANGGAN" di migrasi ini (itu perubahan dokumen, dilakukan
--   terpisah di file .md-nya) -- tapi catatan mekanismenya direkam di sini
--   supaya keputusan "audit jalan-kaki tidak menutup celah master-data
--   jarang-dipakai, harus disandingkan dengan audit per-tabel" tidak hilang.
update public.build_tasks
set status = 'selesai', completed_at = now(),
    detail_pekerjaan = detail_pekerjaan || E'\n\n---\n\nDITUTUP 22 Agu 2026 -- akar penyebab BUKAN "dropdown dikira jalan masuk" seperti hipotesis awal. Baris `customers` di audit-lubang-ui.md SUDAH BENAR sejak Sesi 5 (git blame dicek langsung) dan TETAP benar di audit ulang Sesi 7 -- audit tidak pernah salah baca. Akar penyebab SEBENARNYA: (1) tidak ada jalur mekanis dari temuan-benar di audit-lubang-ui.md ke build_tasks -- PMB-03 (task yang akhirnya membangun halaman ini) origin=pemilik_produk, bukan promosi otomatis dari audit; (2) docs/checklist-audit-jalan-kaki.md disusun per alur-kerja-harian per peran, TIDAK ADA peran Sales/Pelanggan sama sekali -- master data yang jarang dipakai (bukan pekerjaan harian) struktural tidak akan pernah muncul di audit bergaya ini. Sinkronisasi manual audit-lubang-ui.md <-> build_tasks dijalankan sekali lagi sesi ini: 7 baris [MASTER]/[X] dengan Buat=ya+Keluar bermasalah TERNYATA belum pernah py task (DOC-03, ABS-03, ABS-04, PRD-12, PRD-13, PRD-14, KPI-03 -- lihat task masing-masing). docs/audit-lubang-ui.md diberi bagian baru menjelaskan mekanisme ini di bagian atas dokumen.'
where task_code = 'AUD-04';

insert into public.build_tasks
  (company_id, task_code, name, module_code, module_name, description, effect_description, urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes)
values
(
  1, 'DOC-03', 'Sambungkan Tombol Hapus Dokumen', 'DOC', 'Master Dokumen',
  'Fungsi hapus dokumen (`hardDeleteOrphanDocument.ts`) sudah lengkap termasuk cek keamanan & alasan wajib, tapi TIDAK ADA tombol di layar `/documents` yang memanggilnya.',
  'Dokumen salah upload/kadaluarsa tidak bisa dihapus lewat aplikasi sama sekali walau logic-nya sudah selesai dibangun sejak audit-lubang-ui.md (Sesi 5) -- ditemukan lolos dari Daftar Tugas selama ini (H.4/AUD-04).',
  'bisa_menunggu', array['Fungsi','Visual'], 'Claude Code', 'menunggu', '/documents', 'temuan_claude',
  'Tambahkan tombol Hapus di DocumentsPage.tsx yang memanggil hardDeleteOrphanDocument.ts yang sudah ada (termasuk field alasan wajib yang sudah didukung fungsinya). Bukan pekerjaan dari nol -- backend selesai, tinggal disambungkan.',
  'Ditemukan lewat sinkronisasi audit-lubang-ui.md <-> build_tasks (H.4/AUD-04, 22 Agu 2026) -- baris ini sudah tercatat di audit sejak Sesi 5 tapi belum pernah jadi task.'
),
(
  1, 'ABS-03', 'Alur Setuju/Cabut Perangkat Absensi', 'ABS', 'Absensi',
  '`attendance_devices` (perangkat QR self-register dari ABS-01) tidak punya alur approve/revoke -- perangkat baru macet permanen di status menunggu tanpa cara HRD menyetujuinya, dan tidak ada cara mencabut perangkat lama.',
  'Kalau karyawan ganti HP, perangkat baru macet permanen di status "menunggu persetujuan" tanpa cara HRD menyetujuinya lewat aplikasi.',
  'penting', array['Fungsi','Database'], 'Claude Code', 'menunggu', '/hr', 'temuan_claude',
  'Bangun layar/aksi approve dan revoke untuk attendance_devices (RLS sudah ada di skema, tinggal UI+endpoint). Terpisah dari HR-36 (integrasi perangkat biometrik BARU) -- ini soal mengelola perangkat QR yang SUDAH ada sejak ABS-01.',
  'Ditemukan lewat sinkronisasi audit-lubang-ui.md <-> build_tasks (H.4/AUD-04, 22 Agu 2026) -- baris ini sudah tercatat di audit sejak Sesi 5 tapi belum pernah jadi task.'
),
(
  1, 'ABS-04', 'Form Web Pengajuan Koreksi Absen & Cuti', 'ABS', 'Absensi',
  '`attendance_corrections` dan `leave_requests` sudah punya fungsi+API approve/reject lengkap, TAPI TIDAK ADA form pengajuan di layar manapun -- karyawan tidak bisa mengajukan koreksi absen atau cuti lewat aplikasi sama sekali, hanya sisi persetujuan HRD yang ada.',
  'Karyawan terpaksa mengajukan koreksi/cuti lewat cara di luar sistem (chat/kertas) karena tidak ada form pengajuan sama sekali, padahal sisi approve-nya sudah jadi.',
  'penting', array['Fungsi','Visual'], 'Claude Code', 'menunggu', '/hr', 'temuan_claude',
  'Tambahkan form pengajuan (bukan sekadar tombol) untuk attendance_corrections & leave_requests di layar yang bisa diakses karyawan biasa. BEDA dari HR-26 (ESS Mobile) -- HR-26 itu visi jangka panjang self-service mobile penuh; ini kebutuhan MINIMAL sekarang (form web biasa) memakai backend yang sudah ada.',
  'Ditemukan lewat sinkronisasi audit-lubang-ui.md <-> build_tasks (H.4/AUD-04, 22 Agu 2026) -- baris ini sudah tercatat di audit sejak Sesi 5 tapi belum pernah jadi task.'
),
(
  1, 'PRD-12', 'Work Order: Kolom Status Tidak Pernah Diperbarui Kode Manapun', 'PRD', 'Produksi',
  'Dikonfirmasi lewat pencarian menyeluruh (TypeScript & SQL/RPC): `work_orders.status` TIDAK PERNAH di-UPDATE oleh kode manapun setelah baris dibuat -- tapi kolom ini TETAP ditampilkan apa adanya ke pengguna di kolom "STATUS" pada daftar Work Order (`listWorkOrders.ts` mengembalikan `status: wo.status` langsung). Field "Kesiapan/readiness" di kolom sebelahnya SUDAH benar dan dihitung live -- masalahnya spesifik ke kolom "STATUS".',
  'Sebuah Work Order akan tampak "Direncanakan" SELAMANYA di kolom Status walau seluruh batch di dalamnya sudah selesai diproduksi dan dikirim -- ini bukan cuma field mati di database, ini LABEL YANG MENYESATKAN yang benar-benar dibaca pengguna di layar.',
  'penting', array['Fungsi','Data'], 'Claude Code', 'menunggu', '/work-orders', 'temuan_claude',
  E'PERLU KEPUTUSAN PEMILIK PRODUK sebelum dikerjakan (bukan keputusan teknis) -- CLAUDE.md: "apakah suatu status dihitung selesai atau tidak" wajib ditanyakan, tidak boleh diasumsikan sendiri. Pertanyaan konkret: work_orders.status sebaiknya (a) dihapus dari tampilan kalau memang sudah digantikan status batch, atau (b) diturunkan otomatis dari status seluruh production_batches di bawahnya (kalau begitu, aturan transisi PERSISNYA seperti apa -- semua batch selesai = completed? satu batch jalan = in_progress? bagaimana kalau WO dipecah banyak batch per PRD-10?).',
  'Ditemukan lewat sinkronisasi audit-lubang-ui.md <-> build_tasks (H.4/AUD-04, 22 Agu 2026). Sebelumnya tercatat [I] "perlu klarifikasi" di audit -- diverifikasi ulang sesi ini (bukan cuma dugaan): benar 0 baris kode/migrasi yang meng-update kolom ini.'
),
(
  1, 'PRD-13', 'Edit Field Lain Batch Produksi (Bukan Cuma Tanggal)', 'PRD', 'Produksi',
  'Batch Produksi hanya bisa dikoreksi tanggal rencananya (reschedule) -- field lain (planned_qty, dll) tidak bisa diedit lewat aplikasi setelah batch dibuat.',
  'Kesalahan input rencana batch (mis. salah ketik jumlah rencana) tidak bisa dikoreksi lewat aplikasi kecuali tanggalnya -- satu-satunya jalan adalah hapus & buat ulang (kalau belum ada progres tercatat) atau dibiarkan salah.',
  'bisa_menunggu', array['Fungsi'], 'Claude Code', 'menunggu', '/production', 'temuan_claude',
  'Perlu keputusan pemilik produk: field apa saja yang wajar dikoreksi setelah batch dibuat (mis. planned_qty sebelum batch mulai berjalan), dan apakah ada batasan (mis. tidak boleh diedit lagi kalau sudah ada progress tahap/output tercatat).',
  'Ditemukan lewat sinkronisasi audit-lubang-ui.md <-> build_tasks (H.4/AUD-04, 22 Agu 2026) -- baris ini sudah tercatat di audit sejak Sesi 5 tapi belum pernah jadi task.'
),
(
  1, 'PRD-14', 'Pin/Override Manual Standar Produksi yang Usang', 'PRD', 'Produksi',
  '`production_standards` tidak punya fitur pin/override manual -- kalau PPIC tahu standar hasil belajar otomatis (K8) sudah usang/salah, tidak ada cara mengunci angka manual, harus menunggu batch baru terkumpul untuk standar baru terbentuk otomatis.',
  'Standar yang diketahui sudah usang tetap dipakai untuk hitung Kelayakan Jadwal & Margin Watch sampai cukup data batch baru terkumpul -- bisa berhari-hari/berminggu, selama itu semua proyeksi ikut salah walau PPIC sudah tahu angkanya keliru.',
  'bisa_menunggu', array['Fungsi','Database'], 'Claude Code', 'menunggu', '/ppic', 'temuan_claude',
  'Tambahkan kemampuan pin/lock nilai manual di layar Usulan Standar (`/ppic`) yang sudah ada -- kolom `pinned`/`pin_reason` sudah ada di skema `production_standards`, tinggal dibangun UI-nya.',
  'Ditemukan lewat sinkronisasi audit-lubang-ui.md <-> build_tasks (H.4/AUD-04, 22 Agu 2026) -- baris ini sudah tercatat di audit sejak Sesi 5 tapi belum pernah jadi task.'
),
(
  1, 'KPI-03', 'Isi Target & Arsipkan KPI Lewat Aplikasi', 'KPI', 'KPI',
  'Fungsi `updateKpiTarget.ts` dan `updateKpiVisibility.ts` sudah lengkap, tapi TIDAK ADA tombol/form di layar `/kpi` manapun yang memanggil keduanya -- target KPI tidak pernah bisa diisi, dan KPI yang sudah tidak relevan tidak bisa diarsipkan, lewat aplikasi.',
  'Seluruh desain KPI mengandalkan "baseline dulu, target menyusul" tapi tombol pengisi target tidak tersambung -- KPI selamanya tanpa target walau baseline sudah cukup lama terkumpul.',
  'penting', array['Fungsi','Visual'], 'Claude Code', 'menunggu', '/kpi', 'temuan_claude',
  'Sambungkan updateKpiTarget.ts dan updateKpiVisibility.ts (sudah ada, sudah teruji fungsinya) ke form/toggle di KpiPage.tsx. Bukan pekerjaan dari nol -- backend selesai, tinggal disambungkan. BEDA dari KPI-02 (KPI-2/3/4) yang soal MENAMBAH kartu KPI baru, bukan memperbaiki KPI yang sudah ada.',
  'Ditemukan lewat sinkronisasi audit-lubang-ui.md <-> build_tasks (H.4/AUD-04, 22 Agu 2026) -- baris ini sudah tercatat di audit sejak Sesi 5 (finding [P] #4, salah satu dari 12 finding [P]) tapi belum pernah jadi task.'
);
