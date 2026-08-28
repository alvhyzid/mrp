> **DOKUMEN INI DIGANTIKAN.** Nomor task yang benar adalah **`DS-24`**, bukan `DS-23`
> (`DS-23` dicadangkan untuk F-01/F-11). Dan aritmetika di dalamnya keliru: yang benar
> **5 false positive / 6 cacat**, bukan 7/4. Keduanya dikoreksi di
> `FABRIX_HEADING_HIERARCHY_FINAL_REPORT.md` — baca itu sebagai keadaan sekarang.

# DS-23 — HANDOFF: HIERARKI JUDUL LINTAS HALAMAN

Laporan penuh: `FABRIX_DS23_HEADING_HIERARCHY_REMEDIATION_REPORT.md`

---

## BLOCKER — dibaca lebih dulu

**Kode `DS-23` TIDAK didaftarkan.** Ia sudah **dicadangkan** untuk temuan F-01/F-11 (sistem
token paralel) di enam dokumen governance, menunggu keputusan pemilik produk yang belum
pernah dijawab. Brief memerintahkan STOP bila ini terjadi, dan STOP dijalankan:
**`build_tasks` tidak disentuh sama sekali.**

**Satu keputusan dibutuhkan**: nomor mana untuk pekerjaan hierarki judul ini, dan nomor mana
untuk F-01/F-11.

Koreksi terkait: **`DS-24`, `DS-25`, `DS-26`, `DS-27`, dan `AUD-49` tidak ada** di
`build_tasks` maupun dokumen mana pun — brief menyebutnya seolah sudah ada.

## APA YANG BERUBAH

**13 elemen judul, 14 baris, 7 berkas.** Hanya tag `<hN>` — nol logika, nol API, nol basis
data, nol migrasi, nol CSS, nol navigasi, nol tema.

| Berkas | Perubahan |
|---|---|
| `BomsPage.tsx` | h3 → h2 (baris dimekarkan) |
| `CustomerPurchaseOrdersPage.tsx` | h3 → h2 (baris dimekarkan) |
| `ItemsPage.tsx` | h4 → h2 (panel detail) · h4 → h3 ×2 (subbagian di dalamnya) |
| `PurchasingPage.tsx` | h4 → h3 (baris supplier) · h4 → h3 (modal PO) |
| `WorkOrdersPage.tsx` | h4 → h2 ×4 (baris dimekarkan) |
| `ProductionDashboardPage.tsx` | h4 → h3 (batch terpilih) |
| `RoutingsPage.tsx` | h2 → h3 (modal) |

## KENAPA

Judul yang melompat tingkat **tidak terlihat di layar** — ukurannya diatur kelas CSS, bukan
tag. Yang membacanya pembaca layar, dan bagi penggunanya lompatan berarti *"ada bagian yang
terlewat"*. Karena itu cacat ini mustahil ditemukan lewat tangkapan layar.

**Akarnya tunggal**: tingkat judul dipilih satu per satu saat menulis, tanpa satu tempat pun
yang menghubungkan judul dengan wadahnya. Carbon punya mekanisme itu (`Section`+`Heading`);
repo ini memakainya **nol kali**.

**Dua angka Carbon yang menentukan, diukur dari paket terpasang:**
- `ModalHeader` memancarkan `label` **dan** `title` **keduanya sebagai `h2`** → judul pertama di badan modal adalah **h3**.
- `TableContainer` adalah `Section`, tetapi repo tidak memberinya `title` → tidak memancarkan judul.

## HALAMAN TERDAMPAK

`/boms` · `/customer-purchase-orders` · `/items` · `/purchasing` · `/work-orders` ·
`/production` · `/routing`. **32 halaman lain diperiksa dan tidak terdampak.**

`/shipments` dan `/warehouse` sudah benar sejak awal — polanya memang sudah dikuasai di
sebagian repo, hanya tidak merata.

## PENJAGA REGRESI

`tests/hierarki_judul_lintas_halaman.test.ts` — 5 uji, MERAH lebih dulu (3 gagal), HIJAU
sesudah, dan **tiap penjaga dibuktikan menggigit** dengan menyisipkan ulang cacatnya.

Satu di antaranya adalah **tripwire**: uji (a) menjaga bahwa `KepalaHalaman` dan
`LayarPublik` masih memancarkan `h1`. Bila itu berubah, keempat uji lain diam-diam salah —
jadi penjaganya sendiri dijaga.

**Batas yang disebut terbuka**: penjaga memeriksa **himpunan** tingkat, bukan urutannya —
karena urutan sumber bukan urutan DOM (`renderDetailWo` ditulis di atas, tampil di bawah).
Bentuk yang lolos: `h2` lalu `h4` di halaman yang kebetulan juga memakai `h3`.

## BUKTI PERAMBAN

- **42 pengukuran** (7 halaman × 6 lebar): nol lompatan, tepat satu `h1`, nol gulir menyamping, nol elemen melewati tepi kanan maupun kiri.
- **8 keadaan detail & modal**: ketiga belas judul yang diubah terlihat langsung.
- **Tampilan tidak berubah**: `.halaman__subjudul` = 20px/400 sebagai `h2` maupun `h3`; nol selector berbasis tag di seluruh SCSS.
- **Nol baris tertulis** ke basis data mana pun — non-GET diblokir, data disuntik lewat jawaban API. Nol fixture dibuat, nol fixture perlu dibersihkan. Basis data nyata hanya **dibaca**.

## TEMUAN KELAS YANG MASIH BERDIRI

Diukur di batch ini, **belum dikerjakan**:

| Kelas | Terukur |
|---|---|
| `invalidText` / galat field | **5** dari **237** kontrol form; 22 dari 26 halaman nol galat per-field |
| Peta label disalin | **10** kelompok; tiga terbesar ×3 |
| Kegagalan yang tidak terlihat | **32** titik di 13 halaman (`if (ok)` tanpa cabang gagal) |
| Status/aksi tanpa pasangan | **13** dari **122** route tanpa pemanggil UI |

Lima temuan dari batch ini sendiri (T-D1…T-D5) ada di §17 laporan. Yang paling layak
dinaikkan: **T-D1** — lima cabang penolakan akses menulis judul halaman dengan tangan,
sementara 14 dari 19 halaman sudah memakai `KepalaHalaman`.

## TASK BERIKUTNYA

Sesuai urutan Anda sendiri, kelas berikutnya adalah **`invalidText` / galat field**
(nomor 1 di diagram). Ia yang terbesar — 237 kontrol — dan aturannya **sudah dijawab
Carbon** lewat pola Form validation, jadi tidak perlu keputusan Anda untuk memulainya.

**`/production` belum boleh dimulai.** Ia menunggu kelas yang jadi dependensinya, dan dua
di antaranya — validasi serta keadaan panel detail — belum dikerjakan.

## STOP

Sesuai brief: berhenti setelah DS-23. Tidak lanjut ke kelas berikutnya, tidak lanjut ke
`/production`, tidak ada desain ulang tambahan. Menunggu handoff.
