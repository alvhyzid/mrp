# Rujukan Carbon per Jenis Layar

**Dibuat 25 Agu 2026 (FF.6).** Gunanya satu: supaya sesi berikutnya tidak mencari-cari halaman
mana yang perlu dibuka.

## Aturan pemakaian dokumen ini

**Halaman di bawah WAJIB DIBUKA saat sesi berlangsung — isinya JANGAN disalin ke sini.**

Alasannya sudah terbukti sekali: spesifikasi yang dikutip pada 25 Agu 2026 menyebut token
`$heading-03` untuk ukuran 28px. Di paket `@carbon/react` 1.114.0 yang benar-benar terpasang,
nama tokennya **`productive-heading-04`**, dan `heading-03` **tidak ada sama sekali**.
Ukurannya benar, namanya berubah. Menyalin isi dokumentasi ke repo berarti membekukan
kekeliruan semacam itu dan mewariskannya.

Dokumen ini hanya menyimpan **alamat**, bukan isi.

## Wajib dibuka untuk setiap layar, apa pun jenisnya

| Kebutuhan | Halaman |
|---|---|
| Tema & token warna | `carbondesignsystem.com/elements/themes/overview` |
| Tipografi & skala | `carbondesignsystem.com/elements/typography/overview` |
| Jarak & spacing | `carbondesignsystem.com/elements/spacing/overview` |
| Kolom & grid | `carbondesignsystem.com/elements/2x-grid/overview` |

## Per jenis layar

| Jenis layar | Halaman yang wajib dibuka |
|---|---|
| **Form** | `components/form/usage` dan `components/form/style` · `components/text-input/usage` · `components/select/usage` · `components/date-picker/usage` |
| **Tabel** | `components/data-table/usage` dan `components/data-table/style` · `patterns/list-pattern` |
| **Modal** | `components/modal/usage` · untuk proses bertahap: `components/progress-indicator/usage` |
| **Pemberitahuan** | `components/notification/usage` — memilih inline vs toast vs actionable |
| **Navigasi** | `components/ui-shell-header/usage` · `components/ui-shell-left-panel/usage` |
| **Bantuan & penjelasan** | `components/toggletip/usage` (klik) · `components/tooltip/usage` (hover) |
| **Label & status** | `components/tag/usage` — **Tag untuk menggolongkan/menyaring, BUKAN status field.** Status field dijawab `warn`/`warnText` atau `invalid`/`invalidText` pada kontrolnya |
| **Keadaan memuat** | `components/skeleton/usage` |

## WAJIB: setiap layar yang selesai dimigrasikan menyertakan alamat katalognya

**Aturan ditetapkan 25 Agu 2026, lahir dari cara pemilik produk menemukan penyimpangan di
halaman `/register`.**

Ia meletakkan tangkapan layar katalog Carbon resmi **berdampingan** dengan layar kita, lalu
melihat keduanya sekaligus. Yang ditemukan begitu: sudut membulat pada field aktif, kartu
berbingkai bersudut membulat, tombol melebar penuh dengan teks di tengah (Carbon menaruh teks
di kiri), dan ketebalan garis yang berbeda.

**Tidak satu pun dari itu tertangkap** oleh membaca kode, membaca dokumentasi, atau bahkan
mengukur CSS keluaran — tiga cara yang sudah dipakai dan dianggap cukup.

**Claude Code tidak bisa melihat layar.** Perbandingan visual berdampingan adalah kemampuan
yang **hanya dimiliki pemilik produk**, dan itu menjadikannya bagian dari alat verifikasi,
bukan sekadar penerima hasil.

**Karena itu**: setiap kali sebuah layar dinyatakan selesai dimigrasikan, laporannya WAJIB
menyertakan **alamat halaman katalog Carbon yang sepadan**, supaya pemilik produk bisa
membandingkannya berdampingan. Menyerahkan layar tanpa alamat itu berarti menahan satu-satunya
pemeriksaan yang terbukti menangkap kelas cacat ini.

| Layar kita | Katalog Carbon yang sepadan |
|---|---|
| Daftar, Masuk, Lupa sandi, Undangan | `components/form/usage` + `components/button/usage` |
| Setelan perhitungan | `components/form/usage` + `components/toggletip/usage` |
| Konfirmasi POD | `components/form/usage` + `components/file-uploader/usage` |
| Layar daftar data (Item, BOM, SO, WO, …) | `components/data-table/usage` + `patterns/list-pattern` |
| Dasbor | `components/tile/usage` + `elements/2x-grid/overview` |

## Penempatan tombol — Carbon menjawabnya, dan jawabannya BERGANTUNG PADA WADAH

**Dicatat 25 Agu 2026 setelah pemilik produk mempertanyakan tombol utama yang diletakkan di
kiri.** Pertanyaannya benar, dan jawabannya menunjukkan kesalahan yang halus: aturan yang
dipakai memang aturan Carbon — hanya saja untuk **jenis formulir yang berbeda**.

Tabel Carbon di `patterns/forms-pattern` (bagian *Buttons in forms*):

| Perataan | Rapat ke tepi | Berlaku untuk |
|---|---|---|
| **Rata kiri** | tidak | Formulir di dalam halaman, bukan dialog |
| **Rata kanan** | tidak | Formulir bertahap / wizard, saat aksi utama berarti "maju" |
| **Melebar penuh** | **ya** | Formulir di dalam **dialog, panel samping, DAN di dalam tile** |

Kalimatnya persis: *"In side panels, dialogs, and any other forms within tiles, the button
group should span the width of the container and buttons should bleed to the bottom edge."*

**Yang menentukan bukan selera, melainkan WADAHNYA.** Sebelum memilih perataan, tanyakan
dulu: formulir ini menempel langsung di halaman, atau berada di dalam sesuatu?

Aturan turunannya, semuanya dari halaman yang sama:
- **Tombol utama di KANAN** untuk formulir di dalam wadah berstruktur; di **KIRI** untuk
  formulir yang menempel di halaman.
- Bila melebar penuh dan labelnya kepanjangan, **tumpuk vertikal dengan tombol utama di
  BAWAH**.
- **Jangan menyematkan tombol di ATAS halaman** — Carbon melarangnya secara khusus.
- Tombol sekunder untuk **membatalkan**, bukan untuk "kembali".

Untuk layar masuk, `patterns/login-pattern` menambahkan:
- **Posisi formulir di halaman (kiri/kanan/tengah) diserahkan ke tim produk**, asal field-nya
  tetap di grid. Ini termasuk hal yang BOLEH ditanyakan ke pemilik produk.
- **Tombol utama diletakkan sedekat mungkin dengan field**.
- Gaya **fluid** disebut sebagai bentuk ideal untuk layar masuk/daftar; gaya **default** tetap
  sah. FABRIX memilih **default** (keputusan pemilik produk 25 Agu 2026) supaya sama dengan
  layar lain di dalam sistem.

## Yang TIDAK dijawab Carbon — ini yang ditanyakan ke pemilik produk

- Aturan bisnis dan arti angka
- Istilah Bahasa Indonesia yang dipakai di layar (lihat Kamus)
- Urutan field menurut alur kerja pabrik
- Kebutuhan khusus lantai produksi (ukuran sentuh, sarung tangan, layar kotor)

## Yang dijawab Carbon TAPI kita menyimpang dengan sadar

Setiap penyimpangan **wajib** didokumentasikan sebagai domain pattern lewat format §42,
lengkap dengan alasannya. Yang sudah ada:

| Penyimpangan | Alasan |
|---|---|
| Mode lantai produksi memakai ukuran `lg` (48px), bukan `md` (40px) | Target sentuh 44px untuk jari bersarung tangan. **Bukan deviasi** — 48px ukuran sah di dalam Carbon |
| Tabel berubah jadi kartu bertumpuk di layar sempit | `DataTable` Carbon tidak melakukannya sendiri. **Belum diverifikasi** apakah masih perlu setelah pindah ke Carbon |
