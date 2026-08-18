# Checklist Audit Jalan Kaki — Fase Produksi Nyata (B-2)

**Untuk:** pemilik produk, dijalankan sendiri di **staging** sebagai tiap peran di bawah.
**Tujuan:** membuktikan (bukan menebak) langkah mana dari satu hari kerja penuh yang benar-benar bisa dilakukan lewat UI, dan mana yang jadi blocker nyata — hasilnya jadi daftar kerja B-3.

## Cara pakai
Untuk **setiap langkah**, isi 4 kolom sambil jalan:
- **Bisa lewat UI?** (Ya / Tidak / Sebagian)
- **Waktu** (menit — tandai kalau >3 menit)
- **Butuh bantuan teknis?** (Ya/Tidak)
- **Catatan** (apa yang terjadi, pesan error, dll.)

Langkah yang sudah ditandai **[SUDAH DICEK KODE: ...]** di bawah adalah temuan dari pengecekan kode langsung sebelum Anda mulai — bukan tebakan. Kalau ternyata di lapangan hasilnya beda dari catatan itu, tulis di kolom Catatan — itu juga temuan penting.

---

## RINGKASAN — 5 hal yang KEMUNGKINAN BESAR jadi blocker (dicek dari kode, bukan diperkirakan)

Baca ini dulu sebelum jalan kaki, supaya tidak buang waktu cari tombol yang memang belum ada:

1. **"Selesaikan Batch" — TIDAK ADA tombolnya sama sekali di UI manapun.** Kolom status batch (`production_batches.status`) tidak pernah diubah oleh kode aplikasi manapun — dicek langsung di kode, bukan ditebak. Yang BISA dicatat lewat UI adalah status per-TAHAP (Belum Mulai/Berjalan/Selesai) di halaman Produksi, bukan status batch itu sendiri. Batch akan tampil "Direncanakan" selamanya di badge status, walau semua tahapnya sudah "Selesai".
2. **"Lihat jadwal HARI INI" untuk SPV/operator Produksi — kemungkinan besar tidak ada tampilan yang benar-benar difilter per tanggal.** Halaman Gantt dengan tampilan Harian/Mingguan/Bulanan HANYA bisa diakses role PPIC (ppic_manager/ppic_staff) — role Produksi (production_manager/production_staff) tidak punya akses ke halaman itu sama sekali. Yang mereka lihat di halaman Produksi cuma daftar Work Order datar, tidak difilter "hari ini".
3. **"Kekurangan bahan" untuk Purchasing — fitur deteksi kelayakan/kekurangan bahan per Sales Order (yang dipakai sepanjang sesi analisis SAS001/SAS005) TIDAK PERNAH dirender di halaman manapun.** Ini murni endpoint API, belum ada tombol/halaman yang menampilkannya. Satu-satunya jalur "kekurangan bahan" yang benar-benar muncul di UI adalah notifikasi Bell (`material_shortage`) — dan itu HANYA muncul kalau sudah ada Work Order dibuat untuk item itu (bukan proaktif dari sekadar ada Sales Order).
4. **"Opname harian" — staf gudang BIASA (bukan manager) tidak bisa mencatatnya.** Fitur "Penyesuaian Stok Manual" (satu-satunya jalur opname) dibatasi ke `warehouse_manager` ke atas — `warehouse_staff` bisa LIHAT stok tapi tidak bisa mencatat penyesuaian. Kalau opname harian di pabrik biasanya dilakukan staf biasa, ini jadi blocker akses (bukan blocker teknis).
5. **"Catat downtime/gangguan" — ADA fiturnya** ("Catat Gangguan" di halaman Produksi, tipe: Mesin Rusak/Listrik Padam/Faktor Eksternal/Dialihkan/Lainnya), tapi dicek dulu apakah kategorinya cocok dengan jenis downtime yang biasa terjadi di pabrik — kalau tidak cocok, itu juga temuan (bukan berarti fiturnya tidak ada, tapi kategorinya kurang lengkap).

---

## PERAN: GUDANG

Login sebagai `warehouse.a@debug.mrp` (role warehouse_manager) — halaman: `/warehouse`.

| # | Langkah | Bisa lewat UI? | Waktu | Bantuan teknis? | Catatan |
|---|---|---|---|---|---|
| 1 | Buka daftar PO Supplier yang menunggu barang datang | | | | [SUDAH DICEK KODE: ADA — card "PO Supplier Menunggu Konfirmasi Datang"] |
| 2 | Klik "Terima Barang" pada satu PO, isi qty diterima per baris | | | | [SUDAH DICEK KODE: ADA — tombol "Terima Barang" per PO, expand baris] |
| 3 | Konfirmasi lot baru otomatis terbentuk dari penerimaan itu (cek di daftar lot/item) | | | | [SUDAH DICEK KODE: lot dibuat OTOMATIS oleh sistem saat barang diterima — bukan langkah manual terpisah, jadi cek hasilnya saja] |
| 4 | Pilih 1 Work Order/batch, catat pemakaian bahan (issue ke batch) — pilih lot by FEFO | | | | [SUDAH DICEK KODE: ADA di halaman Work Order ("Catat Pemakaian Bahan (komponen BOM) — per Batch"), BUKAN di halaman Gudang — cek apakah staf gudang biasanya juga login untuk buka halaman Work Order, atau ini jadi langkah "pindah halaman" yang tidak intuitif] |
| 5 | Lakukan opname harian (cocokkan stok fisik vs sistem untuk minimal 1 item) | | | | [SUDAH DICEK KODE: HANYA via "Penyesuaian Stok Manual", HANYA bisa oleh warehouse_manager (staf biasa TIDAK BISA) — coba juga sebagai warehouse_staff kalau ada akunnya, untuk konfirmasi blocker akses ini] |
| 6 | Cek riwayat pergerakan stok (stock movements) untuk 1 lot, pastikan alasan tercatat jelas | | | | |

---

## PERAN: PRODUKSI — SPV

Login sebagai akun SPV Produksi (role production_manager) — halaman: `/production`.

| # | Langkah | Bisa lewat UI? | Waktu | Bantuan teknis? | Catatan |
|---|---|---|---|---|---|
| 1 | Lihat jadwal/pekerjaan HARI INI (bukan semua WO sepanjang waktu) | | | | [SUDAH DICEK KODE: KEMUNGKINAN BESAR TIDAK ADA — halaman Produksi cuma daftar WO datar; Gantt Harian cuma bisa diakses PPIC] |
| 2 | Tandai 1 batch "Mulai" (transisi ke Berjalan) | | | | [SUDAH DICEK KODE: TIDAK ADA tombol ini — lihat Ringkasan poin 1] |
| 3 | Assign/lihat operator yang ditugaskan ke batch tersebut | | | | |
| 4 | Pantau progres tahap operator (tanpa mencatat sendiri) | | | | |
| 5 | Tandai 1 batch "Selesai" setelah semua tahap selesai | | | | [SUDAH DICEK KODE: TIDAK ADA tombol ini — lihat Ringkasan poin 1] |
| 6 | Lihat Ringkasan Yield batch yang baru selesai | | | | [SUDAH DICEK KODE: ADA — tombol "Ringkasan Yield Batch" di halaman PPIC (bukan di halaman Produksi) — cek apakah SPV Produksi bisa akses halaman PPIC untuk ini, karena role Produksi TIDAK ADA di daftar akses `/ppic`] |
| 7 | Catat gangguan produksi (downtime) untuk 1 work center | | | | [SUDAH DICEK KODE: ADA — "Catat Gangguan" di halaman Produksi] |
| 8 | Tandai gangguan itu selesai/resolved | | | | [SUDAH DICEK KODE: ADA] |

## PERAN: PRODUKSI — OPERATOR

Login sebagai akun operator (role production_staff) — halaman: `/production`.

| # | Langkah | Bisa lewat UI? | Waktu | Bantuan teknis? | Catatan |
|---|---|---|---|---|---|
| 1 | Lihat pekerjaan yang ditugaskan ke saya hari ini | | | | |
| 2 | Catat input & output untuk 1 tahap (misal: Mixing) — qty masuk, qty keluar, satuan | | | | [SUDAH DICEK KODE: ADA — form per-tahap di halaman Produksi, dengan saran jumlah otomatis dari tahap sebelumnya] |
| 3 | Tandai tahap itu "Selesai" | | | | [SUDAH DICEK KODE: ADA — ini status TAHAP, bukan status batch (lihat Ringkasan poin 1)] |
| 4 | Catat gangguan kecil (mis. mesin macet 10 menit) | | | | [SUDAH DICEK KODE: ADA, sama seperti SPV] |
| 5 | Setelah semua tahap selesai, catat hasil output batch (produk jadi + sisa reprocessable/waste) | | | | [SUDAH DICEK KODE: ADA — form catat output dengan pilihan tipe output] |
| 6 | Konfirmasi hasil output itu otomatis masuk ke stok (cek di halaman Gudang/Item) | | | | [SUDAH DICEK KODE: otomatis via sistem — lot baru dibuat begitu output dicatat] |

---

## PERAN: PPIC

Login sebagai `ppic.a@debug.mrp` (role ppic_manager) — halaman: `/ppic`.

| # | Langkah | Bisa lewat UI? | Waktu | Bantuan teknis? | Catatan |
|---|---|---|---|---|---|
| 1 | Buka Gantt Produksi, lihat progres batch minggu ini per Work Center | | | | [SUDAH DICEK KODE: ADA — 3 tampilan Harian/Mingguan/Bulanan] |
| 2 | Klik 1 blok batch di Gantt, lihat detail tahap + pekerja ditugaskan | | | | [SUDAH DICEK KODE: ADA] |
| 3 | Temukan 1 Work Order dengan status "Terhambat" (blocked) | | | | [SUDAH DICEK KODE: badge "Terhambat" ADA — tapi cek apakah dari badge itu jelas APA alasannya terhambat tanpa harus buka Bell notifikasi/tanya orang lain] |
| 4 | Cari tahu ALASAN batch itu terhambat (bahan? mesin? pekerja?) | | | | [SUDAH DICEK KODE: alasan ada di sistem (system_alerts per jenis: material/machine/worker readiness) tapi TIDAK ADA satu tempat yang menggabungkan "kenapa WO ini blocked" secara ringkas — kemungkinan perlu cek Bell notifikasi + buka detail WO terpisah] |
| 5 | Reschedule 1 batch berstatus "Direncanakan" (geser tanggal via drag) | | | | [SUDAH DICEK KODE: ADA — drag & drop di Gantt Mingguan, hanya untuk batch status "Direncanakan"] |
| 6 | Cek kelayakan jadwal (feasibility) untuk 1 baris Sales Order — apakah bisa dikirim tepat waktu | | | | [SUDAH DICEK KODE: TIDAK ADA di UI mana pun — lihat Ringkasan poin 3. Fitur ini nyata dan sudah dipakai sepanjang sesi analisis SAS001/SAS005, tapi murni lewat API, belum ada tombolnya] |
| 7 | Approve/reject 1 PO Client yang menunggu approval PPIC | | | | [SUDAH DICEK KODE: ADA — card approval PO Client] |
| 8 | Lihat usulan standar produksi (K8) yang menunggu keputusan, sahkan/tolak salah satu | | | | [SUDAH DICEK KODE: ADA — card baru "Usulan Standar Produksi Menunggu Keputusan" (dibangun sesi ini)] |

---

## PERAN: PURCHASING

Login sebagai akun Purchasing (role purchasing_manager/purchasing_staff) — halaman: `/purchasing`.

| # | Langkah | Bisa lewat UI? | Waktu | Bantuan teknis? | Catatan |
|---|---|---|---|---|---|
| 1 | Temukan bahan apa saja yang kurang untuk order yang akan datang, TANPA diberi tahu dari luar sistem | | | | [SUDAH DICEK KODE: TIDAK ADA tampilan proaktif untuk ini — lihat Ringkasan poin 3. Satu-satunya sinyal adalah Bell notifikasi `material_shortage`, dan itu HANYA muncul kalau sudah ada Work Order dibuat untuk item itu] |
| 2 | Buat PO baru ke 1 supplier untuk bahan yang kurang, isi tanggal perkiraan datang (ETA) | | | | [SUDAH DICEK KODE: ADA — tombol "Buat PO Baru", field "Perkiraan Datang"] |
| 3 | Lihat status PO yang belum datang (tracking kedatangan) | | | | [SUDAH DICEK KODE: ADA — kolom "Perkiraan Datang" + status di daftar PO] |
| 4 | Terima notifikasi kalau PO terlambat dari ETA | | | | [SUDAH DICEK KODE: ADA jenis alert `po_delayed` di Bell notifikasi — cek benar muncul saat PO lewat ETA] |
| 5 | Daftarkan supplier baru | | | | [SUDAH DICEK KODE: ADA — form "Tambah Supplier"] |

---

## Setelah selesai

Isian tabel di atas (kolom Bisa-lewat-UI/Waktu/Bantuan-teknis/Catatan) inilah yang jadi bahan B-3 (tutup blocker). Fokus HANYA pada langkah yang benar-benar blocker (tidak bisa sama sekali, atau >3 menit, atau butuh bantuan teknis) — penyempurnaan kosmetik (sorting kolom, dst.) sengaja TIDAK termasuk kecuali muncul sebagai blocker nyata di sini.
