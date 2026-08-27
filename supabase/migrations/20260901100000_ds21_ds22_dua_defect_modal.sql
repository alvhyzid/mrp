-- DS-21 dan DS-22 — dua cacat produk yang lahir dari Gerbang Bukti Modal/Form
-- (docs/ux/FABRIX_MODAL_FORM_FINAL_EVIDENCE.md, diukur 26-27 Agu 2026).
--
-- Keduanya BELUM pernah jadi task karena gerbang bukti itu melarang menyentuh build_tasks.
-- Larangan tersebut sudah berakhir; inilah pencatatannya.
--
-- KODE DIAMBIL LEWAT MEKANISME KANONIK, bukan ditebak:
--   node scripts/kode-task-berikutnya.js DS  ->  DS-21 (terpakai 20, tertinggi DS-20)
-- dan dijaga `pastikan_kode_task_kosong` tepat sebelum tiap insert. Menebak kode sudah
-- gagal empat dari empat kali di proyek ini.
--
-- TAG 'Visual' DIISI SENGAJA. getBuildTasks.ts menurunkan `aman_paralel` dari KETIADAAN
-- tag 'Visual'/'Teks/Bahasa' -- task bertag kosong otomatis dilabeli aman dikerjakan
-- paralel. Keduanya menyentuh layar yang sama, jadi label itu akan berbohong.
--
-- Teks panjang lewat concat_ws(chr(10), ...) sesuai aturan proyek.

-- PENCARIAN PERUSAHAAN TIDAK MEMAKAI POLA LAMA `where name = 'PT ITM'`, DAN INI DISENGAJA.
--
-- Ditemukan saat menerapkan migrasi ini (27 Agu 2026): pola itu no-op DIAM-DIAM di project
-- data nyata. Sebabnya perusahaannya bernama 'PT Indo Taste Manufacture' di sana, sementara
-- staging dan CI memakai 'PT ITM'. Migrasi melaporkan BERHASIL dan tidak menulis satu baris
-- pun -- kelas "berhasil tanpa berlaku" yang sudah empat kali menggigit proyek ini.
--
-- Yang dipakai sebagai gantinya: perusahaan yang SUDAH memiliki build_tasks. Registri task
-- ini memang milik satu tenant, jadi definisi itu benar di ketiga project sekaligus dan
-- tidak bergantung pada ejaan nama yang ternyata bisa berubah. Nol company_id literal --
-- tests/migration_hardcoded_tenant_id_watchdog.test.ts melarangnya.
--
-- DAN KEGAGALANNYA DIBUAT BERBUNYI: bila tabel companies BERISI baris tetapi tak satu pun
-- cocok, migrasi ini MELEMPAR GALAT, bukan diam. Diam hanya sah untuk basis data yang
-- benar-benar masih kosong (pemasangan baru), dan itu dibedakan secara eksplisit di bawah.
do $$
declare
  v_company_id integer;
  v_jumlah_company integer;
begin
  select company_id into v_company_id
  from build_tasks group by company_id order by count(*) desc limit 1;

  if v_company_id is null then
    select company_id into v_company_id from companies
    where name in ('PT ITM', 'PT Indo Taste Manufacture')
    order by company_id limit 1;
  end if;

  if v_company_id is null then
    select count(*) into v_jumlah_company from companies;
    if v_jumlah_company = 0 then
      raise notice 'Basis data masih kosong -- migrasi DS-21/DS-22 dilewati (no-op yang sah).';
      return;
    end if;
    raise exception 'Migrasi DS-21/DS-22 tidak menemukan perusahaan pemilik registri task, padahal companies berisi % baris. Migrasi DIHENTIKAN supaya tidak berhasil tanpa berlaku.', v_jumlah_company;
  end if;

  -- ==========================================================================
  -- DS-21 — indikator langkah meluber horizontal di layar sempit
  -- ==========================================================================
  perform pastikan_kode_task_kosong('DS-21');

  insert into build_tasks
    (company_id, task_code, name, module_code, module_name, description,
     effect_description, urgency, tags, pic, status, origin, detail_pekerjaan, notes)
  values (
    v_company_id, 'DS-21',
    'Indikator Langkah Modal Bertahap Meluber Horizontal di 360px — Satu Sumber, Empat Layar',
    'DS', 'Design System',
    concat_ws(chr(10),
      'Di lebar 360px, indikator langkah pada modal bertahap meluber melewati tepi kanan isi',
      'modal dan menghasilkan gulir menyamping DI DALAM modal. Terukur 26-27 Agu 2026:',
      '  Master Item (3 langkah)  -> luber  42px',
      '  Karyawan    (3 langkah)  -> luber  42px',
      '  PO Klien    (4 langkah)  -> luber 170px',
      '  BOM         (2 langkah)  -> luber   0px',
      'Di 672px dan 768px keempatnya nol luber.'
    ),
    concat_ws(chr(10),
      'Aturan responsive proyek menyatakan tidak boleh ada gulir menyamping di lebar mana pun,',
      'dan justru layar sempit itulah yang dipakai di lantai produksi. Pengguna harus menggeser',
      'isi modal ke samping untuk melihat sudah sampai langkah berapa dia.'
    ),
    'mendesak',
    array['Visual','Fungsi'],
    'Claude Code', 'menunggu', 'temuan_claude',
    concat_ws(chr(10),
      'SUMBER KANONIK -- SATU, bukan empat:',
      '  src/components/ui/modal-bertahap.tsx, fungsi PenandaLangkah (baris 46-54).',
      'Ia satu-satunya tempat di seluruh repo yang merender ProgressIndicator Carbon.',
      'Consumer-nya tepat empat, dan keempatnya adalah formulir yang diukur di atas:',
      '  BomsPage, CustomerPurchaseOrdersPage, ItemsPage, HrDashboardPage.',
      '',
      'ROOT CAUSE -- terukur dari paket terpasang, bukan dugaan:',
      '  node_modules/@carbon/styles/scss/components/progress-indicator/_progress-indicator.scss',
      '  baris 52-55:  .cds--progress--space-equal .cds--progress-step {',
      '                  flex-grow: 1; min-inline-size: 8rem; }',
      '8rem = 128px LANTAI per langkah. spaceEqually memberi flex-grow, tetapi lantai itu',
      'menahannya sehingga langkahnya TIDAK BISA menyusut di bawah 128px.',
      '',
      'ARITMETIKA YANG MEREPRODUKSI ANGKANYA (lebar isi modal 358px di viewport 360px):',
      '  N=2 ->  16 + 256 = 272 <= 358  -> luber   0px   (cocok: BOM)',
      '  N=3 ->  16 + 384 = 400  > 358  -> luber  42px   (cocok: Item, Karyawan)',
      '  N=4 ->  16 + 512 = 528  > 358  -> luber 170px   (cocok: PO Klien)',
      'Ketiganya cocok persis dengan angka terukur. Ini bukan korelasi, ini penyebabnya.',
      '',
      'JAWABAN CARBON SENDIRI, bukan karangan:',
      'Varian vertical MENCABUT lantai itu -- _progress-indicator.scss baris 318-324:',
      '  .cds--progress--vertical .cds--progress-step { inline-size: initial;',
      '                                                 min-inline-size: initial; }',
      'Dan ProgressIndicator.js baris 49 menonaktifkan spaceEqually sendiri saat vertical:',
      '  [`${prefix}--progress--space-equal`]: spaceEqually && !vertical',
      'Carbon memperlakukan keduanya sebagai saling meniadakan.',
      '',
      'YANG SUDAH DIUJI DAN TIDAK CUKUP -- dicatat supaya tidak dicoba ulang:',
      'sekadar mencabut spaceEqually menurunkan lantai dari 8rem ke 7rem (112px):',
      '  N=3 -> 16 + 336 = 352 <= 358 -> SEMBUH',
      '  N=4 -> 16 + 448 = 464  > 358 -> masih luber 106px',
      'Jadi ia menyembuhkan Master Item dan Karyawan, TETAPI MENINGGALKAN PO Klien.',
      'Bukan perbaikan yang sah karena tidak menutup seluruh kelasnya.',
      '',
      'BATAS PERALIHAN: 42rem (672px) -- breakpoint md Carbon, diukur dari @carbon/layout',
      'terpasang. Itu juga batas tempat modal berhenti jadi layar penuh, dan batas tempat',
      'luber ini hilang dengan sendirinya.',
      '',
      'DILARANG: memakai overflow-x hidden atau memotong langkah. Menyembunyikan langkah',
      'membuat pengguna tidak tahu formulirnya masih panjang -- itu mengganti satu cacat',
      'dengan cacat yang lebih sulit dilihat.'
    ),
    concat_ws(chr(10),
      'Ditemukan lewat Gerbang Bukti Modal/Form (26-27 Agu 2026).',
      'Bukti lengkap: docs/ux/FABRIX_MODAL_FORM_FINAL_EVIDENCE.md bagian 7.',
      'Komponen bersamanya sendiri lahir dari DS-18; DS-18 TIDAK diubah oleh task ini.'
    )
  );

  -- ==========================================================================
  -- DS-22 — baris komponen BOM: jumlah kolom tidak mengikuti lebar wadahnya
  -- ==========================================================================
  perform pastikan_kode_task_kosong('DS-22');

  insert into build_tasks
    (company_id, task_code, name, module_code, module_name, description,
     effect_description, urgency, tags, pic, status, origin, detail_pekerjaan, notes)
  values (
    v_company_id, 'DS-22',
    'Baris Komponen BOM: Kolom Mengikuti Lebar LAYAR, Padahal Hidup di Dalam Modal yang Menyempit',
    'DS', 'Design System',
    concat_ws(chr(10),
      'Baris komponen pada formulir BOM tumbuh tanpa batas dan jumlah kolomnya ditentukan',
      'lebar LAYAR, bukan lebar wadah tempat ia benar-benar hidup.',
      '',
      'Tinggi isi modal pada langkah Komponen (jendela 800px), terukur:',
      '  360px:  1 komponen 704px | 2: 1168 | 3: 1632 | 4: 2096   (+464px per baris)',
      '  672px:  484 | 820 | 1132 | 1444                          (+312..336px per baris)',
      '  768px:  468 | 788 | 1084 | 1380                          (+296..312px per baris)',
      'Tidak ditemukan batas: nol pembagian halaman, nol pelipatan, nol max-height.'
    ),
    concat_ws(chr(10),
      'Yang paling merugikan justru TIDAK terlihat di HP melainkan di DESKTOP: pada 1056px',
      'lebar tiap kontrol jatuh ke 130px dan keterangan bantuannya membungkus jadi lima baris.',
      'Orang yang memakai layar besar justru mendapat kolom paling sempit di seluruh rentang.'
    ),
    'mendesak',
    array['Visual','Fungsi'],
    'Claude Code', 'menunggu', 'temuan_claude',
    concat_ws(chr(10),
      'SUMBER:',
      '  src/features/mrp/pages/BomsPage.tsx baris 949-1006 (perulangan form.lines.map)',
      '  app/(shell)/boms/boms.scss baris 88-108 (.bom-komponen__baris)',
      'Tiap baris memuat empat kontrol berlabel dan satu tombol hapus.',
      '',
      'ROOT CAUSE SEBENARNYA -- dan ini BUKAN yang terlihat pertama kali:',
      'aturan kolomnya memakai breakpoint LEBAR LAYAR (md 672px -> 2 kolom, lg 1056px ->',
      '4 kolom), padahal barisnya hidup DI DALAM modal yang lebarnya justru MENYEMPIT saat',
      'layar melebar. Carbon _modal.scss baris 87/97/102/107: 84% -> 60% (mulai 1056px) ->',
      '48% (mulai 1312px).',
      '',
      'Dua perubahan berlawanan arah bertemu di SATU piksel viewport, dan hasilnya terukur:',
      '  viewport 1055px -> wadah 886px -> 2 kolom -> 402px per kontrol -> helper 2 baris',
      '  viewport 1056px -> wadah 634px -> 4 kolom -> 130px per kontrol -> helper 5 baris',
      '  viewport 1312px -> wadah 630px -> 4 kolom -> 129px per kontrol -> helper 5 baris',
      'Kolom TERSEMPIT di seluruh rentang ada di desktop, bukan di ponsel.',
      '',
      'ARAH PERBAIKAN: jumlah kolom harus diturunkan dari LEBAR YANG BENAR-BENAR TERSEDIA,',
      'bukan dari lebar layar. Cara termurah yang tidak menambah konsep baru:',
      '  grid-template-columns: repeat(auto-fit, minmax(<lebar minimum>, 1fr))',
      'Ia membaca lebar wadahnya sendiri, jadi kedua breakpoint bisa dicabut sekaligus.',
      '',
      'TIGA JALAN YANG SUDAH DITOLAK BESERTA ALASANNYA -- supaya tidak dicoba ulang:',
      '1. ACCORDION / melipat baris. Carbon melarangnya langsung di halaman pola formulir:',
      '   "Do not hide information in accordions or tabs."',
      '2. Menyimpan keadaan buka-tutup per baris. Barisnya di-key dengan INDEX dan removeLine',
      '   menyaring berdasarkan index -- menghapus baris tengah menggeser identitas seluruh',
      '   baris sesudahnya, sehingga keadaan lipatan akan mengikuti POSISI, bukan barisnya.',
      '3. Container query dengan ambang yang sama (672/1056). Lebar dalam baris di viewport',
      '   1056px dan 1312px keduanya di bawah 672px, jadi desktop akan jatuh ke SATU kolom',
      '   dan tingginya naik dari 254px ke 446px per baris -- 76% lebih buruk.',
      '',
      'YANG SUDAH DILAKUKAN CARBON DAN TIDAK PERLU DIBANGUN ULANG:',
      'isi modal yang terpotong SUDAH ditandai. _modal.scss baris 269-281 memberi',
      '.cds--modal-scroll-content sebuah mask-image gradien yang memudarkan bagian bawah,',
      'dan ComposedModal.js baris 55 menyalakannya sendiri saat scrollHeight > clientHeight,',
      'sekaligus menambahkan role="region" dan tabIndex untuk pembaca layar.',
      '',
      'TUJUH TEMPAT SEKELAS yang TIDAK dikerjakan task ini -- dicatat supaya tidak hilang:',
      '  routing.scss:90        RoutingsPage.tsx:770             (paling parah: 642px/baris di 360px)',
      '  production.scss:94     ProductionDashboardPage.tsx:686',
      '  production.scss:58     ProductionDashboardPage.tsx:617',
      '  customer-po.scss:166   CustomerPurchaseOrdersPage.tsx:1048',
      '  purchasing.scss:90     PurchasingPage.tsx:1356',
      '  warehouse.scss:33      WarehouseDashboardPage.tsx:707',
      '  shipments.scss:89      ShipmentsPage.tsx:889',
      'Bentuk lain yang sekelas: ppic.scss:47 + PpicDashboardPage.tsx:1218.'
    ),
    concat_ws(chr(10),
      'Ditemukan lewat Gerbang Bukti Modal/Form (26-27 Agu 2026).',
      'Bukti lengkap: docs/ux/FABRIX_MODAL_FORM_FINAL_EVIDENCE.md bagian 4.2 dan 8.',
      'Cacat desktop 1056px ditemukan saat pemeriksaan tandingan terhadap analisis pertama --',
      'analisis pertama menyatakan desktop "kemungkinan besar tidak bermasalah", dan itu keliru.'
    )
  );

end $$;
