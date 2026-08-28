# HIERARKI JUDUL — LAPORAN FINAL (`DS-24`)

> Dokumen ini **menggantikan** `FABRIX_DS23_HEADING_HIERARCHY_REMEDIATION_REPORT.md`.
> Dokumen lama memakai nomor task yang salah dan memuat satu aritmetika yang keliru; keduanya
> dikoreksi di sini (§2 dan §12).

---

## 1. INITIAL FINDING = 11

Sebelas titik, dihitung ulang dari pohon **sebelum** perbaikan (commit `fbc0c87`) dengan
metode yang sama — bukan disalin dari laporan sebelumnya:

- **5 halaman** memuat `<h1>` mentah **dan** `KepalaHalaman`
- **6 halaman** memakai himpunan tingkat yang melompat: `[1,3]` ×2, `[1,4]` ×2, `[1,2,4]` ×2

## 2. FALSE POSITIVE = 5 — **KOREKSI TERHADAP ANGKA YANG BEREDAR**

> **Angka yang beredar (7 false positive, 4 cacat) SALAH.** Yang benar: **5 false positive,
> 6 cacat.**

Asal kekeliruannya, dicatat supaya tidak lahir lagi: laporan `DS-23` menulis judul bagian
*"FALSE POSITIVES — 7 dari 11 titik"* dengan ikut menghitung dua judul modal yang memang
sudah benar (`BomsPage:941`, `CustomerPurchaseOrdersPage:977`). **Keduanya bukan bagian dari
sebelas titik itu** — mereka situs tambahan **di dalam** halaman yang cacatnya nyata. Boms dan
CPO tetap punya lompatan sungguhan di `575` dan `582`.

Menghitungnya sebagai false positive melakukan dua kesalahan sekaligus: menggelembungkan
jumlah temuan palsu, **dan** menghilangkan dua halaman dari daftar cacat yang benar-benar
diperbaiki. Brief batch ini mewarisi angka itu; koreksinya dicatat di sini dan di catatan
task `DS-24`.

**Kelima false positive yang sebenarnya** — seluruhnya `h1` ganda, dan **nol** di antaranya
benar-benar ganda:

`AiProjectDashboardPage` · `CompanySettingsPage` · `OperatingProfitPage` ·
`ProcessMiningPage` · `TeamManagePage`

Kelimanya menaruh `<h1>` di dalam `if (accessDenied) { return … }` — **cabang yang saling
meniadakan**. Bila cabang penolakan tampil, `KepalaHalaman` tidak dirender sama sekali.

Dibuktikan **secara struktural**, bukan lewat penalaran: penjaga (d) memetakan blok
penolakan, **lulus** untuk kelimanya, lalu **gagal** begitu sebuah `<h1>` disisipkan di
cabang normal.

## 3. ACTUAL DEFECT = 6 titik → **13 elemen judul di 7 halaman**

Enam titik temuan awal seluruhnya cacat sungguhan. Saat dibuka per elemen judul, keenamnya
memuat 12 elemen — dan penjaga menambahkan satu halaman ketujuh.

| # | Berkas | Baris | Dari | Ke | Wadah |
|---|---|---|---|---|---|
| 1 | `BomsPage` | 575 | h3 | **h2** | baris tabel dimekarkan |
| 2 | `CustomerPurchaseOrdersPage` | 582 | h3 | **h2** | baris tabel dimekarkan |
| 3 | `ItemsPage` | 716 | h4 | **h2** | panel detail |
| 4–5 | `ItemsPage` | 757 · 897 | h4 | **h3** | dua subbagian **di dalam** panel detail |
| 6 | `PurchasingPage` | 677 | h4 | **h3** | baris supplier, di bawah `h2` |
| 7 | `PurchasingPage` | 1367 | h4 | **h3** | di dalam modal |
| 8–11 | `WorkOrdersPage` | 602·714·782·813 | h4 | **h2** | empat judul sejajar, baris dimekarkan |
| 12 | `ProductionDashboardPage` | 676 | h4 | **h3** | di bawah `h2` "Work Order" |
| 13 | `RoutingsPage` | 772 | h2 | **h3** | di dalam modal — **tingkat kembar** |

**`RoutingsPage` tidak ada di sebelas temuan awal.** Penjaga (c) yang menemukannya, bukan
manusia: bentuknya bukan lompatan melainkan **kembar** dengan `h2` bawaan `ModalHeader`, dan
pembacaan sumber melewatkannya.

**Hubungan antar judul dipertahankan.** Empat judul Work Order tetap sejajar; dua subbagian
Item tetap di bawah induknya. Yang diperbaiki **tingkat mutlaknya** — itulah batas antara
memperbaiki dan mendesain ulang.

## 4. ROOT CAUSE

**Dua permukaan, satu akar.**

- **RC-1 (11 elemen)** — judul di dalam keadaan yang bukan aliran utama: baris tabel yang
  dimekarkan dan panel detail. Tingkatnya dipilih tangan, tanpa hubungan dengan `h1` halaman.
- **RC-2 (2 elemen)** — judul di dalam modal, ditulis tanpa memperhitungkan bahwa
  `ModalHeader` **sudah** memancarkan `h2`.

**Akar tunggal di bawah keduanya**: tingkat judul dipilih **satu per satu saat menulis**, dan
tidak ada satu tempat pun yang menghubungkan sebuah judul dengan wadahnya. Carbon **punya**
mekanisme itu — `Section` + `Heading` — dan repo ini memakainya **nol kali**.

Ini kelas **"kebetulan benar"** yang CLAUDE.md catat: sebagian salinan benar, sebagian
meleset, dan tidak ada yang mengeluh sampai yang berikutnya lahir.

**Buktinya akarnya tunggal**: satu pola perbaikan menyelesaikan tujuh halaman, dan satu
penjaga menangkap ketiga belas elemen — termasuk satu yang tidak ditemukan manusia.

## 5. AFFECTED PAGES

**Terdampak (7)**: `/boms` · `/customer-purchase-orders` · `/items` · `/purchasing` ·
`/work-orders` · `/production` · `/routing`

**Diperiksa dan bersih (32)**. Yang layak disebut karena membuktikan polanya sudah dikuasai
di sebagian repo: `/shipments` (`h2` → `h3` ×3) dan `/warehouse` (`h2` → `h3` bersarang).

## 6. IMPLEMENTATION

**13 elemen, 14 baris, 7 berkas** — commit `5857779`. Diaudit ulang di batch ini
(`git show 5857779`): **setiap baris yang berubah adalah tag `<hN>`**. Nol logika bisnis,
nol API, nol skema, nol migrasi produk, nol navigasi, nol tema, nol CSS, nol desain ulang
modal, nol perubahan visual lain.

**Tampilan tidak berubah, dan itu diukur**: `.halaman__subjudul` memberi **20px/400 sebagai
`h2` maupun `h3`**; `item-detail__judul` 20px sebagai `h2`; `item-bagian__judul` 20px sebagai
`h3`. Ditambah **nol selector berbasis tag `h1`–`h6`** di seluruh SCSS.

## 7. REGRESSION GUARD

`tests/hierarki_judul_lintas_halaman.test.ts` — **6 uji** (semula 5; uji (f) ditambahkan di
batch ini).

| Uji | Yang dijaga | Dibuktikan menggigit dengan |
|---|---|---|
| (a) | `KepalaHalaman`/`LayarPublik` masih memancarkan `h1` — **tripwire** | mengubah komponennya jadi `h2` → **hanya (a)** berbunyi |
| (b) | judul di luar modal tidak melompat | `WorkOrders:602` dikembalikan ke `h4` |
| (c) | judul di dalam modal mulai `h3` | `Routing:772` dikembalikan ke `h2` |
| (d) | `h1` mentah hanya di cabang penolakan | `<h1>` disisipkan di cabang normal |
| (e) | tujuh halaman memakai tingkat terverifikasi | dua mutasi di atas |
| **(f)** | **judul bawaan Carbon tidak lebih tinggi dari pembungkusnya** | `Items:757` dikembalikan ke `h4` |

**Kenapa (f) ditambahkan.** Brief menuntut penjaga menangkap *"child heading yang lebih tinggi
dari parent"*, dan penjaga versi pertama **tidak menangkapnya** — pemeriksaan celah tidak
melihat `h4` yang membungkus `h3`, karena himpunan `{3,4}` tetap bersambung. Alat ukurnya
diperbaiki lebih dulu, sebelum apa pun disimpulkan darinya.

**Uji (a) sengaja ada sebagai tripwire**: kelima uji lain bergantung pada asumsi bahwa `h1`
datang dari komponen bersama. Bila `h1` itu pindah, mereka akan diam-diam salah tanpa satu
pun berubah warna.

**Batas penjaga, disebut terbuka**: ia memeriksa **himpunan** tingkat, bukan urutannya —
karena urutan **sumber bukan urutan DOM** (`renderDetailWo`, `detailBom`, `renderItemDetail`
ditulis di atas berkas, tampil di dalam baris tabel). Bentuk yang lolos: `h2` lalu `h4` di
halaman yang kebetulan juga memakai `h3`.

## 8. BROWSER VERIFICATION

Tenant uji `company.b@debug.mrp`. Seluruh non-GET **diblokir**, data disuntik lewat jawaban
API. **Nol baris tertulis.**

- **Batch DS-23**: 42 pengukuran (7 halaman × 6 lebar) + 8 keadaan detail/modal — nol
  lompatan, tepat satu `h1`, nol gulir menyamping, nol elemen melewati tepi kanan maupun kiri.
- **Batch ini (tersasar ulang)**: `/routing`, `/work-orders`, `/items` diukur ulang di
  **360 · 672 · 768 · 1280 · 1440 · 1920** — hasilnya di §13.

Delapan keadaan yang membuktikan ketiga belas judul benar-benar tampil:

| Keadaan | Urutan terukur |
|---|---|
| `/work-orders` baris dimekarkan | h1 → **h2 h2 h2 h2** |
| `/items` panel detail | h1 → **h2** → **h3** → h3 (Carbon) → **h3** |
| `/boms` · `/customer-purchase-orders` dimekarkan | h1 → **h2** |
| `/purchasing` baris supplier | h1 → h2 → **h3** → h2 |
| `/purchasing` modal · `/routing` modal | h1 → [modal] h2 · h2 · **h3** |
| `/production` batch terpilih | h1 → h2 h2 h2 → **h3** |

## 9. ACCESSIBILITY

| Yang diperiksa | Hasil |
|---|---|
| Struktur judul | tepat satu `h1`; nol tingkat dilompati di seluruh keadaan terukur |
| Urutan pembaca layar | diambil dari urutan DOM — yang benar-benar dibacakan |
| Pembalikan tingkat | satu ditemukan dan hilang: `h4` "Dokumen" tidak lagi memuat `h3` "Berkas" |
| Judul tersembunyi | tidak ikut dihitung — hanya yang benar-benar tampak |
| Fokus & nama aksesibel | tidak berubah: nol elemen interaktif disentuh |

## 10. CARBON CROSS-CHECK

Diukur dari paket terpasang `@carbon/react` 1.114.0 — bukan dari dokumentasi, bukan dari
ingatan.

| Komponen | Yang diukur | Akibatnya |
|---|---|---|
| `Heading` / `Section` | `HeadingContext` bawaan **1**; `Section` = induk+1 (maks 6) | Carbon punya jawabannya; repo memakainya **nol kali** |
| `ModalHeader` | `label` **dan** `title` **keduanya `<h2>`** | judul pertama badan modal = **h3** |
| `Modal` / `Dialog` | `as: "h2"` | sama |
| `TableContainer` | sebuah `Section`, tetapi repo tidak memberinya `title` | tidak memancarkan judul |
| `FileUploader` | `labelTitle` **dipaku `as: "h3"`** | dasar uji (f) |
| `FileUploaderButton` | **nol judul** | sengaja tidak disisir uji (f) — memasukkannya akan menuduh `/profile` dan `/shipments` tanpa sebab |

## 11. CANONICAL TASK ID = **`DS-24`**

Diperiksa terhadap **empat** syarat, satu per satu:

1. **Tidak ada di `build_tasks`** — registri memuat `DS-01`…`DS-22` saja.
2. **Tidak dicadangkan di register** — `CANONICAL-ID-REGISTER-2026-08-27.md` mencadangkan
   **tepat satu** nomor `DS`, yaitu `DS-21` untuk F-01/F-11 (§4).
3. **Tidak dipakai temuan lain** — sepuluh temuan `F-xx` lain di §4 menunggu ID, tetapi
   **tidak ada nomor yang dicadangkan** untuk mereka.
4. **Tidak bertentangan dengan register** — §4 menutup dengan *"Next free numbers are `DS-21`
   and `AUD-49`"*; `DS-21`/`DS-22` sudah terpakai dan `DS-23` dicadangkan, sehingga `DS-24`
   adalah nomor `DS` pertama yang benar-benar bebas.

## 12. ID COLLISION `DS-23`

Pekerjaan ini semula dilabeli `DS-23`. Label itu **salah dan tidak pernah menjadi task**:
`DS-23` sudah **dicadangkan** untuk temuan **F-01/F-11** (sistem token paralel, 181 pemakaian
di 17 berkas) di `FABRIX_TASK_ID_RECONCILIATION_DS21_DS22.md` §7 butir 2 — berstatus
**PROPOSED**, menunggu keputusan pemilik produk yang **belum pernah dijawab**.

Skrip alokator melaporkan `DS-23` kosong karena ia membaca basis data, sedangkan pencadangan
hidup di markdown. Dokumen rekonsiliasi itu sendiri sudah menandai celah ini (§7 butir 4) dan
mengusulkan dua jalan menutupnya; keduanya masih menunggu keputusan.

## 13. F-01/F-11 RESERVATION — **UTUH**

Diverifikasi **sesudah** migrasi dijalankan, di ketiga project:

| Project | `DS-23` di `build_tasks` |
|---|---|
| Data nyata `kfvtrwuuqcjfkkuqizxt` | **0 baris** |
| Uji `nclkepwlsgmfbslgsajq` | **0 baris** |
| CI `gzxrgbwhmjwiakcyjipd` | **0 baris** |

Nol baris di migrasi `DS-24` menyebut `F-01` atau `F-11`. Pencadangannya tidak dipindahkan,
tidak dihapus, dan tidak diubah statusnya.

**Kontainmen migrasi** — potret jumlah baris **eksak** (bukan `n_live_tup`) untuk seluruh
**91 tabel** `public`, diambil sebelum dan sesudah di ketiga project:

| Project | Tabel berubah | Perubahannya |
|---|---|---|
| Data nyata | **1 dari 91** | `build_tasks` 324 → 325 |
| Uji | **1 dari 91** | `build_tasks` 184 → 185 |
| CI | **1 dari 91** | `build_tasks` 184 → 185 |

Satu baris di masing-masing adalah `DS-24`. **Nol perubahan di 90 tabel lain.**

## 14. FINAL TASK STATUS

| | |
|---|---|
| Kode | **`DS-24`** |
| Nama | Hierarki Judul: Judul yang Melompat Tingkat dan Judul Anak yang Lebih Tinggi dari Induknya |
| Status | **`selesai`** |
| Urgensi | `penting` |
| `completed_at` | terisi |
| Task lain | **nol disentuh**, nol urgensi diubah |

Definition of Done diperiksa butir demi butir: **17 dari 17 terpenuhi**. Dua butir yang
sebelumnya gagal — *ID verified* dan *task status correct* — keduanya adalah nomor task ini
sendiri, dan keduanya kini terpenuhi.

> **Status `selesai` BUKAN untuk menaikkan angka.** Implementasi, penjaga, bukti peramban,
> dan aksesibilitasnya sudah masuk repositori sebelum batch ini; yang tertunda hanya
> kepemilikan nomornya. Mencatatnya `menunggu` lalu menutupnya di migrasi berikutnya akan
> menghasilkan dua baris riwayat untuk satu kenyataan.

**UI Revision Completion tetap 0 dari 22.** `DS-24` adalah perbaikan **kelas**, bukan
penyelesaian halaman.

## 15. REMAINING CLASS REMEDIATION

Terukur, **belum dikerjakan**:

| Kelas | Terukur |
|---|---|
| `invalidText` / galat field | **5** dari **237** kontrol form; 22 dari 26 halaman nol galat per-field |
| Peta label disalin | **10** kelompok; tiga terbesar ×3 |
| Kegagalan yang tidak terlihat | **32** titik di 13 halaman (`if (ok)` tanpa cabang gagal) |
| Status/aksi tanpa pasangan | **13** dari **122** route tanpa pemanggil UI |

Ditambah lima temuan dari kelas ini sendiri: **T-D1** (lima cabang penolakan akses menulis
judul dengan tangan — 14 dari 19 halaman sudah memakai `KepalaHalaman`), **T-D2**
(`FileUploader` memaku `h3`), **T-D3** (`Section`+`Heading` dipakai nol kali), **T-D4**
(penjaga memeriksa himpunan, bukan urutan), **T-D5** (`SuratJalanPrintPage` tanpa `h1`).

Dan satu yang bukan temuan teknis melainkan **governance**: pencadangan ID masih hidup di
markdown sementara alokator membaca basis data. Selama itu bertahan, tabrakan yang sama akan
terulang.
