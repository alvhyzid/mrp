-- Keputusan pemilik produk yang masuk 25 Agu 2026 (blok B..I).

do $$
declare v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then return; end if;

  -- ===== F.1 — DS-04 & DS-05 DITERIMA =====
  update build_tasks set status='selesai', completed_at=now(),
    notes = coalesce(notes||E'\n\n','') ||
      E'=== DITERIMA PEMILIK PRODUK 25 Agu 2026 ===\n' ||
      E'Cetakan Items boleh diterapkan ke SELURUH halaman.'
  where task_code in ('DS-04','DS-05') and status <> 'selesai';

  -- ===== F.4 — RBD-03 ditutup dengan alasan =====
  update build_tasks set status='dibatalkan', urgency='tidak_mendesak', completed_at=now(),
    notes = coalesce(notes||E'\n\n','') ||
      E'=== DITUTUP 25 Agu 2026 — KEPUTUSAN PEMILIK PRODUK ===\n' ||
      E'GitHub TETAP di akun pribadi.\n\n' ||
      E'Ditutup, bukan dibiarkan menggantung sebagai SUPER URGENT yang sengaja tidak\n' ||
      E'dikerjakan. Task mendesak yang sengaja diabaikan merusak arti penandaan mendesak itu\n' ||
      E'sendiri: begitu satu boleh diabaikan, sisanya ikut kehilangan bobot.\n\n' ||
      E'PEMICU DITINJAU ULANG: saat pemakaian melewati batas akun pribadi, atau saat GitHub\n' ||
      E'sendiri menyarankan naik ke Team.'
  where task_code = 'RBD-03' and status <> 'selesai';

  -- ===== H — GDG-09 keputusan penjadwal =====
  update build_tasks set
    notes = coalesce(notes||E'\n\n','') ||
      E'=== KEPUTUSAN PEMILIK PRODUK 25 Agu 2026: PENJADWAL, BUKAN TOMBOL ===\n' ||
      E'"Peringatan stok yang harus ditekan orang untuk muncul bukan peringatan."\n\n' ||
      E'MENUMPANG JADWAL AUD-13 bila memungkinkan -- jangan bangun penjadwal ketiga.\n\n' ||
      E'PENILAIAN YANG DICATAT, karena membedakannya dari pelajaran KPI:\n' ||
      E'  KPI menghasilkan ANGKA YANG BERBOHONG; ini menghasilkan PERINGATAN YANG TIDAK\n' ||
      E'  PERNAH DATANG. Peringatan yang tidak datang TIDAK MENINGGALKAN JEJAK -- tidak ada\n' ||
      E'  yang menyadarinya sampai bahan benar-benar habis.\n' ||
      E'  Angka yang salah setidaknya terlihat; peringatan yang absen tidak terlihat sama\n' ||
      E'  sekali. Itu sebabnya tombol tidak cukup di sini.'
  where task_code = 'GDG-09';

  -- ===== I.1 — KPI-05 ditutup =====
  update build_tasks set status='selesai', completed_at=now(),
    notes = coalesce(notes||E'\n\n','') ||
      E'=== KEPUTUSAN PEMILIK PRODUK 25 Agu 2026: DIHAPUS ===\n' ||
      E'"Mereka lahir dari kunjungan halaman, jadi tidak berarti apa-apa sebagai tren.\n' ||
      E' Menyimpan data yang artinya salah lebih buruk daripada tidak punya data."\n\n' ||
      E'DIKERJAKAN: 3 baris dihapus. Diperiksa sebelum: 3 baris, seluruhnya lahir dalam\n' ||
      E'rentang empat detik pada 24 Agu 2026 pukul 17:40. Sesudah: 0 baris.\n' ||
      E'Riwayat KPI sekarang dimulai bersih, seluruhnya dari perekaman yang DISENGAJA.'
  where task_code = 'KPI-05';

  -- ===== E — MST-20 DITUNDA SADAR =====
  update build_tasks set status='ditunda_sadar',
    ditunda_pemicu='Saat modul perencanaan produksi dikerjakan.',
    notes = coalesce(notes||E'\n\n','') ||
      E'=== DITUNDA SADAR 25 Agu 2026 — ALASAN PEMILIK PRODUK ===\n' ||
      E'"Biaya standar kemungkinan besar bukan sifat bahan melainkan ASUMSI BIAYA YANG\n' ||
      E' BERLAKU UNTUK SUATU PERIODE -- lahir dari keputusan ''untuk kuartal ini kita\n' ||
      E' menghitung dengan harga-harga ini'', lalu dibekukan.\n' ||
      E' Bila benar, tempatnya di modul perencanaan, bukan di master item.\n' ||
      E' Memutuskan bentuknya sebelum modul perencanaannya ada berarti menebak."\n\n' ||
      E'PEMICU DIBUKA: saat modul perencanaan produksi dikerjakan.\n\n' ||
      E'=== YANG TETAP BERLAKU SEKARANG, JANGAN IKUT DITUNDA ===\n' ||
      E'a. Isian biaya standar TIDAK muncul di form pembuatan item yang diisi gudang.\n' ||
      E'b. Prinsip tercatat: "perubahan harga urusan purchasing; efek ke finansial urusan\n' ||
      E'   finance."\n' ||
      E'c. Rantai harga empat lapis TETAP dijelaskan di layar dan di Kamus:\n' ||
      E'   patokan -> acuan supplier -> harga PO -> biaya lot.\n' ||
      E'   Kebingungan lahir karena tidak ada yang menjelaskan URUTANNYA, dan itu bisa\n' ||
      E'   diselesaikan TANPA memutuskan bentuk biaya standar.\n\n' ||
      E'=== TIGA PERTANYAAN YANG BELUM TERJAWAB — ARKEOLOGINYA BELUM DIKERJAKAN ===\n' ||
      E'Dicatat supaya tidak diulang dari nol saat pemicunya terpenuhi:\n' ||
      E'  1. Apakah standard_cost DIBEKUKAN saat baseline dikunci, atau selalu dibaca\n' ||
      E'     terkini? Ini yang menentukan apakah ia asumsi periode atau sekadar harga.\n' ||
      E'  2. Bisakah angkanya DITURUNKAN dari harga acuan supplier, sehingga tidak perlu\n' ||
      E'     diketik sama sekali?\n' ||
      E'  3. Siapa memutuskan KAPAN patokan diperbarui, bila (2) ternyata bisa?\n' ||
      E'JANGAN dianggap sudah diperiksa. Ketiganya masih terbuka.\n\n' ||
      E'Pertanyaan ke Finance soal hak ubah biaya standar IKUT DITUNDA.'
  where task_code = 'MST-20';

  -- ===== D — MST-21 BERUBAH SEPENUHNYA =====
  update build_tasks set
    name='Reorder Point & Qty: Pindah Kepemilikan ke Purchasing, Peringatan dari Kebutuhan Produksi',
    urgency='penting', status='menunggu',
    notes = coalesce(notes||E'\n\n','') ||
      E'=== ARAHNYA BERUBAH SEPENUHNYA — KEPUTUSAN PEMILIK PRODUK 25 Agu 2026 ===\n' ||
      E'BUKAN LAGI "dipakai atau disembunyikan". Keputusannya:\n' ||
      E'  a. Reorder Point dan Reorder Qty MILIK PURCHASING. Merekalah yang menentukan.\n' ||
      E'  b. Peringatan reorder berisi informasi BERDASARKAN KEBUTUHAN PRODUKSI, bukan\n' ||
      E'     sekadar angka yang diisi seseorang.\n' ||
      E'  c. Pengguna selain purchasing TIDAK mengisi angkanya.\n\n' ||
      E'=== KONSEKUENSINYA, DISODORKAN SEBELUM DIBANGUN ===\n' ||
      E'Ini BUKAN menyembunyikan field. Ini MEMINDAHKAN KEPEMILIKAN dan MENGUBAH ARTI\n' ||
      E'peringatannya -- dua perubahan yang jauh lebih dalam daripada menyembunyikan.\n\n' ||
      E'HASIL ARKEOLOGI (diperiksa 25 Agu 2026, bukan dikira):\n' ||
      E'  reorder_point HANYA DITERUSKAN ke tampilan oleh listStockSummary dan listItems.\n' ||
      E'  NOL perhitungan memakainya. Tidak ada satu pun peringatan yang lahir darinya.\n' ||
      E'  Jadi angka yang diketik itu hari ini TIDAK MELAKUKAN APA-APA.\n\n' ||
      E'PENILAIAN ATAS PERTANYAAN D.2c ("masih perlukah angka yang diketik manusia?"):\n' ||
      E'  Kemungkinan besar TIDAK, dan itu MENYEDERHANAKAN. Bila peringatannya dihitung dari\n' ||
      E'  kebutuhan produksi -- yang mekanismenya SUDAH ADA di getPlanningFeasibility dan\n' ||
      E'  kesiapan bahan Work Order -- maka ambang yang diketik tangan hanya menambah satu\n' ||
      E'  angka yang harus dijaga tetap benar oleh manusia, untuk hasil yang sudah bisa\n' ||
      E'  dihitung sendiri.\n' ||
      E'  YANG MASIH MUNGKIN DIBUTUHKAN purchasing: Reorder QTY (berapa banyak sekali pesan),\n' ||
      E'  karena itu keputusan komersial -- ukuran kemasan supplier, diskon jumlah, ongkos\n' ||
      E'  kirim -- yang TIDAK bisa diturunkan dari kebutuhan produksi.\n' ||
      E'  Jadi usulannya: Reorder POINT dihapus, Reorder QTY dipertahankan dan pindah ke\n' ||
      E'  layar purchasing. MENUNGGU KEPUTUSAN.\n\n' ||
      E'=== D.3 — KAITAN DENGAN MST-19, WAJIB DIJAGA ===\n' ||
      E'Keduanya soal KAPAN BAHAN PERLU DIPESAN LAGI, dari dua arah berbeda:\n' ||
      E'  MST-19 dari SISA STOK (persen dari yang pernah masuk)\n' ||
      E'  MST-21 dari KEBUTUHAN PRODUKSI (apa yang akan dipakai)\n' ||
      E'Bila keduanya menghasilkan peringatan sendiri-sendiri, satu bahan bisa memunculkan\n' ||
      E'DUA peringatan yang mengatakan hal berbeda untuk hal yang sama -- dan orang akan\n' ||
      E'berhenti mempercayai keduanya.\n' ||
      E'HARUS diputuskan saat membangun: satu peringatan dengan dua sebab yang disebutkan, atau\n' ||
      E'dua peringatan yang jelas berbeda pertanyaannya.'
  where task_code = 'MST-21';

  -- ===== B — MST-18 bentuknya perlu diperiksa ulang =====
  update build_tasks set status='menunggu',
    notes = coalesce(notes||E'\n\n','') ||
      E'=== KOREKSI PEMILIK PRODUK 25 Agu 2026: BENTUKNYA BELUM SESUAI ===\n' ||
      E'Yang dimaksud: kolom ANGKA di sebelah DROPDOWN satuan (hari/minggu/bulan/tahun).\n' ||
      E'Ketik "6", pilih "bulan", tersimpan 180 hari. Dan hasil konversinya DITAMPILKAN\n' ||
      E'sebagai "6 bulan (180 hari)".\n\n' ||
      E'CATATAN: bentuk itu sebenarnya SUDAH ADA di Master Item -- kolom angka + dropdown\n' ||
      E'satuan berdampingan, dengan keterangan "Tersimpan sebagai N hari".\n' ||
      E'Bahwa pemilik produk tidak mengenalinya adalah TEMUAN TERSENDIRI tentang\n' ||
      E'KETERLIHATANNYA, bukan tentang ada-tidaknya. Kemungkinan sebabnya: keduanya jatuh di\n' ||
      E'kolom terpisah pada kisi form, sehingga tidak terbaca sebagai SATU isian berpasangan.\n' ||
      E'Yang perlu diperbaiki: menyatukan keduanya secara visual, dan mengubah keterangannya\n' ||
      E'jadi "6 bulan (180 hari)" seperti diminta.'
  where task_code = 'MST-18';

  -- ===== C — MST-19: isian persen =====
  update build_tasks set status='menunggu',
    notes = coalesce(notes||E'\n\n','') ||
      E'=== KOREKSI PEMILIK PRODUK 25 Agu 2026 + JAWABAN ATAS C.3 ===\n' ||
      E'ISIANNYA SUDAH ADA. Letaknya: Items -> Detail item -> Ubah -> field "Stok minimum\n' ||
      E'(persen)". Ia menerima angka 0-100 dan menang atas kolom angka mutlak di bawahnya.\n' ||
      E'Bahwa pemilik produk belum menemukannya adalah TEMUAN TENTANG KETERLIHATAN, dan itu\n' ||
      E'sendiri layak diperbaiki -- field yang ada tapi tidak ditemukan sama saja dengan\n' ||
      E'field yang tidak ada.\n\n' ||
      E'=== C.2 — PER ITEM ATAU PER PERUSAHAAN? DISODORKAN, TIDAK DIPUTUSKAN ===\n' ||
      E'KEADAAN SEKARANG: PER ITEM saja. Tidak ada nilai bawaan per perusahaan.\n\n' ||
      E'USULAN ARSITEK (didukung temuan): satu nilai bawaan per perusahaan di Setelan\n' ||
      E'Perhitungan, bisa DITIMPA per item untuk bahan yang perlu perlakuan khusus.\n' ||
      E'ALASAN YANG MENDUKUNGNYA: mengisi persen untuk ratusan item satu per satu tidak akan\n' ||
      E'dikerjakan siapa pun. Dan itu bukan dugaan -- keadaan hari ini membuktikannya:\n' ||
      E'fieldnya sudah ada sejak lama, dan pemilik produk sendiri belum pernah memakainya.\n\n' ||
      E'KONSEKUENSI YANG PERLU DIKETAHUI SEBELUM MEMUTUSKAN: menambah setelan ke-18 di\n' ||
      E'Setelan Perhitungan berarti satu angka lagi yang menentukan arti peringatan, dan ia\n' ||
      E'wajib punya tanggal berlaku seperti 17 setelan lainnya -- ambang yang berubah\n' ||
      E'diam-diam membuat peringatan lama tidak bisa dijelaskan lagi.'
  where task_code = 'MST-19';

  -- ===== G — ganti email + SEC-15 =====
  if not exists (select 1 from build_tasks where task_code = 'SEC-16') then
    insert into build_tasks (company_id, task_code, name, module_code, module_name, description,
      effect_description, urgency, status, origin, pic, detail_pekerjaan, notes)
    values (v_company_id, 'SEC-16',
      'Ganti Alamat Email Pengguna dengan Verifikasi Kode',
      'SEC', 'Keamanan & Akses',
      'Pengguna mengubah alamat email -> kode dikirim ke alamat BARU -> kode dimasukkan -> tersimpan terverifikasi.',
      'Tanpa ini, alamat email tidak bisa diperbaiki sama sekali — dan alamat yang salah ketik mengunci pemulihan kata sandi.',
      'penting', 'menunggu', 'pemilik_produk', 'Claude Code',
      E'ALAMAT LAMA TETAP BERLAKU sampai yang baru terverifikasi. Jangan mengganti sebelum\n' ||
      E'terbukti, atau pengguna bisa terkunci dengan alamat yang salah ketik.\n' ||
      E'Supabase punya mailer_secure_email_change_enabled = true, artinya ia sudah meminta\n' ||
      E'konfirmasi dari KEDUA alamat -- periksa apakah itu sudah cukup sebelum membangun alur\n' ||
      E'kode sendiri.',
      E'=== ARKEOLOGI 25 Agu 2026 (G.1) ===\n' ||
      E'BELUM ADA sama sekali. Field email di halaman Profil berstatus `disabled` -- ia hanya\n' ||
      E'ditampilkan, tidak bisa diubah.\n\n' ||
      E'=== G.4 — PENGHENTI, DIPERIKSA DAN SEBAGIAN TERJAWAB ===\n' ||
      E'PERTANYAAN: yang ditolak DOMAINNYA, atau pengirimannya secara keseluruhan?\n' ||
      E'DIUJI (tanpa mengirim apa pun ke orang sungguhan):\n' ||
      E'  Membuat akun dengan @debug.mrp, @example.com, @gmail.com, @fabrix.co.id\n' ||
      E'  -> KEEMPATNYA DITERIMA. Jadi PEMBUATAN AKUN tidak menolak domain apa pun.\n' ||
      E'  Mengirim tautan pemulihan ke company.a@debug.mrp\n' ||
      E'  -> GAGAL: "Email address is invalid" (email_address_invalid).\n' ||
      E'KESIMPULAN: yang menolak adalah PENGIRIMAN, dan yang ditolak DOMAINNYA -- @debug.mrp\n' ||
      E'tidak bisa menerima email, jadi layanan surelnya menolaknya.\n\n' ||
      E'YANG BELUM TERBUKTI, dan ini penting: bahwa pengiriman ke alamat SUNGGUHAN berhasil.\n' ||
      E'Membuktikannya menuntut alamat email nyata milik pemilik produk, dan Claude Code\n' ||
      E'TIDAK memakainya tanpa diminta.\n\n' ||
      E'KEADAAN SURELNYA (dibaca dari konfigurasi project):\n' ||
      E'  SMTP kustom: TIDAK ADA -> memakai layanan email bawaan Supabase, yang berbatas\n' ||
      E'  kecepatan ketat dan memang ditujukan untuk pengembangan.\n' ||
      E'  site_url: http://localhost:3000  |  uri_allow_list: KOSONG\n' ||
      E'  -> tautan di email apa pun akan menunjuk ke localhost. Ini SEC-15, dan ia harus\n' ||
      E'     diperbaiki SEBELUM alur ganti email berguna: kode boleh sampai, tapi tautan\n' ||
      E'     verifikasinya menunjuk ke komputer penerima sendiri.');
  end if;

  update build_tasks set
    notes = coalesce(notes||E'\n\n','') ||
      E'=== DIPERIKSA 25 Agu 2026, dikaitkan ke SEC-16 ===\n' ||
      E'Dibaca dari konfigurasi project, bukan dikira:\n' ||
      E'  site_url        = http://localhost:3000\n' ||
      E'  uri_allow_list  = (kosong)\n' ||
      E'Artinya tautan di email pemulihan kata sandi menunjuk ke localhost -- ke komputer\n' ||
      E'PENERIMA, bukan ke situs. Bagi siapa pun selain orang yang sedang menjalankan server\n' ||
      E'di komputernya sendiri, tautan itu tidak membuka apa pun.\n' ||
      E'HARUS diperbaiki sebelum SEC-16 (ganti email) berguna.'
  where task_code = 'SEC-15';

  update build_tasks set status='selesai', completed_at=now(),
    notes = coalesce(notes||E'\n\n','') ||
      E'=== DIKERJAKAN 25 Agu 2026 bersama kebijakan kata sandi (F.3) ===\n' ||
      E'password_hibp_enabled: false -> TRUE. Diverifikasi dengan membaca ulang konfigurasi.'
  where task_code = 'SEC-08' and status <> 'selesai';

  update build_tasks set status='selesai', completed_at=now(),
    notes = coalesce(notes||E'\n\n','') ||
      E'=== DIPUTUSKAN & DITERAPKAN 25 Agu 2026: IKUT SPESIFIKASI GOOGLE ===\n' ||
      E'Diperiksa dari DUA halaman resmi Google saat sesi, bukan dari ingatan:\n' ||
      E'  support.google.com/accounts/answer/9094506 -- kombinasi huruf/angka/simbol ASCII;\n' ||
      E'    tidak boleh yang "particularly weak"; tidak boleh dipakai ulang di akun yang sama;\n' ||
      E'    tidak boleh diawali/diakhiri spasi; ANJURAN minimal 12 karakter.\n' ||
      E'  support.google.com/a/answer/139399 -- panjang minimum yang boleh diatur admin\n' ||
      E'    Workspace: ANTARA 8 DAN 100 karakter. Jadi 8 adalah LANTAI Google sendiri.\n\n' ||
      E'DITERAPKAN: password_min_length 6 -> 8, dan password_hibp_enabled -> true.\n' ||
      E'Diverifikasi dengan membaca ulang konfigurasi sesudahnya.\n\n' ||
      E'CATATAN: HIBP (HaveIBeenPwned) itulah yang menegakkan larangan "particularly weak"\n' ||
      E'Google -- ia menolak kata sandi yang pernah muncul di kebocoran data. Aturan Google\n' ||
      E'lain (tanpa spasi di ujung, tidak dipakai ulang) ditegakkan Supabase sendiri.\n' ||
      E'ANJURAN 12 karakter ditulis di teks bantuan layar, bukan dipaksakan -- memaksa 12\n' ||
      E'melebihi Google sendiri, dan Google punya alasan memilih 8 sebagai lantai.'
  where task_code = 'SEC-09' and status <> 'selesai';
end $$;
