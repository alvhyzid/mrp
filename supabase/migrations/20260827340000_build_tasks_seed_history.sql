-- Halaman Daftar Tugas Pembangunan (21 Agu 2026) -- data historis direkonstruksi
-- dari HANDOFF.md, riwayat commit git (154 commit, git log --reverse), dan docs/*.md.
-- Tidak ada task/tanggal/status yang dikarang tanpa jejak (G.1) -- yang statusnya
-- tidak bisa dipastikan dari jejak yang ada ditandai eksplisit di kolom notes.
do $$
declare
  v_company_id integer;
  v_task_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then
    raise notice 'Perusahaan PT ITM tidak ditemukan -- seed build_tasks dilewati (no-op).';
    return;
  end if;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'FND-01', 'Fondasi Multi-Tenant: Auth, RLS, Design System', 'FND', 'Fondasi SaaS', 'Dasar seluruh sistem: login/registrasi, pemisahan data antar perusahaan (RLS) di level database, dan sistem tampilan (design system) yang dipakai di semua layar.', 'Tanpa ini, tidak ada satu pun fitur lain yang bisa dibangun aman untuk banyak perusahaan sekaligus — setiap perusahaan wajib hanya melihat datanya sendiri.',
    'ditunda_sadar', ARRAY['Fungsi','Database','Keamanan']::text[], 'Claude Code', 'selesai', '/dashboard', 'perencanaan_awal', 'Next.js + Supabase Auth, tabel companies/users/subscription_plans, RLS berbasis company_id di setiap tabel utama, Carbon Design System sebagai basis tampilan seluruh layar.', 'Ditandai "Ditunda Sadar" bukan berarti belum jadi — ini penanda historis bahwa fondasi ini SELESAI dan tidak akan disentuh ulang kecuali ada kebutuhan baru; dipertahankan sebagai catatan asal-usul proyek.',
    '2026-08-11'::date, '2026-08-11'::date, '2026-08-13'::date, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'FND-02', 'Tim & Undangan Anggota', 'FND', 'Fondasi SaaS', 'Admin perusahaan bisa mengundang anggota tim baru lewat email, mengatur peran, dan menonaktifkan anggota yang keluar.', 'Tanpa ini, penambahan pengguna baru wajib lewat database langsung oleh developer.',
    'bisa_menunggu', ARRAY['Fungsi','Database']::text[], 'Claude Code', 'selesai', '/team', 'perencanaan_awal', 'Tabel invitations, alur invite->accept, halaman Kelola Tim dengan ubah peran & nonaktifkan (soft-delete via status).', NULL,
    '2026-08-13'::date, '2026-08-13'::date, '2026-08-13'::date, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'FND-03', 'Pengerasan Keamanan Sesi & Token Login', 'FND', 'Fondasi SaaS', 'Perbaikan celah teknis pada proses login: sesi pengguna baru yang belum lengkap datanya sempat bisa ditolak keliru oleh sistem.', 'Tanpa perbaikan ini, sebagian pengguna baru bisa gagal login karena data akun mereka belum lengkap terbentuk.',
    'bisa_menunggu', ARRAY['Keamanan','Fungsi']::text[], 'Claude Code', 'selesai', NULL, 'temuan_claude', 'Perbaikan custom-access-token hook Supabase agar tidak menolak sesi pengguna yang baris users-nya belum terbentuk.', NULL,
    '2026-08-17'::date, '2026-08-17'::date, '2026-08-17'::date, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'MST-01', 'Master Item', 'MST', 'Master Data', 'Layar untuk mencatat seluruh bahan baku, kemasan, dan barang jadi — kode, nama, satuan, biaya standar.', 'Tanpa ini, BOM/Routing/Work Order tidak punya bahan untuk dirujuk sama sekali.',
    'ditunda_sadar', ARRAY['Fungsi','Database']::text[], 'Claude Code', 'selesai', '/items', 'perencanaan_awal', 'Tabel items + RLS akses biaya (standard_cost) khusus role finansial, CRUD penuh termasuk arsip (is_active).', NULL,
    '2026-08-12'::date, '2026-08-12'::date, '2026-08-12'::date, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'MST-02', 'Master BOM (Resep)', 'MST', 'Master Data', 'Layar untuk menyusun resep produksi per item — bahan apa saja dan berapa rasionya per unit hasil.', 'Tanpa ini, sistem tidak tahu bahan apa yang dibutuhkan untuk membuat 1 unit produk.',
    'ditunda_sadar', ARRAY['Fungsi','Database','Formula']::text[], 'Claude Code', 'selesai', '/boms', 'perencanaan_awal', 'Tabel boms+bom_lines, CRUD dengan penjagaan referensi melingkar (circular reference), status draft/active/archived.', NULL,
    '2026-08-12'::date, '2026-08-12'::date, '2026-08-12'::date, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'MST-03', 'Master Routing & Gantt Produksi', 'MST', 'Master Data', 'Layar untuk menyusun urutan tahap produksi per item, dan menampilkannya sebagai jadwal visual (Gantt) per lini produksi.', 'Tanpa ini, tidak ada cara sistematis menjadwalkan & memvisualisasikan pekerjaan produksi per lini.',
    'ditunda_sadar', ARRAY['Fungsi','Visual','Database']::text[], 'Claude Code', 'selesai', '/routing', 'perencanaan_awal', 'Tabel routings+routing_steps, halaman Routing, Gantt Produksi per Work Center (klik-detail, drag reschedule, toggle harian/mingguan/bulanan), Dashboard Kapasitas per Work Center.', NULL,
    '2026-08-14'::date, '2026-08-14'::date, '2026-08-15'::date, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'MST-04', 'Snapshot Routing & BOM per Batch (Sesi 6A)', 'MST', 'Master Data', 'Begitu sebuah batch produksi dimulai, angka routing/BOM yang dipakai dibekukan permanen untuk batch itu — perubahan resep/routing setelahnya tidak lagi diam-diam mengubah riwayat batch yang sudah/sedang berjalan.', 'Tanpa ini, mengedit routing/BOM bisa diam-diam mengubah dasar hitungan biaya & durasi batch yang sudah selesai/berjalan — ditemukan sebagai risiko hidup sebelum Sesi 7.',
    'ditunda_sadar', ARRAY['Database','Formula','Keamanan']::text[], 'Claude Code', 'selesai', '/work-orders', 'temuan_claude', '3 tabel snapshot baru (routing step/BOM line/kru standar), dibekukan di startProductionBatch.ts, dibaca Gantt/Kapasitas/Kebutuhan Bahan.', NULL,
    '2026-08-21'::date, '2026-08-21'::date, '2026-08-21'::date, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'MST-05', 'Jalan Keluar Routing (Hapus/Arsipkan)', 'MST', 'Master Data', 'Versi routing yang belum pernah dipakai bisa dihapus permanen; yang sudah dipakai hanya bisa diarsipkan (bukan dihapus) dan bisa dipulihkan lagi.', 'Tanpa ini, routing yang dibuat salah/usang menumpuk selamanya tanpa cara dikeluarkan dari sistem.',
    'ditunda_sadar', ARRAY['Fungsi','Database','Keamanan']::text[], 'Claude Code', 'selesai', '/routing', 'temuan_claude', 'Kolom archived_at/archived_by, server yang menghitung hapus-vs-arsip (bukan pilihan pengguna), filter "Tampilkan yang diarsipkan", dropdown Work Order otomatis kecualikan yang diarsipkan.', 'Ini menjadi CETAKAN pola untuk 5 layar master data lain yang masih menunggu (lihat MST-06 s.d. MST-10, PMB-04).',
    '2026-08-21'::date, '2026-08-21'::date, '2026-08-21'::date, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'MST-06', 'Perbaiki Dropdown BOM Tampilkan yang Diarsipkan', 'MST', 'Master Data', 'Dropdown pemilihan BOM saat membuat Work Order baru ternyata masih menampilkan versi BOM yang sudah diarsipkan.', 'Tanpa perbaikan, pengguna bisa tanpa sadar memilih resep versi lama yang seharusnya sudah tidak dipakai lagi.',
    'penting', ARRAY['Fungsi']::text[], 'Claude Code', 'menunggu', '/work-orders', 'temuan_claude', 'Filter `status != archived` pada query daftar BOM yang dipakai dropdown Work Order (WorkOrdersPage.tsx). Bug ditemukan saat audit ulang skema (Sesi 7 lanjutan).', NULL,
    '2026-08-21'::date, NULL, NULL, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'MST-07', 'Perbaiki Dropdown Item Tampilkan yang Nonaktif', 'MST', 'Master Data', 'Dropdown pemilihan bahan/item di layar PO Klien, BOM, dan Routing ternyata masih menampilkan item yang sudah dinonaktifkan.', 'Tanpa perbaikan, pengguna bisa memilih item yang seharusnya sudah tidak dipakai lagi untuk transaksi baru.',
    'penting', ARRAY['Fungsi']::text[], 'Claude Code', 'menunggu', NULL, 'temuan_claude', 'Filter `is_active=true` pada dropdown item di CustomerPurchaseOrdersPage.tsx, BomsPage.tsx, RoutingsPage.tsx. Bug kelas sama dengan MST-06, ditemukan bersamaan.', NULL,
    '2026-08-21'::date, NULL, NULL, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'MST-08', 'Jalan Keluar Lini/Stasiun Produksi (Work Center)', 'MST', 'Master Data', 'Lini produksi belum bisa dibuat/diubah namanya sama sekali (hanya kapasitasnya), dan kolom arsipnya sudah ada di database tapi belum ada tombolnya.', 'Tanpa ini, menambah lini produksi baru atau menonaktifkan yang lama wajib lewat developer.',
    'penting', ARRAY['Fungsi','Database']::text[], 'Claude Code', 'menunggu', '/ppic', 'temuan_claude', 'Tiru pola MST-05 (Routing): tambah CRUD identitas (nama/kode), sambungkan kolom is_active yang sudah ada ke tombol Arsipkan/Pulihkan di layar.', NULL,
    '2026-08-21'::date, NULL, NULL, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'MST-09', 'Pengaturan Pabrik/Lokasi Produksi (production_plants)', 'MST', 'Master Data', 'Tidak ada satu pun layar untuk menambah/mengubah pabrik atau lokasi produksi — hari ini wajib lewat migrasi SQL manual oleh developer.', 'Tenant baru yang mendaftar tanpa bantuan developer TIDAK BISA memakai sistem ini sama sekali sampai minimal 1 pabrik disisipkan lewat database — ini gap paling parah untuk kemandirian tenant baru.',
    'penting', ARRAY['Fungsi','Database']::text[], 'Claude Code', 'menunggu', NULL, 'temuan_claude', 'Bangun CRUD dari nol: layar daftar pabrik, form tambah/ubah (nama, alamat opsional), arsip. Perlu keputusan pemilik produk: field apa saja yang wajib ada di pabrik baru.', 'Ditemukan saat "Uji Sistem Bukan Hardcode" — poin 4.',
    '2026-08-21'::date, NULL, NULL, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'MST-10', 'Pengaturan Shift Kerja', 'MST', 'Master Data', 'Shift kerja sepenuhnya tidak terlihat di aplikasi, hanya bisa diubah lewat database.', 'HR tidak bisa menyesuaikan jam shift produksi sendiri.',
    'bisa_menunggu', ARRAY['Fungsi','Database']::text[], 'Claude Code', 'menunggu', NULL, 'temuan_claude', 'Bangun CRUD dari nol untuk tabel shifts — perlu keputusan pemilik produk soal field & aturan bisnis shift (jumlah shift, jam mulai/selesai standar).', NULL,
    '2026-08-21'::date, NULL, NULL, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'MST-11', 'Standar Kru per Lini Produksi (routing_step_standard_crew)', 'MST', 'Master Data', 'Komposisi kru standar per lini produksi (dipakai menghitung biaya SDM standar tiap batch) hanya bisa diisi lewat perintah database langsung.', 'Kalau komposisi kru berubah, biaya SDM standar di Margin Watch diam-diam salah sampai developer turun tangan. Dikonfirmasi 0 baris untuk PT ITM saat ini.',
    'penting', ARRAY['Fungsi','Database','Formula']::text[], 'Claude Code', 'menunggu', NULL, 'temuan_claude', 'Bangun layar CRUD baru dari nol. ANGKA BISNIS (berapa orang, jenis upah per lini) WAJIB dari pemilik produk/PPIC — Claude Code tidak boleh menebak.', 'PIC pengisian angka: PPIC (bukan Claude Code) — ini angka bisnis, bukan keputusan teknis.',
    '2026-08-21'::date, NULL, NULL, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'MST-12', 'Routing Berversi Sungguhan (Edit = Versi Baru)', 'MST', 'Master Data', 'Mengedit routing yang sudah dipakai Work Order saat ini menimpa isi versi yang sama, bukan membuat versi baru — riwayat bentuk routing di tanggal tertentu hilang begitu diedit.', 'Relevan untuk audit BPOM/halal yang bisa menanyakan bentuk SOP produksi pada tanggal tertentu. Snapshot MST-04 melindungi ANGKA batch berjalan, tapi riwayat routing itu sendiri tetap hilang.',
    'penting', ARRAY['Database','Fungsi']::text[], 'Claude Code', 'menunggu', '/routing', 'temuan_claude', 'updateRouting.ts/updateBom.ts perlu diubah dari delete+reinsert-di-tempat menjadi benar-benar membuat baris versi baru + mengarsipkan versi lama. Dicatat sebagai utang teknis sejak Sesi 6A, dijadwalkan Sesi 7 lanjutan.', NULL,
    '2026-08-21'::date, NULL, NULL, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'MST-13', 'Konversi Satuan (UOM) Generik Lintas Modul', 'MST', 'Master Data', 'Konversi satuan beli-ke-satuan-dasar sudah bekerja untuk alur penerimaan barang, tapi belum tentu konsisten dipakai di seluruh modul yang menyentuh satuan.', 'Tanpa audit menyeluruh, ada risiko modul lain (mis. laporan/ekspor) memakai satuan yang salah tanpa disadari.',
    'bisa_menunggu', ARRAY['Data','Fungsi']::text[], 'Claude Code', 'menunggu', NULL, 'perencanaan_awal', 'Audit seluruh titik pemakaian uom_conversion_factor, pastikan konsisten. Belum ada bukti bug konkret — task berjaga (preventif), bukan perbaikan bug yang sudah ditemukan.', NULL,
    '2026-08-21'::date, NULL, NULL, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'PMB-01', 'Purchasing, Penerimaan Barang, Telusur Lot', 'PMB', 'Pembelian', 'Alur beli bahan dari supplier: buat PO, terima barang (otomatis jadi stok/lot baru), dan telusuri asal-usul tiap lot.', 'Tanpa ini, tidak ada cara mencatat pembelian bahan baku & menerima barangnya secara terlacak.',
    'ditunda_sadar', ARRAY['Fungsi','Database']::text[], 'Claude Code', 'selesai', '/purchasing', 'perencanaan_awal', 'Tabel suppliers/purchase_orders/purchase_order_lines/goods_receipts/goods_receipt_lines, konversi satuan beli->dasar otomatis saat barang diterima.', NULL,
    '2026-08-16'::date, '2026-08-16'::date, '2026-08-16'::date, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'PMB-02', 'Penyesuaian Skema PO/SO dari Dokumen Nyata', 'PMB', 'Pembelian', '5 penyesuaian skema PO/SO berdasarkan dokumen PO/SO asli perusahaan.', 'Tanpa penyesuaian ini, skema tidak cocok dengan bentuk dokumen bisnis nyata perusahaan.',
    'ditunda_sadar', ARRAY['Database']::text[], 'Claude Code', 'selesai', NULL, 'pemilik_produk', 'Penyesuaian kolom PO/SO berdasarkan tinjauan dokumen nyata milik perusahaan.', NULL,
    '2026-08-13'::date, '2026-08-13'::date, '2026-08-13'::date, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at, approval_review_steps, approval_location, approval_example_case, approval_if_approved, approval_if_rejected, approval_options
  ) values (
    v_company_id, 'PMB-03', 'Supplier & Pelanggan — CRUD Lengkap, Jalan Keluar, Bahan Dipasok (Alur 1)', 'PMB', 'Pembelian', 'Supplier & Pelanggan sekarang bisa dikelola penuh (buat/ubah/hapus/arsipkan) tanpa developer, plus daftar "bahan apa dipasok supplier mana dengan harga berapa", dan surat jalan membekukan identitas pelanggan supaya tidak ikut berubah kalau data pelanggan diedit belakangan.', 'Sebelumnya supplier tidak bisa diedit sama sekali, pelanggan bahkan tidak punya halaman kelola. Ini juga CONTOH POLA untuk 5 layar master data sisa.',
    'penting', ARRAY['Fungsi','Database','Formula','Keamanan']::text[], 'Claude Code', 'menunggu_persetujuan', '/purchasing', 'pemilik_produk', 'Migrasi 20260827290000/300000/310000/320000. Field baru: alamat/NPWP/PIC/termin di suppliers & customers. Tabel baru supplier_item_prices (harga acuan, BUKAN HPP). Snapshot identitas pelanggan di shipments. Server menolak mengunci Margin Watch kalau biaya berasal dari harga acuan. Regresi keamanan grant sempat tertangkap & diperbaiki (lihat SEC-03).', 'Lihat E.3 lengkap di bagian approval.',
    '2026-08-21'::date, '2026-08-21'::date, '2026-08-21'::date, NULL, 'Buka halaman Supplier (/purchasing) dan Pelanggan (/customers) di tenant uji. Coba: (1) buat supplier baru lalu hapus — harus berhasil; (2) buat supplier baru, pakai di 1 PO, coba hapus — harus ditolak dengan pesan sebut PO-nya, tombol berubah jadi "Arsipkan"; (3) arsipkan supplier itu, buka dropdown PO Supplier baru — supplier itu harus hilang, tapi PO lama yang memakainya tetap tampil normal; (4) pulihkan lagi; (5) tambah "bahan yang dipasok" dari layar Supplier, lalu cek muncul juga di layar Item pada bahan yang sama; (6) buat pelanggan baru, catat alamatnya, buat 1 surat jalan, lalu ubah alamat pelanggan itu, buka lagi surat jalan yang sudah dibuat tadi — alamatnya harus TETAP alamat lama.', 'Master Data -> PO Supplier (/purchasing) untuk Supplier & Bahan Dipasok; Master Data -> Pelanggan (/customers) untuk Pelanggan; Pengiriman -> buka salah satu Surat Jalan untuk snapshot alamat.', 'Contoh nyata yang sudah dicoba Claude Code (lalu dihapus lagi): supplier "Supplier Visual Alur1" dibuat, ditambah bahan "ALUR1-VISUAL-RM" dengan harga acuan Rp18.500 dari layar Supplier -- muncul otomatis di layar Item pada bahan yang sama.', 'Pola ini (tombol arsip/hapus dihitung sistem, filter arsip, snapshot dokumen, harga acuan vs HPP, tata letak modal) akan DITIRU PERSIS ke 5 layar master data sisa (BOM, Item, Karyawan, Lini Produksi, Daftar KPI).', 'Claude Code akan memperbaiki sesuai koreksi sebelum pola ini ditiru ke layar lain -- supaya kesalahan yang sama tidak terulang 5 kali.', NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'PMB-04', 'Audit Ulang Skema dari Database Sungguhan', 'PMB', 'Pembelian', 'Menemukan bahwa daftar tabel yang diperiksa sesi-sesi sebelumnya tidak pernah disinkronkan ke skema database sungguhan — diaudit ulang pakai daftar tabel LANGSUNG dari database (80 tabel), bukan dari ingatan/dokumen.', 'Tanpa audit ulang ini, celah seperti "Pelanggan tidak punya halaman kelola" (lolos DUA KALI dari audit sebelumnya) tidak akan pernah ketahuan.',
    'ditunda_sadar', ARRAY['Dokumentasi','Data']::text[], 'Claude Code', 'selesai', NULL, 'temuan_claude', 'Introspection skema lewat endpoint Supabase, klasifikasi ulang 80 tabel (master/transaksi/log/butuh-dibangun-dari-nol/sudah-lengkap), docs/audit-lubang-ui.md ditulis ulang.', NULL,
    '2026-08-21'::date, '2026-08-21'::date, '2026-08-21'::date, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'PMB-05', 'Pengaturan Perusahaan (company_settings)', 'PMB', 'Pembelian', 'Metode overhead, jam kerja per hari, dan tarif BPJS pemberi kerja hanya bisa diisi lewat skrip developer atau SQL langsung — tidak ada layar sama sekali.', 'Tenant baru tidak bisa mengatur biaya operasionalnya sendiri; angka-angka ini WAJIB benar untuk perhitungan Margin Watch & Laba Operasional.',
    'penting', ARRAY['Fungsi','Database']::text[], 'Claude Code', 'menunggu', NULL, 'temuan_claude', 'Bangun layar pengaturan dari nol. ANGKA BISNIS (tarif BPJS, baseline overhead) WAJIB dari pemilik produk — jangan ditebak.', 'Ditemukan saat "Uji Sistem Bukan Hardcode".',
    '2026-08-21'::date, NULL, NULL, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'PMB-06', 'Sapu Angka Cadangan (Fallback) di Kode', 'PMB', 'Pembelian', '3 angka bisnis masih tertulis sebagai cadangan di kode (bukan di database): 173,3333 jam kerja/bulan, 21 hari kerja/bulan, 6 hari kerja/minggu — dipakai HANYA kalau company_settings belum diisi.', 'Kalau tenant belum mengisi company_settings, sistem diam-diam memakai angka tebakan ini tanpa pemberitahuan.',
    'bisa_menunggu', ARRAY['Data','Formula']::text[], 'Claude Code', 'menunggu', NULL, 'temuan_claude', 'computeStandardLaborCostPerUnit.ts & getWorkCenterCapacity.ts. Terkait erat dengan PMB-05 — begitu layar Pengaturan Perusahaan ada, pertimbangkan apakah fallback ini masih perlu atau sistem harus menolak menghitung (pola sama seperti BPJS yang sudah benar: tidak menebak, menolak menghitung).', NULL,
    '2026-08-21'::date, NULL, NULL, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'PMB-07', 'Pembekuan Identitas Mitra di Dokumen Lain (PO Supplier/Klien/SO)', 'PMB', 'Pembelian', 'Alur 1 baru membekukan identitas pelanggan di Surat Jalan. PO Supplier juga dicetak & dikirim ke pihak luar tapi masih hanya menyimpan referensi ke data supplier — kalau supplier pindah kantor, PO lama ikut berubah alamatnya. Perlu diperiksa juga PO Klien dan Sales Order.', 'Dokumen yang sudah "terbit" ke pihak luar seharusnya tidak berubah isinya lagi kalau master data diedit belakangan — sama kelas masalah dengan yang ditemukan di Surat Jalan.',
    'mendesak', ARRAY['Database','Fungsi']::text[], 'Claude Code', 'menunggu', NULL, 'temuan_claude', 'Periksa apakah PO Supplier/PO Klien/Sales Order benar-benar dicetak/dikirim ke pihak luar (kalau tidak, prioritas turun). Kalau ya, tiru pola snapshot Alur 1 3.1b. Dicatat H.3.', 'Aman dikerjakan paralel.',
    '2026-08-21'::date, NULL, NULL, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'PJL-01', 'Alur PO Klien -> Approval -> Sales Order -> Work Order', 'PJL', 'Penjualan', 'Alur dari PO pelanggan masuk, disetujui 3 departemen, otomatis jadi Sales Order, sampai bisa diturunkan jadi Work Order produksi.', 'Tanpa ini, tidak ada jalur resmi order pelanggan sampai ke lantai produksi.',
    'ditunda_sadar', ARRAY['Fungsi','Database']::text[], 'Claude Code', 'selesai', '/customer-purchase-orders', 'perencanaan_awal', 'Tabel customer_purchase_orders/customer_po_approvals/sales_orders, fungsi process_customer_purchase_order(), approval 3 departemen wajib sebelum SO tercipta.', NULL,
    '2026-08-13'::date, '2026-08-13'::date, '2026-08-13'::date, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'PJL-02', 'Halaman Sales Order', 'PJL', 'Penjualan', 'Layar daftar Sales Order di bawah menu MRP.', 'Tanpa ini, SO hanya bisa dicek lewat database.',
    'ditunda_sadar', ARRAY['Visual']::text[], 'Claude Code', 'selesai', '/sales-orders', 'perencanaan_awal', 'Halaman daftar SO.', NULL,
    '2026-08-14'::date, '2026-08-14'::date, '2026-08-14'::date, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'PJL-03', 'Tombol Selesai/Batal Sales Order', 'PJL', 'Penjualan', 'Status Sales Order tidak pernah berubah lewat aplikasi manapun — akan tampak "confirmed" selamanya walau produksi & pengiriman sudah tuntas.', 'Laporan/status order tidak bisa dipercaya karena status tidak pernah mencerminkan kenyataan.',
    'penting', ARRAY['Fungsi']::text[], 'Claude Code', 'menunggu', '/sales-orders', 'temuan_claude', 'Tambahkan transisi status (mis. otomatis selesai saat semua baris terkirim, atau tombol manual batal). Perlu keputusan pemilik produk soal aturan transisi yang benar.', NULL,
    '2026-08-21'::date, NULL, NULL, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'PJL-04', 'Tombol Tunda/Batal PO Klien', 'PJL', 'Penjualan', 'Tombol Tunda/Batal PO Klien sudah ada di layar tapi belum tersambung ke logika apa pun (disabled sementara).', 'Order bermasalah (client minta tunda/batal) mengendap selamanya berstatus "baru" karena tidak ada kode yang menjalankan aksinya.',
    'penting', ARRAY['Fungsi']::text[], 'Claude Code', 'menunggu', '/customer-purchase-orders', 'temuan_claude', 'Sambungkan tombol yang sudah ada (CustomerPurchaseOrdersPage.tsx) ke endpoint yang mengubah status on_hold/cancelled.', NULL,
    '2026-08-21'::date, NULL, NULL, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'PJL-05', 'Cegah Duplikat Order', 'PJL', 'Penjualan', 'Belum ada pemeriksaan eksplisit untuk mencegah PO Klien/Sales Order duplikat masuk lebih dari sekali.', 'Risiko pesanan yang sama tercatat dua kali, membingungkan produksi & keuangan.',
    'bisa_menunggu', ARRAY['Data','Fungsi']::text[], 'Claude Code', 'menunggu', NULL, 'perencanaan_awal', 'Perlu klarifikasi pemilik produk: apa definisi "duplikat" untuk PO Klien (nomor PO sama? customer+tanggal+item sama?).', NULL,
    '2026-08-21'::date, NULL, NULL, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'GDG-01', 'Pengerasan Arsitektur Gudang: State Machine, Jejak Audit, Idempotensi', 'GDG', 'Gudang', 'Pergerakan stok ditegakkan lewat mesin status di level database (bukan cuma kode aplikasi), setiap perubahan tercatat, dan aksi ganda (double-click) tidak menghasilkan 2 transaksi.', 'Tanpa ini, pergerakan stok rawan salah urutan status atau tercatat dobel.',
    'ditunda_sadar', ARRAY['Database','Keamanan']::text[], 'Claude Code', 'selesai', NULL, 'perencanaan_awal', 'status_transition_rules/status_transition_log, kunci idempotency_key di beberapa alur transaksi.', NULL,
    '2026-08-16'::date, '2026-08-16'::date, '2026-08-16'::date, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'GDG-02', 'Saldo Awal Stok (Opening Balance)', 'GDG', 'Gudang', 'Fitur mengisi saldo stok awal saat tenant baru mulai memakai sistem (bukan mulai dari nol).', 'Tanpa ini, tenant yang sudah punya stok berjalan tidak bisa migrasi ke sistem baru dengan angka stok yang benar.',
    'ditunda_sadar', ARRAY['Fungsi','Data']::text[], 'Claude Code', 'selesai', '/warehouse', 'perencanaan_awal', 'Fitur opening balance + data saldo awal Karanglo dimuat sebagai data nyata.', NULL,
    '2026-08-18'::date, '2026-08-18'::date, '2026-08-18'::date, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'GDG-03', 'Telusur Asal Bahan (Lot Genealogy)', 'GDG', 'Gudang', 'Tidak ada satu layar pun untuk menampilkan riwayat asal-usul sebuah lot produk jadi (lot mana saja yang jadi bahannya).', 'Kalau BPOM/auditor halal minta bukti asal-usul sebuah lot, datanya ADA di database tapi harus di-query manual — tidak ada layarnya.',
    'mendesak', ARRAY['Fungsi','Visual','Data']::text[], 'Claude Code', 'menunggu', NULL, 'temuan_claude', 'Data lot_genealogy sudah tercatat otomatis oleh sistem produksi — tinggal dibangun 1 layar penelusuran (masukkan nomor lot -> tampilkan pohon asal-usulnya).', 'Aman dikerjakan paralel (murni layar baca, bukan modal input).',
    '2026-08-21'::date, NULL, NULL, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'PRD-01', 'Batch Produksi & Kalkulasi Kebutuhan Bahan Otomatis', 'PRD', 'Produksi', 'Layar untuk membuat batch produksi dari Work Order, dengan kebutuhan bahan dihitung otomatis dari BOM.', 'Tanpa ini, PPIC harus menghitung kebutuhan bahan tiap batch secara manual.',
    'ditunda_sadar', ARRAY['Fungsi','Formula']::text[], 'Claude Code', 'selesai', '/production', 'perencanaan_awal', 'Tabel production_batches, kalkulasi kebutuhan bahan dari eksplosi BOM.', NULL,
    '2026-08-14'::date, '2026-08-14'::date, '2026-08-14'::date, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'PRD-02', 'Deteksi Otomatis Kekurangan Bahan/Kru/Mesin', 'PRD', 'Produksi', 'Sistem otomatis mendeteksi & memperingatkan kalau Work Order kekurangan bahan, kekurangan kru, atau mesin rusak.', 'Tanpa ini, kekurangan baru ketahuan saat produksi sudah berjalan dan terlambat.',
    'ditunda_sadar', ARRAY['Fungsi','Data']::text[], 'Claude Code', 'selesai', '/work-orders', 'perencanaan_awal', 'Deteksi otomatis material shortage, worker shortage, machine breakdown pada Work Order, notifikasi Bell Icon per departemen.', NULL,
    '2026-08-13'::date, '2026-08-13'::date, '2026-08-16'::date, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'PRD-03', 'Kaskade Gangguan Produksi Seluruh Pabrik', 'PRD', 'Produksi', 'Kalau ada gangguan yang mempengaruhi seluruh pabrik (mis. listrik padam), efeknya otomatis menyebar ke semua Work Order terkait.', 'Tanpa ini, gangguan pabrik-lebar harus dicatat manual satu per satu ke tiap Work Order.',
    'ditunda_sadar', ARRAY['Fungsi']::text[], 'Claude Code', 'selesai', NULL, 'perencanaan_awal', 'Kaskade otomatis production_disruptions ke seluruh WO terkait plant yang sama.', NULL,
    '2026-08-15'::date, '2026-08-15'::date, '2026-08-15'::date, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'PRD-04', 'Mulai/Selesai Batch + Jadwal Hari Ini', 'PRD', 'Produksi', 'Tombol "Mulai Batch"/"Selesaikan Batch" tersambung ke alur belajar standar otomatis (K8), plus halaman "Jadwal Hari Ini" khusus staf produksi per pabrik.', 'Tanpa ini, transisi status batch dan visibilitas jadwal harian staf produksi tidak ada.',
    'ditunda_sadar', ARRAY['Fungsi','Visual']::text[], 'Claude Code', 'selesai', '/production', 'perencanaan_awal', 'UI Mulai/Selesai Batch terhubung K8 auto-submit usulan standar, halaman Jadwal Hari Ini dengan isolasi per plant, deteksi kekurangan bahan berjenjang nyata.', NULL,
    '2026-08-19'::date, '2026-08-19'::date, '2026-08-19'::date, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'PRD-05', 'Pencatatan Yield/Susut Produksi', 'PRD', 'Produksi', 'Hasil produksi sungguhan (qty_input/qty_output) dicatat terpisah dari rencana, dari ujung ke ujung.', 'Tanpa ini, yield produksi tidak pernah dibandingkan dengan rencana — prinsip "yield itu variatif, jangan diasumsikan" tidak tertegakkan.',
    'ditunda_sadar', ARRAY['Fungsi','Data']::text[], 'Claude Code', 'selesai', '/production', 'perencanaan_awal', 'Pencatatan qty_input/uom_input terpisah dari planned_qty end-to-end.', NULL,
    '2026-08-15'::date, '2026-08-15'::date, '2026-08-15'::date, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'PRD-06', 'Standar Kru per Tahap (bukan per Lini)', 'PRD', 'Produksi', 'Standar kru saat ini basisnya per LINI (routing), belum per TAHAP produksi individual.', 'Kalau nanti ada data siapa-mengerjakan-tahap-mana, presisi biaya SDM standar bisa ditingkatkan.',
    'bisa_menunggu', ARRAY['Formula','Data']::text[], 'PPIC', 'ditunda_sadar', NULL, 'perencanaan_awal', 'routing_step_standard_crew.routing_step_id sudah nullable & siap diisi per tahap kalau datanya tersedia -- MENUNGGU data lapangan dari PPIC, bukan keterbatasan teknis.', 'Ditunda sadar: menunggu data nyata siapa mengerjakan tahap mana dari PPIC, bukan pekerjaan teknis yang tertunda.',
    '2026-08-20'::date, NULL, NULL, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'PRD-07', 'Yield per Tahap (bukan per Batch)', 'PRD', 'Produksi', 'Yield/susut hari ini dicatat per BATCH keseluruhan, belum per TAHAP produksi individual.', 'Tanpa detail per tahap, sulit tahu tahap mana yang paling banyak menyumbang susut.',
    'bisa_menunggu', ARRAY['Formula','Data']::text[], 'Claude Code', 'menunggu', NULL, 'perencanaan_awal', 'Perlu keputusan pemilik produk: apakah pencatatan yield per tahap benar-benar dibutuhkan sekarang, atau cukup per batch.', NULL,
    '2026-08-21'::date, NULL, NULL, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'PRD-08', 'Berat Isi Sachet (Kontrol Kualitas)', 'PRD', 'Produksi', 'Belum ada pencatatan berat isi aktual per sachet sebagai kontrol kualitas produksi bubuk.', 'Tanpa ini, variasi berat isi sachet tidak terpantau sistematis.',
    'bisa_menunggu', ARRAY['Data','Fungsi']::text[], 'Claude Code', 'menunggu', NULL, 'perencanaan_awal', 'Perlu spesifikasi pemilik produk: standar berat & toleransi yang dipakai QC lantai produksi.', NULL,
    '2026-08-21'::date, NULL, NULL, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'PRD-09', 'Produksi Premix Sebagai Tahap Tersendiri', 'PRD', 'Produksi', 'Produksi premix (bahan setengah jadi MLVT) belum punya alur pencatatan tersendiri yang eksplisit sebagai tahap produksi.', 'Tanpa ini, premix hanya tercatat sebagai baris BOM biasa, bukan tahap produksi yang bisa dipantau sendiri.',
    'bisa_menunggu', ARRAY['Fungsi']::text[], 'Claude Code', 'menunggu', NULL, 'perencanaan_awal', 'Perlu klarifikasi pemilik produk: apakah premix butuh Work Order terpisah, atau cukup sebagai WIP dalam BOM berjenjang yang sudah ada.', NULL,
    '2026-08-21'::date, NULL, NULL, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'PRD-10', 'Pemecahan 1 Work Order Jadi Banyak Batch', 'PRD', 'Produksi', 'Satu SO line bisa punya banyak Work Order, tapi pemecahan 1 Work Order jadi banyak batch (mis. per hari produksi) belum punya alur bantu eksplisit.', 'PPIC harus membuat tiap batch manual satu-satu walau berasal dari rencana yang sama.',
    'bisa_menunggu', ARRAY['Fungsi']::text[], 'Claude Code', 'menunggu', NULL, 'perencanaan_awal', 'Perlu spesifikasi pemilik produk: bagaimana pemecahan otomatis/semi-otomatis yang diinginkan (per hari? per kapasitas mesin?).', NULL,
    '2026-08-21'::date, NULL, NULL, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'PRD-11', 'Profil Produk (Ringkasan per Item)', 'PRD', 'Produksi', 'Belum ada halaman ringkasan "profil" 1 produk yang menggabungkan BOM, routing, standar, dan riwayat produksinya dalam satu tempat.', 'Untuk melihat gambaran lengkap 1 produk, pengguna harus membuka banyak layar terpisah.',
    'bisa_menunggu', ARRAY['Visual','Fungsi']::text[], 'Claude Code', 'menunggu', NULL, 'perencanaan_awal', 'Perlu keputusan pemilik produk: informasi apa saja yang wajib ada di ringkasan profil produk.', NULL,
    '2026-08-21'::date, NULL, NULL, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'KRM-01', 'Fondasi Tanda Tangan Digital', 'KRM', 'Pengiriman', 'Mekanisme tanda tangan digital yang bisa dipakai ulang untuk berbagai jenis dokumen (bukan cuma Surat Jalan).', 'Tanpa fondasi ini, tiap dokumen yang butuh tanda tangan harus membangun mekanismenya sendiri-sendiri.',
    'ditunda_sadar', ARRAY['Keamanan','Database']::text[], 'Claude Code', 'selesai', NULL, 'perencanaan_awal', 'Tabel document_signatures generik, dipakai pertama kali oleh Surat Jalan.', NULL,
    '2026-08-17'::date, '2026-08-17'::date, '2026-08-17'::date, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'KRM-02', 'Pengiriman Fisik: Traceability Lot Wajib & Mesin Status', 'KRM', 'Pengiriman', 'Setiap baris pengiriman wajib memilih lot (telusur wajib), status pengiriman ditegakkan lewat mesin status, stok berkurang saat status jadi "dikirim".', 'Tanpa ini, pengiriman bisa tercatat tanpa jejak lot yang jelas — melanggar wajib traceability BPOM/halal.',
    'ditunda_sadar', ARRAY['Database','Keamanan']::text[], 'Claude Code', 'selesai', '/shipments', 'perencanaan_awal', 'shipment_lines.lot_id wajib, enforce_shipment_line_qty_limit, pengurangan stok saat shipped.', NULL,
    '2026-08-17'::date, '2026-08-17'::date, '2026-08-17'::date, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'KRM-03', 'Layar Pengiriman: Buat/Kelola dengan Pilihan Lot FEFO', 'KRM', 'Pengiriman', 'Layar untuk membuat & mengelola pengiriman, dengan saran lot otomatis berbasis FEFO (First-Expired-First-Out).', 'Tanpa ini, staf gudang harus memilih lot manual tanpa bantuan urutan kadaluarsa.',
    'ditunda_sadar', ARRAY['Fungsi','Visual']::text[], 'Claude Code', 'selesai', '/shipments', 'perencanaan_awal', 'Halaman Shipments, fungsi suggest_fefo_lots(), transisi status.', NULL,
    '2026-08-17'::date, '2026-08-17'::date, '2026-08-17'::date, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'KRM-04', 'Foto Bukti Muat & Bukti Penerimaan Publik (POD)', 'KRM', 'Pengiriman', 'Staf gudang wajib upload foto bukti sebelum status jadi "dikirim"; pelanggan bisa konfirmasi barang diterima lewat halaman publik (scan QR, tanpa login).', 'Tanpa ini, tidak ada bukti fisik pengiriman & konfirmasi penerimaan dari sisi pelanggan.',
    'ditunda_sadar', ARRAY['Fungsi','Visual']::text[], 'Claude Code', 'selesai', NULL, 'perencanaan_awal', 'dispatch_photo_url wajib sebelum draft->shipped, halaman publik /pod/[token] dengan QR code di Surat Jalan.', NULL,
    '2026-08-17'::date, '2026-08-17'::date, '2026-08-17'::date, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'MRG-01', 'Margin v1 & Biaya SDM dari Data Nyata PT ITM', 'MRG', 'Margin & Biaya', 'Perhitungan margin pertama dari data produksi nyata PT ITM, plus pencatatan jam kerja SDM yang mendukung rotasi/pool staf (bukan 1 orang tetap 1 lini).', 'Tanpa ini, tidak ada dasar hitung margin dari data produksi sungguhan.',
    'ditunda_sadar', ARRAY['Formula','Data']::text[], 'Claude Code', 'selesai', NULL, 'pemilik_produk', 'Data produksi nyata PT ITM dimuat, Margin v1, labor log mendukung rotasi kru.', NULL,
    '2026-08-18'::date, '2026-08-18'::date, '2026-08-18'::date, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'MRG-02', 'Biaya SDM Standar dari Kru Nyata per Lini', 'MRG', 'Margin & Biaya', 'Biaya SDM standar per unit dihitung dari data kru nyata per lini produksi (jumlah orang, jenis upah), bukan angka tebakan.', 'Sebelumnya biaya SDM standar selalu kosong/tidak dihitung sama sekali.',
    'ditunda_sadar', ARRAY['Formula','Data']::text[], 'Claude Code', 'selesai', NULL, 'pemilik_produk', 'routing_step_standard_crew + computeStandardLaborCostPerUnit.ts, data kru nyata gummy & serbuk dari pemilik pabrik, koreksi setelah ditemukan formula lama menghitung ganda.', 'Riwayat penting: angka agregat ASLI di spesifikasi awal proyek terbukti salah (menghitung ganda), formula diganti total.',
    '2026-08-19'::date, '2026-08-19'::date, '2026-08-19'::date, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'MRG-03', 'Biaya Pemberi Kerja BPJS', 'MRG', 'Margin & Biaya', 'Biaya BPJS yang ditanggung perusahaan (bukan cuma gaji pokok) dimasukkan ke biaya SDM standar & aktual, dengan basis iuran yang bisa di-override.', 'Tanpa ini, biaya SDM standar meremehkan biaya sungguhan (gaji pokok saja, tanpa BPJS pemberi kerja).',
    'ditunda_sadar', ARRAY['Formula','Data']::text[], 'Claude Code', 'selesai', '/hr', 'pemilik_produk', 'Model biaya pemberi kerja BPJS, basis iuran per company_settings, 20 data payroll nyata + 10 PHL nyata lini serbuk.', 'Tarif BPJS TIDAK PERNAH ditebak sistem — kalau company_settings belum diisi, sistem menolak menghitung uplift (bukan menebak). Pola ini jadi acuan PMB-06.',
    '2026-08-19'::date, '2026-08-19'::date, '2026-08-19'::date, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'MRG-04', 'Periode Payroll & Formatter Rupiah Terpusat', 'MRG', 'Margin & Biaya', 'Laba Operasional dihitung mengikuti periode gajian perusahaan (26 s/d 25), dan format angka Rupiah diseragamkan di seluruh sistem.', 'Tanpa ini, laporan finansial tidak sinkron dengan periode gajian sungguhan perusahaan.',
    'ditunda_sadar', ARRAY['Formula','Visual']::text[], 'Claude Code', 'selesai', '/operating-profit', 'pemilik_produk', 'Periode payroll 26-25, formatter Rupiah terpusat, format angka konsisten (pemisah ribuan, maks 2 desimal) di seluruh UI.', NULL,
    '2026-08-19'::date, '2026-08-19'::date, '2026-08-20'::date, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'MRG-05', 'Margin Watch Lapis 1-2: Baseline & Pembongkaran Selisih', 'MRG', 'Margin & Biaya', 'Baseline margin rencana per baris SO (Lapis 1), dibandingkan dengan data aktual berjalan dan dipecah jadi 5 kategori selisih (Lapis 2): harga bahan, pemakaian bahan, reject, SDM aktual, lembur.', 'Tanpa ini, penyimpangan margin dari rencana tidak bisa dipantau/dipecah sumbernya secara sistematis.',
    'ditunda_sadar', ARRAY['Formula','Visual','Database']::text[], 'Claude Code', 'selesai', '/sales-orders', 'pemilik_produk', 'sales_order_line_margin_snapshots, computeStandardCostPerUnit.ts, 5 kategori selisih, gerbang kelengkapan (cost_data_complete), disempurnakan lewat Sesi 0C (pisah baca-tulis) dan Alur 1 (harga acuan vs HPP).', NULL,
    '2026-08-19'::date, '2026-08-19'::date, '2026-08-21'::date, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'MRG-06', 'Kelayakan Jadwal Sadar-Tahap & Kapasitas Multi-Unit', 'MRG', 'Margin & Biaya', 'Pemeriksaan kelayakan jadwal produksi sekarang sadar tahap (bahan tahap akhir cuma memblokir SELESAI, bukan MULAI), plus dukungan durasi berbasis laju & kapasitas multi-mesin per lini.', 'Sebelumnya kelayakan jadwal bisa keliru memblokir MULAI produksi hanya karena bahan tahap akhir belum tersedia.',
    'ditunda_sadar', ARRAY['Formula']::text[], 'Claude Code', 'selesai', '/ppic', 'pemilik_produk', 'Kelayakan jadwal sadar-tahap, durasi berbasis laju (mis. Filling Sachet 2 mesin), upah PHL sadar-shift, tanggal progres tahap + reject per tahap.', NULL,
    '2026-08-19'::date, '2026-08-19'::date, '2026-08-19'::date, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'KPI-01', 'Modul KPI: 5 KPI Awal + KPI Saya', 'KPI', 'KPI', '5 KPI pertama (Margin Kontribusi, Biaya/Unit, Laba Operasional, Yield, Nilai Persediaan) dalam bentuk kartu — nilai kini, target, benchmark, tren, dihitung otomatis. Ada juga "KPI Saya" khusus peran masing-masing.', 'Tanpa ini, tidak ada satu tempat ringkas untuk memantau kesehatan bisnis lewat angka kunci.',
    'ditunda_sadar', ARRAY['Fungsi','Formula','Visual']::text[], 'Claude Code', 'selesai', '/kpi', 'perencanaan_awal', 'kpi_registry/kpi_snapshots/kpi_actions/kpi_responsibilities, kartu 3-garis, panel bertab, halaman KPI Saya.', NULL,
    '2026-08-20'::date, '2026-08-20'::date, '2026-08-25'::date, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'KPI-02', 'KPI-2/3/4 (KPI Lanjutan)', 'KPI', 'KPI', 'KPI tambahan di luar 5 yang sudah ada (belum ditentukan cakupan persisnya).', 'Tanpa ini, pemantauan bisnis masih terbatas ke 5 KPI awal.',
    'bisa_menunggu', ARRAY['Formula','Visual']::text[], 'Claude Code', 'menunggu', NULL, 'perencanaan_awal', 'Perlu spesifikasi pemilik produk: KPI apa saja yang termasuk KPI-2/3/4, dan formula/target masing-masing.', NULL,
    '2026-08-25'::date, NULL, NULL, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'KMS-01', 'Modul Kamus: Antrean Penjelasan Data', 'KMS', 'Kamus', 'Tempat menjelaskan makna kolom/metrik data secara paralel — siapa saja bisa menjawab kapan saja, supaya tim baru tidak perlu bertanya berulang.', 'Tanpa ini, makna istilah teknis data hanya ada di kepala orang yang membangunnya.',
    'ditunda_sadar', ARRAY['Fungsi','Dokumentasi']::text[], 'Claude Code', 'selesai', '/kamus', 'perencanaan_awal', 'kamus_terms/kamus_term_history, generator backlog otomatis dari skema, alur jawab & konfirmasi.', NULL,
    '2026-08-19'::date, '2026-08-19'::date, '2026-08-19'::date, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'PRV-01', 'Fondasi Panel Asal-Usul (Provenance)', 'PRV', 'Panel Asal-Usul', 'Ikon info kecil di sebelah angka penting yang bisa diklik untuk melihat rumus & sumber datanya.', 'Tanpa ini, pengguna tidak tahu dari mana sebuah angka di layar berasal.',
    'ditunda_sadar', ARRAY['Visual','Dokumentasi']::text[], 'Claude Code', 'selesai', '/sales-orders', 'perencanaan_awal', 'Komponen ProvenanceInfoButton generik, dipasang pertama di beberapa titik.', NULL,
    '2026-08-19'::date, '2026-08-19'::date, '2026-08-19'::date, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'PRV-02', 'Perluasan Panel Asal-Usul ke +30 Titik', 'PRV', 'Panel Asal-Usul', 'Panel Asal-Usul diperluas ke +30 angka lebih banyak di 12 halaman (Margin Watch, Kelayakan Jadwal, biaya standar, Laba Operasional, dll).', 'Tanpa perluasan, mayoritas angka penting di sistem masih tidak punya penjelasan asal-usulnya.',
    'ditunda_sadar', ARRAY['Visual','Dokumentasi']::text[], 'Claude Code', 'selesai', NULL, 'pemilik_produk', 'Perluasan ke 20/20 titik + yield & biaya pemberi kerja, lalu +30 titik lagi di 12 halaman.', NULL,
    '2026-08-20'::date, '2026-08-20'::date, '2026-08-20'::date, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'DOC-01', 'Master Dokumen MD-1', 'DOC', 'Master Dokumen', 'Registry dokumen perusahaan (SOP, sertifikat, dll) dengan pratinjau langsung di browser dan 2 lapis akses (umum/departemen/terbatas).', 'Tanpa ini, dokumen perusahaan tidak punya tempat terpusat & terkontrol aksesnya.',
    'ditunda_sadar', ARRAY['Fungsi','Keamanan']::text[], 'Claude Code', 'selesai', '/documents', 'perencanaan_awal', 'documents/document_types/document_access_log/document_links, viewer inline PDF/gambar.', NULL,
    '2026-08-20'::date, '2026-08-20'::date, '2026-08-20'::date, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'DOC-02', 'Master Dokumen MD-2/3 (Lanjutan)', 'DOC', 'Master Dokumen', 'Kelanjutan Master Dokumen di luar MD-1 (cakupan belum ditentukan).', 'Tanpa ini, kebutuhan dokumen lanjutan (mis. reminder kedaluwarsa, alur approval dokumen) belum tertangani.',
    'bisa_menunggu', ARRAY['Fungsi']::text[], 'Claude Code', 'menunggu', NULL, 'perencanaan_awal', 'Perlu spesifikasi pemilik produk: cakupan persis MD-2/3.', NULL,
    '2026-08-20'::date, NULL, NULL, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'ABS-01', 'Absensi Geo-QR Gelombang 1', 'ABS', 'Absensi', 'Absensi karyawan lewat QR + validasi lokasi (geofence), tercatat sebagai ledger, dengan rekap otomatis. HANYA Gelombang 1.', 'Tanpa ini, absensi karyawan tidak tercatat sistematis dengan validasi lokasi.',
    'ditunda_sadar', ARRAY['Fungsi','Database']::text[], 'Claude Code', 'selesai', '/attendance', 'perencanaan_awal', 'Skema, geofence, ledger (attendance_events), rekap (employee_attendance).', NULL,
    '2026-08-19'::date, '2026-08-19'::date, '2026-08-19'::date, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'ABS-02', 'Absensi Gelombang 2-5', 'ABS', 'Absensi', 'Kelanjutan modul Absensi di luar Gelombang 1 (cakupan belum ditentukan per gelombang).', 'Tanpa ini, kebutuhan absensi lanjutan (mis. lembur, shift kompleks, cuti terintegrasi penuh) belum tertangani.',
    'bisa_menunggu', ARRAY['Fungsi']::text[], 'Claude Code', 'menunggu', NULL, 'perencanaan_awal', 'Perlu spesifikasi pemilik produk: cakupan persis tiap gelombang W2-W5.', NULL,
    '2026-08-19'::date, NULL, NULL, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'PMN-01', 'Process Mining (Fase 0.4)', 'PMN', 'Process Mining', 'Wawasan pola proses dari data produksi nyata (bukan simulasi) — jujur soal keterbatasan datanya.', 'Tanpa ini, pola/bottleneck proses produksi tidak terlihat otomatis.',
    'ditunda_sadar', ARRAY['Formula','Data']::text[], 'Claude Code', 'selesai', '/process-mining', 'perencanaan_awal', 'Insight dari data nyata, keterbatasan data didokumentasikan jujur (bukan menutupi kalau data belum cukup).', NULL,
    '2026-08-19'::date, '2026-08-19'::date, '2026-08-19'::date, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'AIR-01', 'Kesiapan AI Tenant (6 dari 7 Kemampuan)', 'AIR', 'Kesiapan AI', 'Gerbang kesiapan tiap kemampuan AI dihitung dari data nyata tenant (bukan asumsi) — 6 dari 7 kemampuan sudah bisa dinilai.', 'Tanpa ini, tidak ada cara objektif menilai apakah tenant sudah siap untuk fase AI berikutnya.',
    'ditunda_sadar', ARRAY['Formula','Data']::text[], 'Claude Code', 'selesai', '/ai-readiness', 'perencanaan_awal', 'ai_capabilities/ai_capability_requirements/ai_capability_status, gerbang per kemampuan, koreksi setelah tinjauan pemilik produk.', NULL,
    '2026-08-19'::date, '2026-08-19'::date, '2026-08-19'::date, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'AIR-02', 'Fase AI Selanjutnya (Setelah Kesiapan Tenant)', 'AIR', 'Kesiapan AI', 'Kelanjutan roadmap fase AI setelah gerbang kesiapan tenant terpenuhi (cakupan belum ditentukan).', 'Tanpa ini, roadmap AI berhenti di tahap "siap atau belum", belum melangkah ke kemampuan AI sungguhan.',
    'bisa_menunggu', ARRAY['Formula']::text[], 'Claude Code', 'menunggu', NULL, 'perencanaan_awal', 'Menunggu seluruh 7 kemampuan siap DAN keputusan pemilik produk soal fase AI konkret yang akan dibangun.', NULL,
    '2026-08-19'::date, NULL, NULL, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'AIP-01', 'Dashboard Proyek AI', 'AIP', 'Dashboard Proyek AI', 'Progres roadmap fitur AI dihitung dari data nyata (bukan kira-kira), plus daftar "bisa dikerjakan sekarang" — khusus pemilik produk & leadership.', 'Tanpa ini, progres roadmap AI tidak terlihat terukur.',
    'ditunda_sadar', ARRAY['Formula','Visual']::text[], 'Claude Code', 'selesai', '/ai-project', 'perencanaan_awal', 'ai_project_phases/tasks/checklist_items/progress_snapshots, dashboard progres dari data nyata.', NULL,
    '2026-08-19'::date, '2026-08-19'::date, '2026-08-19'::date, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'DPY-01', 'Bukti Skema Bisa Dibangun Ulang dari Migrasi', 'DPY', 'Deploy-ability', 'Membuktikan seluruh database bisa dibangun ulang dari nol hanya dari berkas migrasi (tanpa data tersembunyi di luar migrasi).', 'Tanpa bukti ini, tidak ada jaminan proyek bisa di-deploy ulang di lingkungan baru dengan aman.',
    'ditunda_sadar', ARRAY['Database','Keamanan']::text[], 'Claude Code', 'selesai', NULL, 'perencanaan_awal', 'Uji rebuild skema murni dari migrasi, dibuktikan berhasil.', NULL,
    '2026-08-16'::date, '2026-08-16'::date, '2026-08-16'::date, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'DPY-02', 'Staging Deployment', 'DPY', 'Deploy-ability', 'Aplikasi berhasil dijalankan di lingkungan staging (mendekati produksi).', 'Tanpa ini, tidak ada cara menguji aplikasi di luar lingkungan pengembangan lokal.',
    'ditunda_sadar', ARRAY['Integrasi']::text[], 'Claude Code', 'selesai', NULL, 'perencanaan_awal', 'Staging deployed dan diverifikasi sebagian besar; 1 bug signUp() ditemukan & ditandai.', NULL,
    '2026-08-17'::date, '2026-08-17'::date, '2026-08-17'::date, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'DPY-03', 'CI: Typecheck, Test Suite, Uji Rebuild Migrasi', 'DPY', 'Deploy-ability', 'Setiap perubahan kode otomatis diperiksa oleh GitHub Actions: pengecekan tipe, seluruh test, dan uji nyata rebuild database dari migrasi.', 'Tanpa CI, kesalahan baru bisa lolos tak terdeteksi sebelum sampai ke pengguna.',
    'ditunda_sadar', ARRAY['Integrasi','Keamanan']::text[], 'Claude Code', 'selesai', NULL, 'perencanaan_awal', 'GitHub Actions CI (tsc + vitest + pg_dump rebuild check), beberapa perbaikan flaky test (timeout, serialisasi eksekusi).', NULL,
    '2026-08-17'::date, '2026-08-17'::date, '2026-08-17'::date, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'SEC-01', 'Audit Keamanan: 12 Fungsi Kritis Terbuka ke Anon Key', 'SEC', 'Keamanan', 'Ditemukan & ditutup 12 fungsi database kritis yang ternyata bisa dipanggil langsung oleh siapa pun memakai kunci anonim, melewati seluruh pemeriksaan aplikasi.', 'Tanpa penutupan ini, siapa pun dengan kunci publik proyek bisa memanggil fungsi sensitif langsung, melewati semua pemeriksaan peran di kode aplikasi.',
    'ditunda_sadar', ARRAY['Keamanan','Database']::text[], 'Claude Code', 'selesai', NULL, 'temuan_claude', 'Audit menyeluruh fungsi database, revoke execute dari public/anon/authenticated, grant selektif ke service_role.', NULL,
    '2026-08-19'::date, '2026-08-19'::date, '2026-08-19'::date, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'SEC-02', 'Perbaikan Celah Eskalasi Hak Akses K8', 'SEC', 'Keamanan', 'Fungsi usulan standar produksi (K8) ternyata bisa dipanggil dengan kunci anonim untuk menaikkan hak akses.', 'Celah eskalasi hak akses nyata — pengguna tanpa hak bisa memanipulasi standar produksi.',
    'ditunda_sadar', ARRAY['Keamanan']::text[], 'Claude Code', 'selesai', NULL, 'temuan_claude', 'Perbaikan grant fungsi K8 standard-proposal.', NULL,
    '2026-08-19'::date, '2026-08-19'::date, '2026-08-19'::date, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'SEC-03', 'Sapu Ulang Revoke Seluruh Fungsi Sejak Audit Terakhir', 'SEC', 'Keamanan', 'Perbaikan surat jalan Alur 1 (memakai CREATE OR REPLACE FUNCTION) tidak sengaja menghapus kunci keamanan (revoke) pada 1 fungsi kritis — tertangkap pengawas otomatis sebelum sempat dilaporkan selesai. Ini kelas kerentanan yang sama dengan SEC-01 (44 dari 48 fungsi pernah ditemukan terbuka).', 'CREATE OR REPLACE FUNCTION di Postgres mereset izin eksekusi ke default (PUBLIC) kalau tidak diikuti revoke/grant eksplisit lagi — risiko ini bisa terulang di migrasi mana pun yang memakai pola yang sama.',
    'mendesak', ARRAY['Keamanan','Database']::text[], 'Claude Code', 'menunggu', NULL, 'temuan_claude', 'Sapu SELURUH migrasi sejak audit keamanan terakhir (19 Agu 2026), pastikan setiap CREATE OR REPLACE FUNCTION diikuti revoke dari public/anon/authenticated SEBELUM grant selektif. Dicatat H.2.', 'Aman dikerjakan paralel.',
    '2026-08-21'::date, NULL, NULL, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'MLV-01', 'Reset Total Studi Kasus Lama (Gummy Zala/Drinkme)', 'MLV', 'Studi Kasus MLVT', 'Target margin lama (GPM 35%) dicabut dan seluruh data studi kasus Gummy Zala/Drinkme direset total, menyiapkan penggantian dengan studi kasus MLVT.', 'Data lama tidak lagi relevan dan berpotensi membingungkan kalau dibiarkan bercampur dengan studi kasus baru.',
    'ditunda_sadar', ARRAY['Data']::text[], 'Claude Code', 'selesai', NULL, 'pemilik_produk', 'Reset total data studi kasus lama, uji ketahanan sistem dengan data kosong (tidak ditemukan bug).', NULL,
    '2026-08-20'::date, '2026-08-20'::date, '2026-08-20'::date, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'MLV-02', 'Konsolidasi Plant + Kerangka Studi Kasus MLVT', 'MLV', 'Studi Kasus MLVT', 'Jumlah pabrik dikonsolidasi dari 4 jadi 3 sesuai kondisi lapangan nyata, dan kerangka studi kasus MLVT ETAWAFIT dibangun (item, BOM, routing).', 'Tanpa konsolidasi, data pabrik tidak mencerminkan kondisi lapangan sungguhan.',
    'ditunda_sadar', ARRAY['Data','Fungsi']::text[], 'Claude Code', 'selesai', NULL, 'pemilik_produk', 'Konsolidasi production_plants 4->3, kerangka MLVT ETAWAFIT + dokumentasi formula.', NULL,
    '2026-08-20'::date, '2026-08-20'::date, '2026-08-20'::date, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'MLV-03', 'Koreksi Faktor Sachet Roll & Yield MLVT', 'MLV', 'Studi Kasus MLVT', 'Faktor konversi Sachet Roll dikoreksi ke presisi penuh (3.333), dan yield MLVT dikoreksi berdasarkan investigasi arkeologi data.', 'Angka yang tidak presisi/salah mengubah hasil perhitungan biaya & margin studi kasus MLVT.',
    'ditunda_sadar', ARRAY['Data','Formula']::text[], 'Claude Code', 'selesai', NULL, 'temuan_claude', 'uom_conversion_factor Sachet Roll = 3.333 presisi penuh, koreksi yield, laporan arkeologi lengkap ditulis.', NULL,
    '2026-08-21'::date, '2026-08-21'::date, '2026-08-21'::date, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'BSL-01', 'Sesi 0: Investigasi Integritas Data Baseline', 'BSL', 'Baseline Finansial', 'Investigasi mendalam menemukan kontaminasi data baseline finansial berasal dari QA manual sendiri (verifikasi manual sebelumnya), bukan dari test otomatis.', 'Tanpa investigasi ini, sumber kontaminasi data tidak akan pernah ditemukan — akan terus disangka bug sistem, padahal proses verifikasi sendiri yang jadi penyebabnya.',
    'ditunda_sadar', ARRAY['Data','Keamanan']::text[], 'Claude Code', 'selesai', NULL, 'temuan_claude', 'Investigasi Invarian 9, ditemukan baseline terkunci diam-diam saat verifikasi manual membuka panel Margin Watch/Kelayakan Jadwal.', 'Temuan ini melahirkan aturan keras "verifikasi manual HANYA di tenant uji" di CLAUDE.md.',
    '2026-08-21'::date, '2026-08-21'::date, '2026-08-21'::date, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'BSL-02', 'Sesi 0B: Konfirmasi "Tulis-Saat-Melihat" Sebagai Bug', 'BSL', 'Baseline Finansial', 'Dikonfirmasi bahwa perilaku "membuka panel = menulis baseline permanen" adalah DESAIN YANG SALAH, bukan bug tersembunyi — didokumentasikan eksplisit di UI.', 'Tombol yang terlihat "hanya melihat" (Cek Kelayakan/Margin Watch) ternyata menulis data permanen begitu diklik.',
    'ditunda_sadar', ARRAY['Keamanan','Fungsi']::text[], 'Claude Code', 'selesai', NULL, 'temuan_claude', 'Dikonfirmasi sebagai desain yang harus diperbaiki (bukan bug tersembunyi), didahului Sesi 0C untuk perbaikan sungguhan.', NULL,
    '2026-08-21'::date, '2026-08-21'::date, '2026-08-21'::date, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'BSL-03', 'Sesi 0C: Pisahkan Baca dari Mengunci Baseline + Gerbang Kelengkapan', 'BSL', 'Baseline Finansial', 'Membuka panel Margin Watch/Kelayakan Jadwal sekarang MURNI menghitung & menampilkan, tidak pernah menulis apa pun. Mengunci baseline jadi aksi terpisah, bergerbang: peran finansial, data lengkap, alasan wajib untuk kunci ulang.', 'Ini perbaikan langsung dari celah keamanan nyata (BSL-01/02) — role tanpa kewenangan finansial sebelumnya bisa mengunci baseline permanen hanya dengan "melihat".',
    'ditunda_sadar', ARRAY['Keamanan','Database','Fungsi']::text[], 'Claude Code', 'selesai', '/sales-orders', 'temuan_claude', 'archived_at/archived_reason/locked_by/relock_reason, unique index parsial, gerbang cost_data_complete, RLS insert/update baseline dibatasi peran finansial.', NULL,
    '2026-08-21'::date, '2026-08-21'::date, '2026-08-21'::date, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'AUD-01', 'Sesi 5: Penutupan 0C + Audit Lubang UI', 'AUD', 'Audit Kualitas', 'Menutup sisa pekerjaan Sesi 0C (pengawas KPI, gerbang kelayakan), plus audit menyeluruh 72 tabel utama mencari fitur yang bisa lihat/buat tapi tidak bisa ubah/keluar.', 'Tanpa audit ini, banyak celah UI (mis. tombol yang tidak tersambung logic) tidak akan pernah ketahuan sistematis.',
    'ditunda_sadar', ARRAY['Dokumentasi','Fungsi']::text[], 'Claude Code', 'selesai', NULL, 'temuan_claude', '12 lubang [P] ditemukan, docs/audit-lubang-ui.md ditulis pertama kali.', 'Metodologi audit ini KEMUDIAN ditemukan tidak lengkap sendiri — lihat AUD-03.',
    '2026-08-21'::date, '2026-08-21'::date, '2026-08-21'::date, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'AUD-02', 'Sesi 6: Bahasa UI — Hapus Bahasa Sistem dari Layar Pengguna', 'AUD', 'Audit Kualitas', 'Seluruh nama tabel/kolom/enum mentah yang tampil ke pengguna non-teknis dirapikan jadi Bahasa Indonesia lewat kamus istilah terpusat, plus pengawas otomatis yang menyapu kebocoran serupa di masa depan.', 'Sebelumnya pengguna non-teknis melihat istilah seperti "customer_purchase_order_lines.unit_price" langsung di layar — terasa seperti membaca kode, bukan aplikasi.',
    'ditunda_sadar', ARRAY['Teks/Bahasa','Fungsi']::text[], 'Claude Code', 'selesai', '/kamus', 'pemilik_produk', 'src/lib/glossary.ts, 33 titik Panel Asal-Usul + 35 titik lain dirapikan, pengawas kebocoran (tests/ui_raw_leak_watchdog.test.ts) dibuktikan bisa mendeteksi kebocoran sungguhan.', NULL,
    '2026-08-21'::date, '2026-08-21'::date, '2026-08-21'::date, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'AUD-03', 'Audit Ulang Metodologi + Uji "Sistem Bukan Hardcode"', 'AUD', 'Audit Kualitas', 'Ditemukan mekanisme KENAPA audit Sesi 5 melewatkan celah nyata (daftar tabel tidak disinkronkan ke skema sungguhan + langkah sintesis "baca-lalu-pilih" bukan sapuan mekanis) — diaudit ulang dari introspection database langsung. Juga dibuktikan langsung (bukan diasumsikan) bahwa angka di layar MLVT genuinely berasal dari database, bukan kode.', 'Tanpa investigasi mekanisme ini, cara audit yang sama berisiko melewatkan celah lain di masa depan dengan pola yang sama persis.',
    'ditunda_sadar', ARRAY['Dokumentasi','Data']::text[], 'Claude Code', 'selesai', NULL, 'temuan_claude', 'docs/audit-lubang-ui.md ditulis ulang lengkap (80 tabel), 5 angka MLVT dilacak sampai ke query persisnya, 1 angka diubah langsung di database dan dibuktikan berubah di layar.', NULL,
    '2026-08-21'::date, '2026-08-21'::date, '2026-08-21'::date, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'AUD-04', 'Kenapa Halaman Pelanggan Lolos Audit 2 Kali', 'AUD', 'Audit Kualitas', 'Halaman kelola Pelanggan ternyata tidak pernah ada sama sekali, dan ini lolos DUA KALI — dari audit Sesi 5 dan dari audit ulang Sesi 7 yang mengambil daftar langsung dari database.', 'Kalau metodenya tidak diperbaiki, celah serupa (fitur yang "terasa ada" tapi sebenarnya tidak) berisiko lolos lagi di audit berikutnya.',
    'mendesak', ARRAY['Dokumentasi','Data']::text[], 'Claude Code', 'menunggu', NULL, 'temuan_claude', 'Cari tahu MEKANISME kenapa 2 audit berbeda sama-sama tidak menandai "Pelanggan tanpa halaman" sebagai temuan — apakah karena dropdown yang berfungsi membuat auditor (manusia atau Claude) menganggap "sudah ada jalan masuk", padahal itu bukan halaman kelola. Perbaiki checklist audit supaya "ada dropdown" tidak lagi disamakan dengan "ada halaman kelola". Dicatat H.4.', NULL,
    '2026-08-21'::date, NULL, NULL, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'AUD-05', 'Lengkapi Rincian Test yang Belum Pernah Dilaporkan', 'AUD', 'Audit Kualitas', 'Beberapa laporan sesi menyebut angka pertambahan test (mis. "239->245 (+6)") tanpa menyebut nama file & apa yang diuji — pola ini berulang beberapa kali.', 'Tanpa rincian, pemilik produk tidak bisa memverifikasi sendiri apa sebenarnya yang sudah diuji.',
    'penting', ARRAY['Dokumentasi']::text[], 'Claude Code', 'menunggu', NULL, 'temuan_claude', 'Jadikan "sebutkan nama file test & apa yang diuji" sebagai BAGIAN KRITERIA SELESAI wajib di setiap laporan sesi berikutnya, bukan cuma angka penambahan. Dicatat H.5.', 'Aman dikerjakan paralel (murni kedisiplinan laporan, tidak menyentuh kode).',
    '2026-08-21'::date, NULL, NULL, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'AUD-06', 'Tata Letak Modal di Seluruh Layar', 'AUD', 'Audit Kualitas', 'Aturan tata letak modal (field lebar sendiri, field pendek dikelompokkan, tidak ada teks terpotong) baru diterapkan di modal Alur 1 (Supplier/Pelanggan) — modal-modal lama di layar lain (mis. Routing "Buat Routing baru") masih memakai tata letak lama yang memaksa banyak field berjejer 1 baris.', 'Layar lama masih berisiko punya teks contoh yang terpotong dan sulit dibaca, seperti keluhan awal pemilik produk soal modal Routing.',
    'penting', ARRAY['Visual']::text[], 'Claude Code', 'menunggu', '/routing', 'pemilik_produk', 'Sapu seluruh modal berisi form di aplikasi (inventaris dulu sebelum mengubah apa pun, per instruksi asli), terapkan aturan tata letak yang sudah ditetapkan di Alur 1 satu per satu.', 'Menunggu cetakan UX (bertag Visual) — bukan aman paralel.',
    '2026-08-21'::date, NULL, NULL, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'AUD-07', 'Jejak Tulis Tanpa Siapa/Kapan di 6 Kelompok Tabel', 'AUD', 'Audit Kualitas', 'Beberapa kelompok tabel penting (SDM/Payroll, eskalasi operasional, transaksi inti, transisi pengiriman, traceability produksi) menulis perubahan tanpa mencatat siapa/kapan melakukannya.', 'Kalau dibutuhkan audit "siapa yang mengubah data ini", sistem tidak bisa menjawab untuk 6 kelompok tabel ini.',
    'penting', ARRAY['Database','Keamanan']::text[], 'Claude Code', 'menunggu', NULL, 'temuan_claude', 'Tambahkan kolom created_by/updated_by/recorded_by ke tabel yang belum punya, isi otomatis dari sesi pengguna yang login. Ditemukan Sesi 5 (5.6).', 'Aman dikerjakan paralel.',
    '2026-08-21'::date, NULL, NULL, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'RDM-01', 'Rebrand R0-R5', 'RDM', 'Roadmap Jangka Panjang', 'Rencana penggantian merek/identitas produk dari tahap R0 sampai R5 (cakupan tiap tahap belum ditentukan).', 'Belum ada dampak ke sistem sampai spesifikasi tiap tahap ditentukan pemilik produk.',
    'bisa_menunggu', ARRAY['Visual','Dokumentasi']::text[], 'Pemilik Produk', 'menunggu', NULL, 'perencanaan_awal', 'Menunggu spesifikasi lengkap tiap tahap R0-R5 dari pemilik produk sebelum bisa dimulai.', NULL,
    '2026-08-21'::date, NULL, NULL, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'RDM-02', 'Routing Paralel', 'RDM', 'Roadmap Jangka Panjang', 'Kemampuan menjalankan beberapa tahap routing secara paralel (bukan cuma berurutan).', 'Tanpa ini, penjadwalan tahap yang sebenarnya bisa dikerjakan bersamaan tetap dihitung berurutan.',
    'bisa_menunggu', ARRAY['Formula','Fungsi']::text[], 'Claude Code', 'menunggu', NULL, 'perencanaan_awal', 'Perlu keputusan arsitektur besar (belum dibahas): bagaimana Gantt & kapasitas merepresentasikan tahap paralel.', NULL,
    '2026-08-21'::date, NULL, NULL, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'RDM-03', 'Configurator Produk', 'RDM', 'Roadmap Jangka Panjang', 'Kemampuan mengonfigurasi varian produk secara dinamis (belum ada spesifikasi).', 'Belum ada dampak ke sistem sampai kebutuhan konkretnya ditentukan.',
    'bisa_menunggu', ARRAY['Fungsi']::text[], 'Pemilik Produk', 'menunggu', NULL, 'perencanaan_awal', 'Menunggu spesifikasi kebutuhan bisnis dari pemilik produk.', NULL,
    '2026-08-21'::date, NULL, NULL, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'RDM-04', 'MPS (Master Production Schedule)', 'RDM', 'Roadmap Jangka Panjang', 'Perencanaan produksi jangka menengah lintas Sales Order (belum ada spesifikasi).', 'Belum ada dampak ke sistem sampai kebutuhan konkretnya ditentukan.',
    'bisa_menunggu', ARRAY['Formula','Fungsi']::text[], 'Pemilik Produk', 'menunggu', NULL, 'perencanaan_awal', 'Menunggu spesifikasi kebutuhan bisnis dari pemilik produk — kemungkinan besar bergantung pada Routing Paralel (RDM-02) selesai lebih dulu.', NULL,
    '2026-08-21'::date, NULL, NULL, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    created_at, started_at, completed_at, approved_at
  ) values (
    v_company_id, 'RDM-05', 'Maintenance (Perawatan Mesin)', 'RDM', 'Roadmap Jangka Panjang', 'Modul pencatatan perawatan/downtime terjadwal mesin produksi (belum ada spesifikasi).', 'Downtime mesin saat ini hanya tercatat sebagai gangguan produksi biasa, belum ada jadwal perawatan preventif.',
    'bisa_menunggu', ARRAY['Fungsi','Database']::text[], 'Pemilik Produk', 'menunggu', NULL, 'perencanaan_awal', 'Menunggu spesifikasi kebutuhan bisnis dari pemilik produk.', NULL,
    '2026-08-21'::date, NULL, NULL, NULL
  )
  on conflict (company_id, task_code) do nothing
  returning build_task_id into v_task_id;

end $$;