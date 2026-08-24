-- MST-22 (audit penamaan field) + KMS-02 (Kamus Istilah Layar).
-- Keduanya lahir dari diagnosis pemilik produk 24 Agu 2026.

insert into build_tasks (
  company_id, task_code, name, module_code, module_name, description, effect_description,
  urgency, tags, pic, status, origin, detail_pekerjaan, notes
)
select 1, 'MST-22',
  'Audit Penamaan Field: Sapu Seluruh Form, Golongkan A/B/C',
  'MST', 'Master Data',
  'Formulir membingungkan karena dua sebab: (1) penamaan yang dipindahkan dari istilah Inggris tanpa diterjemahkan ke bahasa orang pabrik, dan (2) field yang diminta sistem tanpa diketahui gunanya.',
  'Pengguna berhenti mengisi field yang tidak dipahaminya, atau mengisinya asal — dan data asal jauh lebih berbahaya daripada data kosong, karena terlihat seperti data.',
  'penting',
  array['Teks/Bahasa','ui']::text[],
  'Claude Code',
  'menunggu',
  'pemilik_produk',
  E'SAPU SELURUH FIELD di semua form dan panel detail. Golongkan tiap field ke SATU dari tiga:\n' ||
  E'  A. DIPAKAI, NAMA BURUK -> ganti nama\n' ||
  E'  B. DIPAKAI, NAMA WAJAR TAPI KONSEP ASING -> helper text yang SELALU terlihat\n' ||
  E'  C. TIDAK DIPAKAI PERHITUNGAN APA PUN -> sembunyikan atau hapus\n\n' ||
  E'GOLONGAN C DITENTUKAN DENGAN MEMERIKSA KODE, bukan menebak: sebutkan nama fungsi yang ' ||
  E'memakainya, atau nyatakan tegas tidak ada yang memakai.\n\n' ||
  E'NUANSA WAJIB sebelum menghapus: "tidak dipakai perhitungan" TIDAK otomatis "tidak berguna". ' ||
  E'No. Registrasi BPOM dan Kode Halal juga nol perhitungan, tapi keduanya CATATAN KEPATUHAN yang ' ||
  E'justru diminta pemilik produk. Golongan C hanya untuk yang tidak dipakai perhitungan DAN tidak ' ||
  E'berguna sebagai catatan.\n\n' ||
  E'HASIL SAPUAN AWAL untuk formulir Item (24 Agu 2026, sudah diperiksa di kode):\n' ||
  E'  GOLONGAN C: reorder_point (hanya diteruskan listStockSummary ke tampilan, nol perhitungan); ' ||
  E'reorder_qty (nol pemakai); shelf_life_days (lots.expiry_date SELALU diketik manual — tidak ada ' ||
  E'satu pun kode yang menghitungnya dari shelf_life_days).\n' ||
  E'  GOLONGAN A: uom_conversion_factor (dipakai createGoodsReceipt); min_stock_level (dipakai ' ||
  E'getDashboardSummary); standard_cost (dipakai computeStandardCostPerUnit, getMarginWatch).\n' ||
  E'  GOLONGAN B: base_uom, purchase_uom (dipakai createProductionBatch/createGoodsReceipt/pengiriman); ' ||
  E'bpom_registration_number, halal_certificate_number (catatan kepatuhan, bukan perhitungan).\n\n' ||
  E'USULAN NAMA dari arsitek — PERLU DIKONFIRMASI orang yang memakainya sehari-hari, JANGAN ' ||
  E'ditetapkan sepihak, dan disodorkan SEKALIGUS dalam satu daftar, bukan satu per satu:\n' ||
  E'  Reorder Point      -> Sisa Stok Pemicu Pembelian\n' ||
  E'  Reorder Qty        -> Jumlah Sekali Pesan\n' ||
  E'  Min Stock Level    -> Batas Stok Menipis\n' ||
  E'  Faktor Konversi    -> Isi per Satuan Beli\n' ||
  E'  Shelf Life         -> Masa Simpan\n' ||
  E'  Biaya Standar      -> Harga Patokan (pembanding)\n\n' ||
  E'BATAS: menambahkan ikon bantuan TIDAK menyelesaikan golongan C. Memberi penjelasan untuk field ' ||
  E'yang seharusnya tidak ada hanya menyembunyikan masalahnya.\n\n' ||
  E'JANGAN MEMBANGUN MEKANISME BARU: hasil sapuan A/B/C langsung jadi bahan pengisian Kamus (KMS-02).',
  'Prinsip penamaannya sudah dicatat di CLAUDE.md ("Prinsip Penamaan Field" dan "Rasa Bingung Pemilik Produk Adalah ALAT DETEKSI").'
where not exists (select 1 from build_tasks where task_code = 'MST-22' and company_id = 1);

insert into build_tasks (
  company_id, task_code, name, module_code, module_name, description, effect_description,
  urgency, tags, pic, status, origin, detail_pekerjaan, notes
)
select 1, 'KMS-02',
  'Kamus Istilah Layar: Setiap Label yang Muncul di Layar, Bukan Sekadar Kata Serapan',
  'KMS', 'Kamus',
  'Istilah di layar belum punya penjelasan "apa yang sebenarnya terjadi di baliknya" yang bisa dibaca orang pabrik. Kamus sudah ada dan sudah dirancang untuk ini, tapi baru 1 dari 402 istilah terjawab.',
  'Kamus menyimpan pemetaan istilah ke kolom database — itu FONDASI panel Asal-Usul dan seluruh Fase AI. Bila lengkap, sistem bisa menjawab "kenapa angkanya segini" dengan menunjuk sumbernya. Bila tidak, AI hanya bisa menebak.',
  'penting',
  array['Teks/Bahasa','Data']::text[],
  'Claude Code',
  'menunggu',
  'pemilik_produk',
  E'KOREKSI ARAH dari usulan awal, beserta alasannya: yang didaftar BUKAN kata serapan Inggris, ' ||
  E'melainkan SETIAP ISTILAH YANG MUNCUL DI LAYAR — serapan maupun tidak.\n' ||
  E'ALASAN: masalahnya bukan bahasa. "Biaya Standar" sudah berbahasa Indonesia penuh dan tetap ' ||
  E'ditanyakan artinya oleh pemilik produk. Yang membingungkan adalah istilah yang MENYEMBUNYIKAN ' ||
  E'CARA KERJANYA. Menerjemahkan "Reorder Point" jadi "Titik Pemesanan Ulang" menghasilkan terjemahan ' ||
  E'yang benar dan tetap tidak dimengerti siapa pun.\n\n' ||
  E'TIAP ISTILAH MENYIMPAN:\n' ||
  E'  a. Label yang tampil di layar\n' ||
  E'  b. Apa yang SEBENARNYA TERJADI di baliknya — satu kalimat bahasa manusia\n' ||
  E'  c. Kolom database sumbernya (SUDAH ada di rancangan Kamus: entity + field)\n' ||
  E'  d. SINONIM per departemen — istilah lain yang dipakai orang untuk hal yang sama\n' ||
  E'  e. Kesalahpahaman yang lazim, bila ada\n\n' ||
  E'HASIL ARKEOLOGI (24 Agu 2026):\n' ||
  E'  - kamus_terms SUDAH menyimpan pemetaan kolom (entity+field), prioritas, draf AI, jawaban, ' ||
  E'dan status konfirmasi. Yang BELUM ada kolomnya: LABEL DI LAYAR dan SINONIM per departemen — ' ||
  E'dua-duanya perlu ditambahkan ke tabel yang SUDAH ADA, bukan ke tabel baru.\n' ||
  E'  - Isi: 387 FIELD + 11 METRIC + 4 RELATION = 402 istilah, hanya 1 TERJAWAB, 0 DIKONFIRMASI.\n' ||
  E'  - Keenam istilah yang terbukti membingungkan SUDAH ADA barisnya (items.reorder_point, ' ||
  E'reorder_qty, min_stock_level, shelf_life_days, uom_conversion_factor, standard_cost) — ' ||
  E'semuanya berstatus DRAF_AI. standard_cost sudah prioritas 1, uom_conversion_factor prioritas 2, ' ||
  E'sisanya prioritas 5.\n' ||
  E'  - src/lib/glossary.ts BUKAN pesaing Kamus: berkas itu sendiri menyatakan Kamus adalah RUJUKAN ' ||
  E'dan label di glossary WAJIB sama persis dengan jawaban Kamus. Yang belum ada: penjaga otomatis ' ||
  E'yang MEMASTIKAN aturan itu ditaati. Selama belum ada, aturannya hidup di komentar saja.\n\n' ||
  E'CARA MENGISI — JANGAN SEKALIGUS. Kamus sudah punya antrean berprioritas, manfaatkan. Urutan: ' ||
  E'(1) enam istilah yang sudah TERBUKTI membingungkan, (2) istilah yang menyangkut UANG, (3) sisanya.\n\n' ||
  E'BATAS: JANGAN mengubah label apa pun sebelum jawabannya DIKONFIRMASI. Mekanisme konfirmasi sudah ' ||
  E'ada; jawaban berstatus "dijawab" saja belum boleh mengubah layar.',
  'Satu-istilah-untuk-semua-departemen sudah dicatat sebagai aturan di CLAUDE.md, termasuk alasannya (rapat lintas departemen dan laporan lintas perusahaan).'
where not exists (select 1 from build_tasks where task_code = 'KMS-02' and company_id = 1);
