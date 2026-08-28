> **DOKUMEN INI DIGANTIKAN.** Nomor task yang benar adalah **`DS-24`**, bukan `DS-23`
> (`DS-23` dicadangkan untuk F-01/F-11). Dan aritmetika di dalamnya keliru: yang benar
> **5 false positive / 6 cacat**, bukan 7/4. Keduanya dikoreksi di
> `FABRIX_HEADING_HIERARCHY_FINAL_REPORT.md` — baca itu sebagai keadaan sekarang.

# DS-23 — PERBAIKAN KELAS: HIERARKI JUDUL LINTAS HALAMAN

> **PERINGATAN ID DI PALING ATAS, karena inilah satu-satunya hal di batch ini yang BELUM
> selesai dan tidak boleh terlewat**: kode **`DS-23` TIDAK DIDAFTARKAN**. Ia sudah
> **dicadangkan** untuk temuan lain. Rinciannya di §10. Seluruh pekerjaan di bawah selesai
> dan terbukti; yang menggantung hanya nomornya.

---

## 1. OBJECTIVE

Memperbaiki **kelas** cacat hierarki judul di seluruh halaman — bukan mempercantik halaman,
bukan mendesain ulang. Cacat ini tidak terlihat di layar: ukuran judul diatur **kelas CSS**,
bukan tag. Yang membacanya adalah pembaca layar, dan bagi penggunanya sebuah lompatan
tingkat berarti **"ada bagian yang terlewat"**.

Karena tidak terlihat, cacat ini mustahil ditemukan lewat tangkapan layar dan hanya bisa
dijaga oleh penyisir. Itu sebabnya keluaran utama batch ini bukan tiga belas baris yang
diubah, melainkan **penjaganya**.

## 2. BASELINE

| | |
|---|---|
| HEAD awal | `fbc0c87` |
| Pohon kerja | bersih, kecuali `docs/00-GOVERNANCE/` (untracked, **sudah ada sebelumnya, bukan dari batch ini**) |
| `git diff` / `git diff --cached` | kosong |
| Branch | `main`, 34 commit di depan `origin/main` |
| Uji sebelum | 76 berkas · 493 lulus · 7 dilewati |
| Lint sebelum | 28 masalah (16 error, 12 warning) |
| Typecheck sebelum | bersih |

## 3. EVIDENCE AWAL YANG DIWARISI

Dari pengukuran kelas sebelumnya: **11 titik** — **5 halaman ber-`h1` ganda** dan
**6 halaman melompat** `h1 → h3/h4`.

Disertai peringatan yang terbukti tepat: sensus mentah pertama menyimpulkan *"33 halaman
tanpa h1"*, dan itu **salah** — `h1`-nya ada, hanya tidak di berkas halamannya.

## 4. RE-VERIFICATION

Seluruh 11 titik diperiksa ulang **di sumber**, lalu **di DOM peramban**.

### 4a. Kenapa urutan sumber tidak dipercaya

`renderDetailWo`, `detailBom`, dan `renderItemDetail` ditulis **di atas** berkas tetapi
tampil **di dalam baris tabel** jauh di bawahnya. Penjaga yang membaca urutan sumber akan
melapor terbalik. Karena itu setiap klaim "lompat" di bawah berasal dari **DOM**, dan
penjaga otomatisnya sengaja memeriksa **himpunan tingkat**, bukan urutannya (§12).

### 4b. Tabel verifikasi

| Halaman | Titik | Wadah sebenarnya | Vonis |
|---|---|---|---|
| AiProjectDashboard · CompanySettings · OperatingProfit · ProcessMining · TeamManage | `h1` ganda | cabang `if (accessDenied)` — **return lebih awal** | **FALSE POSITIVE ×5** |
| BomsPage | `h3` baris 575 | baris tabel dimekarkan | **CACAT** |
| BomsPage | `h3` baris 941 | **di dalam modal** | **FALSE POSITIVE** |
| CustomerPurchaseOrders | `h3` baris 582 | baris tabel dimekarkan | **CACAT** |
| CustomerPurchaseOrders | `h3` baris 977 | **di dalam modal** | **FALSE POSITIVE** |
| ItemsPage | `h4` 716 / 757 / 897 | panel detail + dua subbagian di dalamnya | **CACAT ×3** |
| PurchasingPage | `h4` 677 | baris supplier dimekarkan, di bawah `h2` | **CACAT** |
| PurchasingPage | `h4` 1367 | **di dalam modal** "Buat PO baru" | **CACAT** |
| WorkOrdersPage | `h4` 602 / 714 / 782 / 813 | baris WO dimekarkan | **CACAT ×4** |
| ProductionDashboard | `h4` 676 | baris WO dimekarkan, di bawah `h2` | **CACAT** |
| **RoutingsPage** | `h2` 772 | **di dalam modal** | **CACAT — TIDAK ADA di 11 temuan awal** |

## 5. FALSE POSITIVES — 7 dari 11 titik

### 5a. Lima `h1` ganda — nol di antaranya benar-benar ganda

Kelimanya berada di dalam `if (accessDenied) { return … }`. Itu **cabang yang saling
meniadakan**: bila cabang penolakan tampil, `KepalaHalaman` tidak dirender sama sekali.
**Kedua `h1` tidak pernah ada di halaman yang sama.**

Dibuktikan bukan lewat penalaran saja, melainkan **secara struktural**: penjaga (d)
memetakan blok `accessDenied` dan menerima `h1` di dalamnya — dan penjaga itu **lulus**
untuk kelima halaman, lalu **gagal** begitu sebuah `h1` disisipkan di cabang normal (§12).

> Perlu disebut: ini **tetap cacat**, hanya bukan cacat *hierarki*. Kelimanya menulis judul
> halaman dengan tangan alih-alih memakai `KepalaHalaman`, sedangkan **14 dari 19** halaman
> ber-cabang-penolakan sudah memakainya. Itu kelas "dua jalur hidup", dicatat di §17 —
> **tidak dikerjakan di sini**, sesuai aturan FOKUS SATU TASK.

### 5b. Dua `h3` di dalam modal — justru sudah benar

`ModalHeader` Carbon memancarkan `h2`. Judul pertama di badan modal karena itu **memang
h3**. Boms 941 dan CPO 977 sudah benar sejak awal; keduanya **tidak disentuh**.

## 6. CACAT SEBENARNYA — 13 elemen judul di 7 halaman

| # | Berkas | Baris | Dari | Ke | Alasan |
|---|---|---|---|---|---|
| 1 | BomsPage | 575 | h3 | **h2** | baris dimekarkan; halaman tidak punya h2 lain |
| 2 | CustomerPurchaseOrders | 582 | h3 | **h2** | sama |
| 3 | ItemsPage | 716 | h4 | **h2** | panel detail |
| 4 | ItemsPage | 757 | h4 | **h3** | subbagian **di dalam** panel detail |
| 5 | ItemsPage | 897 | h4 | **h3** | sama |
| 6 | PurchasingPage | 677 | h4 | **h3** | di bawah `h2` "Supplier" |
| 7 | PurchasingPage | 1367 | h4 | **h3** | di dalam modal (h2 dari ModalHeader) |
| 8–11 | WorkOrdersPage | 602·714·782·813 | h4 | **h2** | empat judul sejajar di baris dimekarkan |
| 12 | ProductionDashboard | 676 | h4 | **h3** | di bawah `h2` "Work Order" |
| 13 | RoutingsPage | 772 | h2 | **h3** | di dalam modal — **tingkat kembar**, bukan lompatan |

**Hubungan antar judul dipertahankan apa adanya.** Empat judul Work Order tetap sejajar;
dua subbagian Item tetap berada di bawah induknya. Yang diperbaiki **tingkat mutlaknya**,
bukan strukturnya — itulah batas antara memperbaiki dan mendesain ulang.

## 7. ROOT CAUSES

Tiga belas kejadian, **dua permukaan, satu akar**.

**RC-1 — judul di dalam keadaan yang bukan aliran utama (11 elemen).** Kategori C+G. Judul
di baris tabel yang dimekarkan dan di panel detail ditulis dengan tingkat yang dipilih
tangan, tanpa hubungan apa pun dengan `h1` halamannya.

**RC-2 — judul di dalam modal (2 elemen).** Kategori E. Ditulis tanpa memperhitungkan bahwa
`ModalHeader` **sudah** memancarkan `h2`. Purchasing menulis terlalu rendah (`h4`), Routing
menulis **kembar** (`h2`).

**AKAR TUNGGAL DI BAWAH KEDUANYA:** tingkat judul dipilih **satu per satu saat menulis**,
dan tidak ada satu tempat pun yang menghubungkan sebuah judul dengan wadahnya. Carbon
**punya** mekanisme itu (`Section` + `Heading`, §9) dan repo ini memakainya **nol kali**.

Ini persis kelas yang CLAUDE.md sebut **"kebetulan benar"**: sesuatu ditulis berulang di
banyak tempat, kebenarannya bergantung pada penulisnya mengingat caranya, dan sebagian
kebetulan benar sementara sebagian meleset — tanpa ada yang mengeluh.

**Bukti bahwa akarnya tunggal**: satu perbaikan pola yang sama menyelesaikan **7 halaman**,
dan penjaga yang sama menangkap ketiga belas elemen sekaligus — termasuk satu yang
**tidak ditemukan manusia** (Routing).

## 8. HALAMAN TERDAMPAK & TIDAK TERDAMPAK

**Terdampak (7)**: `/boms` · `/customer-purchase-orders` · `/items` · `/purchasing` ·
`/work-orders` · `/production` · `/routing`.

**Diperiksa dan TIDAK terdampak (32)** — 39 halaman disisir seluruhnya. Yang layak disebut
karena membuktikan polanya sudah dikuasai di tempat lain:

| Halaman | Kenapa sudah benar |
|---|---|
| `/shipments` | `h2` bagian → `h3` detail ×3 |
| `/warehouse` | `h2` bagian → `h3` bersarang |
| 12 halaman ber-`h2` tunggal | satu tingkat di bawah `h1`, tidak ada yang dilompati |
| 6 layar publik | `h1` dari `LayarPublik` |

## 9. CARBON CROSS-CHECK

**Diukur dari paket yang benar-benar terpasang** (`@carbon/react` 1.114.0), bukan dari
dokumentasi dan bukan dari ingatan — sesuai DS-RULES D.2.

| Yang diperiksa | Hasil ukur | Akibatnya di sini |
|---|---|---|
| `Heading` / `Section` | `HeadingContext` bawaan **1**; `Section` = induk+1 (maks 6); `Heading` merender `h{context}` | Carbon **punya** jawabannya; repo memakainya nol kali (§17) |
| `ModalHeader` | `label` **dan** `title` **keduanya `<h2>`** | judul pertama badan modal = **h3** |
| `Modal` polos | `as: "h2"` | sama |
| `TableContainer` | ia sebuah `Section`, tetapi repo **tidak** memberinya `title` | tidak memancarkan judul — nol judul ganda |
| `FileUploader` | `labelTitle` **dipaku `as: "h3"`** | lihat temuan tak terduga di bawah |

**Temuan tak terduga yang lahir dari sini.** Sebelum perbaikan, `/items` memuat `h4`
"Dokumen" yang **berisi** `h3` "Berkas" milik Carbon — anak berjudul **lebih tinggi**
daripada induknya. Itu **pembalikan tingkat**, bentuk yang lebih buruk daripada lompatan,
dan tidak ada di 11 temuan awal. Perbaikan ini menghapusnya: keduanya kini `h3` dan
terbaca sejajar.

**Yang TIDAK dilakukan.** Tidak ada tag yang diubah supaya ukurannya terlihat sama. Diukur
di peramban: `.halaman__subjudul` memberi **20px/400 baik sebagai `h2` maupun `h3`**, dan
`item-detail__judul`/`item-bagian__judul` juga 20px. Nol selector berbasis tag di seluruh
SCSS. **Perubahan ini murni semantik.**

## 10. GOVERNANCE MAPPING — DAN TABRAKAN ID

### 10a. Tabrakan `DS-23` — STOP dijalankan

Skrip alokator melaporkan `DS-23` kosong. **Brief melarang mempercayainya**, dan larangan
itu terbukti benar: `DS-23` **sudah dicadangkan** untuk temuan **F-01/F-11** (sistem token
paralel, 181 pemakaian di 17 berkas), tercatat di enam dokumen:

- `FABRIX_TASK_ID_RECONCILIATION_DS21_DS22.md` §7 butir 2 dan §8
- `FABRIX_FORM_GOVERNANCE_DECISION_RECORD.md` §7 (`PROPOSED`)
- `FABRIX_FORM_GOVERNANCE_FINAL_DECISION_PACKAGE.md` · `_HANDOFF.md` · `_FINAL_HANDOFF.md`
- `FABRIX_UI_QUALITY_SWEEP_REPORT.md` §; `_HANDOFF.md`

Pencadangan itu **menunggu keputusan pemilik produk yang belum pernah dijawab**, dan
dokumennya sendiri menutup dengan *"Sampai dijawab, tidak ada yang diubah."*

**Yang dilakukan**: nol task dibuat, nol task diubah, `build_tasks` **tidak disentuh sama
sekali**. Basis data nyata hanya **dibaca** (`select`).

**Yang dibutuhkan**: satu keputusan — nomor mana untuk pekerjaan ini, dan nomor mana untuk
F-01/F-11.

### 10b. Koreksi terhadap brief

Brief menyebut `DS-24`, `DS-25`, `DS-26`, `DS-27` sebagai hal yang tidak boleh diubah.
**Keempatnya tidak ada** di `build_tasks` maupun di dokumen mana pun. Disebutkan supaya
tidak ada yang mengira ada pekerjaan yang sedang dijaga di sana. (`AUD-49` juga tidak ada;
`AUD-42`, `MST-09`, `DS-06`, `DS-19`, `DS-20` ada dan **tidak disentuh**.)

### 10c. Aturan yang ditegakkan batch ini

| Aturan | Penerapan |
|---|---|
| DS-RULES D.2 — nama & nilai token dari paket terpasang, dengan **menjalankan** | §9, lima komponen Carbon dibaca dari `node_modules` |
| "Periksa apa yang SUDAH dibawa komponen" | `ModalHeader` sudah membawa `h2`; halaman menambah `h2` kedua |
| "Dua jalur hidup" / "kebetulan benar" | §7 — akar tunggalnya |
| Aturan bukti visual, enam lebar, **dua tepi** | §13 — 42 pengukuran |
| "Penjaga yang salah tuduh **diperketat**, bukan dibiarkan" | §16 — dua pengukur saya sendiri salah dan diperbaiki di giliran yang sama |
| FOKUS SATU TASK | lima temuan di luar kelas **dicatat**, nol dikerjakan (§17) |

## 11. SOLUTION

**Yang dipilih**: menetapkan tingkat yang benar di tempatnya, **plus penjaga penyisir**.

**Yang TIDAK dipilih, beserta alasannya**: mengganti seluruh judul dengan `Section` +
`Heading` Carbon. Itu jawaban Carbon dan secara struktural lebih baik — tingkatnya
menghitung diri sendiri. Ditolak **untuk sekarang** karena tiga hal: ia menyentuh 7 halaman
jauh lebih dalam daripada 13 baris, `Section` merender elemen `<section>` yang mengubah
landmark aksesibilitas, dan brief melarang mengubah komponen bersama tanpa inventaris
konsumen. **Dicatat sebagai temuan tertunda, bukan dibuang** (§17, T-D3).

Perubahan: **13 elemen judul, 14 baris, 7 berkas.** Nol logika bisnis, nol API, nol basis
data, nol migrasi, nol navigasi, nol tema, nol CSS, nol perubahan modal.

## 12. TESTS

Berkas baru: **`tests/hierarki_judul_lintas_halaman.test.ts`** — 5 uji.

| Uji | Yang dijaga |
|---|---|
| (a) | `KepalaHalaman` & `LayarPublik` masih memancarkan `h1` — **tripwire**: bila ini berubah, keempat uji lain diam-diam salah |
| (b) | judul di luar modal tidak melompati tingkat |
| (c) | judul di dalam modal mulai dari `h3` — karena `ModalHeader` sudah `h2` |
| (d) | `h1` mentah hanya boleh di cabang penolakan akses |
| (e) | tujuh halaman yang diperbaiki memakai tingkat yang sudah diverifikasi |

### RED → GREEN

**MERAH lebih dulu**: 3 dari 5 gagal, menyebut persis enam halaman —
`BomsPage [1,3] hilang h2` · `CustomerPurchaseOrders [1,3] hilang h2` ·
`ItemsPage [1,4] hilang h2` · `PurchasingPage [1,2,4] hilang h3` ·
`WorkOrdersPage [1,4] hilang h2` · `ProductionDashboard [1,2,4] hilang h3` — **plus
`RoutingsPage: judul tertinggi di modal h2, seharusnya h3`**, yang tidak ditemukan
pembacaan sumber. **HIJAU sesudah**: 5 dari 5.

### Tiap penjaga dibuktikan MENGGIGIT

Bukan diasumsikan. Cacatnya disisipkan kembali satu per satu:

| Mutasi | Yang berbunyi |
|---|---|
| `KepalaHalaman` diubah jadi `h2` | (a) — **hanya (a)**, persis fungsinya sebagai tripwire |
| WorkOrders 602 dikembalikan ke `h4` | (b) + (e) |
| Routing 772 dikembalikan ke `h2` | (c) + (e) |
| `<h1>` disisipkan di cabang normal | (d) |

Seluruh mutasi dipulihkan; `git diff --stat` sesudahnya persis 14 baris.

## 13. BROWSER EVIDENCE

Tenant uji `company.b@debug.mrp`. Seluruh non-GET **diblokir**; data disuntik lewat jawaban
API. **Nol baris tertulis ke basis data mana pun.**

### 13a. Enam lebar × tujuh halaman = 42 pengukuran

360 · 672 · 768 · 1280 · 1440 · 1920 px. Hasil: **nol lompatan · tepat satu `h1` ·
nol gulir menyamping · nol elemen melewati tepi kanan · nol melewati tepi kiri**.

### 13b. Delapan keadaan detail & modal (1440px)

| Keadaan | Urutan judul terukur |
|---|---|
| `/work-orders` baris dimekarkan | h1 → **h2 h2 h2 h2** (sebelumnya h1 → h4) |
| `/items` panel detail | h1 → **h2** → **h3** (Dokumen) → h3 (Berkas, milik Carbon) → **h3** (Supplier) |
| `/boms` baris dimekarkan | h1 → **h2** |
| `/customer-purchase-orders` baris dimekarkan | h1 → **h2** |
| `/purchasing` baris supplier dimekarkan | h1 → h2 → **h3** → h2 |
| `/purchasing` modal "Buat PO baru" | h1 → h2 → h2 → [modal] h2 label · h2 judul · **h3** |
| `/routing` modal | h1 → [modal] h2 label · h2 judul · **h3** |
| `/production` batch terpilih | h1 → h2 h2 h2 → **h3** |

**Nol lompatan di kedelapan keadaan.** Ketiga belas judul yang diubah terlihat langsung di
peramban — bukan disimpulkan dari kode.

### 13c. Bukti bahwa tampilannya TIDAK berubah

Diukur di DOM: `.halaman__subjudul` = **20px/400 sebagai `h2` MAUPUN `h3`**;
`item-detail__judul` 20px sebagai `h2`; `item-bagian__judul` 20px sebagai `h3`; `h1`
tetap 28px. Ditambah **nol selector berbasis tag `h1`–`h6`** di seluruh SCSS.

## 14. ACCESSIBILITY

| Yang diperiksa | Hasil |
|---|---|
| Struktur judul | tepat satu `h1` per halaman di 42 pengukuran; nol tingkat dilompati di 8 keadaan |
| Urutan semantik pembaca layar | urutan DOM diambil dari `document.querySelectorAll` — **urutan yang benar-benar dibacakan**, bukan urutan sumber |
| Pembalikan tingkat | satu ditemukan dan hilang: `h4` "Dokumen" tidak lagi memuat `h3` "Berkas" |
| Judul tersembunyi ikut terhitung? | tidak — hanya judul yang benar-benar tampak |
| Fokus & nama aksesibel | **tidak berubah**: nol elemen interaktif disentuh |

**Tidak disimpulkan dari tangkapan layar.** Seluruhnya dari DOM.

## 15. REGRESSION

| | Sebelum | Sesudah |
|---|---|---|
| Berkas uji | 76 | **77** (+1, berkas baru) |
| Uji lulus | 493 | **498** (+5, uji baru) |
| Dilewati | 7 | 7 |
| Gagal | 0 | **0** |
| Lint | 28 (16 error, 12 warning) | **28 — persis baseline** |
| Typecheck | bersih | **bersih** |

Selisih uji **seluruhnya** dari berkas baru. Nol test lama berubah, nol dinonaktifkan.

## 16. KOREKSI PENGUKURAN SAYA SENDIRI

Dicatat karena kelas cacat ini sudah berulang di proyek ini, dan menyembunyikannya akan
mengulanginya lagi. **Tiga pengukur saya sendiri melapor salah, ketiganya diperketat di
giliran yang sama** — sesuai aturan "penjaga yang salah tuduh diperketat, bukan dibiarkan".

1. **Sensus `h1` → "33 halaman tanpa `h1`".** Salah: `h1` datang dari `KepalaHalaman` dan
   `LayarPublik`. Setelah dibetulkan: **11 titik**, bukan 33 halaman.
2. **Sensus "kegagalan diam" → 101 titik.** Pengukurnya ikut menuduh `if (!response.ok)` —
   penanganan yang justru **benar**. Diverifikasi ke tiga berkas, diperketat ke bentuk
   positif saja: **32**. (Ini milik kelas lain, tercatat untuk batch berikutnya.)
3. **Sensus route yatim → 40.** Segmen `[itemId]` dicocokkan sebagai teks harfiah padahal
   pemanggilnya memakai template. Setelah dicocokkan sebagai pola: **13**.

Dan satu **kegagalan pengukuran di peramban**: percobaan pertama membuka modal `/purchasing`
melaporkan `terbuka=true` padahal kliknya **berpindah halaman** — judulnya berubah jadi
"PO klien". Tertangkap karena judulnya dibaca, bukan karena statusnya dipercaya. Pengukur
ulang mencatat URL sebelum & sesudah supaya bentuk kegagalan itu tidak bisa lagi terbaca
sebagai keberhasilan.

## 17. DEFERRED FINDINGS — dicatat, TIDAK dikerjakan

| Kode | Temuan | Bukti | Urgensi jujur |
|---|---|---|---|
| **T-D1** | Lima cabang penolakan akses menulis `<h1 className="halaman__judul">` dengan tangan, bukan `KepalaHalaman` | **14 dari 19** halaman ber-cabang-penolakan sudah memakai `KepalaHalaman`; kelima ini menyimpang, dan cabangnya juga kehilangan remah roti | **Penting** — kelas "dua jalur hidup", bukan hierarki |
| **T-D2** | `FileUploader` Carbon memaku labelnya `as: "h3"` | `FileUploader.js:201` | **Bisa menunggu** — judul bagian tidak akan pernah bisa bersarang di bawahnya; batas Carbon, bukan kita |
| **T-D3** | `Section`+`Heading` Carbon dipakai **nol kali**; tingkat judul tetap dipilih tangan | §7 | **Penting** — penjaga sekarang menangkap pelanggarannya, tapi tidak mencegahnya |
| **T-D4** | Penjaga memeriksa **himpunan** tingkat, bukan urutannya | batas ditulis di kepala berkas ujinya | **Bisa menunggu** — bentuk yang lolos: `h2` lalu `h4` di halaman yang kebetulan juga memakai `h3` |
| **T-D5** | `SuratJalanPrintPage` tidak punya `h1` sama sekali | satu-satunya halaman tanpa sumber `h1` | **Bisa menunggu** — dokumen cetak; perlu keputusan, bukan perbaikan otomatis |

Kelimanya **tidak dikerjakan**, dan tidak satu pun masuk empat pengecualian FOKUS SATU TASK
(tidak menghalangi, bukan kebocoran/kehilangan data, tidak dirusak batch ini, bukan satu
baris yang jelas benar).

## 18. FINAL STATUS

### DS-23 — pekerjaan teknisnya **COMPLETE**, **ID-nya TIDAK**

| Butir Definition of Done | Status |
|---|---|
| ID verified | **GAGAL — dicadangkan, lihat §10a** |
| 11 temuan awal diperiksa ulang | LULUS |
| False positive dipisahkan | LULUS — 7 dari 11 |
| Cacat sebenarnya diidentifikasi | LULUS — 13 elemen di 7 halaman |
| Root cause diidentifikasi | LULUS — 2 permukaan, 1 akar |
| Carbon diperiksa | LULUS — 5 komponen, dari paket terpasang |
| Governance diperiksa | LULUS |
| Implementasi untuk lingkup aman | LULUS |
| RED → GREEN | LULUS, + tiap penjaga dibuktikan menggigit |
| Diverifikasi di peramban | LULUS — 42 + 8 pengukuran |
| Enam breakpoint | LULUS |
| Aksesibilitas diperiksa | LULUS |
| Regresi diperiksa | LULUS — nol |
| Production tidak tersentuh | LULUS — hanya `select` |
| Dokumentasi lengkap | LULUS |
| Status task benar | **GAGAL — tidak ada task untuk diperbarui** |
| Git bersih sesudah commit | LULUS |

**15 dari 17 lulus. Dua yang gagal adalah butir yang SAMA**: nomor task yang bukan hak saya
tetapkan. Menurut aturan brief — *"Jika sebagian tidak selesai: NOT COMPLETE"* —

> **DS-23 = NOT COMPLETE**, tertahan **hanya** pada satu keputusan penomoran.

### UI REVISION COMPLETION: **0 dari 22 — tidak berubah**

DS-23 adalah perbaikan **kelas**, bukan penyelesaian halaman. Ia **menghapus satu butir
kegagalan** yang menggagalkan `/routing` dan `/work-orders`, tetapi ketiga butir lain
(validasi belum bisa ditindaklanjuti, keadaan panel detail, kepemilikan task) masih berdiri.
