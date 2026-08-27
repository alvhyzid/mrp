# FABRIX FORM GOVERNANCE STANDARD

**STATUS: PROPOSED — belum disetujui pemilik produk.**
**Bukan kanonik.** Tidak boleh dirujuk sebagai aturan yang berlaku sampai disetujui.

**28 Agustus 2026 · HEAD `47f5307` · nol perubahan sumber**

---

## 1. TUJUAN

Menetapkan **satu** bentuk formulir untuk seluruh FABRIX, supaya layar berikutnya tidak
dirancang ulang dari nol dan tidak melahirkan jalur hidup kedua.

Dokumen ini menjawab dua keputusan yang Master Plan sebut sebagai **ketergantungan
terbesar**: bentuk halaman formulir penuh (**D-A**) dan bentuk baris berulang (**D-B**).

## 2. LINGKUP

Berlaku untuk seluruh formulir FABRIX: halaman penuh, modal, dan modal bertahap.
**Tidak** mengubah aturan tabel (§3 cetakan), aturan responsif, maupun aturan unggah.

## 3. HUBUNGAN DENGAN CARBON

Urutan wewenang yang dipakai — bukan disusun di sini, melainkan sudah berlaku:

1. Keputusan pemilik produk yang terkonfirmasi
2. `CLAUDE.md`
3. `docs/governance/cetakan-halaman-data.md` — **BERLAKU**
4. Pola Carbon → Usage komponen → Storybook → **paket di `node_modules` (menang bila bertentangan)**
5. Implementasi yang sudah terbukti di repo

**Carbon tidak menjawab semuanya.** Yang diukur dari paket terpasang dan **ternyata tidak
diatur Carbon sama sekali**: lebar maksimum field, bentuk baris berulang yang bisa ditambah
pengguna, dan pengelompokan kelompok besar dalam satu formulir.

---

## 4. KEPUTUSAN D-A — BENTUK HALAMAN FORMULIR PENUH

### Yang direkomendasikan

> **DEFAULT: pembungkus `<form>` sungguhan + `<Tile>` per kelompok + `<h2>` sebagai judul
> kelompok + kisi `repeat(auto-fit, minmax(min(100%, 20rem), 1fr))` + lebar halaman dibatasi
> `max-inline-size`.**

Ini **bukan pola formulir Carbon**, dan disebut begitu apa adanya — ia **deviasi FABRIX yang
beralasan**, bukan penerapan Carbon.

### Kenapa, dengan bukti

| Bukti | Sumber |
|---|---|
| `<Form>` Carbon memancarkan kelas `.cds--form` yang **tidak punya satu pun aturan CSS** | dibuktikan dua kali: menjalankan mixin `form.form()` dan menyisir CSS hasil build |
| `<Stack>` punya **nol media query** dan **nol kemampuan multi-kolom** | paket terpasang |
| Carbon **tidak membatasi lebar field sama sekali** — nol `max-width`/`max-inline-size` pada `.cds--form-item`, `.cds--text-input`, `.cds--select`, `.cds--label` | disisir dari CSS hasil build |
| `<legend>` `FormGroup` tampil **12px, `text-secondary`**, dan **bukan elemen heading** | `.cds--label`, paket terpasang |
| `<h2>` memberi struktur heading yang bisa **dilompati pembaca layar** lewat daftar heading | HTML asli |
| `<Tile>` biasa **aman** berisi kontrol — `useNoInteractiveChildren` hanya dipanggil di `ExpandableTile` | `Tile.js:38` vs `:384` |
| Sudah **terbukti berjalan**: `SetelanPerhitunganPage` memakai `<Tile>` berisi 8 kontrol | repo |

### Koreksi WAJIB yang menyertai keputusan ini

`SetelanPerhitunganPage` — satu-satunya halaman formulir penuh yang sudah ada — **tidak
punya elemen `<form>` sama sekali**. Pembungkusnya `<div>`, penyimpanannya lewat `onClick`.

Akibatnya, dan ini terukur dari struktur bukan dari dugaan: **Enter tidak menyimpan**,
atribut `required` HTML tidak berlaku, dan tidak ada satu titik pun untuk validasi tingkat
formulir. Perbaikannya **satu elemen**, dan pola `<form>` sudah terbukti di 7 berkas lain.

### Yang DITOLAK, beserta alasannya

| Ditolak | Alasan |
|---|---|
| **`<Form>` Carbon** | Kelasnya tidak punya CSS. Memakainya adalah upacara tanpa akibat — dan upacara tanpa akibat membuat pembaca berikutnya mengira ada yang mengatur jarak, padahal tidak |
| **`<FluidForm>`** | **Risiko tertinggi.** Ia menyalakan MODE lewat React context yang dibaca **17 komponen** — label masuk ke dalam kotak field dan **tempat pesan galat berpindah**. Nol pemakaian di FABRIX. Mencampurnya dengan non-fluid menghasilkan **dua bentuk galat di satu layar**. Bentuk risikonya persis kelas "berhasil, lolos build, tidak berlaku" yang sudah empat kali menggigit proyek ini |
| **`<Stack>` sebagai kerangka** | Nol multi-kolom, nol media query — ia tidak bisa menggantikan kisi |

> **Batas kejujuran yang wajib disebut**: klaim bahwa label `<Select>` "lepas" di dalam
> `FluidForm` adalah **deduksi kaskade CSS**, bukan pengamatan di peramban. Aturan
> `.cds--form--fluid .cds--label { position: absolute }` terbukti ada dan cakupannya tidak
> terbatas pada text-input; posisi piksel akhirnya **TIDAK TERUKUR**.

### Pengecualian yang terdefinisi

> **PENGECUALIAN 1 — pakai `<FormGroup legendText>` KETIKA** dua kontrol atau lebih secara
> **makna** adalah satu isian, atau ketika mengisi satu kontrol membuat kontrol lain tidak
> berlaku.

Sudah terbukti di repo: `ItemsPage.tsx:1399` ("Shelf life" = angka + satuan) dan `:1451`
("Stok minimum" = persen yang membatalkan angka mutlak). `<fieldset>`/`<legend>` adalah
satu-satunya mekanisme HTML asli yang menyatakan **"ini satu isian"** kepada pembaca layar,
dan dua aturan CLAUDE.md 25 Agu 2026 mewajibkannya.

> **BATAS PENGECUALIAN 1**: JANGAN memakai `FormGroup` untuk **judul kelompok besar**.
> Legend-nya tampil 12px `text-secondary` — ukuran label field — dan akan terbaca sebagai
> label, bukan judul bagian. Judul kelompok tetap `<h2>`.

---

## 5. KEPUTUSAN D-B — BENTUK BARIS BERULANG

### Yang direkomendasikan

> **DEFAULT: kartu bergrid dengan label DIULANG tiap baris, kolom mengikuti lebar wadah lewat
> `repeat(auto-fit, minmax(min(15rem, 100%), 1fr))`.**
>
> Yaitu: **bentuk yang sekarang, ditambah perbaikan DS-22 yang sudah terpasang.**

### Kenapa — dan kenapa BUKAN yang terlihat lebih rapi

| Opsi | Putusan | Alasan terukur |
|---|---|---|
| **A. Kartu, label DISEMBUNYIKAN + judul kolom sekali di atas** | **Pengecualian, bukan default** | `hideLabel` memang **tetap menyisakan nama untuk pembaca layar** (`.cds--visually-hidden`, `clip: rect(0,0,0,0)` — diverifikasi di paket). Penghematannya **±24px per kontrol per baris**: di 360px 448 → ±352px (**−21%**), di 768px 280 → ±232px (**−17%**). **Tetapi di 360px kisinya satu kolom**, sehingga judul kolom di atas kehilangan maknanya dan barisnya kehilangan identitas kolom sama sekali |
| **B. Kartu, label DIULANG** | **DEFAULT** | Terukur bersih: 36 pengukuran di 9 lebar → nol gulir menyamping, nol elemen melewati tepi, nol kontrol di bawah 200px. Satu mekanisme, bukan dua |
| **C. `<Table>` polos + kontrol di dalam sel** | **DITOLAK** | `DataTable` Carbon **tidak mendukung sel yang bisa disunting**. Memakai tabel polos lalu menambal kemampuannya adalah **jalur hidup kedua** — kelas cacat yang CLAUDE.md sebut paling sering menggigit proyek ini |
| **D. `ContainedList` + sunting lewat aksi per baris** | **DITOLAK** | Mengubah satu angka butuh membuka overlay. Untuk entri bahan yang dilakukan berturut-turut, itu memperlambat pekerjaan inti |

> **KOREKSI terhadap Master Plan bagian 8.** Master Plan menyatakan `ContainedList`
> *"satu-satunya bentuk yang tidak melanggar larangan children tidak boleh interaktif"*.
> **Itu keliru.** `useNoInteractiveChildren` dipakai **Tooltip, Notification, dan Tile
> (varian ExpandableTile)** — **bukan** `ContainedList`. Diperiksa langsung di paket.
> Penolakan opsi D di atas berdiri di atas alasan lain, bukan alasan yang keliru itu.

### Pengecualian yang terdefinisi

> **PENGECUALIAN 2 — pakai bentuk A (label disembunyikan) HANYA bila KETIGA syarat terpenuhi:**
> 1. Seluruh kontrol dalam baris **pendek** — nol helper text, nol kontrol yang tingginya berubah;
> 2. Judul kolom dibawa ke tiap sel lewat **`data-label`** di bawah 672px, memakai mekanisme
>    yang sudah terbukti di `.tabel-responsif` (`td::before`) — bukan mekanisme baru;
> 3. Penghematan tingginya **diukur** dan terbukti **≥20%** untuk layar itu.
>
> Selama ketiganya belum terpenuhi, bentuk B berlaku. **Ambangnya tidak dikarang** — ia
> harus diukur per layar.

---

## 6. ARSITEKTUR FORMULIR

```
Halaman  ─ .halaman ─ KepalaHalaman (remah roti · judul · pengantar)
             └── <form>
                   ├── <Tile>  ── <h2> judul kelompok
                   │              └── kisi auto-fit ── kontrol Carbon
                   │                                   └── FormGroup  (hanya untuk isian berpasangan)
                   ├── <Tile>  ── <h2> ── bagian baris berulang
                   │                       ├── kepala: judul + tombol "Tambah …"
                   │                       └── kartu per baris (kisi auto-fit)
                   └── aksi tingkat halaman
```

---

## 7. STANDAR HALAMAN PENUH

| # | Aturan |
|---|---|
| 7.1 | Kerangka lewat `KepalaHalaman` — remah roti, judul, satu baris pengantar |
| 7.2 | Pembungkus `<form>` **sungguhan**, bukan `<div>` |
| 7.3 | Kelompok = `<Tile>` + `<h2>`. Judul kelompok menyebut **satu hal** |
| 7.4 | Kisi `repeat(auto-fit, minmax(min(100%, 20rem), 1fr))` — **nol media query** |
| 7.5 | Lebar halaman dibatasi `max-inline-size` (preseden: `60rem`), karena Carbon tidak membatasi apa pun |
| 7.6 | Seluruh jarak dari token `$spacing-*`. **Nol angka px, nol nilai warna ditulis langsung** |
| 7.7 | Ukuran kontrol **seragam dalam satu formulir**. `NumberInput` bawaannya `md` (40px) sementara `TextInput size="lg"` 48px — **wajib disamakan secara eksplisit** |

## 8. STANDAR MODAL

Tidak berubah; ditegaskan ulang dari `cetakan-halaman-data.md` §6e yang **BERLAKU**:

- Lebar = persentase layar per breakpoint, **bukan** piksel. Ukuran dipilih dari **isi**:
  `xs`/`sm` untuk teks pendek + satu keputusan · `md` bawaan untuk formulir · `lg` **hanya**
  untuk isi kompleks seperti tabel.
- **SATU KOLOM.** Field memenuhi lebar modal. Dua field berdampingan **bukan** dua kolom —
  itu satu isian berpasangan (§3a).
- Urutan eskalasi bila tidak muat, **tidak boleh dilompati**: (1) kurangi isi, (2) naik satu
  ukuran, (3) sudah `lg` dan masih menggulir banyak → halaman penuh.
- **DILARANG** membelah jadi dua kolom supaya muat.

## 9. STANDAR MODAL BERTAHAP

Ditegaskan ulang dari §6e-2 yang **BERLAKU**:

- Tiap langkah wajib **berdiri sebagai satu konteks utuh**. Uji: judulnya menyebut satu hal.
  Judul "Lanjutan" atau "Bagian 2" = pemecahan salah.
- Anatomi tombol: **Batal** (ghost, kiri) · **Sebelumnya** (secondary) + **Berikutnya**
  (primary) berpasangan di kanan, masing-masing 25% lebar modal. Di langkah terakhir label
  "Berikutnya" berganti jadi aksi finalnya.
- Penanda langkah memakai `ProgressIndicator` Carbon lewat komponen bersama
  `PenandaLangkah` — **jangan merakit sendiri**. Ambang mendatar↔menurun **dihitung** dari
  jumlah langkah (DS-21).
- **Halaman penuh HANYA bila alurnya BERCABANG** — bukan karena panjang.

## 10. STANDAR BARIS BERULANG

| # | Aturan |
|---|---|
| 10.1 | Bentuk **B** (kartu, label diulang) sebagai default; **A** hanya lewat Pengecualian 2 |
| 10.2 | Kolom dari **lebar wadah**: `repeat(auto-fit, minmax(min(15rem, 100%), 1fr))`. **Nol breakpoint lebar layar** |
| 10.3 | Pembungkus `min(…, 100%)` **wajib** — tanpanya kisi meluber saat wadahnya lebih sempit dari lantainya |
| 10.4 | Tombol "Tambah …" di **kepala** bagian, bukan di ujung daftar |
| 10.5 | Aksi hapus baris **terpisah** dari aksi biasa, `danger--tertiary`, menempati barisnya sendiri |
| 10.6 | **DILARANG** melipat baris ke accordion/tab — Carbon: *"Do not hide information in accordions or tabs."* |
| 10.7 | **DILARANG** menyimpan keadaan per baris berdasarkan **indeks** selama baris di-`key` dengan indeks |

## 11. STANDAR VALIDASI

| # | Aturan |
|---|---|
| 11.1 | Galat field memakai `invalid` + `invalidText` Carbon, **bukan** notifikasi tingkat halaman. Terukur hari ini: `invalidText` **5 dari 154** kontrol berlabel, sementara `InlineNotification` **123** |
| 11.2 | Galat **tidak ditampilkan sebelum pengguna mengetik**. Preseden cacat: `/hr` menampilkan "Nama tidak boleh kosong" saat formulir baru dibuka |
| 11.3 | Notifikasi tingkat halaman **hanya** untuk galat yang tidak punya field — mis. kegagalan jaringan |
| 11.4 | Validasi server **tidak dicabut**; klien menambah, bukan menggantikan |
| 11.5 | Pesan galat server **wajib Bahasa Indonesia** sebelum sampai ke layar |

## 12. STANDAR RESPONSIF

Enam lebar wajib: **360 / 672 / 768 / 1280 / 1440 / 1920**, ditambah **titik perubahan** yang
relevan bagi layar itu. Diperiksa tiga hal terpisah: gulir menyamping, elemen melewati tepi
**kanan**, elemen melewati tepi **kiri**.

## 13. STANDAR AKSESIBILITAS

Keyboard · fokus terlihat · urutan Tab masuk akal · setiap kontrol punya nama terbaca ·
galat **terkait** ke kontrolnya · hierarki heading tanpa lompatan · perangkap fokus modal
benar · ESC menutup.

## 14. HIERARKI AKSI

Satu **primary** per layar · **secondary** untuk Batal · aksi merusak **berjauhan** dari aksi
biasa · **nol `window.confirm`** — konfirmasi merusak lewat Modal Carbon varian `danger`.

## 15. ATURAN PENGECUALIAN

Setiap penyimpangan dari standar ini **wajib** dicatat di `docs/governance/design-debt.md`
beserta alasannya. Penyimpangan tanpa catatan adalah cacat, bukan pilihan.

---

## 16. PENERAPAN — BOM

| | |
|---|---|
| **SEKARANG** | Modal bertahap 2 langkah (Resep · Komponen), baris komponen berulang tanpa batas |
| **TARGET** | **TETAP modal bertahap** |
| **KENAPA** | §6e-2 **BERLAKU** dan menyatakan formulir panjang dipecah jadi langkah, **bukan** dijadikan halaman penuh. Jalan keluar ke halaman penuh hanya untuk alur **bercabang**; BOM **tidak bercabang** — urutan langkahnya tetap |

> **INI MEMBALIK REKOMENDASI SAYA SENDIRI, dan alasannya diukur — bukan berubah pikiran.**
>
> `FABRIX_MODAL_FORM_GOVERNANCE_DECISION.md` DECISION 6 menyarankan BOM pindah ke halaman
> penuh. Salah satu tiang penyangganya adalah risiko §6e-3 — tombol di batas gulir menelan
> klik pertama. Dokumen itu sendiri menyebut pengukurannya **belum dilakukan**.
>
> **Sekarang sudah diukur, dan hasilnya membantah tiang itu**: 8 klik pada tombol "Tambah
> komponen" di 768px dan 360px, dengan isi meluber sampai **1436px** — **nol gagal**.
> Sebabnya terlihat di data: tombol itu berada **462–494px dari tepi bawah isi**, yaitu di
> kepala bagian, bukan di batas gulir. Prasyarat §6e-3 tidak pernah terjadi di sini.
>
> Yang **tersisa** sebagai alasan halaman penuh hanyalah tinggi isi yang tidak bisa
> diperkirakan (terukur 468 → 1380px di 768px; 704 → 2096px di 360px, tanpa batas). Itu
> nyata, tetapi §6e-2 menyatakan **panjang saja bukan alasan**.

### BUAT vs UBAH — wajib sama

Modal yang sama dipakai untuk **buat dan ubah**: `startCreate` dan `startEdit` membuka
`isFormModalOpen` yang sama, dibedakan `editingBomId`.

> **DILARANG membuat Buat = halaman penuh sementara Ubah = modal.** Itu melahirkan dua jalur
> hidup untuk formulir yang sama. Bila kelak BOM dipindahkan, **keduanya pindah bersama**,
> dengan formulirnya diangkat jadi **komponen bersama** — satu formulir, satu wadah.

## 17. PENERAPAN — PO KLIEN

| | |
|---|---|
| **SEKARANG** | Modal bertahap 4 langkah, baris barang berulang, kisi **dua kolom** di atas 672px |
| **TARGET** | Tetap modal bertahap; **cabut dua kolom** jadi satu kolom |
| **KENAPA** | §6e-2: tidak bercabang → modal bertahap sah. §6e: **satu kolom**, dan dua kolom dilarang eksplisit sebagai cara memuatkan isi |

## 18. PENERAPAN — MASTER ITEM

| | |
|---|---|
| **SEKARANG** | Modal bertahap 3 langkah; halaman `/items` sudah jadi rujukan yang disetujui |
| **TARGET** | Tetap modal bertahap. Terapkan §11 (galat menempel field) |
| **KENAPA** | Tidak bercabang. Sudah patuh §6e-2 |

## 19. PENERAPAN — KARYAWAN

| | |
|---|---|
| **SEKARANG** | Modal bertahap 3 langkah; empat `NumberInput` tanpa `size` berdampingan kontrol `lg` |
| **TARGET** | Tetap modal bertahap. Samakan ukuran kontrol (§7.7). Cabut galat-sebelum-mengetik (§11.2) |
| **KENAPA** | Tidak bercabang |

---

## 20. DEFINITION OF DONE

Sama seperti Master Plan bagian 17, ditambah dua butir khusus formulir:

- **18.** Setiap kontrol punya `invalid`/`invalidText` bila bisa gagal.
- **19.** Ukuran kontrol seragam dalam satu formulir, diverifikasi dengan mengukur.

## 21. BUKTI

| Bukti | Isi |
|---|---|
| §6e-3, terukur batch ini | 8 klik pada "Tambah komponen" di 768/360px, isi meluber s/d 1436px → **nol gagal** |
| Baris berulang BOM | 36 pengukuran, 9 lebar × 1–4 komponen → nol luber, nol kontrol < 200px |
| Penanda langkah | 24 pengukuran, 4 formulir × 6 lebar → nol luber |
| `.cds--form` | nol aturan CSS — dibuktikan dua kali |
| Lebar field Carbon | nol `max-width` pada `.cds--form-item`/`.cds--text-input`/`.cds--select`/`.cds--label` |
| `hideLabel` | menyisakan nama untuk pembaca layar (`.cds--visually-hidden`, `clip`) |
| `Tile` | `useNoInteractiveChildren` hanya di `ExpandableTile` |

## 22. KEPUTUSAN YANG MASIH TERBUKA

Ada di `FABRIX_FORM_GOVERNANCE_DECISION_RECORD.md` bagian PRODUCT OWNER DECISION.
