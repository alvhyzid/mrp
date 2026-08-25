-- DS-02 (25 Agu 2026) — temuan pemilik produk di /register, dan urutan migrasi 38 layar.
-- Lahir dari perbandingan berdampingan katalog Carbon resmi vs layar kita.

do $$
declare v_company_id integer; v_module text := 'DS';
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then
    raise notice 'Company PT ITM tidak ditemukan -- migrasi dilewati';
    return;
  end if;

  if exists (select 1 from build_tasks where task_code = 'DS-02') then
    raise exception 'DS-02 sudah dipakai. Pilih kode lain.';
  end if;
  if exists (select 1 from build_tasks where task_code = 'DS-03') then
    raise exception 'DS-03 sudah dipakai. Pilih kode lain.';
  end if;

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description,
                           effect_description, urgency, status, origin, pic, detail_pekerjaan, notes)
  values (
    v_company_id, 'DS-02',
    'Migrasi Carbon Layar Publik: Daftar, Masuk, dan Konfirmasi POD',
    v_module, 'Design System',
    'Ketiga layar ini dilihat pihak LUAR: calon tenant yang mendaftar, dan pengemudi/penerima '
    || 'barang yang membuka tautan POD. Ketiganya belum tersentuh Carbon sama sekali.',
    'Kesan pertama produk yang akan dijual. /register adalah LANGKAH PERTAMA seluruh rantai '
    || '"berdiri dari nol" -- layar pertama yang dilihat tenant baru.',
    'mendesak', 'menunggu', 'pemilik_produk', 'Claude Code',
    E'1. Naikkan impor CSS Carbon ke cabang rute layar publik (BUKAN ke layout akar).\n' ||
    E'2. Ganti kartu pembungkus dengan Tile Carbon -- Tile TIDAK berbingkai.\n' ||
    E'3. Ganti field dengan TextInput/PasswordInput Carbon; penanda fokus jadi bawaan Carbon\n' ||
    E'   (outline 2px biru), bukan 3px hitam buatan sendiri.\n' ||
    E'4. Ganti tombol dengan Button Carbon; JANGAN dipaksa melebar penuh.\n' ||
    E'5. Cabut 10 warna heks yang ditulis tangan di tiap layar, ganti token Carbon.\n' ||
    E'6. Uji di 360/768/1280/1920 dengan bukti visual.\n' ||
    E'7. LAPORKAN beserta ALAMAT KATALOG CARBON yang sepadan, supaya pemilik produk bisa\n' ||
    E'   membandingkan berdampingan -- aturan yang lahir dari temuan ini sendiri.',
    E'=== ASAL TEMUAN ===\n' ||
    E'Pemilik produk meletakkan tangkapan layar katalog Carbon resmi BERDAMPINGAN dengan\n' ||
    E'halaman /register kita, lalu melihat keduanya sekaligus. Empat penyimpangan dilaporkan.\n\n' ||
    E'=== STATUS: BUKAN PENYIMPANGAN, MELAINKAN LAYAR YANG BELUM DIMIGRASIKAN ===\n' ||
    E'Diperiksa: RegisterPage.tsx mengimpor NOL komponen Carbon. CSS Carbon sengaja dibatasi ke\n' ||
    E'cabang rute /company/setelan saja (keputusan DS-1 yang benar). Jadi /register tidak\n' ||
    E'MENYIMPANG dari Carbon -- ia belum pernah memakainya. Dari 39 layar, BARU SATU yang Carbon.\n\n' ||
    E'=== KEEMPAT LAPORAN, DIPERIKSA SATU PER SATU DARI CSS HASIL BUILD ===\n\n' ||
    E'(a) SUDUT MEMBULAT PADA FIELD AKTIF -> SUDAH TERATASI, bukan oleh perbaikan khusus\n' ||
    E'    halaman ini melainkan oleh perbaikan akar radius (commit 161b462, beberapa menit\n' ||
    E'    sebelum laporan masuk). Diukur dari peramban: border-radius 0px pada field yang\n' ||
    E'    sedang fokus. Diperiksa juga di situs yang dilihat pemilik produk: .rounded-3xl\n' ||
    E'    sudah memancarkan 0. Yang dilihat pemilik produk kemungkinan versi sebelum deploy.\n\n' ||
    E'(b) KARTU BERBINGKAI BERSUDUT MEMBULAT -> sudutnya SUDAH 0px. TAPI ada penyimpangan lain\n' ||
    E'    yang tersisa dan belum dilaporkan: kartunya berbingkai 1px #e0e0e0, sedangkan Tile\n' ||
    E'    Carbon TIDAK PUNYA BINGKAI sama sekali (.cds--tile: background-color var(--cds-layer),\n' ||
    E'    nol border). Jadi separuh laporan (b) sudah selesai, separuhnya masih berdiri.\n\n' ||
    E'(c) TOMBOL MELEBAR PENUH DENGAN TEKS DI TENGAH -> BENAR, PENYIMPANGAN NYATA.\n' ||
    E'    Diukur .cds--btn dari CSS hasil build:\n' ||
    E'        inline-size: max-content | max-inline-size: 20rem\n' ||
    E'        justify-content: space-between | text-align: start\n' ||
    E'    Tombol "Daftar" kita: lebar 350px penuh, justify-content center, text-align center.\n' ||
    E'    Menyimpang pada DUA hal sekaligus: perilaku lebar DAN perataan teks.\n\n' ||
    E'(d) KETEBALAN GARIS BAWAH FIELD -> pengamatannya benar, tapi bukan pada bagian yang\n' ||
    E'    diduga. Garis bawah keadaan DIAM justru SUDAH PERSIS Carbon: 1px solid #8d8d8d,\n' ||
    E'    sama dengan border-block-end: 1px solid var(--cds-border-strong) di g10.\n' ||
    E'    Yang BERBEDA adalah penanda FOKUS: kita memakai outline 3px #161616 (hitam),\n' ||
    E'    Carbon memakai outline 2px solid var(--cds-focus, #0f62fe) -- lebih tipis DAN biru,\n' ||
    E'    bukan hitam. Itulah yang membuat garisnya terlihat lebih tebal saat field disentuh.\n\n' ||
    E'=== LAYAR LAIN YANG DIPERIKSA ATAS PERMINTAAN (jangan diperbaiki dulu) ===\n' ||
    E'/login  : penyimpangan IDENTIK dengan /register -- field fokus outline 3px hitam, tombol\n' ||
    E'          "Masuk" 350px penuh rata tengah, kartu berbingkai 1px #e0e0e0. 10 warna heks\n' ||
    E'          ditulis tangan. NOL komponen Carbon.\n' ||
    E'/pod/[token] : NOL komponen Carbon, 3 elemen HTML mentah, 2 warna heks ditulis tangan.\n' ||
    E'          Tidak bisa diukur di peramban tanpa token sah -- diperiksa dari kode.\n\n' ||
    E'=== KENAPA TIDAK DITAMBAL SEKARANG ===\n' ||
    E'Menimpa CSS di /register akan menghasilkan layar SETENGAH-CARBON, dan itu persis kelas\n' ||
    E'cacat yang sedang diberantas: dua jalur hidup untuk hal yang sama. Layar ini masuk\n' ||
    E'antrean migrasi, bukan antrean tambalan.'
  );

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description,
                           effect_description, urgency, status, origin, pic, detail_pekerjaan, notes)
  values (
    v_company_id, 'DS-03',
    'Urutan Migrasi Carbon 38 Layar — Menunggu Keputusan Pemilik Produk',
    v_module, 'Design System',
    'Urutan pengerjaan migrasi Carbon untuk seluruh layar, disusun dari Design Debt Register '
    || 'dengan tiga pertimbangan: dilihat pihak luar, paling sering disentuh, dan murah dikerjakan.',
    'Menentukan layar mana yang lebih dulu terasa konsisten oleh pengguna dan calon pembeli.',
    'penting', 'menunggu', 'pemilik_produk', 'Claude Code + Pemilik Produk',
    E'Sodorkan urutan ke pemilik produk, tunggu keputusannya, lalu catat keputusan itu beserta\n' ||
    E'alasannya di task ini. Jangan mulai mengerjakan sebelum urutannya disetujui.',
    E'Urutan diusulkan, BELUM diputuskan. Ukuran "murah" memakai jumlah baris, jumlah elemen\n' ||
    E'HTML mentah, jumlah warna heks ditulis tangan, dan jumlah modal -- diukur dari kode.\n\n' ||
    E'GELOMBANG 1 -- DILIHAT PIHAK LUAR, DAN MURAH (kesan pertama produk):\n' ||
    E'  beranda 25 baris | undangan 85 | lupa sandi 77 | atur ulang sandi 162\n' ||
    E'  DAFTAR 117 | MASUK 141 | konfirmasi POD 188 | cetak surat jalan 113\n' ||
    E'  Alasan digabung: kedelapan layar ini memakai pola yang SAMA (satu kartu, beberapa\n' ||
    E'  field, satu tombol). Sekali cetakannya jadi, sisanya mengikuti hampir tanpa biaya.\n\n' ||
    E'GELOMBANG 2 -- SERING DISENTUH SEHARI-HARI, MENENGAH:\n' ||
    E'  dasbor 154 | KPI saya 158 | KPI 208 | apa yang baru 188 | absensi 365\n' ||
    E'  profil 352 | tim 370 | pelanggan 427 | kamus 465 | dokumen 413\n\n' ||
    E'GELOMBANG 3 -- LAYAR DATA BESAR (paling mahal, paling banyak modal & tabel):\n' ||
    E'  routing 686 | HR 720 | PO klien 750 | gudang 775 | BOM 820 | daftar tugas 844\n' ||
    E'  pengiriman 897 | produksi 956 | work order 1066 | ITEM 1102 | sales order 1107\n' ||
    E'  pembelian 1107 (11 modal) | PPIC 1611 (8 mentah, 5 hover, 7 modal)\n\n' ||
    E'CATATAN PENTING soal Master Item: DS-1 semula menetapkannya sebagai pilot (a). Diukur,\n' ||
    E'ia 1102 baris dengan 4 modal -- termasuk gelombang 3, bukan pilot murah. Usulan:\n' ||
    E'jadikan layar publik pilot ketiga yang cepat SEBELUM Master Item.'
  );

  raise notice 'DS-02 & DS-03 tercatat.';
end $$;
