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
