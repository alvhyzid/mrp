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

## RINGKASAN — status 5 temuan pra-jalan (diperbarui setelah P1-P3 dikerjakan)

Baca ini dulu sebelum jalan kaki. **3 dari 5 sudah ditambal** (P1-P3, lihat HANDOFF.md bagian "Fase Produksi Nyata — P1/P2/P3") — SILAKAN VERIFIKASI ULANG lewat jalan kaki, jangan asumsikan otomatis benar hanya karena tertulis "sudah ditambal" di sini:

1. ~~"Selesaikan Batch" — TIDAK ADA tombolnya sama sekali.~~ **SUDAH ADA (P1).** Tombol "Mulai Batch"/"Selesaikan Batch" di halaman Produksi, lewat state machine yang sudah ada di database (bukan bikin baru) — batch dengan log tahap belum lengkap TETAP boleh diselesaikan (tercatat sebagai pengecualian K8, tidak menghalangi status). Tolong dicoba langsung: pilih 1 batch, klik Mulai lalu Selesaikan, cek status berubah dan pesan yang muncul.
2. ~~"Lihat jadwal HARI INI" untuk SPV/operator — kemungkinan tidak ada.~~ **SUDAH ADA (P3).** Card baru "Jadwal Hari Ini" di paling atas halaman Produksi — daftar batch dijadwalkan hari ini/masih berjalan, difilter ke plant operator itu sendiri (operator Karanglo tidak melihat batch Ruko Dieng), dengan tombol aksi langsung (Mulai/Selesaikan/Catat Tahap). Tolong dicek: apakah pemetaan "operator ini di plant mana" sudah benar untuk SEMUA staf produksi sungguhan (bergantung data karyawan `linked_user_id` + `production_plant_id` sudah terisi benar).
3. ~~"Kekurangan bahan" untuk Purchasing — tidak pernah dirender.~~ **SUDAH ADA (P2).** Tombol "Cek Kelayakan" per baris di halaman Sales Order (bisa diakses PPIC/Purchasing/leadership) — menampilkan kebutuhan batch, kapasitas, feasible/tidak, DAN daftar kekurangan bahan lengkap (termasuk kasus "stok ada tapi tidak cukup" seperti Maltodextrin). Tolong dicek dari sisi Purchasing: apakah informasi ini cukup untuk memutuskan PO tanpa bantuan tambahan.
4. **"Opname harian" — staf gudang BIASA (bukan manager) tidak bisa mencatatnya.** MASIH BELUM ditambal — menunggu penilaian Anda dari jalan kaki (apakah opname harian di lapangan memang dilakukan staf biasa atau manager). Fitur "Penyesuaian Stok Manual" (satu-satunya jalur opname) dibatasi ke `warehouse_manager` ke atas.
5. **"Catat downtime/gangguan" — ADA fiturnya**, tapi kategorinya (Mesin Rusak/Listrik Padam/Faktor Eksternal/Dialihkan/Lainnya) perlu dicek cocok atau tidak dengan kondisi lapangan — MASIH BELUM ditambal, menunggu penilaian Anda.

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
| 1 | Lihat jadwal/pekerjaan HARI INI (bukan semua WO sepanjang waktu) | | | | [SUDAH DITAMBAL P3: card "Jadwal Hari Ini" di paling atas halaman Produksi, difilter ke plant operator — cek pemetaan plant-nya benar] |
| 2 | Tandai 1 batch "Mulai" (transisi ke Berjalan) | | | | [SUDAH DITAMBAL P1: tombol "Mulai Batch" di halaman Produksi (juga muncul di card Jadwal Hari Ini)] |
| 3 | Assign/lihat operator yang ditugaskan ke batch tersebut | | | | |
| 4 | Pantau progres tahap operator (tanpa mencatat sendiri) | | | | |
| 5 | Tandai 1 batch "Selesai" setelah semua tahap selesai | | | | [SUDAH DITAMBAL P1: tombol "Selesaikan Batch" — otomatis juga mengajukan batch sebagai sampel standar K8 kalau log tahapnya lengkap] |
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
| 6 | Cek kelayakan jadwal (feasibility) untuk 1 baris Sales Order — apakah bisa dikirim tepat waktu | | | | [SUDAH DITAMBAL P2: tombol "Cek Kelayakan" di halaman Sales Order, termasuk daftar kekurangan bahan lengkap] |
| 7 | Approve/reject 1 PO Client yang menunggu approval PPIC | | | | [SUDAH DICEK KODE: ADA — card approval PO Client] |
| 8 | Lihat usulan standar produksi (K8) yang menunggu keputusan, sahkan/tolak salah satu | | | | [SUDAH DICEK KODE: ADA — card baru "Usulan Standar Produksi Menunggu Keputusan" (dibangun sesi ini)] |

---

## PERAN: PURCHASING

Login sebagai akun Purchasing (role purchasing_manager/purchasing_staff) — halaman: `/purchasing`.

| # | Langkah | Bisa lewat UI? | Waktu | Bantuan teknis? | Catatan |
|---|---|---|---|---|---|
| 1 | Temukan bahan apa saja yang kurang untuk order yang akan datang, TANPA diberi tahu dari luar sistem | | | | [SUDAH DITAMBAL P2: tombol "Cek Kelayakan" di halaman Sales Order (Purchasing sekarang punya akses) — coba dari sudut pandang Purchasing: cukup jelas untuk memutuskan PO tanpa bantuan tambahan?] |
| 2 | Buat PO baru ke 1 supplier untuk bahan yang kurang, isi tanggal perkiraan datang (ETA) | | | | [SUDAH DICEK KODE: ADA — tombol "Buat PO Baru", field "Perkiraan Datang"] |
| 3 | Lihat status PO yang belum datang (tracking kedatangan) | | | | [SUDAH DICEK KODE: ADA — kolom "Perkiraan Datang" + status di daftar PO] |
| 4 | Terima notifikasi kalau PO terlambat dari ETA | | | | [SUDAH DICEK KODE: ADA jenis alert `po_delayed` di Bell notifikasi — cek benar muncul saat PO lewat ETA] |
| 5 | Daftarkan supplier baru | | | | [SUDAH DICEK KODE: ADA — form "Tambah Supplier"] |

---

## Setelah selesai

Isian tabel di atas (kolom Bisa-lewat-UI/Waktu/Bantuan-teknis/Catatan) inilah yang jadi bahan B-3 (tutup blocker). Fokus HANYA pada langkah yang benar-benar blocker (tidak bisa sama sekali, atau >3 menit, atau butuh bantuan teknis) — penyempurnaan kosmetik (sorting kolom, dst.) sengaja TIDAK termasuk kecuali muncul sebagai blocker nyata di sini.
