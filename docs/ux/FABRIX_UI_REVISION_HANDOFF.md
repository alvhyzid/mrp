# FABRIX UI REVISION — HANDOFF

**27 Agustus 2026 · HEAD sebelum batch `c39c6bf` · branch `main`**

> Dokumen ini ditulis supaya seseorang yang **tidak mengikuti percakapan sama sekali** bisa
> langsung melanjutkan tanpa bertanya ulang. Rencana lengkapnya di
> `docs/ux/FABRIX_UI_REVISION_MASTER_PLAN.md`.

---

## KEADAAN SAAT INI

FABRIX punya **39 halaman**, seluruhnya bisa dibuka dan seluruhnya **lulus uji responsif**
(174 pengukuran, 29 halaman × 6 lebar, nol gulir menyamping, nol elemen melewati tepi).

Yang tersisa **bukan** masalah tata letak. Yang tersisa adalah lima kelas cacat yang tidak
terlihat dari tangkapan layar: galat form yang tidak menempel ke field-nya, keadaan yang
tidak pernah dirender, elemen mentah non-Carbon, teks Inggris yang bocor ke layar, dan
primitif formulir Carbon yang nyaris tidak dipakai.

**UI Revision Completion: 0%** (0 dari 22 halaman dalam lingkup memenuhi Definition of Done).
Ini **berbeda** dari kelengkapan roadmap task, yang **35,2%** (114 dari 324). Jangan
tertukar: yang pertama mengukur halaman, yang kedua mengukur task.

---

## YANG SELESAI DI BATCH INI

Batch ini **AUDIT + PERENCANAAN**. Nol kode, nol CSS, nol API, nol basis data, nol migrasi,
nol task baru.

- Inventaris 39 rute, diverifikasi dari repositori
- Matriks kualitas 12 dimensi × 39 halaman → **300 cacat tercatat**
- Pengukuran responsif nyata: 174 pengukuran
- Cross-check Carbon dari paket terpasang
- Rekonsiliasi task terhadap 324 baris `build_tasks`
- Graf ketergantungan, gelombang prioritas, Definition of Done
- Dua dokumen: Master Plan dan handoff ini

---

## TEMUAN — YANG PALING PENTING DULU

### Dua P0, dan keduanya bukan soal tampilan

**`/hr`** — kartu "Hadir hari ini" **selalu menampilkan 0** untuk absensi yang dibuat sistem.
Penulisnya menulis status huruf besar, penyaringnya hanya mengenali huruf kecil, dan tidak
ada apa pun yang mengeluh. Angka utama dashboard HRD berbohong tanpa gejala.

**`/purchasing`** — penyimpanan supplier yang **berhasil** ditampilkan sebagai kotak merah
berjudul "Gagal", modalnya tidak ditutup, formulirnya dikosongkan. Ketiganya mengundang
pengisian ulang, dan tabel `suppliers` tidak punya kekangan unik pada nama — jadi pengisian
ulang benar-benar melahirkan supplier kedua. Supplier mengalir ke PO, harga acuan, dan lead
time perencanaan.

### Lima kelas cacat lintas halaman

| Kelas | Angka terukur |
|---|---|
| Galat form tidak menempel ke field | `invalidText` **5 dari 154** kontrol berlabel; `InlineNotification` **123** |
| Keadaan tidak dirender | **14 halaman**; gagal memuat terlihat seperti "belum ada data" |
| Elemen mentah non-Carbon | **22** catatan; `provenance-info-button` punya **17 pengimpor**, seluruhnya jalur Radix/Tailwind |
| Teks Inggris bocor ke layar | **11** catatan; pesan galat Supabase diteruskan mentah |
| Primitif formulir Carbon | `Form` 0 · `Stack` 0 · `Grid` 0 · `FormGroup` **2** |

### Delapan temuan governance

Ada di Master Plan bagian 18 (G-1 … G-8). Yang paling menggigit: `docs/00-GOVERNANCE/`
menetapkan kosakata status task yang **bertentangan** dengan kekangan basis data, dan
`design-debt.md` mencatat elemen mentah **jauh lebih buruk** daripada kenyataan
(26/27/25 tercatat, **11/5/4** terukur).

---

## KEPUTUSAN YANG DITUNGGU

Lima, seluruhnya milik pemilik produk. **Dua di antaranya memblokir hampir semua pekerjaan
formulir berikutnya.**

| # | Keputusan | Memblokir |
|---|---|---|
| **D-A** | Bentuk halaman formulir penuh: `Form`+`Stack`+`FormGroup` · `FluidForm` · atau `<form>` biasa | seluruh Wave 1–3 |
| **D-B** | Bentuk baris berulang: kartu label-tersembunyi · kartu label-diulang · tabel polos · `ContainedList` | BOM, Routing, PO Klien, Purchasing |
| **D-C** | Apakah 8 PROPOSED TASK didaftarkan | penjadwalan Wave 0 |
| **D-D** | Kosakata status task mana yang kanonik (G-1) | konsistensi dokumentasi |
| **D-E** | DS-09 dan DS-18 — persetujuan yang tertunda | Wave 1 |

Untuk D-A dan D-B, Master Plan bagian 8 memuat **tabel konsekuensi tiap pilihan**, diukur
dari paket Carbon terpasang. Carbon tidak menyatakan satu pun salah — karena itu keputusannya
bukan keputusan teknis.

---

## PENGHALANG

1. **D-A dan D-B belum diambil.** Mengerjakan layar formulir sebelum itu berarti menetapkan
   pola untuk seluruh sistem lewat satu halaman, tanpa keputusan.
2. **DS-09 dan DS-18** berstatus `menunggu_persetujuan`.
3. **Sepuluh halaman belum diukur responsifnya** (6 publik, POD, cetak, `/debug`,
   `/test-tenant`). Statusnya **UNKNOWN**, bukan lulus.

---

## PEKERJAAN BERIKUTNYA — URUTAN YANG DIREKOMENDASIKAN

1. **Ambil D-A dan D-B.** Keduanya memblokir lebih banyak daripada cacat mana pun.
2. **Kerjakan dua P0 secara paralel**: `/hr` dan `/purchasing`. Keduanya menyentuh arti angka
   dan integritas master data, jadi tidak perlu menunggu keputusan bentuk formulir.
3. **Baru pilot BOM** — alur BUAT BOM dari modal ke halaman penuh.

### Catatan wajib sebelum pilot BOM dimulai

Modal yang sama dipakai untuk **BUAT dan UBAH** — `startCreate` dan `startEdit` membuka
`isFormModalOpen` yang sama di `BomsPage.tsx`. Memindahkan hanya "buat" akan melahirkan
**dua jalur hidup untuk formulir yang sama**, kelas cacat yang sudah lima kali menggigit
proyek ini.

Jalan keluarnya: angkat formulirnya jadi **komponen bersama** yang dipakai halaman baru
**dan** modal ubah. Satu formulir, dua wadah.

Prasyaratnya sudah selesai: DS-17 (siklus hidup), DS-21 (penanda langkah responsif),
DS-22 (baris berulang responsif).

---

## JANGAN DISENTUH

- **T-1** — migrasi memakai **nama perusahaan yang dapat berubah** sebagai penanda pencarian.
  Nama perusahaan pernah diubah lewat Company Settings, sehingga pencarian berbasis nama
  dapat menjadi usang. **Jangan diperbaiki, jangan dibuatkan migrasi, jangan dibuatkan task.**
  Ini jalur teknis/governance terpisah.
- **`docs/00-GOVERNANCE/`** — sudah ada sebelum batch ini, belum terlacak git, **jangan
  ikut di-commit**.
- **FND-05** (simpan sementara formulir panjang) berstatus `ditunda_sadar` dengan pemicu
  tegas: *"ada formulir yang TERBUKTI tidak bisa diselesaikan satu duduk. Dugaan BUKAN
  pemicu."* **Jangan dibangun** sampai ada keluhan nyata.
- **Jangan membuat task baru** tanpa izin. Delapan usulan tercatat sebagai PROPOSED di
  Master Plan bagian 12.
- DS-06 · DS-20 · AUD-42 · MST-09 — tidak dikerjakan, tidak disentuh.

---

## HAL YANG MUDAH SALAH DIBACA

**"39 halaman" bukan 39 halaman aplikasi.** Ia mencakup 6 halaman publik, 1 halaman cetak,
1 halaman kurir, dan 2 halaman internal — **10 halaman yang kriterianya berbeda**.

**"Responsif lulus" hanya berlaku untuk 29 halaman shell.** Sepuluh sisanya UNKNOWN.

**"0% UI Revision Completion" bukan kemunduran.** Ia angka pertama yang pernah dihitung
untuk metrik ini, dan penyebutnya 22 — bukan 39 — dengan alasan yang ditulis di Master Plan
bagian 14.

**Metrik "target sentuh < 44px" sengaja dibuang** dari penilaian: angkanya mencampur kontrol
Carbon 40px (deviasi yang sudah diterima), elemen 1×1 khusus pembaca layar (cacat pengukur),
dan elemen mentah (temuan nyata).

---

## KEADAAN GIT

| | |
|---|---|
| HEAD sebelum batch | `c39c6bf` |
| Perubahan sumber | **nol** |
| Berkas baru | dua dokumen di `docs/ux/` |
| `docs/00-GOVERNANCE/` | tetap belum terlacak, **tidak ikut** |
| Push | **tidak** |
