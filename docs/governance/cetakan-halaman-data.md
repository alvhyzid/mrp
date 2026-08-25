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
