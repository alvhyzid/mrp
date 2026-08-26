# Cetakan Halaman Data — pola tertulis, bukan "lihat saja Items"

**Ditetapkan 25 Agu 2026** setelah pemilik produk menyatakan halaman **Master Item** sesuai
Carbon. Halaman itu jadi **cetakan** untuk seluruh halaman berisi tabel dan konten.

**Kenapa ditulis, bukan cukup menunjuk contohnya**: contoh berubah. Begitu Items dimodifikasi
untuk alasan yang khusus buat Items, cetakannya ikut bergeser tanpa ada yang memutuskannya.
Pola yang tertulis bisa dibandingkan; contoh yang hidup hanya bisa ditiru.

---

## 1. Kepala halaman

### 1a. SATU judul, bukan dua

**Judul bawaan `DataTable` DICABUT** — `TableContainer` dipakai tanpa `title` dan
`description`.

Alasannya bukan selera: anatomi DataTable Carbon memang memuat "Title and description". Bila
judul halaman ditambahkan di atasnya tanpa mencabut yang bawaan, judul yang sama muncul dua
kali berjarak beberapa sentimeter — dan pembacanya mengira ada dua hal berbeda.

Judulnya hidup di kepala halaman sebagai `<h1>` dengan `productive-heading-04`.

### 1b. Keterangan menyebut jumlah DAN hasil saringan

```
"4 item tercatat"                    ← tanpa saringan
"1 item dari 4 yang tercatat"        ← sedang tersaring
```

Bentuk kedua wajib: tanpa itu, orang yang lupa saringannya masih menyala akan mengira datanya
hilang.

### 1c. Breadcrumb: `Dashboard / Workspace / Halaman`

- **Dashboard** — bisa diklik, halamannya ada.
- **Workspace** — **TIDAK bisa diklik dan TIDAK bergaya tautan**. Ia kelompok di menu kiri,
  bukan halaman.
- **Halaman sekarang** — `isCurrentPage`.

---

## 2. Toolbar tabel

| Unsur | Aturan |
|---|---|
| Pencarian | **Melipat** — `TableToolbarSearch` **TANPA** `persistent`. Ikon dulu, melebar saat diklik |
| Saringan | Berlaku **seketika**, tanpa tombol "terapkan" |
| Label saringan | `titleText="…"` **+ `hideLabel`** — JANGAN `titleText=""` |
| Tombol aksi utama | **Berikon** (`renderIcon={Add}`), ukuran `lg` |

**`titleText=""` adalah jebakan**: ia tetap merender elemen label dan mendorong kotaknya 16px
lebih rendah daripada kontrol di sebelahnya.

**Saringan mana untuk apa**: banyak-pilihan (`MultiSelect`) bila wajar memilih lebih dari satu
sekaligus; satu-pilihan (`Dropdown`) bila pilihannya saling meniadakan.

---

## 3. Tabel

- **Ukuran `lg`** → baris 48px. Carbon mensyaratkan baris kepala mengikuti ukuran baris isi;
  prop `size` mengurus keduanya.
- **Tombol di dalam baris 44px** — lewat aturan area sentuh global (lihat §5), bukan diatur
  per halaman.
- **Kolom yang judulnya memuat tombol TIDAK BOLEH bisa diurut.** Header yang bisa diurut
  ADALAH sebuah `<button>`; menaruh tombol di dalamnya menghasilkan HTML tidak sah dan tombol
  di dalamnya bisa berhenti bisa ditekan tanpa ada yang tahu.
- **Detail baris**: satu pintu masuk lewat baris yang mekar. Seluruh aksi — Ubah, Hapus,
  tambahan lain — hidup **di dalam** detail, bukan berjejer di baris tabel.
- **Aksi merusak ditempatkan berjauhan** dari aksi biasa di dalam detail.

### 3a. Isian yang BERPASANGAN wajib menyatu

**Isian yang secara MAKNA berpasangan — angka + satuan, nilai + persen, dua ambang yang saling
meniadakan — WAJIB berada dalam satu kelompok di bawah SATU legend.** Tidak boleh terpisah
kolom, dan tidak boleh punya label sendiri-sendiri.

Lahir dari dua kasus yang **diukur**, dan keduanya mengajarkan hal berbeda:

| Pasangan | Yang terjadi | Pelajarannya |
|---|---|---|
| Shelf life (angka + satuan) | **Sudah berdampingan** di baris yang sama, tapi masing-masing punya label sendiri | **Berdampingan saja tidak cukup.** Dua label membuatnya terbaca sebagai dua field yang tidak berhubungan — pemilik produk tidak mengenalinya sebagai isian yang ia minta, padahal itu persis isian yang ia minta |
| Stok minimum (persen + mutlak) | Persen di kolom **ketiga**, mutlak di kolom **pertama baris berikutnya** | Yang satu **membatalkan** yang lain, dan orang bisa mengisi salah satunya tanpa pernah melihat yang lain |

**Carbon tidak punya komponen angka-berpasangan-satuan** — diperiksa di paket terpasang: ada
`NumberInput` dan `Select`, tidak ada yang menyatukannya. Dipakai `FormGroup`: satu `legendText`,
kontrolnya di dalam.

**Hasil turunannya ditampilkan**, bukan disembunyikan: `"6 bulan (180 hari)"`. Angka harinya
itulah yang dipakai menghitung tanggal kedaluwarsa; menyembunyikannya membuat pengguna tidak
punya cara memeriksa apakah sistem memahami maksudnya.

**DUA ATURAN TURUNAN, keduanya lahir dari kasus nyata:**

**SATU LABEL, bukan label per bagian.** Dua field bisa berdampingan dan tetap tidak terbaca
sebagai satu isian bila masing-masing punya label sendiri. **Bukan jaraknya yang memisahkan,
melainkan labelnya.** "Shelf life" + "Satuan shelf life" terbaca sebagai dua hal; satu kelompok
berlabel "Masa simpan" terbaca sebagai satu.

**FIELD YANG SALING MEMBATALKAN wajib berdekatan, dan hubungannya wajib TERLIHAT** — bukan
hanya diketahui kode. Bila mengisi satu field membuat field lain tidak berlaku, letakkan
keduanya berdampingan dan katakan hubungannya di layar (mis. `warnText` pada yang diabaikan).

Ini lebih berat daripada aturan label: yang itu membuat orang **tidak menemukan** isiannya;
yang ini membuat orang **mengisi sesuatu yang diam-diam tidak berlaku**.

**PEMERIKSAAN WAJIB SAAT MEMIGRASIKAN SETIAP HALAMAN** — sapuan otomatis hanya bisa melihat
form yang sudah Carbon, jadi 31 halaman sisanya tertangkap di sini:
1. Adakah isian yang secara makna satu hal tapi punya label per bagian?
2. Adakah field yang mengisinya membuat field lain tidak berlaku?
Bila ya untuk salah satunya, satukan sebelum halaman dinyatakan selesai.

---

## 4. Keadaan

Keempatnya wajib dibedakan — **"kosong" bukan satu keadaan**:

| Keadaan | Yang ditampilkan |
|---|---|
| Memuat | `DataTableSkeleton` |
| Belum ada data | "Belum ada …" + tombol **membuat data pertama** |
| Kosong karena saringan | "Tidak ada … yang cocok" + jalan **menghapus saringan** |
| Galat | `InlineNotification` |

Menyamakan dua keadaan kosong adalah cacat: yang satu berarti "mulailah", yang satu berarti
"longgarkan saringanmu".

---

## 5. Ukuran, jarak, warna

- **Nol angka px ditulis langsung. Nol warna ditulis langsung.** Seluruhnya token Carbon.
- Ukuran kontrol `lg` (48px) untuk field dan tombol.
- **Area sentuh 44px diurus global** di `src/styles/carbon.scss` — jangan diulang per halaman.

---

## 6. Dua deviasi sadar — JANGAN "diperbaiki"

### 6a. Breadcrumb pada hierarki dua tingkat

Carbon menyarankan breadcrumb untuk hierarki **lebih dari dua tingkat**; milik kita dua
(workspace → halaman). **Dipakai tetap** karena ia memberi **posisi** dan **jalan kembali** —
dua hal yang tidak diberikan baris judul biasa.

Keputusan pemilik produk, 25 Agu 2026.

### 6b. Tabel jadi kartu bertumpuk di bawah 768px

Carbon menggulir menyamping; aturan proyek melarang gulir menyamping di lebar mana pun.

Di bawah 42rem tiap baris jadi satu kartu, nama kolomnya dibawa lewat `data-label`.
**Informasinya sama, penyajiannya berubah bentuk.**

**Jebakan yang sudah menggigit**: mengubah `<tr>` dan `<td>` saja **tidak cukup** — selama
`<tbody>` masih `table-row-group`, peramban tetap menatanya sebagai baris tabel dan barisnya
**saling menindih**. `<table>` dan `<tbody>` ikut dijadikan `block`.

Dan yang menemukan cacat itu bukan pengukuran: "nol gulir menyamping" tetap **hijau** padahal
barisnya tumpang tindih. Yang menemukannya **melihat tangkapan layarnya**.

---

## 7. Cacat Carbon yang diperbaiki global

**Gaya tautan menempel ke SETIAP butir breadcrumb**, termasuk butir yang tidak punya alamat.
Diukur: butir tanpa alamat berwarna `rgb(15, 98, 254)` — biru tautan yang sama persis dengan
butir yang benar-benar bisa diklik di sebelahnya.

Akibatnya orang mengklik sesuatu yang tidak melakukan apa-apa, lalu mengira sistemnya rusak.

Diperbaiki **sekali di `src/styles/carbon.scss`**, berlaku seluruh halaman.

---

## 8. Halaman rujukan Carbon

`components/data-table/usage` · `components/breadcrumb/usage` · `components/modal/usage` ·
`components/tag/usage` · `patterns/filtering` · `patterns/empty-states-pattern` ·
`react.carbondesignsystem.com` untuk propertinya.

---

## 9. KERANGKA HALAMAN BERSAMA (ditetapkan 25 Agu 2026, saat DS-09 dimulai)

**Sebelum menyentuh halaman, pakai kelas kerangka yang SUDAH ADA di `src/styles/carbon.scss`.**

| Kelas | Untuk |
|---|---|
| `.halaman` | Pembungkus halaman: padding + jarak antar bagian |
| `.halaman__remah` | Remah roti |
| `.halaman__remah-mati` | Tingkat yang bukan halaman — Carbon membuat SEMUA butir remah tampak biru dan bisa diklik |
| `.halaman__judul` | Judul halaman (`productive-heading-04`) |
| `.halaman__pengantar` | Kalimat pengantar, menyebut jumlah dan hasil saringan |
| `.halaman__saring` | Saringan di toolbar; lebarnya dibatasi supaya tidak mendorong tombol utama keluar |
| `.halaman__redup` | Teks sekunder, mis. tanda "—" untuk nilai kosong |
| `.kisi-metrik` + `.metrik__*` | Kartu angka di dashboard — Carbon **tidak punya** komponen "kartu angka" |

**Kelas sendiri HANYA untuk yang khas halaman itu** (kolom angka, kartu detail, susunan isian khusus). Bila tergoda menyalin kerangka dengan awalan nama sendiri: itu **cetakan yang tersalin**, dan perbaikan berikutnya harus mencari di 29 tempat.

### Dua jebakan yang sudah terbukti, sebutkan lagi saat menyentuh halaman serupa

1. **Kontrol Carbon TIDAK menaruh nilainya di `FormData`.** Halaman yang membaca formnya lewat `FormData` saat submit perlu menyimpan nilainya di state dan meneruskannya lewat input tersembunyi. **Lapisan servernya tidak perlu diubah sama sekali.**
2. **Komponen Carbon di konteks yang tidak diatur Carbon perlu ditempatkan sendiri.** `Checkbox` di dalam toolbar tabel membawa margin atas dan tidak menyejajarkan diri; `ToastNotification` tidak punya posisi sama sekali. Ini **bukan menimpa gaya Carbon** — ini mengisi yang memang tidak diatur.
