-- Blok RR (26 Agu 2026): hasil pengukuran keadaan TERBUKA, project CI yang terlewat dari
-- sensus, dan tiga temuan yang lahir saat membersihkan data uji.
do $mig$
declare v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then return; end if;

  -- ===== KOREKSI PENTING pada AUD-45: ada project KETIGA =====
  update build_tasks
     set detail_pekerjaan = detail_pekerjaan || chr(10) || concat_ws(chr(10),
       '',
       '=== KOREKSI 26 Agu 2026: SENSUSNYA SENDIRI TIDAK LENGKAP — ADA PROJECT KETIGA ===',
       'Laporan sebelumnya berbunyi "kedua project kini 294 dari 294". Kalimat itu BENAR untuk',
       'dua project yang diperiksa, dan MENYESATKAN karena projectnya ada TIGA:',
       '  kfvtrwuuqcjfkkuqizxt — data nyata PT ITM   (.env.local)',
       '  nclkepwlsgmfbslgsajq — uji lokal          (.env.staging.local)',
       '  gzxrgbwhmjwiakcyjipd — CI                 (GitHub Actions secrets)',
       '',
       'Yang menemukannya BUKAN sensus, melainkan CI yang gagal setelah push: penjaga migrasi',
       'berbunyi "project uji gzxrgbwhmjwiakcyjipd TERTINGGAL 5 migrasi (289 dari 294)".',
       '',
       'PELAJARANNYA persis kelas yang sedang dikerjakan hari ini: sensus yang bertolak dari',
       'BERKAS ENV yang ada di komputer hanya bisa menemukan project yang punya berkas env.',
       'Project CI hidup di rahasia GitHub, jadi ia tidak pernah masuk daftar yang disapu.',
       'Sama bentuknya dengan "sapuan bertolak dari halaman, bukan dari elemen".',
       '',
       'DIPERBAIKI: kelima migrasi diterapkan ke project CI juga. Ketiganya kini 294 dari 294.',
       'Dan CI merah itu sendiri BUKAN kemunduran dari empat commit yang baru di-push — CI',
       'sudah merah DELAPAN run berturut-turut sejak 25 Agu, sebelum satu pun commit hari ini.')
   where company_id = v_company_id and task_code = 'AUD-45';

  update build_tasks
     set detail_pekerjaan = detail_pekerjaan || chr(10) || concat_ws(chr(10),
       '',
       '=== LINGKUP DIPERLUAS 26 Agu 2026: TIGA project, bukan dua ===',
       'Pengawas ini WAJIB memeriksa ketiganya — data nyata, uji lokal, DAN project CI',
       '(gzxrgbwhmjwiakcyjipd, hidup di rahasia GitHub Actions).',
       'Project CI-lah yang paling mudah tertinggal, karena tidak ada berkas env di komputer',
       'siapa pun yang menunjuknya — ia hanya ketahuan ketika CI kebetulan berjalan.')
   where company_id = v_company_id and task_code = 'AUD-46';

  -- ===== DS-14: hasil pengukuran KEADAAN TERBUKA =====
  update build_tasks
     set detail_pekerjaan = detail_pekerjaan || chr(10) || concat_ws(chr(10),
       '',
       '=== RR.3 — PENGUKURAN KEADAAN TERBUKA, 26 Agu 2026 ===',
       'Data uji dibuat LEWAT LAYAR di tenant uji (3 item, 1 routing 2 tahap, 1 BOM),',
       'baris dimekarkan, lalu diukur di enam lebar wajib.',
       '',
       'HASILNYA — 12 kombinasi (2 halaman x 6 lebar), baris DIMEKARKAN:',
       '  gulir menyamping  : 0',
       '  meluber ke kanan  : 0',
       '  terpotong ke kiri : 0',
       'Dan yang paling penting: di 360px tabel di dalam baris mekar ber-display BLOCK,',
       'artinya ia BENAR-BENAR jadi kartu. Nol sel tanpa data-label (0 dari 10 pada routing,',
       '0 dari 6 pada BOM).',
       '',
       'DUA DARI EMPAT tabel tersembunyi kini terukur: Routing dan BOM.',
       'BELUM TERUKUR: PO klien dan Pengiriman.',
       '  PO klien   : pembuatannya lewat skrip gagal di pemilihan item pada dropdown modal;',
       '               bukan cacat aplikasi yang terbukti, melainkan skrip uji yang belum jadi.',
       '  Pengiriman : barisnya menuntut rantai Sales Order + lot + proses kirim.',
       'Bukti tidak langsung untuk keduanya: keduanya memakai kelas responsif, seluruh selnya',
       'ber-data-label, dan kolomnya 3 dan 5 — di bawah ambang 8 kolom.',
       '',
       'DS-14 TETAP TERBUKA sampai keduanya terukur sungguhan.',
       '',
       'PEMBERSIHAN dilaporkan: seluruh data uji dihapus. Dibuktikan lewat POLA, bukan jumlah —',
       'nol baris berpola UJI-RR3 di SELURUH basis data. Potret 91 tabel sebelum/sesudah:',
       'tepat 3 tabel berubah (items 2->0, boms 1->0, bom_lines 1->0), sisanya nol.')
   where company_id = v_company_id and task_code = 'DS-14';

  -- ===== Temuan baru saat membersihkan =====
  perform pastikan_kode_task_kosong('DS-17');

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description,
    effect_description, urgency, status, origin, pic, detail_pekerjaan, notes)
  values (v_company_id, 'DS-17',
    'Halaman BOM Tidak Punya Hapus Maupun Arsip — Data yang Lahir Lewat Layar Tidak Bisa Mati Lewat Layar',
    'DS', 'Design System',
    concat_ws(chr(10),
      'Daftar BOM hanya punya tombol "Ubah". Tidak ada Hapus, tidak ada Arsipkan, tidak ada',
      'penonaktifan — di baris tabel maupun di panel rincian.'),
    concat_ws(chr(10),
      'BOM yang dibuat lewat layar TIDAK BISA dihapus lewat layar. Dan selama BOM-nya ada,',
      'item komponennya ikut tertahan: server menolak menghapus item yang masih dipakai.',
      'Satu BOM salah ketik karena itu menahan beberapa item selamanya.'),
    'penting', 'menunggu', 'temuan_claude', 'Claude Code',
    concat_ws(chr(10),
      'DITEMUKAN 26 Agu 2026 saat membersihkan data uji RR.3: pembersihan lewat layar MENTOK,',
      'dan sisanya terpaksa dihapus lewat basis data.',
      '',
      'Bandingkan dengan Item, Supplier, dan Routing yang sudah punya pola benar: server',
      'MENGHITUNG sendiri hapus-vs-nonaktifkan, lalu menjelaskan di mana ia terpakai.',
      'BOM belum punya jalur itu sama sekali.',
      '',
      'INI MENYENTUH KRITERIA SELESAI yang sudah ditetapkan ("datanya harus bisa lahir lewat',
      'layar") — sisi lain dari kriteria yang sama: data yang bisa lahir lewat layar harus',
      'bisa MATI lewat layar juga, kalau tidak tenant kedua akan menumpuk sampah yang tidak',
      'bisa mereka bersihkan sendiri.'),
    'Ditemukan saat mengerjakan RR.3 (pengukuran tabel di dalam baris yang dimekarkan).');

  perform pastikan_kode_task_kosong('AUD-47');

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description,
    effect_description, urgency, status, origin, pic, detail_pekerjaan, notes)
  values (v_company_id, 'AUD-47',
    'Sisa window.confirm di Halaman Routing, dan Satu Pengawas Lain yang Menghukum Pertumbuhan',
    'AUD', 'Audit Kualitas',
    concat_ws(chr(10),
      'DUA temuan kecil yang lahir dari giliran yang sama dan sejenis: kotak dialog bawaan',
      'peramban yang seharusnya sudah diganti, dan pengawas yang memakai kecocokan persis',
      'terhadap angka yang wajar bertumbuh.'),
    concat_ws(chr(10),
      'Yang pertama melanggar aturan modal berbahaya yang sudah ditetapkan; yang kedua akan',
      'gagal keras suatu hari nanti untuk alasan yang bukan kemunduran.'),
    'bisa_menunggu', 'menunggu', 'temuan_claude', 'Claude Code',
    concat_ws(chr(10),
      '1. src/features/mrp/pages/RoutingsPage.tsx baris 332 masih memakai window.confirm()',
      '   untuk konfirmasi hapus routing. Aturan proyek (dan pola yang sudah dipakai di',
      '   ItemsPage) mewajibkan Modal Carbon varian BERBAHAYA yang menyebut NAMA barisnya.',
      '   Ditemukan karena skrip pembersih menggantung: dialog peramban tidak bisa ditekan',
      '   dari kode tanpa penanganan khusus — dan itu sendiri tanda ia bukan komponen aplikasi.',
      '',
      '2. SAPUAN KELAS "pengawas yang menghukum pertumbuhan" (perintah RR.2). Diperiksa',
      '   seluruh test dan skrip: kecocokan persis terhadap angka yang wajar bertumbuh hanya',
      '   ditemukan DUA kali —',
      '     a. scripts/check-test-threshold.js EXPECTED_FILES -> SUDAH DIPERBAIKI jadi LANTAI.',
      '     b. tests/kpi_module.test.ts: expect(registryRows?.length).toBe(6) dan',
      '        expect(cards.length).toBe(6). Menambah KPI ketujuh akan membuatnya merah untuk',
      '        alasan yang bukan kemunduran.',
      '   Bentuk yang sehat sudah dipakai di tempat lain di repo ini dan tinggal ditiru:',
      '   company_settings_mst26.test.ts membandingkan dengan KATALOG_SETELAN.length —',
      '   diturunkan dari sumbernya, bukan ditulis tangan.',
      '   Sisanya sehat: nav_status_jujur memakai toEqual([]), backup_table_list_lengkap',
      '   memakai toBeGreaterThan(50).'),
    'Ditemukan saat mengerjakan RR.2 dan RR.3, 26 Agu 2026.');
end $mig$;
