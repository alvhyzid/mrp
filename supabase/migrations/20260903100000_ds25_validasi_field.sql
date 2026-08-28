-- DS-25 — VALIDASI TINGKAT FIELD: galat muncul di tempat yang bisa diperbaiki penggunanya.
--
-- ==========================================================================================
-- KEPEMILIKAN ID
-- ==========================================================================================
-- DS-25 diperiksa terhadap empat syarat, bukan diambil dari skrip alokator saja:
--   1. tidak ada di build_tasks              -> registri memuat DS-01..DS-22 dan DS-24
--   2. tidak dicadangkan di register kanonik -> CANONICAL-ID-REGISTER-2026-08-27.md
--                                               mencadangkan TEPAT SATU nomor DS, yaitu DS-21
--                                               untuk F-01/F-11
--   3. tidak dipakai temuan lain             -> sepuluh temuan F-xx lain menunggu ID tanpa
--                                               nomor yang dicadangkan untuk mereka
--   4. tidak bertentangan dengan register    -> DS-23 tetap milik F-01/F-11, DS-24 milik
--                                               hierarki judul; DS-25 nomor bebas berikutnya
--
-- TASK INI ADALAH JAWABAN UNTUK TEMUAN F-03 di register (§4: "Field-level validation:
-- invalidText 5 files, required 6 files"). Register menandainya "NEW CANONICAL ID REQUIRED";
-- DS-25 adalah ID itu. Pencadangan DS-23 untuk F-01/F-11 TIDAK disentuh.
--
-- ==========================================================================================
-- KENAPA STATUSNYA SEDANG_DIKERJAKAN DAN BUKAN SELESAI
-- ==========================================================================================
-- Standar, penjaga, dan SATU pilot selesai serta terbukti. Lima puluh delapan modul server
-- lain masih mengirim galat golongan A tanpa menyebut field-nya. Menutup task ini sekarang
-- akan mencatat kelasnya beres padahal yang beres baru cetakannya.
--
-- Register kanonik menandai F-03 "Decision required: PARTIAL - YES": field mana yang WAJIB
-- DIISI secara bisnis dan kalimat penolakan apa yang dipakai adalah keputusan pemilik produk.
-- Task ini SENGAJA tidak menyentuh keduanya -- ia hanya memindahkan galat yang SUDAH ADA ke
-- tempat yang bisa ditindaklanjuti. Nol field baru ditandai wajib, nol kalimat pesan diubah.
--
-- HANYA SATU BARIS DIBUAT. Nol task lain disentuh, nol urgensi diubah, nol company_id literal.
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
      raise notice 'Basis data masih kosong -- migrasi DS-25 dilewati (no-op yang sah).';
      return;
    end if;
    raise exception 'Migrasi DS-25 tidak menemukan perusahaan pemilik registri task, padahal companies berisi % baris. Migrasi DIHENTIKAN supaya tidak berhasil tanpa berlaku.', v_jumlah_company;
  end if;

  perform pastikan_kode_task_kosong('DS-25');

  insert into build_tasks
    (company_id, task_code, name, module_code, module_name, description,
     effect_description, urgency, tags, pic, status, origin, detail_pekerjaan, notes, started_at)
  values (
    v_company_id, 'DS-25',
    'Validasi Tingkat Field: Galat Muncul di Tempat yang Bisa Diperbaiki Penggunanya',
    'DS', 'Design System',
    concat_ws(chr(10),
      'Formulir TAHU isian mana yang salah, tetapi menampilkannya sebagai satu kalimat di dasar',
      'formulir. Pada formulir besar dan pada baris berulang, pengguna harus mencari sendiri.',
      '',
      'Contoh terukur dari modal PO ke supplier: pesan "Jumlah pesan harus angka positif" pada',
      'PO lima baris tidak menyebut baris mana -- padahal validatornya tahu persis indeksnya,',
      'dan loop-nya membuang angka itu.'
    ),
    concat_ws(chr(10),
      'Pengguna membaca kalimat yang benar lalu tetap tidak tahu harus mengubah apa. Pada baris',
      'berulang ia harus memeriksa setiap baris satu per satu.',
      '',
      'Ada bentuk yang lebih buruk lagi dan sudah ditemukan di pilot: baris yang terisi separuh',
      'DIBUANG DIAM-DIAM sebelum dikirim. Pengguna memilih item lalu lupa jumlahnya, barisnya',
      'hilang dari PO, PO terbit tanpa baris itu, dan tidak ada satu pun pesan.'
    ),
    'penting',
    array['Visual','Fungsi'],
    'Claude Code', 'sedang_dikerjakan', 'temuan_claude',
    concat_ws(chr(10),
      'TEMUAN TERPENTING, dan ia MEMBATASI lingkup kelas ini:',
      '  455 dari 569 pesan validasi server (80 persen) MEMANG SEHARUSNYA di tingkat formulir.',
      'Izin, sesi, entitas tidak ditemukan, keadaan bisnis, penjaga parameter rute -- seluruhnya',
      'PASS. Menggantinya jadi invalidText akan MEMPERBURUK layar: menandai sebuah isian untuk',
      'galat yang tidak bisa diperbaiki dari isian itu membuat orang mengubah hal yang benar.',
      '',
      'YANG SALAH TEMPAT: 114 galat golongan A di 59 modul server (batas atas; penggolongan',
      'mengikat dilakukan per pesan).',
      '',
      'AKAR TUNGGAL, dan bukan "halaman lupa memakai invalidText":',
      'Jawaban server tidak pernah menyebutkan FIELD-nya sebagai data, hanya kalimat. Halaman',
      'karena itu TIDAK PUNYA CARA menandai kontrol yang benar -- bukan tidak mau, tidak bisa.',
      'Empat akibat turunannya: validator berhenti di galat pertama; galat baris kehilangan',
      'nomor barisnya; baris terisi separuh dibuang diam-diam; pemeriksaan klien menggabungkan',
      'dua isian jadi satu kalimat.',
      '',
      'KENAPA FIELD DIKIRIM SEBAGAI DATA DAN BUKAN DITEBAK DARI KALIMATNYA: mencocokkan teks',
      'adalah kelas "kebetulan benar" yang sudah empat kali menggigit proyek ini -- ia bekerja',
      'sampai seseorang memperbaiki satu kalimat, lalu galatnya pindah diam-diam ke kontrol',
      'yang salah, tanpa satu pun test berubah merah.',
      '',
      'STANDAR: docs/ux/FABRIX_FIELD_VALIDATION_CLASS_STANDARD.md.',
      'Satu pertanyaan menentukan segalanya: "bisakah pengguna memperbaikinya dengan mengubah',
      'SATU isian yang terlihat?" Bisa -> field. Tidak -> formulir. Empat golongan A/B/C/D.',
      '',
      'CARBON, diukur dari paket terpasang DAN dari DOM sungguhan -- TIGA mekanisme, bukan satu:',
      '  TextInput/PasswordInput -> aria-invalid=true + aria-errormessage',
      '  NumberInput             -> aria-invalid=true + aria-describedby',
      '  Dropdown/ComboBox       -> aria-invalid TIDAK DIPASANG, hanya aria-describedby',
      'Dokumen standar versi pertama menyatakan NumberInput memakai aria-errormessage bersama',
      'TextInput. KELIRU, dan koreksinya lahir dari MENJALANKAN, bukan membaca.'
    ),
    concat_ws(chr(10),
      'PILOT SELESAI 28 Agu 2026: modal "Buat PO" di /purchasing. Dipilih berdasarkan bukti --',
      'satu-satunya formulir yang memuat KEEMPAT golongan sekaligus plus baris berulang.',
      '',
      'TIGA BERKAS: purchaseOrderValidation.ts (hasil membawa field + line),',
      'createPurchaseOrder.ts (meneruskan keduanya, dan MENCARI indeks baris yang itemnya tidak',
      'sah alih-alih membiarkannya "salah satu baris"), PurchasingPage.tsx (poFieldError sebagai',
      'DAFTAR supaya seluruh isian salah ditandai sekaligus, lima kontrol menerima invalid +',
      'invalidText, notifikasi formulir digerbang, galat dibersihkan saat isian diubah / baris',
      'dihapus / modal dibuka / sebelum kirim ulang).',
      '',
      'NOL kalimat pesan diubah, NOL aturan bisnis, NOL field ditandai wajib, NOL halaman lain.',
      '',
      'PENJAGA: tests/validasi_field_purchase_order.test.ts, 8 uji, MERAH lebih dulu (5 gagal)',
      'lalu HIJAU, tiap penjaga dibuktikan MENGGIGIT. Mengukur PERILAKU, bukan jumlah',
      'invalidText. Tiga uji hijau sejak awal menjaga yang SUDAH benar -- pertahanan false',
      'positive dalam bentuk uji.',
      '',
      'BUKTI PERAMBAN: empat kasus (kirim kosong / baris separuh / server dengan field / server',
      'tanpa field) plus enam lebar 360-1920. Pesan tampil di keenamnya, nol terpotong, nol',
      'gulir menyamping, nol elemen melewati kedua tepi. NOL baris tertulis: non-GET diblokir,',
      'jawaban 400/403 disuntik sebagai fixture.',
      '',
      'SISA PEKERJAAN (kenapa task ini belum selesai):',
      '  T-V1 Dropdown/ComboBox Carbon tidak memancarkan aria-invalid -- menyentuh setiap',
      '       Dropdown di aplikasi, jadi tambalan sebagian akan melahirkan dua perilaku',
      '  T-V2 validator server masih berhenti di galat pertama',
      '  T-V3 58 modul server lain masih mengirim galat golongan A tanpa field',
      '  T-V4 belum ada penjaga yang memastikan nama field yang dikirim server benar-benar ada',
      '       di formulirnya -- WAJIB ditutup SEBELUM modul kedua, karena selama belum dijaga,',
      '       salah ketik nama akan membuat galatnya menghilang tanpa satu pun test merah',
      '  T-V5 fokus tidak berpindah ke field yang ditolak (sengaja, butuh keputusan a11y)'
    ),
    now()
  );

  raise notice 'DS-25 dibuat untuk company_id %.', v_company_id;
end $$;
