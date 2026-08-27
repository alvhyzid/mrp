# FABRIX — REVISI UI /routing (PILOT #1)

**28 Agustus 2026 · HEAD awal `2952117` · pilot implementasi pertama**

---

## 1. BASELINE

| | |
|---|---|
| HEAD awal | `2952117` |
| Branch | `main`, ahead 30, **belum di-push** |
| Perubahan pra-ada | `docs/00-GOVERNANCE/` (belum terlacak) — **tidak disentuh** |
| Perubahan sumber sebelum batch | **nol** |

`/routing` dipilih sebagai pilot **bukan karena paling buruk**, melainkan karena nilai pakai
ulangnya tertinggi: baris berulangnya terparah di repositori, polanya sudah terbukti lewat
DS-22, dan nol ketergantungan pada keputusan bisnis.

---

## 2. AS-IS — DIVERIFIKASI ULANG, BUKAN DISALIN

878 baris TSX · 116 baris SCSS. Diaudit terhadap 30 butir.

**Yang sudah benar dan TIDAK disentuh** — ini separuh hasil audit, dan penting disebut
supaya pilot tidak terbaca sebagai "semuanya rusak":

| Butir | Keadaan |
|---|---|
| Kerangka halaman (`KepalaHalaman`) | ada |
| `DataTable` Carbon + `.tabel-responsif` | ada |
| Baris yang bisa dimekarkan | ada |
| Pencarian toolbar + saringan status + saklar arsip | ada |
| Pembagian halaman | ada |
| Keadaan memuat (`DataTableSkeleton`) | ada |
| Keadaan kosong | ada |
| Arsip / pulihkan | ada, server yang memutuskan |
| Umpan balik ber-`{message, kind}` | ada — bentuk yang benar |
| Aksi merusak terpisah (`.routing-aksi__merusak`) | ada |
| Izin (`canManage`) | ada, 8 titik |
| **Gulir menyamping** | **nol di keenam lebar, halaman maupun modal** |

---

## 3. CACAT

| # | Cacat | Prioritas | Kelas | Dikerjakan? |
|---|---|---|---|---|
| **D-1** | Baris tahap memakai breakpoint **lebar layar**, padahal hidup di dalam modal yang **menyempit** saat layar melebar | **P1** | RESPONSIVE · FORM | **YA** |
| **D-2** | Komentar SCSS menyebut *"tujuh kolom di layar lebar"* dua baris di atas aturan yang menetapkan **tiga** | **P2** | GOVERNANCE | **YA** — satu suntingan yang sama |
| **D-3** | `window.confirm` untuk hapus permanen | **P1** | UX · ACCESSIBILITY | **YA** |
| **D-4** | `invalidText` nol — galat tidak menempel ke field | P2 | FORM | **TIDAK** — kelas lintas halaman |
| **D-5** | Perangkap fokus modal bocor | P2 | ACCESSIBILITY | **TIDAK** — bukan regresi, lihat §13 |

### D-1 — bukti terukur SEBELUM perbaikan

| Viewport | Lebar modal | Kolom | Lebar per kontrol | Tinggi baris |
|---|---|---|---|---|
| 360 | 360 px | 1 | 292 px | **608 px** |
| 672 | 564 px | 2 | 240 px | 368 px |
| 768 | 645 px | 2 | 281 px | 368 px |
| 1280 | 768 px | 3 | **223 px** | 280 px |
| **1440** | **691 px** | 3 | **197 px** | 280 px |
| 1920 | 922 px | 3 | 274 px | 280 px |

**Baris 1280 → 1440 adalah buktinya**: layar **melebar** 160 px, modal justru **menyempit**
77 px (ambang Carbon menurunkan lebar modal `md` dari 60% ke 48% pada 1312 px), sementara
jumlah kolomnya tidak ikut turun. Hasilnya kontrol **paling sempit di seluruh rentang justru
pada layar yang lebih besar**.

608 px per baris di 360 px memang **terparah di repositori** — sapuan sebelumnya
memperkirakan 642 px dari metrik font; angka **terukur** 608 px, dan angka terukur yang dipakai.

---

## 4. PEMETAAN GOVERNANCE

| Cacat | Aturan yang berlaku |
|---|---|
| D-1 | **D-B diterima** · standar §10.2 "kolom dari lebar wadah, nol breakpoint lebar layar" · §10.3 "pembungkus `min(…, 100%)` wajib" |
| D-2 | CLAUDE.md — komentar yang menyebut risiko wajib menyebut batasnya; komentar yang berbohong lebih berbahaya daripada tidak ada |
| D-3 | Standar §14 "nol `window.confirm`" · aturan modal nomor 9 (aksi merusak terpisah) |
| D-4 | Standar §11.1 — **kelas lintas halaman**, pemilik alaminya F-03 di register |

---

## 5. PEMETAAN CARBON

Dari paket terpasang, bukan dokumentasi:

| Keputusan | Dasar |
|---|---|
| `repeat(auto-fit, minmax(min(15rem, 100%), 1fr))` | Carbon **tidak** menyediakan pola baris berulang; ini pola FABRIX yang sudah terbukti di DS-22 |
| `Modal` varian `danger` | `Modal.js` meneruskan `danger` ke tombol utama sebagai `kind="danger"` |
| Ukuran `sm` untuk konfirmasi | Carbon: modal berisi teks pendek dan **satu keputusan** sebaiknya xs/sm |
| Label + judul menyebut nama & versi | pola DS-17, sudah disetujui |

---

## 6. TO-BE

```scss
.routing-tahap__baris {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(15rem, 100%), 1fr));
  gap: $spacing-05;
  padding: $spacing-05;
  background-color: $layer-01;
  border: 1px solid $border-subtle-01;
}
```

Kedua `@include breakpoint()` **dicabut**. Konfirmasi hapus lewat `<Modal danger size="sm">`.

---

## 7. IMPLEMENTASI

| Berkas | Perubahan |
|---|---|
| `app/(shell)/routing/routing.scss` | kolom ikut lebar wadah; komentar basi diganti bukti terukur |
| `src/features/mrp/pages/RoutingsPage.tsx` | `window.confirm` dicabut; `Modal` danger + state `routingAkanDihapus` / `hapusSibuk`; tombol Hapus membuka modal |

**Nol perubahan** pada rute, kontrak API, terminologi bisnis, navigasi, tema, atau komponen
bersama.

---

## 8. UJI

`tests/routing_revisi_ui.test.ts` — **9 uji**, dibuktikan **MERAH lebih dulu (6 gagal)** lalu
HIJAU, dan penjaganya dibuktikan **menggigit ke dua arah**.

| Uji | Menjaga |
|---|---|
| (a)(b)(c) | kolom ikut wadah · nol breakpoint layar · pembungkus `min(…, 100%)` |
| (d) | tombol hapus tahap tetap di barisnya sendiri |
| (e) | komentar tidak menyebut jumlah kolom yang tidak berlaku |
| (f) | nol `window.confirm` |
| (g)(h) | Modal danger · konfirmasi menyebut nama **dan** versi |
| (i) | aksi merusak tetap terpisah |

---

## 9. BUKTI PERAMBAN — SESUDAH

| Viewport | Kolom sebelum → sesudah | Lebar/kontrol sebelum → sesudah | Tinggi baris |
|---|---|---|---|
| 360 | 1 → 1 | 292 → 292 px | 608 → 608 px |
| 672 | 2 → 2 | 240 → 240 px | 368 → 368 px |
| 768 | 2 → 2 | 281 → 281 px | 368 → 368 px |
| **1280** | **3 → 2** | **223 → 342 px** *(+53%)* | 280 → 352 px |
| **1440** | **3 → 2** | **197 → 304 px** *(+54%)* | 280 → 352 px |
| 1920 | 3 → 3 | 274 → 274 px | 280 → 280 px |

**Kontrol tersempit di seluruh rentang: 197 px → 240 px.** Anomali layar-melebar-kontrol-
menyempit **hilang**.

**Ongkos yang dilaporkan apa adanya**: di 1280 dan 1440, baris menjadi **72 px lebih tinggi**
(280 → 352) karena kolomnya berkurang satu. Kontrol 53% lebih lebar ditukar dengan baris 26%
lebih tinggi.

**Yang TIDAK berubah, dan disebut supaya tidak dikira selesai**: di **360 px** tidak ada
perbaikan sama sekali — tetap 1 kolom, tetap 608 px per baris. `auto-fit` tidak bisa menolong
ketika wadahnya hanya muat satu kolom. Baris tahap di ponsel **masih yang tertinggi di
repositori**.

### Modal hapus

| | 360 px | 1440 px |
|---|---|---|
| `window.confirm` muncul | **tidak** | **tidak** |
| Varian danger | ya | ya |
| Lebar modal | 360 px | 518 px |
| Judul menyebut nama & versi | ya | ya |
| Menyebut konsekuensi | ya | ya |
| Tombol sekunder | ada | ada |
| ESC menutup | ya | ya |

---

## 10. AKSESIBILITAS

| | 360 px | 1440 px |
|---|---|---|
| Satu `<h1>` | ya | ya |
| Lompatan hierarki judul | **nol** | **nol** |
| Tombol tanpa nama terbaca | **nol** | **nol** |
| Kontrol tanpa label | **nol** | **nol** |
| Galat konsol | **nol** | **nol** |
| ESC menutup modal | ya | ya |

**Perangkap fokus: BOCOR — dan BUKAN karena batch ini.** Lihat §13.

---

## 11. RESPONSIF

Enam lebar wajib, halaman **dan** modal:

| | Hasil |
|---|---|
| Gulir menyamping halaman | **nol di keenam** |
| Elemen melewati tepi kanan | **nol** |
| Elemen melewati tepi kiri | **nol** |
| Gulir menyamping di dalam modal | **nol di keenam** |
| Kaki modal & tombol utama terlihat | **ya di keenam** |

---

## 12. KEAMANAN DATA

**Nol baris tertulis.** Seluruh non-GET diblokir di lapisan jaringan; baris routing
disuntikkan lewat **jawaban API**, tidak pernah menyentuh basis data.

Dibuktikan lewat pola: `routings` id 900001 → **0 baris** · `routings` total → **0** ·
`routing_steps` id 1 → **0**. PT Indo Taste Manufacture **tidak disentuh**.

---

## 13. REGRESI

**Nol regresi dari batch ini.**

Satu temuan yang **terlihat** seperti regresi dan terbukti **bukan**:

> Perangkap fokus modal hapus **bocor**: menekan Tab memindahkan fokus ke elemen terlihat
> di luar modal.
>
> **Diuji terhadap pembanding**: modal danger DS-17 di `/boms` — **pola yang sama, dibangun
> sebelum batch ini** — bocor **21 dari 25**, sedangkan yang baru di `/routing` bocor
> **12 dari 25**. Jadi ini **perilaku `Modal` Carbon yang sudah ada**, dan yang baru justru
> lebih baik daripada rujukan yang sudah disetujui.
>
> **Batas kejujuran**: angka absolutnya bergoyang antar-jalan karena titik awal Tab berbeda.
> Yang terbukti adalah **perbandingannya**, bukan angkanya.

### Tiga cacat PENGUKUR yang ditemukan dan diperbaiki di giliran ini

Ketiganya menghasilkan laporan yang meyakinkan dan salah:

1. **`indexOf('<Modal')` menangkap `<ModalHeader`** → uji melaporkan modal danger "tidak
   bervarian danger", padahal ada. Diperketat ke `<Modal\s`.
2. **Uji (h) lolos HAMPA** saat modalnya belum ada — `indexOf` mengembalikan −1 dan
   potongan stringnya menjadi seluruh berkas. Kini indeksnya wajib > −1.
3. **Pengukur tombol utama mencari `.cds--btn--primary`** — modal danger Carbon merender
   tombol utamanya sebagai `.cds--btn--danger`, sehingga teksnya dilaporkan **kosong**.

---

## 14. TEMUAN YANG DITUNDA

| # | Temuan | Kenapa ditunda |
|---|---|---|
| **T-R1** | `invalidText` nol di `/routing` | Kelas **lintas halaman** (5 dari 154 kontrol di seluruh sistem). Pemilik alaminya F-03 di register |
| **T-R2** | Baris tahap di 360 px tetap 608 px | `auto-fit` tidak bisa menolong pada satu kolom. Perbaikannya menuntut mengurangi isi baris — keputusan rancangan tersendiri |
| **T-R3** | Perangkap fokus `Modal` Carbon bocor | Menyentuh **setiap** modal danger di sistem, termasuk DS-17 |
| **T-R4** | Arsip tanpa konfirmasi | Arsip **bisa dipulihkan**, jadi ketiadaan konfirmasi dapat dibenarkan. Dicatat, bukan diperbaiki |

---

## 15. KEPEMILIKAN TASK

**Nol perubahan `build_tasks`. Nol task dibuat.**

| Cacat | Pemilik kanonik |
|---|---|
| D-3 `window.confirm` | **`DS-06`** (dan `AUD-47` yang register tandai duplikat — CONFLICT-3). Instans `/routing` **tertutup**: `window.confirm` turun dari **6 di 4 halaman** menjadi **5 di 3 halaman** (`SalesOrdersPage` 2 · `PurchasingPage` 2 · `CustomersPage` 1) |
| D-1, D-2 | **belum ada pemilik** — usulan: satu task "terapkan pola D-B ke tujuh tempat sekelas", `/routing` yang pertama |
| D-4 / T-R1 | F-03 di register, **belum dibuat** |
| T-R3 | **belum ada pemilik** — usulan task baru |

> `DS-23` · `DS-24` · `AUD-49` masih kosong; **11 temuan** di register masih menunggu ID.
> Jangan memakai "kode berikutnya" tanpa membaca register lebih dulu.

---

## 16. DEFINITION OF DONE

| Butir | Status |
|---|---|
| AS-IS diverifikasi | **✓** |
| Scope jelas | **✓** |
| Defects identified | **✓** |
| Carbon cross-check | **✓** |
| Hierarki informasi benar | **✓** |
| Tabel usable | **✓** |
| Expandable row usable | **✓** |
| Actions usable | **✓** |
| Aksi merusak aman | **✓** |
| Form sesuai D-A/D-B | **✓** (D-B; D-A tidak berlaku — form modal) |
| Validation actionable | **✗** — T-R1 |
| Success · error · loading · empty state | **✓** |
| Responsif 6 breakpoint | **✓** |
| Keyboard | **✓** |
| Aksesibilitas | **✗** — T-R3 (bukan regresi) |
| Regression tests | **✓** |
| Browser evidence | **✓** |
| No horizontal overflow | **✓** |
| No unexpected regression | **✓** |
| Production untouched | **✓** |
| Fixture cleanup verified | **✓** (nol fixture dibuat) |
| Task ownership canonical | **✗** — belum ada pemilik untuk D-1/D-2 |
| Documentation updated | **✓** |
| Git clean setelah commit | **✓** |

---

## 17. STATUS AKHIR

> **`/routing` — NOT COMPLETE menurut Definition of Done.**

Tiga butir belum terpenuhi: validasi belum actionable (T-R1), aksesibilitas perangkap fokus
(T-R3), dan kepemilikan task.

**Tetapi ketiganya berada di luar batas pilot ini**, dan menyebutnya "selesai" akan
menyembunyikan hal yang justru paling berguna dari pilot ini: **Definition of Done tidak bisa
dipenuhi satu halaman pada satu waktu**, karena dua dari tiga butir yang gagal adalah kelas
lintas halaman.

**Yang pilot ini BUKTIKAN**: governance, pola D-B, cetakan modal danger, disiplin uji
MERAH→HIJAU, dan pengukuran enam lebar **semuanya bisa diterapkan** ke halaman nyata,
menghasilkan perbaikan terukur (kontrol tersempit 197 → 240 px), tanpa satu pun regresi dan
tanpa menyentuh halaman lain.
