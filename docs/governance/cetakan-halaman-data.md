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

### 6b. Tabel jadi kartu bertumpuk di bawah 672px

> **Koreksi 26 Agu 2026**: judul bagian ini sebelumnya tertulis "di bawah 768px" sementara
> isinya menyebut 42rem dan CSS-nya `max-width: 41.98rem` — yaitu **672px**. Angka 768 di
> judul salah, dan salahnya bukan sepele: 768 adalah salah satu lebar uji wajib, jadi siapa
> pun yang percaya judul itu akan mengira sudah menguji tepat di titik baliknya padahal
> belum. Ini sebab langsung kenapa **672 kini jadi lebar uji wajib**.

Carbon menggulir menyamping; aturan proyek melarang gulir menyamping di lebar mana pun.

Di bawah 42rem tiap baris jadi satu kartu, nama kolomnya dibawa lewat `data-label`.
**Informasinya sama, penyajiannya berubah bentuk.**

**Jebakan yang sudah menggigit**: mengubah `<tr>` dan `<td>` saja **tidak cukup** — selama
`<tbody>` masih `table-row-group`, peramban tetap menatanya sebagai baris tabel dan barisnya
**saling menindih**. `<table>` dan `<tbody>` ikut dijadikan `block`.

Dan yang menemukan cacat itu bukan pengukuran: "nol gulir menyamping" tetap **hijau** padahal
barisnya tumpang tindih. Yang menemukannya **melihat tangkapan layarnya**.

---

### 6b-2. ATURAN AMBANG: 8 kolom atau lebih memakai VARIAN LEBAR

> **Tabel dengan 8 KOLOM ATAU LEBIH memakai `className="tabel-responsif--lebar"` (baris jadi
> kartu di bawah 1056px). Di bawah itu, `className="tabel-responsif"` (di bawah 672px).**

**Dasarnya diukur, bukan dipilih**: lebar alami 24 tabel pada 672px — tiga tabel berkolom 8–9
butuh **776–820px**, sisanya (≤ 7 kolom) muat. Nol tabel butuh lebih dari 1056px.

**Kenapa ambang bawaannya tidak dinaikkan saja**: 21 dari 24 tabel muat di 672px. Menaikkan
seluruhnya ke 1056px akan mengubah tabel yang hari ini benar menjadi kartu di rentang
672–1055px — kehilangan pembandingan antar baris di tablet, untuk masalah milik tiga tabel.

**DIJAGA OTOMATIS** oleh `tests/elemen_mentah_halaman_internal.test.ts`, jadi tabel berkolom
banyak yang memakai varian biasa tertangkap **tanpa menunggu seseorang mengukurnya di 672px**.
Terbukti di giliran yang sama ia lahir: pengawas itu langsung menemukan tabel item Sales Order
(8 kolom) yang baru saja dipindahkan ke varian biasa — dan tabel itu ada **di dalam baris yang
dimekarkan**, jadi tidak ada pengukuran layar yang bisa menemukannya.

**BATAS PENGHITUNGNYA, disebut supaya angkanya tidak dipercaya berlebihan**: ia membaca
`<TableHeader>` literal dan entri array kolom, serta menghitung `push()` bersyarat sebagai
BATAS ATAS. Tabel yang jumlah kolomnya tidak bisa dibaca dilaporkan sebagai **tidak
terperiksa**, bukan diloloskan diam-diam.

---

## 6c. BUKTI VISUAL: enam lebar, DUA TEPI (ditetapkan 26 Agu 2026, dari DS-14)

**Lebar wajib: 360 / 672 / 768 / 1280 / 1440 / 1920.**
Empat lebar lama adalah lebar yang **lazim dipakai orang**; tidak satu pun menyentuh **titik
perubahan** susunan. **672** adalah titik balik tabel→kartu di atas; **1440** mengisi jarak
antara 1312 dan 1584 milik Carbon. Aturan umumnya: **daftar lebar wajib harus mencakup titik
perubahan, bukan hanya lebar yang lazim.**

**Yang diperiksa di tiap lebar — TIGA hal, bukan satu:**

| # | Pemeriksaan | Menangkap |
|---|---|---|
| 1 | `scrollWidth > clientWidth` | isi yang meluber ke kanan **dan menghasilkan gulir** |
| 2 | elemen dengan `right > clientWidth` | kolom yang **terpotong di kanan tanpa gulir** |
| 3 | elemen dengan `left < 0` | kontrol yang **hilang di tepi kiri** |

**Pemeriksaan 1 saja TIDAK CUKUP, dan ini sebab DS-14.** Ia hanya menangkap satu arah. Yang
terpotong ke kiri dipotong diam-diam oleh induknya — halamannya **tidak menggulir sama
sekali** — jadi ukuran lama menjawab "lulus". Terukur di `/items` 360px: saringan "Tipe"
berada di **−47 sampai −19**, hilang seluruhnya, sementara ukuran lama melaporkan bersih.
Toolbar Carbon meratakan isinya ke kanan lalu memotong kelebihannya, jadi **yang hilang selalu
yang paling kiri**.

**Yang TIDAK boleh dihitung sebagai cacat** — pengawas yang salah tuduh melatih orang
mengabaikan hasilnya, dan pengukur ini **memang sempat salah tuduh** sebelum diperketat:
elemen yang disembunyikan dengan teknik baku "terbaca pembaca layar saja" —
`.cds--visually-hidden`, `.sr-only`, leluhur berukuran ≤ 1px ber-`overflow` tersembunyi, atau
leluhur ber-`clip`/`clip-path`.

**Yang menandainya adalah TEKNIKNYA, bukan POSISINYA.** `.tabel-responsif thead` disembunyikan
lewat kotak 1×1 px ber-`clip-path`, jadi judul kolomnya tetap punya geometri lebar padahal nol
piksel tampak — versi pertama pengukur ini melaporkannya sebagai lima cacat yang tidak ada.
Saringan yang benar-benar hilang di tepi kiri **tidak** memakai teknik itu, jadi ia tetap
tertangkap: dibuktikan dua arah, bukan sekadar dilonggarkan sampai diam.

## 6e. UKURAN MODAL DAN JUMLAH KOLOM FORM (ditetapkan 26 Agu 2026)

Sebelum ini **tidak ada aturannya sama sekali** — CLAUDE.md hanya mengatur *anatomi* modal
(header/body/footer), bukan ukuran maupun jumlah kolom. Akibatnya terukur: **22 modal dengan
sebaran ukuran sm 4 · md 9 · lg 9**, dan formulir berjumlah field mirip dikerjakan berbeda —
ada yang satu kolom, ada yang dua kolom.

### Lebar modal: TIDAK ADA batas piksel — persentase layar per breakpoint

Diukur dari `node_modules/@carbon/styles/scss/components/modal/_modal.scss`, bukan dari
dokumentasi:

| Ukuran | < 672px | 672–1055 | 1056–1311 | ≥ 1312 |
|---|---|---|---|---|
| `xs` | 100% | 48% | 32% | 24% |
| `sm` | 100% | 60% | 42% | 36% |
| `md` (bawaan) | 100% | 84% | 60% | 48% |
| `lg` | 100% | 96% | 84% | 72% |

Dalam piksel nyata: di monitor 1920px → `xs` 461 · `sm` 691 · `md` 922 · `lg` 1382.
Di HP, **keempatnya 100%** — modal memang jadi layar penuh, dan itu sudah sesuai aturan
responsive proyek.

### Memilih ukuran: dari ISI, bukan dari jumlah field

Carbon (`components/modal/usage`):

> *"Choose a size that works best for the amount of modal content you have. Modals with brief
> text should be extra small or small to avoid long single lines; for complex components, like
> a data table, the default or large modal is more suitable."*

Terjemahan yang berlaku di sini:
- **`xs` / `sm`** — teks pendek dan **satu keputusan**: konfirmasi hapus, pemberitahuan.
  Alasannya bukan hemat ruang melainkan **menghindari baris teks yang terlalu panjang**.
- **`md`** — bawaan. Formulir biasa.
- **`lg`** — **hanya** bila isinya komponen kompleks seperti **tabel**.

### Satu kolom atau dua? Carbon menjawabnya langsung

> *"…form inputs and other components expand the entire width of a modal."*
> (`components/modal/usage`, bagian Alignment)

**Jadi: SATU KOLOM. Field memenuhi lebar modal.** Margin kanan 20% di modal besar berlaku
untuk **teks penjelasan**, BUKAN untuk field.

**Dua field berdampingan bukan "dua kolom"** — itu **satu isian yang kebetulan berpasangan**
(angka + satuan, tanggal mulai + tanggal selesai), dan aturannya sudah ada di bagian 3a:
satu kelompok, satu label. Membelah formulir jadi dua kolom untuk **memuatkan lebih banyak
field** adalah menyiasati modal yang kekecilan — dan jawabannya bukan dua kolom.

### Kalau tidak muat: naik ukuran, lalu HALAMAN PENUH

> *"If your modal has too much scrolling because of a maximum height limitation, consider using
> the next modal size up. If the large modal height is still not enough space then a full page
> might be needed instead."*

Dan pola dialog Carbon menyebut batasnya lebih tegas:

> *"Don't use to display complex or large amounts of data."* · *"Don't recreate a full app or
> page in a dialog."* · Modal untuk *"short and non-frequent tasks."*

**Urutan keputusannya, dan tidak boleh dilompati:**
1. Isi bisa dikurangi? (progressive disclosure — field lanjutan muncul hanya bila relevan)
2. Belum cukup → naik satu ukuran.
3. Sudah `lg` dan masih menggulir banyak → **halaman penuh, bukan modal.**

**Yang DILARANG**: membelah jadi dua kolom supaya muat. Itu melewati ketiga langkah di atas
sekaligus, dan menghasilkan formulir yang sulit dipindai — mata harus melompat kiri-kanan
alih-alih turun satu jalur.

### 6e-2. FORMULIR PANJANG DIPECAH JADI LANGKAH — Progress Modal

**Keputusan pemilik produk, 26 Agu 2026**: formulir yang terlalu panjang **dipecah menjadi
beberapa bagian**, bukan dijadikan halaman penuh dan bukan dijadikan dua kolom.

Carbon menyediakannya sebagai **Progress modal** (`components/modal/usage#progress-modal`):

> *"For longer tasks, use a progress modal to give the user a sense of completion and
> orientation within the focused flow."*

**DAN PERINGATAN DI KALIMAT BERIKUTNYA — ini syaratnya, bukan tambahan:**

> *"A progress modal is not a solution for excess modal content. It should only be used to
> present information in more consumable and focused chunks."*

Artinya: **memecah tidak sah bila hanya untuk memuatkan isi yang kebanyakan.** Tiap bagian
wajib berdiri sebagai **satu konteks yang utuh** — pemilik produk merumuskannya sama persis:
*"pastikan form di tiap section sesuai dengan konteksnya"*.

**UJI SEBUAH BAGIAN SAH ATAU TIDAK**: bagian itu bisa diberi judul yang **menyebut satu hal**,
dan setiap field di dalamnya menjawab hal itu. Bila judulnya terpaksa berbunyi "Lanjutan" atau
"Bagian 2", pemecahannya salah — itu memuatkan, bukan mengelompokkan.

**Anatomi tombolnya ditetapkan Carbon, jangan dirancang sendiri:**
- Tiga tombol: **Batal** (ghost, di **kiri**) · **Sebelumnya** (secondary) + **Berikutnya**
  (primary) **berpasangan di kanan**.
- Lebar tiap tombol **25% lebar modal**, menempel penuh ke tepi (*full bleed*).
- **Di langkah terakhir, label "Berikutnya" berganti jadi aksi finalnya** — mis. "Buat PO klien".

**Kapan TETAP halaman penuh, bukan progress modal:**

> *"For complex flows with complex choices, consider using a full page instead of a modal."*

Yaitu ketika langkah berikutnya **bergantung pada pilihan** di langkah sebelumnya sampai
alurnya bercabang. Formulir yang urutannya tetap — sepanjang apa pun — cukup progress modal.

**Komponennya sudah ada di paket terpasang**: `ProgressIndicator` di `@carbon/react`.
Jangan merakit penanda langkah sendiri.

### 6e-3. ISI MODAL YANG MELEWATI BATAS GULIR MENELAN KLIK PERTAMA (ditetapkan 26 Agu 2026)

**Ini bukan soal kerapian. Tombol yang berada tepat di batas gulir modal TIDAK BEKERJA pada
klik pertama.**

Terukur langsung di peramban, pada tombol "Simpan produk" di dalam panel tambah-produk:

```
[NATIVE] mousedown  -> terjadi
[GESER]  saat mousedown  y=563  scrollTop=121
[GULIR]  scrollTop=205                      <- isi modal MENGGULIR SENDIRI
[GESER]  50 ms sesudah   y=479  scrollTop=205   <- tombolnya pindah 84px
[NATIVE] mouseup   -> TIDAK PERNAH terjadi
[NATIVE] click     -> TIDAK PERNAH terjadi
```

**Mekanismenya**: tombol yang belum sepenuhnya tampak menerima fokus saat ditekan, peramban
menggulirkannya ke tampak, dan `mouseup` mendarat di tempat yang sudah bergeser — sehingga
peristiwa `click` **tidak pernah terbentuk**. Gejala yang dilihat pengguna: **klik pertama
tidak melakukan apa-apa, klik kedua baru bekerja.**

**Kenapa ini berbahaya melebihi cacat tampilan biasa**: tidak ada galat, tidak ada pesan, dan
kodenya benar. Pemeriksaan yang menekan tombol satu kali akan melaporkan **fiturnya rusak**;
pemeriksaan yang kebetulan menekan dua kali akan melaporkan **fiturnya baik-baik saja**. Dua
kesimpulan berlawanan dari kode yang sama.

**ATURAN**: panel yang muncul di dalam modal (tambah-produk, tambah-klien, dan sejenisnya)
**tidak boleh menambah tinggi** sampai isinya melewati batas gulir. Bila ia panjang,
**sembunyikan isi yang sedang tidak dipakai** — di PO klien, daftar baris item disembunyikan
selagi panel produk baru terbuka. Sesudah itu `scrollTop` tetap **0** dan klik pertama bekerja.

**CARA MEMERIKSANYA**, karena mata tidak bisa: pasang pendengar `mousedown`/`mouseup`/`click`
pada tombolnya dan bandingkan. Bila `mousedown` ada tetapi `click` tidak, itu cacat ini.

---

## 6d. BUKTI VISUAL WAJIB MENCAKUP KEADAAN TERBUKA (ditetapkan 26 Agu 2026, dari DS-14)

**Seluruh bukti visual yang pernah diambil di proyek ini memotret halaman dalam keadaan
TERTUTUP.** Yang tersembunyi sampai diklik tidak pernah masuk ke satu pun tangkapan layar,
satu pun pengukuran, dan satu pun kesimpulan.

Terbukti: **empat dari tujuh tabel** yang melewatkan kelas responsif berada **di dalam baris
yang dimekarkan**. Tidak ada sapuan visual jenis apa pun yang bisa melihatnya — yang
menemukannya adalah membaca berkas.

**ATURAN: bukti visual wajib menyebutkan APA YANG TIDAK TERLIHAT dalam keadaan itu.**
Bukti yang tidak menyebut batasnya akan dibaca sebagai bukti menyeluruh.

**Yang wajib dibuka dulu sebelum diukur, per jenis halaman:**

| Yang tersembunyi | Halaman yang punya | Cara membukanya |
|---|---|---|
| Tabel rincian di baris yang dimekarkan | Boms, PO klien, Routing, Pengiriman, Sales Order, Work Order, Pembelian, Item | klik tombol mekar satu baris |
| Modal tambah/ubah | seluruh halaman master | klik tombol aksi utama |
| Tab yang tidak aktif | Gudang, PPIC | klik tiap tab |
| Pencarian yang terlipat | seluruh halaman bertabel | klik ikon cari |
| Panel bantuan (`FieldLabel`) | seluruh formulir | klik ikon tanya |

**BIAYANYA, disebutkan supaya keputusannya sadar**: sapuan keadaan tertutup saja sudah
29 rute × 6 lebar = 174 pengukuran, dan berjalan **25–40 menit**. Menambahkan keadaan terbuka
menambah kira-kira **dua kali lipat** pengukuran untuk halaman bertabel — perkiraan total
**60–75 menit** per verifikasi menyeluruh.

**Dan ada ongkos yang lebih besar daripada waktu**: baris hanya bisa dimekarkan bila **ADA
BARISNYA**. Tenant uji kosong, jadi verifikasi keadaan terbuka mensyaratkan **membuat data
lebih dulu lewat layar** dan menghapusnya lagi sesudahnya. Itu bukan tambahan menit; itu
tambahan langkah yang bisa gagal sendiri.

**Karena itu urutannya**: pengawas yang MEMBACA BERKAS (`DS-16`) didahulukan daripada sapuan
yang MELIHAT LAYAR, untuk kelas cacat yang bisa ditemukan dari kode. Sapuan keadaan terbuka
dipakai untuk yang **hanya** bisa dilihat mata — susunan, tumpang tindih, keterbacaan.

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
