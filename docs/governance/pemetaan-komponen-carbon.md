# Pemetaan Kanonik Komponen — FABRIX ke Carbon

**Hasil DS-0 nomor 4, dibuat 25 Agu 2026.** Menjawab satu pertanyaan per baris:
*kebutuhan nyata kita ini, komponen Carbon yang mana, dan apa yang digantikannya?*

Diisi dari komponen yang **benar-benar ada** di `src/components/ui/` (12 berkas) dan pola
yang benar-benar dipakai di 38 halaman — bukan dari daftar komponen Carbon yang mungkin
suatu saat berguna.

---

## Penggantian langsung — ada padanan Carbon, tinggal pindah

| Kebutuhan nyata | Punya kita sekarang | Komponen Carbon | Catatan |
|---|---|---|---|
| Tombol | `ui/button.tsx` + 26 `<button>` mentah | `Button` | Ukuran Carbon `md` 40px = aturan kita. `lg` 48px untuk mode lantai produksi (D-4) |
| Isian teks | `ui/input.tsx` + 27 `<input>` mentah | `TextInput` | Sudah punya `labelText` + `helperText` bawaan — cocok dengan aturan "instruksi masuk helper, bukan placeholder" |
| Pilihan | `ui/select.tsx` (Radix) + 3 `<select>` | `Select` / `Dropdown` | `Dropdown` untuk daftar panjang, `Select` untuk daftar pendek |
| Tabel data | `ui/data-table.tsx` + 25 `<table>` mentah | `DataTable` | Carbon punya sortir, pilih baris, batch action bawaan |
| Modal | `ui/dialog.tsx` (Radix) | `Modal` | Anatomi kita sudah menyalin Carbon; tinggal ganti mesinnya |
| Modal bertahap | belum ada | `ProgressIndicator` di dalam `Modal` | Disetujui untuk PO klien (CC.6.d) |
| Label | `ui/badge.tsx` | `Tag` | |
| Kartu | `ui/card.tsx` | `Tile` | Carbon `Tile` punya varian klik & pilih |
| Bantuan klik | `ui/field-help.tsx` (`FieldLabel`) | `Toggletip` | **Sudah sejalan** — keduanya dibuka dengan klik, bukan hover |
| Panel Asal-Usul | `ui/provenance-info-button.tsx` | `Toggletip` + `StructuredList` | Isi & aturannya milik kita, wadahnya Carbon |
| Kartu KPI | `ui/kpi-card.tsx` | `Tile` + `@carbon/charts-react` | Grafik menyusul, bukan di DS-1 |
| Dasar jawaban | `ui/answer-basis.tsx` | `Accordion` / `Toggletip` | Perlu diputuskan mana yang cocok |

## Yang Carbon sediakan tapi belum kita punya

| Kebutuhan | Komponen Carbon | Kenapa relevan |
|---|---|---|
| Kerangka aplikasi | `UI Shell` (`Header`, `SideNav`) | Menggantikan `AppShell` buatan sendiri, termasuk menu buka-tutup di layar sempit |
| Pesan sistem | `InlineNotification` / `ActionableNotification` | Sekarang pesan galat ditulis per halaman |
| Keadaan memuat | `SkeletonText`, `DataTableSkeleton` | Sekarang tidak seragam |
| Kolom bertingkat | `Grid`/`Column` (16 kolom) | Sekarang memakai grid Tailwind |
| Petunjuk lokasi | `Breadcrumb` | Belum ada sama sekali |
| Berkas unggah | `FileUploader` | Sekarang `<input type=file>` |
| Tanggal | `DatePicker` | Sekarang `<input type=date>` |

## Pola domain — TETAP milik kita, Carbon hanya wadahnya

Ini yang **tidak boleh** diganti komponen Carbon, karena isinya keputusan bisnis:

| Pola | Kenapa tetap milik kita |
|---|---|
| **Panel Asal-Usul** | Menjawab "angka ini metode apa" — aturan akuntansi, bukan komponen UI |
| **Aksi merusak dipisah jauh** | Aturan tata letak kita (Hapus di kanan, Ubah di kiri) |
| **Hapus-vs-nonaktifkan dihitung server** | Keputusan server, bukan pilihan pengguna |
| **Ringkasan konfirmasi hanya untuk data BARU** | Keputusan pemilik produk 24 Agu |
| **Kamus istilah** | Satu istilah untuk semua departemen |
| **Tabel → kartu bertumpuk di layar sempit** | Carbon `DataTable` tidak melakukan ini sendiri; perlu diperiksa di pilot |

Seluruhnya wajib didokumentasikan lewat format §42 sebagai **domain pattern**, bukan
improvisasi per halaman.

## Yang belum dijawab

- **Apakah `DataTable` Carbon berubah jadi kartu bertumpuk di layar sempit?** Ini menentukan
  apakah aturan responsive kita bertahan atau perlu pola domain sendiri. **Diuji di pilot (a).**
- **Impor penuh atau selektif?** Impor penuh = 816 KB CSS. Keputusan pemilik produk.
- **Grafik**: `@carbon/charts-react` mendukung React 19, tapi ukurannya belum diukur.
