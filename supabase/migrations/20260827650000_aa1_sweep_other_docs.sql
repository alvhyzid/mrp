-- AA.1 -- Sapu dokumen LAIN di docs/ (bukan cuma audit-lubang-ui.md) untuk
-- temuan/rencana yang belum pernah jadi build_tasks, memakai metodologi yang
-- sama seperti H.4 (cocokkan tiap temuan bernomor ke build_tasks lewat
-- pencarian kata kunci, bukan asumsi).
--
-- CATATAN JUJUR SOAL CAKUPAN: 4 nama dokumen yang diminta TIDAK ADA di
-- repo ini sama sekali (dicek `find` -- nol hasil): rencana-routing-
-- nonlinear.md, checklist-fase-spec-vs-fabrix.md, antrean-koreksi-fitur-
-- ada.md, instruksi-rebrand-fabrix.md. Tidak dikarang isinya -- dilaporkan
-- apa adanya di chat.
--
-- Dokumen yang ADA dan disapu penuh sesi ini: docs/audit-infrastruktur-
-- fabrix.md (6 temuan bernomor), docs/checklist-audit-jalan-kaki.md (5
-- temuan pra-jalan + 2 yang eksplisit "menunggu penilaian Anda"),
-- docs/spesifikasi-aturan-biaya-v1.md (0 gap aktif -- sudah v1 final,
-- catatan "nanti" di dalamnya eksplisit non-blocker).
--
-- HANDOFF.md TIDAK disapu tuntas (2000+ baris riwayat sesi, di luar
-- kewajaran satu putaran kerja) -- disapu SEBAGIAN lewat pencarian kata
-- kunci bertarget ("di luar cakupan", "belum dikerjakan", "utang teknis")
-- dan ditemukan 6 gap konkret yang belum py task (dicatat di bawah).
-- Sisanya BELUM diverifikasi -- jangan dianggap sudah lengkap.
insert into public.build_tasks
  (company_id, task_code, name, module_code, module_name, description, effect_description, urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes)
values
(
  1, 'SEC-04', 'Gerbang Peran untuk /debug dan /test-tenant', 'SEC', 'Keamanan',
  'Halaman `/debug` dan `/test-tenant` bisa dibuka STAF BIASA mana pun (dibuktikan Sesi 6 dengan akun `production_staff`) -- RLS membatasi BARIS ke company sendiri, tapi TIDAK ADA gerbang peran sama sekali di kedua halaman itu sendiri. Staf biasa bisa melihat email & peran SELURUH rekan kerja di perusahaan yang sama.',
  'Ditemukan sejak Sesi 6 (HANDOFF) dan disebut ulang di docs/audit-infrastruktur-fabrix.md (temuan #6, RENDAH tapi "menunggu keputusan") -- 2 kali disebutkan tapi TIDAK PERNAH jadi task sampai sinkronisasi AA.1 ini.',
  'penting', array['Keamanan'], 'Claude Code', 'menunggu', '/debug', 'temuan_claude',
  'Perlu keputusan pemilik produk (bukan teknis semata): gerbang ke company_admin saja? Hapus dari lingkungan produksi sepenuhnya? Atau biarkan untuk kebutuhan dukungan teknis dengan gerbang peran ditambahkan? Setelah keputusan, tinggal tambah pemeriksaan role di kedua halaman (pola sama seperti gerbang peran halaman lain).',
  'Ditemukan lewat sinkronisasi AA.1 (22 Agu 2026) -- audit-infrastruktur-fabrix.md temuan #6 dan HANDOFF Sesi 6 sudah menyebut ini 2x tapi belum pernah jadi task.'
),
(
  1, 'GDG-04', 'Opname Harian oleh Staf Gudang Biasa (Bukan Manager)', 'GDG', 'Gudang',
  'Satu-satunya jalur opname stok ("Penyesuaian Stok Manual") dibatasi HANYA ke `warehouse_manager` ke atas -- staf gudang biasa (`warehouse_staff`) tidak bisa mencatatnya sama sekali.',
  'Kalau opname harian di lapangan memang biasa dilakukan staf biasa (bukan manager), akses ini jadi blocker harian -- tapi ini murni dugaan, checklist-audit-jalan-kaki.md eksplisit menandai ini "MASIH BELUM ditambal, menunggu penilaian Anda" dari jalan-kaki langsung.',
  'bisa_menunggu', array['Keamanan','Fungsi'], 'Claude Code', 'menunggu', '/warehouse', 'temuan_claude',
  'JANGAN dikerjakan sebelum pemilik produk menjalankan jalan-kaki langsung dan memastikan apakah staf biasa memang perlu akses ini di lapangan -- ini pertanyaan kebijakan akses (siapa boleh apa), wajib ditanyakan sesuai CLAUDE.md, bukan diasumsikan.',
  'Ditemukan lewat sinkronisasi AA.1 (22 Agu 2026) -- sudah tercatat di checklist-audit-jalan-kaki.md sejak dokumen itu ditulis, belum pernah jadi task berdiri sendiri.'
),
(
  1, 'PRD-15', 'Tinjau Kategori Gangguan Produksi vs Kondisi Lapangan', 'PRD', 'Produksi',
  'Kategori gangguan produksi yang ada (Mesin Rusak/Listrik Padam/Faktor Eksternal/Dialihkan/Lainnya) belum dikonfirmasi cocok dengan kondisi lapangan sungguhan.',
  'Kalau kategori yang ada tidak mencakup jenis gangguan yang sering terjadi di lapangan, staf akan terus memilih "Lainnya" dan datanya jadi tidak berguna untuk analisis pola gangguan.',
  'bisa_menunggu', array['Data'], 'Claude Code', 'menunggu', '/production', 'temuan_claude',
  'JANGAN dikerjakan sebelum pemilik produk menilai lewat jalan-kaki apakah kategori ini cukup -- checklist-audit-jalan-kaki.md eksplisit menandai ini "MASIH BELUM ditambal, menunggu penilaian Anda".',
  'Ditemukan lewat sinkronisasi AA.1 (22 Agu 2026) -- sudah tercatat di checklist-audit-jalan-kaki.md sejak dokumen itu ditulis, belum pernah jadi task berdiri sendiri.'
),
(
  1, 'PRD-16', 'K8 Belum Bisa Belajar Standar Berbasis Laju (mis. Filling Sachet)', 'PRD', 'Produksi',
  'Job pembelajaran standar otomatis (`learnFromBatchCore.ts`, K8) cuma bisa mempelajari `active_duration_minutes` tetap -- TIDAK bisa mempelajari tahap yang standarnya berbasis LAJU (mis. Filling Sachet, 0,02857 mnt/pcs). Nilai laju tahap ini masih ditandai ESTIMASI_MANUAL selamanya, tidak pernah otomatis diperbarui dari batch sungguhan walau datanya sudah terkumpul.',
  'Standar laju yang dipakai hitung Kelayakan Jadwal & Margin Watch untuk tahap ini tetap berupa tebakan awal selamanya, tidak pernah membaik dari pengalaman produksi nyata seperti tahap lain -- padahal K8 untuk tahap durasi-tetap SUDAH bekerja sejak MRG-06.',
  'bisa_menunggu', array['Formula','Database'], 'Claude Code', 'menunggu', '/ppic', 'temuan_claude',
  'Perluasan learnFromBatchCore.ts supaya bisa menghitung & mengusulkan laju (qty/menit) dari work_order_step_progress, bukan cuma durasi tetap. Ditemukan sebagai gap residual SETELAH MRG-06 selesai (20 Agu) -- MRG-06 membangun dukungan durasi berbasis laju untuk DIPAKAI, tapi tidak untuk DIPELAJARI otomatis.',
  'Ditemukan lewat sinkronisasi AA.1 (22 Agu 2026) -- sudah dicatat sebagai "utang teknis" eksplisit di HANDOFF.md (Data Lapangan Nyata Routing Serbuk, 20 Agu) tapi belum pernah jadi task.'
),
(
  1, 'PRD-17', 'Kapasitas Harian Belum Melipatgandakan Berdasarkan Jumlah Shift Aktif', 'PRD', 'Produksi',
  'Kalkulasi hari-kerja untuk Kelayakan Jadwal (`countWorkingDays`/`getWorkingDaysPerWeek`) masih menghitung 1 hari = 1 unit kapasitas -- padahal struktur data SUDAH mendukung >1 shift per hari (shifts bukan tabel terikat tanggal, WO/batch bebas pilih shift mana pun).',
  'Pabrik yang menjalankan 2 shift dalam 1 hari tetap dihitung sistem seolah kapasitasnya sama dengan pabrik 1 shift -- proyeksi Kelayakan Jadwal jadi terlalu pesimis untuk lini yang sebenarnya sudah menjalankan shift ganda.',
  'bisa_menunggu', array['Formula'], 'Claude Code', 'menunggu', null, 'temuan_claude',
  'Perluasan fungsi hari-kerja feasibility supaya melipatgandakan kapasitas berdasarkan jumlah shift AKTIF pada hari itu, bukan cuma 1:1. Menyentuh banyak fungsi hari-kerja sekaligus -- tunggu keputusan eksplisit pemilik produk kalau memang dibutuhkan (dicatat HANDOFF sebagai "belum disentuh, tunggu keputusan").',
  'Ditemukan lewat sinkronisasi AA.1 (22 Agu 2026) -- sudah dicatat eksplisit di HANDOFF.md tapi belum pernah jadi task.'
),
(
  1, 'AUD-08', 'Konsistensi Tabel/Daftar: Sorting Kolom & Pola Detail vs Expand-Baris', 'AUD', 'Audit Kualitas',
  'Dua inkonsistensi UI berulang di HANDOFF.md sejak 19 Agu: (1) sorting kolom (klik header) belum ada di sebagian besar halaman daftar; (2) sebagian halaman pakai pola "Detail" (Card terpisah) untuk lihat rincian baris, sebagian lain pakai expand-baris inline (seperti Shipments) -- belum konsisten satu pola di semua halaman.',
  'Pengalaman pengguna berbeda-beda tanpa alasan jelas antar halaman yang fungsinya serupa (semua sama-sama "daftar dengan rincian per baris") -- makin lama makin banyak halaman baru yang bisa ikut pola berbeda lagi kalau tidak ditetapkan satu standar.',
  'bisa_menunggu', array['Visual'], 'Claude Code', 'menunggu', null, 'temuan_claude',
  'Keputusan sadar sebelumnya (dicatat HANDOFF 21-22 Agu, beberapa kali): ditunda karena bukan blocker MVP dan berisiko lebih besar dari "gaya visual" semata (migrasi Detail->expand-baris menyentuh STRUKTUR halaman, bukan cuma style). Perlu keputusan pemilik produk: satu pola mana yang jadi standar (Detail card, atau expand-baris), lalu diterapkan bertahap.',
  'Ditemukan lewat sinkronisasi AA.1 (22 Agu 2026) -- disebut berulang (minimal 4x) di HANDOFF.md sebagai "keputusan sadar"/"di luar cakupan" tapi belum pernah jadi task tersendiri yang bisa dilacak.'
),
(
  1, 'KPI-04', 'Snapshot KPI Harian Masih Manual (Belum Ada Scheduler)', 'KPI', 'KPI',
  'Snapshot harian KPI masih dipicu tombol manual -- belum ada cron/scheduler otomatis. Progres dihitung LIVE tiap panggilan (di luar cache) sebagai penyederhanaan sementara.',
  'Kalau tidak ada yang rutin menekan tombol snapshot, riwayat tren KPI akan bolong-bolong (bukan tercatat harian otomatis) -- mengurangi keandalan grafik tren KPI dari waktu ke waktu.',
  'bisa_menunggu', array['Integrasi'], 'Claude Code', 'menunggu', '/kpi', 'temuan_claude',
  'Butuh scheduler yang belum ada di proyek ini (Vercel Cron atau sejenisnya) -- terkait juga dengan RBD-03/INF-02 (infrastruktur belum dirapikan). Sebaiknya digabung sekalian saat infrastruktur ditata ulang, bukan dikerjakan terpisah lebih dulu.',
  'Ditemukan lewat sinkronisasi AA.1 (22 Agu 2026) -- dicatat eksplisit di HANDOFF.md sebagai "di luar cakupan sesi ini, butuh scheduler yang belum ada" tapi belum pernah jadi task.'
),
(
  1, 'MRG-07', 'Rata-Rata Tarif Kru Tidak Difilter per Plant/Departemen', 'MRG', 'Margin & Biaya',
  'Rata-rata tarif kru untuk hitung biaya SDM standar diambil COMPANY-WIDE per `wage_type`, TIDAK difilter per plant/departemen -- karyawan non-produksi dengan wage_type sama (contoh nyata ditemukan: janitor bergaji bulanan) ikut masuk hitungan rata-rata kru produksi.',
  'Biaya SDM standar per unit produksi jadi sedikit bias (tercampur gaji karyawan yang sebenarnya tidak ikut produksi) -- imprecision kecil tapi sistematis, sudah diketahui sejak Bagian B (20 Agu) dan belum diperbaiki.',
  'bisa_menunggu', array['Formula'], 'Claude Code', 'menunggu', null, 'temuan_claude',
  'Filter perhitungan rata-rata tarif kru supaya hanya menghitung karyawan di plant/departemen produksi yang relevan, bukan company-wide. Perlu konfirmasi pemilik produk soal cara paling tepat menentukan "siapa termasuk kru produksi" (berdasarkan department? production_plant_id? kombinasi keduanya?).',
  'Ditemukan lewat sinkronisasi AA.1 (22 Agu 2026) -- dicatat eksplisit di HANDOFF.md sebagai "gap terbuka" sejak Bagian B (20 Agu) tapi belum pernah jadi task.'
),
(
  1, 'MRG-08', 'Lapis 3 Margin Watch — 7 Tuas Perbaikan', 'MRG', 'Margin & Biaya',
  'Margin Watch baru punya Lapis 1 (baseline) dan Lapis 2 (pembongkaran selisih) yang sudah selesai (MRG-05). Lapis 3 (7 tuas perbaikan margin -- aksi konkret yang bisa diambil dari selisih yang ditemukan) belum dibangun.',
  'Pengguna bisa MELIHAT dari mana selisih margin berasal (Lapis 2) tapi belum dituntun apa yang bisa DILAKUKAN soal itu -- separuh nilai fitur (diagnosis) sudah ada, separuh lain (resep tindakan) belum.',
  'bisa_menunggu', array['Fungsi','Formula'], 'Claude Code', 'menunggu', '/sales-orders', 'pemilik_produk',
  'Diminta eksplisit "kerjakan SETELAH Lapis 1-2 terbukti jalan" (sudah terbukti sejak MRG-05) -- cakupan 7 tuas perbaikan belum ditentukan detailnya, perlu klarifikasi pemilik produk soal tuas mana saja yang dimaksud.',
  'Ditemukan lewat sinkronisasi AA.1 (22 Agu 2026) -- diminta eksplisit oleh pemilik produk (HANDOFF menyebut permintaan langsung) tapi belum pernah jadi task tersendiri yang bisa dilacak.'
),
(
  1, 'MRG-09', 'Kelayakan Jadwal: Reframe dari Biner ke Kurva Proyeksi Pengiriman', 'MRG', 'Margin & Biaya',
  'Tampilan Kelayakan Jadwal saat ini biner (FEASIBLE/TIDAK). Diminta direframe jadi kurva proyeksi pengiriman (rentang tanggal/probabilitas, bukan cuma ya/tidak).',
  'Jawaban biner menyembunyikan nuansa "feasible tapi mepet" vs "feasible dengan banyak slack" -- kurva proyeksi akan memberi gambaran lebih kaya untuk keputusan PPIC/Purchasing.',
  'bisa_menunggu', array['Visual','Formula'], 'Claude Code', 'menunggu', '/sales-orders', 'pemilik_produk',
  'Diminta "sekalian" di permintaan yang sama dengan Lapis 3 Margin Watch, TAPI merupakan fitur terpisah yang cukup besar -- belum disentuh, perlu sesi/giliran kerja sendiri sesuai catatan HANDOFF.',
  'Ditemukan lewat sinkronisasi AA.1 (22 Agu 2026) -- diminta eksplisit oleh pemilik produk tapi belum pernah jadi task tersendiri yang bisa dilacak.'
);
