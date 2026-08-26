-- Blok XX (26 Agu 2026): tiga modal panjang dipecah jadi langkah, plus dua temuan di luar
-- lingkup UI yang DICATAT dan TIDAK dikerjakan.
do $mig$
declare v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then return; end if;

  update build_tasks
     set detail_pekerjaan = detail_pekerjaan || chr(10) || concat_ws(chr(10),
       '',
       '=== TIGA MODAL PANJANG SELESAI, 26 Agu 2026 ===',
       '',
       'KOMPONEN BERSAMA DIBUAT LEBIH DULU: src/components/ui/modal-bertahap.tsx',
       '(PenandaLangkah + FooterBertahap). Cetakannya dibutuhkan EMPAT modal; menyalinnya',
       'empat kali akan melahirkan empat tempat yang harus ditemukan saat satu detail',
       'diperbaiki — kelas yang sudah lima kali menggigit di proyek ini. Modal PO klien ikut',
       'DIPINDAHKAN ke komponen itu, jadi tidak ada salinan yang tertinggal.',
       '',
       'KARYAWAN — TIGA langkah, BUKAN empat. Langkah keempat "Penggolongan biaya" DIHAPUS',
       'dari rencana setelah diperiksa: tabel `employees` TIDAK punya kolom penggolongan',
       '(diperiksa seluruh 21 kolomnya), dan formulirnya tidak punya isiannya. Membuat field',
       'baru bukan pekerjaan UI. Yang berlaku: Identitas / Gaji / Pajak & BPJS, dengan Tarif',
       'TER di Pajak sesuai keputusan.',
       '',
       'ITEM — tiga langkah: Identitas / Satuan / Persediaan. Nomor BPOM, kode halal, dan',
       'centang Aktif DINAIKKAN ke langkah pertama: ketiganya keterangan jati diri item, bukan',
       'aturan persediaan. Tanpa itu langkah ketiga harus berjudul dua hal sekaligus.',
       'DOKUMEN TIDAK masuk modal pembuatan — keputusan sadar: melampirkan berkas menuntut',
       'itemnya sudah ada untuk ditempeli. Tetap di panel Detail.',
       '',
       'BOM — DUA langkah: Resep / Komponen. "Buffer & status" tidak dipisah karena dua field',
       'itu tidak punya konteks sendiri (buffer menerangkan hasil standar, status menerangkan',
       'resepnya).',
       '',
       '=== DIUKUR DI PERAMBAN, ENAM LEBAR, KETIGANYA ===',
       '  360 -> 360px (100%)   672 -> 564px (84%)   768 -> 645px (84%)',
       ' 1280 -> 768px  (60%)  1440 -> 691px (48%)  1920 -> 922px (48%)',
       'Cocok PERSIS dengan tabel lebar Carbon untuk md. Kelas --three-button terpasang di',
       'ketiganya, tiap tombol 25% lebar modal. NOL gulir menyamping di 18 kombinasi.',
       'Jumlah langkah terbaca benar: karyawan 3, item 3, BOM 2.',
       '',
       'DISIMPAN SUNGGUHAN lewat layar di tenant uji, ketiganya berhasil:',
       '  "Karyawan baru ditambahkan" / "Item baru ditambahkan" / "BOM baru dibuat"',
       'Ketiganya lewat AreaNotifikasi, modalnya tertutup, nol galat.',
       '',
       'CACAT YANG SAMA DENGAN PO KLIEN DITEMUKAN DI KETIGANYA: pesan "berhasil" disetel ke',
       'formMessage TEPAT SEBELUM modalnya ditutup, jadi tidak pernah sempat terbaca. Dan BOM',
       'lebih buruk lagi — modalnya TIDAK ditutup sama sekali, hanya formnya dikosongkan,',
       'sehingga yang terlihat adalah formulir kosong tanpa keterangan apakah tersimpan.',
       'Ketiganya kini memberi tahu SEBELUM memuat ulang daftar.',
       '',
       'PEMBERSIHAN dibuktikan lewat POLA: nol "Karyawan Uji%", nol item "UJI-%", dan tenant',
       'uji kembali NOL (0 item, 0 karyawan, 0 BOM). Potret 91 tabel: 5 tabel berubah dan',
       'kembali seperti semula (employees 36->30 menyisakan 30 karyawan PT ITM yang nyata).'
     )
   where company_id = v_company_id and task_code = 'DS-18';

  -- ===== Temuan 7a: jawaban endpoint lebih sedikit daripada yang dibaca pemanggilnya =====
  perform pastikan_kode_task_kosong('AUD-48');

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description,
    effect_description, urgency, status, origin, pic, detail_pekerjaan, notes)
  values (v_company_id, 'AUD-48',
    'Endpoint Menjawab Lebih Sedikit daripada yang Dibaca Pemanggilnya — "Berhasil Tanpa Berlaku" di Lapisan API',
    'AUD', 'Audit Kualitas',
    concat_ws(chr(10),
      'POST /api/items hanya menjawab { success: true } — tidak mengembalikan data yang baru',
      'dibuat. Kode di layar membacanya sebagai `body.item.item_id`, lolos typecheck, terbaca',
      'meyakinkan, dan nilainya TIDAK PERNAH ADA.'),
    concat_ws(chr(10),
      'Fitur yang bergantung padanya diam-diam tidak bekerja. Tidak ada galat, tidak ada test',
      'merah, dan kodenya benar dibaca siapa pun. Yang menemukannya hanya mencoba alurnya',
      'dari ujung ke ujung.'),
    'penting', 'menunggu', 'temuan_claude', 'Claude Code',
    concat_ws(chr(10),
      'DITEMUKAN 26 Agu 2026 saat menambahkan "Produk baru" di modal PO klien: produk yang',
      'baru dibuat seharusnya langsung terpasang ke baris yang sedang diisi. Kodenya membaca',
      'id dari jawaban server; jawabannya tidak memuat id. Diperbaiki di sisi layar dengan',
      'mencocokkan KODE ITEM dari daftar yang diambil ulang.',
      '',
      'YANG HARUS DIKERJAKAN SAAT TASK INI TIBA GILIRANNYA — periksa KELASNYA, bukan satu',
      'kejadiannya: endpoint LAIN mana yang jawabannya lebih sedikit daripada yang dibaca',
      'pemanggilnya? Bentuk pemeriksaannya: untuk tiap `authedFetch(...)` di berkas halaman,',
      'bandingkan field yang dibaca dari `body` dengan yang benar-benar dikembalikan',
      'fungsi servernya.',
      '',
      'Ini kelas "berhasil tanpa berlaku" yang sudah tercatat di CLAUDE.md, kali ini di',
      'LAPISAN API — dan ia lebih licin daripada versi UI-nya, karena TypeScript pun tidak',
      'bisa menangkapnya: jawaban server bertipe any di titik itu.'),
    'Dicatat, TIDAK dikerjakan — di luar lingkup UI/UX giliran ini.');

  -- ===== Temuan 7b: aturan komentar diperkuat =====
  update build_tasks
     set detail_pekerjaan = detail_pekerjaan || chr(10) || concat_ws(chr(10),
       '',
       '=== DIPERKUAT 26 Agu 2026: komentar yang mengklaim sesuatu BEKERJA ===',
       'Aturan A.2 yang sudah ada mewajibkan komentar yang menyebut RISIKO juga menyebut',
       'batasnya. Ditambahkan pasangannya:',
       '',
       '  KOMENTAR YANG MENYATAKAN SEBUAH FITUR BEKERJA WAJIB MENYEBUT BAGAIMANA ITU',
       '  DIBUKTIKAN — atau tidak ditulis sama sekali.',
       '',
       'Kejadiannya 26 Agu 2026: komentar berbunyi "Langsung dipasang ke baris pertama yang',
       'itemnya masih kosong" di atas kode yang membaca nilai yang tidak pernah ada di',
       'jawaban server. Komentarnya ikut meyakinkan pembaca berikutnya bahwa hal itu sudah',
       'diperiksa — persis mekanisme "setengah sadar lebih berbahaya daripada tidak sadar"',
       'yang sudah tercatat.'
     )
   where company_id = v_company_id and task_code = 'AUD-42';
end
$mig$;
