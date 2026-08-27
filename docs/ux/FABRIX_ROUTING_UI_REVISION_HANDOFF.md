# FABRIX — HANDOFF REVISI UI /routing (PILOT #1)

**28 Agustus 2026 · HEAD awal `2952117`**

> Ditulis supaya sesi berikutnya bisa langsung melanjutkan.
> Laporan penuh: `FABRIX_ROUTING_UI_REVISION_REPORT.md`.

---

## APA YANG BERUBAH

**Dua berkas sumber, satu berkas uji baru.** Nol halaman lain disentuh.

1. **`app/(shell)/routing/routing.scss`** — jumlah kolom baris tahap kini diturunkan dari
   **lebar wadah**, bukan lebar layar. Kedua `@include breakpoint()` dicabut.
2. **`src/features/mrp/pages/RoutingsPage.tsx`** — `window.confirm` untuk hapus permanen
   diganti **Modal Carbon varian danger**.

## KENAPA BERUBAH

**Kolom mengikuti lebar layar, padahal barisnya hidup di dalam modal yang MENYEMPIT saat
layar melebar.** Buktinya paling telak di 1280 → 1440:

| Viewport | Lebar modal | Kolom | Lebar/kontrol |
|---|---|---|---|
| 1280 | 768 px | 3 | 223 px |
| **1440** | **691 px** ↓ | 3 | **197 px** ↓ |

Layar melebar 160 px, modal menyempit 77 px, kolom tetap tiga — sehingga **kontrol paling
sempit di seluruh rentang justru ada di layar yang lebih besar**.

`window.confirm` dilarang standar aksi merusak, dan bukan soal rupa: ia memblokir seluruh
peramban, tidak bisa menekankan nama barisnya, tidak bisa diuji dari kode, dan tidak bisa
menjelaskan konsekuensi.

## BUKTI

| | Sebelum | Sesudah |
|---|---|---|
| Kontrol **tersempit** di seluruh rentang | **197 px** | **240 px** |
| Lebar/kontrol @1280 | 223 px | **342 px** (+53%) |
| Lebar/kontrol @1440 | 197 px | **304 px** (+54%) |
| `window.confirm` di repo | 6 di 4 halaman | **5 di 3 halaman** |
| Gulir menyamping, 6 lebar, halaman + modal | nol | **nol** |
| Galat konsol | nol | **nol** |

Modal hapus terverifikasi di 360 dan 1440: varian danger, judul menyebut **nama dan versi**,
menyebut konsekuensi, ada tombol sekunder, ESC menutup, dan **`window.confirm` tidak pernah
muncul**.

## TEST

`tests/routing_revisi_ui.test.ts` — **9 uji**, **MERAH lebih dulu (6 gagal)** lalu HIJAU,
penjaganya dibuktikan menggigit ke dua arah.

Typecheck bersih · lint **28 = baseline** · nol regresi.

## KETERBATASAN YANG DIKETAHUI

**Di 360 px tidak ada perbaikan sama sekali.** Tetap 1 kolom, tetap **608 px per baris** —
masih tertinggi di repositori. `auto-fit` tidak bisa menolong ketika wadahnya hanya muat satu
kolom. Memperbaikinya menuntut **mengurangi isi baris**, yaitu keputusan rancangan tersendiri.

**Ongkos di layar lebar**: di 1280 dan 1440, baris menjadi **72 px lebih tinggi** karena
kolomnya berkurang satu. Kontrol 53% lebih lebar ditukar baris 26% lebih tinggi.

**`/routing` NOT COMPLETE menurut Definition of Done** — tiga butir gagal, dan **dua di
antaranya kelas lintas halaman** yang memang tidak bisa diselesaikan satu halaman pada satu
waktu.

## PEKERJAAN YANG DITUNDA

| # | Temuan | Kenapa |
|---|---|---|
| **T-R1** | `invalidText` nol | kelas lintas halaman (5 dari 154 kontrol di seluruh sistem) |
| **T-R2** | 608 px per baris di 360 px | menuntut keputusan rancangan isi baris |
| **T-R3** | Perangkap fokus `Modal` Carbon bocor | menyentuh **setiap** modal danger, termasuk DS-17 |
| **T-R4** | Arsip tanpa konfirmasi | arsip bisa dipulihkan — dapat dibenarkan |

### T-R3 perlu dibaca hati-hati sebelum dikira regresi

Modal danger DS-17 di `/boms` — **pola yang sama, dibangun sebelum batch ini** — bocor
**21 dari 25**, sedangkan yang baru di `/routing` **12 dari 25**. Jadi ini perilaku `Modal`
Carbon yang **sudah ada**, dan yang baru **lebih baik** daripada rujukan yang sudah disetujui.
Angka absolutnya bergoyang antar-jalan; yang terbukti adalah perbandingannya.

## KEPEMILIKAN TASK

**Nol perubahan `build_tasks`. Nol task dibuat.**

- `window.confirm` → pemilik **`DS-06`** (dan `AUD-47`, yang register tandai duplikat).
  Instans `/routing` **tertutup**; sisa: `SalesOrdersPage` 2 · `PurchasingPage` 2 ·
  `CustomersPage` 1.
- Pola D-B ke tujuh tempat sekelas → **belum ada pemilik**, diusulkan sebagai satu task.
- T-R1 → F-03 di register, belum dibuat.
- T-R3 → belum ada pemilik.

> `DS-23` · `DS-24` · `AUD-49` masih kosong. **11 temuan** di register menunggu ID.
> **Jangan memakai "kode berikutnya" tanpa membaca register lebih dulu.**

## HALAMAN BERIKUTNYA

**`/work-orders`** sesuai urutan sapuan: alur manufaktur inti, dipakai harian, 13 cacat, nol
ketergantungan. Pola D-B yang baru saja terbukti di `/routing` berlaku langsung.

Lalu `/production` → `/customers` → `/ppic` (terakhir karena risikonya: 1.964 baris dan
`DS-19` masih berjalan di berkas yang sama).

## YANG SENGAJA TIDAK DILAKUKAN

Nol perubahan rute · kontrak API · terminologi bisnis · navigasi · tema · komponen bersama.
Nol halaman lain disentuh. N-2 dan N-3 tidak dijawab. DS-20, AUD-42, MST-09 tidak dikerjakan.
