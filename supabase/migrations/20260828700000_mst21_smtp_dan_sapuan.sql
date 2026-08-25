-- Keputusan blok lanjutan (25 Agu 2026): MST-21 dikerjakan, SEC-15 beres, SMTP produksi.

do $mig$
declare v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then return; end if;

  -- ===== A — MST-21 dikerjakan sebagian =====
  update build_tasks set status='menunggu_persetujuan',
    approval_location='Items -> Tambah item, dan Items -> Detail sebuah item.',
    approval_review_steps=E'1. Buka "Tambah item": Reorder Point dan Reorder Qty SUDAH TIDAK ADA di formulir.\n' ||
      E'2. Buka Detail sebuah item: keduanya juga tidak muncul lagi di daftar informasinya.\n' ||
      E'3. Perhatikan yang TETAP ada: Stok minimum, sekarang jadi SATU kelompok berisi\n' ||
      E'   "Persen dari yang pernah masuk" dan "Angka mutlak" berdampingan.',
    approval_example_case='Buka Tambah item dan cari Reorder Point — ia memang sudah tidak ada.',
    approval_if_approved='Bagian tampilan MST-21 ditutup. Sisanya (Reorder Qty di layar purchasing + peringatan dari kebutuhan produksi) menunggu jawaban A.4.',
    approval_if_rejected='Sebutkan bagian mana yang keliru.',
    notes = coalesce(notes||E'\n\n','') ||
      E'=== DIKERJAKAN 25 Agu 2026 — bagian TAMPILAN ===\n' ||
      E'  Reorder Point & Reorder Qty DICABUT dari formulir item (yang diisi gudang).\n' ||
      E'  Keduanya juga dicabut dari panel Detail.\n' ||
      E'  Kolomnya TETAP ADA di basis data — angka lama tidak dihapus.\n' ||
      E'  Diverifikasi di peramban: reorder_point dan reorder_qty tidak ada di formulir.\n\n' ||
      E'=== A.4 — RISIKO DUA PERINGATAN: USULAN, BELUM DIBANGUN ===\n' ||
      E'PERTANYAANNYA: satu peringatan dengan dua sebab, atau dua peringatan yang saling tahu?\n\n' ||
      E'USULAN: SATU PERINGATAN PER BAHAN, dengan SEBABNYA disebutkan.\n\n' ||
      E'ALASANNYA dari sisi orang gudang, bukan dari sisi kerapian kode:\n' ||
      E'  Orang gudang tidak bertanya "apakah stok di bawah ambang persen?" atau "apakah\n' ||
      E'  kebutuhan produksi melebihi sisa?". Ia bertanya SATU hal: "bahan ini perlu dipesan\n' ||
      E'  atau tidak?" Dua peringatan untuk satu bahan memaksa dia menerjemahkan dua jawaban\n' ||
      E'  jadi satu keputusan — dan begitu keduanya pernah tidak sepakat, ia berhenti\n' ||
      E'  mempercayai keduanya.\n\n' ||
      E'BENTUKNYA: satu baris per bahan, dengan sebab yang terbaca, mis.\n' ||
      E'  "GULA RAFINASI - perlu dipesan. Sisa 8% dari yang pernah masuk, DAN kurang 40 kg\n' ||
      E'   untuk 3 batch yang dijadwalkan minggu ini."\n' ||
      E'Bila hanya satu sebab yang menyala, hanya satu yang disebut.\n\n' ||
      E'KEUNTUNGAN TAMBAHAN yang menentukan: dua sebab yang BERTENTANGAN jadi terlihat, bukan\n' ||
      E'tersembunyi di dua tempat. Bila stok terlihat cukup menurut persen tapi kurang menurut\n' ||
      E'jadwal produksi, itu justru informasi paling berharga di layar itu — dan dua\n' ||
      E'peringatan terpisah akan menyembunyikannya.\n\n' ||
      E'JANGAN DIBANGUN sebelum pemilik produk menjawab.'
  where task_code = 'MST-21';

  -- ===== D.2 — SEC-15 selesai =====
  update build_tasks set status='selesai', completed_at=now(),
    notes = coalesce(notes||E'\n\n','') ||
      E'=== DIKERJAKAN 25 Agu 2026 ===\n' ||
      E'  site_url       : http://localhost:3000 -> https://mrp-staging-zeta.vercel.app\n' ||
      E'  uri_allow_list : (kosong) -> https://mrp-staging-zeta.vercel.app/**,\n' ||
      E'                              http://localhost:3000/**\n' ||
      E'Alamat situsnya diperiksa dulu (http 200) sebelum dipasang, bukan diasumsikan.\n' ||
      E'localhost DIPERTAHANKAN di daftar izin supaya pengembangan lokal tetap jalan —\n' ||
      E'mencabutnya akan mematikan pengujian di komputer sendiri tanpa alasan.\n' ||
      E'Diverifikasi dengan membaca ulang konfigurasi sesudahnya.\n\n' ||
      E'BATAS YANG JUJUR: ini memperbaiki KE MANA tautannya menunjuk. Ia TIDAK membuktikan\n' ||
      E'bahwa emailnya sampai — itu menunggu alamat email sungguhan (lihat SEC-17).'
  where task_code = 'SEC-15';
end $mig$;

do $mig$
declare v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then return; end if;

  -- Penjaga BARU dipakai di sini: gagal keras bila kodenya bentrok.
  perform pastikan_kode_task_kosong('INF-25');

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description,
    effect_description, urgency, status, origin, pic, detail_pekerjaan, notes)
  values (v_company_id, 'INF-25',
    'SMTP Produksi: Layanan Email Bawaan Supabase Tidak Ditujukan untuk Dipakai Sungguhan',
    'INF', 'Infrastruktur',
    'Project tidak punya SMTP sendiri; ia memakai layanan email bawaan Supabase yang berbatas kecepatan ketat.',
    'Begitu akun karyawan sungguhan dibuat, undangan dan pemulihan kata sandi akan tertahan atau hilang tanpa penjelasan.',
    'penting', 'menunggu', 'temuan_claude', 'Pemilik Produk',
    concat_ws(chr(10),
      'Pilih penyedia, pasang kredensialnya di setelan Auth Supabase, lalu buktikan dengan satu pengiriman nyata.',
      '',
      'PILIHAN YANG LAZIM beserta perkiraan biayanya (per Agu 2026; WAJIB diperiksa ulang saat memutuskan, harga berubah):',
      '  Resend     : 3.000 email/bulan gratis, lalu sekitar USD 20/bulan. Paling mudah dipasang.',
      '  Postmark   : sekitar USD 15/bulan untuk 10.000 email. Terkenal paling andal untuk email transaksional, dan itu memang jenis email kita.',
      '  Amazon SES : sekitar USD 0,10 per 1.000 email. Paling murah jauh, TAPI perlu mengurus reputasi domain sendiri dan keluar dari mode uji AWS lebih dulu.',
      '  SendGrid   : ada tingkat gratis, banyak dipakai; pengaturannya lebih berlapis.',
      '',
      'PERTIMBANGAN untuk skala PT ITM: jumlah emailnya kecil sekali, yaitu undangan pengguna, pemulihan kata sandi, dan verifikasi. Puluhan per bulan, bukan ribuan.',
      'Jadi yang menentukan BUKAN harga melainkan KEANDALAN dan kemudahan pemasangan.',
      '',
      'PEMILIK PRODUK YANG MEMILIH. Claude Code tidak memilih penyedia berbayar.'),
    concat_ws(chr(10),
      'Ditemukan 25 Agu 2026 saat memeriksa penghenti G.4.',
      'Dibaca dari konfigurasi project: smtp_host, smtp_user, dan smtp_admin_email SEMUANYA kosong.',
      'Artinya seluruh email keluar lewat layanan bawaan Supabase, yang dokumentasinya sendiri menyatakan ia untuk PENGEMBANGAN dan berbatas kecepatan ketat.',
      '',
      'KENAPA INI TIDAK TERASA SEKARANG: nol pengguna sungguhan, jadi nol email dikirim.',
      'Ia akan terasa persis pada saat paling buruk, yaitu saat karyawan pertama diundang.',
      '',
      'PEMICU NAIK JADI MENDESAK: saat akun karyawan sungguhan pertama dibuat.'));

  perform pastikan_kode_task_kosong('INF-26');

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description,
    effect_description, urgency, status, origin, pic, detail_pekerjaan, notes)
  values (v_company_id, 'INF-26',
    'PERTANYAAN: Alamat Email Sungguhan untuk Menguji Pengiriman',
    'INF', 'Infrastruktur',
    'Belum pernah ada satu pun email yang terbukti sampai ke alamat sungguhan dari project ini.',
    'TIGA hal tertahan olehnya, dan ketiganya menyangkut orang yang tidak bisa masuk.',
    'penting', 'menunggu', 'pemilik_produk', 'Pemilik Produk',
    concat_ws(chr(10),
      'Cukup satu alamat email nyata milik pemilik produk, dipakai sekali untuk membuktikan pengiriman berhasil.',
      'Claude Code TIDAK memakai alamat siapa pun tanpa diminta.'),
    concat_ws(chr(10),
      'YANG TERTAHAN OLEH PERTANYAAN INI:',
      '  1. PEMULIHAN KATA SANDI: belum pernah terbukti bekerja dari ujung ke ujung.',
      '  2. GANTI EMAIL DENGAN VERIFIKASI (SEC-17): tidak boleh dibangun sebelum terbukti emailnya sampai; kalau tidak, penggunanya tidak bisa menyelesaikan alurnya.',
      '  3. UNDANGAN PENGGUNA BARU: seluruh alur mengundang karyawan bergantung padanya.',
      '',
      'YANG SUDAH DIPERIKSA dan tidak perlu diulang:',
      '  Pembuatan akun menerima SEMUA domain yang diuji, yaitu @debug.mrp, @example.com, @gmail.com, dan @fabrix.co.id. Keempatnya diterima lalu langsung dihapus.',
      '  Yang menolak adalah PENGIRIMAN, dan yang ditolak DOMAINNYA: @debug.mrp tidak bisa menerima email karena domainnya memang tidak ada.',
      '  site_url dan daftar izin SUDAH diperbaiki lewat SEC-15, jadi tautannya kini menunjuk situs yang benar, bukan lagi localhost.'));
end $mig$;
