-- Persetujuan pemilik produk 24 Agu 2026: catat enam keputusan yang menguap,
-- tutup MST-16/MST-17, perbaiki anomali tanggal.

-- ============================================================================
-- 1.d — MST-20: RANTAI HARGA EMPAT LAPIS. Jelaskan, jangan sembunyikan.
-- ============================================================================
update build_tasks
set name = 'Rantai Harga Empat Lapis: Jelaskan, Jangan Sembunyikan (+ Isian Biaya Standar ke Peran Finansial)',
    detail_pekerjaan =
      E'KEPUTUSAN PEMILIK PRODUK (24 Agu 2026) — pertanyaan "perjelas atau satukan" SUDAH DIJAWAB: ' ||
      E'JELASKAN, JANGAN SEMBUNYIKAN. Keempat angka memang berbeda dan semuanya sah; yang salah selama ' ||
      E'ini adalah tidak adanya penjelasan hubungan antar-keempatnya.\n\n' ||
      E'RANTAI HARGA EMPAT LAPIS, urut dari perkiraan ke kenyataan:\n' ||
      E'  1. HARGA PATOKAN (items.standard_cost) — angka pembanding yang ditetapkan sendiri.\n' ||
      E'  2. HARGA ACUAN SUPPLIER (supplier_item_prices.reference_price) — perkiraan dari pemasok, ' ||
      E'belum mengikat.\n' ||
      E'  3. HARGA DI PO (purchase_order_lines.unit_price) — yang benar-benar disepakati saat memesan.\n' ||
      E'  4. BIAYA LOT (lots.unit_cost) — yang benar-benar dibayar untuk barang yang benar-benar datang.\n\n' ||
      E'YANG DIKERJAKAN: tampilkan rantainya sebagai SATU rangkaian di panel Asal-Usul, dengan ' ||
      E'keterangan lapis mana yang sedang dipakai sebuah angka dan KENAPA. Bukan menyatukan keempatnya ' ||
      E'jadi satu kolom — menyatukan berarti membuang informasi tentang seberapa pasti angka itu.\n\n' ||
      E'ISIAN BIAYA STANDAR PINDAH KE PERAN FINANSIAL. Catatan hasil arkeologi 24 Agu 2026: saat ini ' ||
      E'MELIHAT dan MENGUBAH dijaga gerbang yang SAMA (canViewFinancialData = company_admin, ' ||
      E'general_manager, finance_manager). Artinya Admin Perusahaan bukan cuma melihat, tapi juga bisa ' ||
      E'mengubah. Keduanya perlu DIPISAH: tampilan boleh lebih luas, isian lebih sempit.',
    urgency = 'penting',
    notes = coalesce(notes,'') || E'\n\n24 Agu 2026 — DIJAWAB pemilik produk lewat arsitek. Penanda "MENUNGGU KEPUTUSAN" dicabut. Ditemukan lewat audit Daftar Tugas sebagai salah satu dari enam keputusan yang belum tercatat.'
where task_code = 'MST-20' and company_id = 1;

-- ============================================================================
-- 1.e — DOC-04: TIDAK ADA RETENSI. Ditutup.
-- ============================================================================
update build_tasks
set status = 'selesai',
    completed_at = now(),
    name = 'Kebijakan Retensi Dokumen: TIDAK ADA RETENSI — Disimpan Selamanya',
    detail_pekerjaan =
      E'KEPUTUSAN FINAL PEMILIK PRODUK (24 Agu 2026): TIDAK ADA RETENSI. Dokumen disimpan SELAMANYA, ' ||
      E'kecuali pengguna menghapusnya sendiri. TIDAK ADA penghapusan otomatis, tidak ada masa retensi, ' ||
      E'dan kolom retention_months TETAP KOSONG serta tidak dipakai.\n\n' ||
      E'ALASAN (wajib dicatat, karena inilah yang akan ditanyakan berbulan-bulan lagi): satu dokumen ' ||
      E'BAHAN BAKU dipakai di SETIAP pendaftaran BPOM produk yang memakai bahan itu. Selama bahannya ' ||
      E'masih dipakai berbagai produk, dokumennya tetap dibutuhkan — jadi tidak ada titik aman untuk ' ||
      E'menghapusnya secara otomatis.\n\n' ||
      E'AKIBAT UNTUK KODE: jangan pernah membangun penghapusan otomatis berbasis umur dokumen. ' ||
      E'Penghapusan hanya lewat tindakan pengguna yang eksplisit.',
    notes = coalesce(notes,'') || E'\n\n24 Agu 2026 — DIJAWAB dan DITUTUP. Pertanyaan a/b/c yang tercatat sebelumnya tidak lagi berlaku: jawabannya membatalkan seluruh konsep retensi, bukan menjawab berapa lama.'
where task_code = 'DOC-04' and company_id = 1;

-- ============================================================================
-- 1.f & 1.g & 1.h — tiga keputusan baru jadi task.
-- ============================================================================
insert into build_tasks (
  company_id, task_code, name, module_code, module_name, description, effect_description,
  urgency, tags, pic, status, origin, detail_pekerjaan, notes
)
select 1, d.kode, d.nama, d.mk, d.mn, d.deskripsi, d.efek, d.urgensi,
  d.tags, 'Claude Code', 'menunggu', 'pemilik_produk', d.detail, d.catatan
from (values
(
  'MST-23',
  'Versi Dokumen pada Item: Beberapa Dokumen Sejenis Adalah NORMAL',
  'MST', 'Master Data',
  'Satu item bisa punya beberapa dokumen berjenis sama (mis. COA 2025 dan COA 2026) sekaligus. Saat ini belum ada cara memisahkan periode berlakunya.',
  'COA kedaluwarsa TIDAK boleh dihapus — produksi tahun lalu memakainya, dan auditor BPOM akan menanyakannya. Yang dilakukan bukan menimpa, melainkan mengunggah yang terbaru berdampingan.',
  'penting',
  array['Data','ui']::text[],
  E'KEPUTUSAN PEMILIK PRODUK (24 Agu 2026), dengan contohnya sendiri: COA kedaluwarsa TIDAK dihapus ' ||
  E'karena produksi tahun lalu memakainya. Yang dilakukan: mengunggah COA terbaru BERDAMPINGAN.\n\n' ||
  E'a. Beberapa dokumen SEJENIS pada satu item adalah keadaan NORMAL, bukan duplikasi. JANGAN menolak, ' ||
  E'JANGAN menimpa.\n' ||
  E'b. TAMBAHKAN kolom "Berlaku Sejak" di samping "Berlaku Sampai" yang sudah ada. Tanpa tanggal ' ||
  E'mulai, dua COA yang periodenya tumpang tindih TIDAK BISA dipisahkan.\n' ||
  E'c. Daftar dokumen diurutkan dari yang TERBARU.\n' ||
  E'd. Yang kedaluwarsa TETAP TAMPIL dengan penanda — tidak disembunyikan.\n\n' ||
  E'ARKEOLOGI TERKAIT (sudah dikerjakan 24 Agu 2026, hasilnya dicatat di sini supaya tidak diulang): ' ||
  E'sistem BELUM bisa menjawab "batch yang diproduksi tanggal X memakai dokumen yang mana". Tidak ada ' ||
  E'satu pun kolom/tabel yang menautkan dokumen ke batch atau produksi; document_links hanya ditulis ' ||
  E'saat unggah dan tidak pernah dibaca dari sisi produksi. Telusur lot sudah menjawab separuhnya ' ||
  E'(batch -> lot -> item). Yang hilang adalah DIMENSI WAKTU dokumen — dan itulah yang dijawab kolom ' ||
  E'"Berlaku Sejak" di butir (b). Setelah kolom itu ada, pertanyaan auditor bisa dijawab lewat ' ||
  E'penalaran (dokumen mana yang berlaku pada tanggal batch), meski belum tercatat eksplisit.',
  'Ditemukan lewat audit Daftar Tugas 24 Agu 2026 sebagai keputusan yang belum tercatat.'
),
(
  'MST-24',
  'Jenis Dokumen "Lainnya" lewat PLT-05, dengan Penjaga Nama Mirip',
  'MST', 'Master Data',
  'Dropdown jenis dokumen hanya memuat jenis yang sudah terdaftar. Pengguna belum bisa menambah jenis baru saat dibutuhkan.',
  'Tanpa penjaga nama mirip, dalam enam bulan akan ada tiga jenis untuk hal yang sama ("Sertifikat Halal", "Sertifikat halal", "Sert. Halal") dan laporan kepatuhan jadi tidak bisa dijumlahkan.',
  'penting',
  array['Data','ui']::text[],
  E'KEPUTUSAN PEMILIK PRODUK (24 Agu 2026):\n' ||
  E'a. Pilihan bawaan tetap (COA, Sertifikat Halal, Izin Edar BPOM, dan jenis lain yang sudah ' ||
  E'terdaftar), DITAMBAH "Lainnya".\n' ||
  E'b. Memilih "Lainnya" membuka isian nama jenis baru.\n' ||
  E'c. INI BUKAN MEKANISME BARU — jenis dokumen SUDAH berupa daftar milik tenant (tabel ' ||
  E'document_types, 9 jenis terdaftar). Ini persis PLT-05. JANGAN membangun jalur kedua.\n' ||
  E'd. PENJAGA WAJIB: sebelum menyimpan jenis baru, periksa nama yang MIRIP dengan yang sudah ada dan ' ||
  E'tampilkan PERINGATAN — "Sertifikat Halal sudah ada, yakin ingin menambah Sertifikat halal?". ' ||
  E'PERINGATAN, BUKAN BLOKIR.\n' ||
  E'e. Jenis yang SUDAH DIPAKAI dokumen tidak bisa dihapus permanen — diarsipkan, mengikuti pola yang ' ||
  E'sudah ada di Supplier dan Routing.',
  'Ditemukan lewat audit Daftar Tugas 24 Agu 2026 sebagai keputusan yang belum tercatat. Kerjakan bersama PLT-05, jangan terpisah.'
),
(
  'GDG-07',
  'Tanggal Kedaluwarsa Lot: Dari KEMASAN SUPPLIER, Shelf Life sebagai PEMERIKSA',
  'GDG', 'Gudang',
  'Tanggal kedaluwarsa lot belum pernah diketik siapa pun karena datanya memang belum ada. Nanti diketik GUDANG saat menerima barang.',
  'Angka ini menentukan urutan FEFO dan keamanan produk. Bila sistem menghitungnya sendiri lalu berbeda dari yang tercetak di karung, SISTEM yang salah — dan orang akan berhenti mempercayai layar.',
  'penting',
  array['Data','Fungsi']::text[],
  E'KEPUTUSAN PEMILIK PRODUK (24 Agu 2026). Keadaan menguntungkan: belum ada satu pun lot, jadi tidak ' ||
  E'ada kebiasaan lama yang perlu diikuti — cara yang benar bisa ditetapkan sejak awal.\n\n' ||
  E'SUMBER ANGKA: dari KEMASAN SUPPLIER, BUKAN dihitung sistem. Alasan: kemasan itu yang dilihat ' ||
  E'auditor BPOM dan yang dilihat operator saat mengambil bahan dari rak.\n\n' ||
  E'PERAN SHELF LIFE: PEMERIKSA, bukan sumber angka.\n' ||
  E'  a. Saat gudang mengetik tanggal, sistem membandingkannya dengan tanggal terima + shelf_life_days.\n' ||
  E'  b. Bila selisihnya jauh menyimpang, TANYAKAN — jangan tolak. Contoh: "Masa simpan bahan ini ' ||
  E'biasanya 12 bulan, tanggal yang diisi menunjukkan 3 tahun. Sudah sesuai kemasan?"\n' ||
  E'  c. Selisih besar adalah tanda SALAH KETIK, bukan pelanggaran. Gudang tetap boleh melanjutkan.\n' ||
  E'  d. Bila item belum punya shelf_life_days: TIDAK ADA pemeriksaan. Jangan mengarang, jangan memaksa.\n' ||
  E'  SETELAH INI DIBANGUN, Shelf Life pindah dari golongan D ke A di MST-22.\n\n' ||
  E'LOT BOLEH TANPA TANGGAL. Gudang TIDAK dipaksa mengisi, TIDAK diminta menebak. Alasan: yang tahu ' ||
  E'tanggal kedaluwarsa adalah VENDOR, bukan gudang. Tanggal palsu LEBIH BERBAHAYA daripada kosong, ' ||
  E'karena FEFO akan mempercayainya.\n' ||
  E'  a. Penerimaan tanpa tanggal tetap BERHASIL, dengan keterangan jelas.\n' ||
  E'  b. DAFTAR YANG BERTAHAN, bukan pemberitahuan sesaat: "Lot Belum Punya Tanggal Kedaluwarsa" — ' ||
  E'lot mana, bahan apa, dari supplier mana, diterima kapan, sudah berapa lama menggantung. ALASAN: ' ||
  E'pemberitahuan yang muncul lalu hilang tidak akan berujung pada pertanyaan ke vendor.\n' ||
  E'  c. Terlihat GUDANG dan PURCHASING. Gudang mendorong, purchasing menanyakan ke vendor.\n' ||
  E'  d. Bila tanggalnya didapat belakangan, gudang mengisinya dan lot hilang dari daftar. Catat siapa ' ||
  E'mengisi dan kapan.\n' ||
  E'  e. TAMPILKAN JUMLAHNYA di tempat yang terlihat gudang setiap hari.\n\n' ||
  E'KEMASAN YANG HANYA MENCANTUMKAN TANGGAL PRODUKSI — siapkan sejak awal, mengubahnya nanti mahal:\n' ||
  E'  a. Sediakan pilihan mengisi TANGGAL PRODUKSI; sistem menghitung kedaluwarsa dari tanggal ' ||
  E'produksi + shelf_life_days.\n' ||
  E'  b. CATAT SUMBERNYA: tertera di kemasan, atau diturunkan dari tanggal produksi. Auditor perlu ' ||
  E'tahu mana yang tertera dan mana yang dihitung.\n' ||
  E'  c. Bila keduanya tidak ada DAN shelf_life_days kosong: biarkan kosong, masuk daftar. JANGAN ' ||
  E'mengisi angka apa pun.',
  'Ditemukan lewat audit Daftar Tugas 24 Agu 2026. Terkait GDG-06 (urutan FEFO untuk lot tanpa tanggal) yang masih menunggu keputusan.'
)
) as d(kode, nama, mk, mn, deskripsi, efek, urgensi, tags, detail, catatan)
where not exists (select 1 from build_tasks b where b.task_code = d.kode and b.company_id = 1);

-- ============================================================================
-- 3 — TUTUP MST-16 & MST-17 (selesai & ter-push di 81c0414, migrasi penutup terlewat)
-- ============================================================================
update build_tasks
set status = 'selesai',
    completed_at = now(),
    notes = coalesce(notes,'') || E'\n\n24 Agu 2026 — DITUTUP TERLAMBAT lewat audit Daftar Tugas. Pekerjaannya sudah selesai dan ter-push di commit 81c0414; migrasi penutupnya yang terlewat. Terbukti di kode: deleteOrDeactivateItem.ts, renderItemDetail, renderItemDocuments.'
where task_code in ('MST-16', 'MST-17') and company_id = 1;

-- ============================================================================
-- 4 — PERBAIKI ANOMALI TANGGAL MASA DEPAN
--
-- KPI-01 tercatat selesai 25 Agu padahal sekarang 24 Agu; KPI-02 tercatat dibuat 25 Agu.
-- Keduanya diketik manual di migrasi, bukan diambil dari jam sistem.
-- Diperbaiki ke now(), dan sengaja TIDAK ditebak mundur ke tanggal tertentu — yang bisa
-- dipertanggungjawabkan hanyalah "diperbaiki pada saat ini", bukan tanggal karangan lain.
-- ============================================================================
update build_tasks set completed_at = now(),
  notes = coalesce(notes,'') || E'\n\n24 Agu 2026 — completed_at diperbaiki: sebelumnya tertulis 25 Agu 2026 (sehari di MASA DEPAN) karena diketik manual. Sekarang diambil dari jam sistem.'
where task_code = 'KPI-01' and company_id = 1 and completed_at > now();

update build_tasks set created_at = now(),
  notes = coalesce(notes,'') || E'\n\n24 Agu 2026 — created_at diperbaiki: sebelumnya tertulis 25 Agu 2026 (masa depan) karena diketik manual.'
where task_code = 'KPI-02' and company_id = 1 and created_at > now();

-- ============================================================================
-- 3 (lanjutan) — TEMUAN: Daftar Tugas bisa meleset DUA ARAH.
-- ============================================================================
insert into build_tasks (
  company_id, task_code, name, module_code, module_name, description, effect_description,
  urgency, tags, pic, status, origin, detail_pekerjaan, notes
)
select 1, 'AUD-24',
  'Daftar Tugas Bisa Meleset DUA ARAH — Arah Kedua Tidak Ada yang Mengeluh',
  'AUD', 'Audit & Proses',
  'Status task bisa salah ke dua arah: menandai SELESAI yang belum selesai, DAN membiarkan yang SUDAH selesai terlihat menggantung.',
  'Arah kedua lebih halus dan lebih lama bertahan: tidak ada yang mengeluh karena tidak ada yang dirugikan seketika. Akibatnya angka kemajuan lebih rendah dari kenyataan, dan pekerjaan yang sudah beres bisa dikerjakan ulang.',
  'penting',
  array['proses','daftar-tugas']::text[],
  'Claude Code',
  'menunggu',
  'temuan_claude',
  E'KEJADIAN NYATA (24 Agu 2026): MST-16 dan MST-17 selesai dan ter-push di commit 81c0414, tapi ' ||
  E'statusnya tetap "menunggu" karena migrasi penutupnya terlewat. Ditemukan hanya karena pemilik ' ||
  E'produk meminta audit — bukan oleh mekanisme apa pun.\n\n' ||
  E'BANDINGKAN dengan AUD-14 (arah pertama: keputusan tidak sampai ke task). Keduanya bersumber sama: ' ||
  E'tidak ada yang mencocokkan Daftar Tugas dengan kenyataan.\n\n' ||
  E'PENGAMAN YANG DIUSULKAN: setiap commit yang menutup pekerjaan sebuah task WAJIB menyebut KODE ' ||
  E'TASK-nya di pesan commit. Dengan itu, "task berstatus selesai" dan "commit yang menyebut task itu" ' ||
  E'bisa dicocokkan otomatis, dan kedua arah kesalahan langsung kelihatan:\n' ||
  E'  - task selesai TANPA commit yang menyebutnya -> mungkin ditandai selesai padahal belum;\n' ||
  E'  - commit menyebut task yang statusnya masih menunggu -> mungkin lupa ditutup.\n\n' ||
  E'CATATAN JUJUR soal keterbatasannya: pengaman ini hanya bekerja bila kode task benar-benar ditulis ' ||
  E'di pesan commit. Ia mendeteksi kelalaian, tidak mencegahnya. Itu tetap jauh lebih baik daripada ' ||
  E'sekarang, di mana tidak ada yang mendeteksi sama sekali.',
  'Ditemukan lewat audit Daftar Tugas 24 Agu 2026 yang diminta pemilik produk.'
where not exists (select 1 from build_tasks where task_code = 'AUD-24' and company_id = 1);
