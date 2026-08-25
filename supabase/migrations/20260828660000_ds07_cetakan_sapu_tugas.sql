-- DS-07 ditutup, cetakan kanonik dicatat, dan sapuan Daftar Tugas (25 Agu 2026).

do $$
declare v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then return; end if;

  -- ===================== A. DS-07 DIPUTUSKAN JADI ATURAN =====================
  update build_tasks set status = 'selesai', completed_at = now(),
    notes = coalesce(notes || E'\n\n','') ||
      E'=== DIPUTUSKAN PEMILIK PRODUK 25 Agu 2026 — JADI ATURAN, BUKAN KASUS PER KASUS ===\n\n' ||
      E'DOMAIN PATTERN RESMI (format §42):\n' ||
      E'  "FABRIX memisahkan ukuran visual dari area sentuh. Visual mengikuti Carbon; area\n' ||
      E'   sentuh minimal 44px lewat lapisan tak terlihat.\n' ||
      E'   ALASAN: lantai produksi memakai tablet dan HP, sering bersarung tangan.\n' ||
      E'   Memperbesar visualnya menyimpang dari Carbon; memperbesar area sentuhnya tidak."\n\n' ||
      E'CARA PENERAPANNYA, dan kenapa BUKAN membesarkan tombolnya:\n' ||
      E'Membesarkan tombolnya sudah dicoba dan GAGAL DUA KALI, keduanya hanya ketahuan setelah\n' ||
      E'DIUKUR -- min-block-size membuat baris tabel membengkak 48 -> 61px; block-size 100%\n' ||
      E'membuat tombolnya menyusut jadi 31px.\n' ||
      E'Elemen semu yang diposisikan absolut TIDAK IKUT menentukan tinggi induknya sama sekali,\n' ||
      E'jadi ia menambah area tekan tanpa menyentuh tata letak.\n\n' ||
      E'BERLAKU DI SEMUA PERANGKAT. Sempat dipertimbangkan @media (pointer: coarse) supaya\n' ||
      E'hanya di layar sentuh; DITOLAK karena dua jalur perilaku untuk hal yang sama adalah\n' ||
      E'kelas cacat yang sudah dicatat berkali-kali, dan area sentuh lebih luas tidak merugikan\n' ||
      E'pemakai tetikus.\n\n' ||
      E'DUA PENGECUALIAN LAMA DICABUT dan disatukan ke aturan ini:\n' ||
      E'  kotak centang halaman POD (37 -> 44px)\n' ||
      E'  tombol buka-detail Master Item (32 -> 44px)\n' ||
      E'Keduanya kini KASUS KHUSUS dari satu aturan, bukan pengecualian sendiri-sendiri.\n\n' ||
      E'Aturannya hidup di src/styles/carbon.scss, satu tempat, berlaku seluruh layar.'
  where task_code = 'DS-07';

  -- ===================== B. CETAKAN KANONIK =====================
  if not exists (select 1 from build_tasks where task_code = 'DS-08') then
    insert into build_tasks (company_id, task_code, name, module_code, module_name, description,
      effect_description, urgency, status, origin, pic, detail_pekerjaan, notes)
    values (v_company_id, 'DS-08',
      'Cetakan Halaman Data — Pola Tertulis dari Master Item',
      'DS', 'Design System',
      'Master Item dinyatakan sesuai Carbon oleh pemilik produk dan jadi cetakan seluruh halaman bertabel.',
      'Menentukan bentuk 12 halaman data berikutnya tanpa memutuskan ulang tiap kali.',
      'penting', 'selesai', 'pemilik_produk', 'Claude Code',
      E'Ditulis di docs/governance/cetakan-halaman-data.md.',
      E'KENAPA DITULIS, bukan cukup menunjuk contohnya: contoh berubah. Begitu Items dimodifikasi\n' ||
      E'untuk alasan yang khusus buat Items, cetakannya ikut bergeser tanpa ada yang\n' ||
      E'memutuskannya. Pola tertulis bisa DIBANDINGKAN; contoh yang hidup hanya bisa ditiru.\n\n' ||
      E'MEMUAT: satu judul (judul bawaan DataTable dicabut) · keterangan menyebut jumlah DAN\n' ||
      E'hasil saringan · breadcrumb Dashboard/Workspace/Halaman dengan workspace TIDAK bergaya\n' ||
      E'tautan · toolbar (pencarian melipat tanpa persistent, saringan seketika, tombol utama\n' ||
      E'berikon) · baris 48px & tombol 44px · kartu bertumpuk di bawah 768px · EMPAT keadaan\n' ||
      E'yang dibedakan (memuat / belum ada data / kosong karena saringan / galat) · nol px dan\n' ||
      E'nol warna langsung.\n\n' ||
      E'DUA DEVIASI SADAR dicatat supaya tidak "diperbaiki": breadcrumb pada hierarki dua\n' ||
      E'tingkat, dan tabel jadi kartu di layar sempit.\n\n' ||
      E'CACAT CARBON dicatat dan diperbaiki GLOBAL: gaya tautan menempel ke setiap butir\n' ||
      E'breadcrumb termasuk yang tanpa alamat.');
  end if;

  -- ===================== F.1 SAPUAN STATUS =====================
  -- DS-01: fondasi Carbon SUDAH terpasang dan sudah melahirkan DS-02/04/05.
  update build_tasks set status = 'selesai', completed_at = now(),
    notes = coalesce(notes || E'\n\n','') ||
      E'=== STATUS DIPERBAIKI 25 Agu 2026 (sapuan F.1) ===\n' ||
      E'Ditemukan masih berstatus "menunggu" padahal fondasinya SUDAH terpasang dan sudah\n' ||
      E'melahirkan pekerjaan turunannya: DS-02 (layar publik, disetujui), DS-04 (UI Shell),\n' ||
      E'DS-05 (Master Item), DS-07 (aturan area sentuh), DS-08 (cetakan tertulis).\n' ||
      E'Diperiksa: tema dipancarkan lewat theme.theme(themes.$g10) di src/styles/carbon.scss.\n' ||
      E'Ini kejadian KETIGA "task selesai tapi statusnya tertinggal" setelah MST-16 dan MST-17.'
  where task_code = 'DS-01' and status <> 'selesai';

  -- MST-18: shelf life angka+satuan TERBANGUN, tinggal diperiksa pemilik produk.
  update build_tasks set status = 'menunggu_persetujuan',
    approval_location = 'Items -> Detail sebuah item -> Ubah. Lihat field "Shelf life".',
    approval_review_steps = E'1. Isi angkanya, lalu pilih satuannya (hari/minggu/bulan/tahun).\n' ||
      E'2. Perhatikan keterangan di bawah field: ia menyebutkan hasilnya "Tersimpan sebagai N hari".\n' ||
      E'3. Simpan, lalu buka Detail item itu: "Shelf life" tampil dalam satuan yang mudah dibaca.',
    approval_example_case = 'Isi 1 dan pilih "Tahun" -> keterangannya berbunyi "Tersimpan sebagai 365 hari".',
    approval_if_approved = 'MST-18 ditutup.',
    approval_if_rejected = 'Sebutkan satuan mana yang kurang atau keliru.',
    notes = coalesce(notes || E'\n\n','') ||
      E'=== SAPUAN F.1, 25 Agu 2026: SUDAH TERBANGUN, statusnya yang tertinggal ===\n' ||
      E'Diperiksa dari kode: src/features/mrp/shelfLife.ts ada, dan dipakai 5 kali di halaman\n' ||
      E'Master Item (isian angka + satuan, konversi ke hari, penampilan kembali).\n' ||
      E'Yang disimpan tetap jumlah HARI di shelf_life_days, supaya FEFO tidak kehilangan\n' ||
      E'dasarnya -- itu memang rancangannya.'
  where task_code = 'MST-18' and status = 'menunggu';

  -- MST-19: min stock persen + pemicu low_stock TERBANGUN.
  update build_tasks set status = 'menunggu_persetujuan',
    approval_location = 'Items -> Ubah item -> field "Stok minimum (persen)". Lalu Warehouse untuk peringatannya.',
    approval_review_steps = E'1. Isi "Stok minimum (persen)" pada sebuah bahan, mis. 10.\n' ||
      E'2. Perhatikan field "Stok minimum (angka mutlak)" di bawahnya: ia menampilkan peringatan\n' ||
      E'   bahwa nilainya DIABAIKAN selama kolom persen terisi.\n' ||
      E'3. Buka Detail item: ambangnya tampil sebagai "N% dari total yang pernah masuk".',
    approval_example_case = 'Isi 10 persen pada sebuah bahan, lalu lihat Detail-nya.',
    approval_if_approved = 'MST-19 ditutup.',
    approval_if_rejected = 'Sebutkan bagian mana yang keliru.',
    notes = coalesce(notes || E'\n\n','') ||
      E'=== SAPUAN F.1, 25 Agu 2026: SUDAH TERBANGUN ===\n' ||
      E'Diperiksa dari kode: src/features/mrp/stockThreshold.ts (ambang efektif, persen MENANG\n' ||
      E'bila terisi), itemValidation.ts (validasi min_stock_percent), dan\n' ||
      E'refreshLowStockAlerts.ts yang benar-benar menulis alert_type = low_stock.\n' ||
      E'Endpointnya ada: POST /api/stock-alerts/refresh. Test penjaganya ada:\n' ||
      E'tests/stock_threshold_percent.test.ts.\n\n' ||
      E'BATAS YANG JUJUR: pemicunya ada dan bisa dipanggil, TAPI belum ada penjadwal yang\n' ||
      E'memanggilnya berkala. Jadi peringatan low_stock baru muncul bila endpoint itu dipanggil.\n' ||
      E'Ini kelas yang SAMA dengan pelajaran KPI 25 Agu 2026: data berkala wajib punya pemicu\n' ||
      E'berkala. Dicatat sebagai GDG-09.'
  where task_code = 'MST-19' and status = 'menunggu';

  if not exists (select 1 from build_tasks where task_code = 'GDG-09') then
    insert into build_tasks (company_id, task_code, name, module_code, module_name, description,
      effect_description, urgency, status, origin, pic, detail_pekerjaan, notes)
    values (v_company_id, 'GDG-09',
      'Peringatan Stok Menipis Tidak Punya Pemicu Berkala',
      'GDG', 'Gudang & Persediaan',
      'refreshLowStockAlerts ada dan bekerja, tapi hanya berjalan bila endpoint-nya dipanggil. Tidak ada penjadwal.',
      'Peringatan stok menipis yang tidak pernah dihitung ulang sama saja dengan tidak ada peringatan.',
      'penting', 'menunggu', 'temuan_claude', 'Claude Code',
      E'Pilihan yang perlu diputuskan pemilik produk: penjadwal (Vercel Cron), atau dihitung\n' ||
      E'saat halaman Gudang dibuka -- TAPI yang kedua melanggar aturan "membuka halaman tidak\n' ||
      E'boleh menulis", jadi bila dipilih ia harus berupa tombol yang ditekan sadar.',
      E'Ditemukan 25 Agu 2026 lewat sapuan Daftar Tugas. Kelas yang SAMA dengan pelajaran KPI\n' ||
      E'hari yang sama: data berkala wajib punya pemicu berkala. Bedanya, di sini akibatnya\n' ||
      E'bukan angka yang berbohong melainkan PERINGATAN YANG TIDAK PERNAH DATANG.');
  end if;
end $$;
