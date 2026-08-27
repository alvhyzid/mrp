# FABRIX FORM GOVERNANCE — DECISION RECORD

**STATUS: PROPOSED**
**Belum disetujui pemilik produk. Bukan kanonik. Jangan dirujuk sebagai aturan yang berlaku.**

**28 Agustus 2026 · HEAD `47f5307` · nol perubahan sumber**

---

## 1. MASALAH ASLINYA

Master Plan menetapkan dua keputusan sebagai **ketergantungan terbesar** — lebih besar
daripada cacat mana pun, karena keduanya menentukan bentuk **setiap** layar formulir
berikutnya:

- **D-A** — bentuk halaman formulir penuh
- **D-B** — bentuk baris berulang

Selama keduanya belum diambil, setiap layar formulir yang dikerjakan berisiko dikerjakan
ulang.

---

## 2. BUKTI YANG DIPAKAI

Seluruhnya dari paket terpasang, dari kode repositori, atau dari pengukuran peramban.

| Bukti | Angka | Cara |
|---|---|---|
| `.cds--form` punya aturan CSS | **NOL** | menjalankan mixin `form.form()` + menyisir CSS hasil build |
| `<Stack>` punya media query | **NOL** | paket |
| `<Stack>` mendukung multi-kolom | **TIDAK** | paket |
| Carbon membatasi lebar field | **TIDAK** — nol `max-width` pada `.cds--form-item`, `.cds--text-input`, `.cds--select`, `.cds--label` | CSS hasil build |
| Komponen yang membaca `FormContext` (mode fluid) | **17** | paket |
| `<Form>` / `<Stack>` / `<FluidForm>` dipakai FABRIX | **0 / 0 / 0** berkas | 468 berkas disisir, komentar dibuang |
| `<FormGroup>` dipakai | **1 berkas**, 2 tempat (`ItemsPage:1399`, `:1451`) | idem |
| `<form>` mentah | **7 berkas** | idem |
| `<Tile>` sebagai bentuk halaman formulir penuh | **1 berkas** (`SetelanPerhitunganPage`) | idem |
| `useNoInteractiveChildren` dipakai | **Tooltip · Notification · Tile(ExpandableTile)** — **bukan** ContainedList | paket |
| `hideLabel` menyisakan nama untuk pembaca layar | **YA** (`.cds--visually-hidden`, `clip: rect(0,0,0,0)`) | paket |
| `DataTable` mendukung sel yang bisa disunting | **TIDAK** | paket |
| **§6e-3 pada langkah Komponen BOM** | **8 klik diuji, NOL gagal** — isi meluber s/d 1436px | peramban, batch ini |
| Tinggi isi BOM langkah Komponen | 768px: 468→1380 · 360px: 704→2096 (1→4 komponen) | peramban |
| Baris berulang sesudah DS-22 | 36 pengukuran, 9 lebar → nol luber, nol kontrol < 200px | peramban |

---

## 3. ALTERNATIF YANG DIPERTIMBANGKAN — D-A

| Opsi | Putusan |
|---|---|
| A. `<Form>` + `<Stack>` + `<FormGroup>` | **DITOLAK** sebagai kerangka |
| B. `<FluidForm>` | **DITOLAK** |
| C. `<form>` biasa + kontrol Carbon lepas | **SEBAGIAN DIPAKAI** — pembungkus `<form>`-nya diambil |
| D. `<Tile>` + `<h2>` + kisi sendiri | **DIREKOMENDASIKAN**, dengan koreksi `<form>` |

### Kenapa A ditolak sebagai kerangka

`<Form>` memancarkan `.cds--form` yang **tidak punya satu pun aturan CSS**. Memakainya adalah
**upacara tanpa akibat** — dan upacara tanpa akibat lebih berbahaya daripada tidak memakainya,
karena pembaca berikutnya mengira ada yang mengatur jarak.

`<Stack>` tidak bisa jadi kerangka: nol media query, nol multi-kolom.

`<FormGroup>` **tetap dipakai**, tetapi sebagai **pengecualian untuk isian berpasangan** —
bukan sebagai pembungkus kelompok besar, karena legend-nya 12px `text-secondary` dan bukan
elemen heading.

### Kenapa B ditolak

`<FluidForm>` menyalakan MODE lewat React context yang dibaca **17 komponen**: label masuk ke
dalam kotak field dan **tempat pesan galat berpindah**. Nol pemakaian di FABRIX hari ini.
Mencampur fluid dan non-fluid menghasilkan **dua bentuk galat di satu layar**.

Bentuk risikonya persis kelas **"berhasil, lolos build, tidak berlaku"** yang sudah empat kali
menggigit proyek ini.

> **Batas kejujuran**: klaim bahwa label `<Select>` "lepas" di dalam mode fluid adalah
> **deduksi kaskade CSS**, bukan pengamatan di peramban. Aturannya terbukti ada; posisi
> piksel akhirnya **TIDAK TERUKUR**.

### Kenapa D direkomendasikan

Satu-satunya yang menjawab **keempat** kendala nyata sekaligus, dan tiga di antaranya tidak
dijawab opsi mana pun yang lain: kisi mengikuti lebar induk tanpa media query · `<h2>` memberi
struktur heading yang bisa dilompati pembaca layar · lebar halaman benar-benar dibatasi
(Carbon tidak membatasi apa pun) · seluruh jarak sudah lewat token.

Dan ia **sudah terbukti berjalan** — bukan usulan di atas kertas.

---

## 4. ALTERNATIF YANG DIPERTIMBANGKAN — D-B

| Opsi | Putusan | Alasan singkat |
|---|---|---|
| A. Kartu, label disembunyikan | **PENGECUALIAN** | Hemat 17–21% tinggi, tetapi di 360px kisinya satu kolom sehingga judul kolom kehilangan makna |
| B. Kartu, label diulang | **DIREKOMENDASIKAN** | Terukur bersih di 36 pengukuran; satu mekanisme |
| C. `<Table>` polos + kontrol di sel | **DITOLAK** | `DataTable` tidak mendukung sel yang disunting → menambal tabel = jalur hidup kedua |
| D. `ContainedList` + sunting lewat aksi | **DITOLAK** | Mengubah satu angka butuh membuka overlay |

---

## 5. KONSEKUENSI

### Bila D-A diterima

- Satu halaman perlu **satu koreksi**: `SetelanPerhitunganPage` diberi pembungkus `<form>`.
- Layar formulir penuh berikutnya punya cetakan yang bisa diikuti tanpa bertanya.
- FABRIX secara resmi menyatakan bentuk formulir halamannya **deviasi beralasan**, bukan
  penerapan Carbon — dan itu dicatat di `design-debt.md`.

### Bila D-B diterima

- **Nol perubahan kode.** Bentuk B sudah terpasang, dan DS-22 sudah membuat kolomnya
  mengikuti lebar wadah.
- Bentuk A punya syarat masuk yang tegas dan **terukur**, bukan selera.

### Konsekuensi yang paling perlu disadari

**BOM tetap modal bertahap.** Itu **membalik** DECISION 6 di
`FABRIX_MODAL_FORM_GOVERNANCE_DECISION.md`, dan membatalkan dasar batch "BOM Create Full Page".

---

## 6. REKONSILIASI TERHADAP DOKUMEN YANG SUDAH ADA

**Master Plan TIDAK diubah.** Koreksinya dicatat di sini.

| # | Yang tertulis sebelumnya | Yang benar | Sumber |
|---|---|---|---|
| R-1 | Master Plan §8: `ContainedList` *"satu-satunya bentuk yang tidak melanggar larangan children tidak boleh interaktif"* | **KELIRU.** Larangan itu milik **Tooltip, Notification, dan ExpandableTile** — bukan ContainedList | paket |
| R-2 | Master Plan menamai **BOM** sebagai pilot halaman penuh | **BERUBAH.** §6e-2 **BERLAKU** dan menyatakan formulir panjang dipecah jadi langkah, bukan halaman penuh; BOM tidak bercabang | `cetakan-halaman-data.md` §6e-2 |
| R-3 | `MODAL_FORM_GOVERNANCE_DECISION.md`: *"pengukuran §6e-3 belum saya lakukan"* | **SUDAH DIUKUR.** 8 klik, nol gagal — §6e-3 **tidak berlaku** pada langkah Komponen BOM | peramban, batch ini |
| R-4 | Master Plan tidak menyebut korpus `docs/FABRIX-Carbon-UX-Governance/` sama sekali | **KELALAIAN SAYA.** Korpus itu terlacak git sejak 27 Agu 01:35 dan memuat audit AS-IS lain, rekonsiliasi, dan register ID kanonik | git |

### R-5 — TABRAKAN KODE TASK `DS-21`

`CANONICAL-ID-REGISTER-2026-08-27.md` §4 **mencadangkan `DS-21`** untuk temuan F-01/F-11
(*"Parallel token system: `app/globals.css`, `tailwind.config.ts`, 181 pemakaian / 17 berkas"*),
berstatus *"not created — Product owner to authorise"*.

Register itu masuk repositori **27 Agu 01:35**. Saya membuat `DS-21` untuk cacat indikator
langkah pada **27 Agu 21:22** — **dua puluh jam sesudahnya**, tanpa membaca register itu.
**Itu kelalaian saya, bukan balapan waktu.**

Akibatnya, apa adanya:
- `DS-21` di `build_tasks` = indikator langkah meluber (selesai)
- `DS-22` = kolom baris komponen BOM (selesai)
- Temuan F-01/F-11 **kehilangan ID** dan tetap tidak tercatat
- Baris §4 register itu **usang**

**Tidak ada data yang rusak** dan tidak ada task yang tertimpa. Yang hilang adalah tempat
untuk F-01/F-11. Kode kosong berikutnya: **`DS-23`**.

**Batch ini TIDAK mengubah `build_tasks` dan TIDAK menyunting register itu** — keduanya
keputusan pemilik produk.

> Perlu dicatat juga bahwa status di register itu adalah **potret** pada commit `7ce6e3c`
> dan sudah bergeser: register menulis `DS-17` *menunggu* dan `DS-14` *menunggu*, sedangkan
> basis data hari ini menulis keduanya **selesai**; `AUD-47` tertulis *menunggu*, basis data
> menulis **dibatalkan**. Itu wajar untuk potret bertanggal — disebut supaya tidak dibaca
> sebagai keadaan sekarang.

---

## 7. REKONSILIASI TASK (Phase 11 — nol perubahan)

| Keputusan / pekerjaan | Task terkait | Klasifikasi |
|---|---|---|
| **D-A** | `DS-18` (ukuran modal & jumlah kolom) | **DECISION REQUIRED** — `menunggu_persetujuan` |
| **D-A** | `DS-09` (Carbon ke seluruh halaman) | **DECISION REQUIRED** — `menunggu_persetujuan` |
| **D-B** | `DS-22` (kolom ikut lebar wadah) | **DONE** |
| **D-B** | `DS-19` (papan Gantt) | **OPEN** — `sedang_dikerjakan`, tidak memblokir |
| BOM | `DS-17` siklus hidup · `DS-21` penanda langkah · `DS-22` baris | **DONE** |
| BOM | — | **PROPOSED**: tidak ada task yang memiliki "BOM create → halaman penuh"; dan menurut standar ini task itu **tidak diperlukan** |
| PO Klien | `PMB-08` (cabut form klien dari modal PO) | **OPEN** |
| PO Klien | — | **PROPOSED**: cabut dua kolom jadi satu kolom (§6e) |
| Master Item | `DS-05` · `MST-16` | **DONE** |
| Karyawan | — | **PROPOSED**: seragamkan ukuran kontrol; cabut galat-sebelum-mengetik |
| Konfirmasi merusak | `DS-06` vs `AUD-47` | **DUPLICATE** — CONFLICT-3 di register, keputusan pemilik produk |
| Elemen mentah | `DS-10` · `DS-20` | **OPEN** |
| F-01/F-11 token paralel | — | **PROPOSED**, kode kosong `DS-23` |

**Nol task dibuat, nol task diubah di batch ini.**

---

## 8. KONFLIK GOVERNANCE YANG TIDAK DISEMBUNYIKAN

| # | Konflik | Pihak |
|---|---|---|
| K-1 | Formulir panjang: keluar dari modal karena panjang **vs** panjang saja bukan alasan | `FABRIX_CARBON_DESIGN_GOVERNANCE.md` §20 ⟷ `cetakan-halaman-data.md` §6e-2 (**§6e-2 berperingkat lebih tinggi**) |
| K-2 | `DS-06` menyatakan `window.confirm` diganti **saat migrasi tiap halaman**; audit menyatakan sapu sekarang di P0 | CONFLICT-1 register |
| K-3 | Tiga rumah untuk keputusan mengikat: `CLAUDE.md`, `build_tasks`, dan `UX-YYYY-NNN` yang diusulkan | CONFLICT-2 register |
| K-4 | `DS-06` dan `AUD-47` sama-sama melacak konfirmasi merusak | CONFLICT-3 register |
| K-5 | Model kepemilikan: `03-fabrix-ux-governance.md` §9 ⟷ aturan otonomi `CLAUDE.md` | CONFLICT-4 register |
| K-6 | C-008, C-010, C-015, C-016 disebut *"mandatory"* oleh berkasnya sendiri, tetapi rekonsiliasi menaruhnya sebagai **menunggu adopsi** | `02-carbon-compliance-rules.md` ⟷ `RECONCILIATION` §12.10 |

**Tidak satu pun diselesaikan di batch ini.** K-1 disentuh hanya sejauh yang D-A/D-B butuhkan.

---

## 9. YANG TIDAK TERUKUR

Ditulis apa adanya supaya tidak dikira sudah diperiksa:

1. **Tiga dari enam agen analisis GAGAL** karena batas sesi: analisis D-B khusus, dan
   **kedua pemeriksaan tandingan (D-A dan D-B)**. D-B di dokumen ini disusun dari bukti
   terukur yang sudah ada, **tanpa** pemeriksaan tandingan yang seharusnya membantahnya.
2. **Nol render di peramban untuk D-A.** Seluruhnya dari paket dan CSS hasil build.
3. **Uji enam lebar tidak dijalankan** untuk bentuk D-A yang direkomendasikan.
4. **Penghematan 17–21% bentuk A** adalah hitungan dari tinggi kontrol, **bukan** pengukuran
   di peramban.
5. **Halaman pola Carbon resmi** untuk keadaan kosong: **UNKNOWN**.

---

# PRODUCT OWNER DECISION

Hanya dua keputusan di bawah yang benar-benar membutuhkan Anda.

---

## D-A — BENTUK HALAMAN FORMULIR PENUH

**Saran saya: opsi D + pembungkus `<form>`.**

| Pilihan | Konsekuensi |
|---|---|
| **D. `<form>` + `<Tile>` + `<h2>` + kisi auto-fit** *(saran saya)* | Sudah terbukti berjalan di satu halaman. Perbaikan yang dibutuhkan: **satu elemen**. Resmi jadi deviasi FABRIX yang dicatat |
| A. `<Form>` + `<Stack>` + `<FormGroup>` | Terlihat paling "Carbon", tetapi `.cds--form` nol CSS dan `<Stack>` tidak bisa multi-kolom. Kisi tetap harus ditulis sendiri |
| B. `<FluidForm>` | Paling padat vertikal. **Memindahkan tempat pesan galat** dan mengubah perilaku 17 komponen. Nol pengalaman di FABRIX |
| C. `<form>` biasa saja | Paling ringan sekarang. Jarak ditulis tangan per halaman — kelas "kebetulan benar" yang sudah enam kali terjadi |

---

## D-B — BENTUK BARIS BERULANG

**Saran saya: opsi B (yang sekarang), dengan A sebagai pengecualian bersyarat.**

| Pilihan | Konsekuensi |
|---|---|
| **B. Kartu, label diulang** *(saran saya)* | **Nol perubahan kode.** Terukur bersih di 36 pengukuran. Barisnya tetap tinggi |
| A. Kartu, label disembunyikan | Baris 17–21% lebih pendek. Butuh mekanisme kedua (`data-label`) di bawah 672px, kalau tidak barisnya kehilangan identitas kolom di HP |
| C. Tabel polos + kontrol di sel | Terlihat paling seperti tabel. `DataTable` tidak mendukungnya → jalur hidup kedua |
| D. `ContainedList` | Paling rapi dipandang. Mengubah satu angka butuh membuka overlay |

---

## SATU HAL YANG PERLU ANDA KETAHUI SEBELUM MEMUTUSKAN

Bila D-A dan D-B diterima seperti di atas, konsekuensinya: **BOM tetap modal bertahap**, dan
batch "BOM Create Full Page" **tidak jadi dikerjakan**.

Itu membalik saran saya sendiri di DECISION 6. Alasannya bukan berubah pikiran melainkan
**pengukuran**: tiang penyangga saran itu — risiko §6e-3 — sudah diuji dan **tidak terbukti**
(8 klik, nol gagal, isi meluber sampai 1436px).

Bila Anda tetap ingin BOM jadi halaman penuh, itu **hak Anda dan sah** — yang dibutuhkan
hanyalah alasannya dicatat sebagai penyimpangan dari §6e-2, supaya berbulan-bulan kemudian
masih bisa dijelaskan kenapa satu formulir berbeda dari yang lain.
