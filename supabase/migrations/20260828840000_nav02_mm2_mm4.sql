-- NAV-02 (sisa dokumen UX Shell), PLT-xx (satu sumber data pengguna), dan penurunan
-- urgensi PMB-12/OVR-01/GDG-11 sesuai fakta data nyata. 25 Agu 2026.
do $mig$
declare v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then return; end if;

  perform pastikan_kode_task_kosong('NAV-02');

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description,
    effect_description, urgency, status, origin, pic, detail_pekerjaan, notes)
  values (v_company_id, 'NAV-02',
    'Sisa Dokumen UX Shell & Navigasi — Enam Belas Butir, Sebagian Ditunda Sadar',
    'NAV', 'Navigasi',
    'Butir dokumen UX Shell yang BELUM dikerjakan, dikumpulkan jadi satu task induk beserta status dan pemicunya.',
    'Menentukan apakah butir yang ditunda punya pemicu jelas, atau menggantung tanpa alasan.',
    'bisa_menunggu', 'menunggu', 'pemilik_produk', 'Claude Code',
    concat_ws(chr(10),
      'SUMBER: docs/FABRIX_UX_Application_Shell_Navigation_Architecture_v1_0.md (S.1-S.48) +',
      'docs/penyerahan-opus-ux-shell-navigasi.md. Catatan kepala sudah ditambahkan di berkasnya.',
      '',
      '=== YANG SUDAH DIKERJAKAN, JANGAN DICATAT ULANG ===',
      '  S.25 + S.42 audit           -> SUDAH: ar0-inventaris-as-is.md + nav-matriks-status...',
      '  D-1..D-6 keputusan pemilik  -> SUDAH tercatat di CLAUDE.md dan Daftar Tugas',
      '  S.6/S.7/S.11/S.12 UI Shell  -> SUDAH: DS-04, diterima pemilik produk',
      '  S.14 Breadcrumb             -> SUDAH: cetakan Items (docs/governance/cetakan-halaman-data.md)',
      '  S.15 Page header standar    -> SUDAH: cetakan yang sama',
      '  S.22 User menu              -> SUDAH: panel akun DS-04',
      '  S.19 Global task center     -> SUDAH DICATAT sebagai OVR-01, jangan catat dua kali',
      '  S.5 status data-driven      -> SUDAH, dan dinaikkan jadi ATURAN di CLAUDE.md',
      '  S.27/S.32/S.33-36/S.45      -> DINAIKKAN JADI ATURAN di CLAUDE.md, bukan task',
      '',
      '=== YANG BELUM — STATUS DAN PEMICU PER BUTIR, tidak diratakan ===',
      'DITUNDA SADAR, punya pemicu:',
      '  S.8  Global search lintas entitas -> BUTUH INFRASTRUKTUR PENCARIAN. v1 cukup command',
      '       palette navigasi + pencarian per modul yang SUDAH ada. Pemicu: ada kebutuhan',
      '       nyata mencari lintas entitas, bukan sebelum.',
      '  S.18 Right context panel -> MENUMPANG panel bertab info/asal-usul yang sudah',
      '       dirancang. JANGAN dua panel kanan. Pemicu: panel asal-usul selesai.',
      '  S.40 Control Tower -> Pemicu: setelah KPI-1.',
      '',
      'BELUM, TANPA PEMICU -> BISA MENUNGGU:',
      '  S.9  Command palette',
      '  S.16 Tabs',
      '  S.17 Related records (tautan antar entitas terkait)',
      '  S.20 Notification center -- CATATAN: lonceng notifikasi SUDAH ada; yang belum adalah',
      '       pusat notifikasi penuh. Periksa dulu bedanya sebelum membangun.',
      '  S.21 Company/tenant context switcher -- satu pengguna baru punya satu perusahaan;',
      '       ini baru berarti bila ada pengguna lintas tenant.',
      '  S.36 Entity deep linking',
      '  S.37 Cross-domain navigation',
      '  S.38 Navigation state (mengingat posisi terakhir pengguna)',
      '  S.39 Global action vs contextual action',
      '  S.41 AI navigation',
      '',
      '=== KENAPA SATU TASK INDUK, bukan 16 task ===',
      'Enam belas task yang sebagian besar Ditunda Sadar akan MENENGGELAMKAN pekerjaan yang',
      'berjalan di daftar. Alasan yang sama sudah dipakai untuk dokumen Sales.',
      'Saat satu butir tiba gilirannya, ia dipecah jadi task tersendiri SAAT ITU.'),
    concat_ws(chr(10),
      'DICATAT 25 Agu 2026 atas aturan "fokus satu task".',
      '',
      'DEPENDENSI YANG SUDAH TERPENUHI, diperbarui supaya tidak jadi penghalang palsu:',
      'dokumen menyebut FABRIX_UX_Information_Architecture_v1.0.md sebagai dependensi yang',
      'HILANG. Pemilik produk SUDAH mengunggahnya; berkasnya ada di docs/.',
      '',
      'PEMICU YANG DIUSULKAN: setelah penerapan Carbon ke seluruh halaman SELESAI. Alasannya',
      'sama dengan AR-01 -- sebagian besar butir di sini MENYENTUH LAYAR, dan menyentuh layar',
      'dua kali lebih mahal daripada sekali.'));

  perform pastikan_kode_task_kosong('PLT-06');

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description,
    effect_description, urgency, status, origin, pic, detail_pekerjaan, notes)
  values (v_company_id, 'PLT-06',
    'Satu Sumber Data Pengguna — 36 Halaman Berhenti Memanggil /api/me Sendiri-Sendiri',
    'PLT', 'Platform',
    'Menjadikan data pengguna satu sumber bersama, menggantikan 36 pengambilan terpisah.',
    'Menentukan apakah perubahan pada identitas pengguna sampai ke seluruh layar, atau hanya ke sebagian.',
    'bisa_menunggu', 'menunggu', 'pemilik_produk', 'Claude Code',
    concat_ws(chr(10),
      'KEADAAN SEKARANG: kerangka aplikasi memanggil /api/me sendiri, dan 36 halaman lain juga',
      'memanggilnya masing-masing. Tiap salinan hidup terpisah dan tidak saling tahu.',
      '',
      'INI "CARA B" yang disodorkan saat membangun foto profil, dan pemilik produk memilih',
      'cara A (kabar antar-halaman) untuk foto profil.',
      '',
      'ALASAN DICATAT TERPISAH, kata pemilik produk sendiri:',
      '  "Lebih benar untuk jangka panjang, tapi menyentuh 36 halaman -- pekerjaan tersendiri,',
      '   bukan bagian foto profil."',
      '',
      'PERIKSA SAAT DIKERJAKAN: kelas "36 pengambil tanda pengenal, 35 kebetulan benar" sudah',
      'pernah menggigit proyek ini lewat AUD-35 -- satu halaman lupa mengirim token dan tidak',
      'bisa dibuka selama berhari-hari. authedFetch sudah menutup sisi TOKEN-nya; yang belum',
      'ditutup adalah sisi DATA-nya.'),
    concat_ws(chr(10),
      'DICATAT 25 Agu 2026 (MM.2).',
      'PEMICU: setelah penerapan Carbon ke seluruh halaman SELESAI, karena keduanya menyentuh',
      'halaman yang SAMA. Menyentuhnya dua kali lebih mahal daripada sekali.'));
end $mig$;

-- MM.4 — fakta yang mengubah urutan, disertakan di ketiga task, beserta penurunan urgensi.
do $mig$
declare v_fakta text;
begin
  v_fakta := concat_ws(chr(10), '',
    '=== FAKTA YANG MENGUBAH URUTAN (dicatat 25 Agu 2026) ===',
    'PT ITM saat ini punya NOL item, NOL BOM, NOL supplier, NOL lot, NOL Work Order --',
    'hanya 30 karyawan dan 288 task.',
    '',
    'Artinya PMB-12, OVR-01, dan GDG-11 BELUM BISA DIPAKAI siapa pun: peringatan bahan tidak',
    'akan menyala, permintaan pembelian tidak akan ada isinya.',
    '',
    'Ini BUKAN alasan membatalkannya, tapi menegaskan urutannya -- membangunnya sekarang',
    'berarti membangun untuk data yang belum ada, dan setiap halaman yang lahir sebelum Carbon',
    'selesai akan disentuh DUA KALI.',
    '',
    'PEMICU: (a) penerapan Carbon ke seluruh halaman selesai, DAN (b) master data PT ITM',
    '(item, BOM, supplier) sudah terisi sehingga fiturnya punya isi untuk diuji.');

  update build_tasks
  set urgency = 'bisa_menunggu',
      notes = concat_ws(chr(10), coalesce(notes, ''), v_fakta)
  where task_code in ('PMB-12', 'OVR-01', 'GDG-11');
end $mig$;
