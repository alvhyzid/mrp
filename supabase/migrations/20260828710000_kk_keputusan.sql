-- Blok KK (25 Agu 2026): peringatan gabungan, setelan persen, dan koreksi status.

do $mig$
declare v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then return; end if;

  -- ===== KK.8 — SEC-15 turun jadi SEBAGIAN =====
  update build_tasks set status = 'menunggu', urgency = 'mendesak',
    notes = concat_ws(chr(10), coalesce(notes, ''), '',
      '=== KOREKSI STATUS 25 Agu 2026: SEBAGIAN SELESAI, BUKAN SELESAI ===',
      'Diturunkan kembali dari selesai atas keputusan pemilik produk, dan alasannya tepat:',
      '  "Ini memperbaiki KE MANA tautannya menunjuk, bukan membuktikan emailnya SAMPAI."',
      '',
      'YANG SUDAH: site_url dan daftar izin menunjuk situs sungguhan (diverifikasi).',
      'YANG BELUM: satu email sungguhan terbukti sampai, DAN tautannya terbukti membuka',
      'halaman yang benar.',
      '',
      'JANGAN ditutup sebelum keduanya terbukti. Menutupnya sekarang akan membuat orang',
      'mengira pemulihan kata sandi sudah bisa dipakai, padahal belum pernah dicoba dari',
      'ujung ke ujung. Tertahan INF-26 (alamat email sungguhan).')
  where task_code = 'SEC-15';

  -- ===== KK.9 — INF-25 sudah diputuskan: Resend =====
  update build_tasks set
    name = 'Pasang Resend sebagai SMTP Produksi',
    notes = concat_ws(chr(10), coalesce(notes, ''), '',
      '=== KEPUTUSAN PEMILIK PRODUK 25 Agu 2026: RESEND ===',
      'Penyedianya sudah dipilih dan catatan DNS sedang ditambahkan pemilik produk.',
      'Task ini BUKAN LAGI "pilih penyedia" melainkan "pasang Resend".',
      'Empat pilihan penyedia yang sempat disiapkan TIDAK LAGI PERLU dan tidak usah dibaca.',
      '',
      'YANG TERSISA:',
      '  1. Tunggu catatan DNS terverifikasi di Resend (dikerjakan pemilik produk).',
      '  2. Pasang kredensial SMTP Resend di setelan Auth Supabase.',
      '  3. Buktikan dengan satu pengiriman nyata, lalu periksa tautannya membuka halaman',
      '     yang benar. Itu sekaligus menutup SEC-15 dan membuka jalan SEC-17.'),
    detail_pekerjaan = concat_ws(chr(10),
      'Pasang kredensial SMTP Resend di setelan Auth Supabase, lalu buktikan dengan satu',
      'pengiriman nyata.',
      '',
      'BUTUH DARI PEMILIK PRODUK: kunci API Resend. JANGAN dikirim lewat percakapan ini --',
      'aturan tetap proyek melarang menerima kredensial lewat percakapan. Pemilik produk',
      'memasangnya sendiri di dashboard Supabase, atau menaruhnya di tempat yang sudah',
      'disepakati.')
  where task_code = 'INF-25';
end $mig$;

do $mig$
declare v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then return; end if;

  perform pastikan_kode_task_kosong('GDG-10');

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description,
    effect_description, urgency, status, origin, pic, detail_pekerjaan, notes)
  values (v_company_id, 'GDG-10',
    'Satu Peringatan Per Bahan, Sebabnya Disebutkan di Dalamnya',
    'GDG', 'Gudang & Persediaan',
    'Menggabungkan peringatan stok menipis dan kebutuhan produksi jadi SATU peringatan per bahan.',
    'Menentukan apakah orang gudang bisa mengambil keputusan dari satu baris, atau harus menerjemahkan dua jawaban.',
    'penting', 'menunggu', 'pemilik_produk', 'Claude Code',
    concat_ws(chr(10),
      'BENTUK YANG DISETUJUI:',
      '  "GULA RAFINASI - perlu dipesan. Sisa 8% dari yang pernah masuk, DAN kurang 40 kg untuk 3 batch minggu ini."',
      '',
      'YANG WAJIB ADA:',
      '  a. SELURUH sebab yang menyala, bukan yang pertama saja.',
      '  b. Sebab yang TIDAK menyala pun disebut bila membantu keputusan, mis. "sisa 8%, tapi masih cukup untuk produksi terjadwal". Itu keterangan yang MENCEGAH PEMBELIAN TERGESA-GESA.',
      '  c. Sebab yang BERTENTANGAN ditampilkan menonjol -- itu yang paling perlu dilihat manusia.',
      '  d. Bahan yang BELUM PERNAH DIBELI tidak masuk peringatan ini. Bedakan "belum ada pembelian" dari "stok habis" -- artinya berbeda, dan mencampurnya membuat daftar penuh bahan yang memang belum pernah dipakai.',
      '',
      'SUMBER SEBABNYA, keduanya SUDAH ADA, jangan bangun ulang:',
      '  sisa stok       : stockThreshold.ts + refreshLowStockAlerts.ts',
      '  kebutuhan produksi : getPlanningFeasibility.ts + kesiapan bahan Work Order',
      '',
      'PEMICU BERKALA menumpang jadwal AUD-13 (lihat GDG-09) -- peringatan yang harus ditekan orang untuk muncul bukan peringatan.'),
    concat_ws(chr(10),
      'DISETUJUI PEMILIK PRODUK 25 Agu 2026 (KK.1).',
      '',
      'ALASAN YANG WAJIB DICATAT, karena akan dirujuk untuk peringatan lain:',
      '  "Orang gudang tidak bertanya apakah stok di bawah ambang persen atau apakah kebutuhan melebihi sisa. Ia bertanya satu hal: bahan ini perlu dipesan atau tidak."',
      '  "Dan yang paling berharga: dua sebab yang BERTENTANGAN jadi terlihat. Bila stok cukup menurut persen tapi kurang menurut jadwal produksi, itu informasi terpenting di layar -- dan dua peringatan terpisah justru menyembunyikannya."',
      '',
      'Sudah dinaikkan jadi ATURAN UMUM di CLAUDE.md: peringatan disusun menurut KEPUTUSAN yang harus diambil orang, bukan menurut perhitungan yang menghasilkannya.'));

  perform pastikan_kode_task_kosong('MST-27');

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description,
    effect_description, urgency, status, origin, pic, detail_pekerjaan, notes)
  values (v_company_id, 'MST-27',
    'Ambang Stok Minimum: Nilai Bawaan Per Perusahaan, Bisa Ditimpa Per Item',
    'MST', 'Master Data',
    'Menambahkan setelan ke-18 di Setelan Perhitungan: persen ambang stok minimum yang berlaku untuk seluruh item.',
    'Menentukan kapan peringatan stok menyala untuk ratusan item tanpa mengisinya satu per satu.',
    'penting', 'menunggu', 'pemilik_produk', 'Claude Code',
    concat_ws(chr(10),
      'Setelan baru di company_settings, dan WAJIB lewat jalur yang sudah ada:',
      '  companySettingsCatalog.ts (definisi + validasi + label Bahasa Indonesia)',
      '  memengaruhiHistoris = TRUE, karena ia mengubah ARTI PERINGATAN, bukan sekadar tampilan.',
      '',
      'Ambang efektif per item dihitung berurutan:',
      '  1. min_stock_percent milik item, bila diisi',
      '  2. bila kosong, persen bawaan perusahaan',
      '  3. bila keduanya kosong, min_stock_level (angka mutlak) seperti sekarang',
      'Urutan ini WAJIB terlihat di layar, bukan hanya di kode -- lihat aturan field yang saling membatalkan.',
      '',
      'stockThreshold.ts sudah menghitung ambang efektif; tambahkan lapisan perusahaan DI SANA, jangan bikin jalur kedua.'),
    concat_ws(chr(10),
      'DIKONFIRMASI PEMILIK PRODUK 25 Agu 2026 (KK.3).',
      '',
      'BUKTI PENDUKUNG yang dicatat, dan ia lebih kuat daripada dugaan:',
      'field per-item SUDAH LAMA ADA dan BELUM PERNAH DIPAKAI pemilik produk sendiri.',
      'Isian yang harus diisi ratusan kali tidak akan diisi -- dan itu bukan ramalan, itu',
      'yang sudah terjadi.',
      '',
      'KONSEKUENSI YANG SUDAH DISAMPAIKAN DAN DITERIMA: ia jadi setelan ke-18 dan WAJIB',
      'bertanggal berlaku seperti 17 lainnya. Ambang yang berubah diam-diam membuat',
      'peringatan lama tidak bisa dijelaskan lagi -- orang melihat peringatan bulan lalu dan',
      'tidak tahu ambang mana yang dipakai saat itu.'));
end $mig$;
