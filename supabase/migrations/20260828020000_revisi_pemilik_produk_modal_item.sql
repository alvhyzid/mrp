-- BAGIAN 2 (23 Agu 2026) -- revisi pemilik produk dari dokumen
-- "FABRIX PROJECT REVISI" (Google Drive, dibacakan arsitek; Claude Code
-- tidak bisa membacanya langsung). Seluruhnya origin='pemilik_produk'.
do $$
declare v_company_id integer;
begin
  select company_id into v_company_id from companies where name='PT ITM' limit 1;
  if v_company_id is null then raise notice 'PT ITM tidak ditemukan -- dilewati.'; return; end if;

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description, effect_description, urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes) values

  -- A. Modal Supplier -- jadi CETAKAN untuk seluruh modal lain
  (v_company_id,'PMB-11','Modal Supplier: Anatomi Carbon + Konfirmasi Sebelum Simpan (CETAKAN Modal)','PMB','Pembelian',
   'Modal tambah/buat Supplier terasa sempit dan tidak lega. Perlu mengikuti anatomi Carbon Design System sepenuhnya, memakai text field ukuran MEDIUM (40px), dan menampilkan ringkasan konfirmasi sebelum data benar-benar tersimpan.',
   'Modal ini jadi CETAKAN untuk seluruh modal lain di sistem -- bentuk header/footer/tombol/konfirmasi yang lahir di sini akan ditiru ke mana-mana. Bila dikerjakan belakangan, polanya lahir dua kali dan harus dirapikan ulang.',
   'mendesak', array['Visual','Fungsi'],'Claude Code','menunggu','/purchasing','pemilik_produk',
   E'A.1 Text field ukuran MEDIUM (40px) -- sudah jadi aturan tetap.\nA.2 Anatomi Carbon (rujukan https://carbondesignsystem.com/components/modal/usage/): HEADER (judul, label opsional, ikon tutup x) / BODY (isi & kontrol) / FOOTER (tombol aksi, LEBAR PENUH sesuai standar Carbon). Ikon x menutup TANPA menyimpan. Overlay menggelapkan isi halaman di belakang.\nA.3 Ukuran modal mengikuti panduan sizing Carbon, bukan lebar sembarang.\nA.4 KONFIRMASI SEBELUM SIMPAN: pembuatan data baru tidak langsung tersimpan -- tampilkan ringkasan draf lebih dulu, lalu konfirmasi. Pemilik produk menyebut kemungkinan memakai pola progress modal Carbon untuk proses bertahap -- NILAI dulu apakah cocok; bila tidak, cukup konfirmasi sederhana (keputusan teknis, catat alasannya).\n\nSETELAH TUNTAS: catat polanya di CLAUDE.md sebagai cetakan modal (anatomi, ukuran field, letak tombol, bunyi konfirmasi, nama komponen bersama yang dipakai) supaya modal berikutnya tinggal memakai.',
   'Dari pemilik produk (dokumen FABRIX PROJECT REVISI, bagian A). Dikerjakan LEBIH DULU sebelum revisi form Item -- ini cetakannya.'),

  -- B. Form Item
  (v_company_id,'MST-15','Form Item: Faktor Konversi Berpola + Ikon Bantuan Bersama + Kode Halal','MST','Master Data',
   'Tiga perbaikan form tambah item: (B.1) faktor konversi membingungkan -- sediakan pola umum sebagai pilihan cepat (mis. kg->gram) plus contoh, jangan hanya kolom angka kosong; (B.2) ikon tanda tanya kecil di setiap field yang butuh penjelasan, isinya bahasa manusia; (B.3) Kode Halal ditambahkan di sebelah No. Registrasi BPOM.',
   'Faktor konversi yang salah isi merusak seluruh perhitungan kebutuhan bahan dan HPP (kasus nyata: sachet/roll 3.333). Penjelasan di tempat mencegah salah isi jauh lebih murah daripada memperbaiki datanya belakangan.',
   'penting', array['Visual','Fungsi'],'Claude Code','menunggu','/items','pemilik_produk',
   E'B.2 IKON BANTUAN adalah POLA BERSAMA -- bangun SEKALI sebagai komponen di src/components/ui/, dipakai seluruh form. JANGAN disebar per komponen (kelas masalah yang sama dengan ProvenanceInfoButton yang sudah ada -- pertimbangkan apakah bisa memakai/memperluas komponen itu daripada membuat yang baru).\nB.1 Pola konversi umum sebagai pilihan cepat; angka bebas tetap boleh diisi manual.\nB.3 Kode Halal: kolom baru di items, di sebelah bpom_registration_number.\nSeluruh teks dari glossary; istilah baru masuk backlog Kamus; placeholder TIDAK memuat instruksi (instruksi ke helper text).',
   'Dari pemilik produk (dokumen FABRIX PROJECT REVISI, bagian B.1-B.3).'),

  (v_company_id,'MST-16','Halaman Detail Item: Ubah / Tambah Pemasok / Hapus (kolom Aksi jadi "Detail")','MST','Master Data',
   'Kolom Aksi di tabel item diganti jadi "Detail". Halaman/panel Detail berisi seluruh informasi bahan ditambah aksi: Ubah, Tambah Pemasok, dan Hapus. "Tambah Pemasok" DIPINDAH dari kolom aksi tabel ke dalam Detail. Fungsi hapus TIDAK ADA di tabel -- hanya di Detail.',
   'Kolom aksi yang menumpuk membuat tabel sesak dan aksi berbahaya (hapus) terlalu dekat dengan aksi sehari-hari. Memindahkannya ke Detail juga menyelesaikan kebutuhan responsive -- tabel jadi lebih ramping di layar sempit.',
   'penting', array['Visual','Fungsi'],'Claude Code','menunggu','/items','pemilik_produk',
   E'B.5/B.6. HAPUS memakai pola yang SUDAH JADI di Routing (deleteOrArchiveRouting.ts): belum dipakai -> Hapus permanen; sudah dipakai -> HANYA Arsipkan, dengan pesan penolakan yang MENYEBUT apa yang memakainya (jumlah BOM/lot/PO). Keputusan hapus-vs-arsip DIHITUNG SERVER (kembalikan can_delete per baris), bukan dipilih pengguna. Kolom arsip untuk items SUDAH ADA di skema (is_active) -- periksa dulu apakah cukup atau perlu archived_at/archived_by seperti Routing.',
   'Dari pemilik produk (dokumen FABRIX PROJECT REVISI, bagian B.5-B.6).'),

  (v_company_id,'MST-17','Unggah Dokumen pada Item (COA, Sertifikat Halal, BPOM) — OPSIONAL','MST','Master Data',
   'Item bisa dilampiri dokumen COA, Sertifikat Halal, dan BPOM. KETIGANYA OPSIONAL -- bukan wajib, item tetap bisa disimpan tanpa dokumen apa pun. Alasan pemilik produk: seluruh dokumen ini diminta saat proses pengurusan BPOM, jadi harus bisa dilampirkan.',
   'Tanpa ini, dokumen kepatuhan tersebar di luar sistem saat justru paling dibutuhkan (audit BPOM/halal), padahal mekanisme penyimpanannya sudah ada.',
   'penting', array['Fungsi','Visual'],'Claude Code','menunggu','/items','pemilik_produk',
   E'MANFAATKAN Master Dokumen MD-1 yang SUDAH ADA (kategori, kedaluwarsa, pengingat 90/60/30 hari) -- JANGAN bangun mekanisme unggah baru. Titik unggah baru WAJIB memanggil uploadFileWithMetadata (aturan tetap CLAUDE.md).\n\nPERIKSA DULU SEBELUM MEMBANGUN, laporkan hasilnya: apakah Storage bucket sudah ada di project ini dan policy-nya benar? INF-20 baru membuktikan hal semacam ini bisa TIDAK IKUT saat sistem dibangun dari migrasi (kasus Auth Hook). Jangan berasumsi bucket-nya ada.\n\nKAITAN INF-16: backup database TIDAK mencakup berkas Storage -- begitu dokumen sungguhan mulai diunggah lewat fitur ini, INF-16 berubah dari "belum berdampak" jadi berdampak nyata.',
   'Dari pemilik produk (dokumen FABRIX PROJECT REVISI, bagian B.4).'),

  -- C. Tiga hal yang TIDAK boleh dibangun apa adanya
  (v_company_id,'MST-18','Shelf Life: Isian Angka + Satuan (BUKAN Kategori) — MENUNGGU PERSETUJUAN','MST','Master Data',
   'Pemilik produk mengusulkan shelf life diganti dropdown kategori (Pendek 1-7 hari / Menengah 1 minggu-6 bulan / Panjang >6 bulan). ARSITEK KEBERATAN dan mengusulkan bentuk lain yang menyelesaikan keluhan yang sama tanpa kehilangan presisi.',
   'KEBERATAN: shelf life dipakai MENGHITUNG TANGGAL KEDALUWARSA LOT, dan tanggal kedaluwarsa adalah dasar FEFO (urutan pemakaian bahan). Kategori "1 minggu sampai 6 bulan" TIDAK BISA menghasilkan tanggal -- mengganti angka jadi kategori akan MEMATIKAN FEFO.',
   'penting', array['Visual','Database'],'Pemilik Produk','menunggu','/items','pemilik_produk',
   E'USULAN ARSITEK (menunggu persetujuan): tetap SIMPAN dalam HARI di database (shelf_life_days tidak berubah, FEFO tetap hidup), tapi ISIANNYA berupa angka + dropdown satuan (hari/minggu/bulan/tahun) yang dikonversi otomatis. Pengguna mengetik "6" lalu pilih "bulan" -> sistem menyimpan 180 hari. Keluhan "dipaksa menghitung dalam hari" hilang, presisi tetap.\n\nJANGAN dikerjakan sebelum pemilik produk membaca keberatan ini dan memutuskan.',
   'Dari pemilik produk (bagian C.1) + keberatan arsitek. MENUNGGU KEPUTUSAN.'),

  (v_company_id,'MST-19','Min Stock Level jadi Persen: Persen DARI APA? — MENUNGGU JAWABAN','MST','Master Data',
   'Pemilik produk mengusulkan min stock level diubah jadi PERSEN (isi 10 atau 20, sistem memberi notifikasi restock). ARSITEK tidak bisa membangunnya karena satu hal belum terjawab.',
   'Persen BUTUH PEMBANDING. Persen dari stok maksimum? dari kebutuhan sebulan? dari kapasitas gudang? TIDAK SATU PUN tersimpan di sistem saat ini -- tanpa pembanding, "10%" tidak bisa dihitung jadi angka kilogram, jadi notifikasinya tidak akan pernah bisa menyala.',
   'penting', array['Formula','Database'],'Pemilik Produk','menunggu','/items','pemilik_produk',
   E'PERTANYAAN untuk pemilik produk: 10% itu dari apa?\n\nUSULAN ARSITEK sebagai alternatif: ambang dihitung dari PEMAKAIAN NYATA -- mis. "beri tahu bila sisa stok kurang dari kebutuhan 2 minggu ke depan". Itu berarti sesuatu bagi orang gudang, dan DATANYA SUDAH ADA (BOM + jadwal produksi). Tapi ini keputusan pemilik produk, bukan keputusan teknis.\n\nARKEOLOGI (23 Agu 2026): min_stock_level SEKARANG BENAR-BENAR DIPAKAI -- getDashboardSummary.ts menjumlah stok lintas plant per item lalu membandingkannya ke min_stock_level untuk kartu "ITEM BAHAN DI BAWAH MIN. STOK" di Ringkasan. Jadi mengubah artinya jadi persen akan mengubah perilaku kartu itu juga.',
   'Dari pemilik produk (bagian C.2) + keberatan arsitek. MENUNGGU JAWABAN.'),

  (v_company_id,'MST-20','Biaya Standar vs Harga Acuan Supplier: Perjelas atau Satukan — MENUNGGU KEPUTUSAN','MST','Master Data',
   'Pemilik produk bingung karena ada DUA tempat mengisi harga (biaya standar di master item, dan harga acuan supplier) dan menanyakan bedanya. Kebingungan ini SAH dan menandakan rancangannya memang tumpang tindih di mata pengguna.',
   'Selama tidak jelas mana yang dipakai untuk apa, pengguna bisa mengisi salah satu saja dan mengira sudah benar -- lalu Margin Watch memakai angka yang tidak diniatkan, atau menolak mengunci baseline tanpa sebab yang dimengerti.',
   'penting', array['Formula','Visual'],'Pemilik Produk','menunggu','/items','pemilik_produk',
   E'ARKEOLOGI (23 Agu 2026, sudah dikerjakan): `items.standard_cost` BENAR-BENAR DIPAKAI dan bukan kolom mati -- ia sumber UTAMA biaya bahan standar per unit di computeStandardCostPerUnit.ts (dasar Margin Watch Lapis 1), dipakai juga di getMarginWatch, lockMarginBaseline, getSalesOrderMargin, listBoms, ItemsPage.\n\nHUBUNGAN KEDUANYA (sudah ada aturannya sejak Alur 1 butir 3.5): harga acuan supplier (supplier_item_prices.reference_price) dipakai HANYA sebagai CADANGAN untuk item yang standard_cost-nya kosong, dan HANYA untuk PREVIEW/perencanaan -- lockMarginBaseline MENOLAK mengunci baseline selama masih ada biaya yang berasal dari harga acuan. HPP sesungguhnya tetap dari lot hasil penerimaan barang (K5).\n\nJADI: keduanya TIDAK duplikat, tapi BEDANYA tidak pernah dijelaskan di layar -- itu akar kebingungannya. Kemungkinan perbaikan (perlu keputusan): (a) cukup perjelas lewat label + ikon bantuan (B.2) tanpa mengubah data; (b) sembunyikan biaya standar dari form item dan turunkan otomatis dari harga acuan/penerimaan; (c) biarkan keduanya tapi beri penanda jelas mana yang sedang dipakai sistem.\n\nPERTANYAAN TAMBAHAN pemilik produk (D.3): siapa yang menentukan harga -- gudang atau purchasing? Menurutnya purchasing yang mengerti harga. Ini kebijakan hak akses, WAJIB diputuskan pemilik produk.',
   'Dari pemilik produk (bagian C.3 & D.3) + arkeologi arsitek. MENUNGGU KEPUTUSAN.'),

  (v_company_id,'MST-21','Reorder Point & Reorder Qty: Dipakai atau Dihapus — MENUNGGU JAWABAN','MST','Master Data',
   'Pemilik produk tidak paham maksud Reorder Point, dan menanyakan siapa yang menentukan Reorder Qty serta berdasarkan apa (apakah MOQ supplier).',
   'Field yang tidak dimengerti DAN tidak dipakai sistem hanya menambah beban isi tanpa manfaat -- lebih baik dihapus daripada dijelaskan.',
   'bisa_menunggu', array['Visual','Data'],'Pemilik Produk','menunggu','/items','pemilik_produk',
   E'ARKEOLOGI (23 Agu 2026, sudah dikerjakan -- ini menjawab sebagian pertanyaannya):\n- `reorder_qty`: TIDAK DIPAKAI PERHITUNGAN APA PUN. Hanya disimpan, divalidasi, dan ditampilkan (itemValidation, listItems, ItemsPage). Nol logika bisnis. USULAN ARSITEK: hapus saja, daripada dijelaskan.\n- `reorder_point`: juga TIDAK dipakai perhitungan -- hanya di-select dan diteruskan ke tampilan (listStockSummary mengembalikannya apa adanya). Nol logika.\n- BEDA dengan `min_stock_level` yang BENAR-BENAR dipakai (kartu "di bawah min. stok" di Ringkasan).\n\nPERTANYAAN untuk pemilik produk: (D.1) setuju reorder_point dihapus, atau mau difungsikan? (D.2) reorder_qty -- siapa yang menentukan dan berdasarkan apa (MOQ supplier?), atau ikut dihapus?',
   'Dari pemilik produk (bagian D.1-D.2) + arkeologi arsitek. MENUNGGU JAWABAN.')

  on conflict (company_id, task_code) do nothing;
end $$;
