# FABRIX FORM GOVERNANCE — HANDOFF

**28 Agustus 2026 · HEAD sebelum batch `47f5307` · nol perubahan sumber**

---

## KEADAAN SAAT INI

Master Plan selesai. Batch ini menutup dua keputusan yang Master Plan sebut sebagai
ketergantungan terbesar: **D-A** (bentuk halaman formulir penuh) dan **D-B** (bentuk baris
berulang). Keduanya kini punya **rekomendasi tunggal beserta pengecualian terdefinisi**,
berstatus **PROPOSED** sampai disetujui.

## YANG DIANALISIS

- Korpus governance yang belum pernah masuk analisis: `docs/FABRIX_CARBON_DESIGN_GOVERNANCE.md`
  (2168 baris) dan `docs/FABRIX-Carbon-UX-Governance/` (2882 baris, 17 berkas, terlacak git)
- `cetakan-halaman-data.md` §3, §3a, §4, §6e, §6e-2, §6e-3 — seluruhnya **BERLAKU**
- Empat opsi D-A dan empat opsi D-B, diukur dari paket terpasang
- Satu pengukuran peramban baru yang menutup pertanyaan terbuka (§6e-3)

## D-A — REKOMENDASI

> Pembungkus **`<form>` sungguhan** + **`<Tile>`** per kelompok + **`<h2>`** judul kelompok +
> kisi **`repeat(auto-fit, minmax(min(100%, 20rem), 1fr))`** + lebar halaman dibatasi.

Alasan terkuat, seluruhnya terukur: `.cds--form` **nol aturan CSS** · `<Stack>` **nol
multi-kolom, nol media query** · Carbon **tidak membatasi lebar field sama sekali** · `<h2>`
memberi struktur heading yang `<legend>` 12px tidak berikan · sudah **terbukti berjalan** di
`SetelanPerhitunganPage`.

**Koreksi yang menyertainya**: halaman itu **tidak punya `<form>` sama sekali** — Enter tidak
menyimpan, `required` tidak berlaku. Perbaikannya satu elemen.

**Pengecualian**: `FormGroup legendText` untuk isian berpasangan (sudah terbukti di
`ItemsPage:1399` dan `:1451`).

## D-B — REKOMENDASI

> **Bentuk yang sekarang tetap**: kartu bergrid, label diulang, kolom mengikuti lebar wadah
> lewat `repeat(auto-fit, minmax(min(15rem, 100%), 1fr))` (DS-22). **Nol perubahan kode.**

**Pengecualian** (label disembunyikan) hanya bila **ketiganya** terpenuhi: seluruh kontrol
pendek · judul kolom dibawa lewat `data-label` di bawah 672px · penghematan tinggi **diukur**
≥20%.

## BUKTI KUNCI

| | |
|---|---|
| §6e-3 pada langkah Komponen BOM | **8 klik, nol gagal**, isi meluber s/d 1436px |
| Tinggi isi BOM | 768px: 468→1380 · 360px: 704→2096 (1→4 komponen) |
| Baris berulang sesudah DS-22 | 36 pengukuran → nol luber, nol kontrol < 200px |
| `.cds--form` | nol aturan CSS, dibuktikan dua kali |
| `hideLabel` | tetap menyisakan nama untuk pembaca layar |
| `Tile` biasa | **aman** berisi kontrol; larangan hanya di `ExpandableTile` |

## KEPUTUSAN TERBUKA

Hanya dua, dan keduanya ada di `FABRIX_FORM_GOVERNANCE_DECISION_RECORD.md`:
**D-A** dan **D-B**.

**Yang wajib Anda ketahui sebelum memutuskan**: bila keduanya diterima, **BOM tetap modal
bertahap** dan batch "BOM Create Full Page" tidak jadi dikerjakan. Itu membalik saran saya
sendiri di DECISION 6 — dan alasannya pengukuran, bukan berubah pikiran.

## HALAMAN YANG TERDAMPAK

| Halaman | Sekarang | Target |
|---|---|---|
| BOM | modal bertahap 2 langkah | **tetap** |
| PO Klien | modal bertahap 4 langkah, **dua kolom** | tetap bertahap; **cabut dua kolom** |
| Master Item | modal bertahap 3 langkah | tetap; terapkan galat-menempel-field |
| Karyawan | modal bertahap 3 langkah | tetap; seragamkan ukuran kontrol |
| `/company/setelan` | halaman penuh **tanpa `<form>`** | tambahkan `<form>` |

## IMPLEMENTASI BERIKUTNYA

1. Tunggu keputusan D-A dan D-B.
2. Bila diterima: pekerjaan berikutnya **bukan** BOM, melainkan **dua P0 dari Master Plan** —
   `/hr` (kartu "Hadir hari ini" selalu 0) dan `/purchasing` (berhasil ditampilkan sebagai
   "Gagal", mengundang supplier ganda).
3. Baru kemudian kelas cacat lintas halaman: galat menempel field, keadaan yang tidak
   dirender, elemen mentah, teks Inggris.

## DI LUAR LINGKUP

Nol implementasi · nol perubahan `build_tasks` · nol task baru · T-1 tidak disentuh ·
`docs/00-GOVERNANCE/` tidak ikut · DS-06 · DS-20 · AUD-42 · MST-09 tidak dikerjakan.

## YANG HARUS DIBACA SESI BERIKUTNYA SEBELUM MULAI

**Tabrakan kode `DS-21`.** Register ID kanonik mencadangkan `DS-21` untuk temuan token
paralel (F-01/F-11); saya memakainya untuk cacat indikator langkah dua puluh jam sesudah
register itu masuk repositori, tanpa membacanya. Tidak ada data rusak — tetapi F-01/F-11
kehilangan ID, dan baris register itu usang. Kode kosong berikutnya **`DS-23`**.
Rinciannya di Decision Record bagian R-5.

**Tiga dari enam agen analisis gagal** karena batas sesi: analisis D-B khusus dan **kedua
pemeriksaan tandingan**. D-B disusun dari bukti terukur yang ada, **tanpa** pemeriksaan yang
seharusnya membantahnya. Bila D-B akan diandalkan untuk banyak layar, jalankan pemeriksaan
tandingan itu lebih dulu.
