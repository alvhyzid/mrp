# FABRIX — REVISI UI /work-orders (PILOT #2)

**28 Agustus 2026 · HEAD awal `b562f7c` · AUDIT ULANG + IMPLEMENTASI**

---

## 1. BASELINE

| | |
|---|---|
| HEAD awal | `b562f7c` |
| Branch | `main`, ahead 32, **belum di-push** |
| Perubahan pra-ada | `docs/00-GOVERNANCE/` (belum terlacak) — **tidak disentuh** |
| Perubahan sumber sebelum batch | **nol** |

---

## 2. AS-IS — DIAUDIT ULANG, BUKAN DISALIN

1.188 baris TSX · 110 baris SCSS.

**Yang sudah benar dan TIDAK disentuh** — ini separuh hasil audit:

| Butir | Keadaan |
|---|---|
| `KepalaHalaman`, `DataTable`, `.tabel-responsif`, `Pagination`, `DataTableSkeleton` | ada |
| Baris yang bisa dimekarkan | ada |
| Pencarian + dua saringan | ada |
| **Nol `window.confirm`** | **sudah bersih** |
| **Penjaga peran tingkat halaman** | **ada** (`accessDenied`) |
| **Notifikasi membaca STATUS**, bukan ada-tidaknya pesan | **sudah benar** |
| Dua macam keadaan kosong **dibedakan** | sudah benar — itu bagian sulitnya |
| Gulir menyamping, 6 lebar | **nol** |

### Bagian audit yang hampir menghasilkan PASS PALSU

Pengukuran pertama melaporkan halaman **bersih di enam lebar**. Setelah diperiksa, tabelnya
**KOSONG** — fixture memakai kunci `work_orders` sedangkan jawaban sungguhan memakai
`workOrders`. Yang menangkapnya bukan tampilan layar, melainkan **menghitung baris tabel**.

Dengan tabel terisi, dua hal baru muncul yang tidak terlihat saat kosong: lompatan hierarki
judul, dan satu galat konsol.

---

## 3. INVENTARIS CACAT

Audit sebelumnya mencatat **13 cacat**. Audit ulang ini memverifikasi satu per satu.

| # | Cacat | Prioritas | Kelas | Sifat | Dikerjakan? |
|---|---|---|---|---|---|
| **W-1** (#6) | Modal formulir **dua kolom** | P1 | FORM · UX | PAGE-SPECIFIC | **YA** |
| **W-2** (#12) | Pesan galat membocorkan nama kolom Inggris | P2 | UX · GOVERNANCE | PAGE-SPECIFIC | **YA** |
| **W-3** (#9) | Keadaan kosong tanpa jalan keluar | P2 | UX | PAGE-SPECIFIC | **YA** |
| **W-4** (#13) | `'Siap Mulai'` kapital tiap kata | P3 | VISUAL | PAGE-SPECIFIC | **YA** |
| #1/#2 | Jeda/Batal Work Order tidak bisa dicapai dari UI | P1 | WORKFLOW | **FITUR HILANG** | tidak |
| #4 | Hierarki judul melompat h1 → h4 | P2 | ACCESSIBILITY | **LINTAS HALAMAN** | tidak |
| #5 | Field mati `scheduled_end` | P2 | CORRECTNESS | **BUSINESS DECISION** | tidak |
| #7 | Nol validasi tingkat field | P2 | FORM | **LINTAS HALAMAN** | tidak |
| #8 | Tidak ada ringkasan draf | P2 | UX | PAGE-SPECIFIC | tidak — lihat §15 |
| #10 | Panel detail tanpa keadaan memuat/galat | P2 | UX | PAGE-SPECIFIC | tidak — lihat §15 |
| #11 | Empat peta label disalin | P2 | TECHNICAL DEBT | **LINTAS HALAMAN** | tidak |
| **#3** | *"Tidak ada penjaga peran tingkat halaman"* | — | — | **FALSE POSITIVE** | — |

### #3 adalah FALSE POSITIVE — dikoreksi

Audit sebelumnya menyatakan `/work-orders` *"satu-satunya dari empat halaman"* tanpa penjaga
peran. **Tidak benar.** Diukur: `accessDenied` muncul **2 kali**, persis sama dengan
`BomsPage`, `RoutingsPage`, dan `ItemsPage`. Penjaganya ada di baris 922, dinyalakan saat
konfigurasi hilang atau `/api/me` gagal.

### #1/#2 — kejadian KEEMPAT dari kelas yang CLAUDE.md catat tiga kali

Diverifikasi mandiri:

| Yang diperiksa | Hasil |
|---|---|
| `setWorkOrderStatus` ada dan mengizinkan `completed`/`paused`/`cancelled` | **ya**, dengan alasan wajib untuk paused/cancelled |
| Route `app/api/work-orders/status/route.ts` ada | **ya** |
| Pemanggil dari UI mana pun | **NOL** |
| `/work-orders` menawarkan saringan "Dijeda" dan "Batal" | **ya** |

Jadi halaman menawarkan **saringan untuk keadaan yang tidak bisa dihasilkan siapa pun**.

**TIDAK dikerjakan**: membangun UI-nya adalah **menambah fitur**, bukan merevisi UI — dan
menentukan peran mana yang boleh menjeda/membatalkan adalah keputusan alur kerja. `PRD-12`
(**selesai**) membangun sisi servernya; **tidak ada task yang memiliki sisi UI-nya**.

---

## 4. PEMETAAN CARBON & GOVERNANCE

| Cacat | Aturan |
|---|---|
| W-1 | `cetakan-halaman-data.md` §6e mengutip Carbon: *"form inputs and other components expand the entire width of a modal"*; membelah jadi dua kolom **dilarang** |
| W-2 | Aturan keras: seluruh teks yang dibaca pemilik produk wajib Bahasa Indonesia |
| W-3 | Cetakan §4: kosong-belum-ada-data → tombol membuat data pertama; kosong-karena-saringan → jalan menghapus saringan |
| W-4 | Aturan 25 Agu 2026: kapital hanya di awal kalimat |

---

## 5. TO-BE & IMPLEMENTASI

| Berkas | Perubahan |
|---|---|
| `app/(shell)/work-orders/work-orders.scss` | `.wo-form` jadi **satu kolom**, breakpoint dicabut; kelas `.wo-kosong` ditambahkan |
| `src/features/mrp/pages/WorkOrdersPage.tsx` | keadaan kosong menawarkan **dua jalan keluar berbeda**; `'Siap Mulai'` → `'Siap mulai'`; pesan galat jadi Bahasa Indonesia |
| `src/features/mrp/server/createProductionBatch.ts` | pesan galat jadi Bahasa Indonesia |

**Nol perubahan** pada rute, kontrak API, terminologi bisnis, navigasi, tema, atau komponen
bersama. **Nol halaman lain disentuh.**

---

## 6. UJI

`tests/work_orders_revisi_ui.test.ts` — **8 uji**, **MERAH lebih dulu (4 gagal)** lalu HIJAU.

Empat uji hijau sejak awal adalah **penjaga anti-regresi** untuk hal yang sudah benar:
isian berpasangan, dua macam kosong yang dibedakan, notifikasi yang membaca status, dan
penjaga peran + nol `window.confirm`.

**Satu penjaga sempat bisa LOLOS HAMPA dan langsung diperketat**: uji keadaan kosong mencari
`<Button>` mana pun di sekitar teks kosong — dan tetap hijau meski tombol "buat pertama"
dicabut, karena cabang kosong-karena-saringan punya tombolnya sendiri di jendela yang sama.
Diperketat ke **dua jalan keluar yang disebut namanya**, lalu dibuktikan menggigit.

---

## 7. BUKTI PERAMBAN

### Modal formulir — sebelum → sesudah

| Viewport | Lebar modal | Kolom | Lebar per kontrol |
|---|---|---|---|
| 360 | 360 px | 1 → 1 | 326 → 326 px |
| 672 | 564 px | **2 → 1** | **257 → 530 px** *(+106%)* |
| 768 | 645 px | **2 → 1** | **298 → 611 px** *(+105%)* |
| 1280 | 768 px | **2 → 1** | **359 → 734 px** *(+104%)* |
| 1440 | 691 px | **2 → 1** | **321 → 657 px** *(+105%)* |
| 1920 | 922 px | **2 → 1** | **436 → 888 px** *(+104%)* |

**Ongkosnya dilaporkan apa adanya**: isi modal kini **menggulir** (828 px isi dalam jendela
670 px di 768 px), sedangkan sebelumnya muat tanpa gulir di lima dari enam lebar. Satu kolom
memang lebih tinggi — dan §6e memang menerima itu: urutan eskalasinya *kurangi isi → naik
ukuran → halaman penuh*, **bukan** membelah kolom.

Kaki modal dan tombol utama **terlihat di keenam lebar**.

### Keadaan kosong

| | Hasil |
|---|---|
| Teks "Belum ada Work Order" | ada di keenam lebar |
| Tombol **"Buat Work Order pertama"** | **ada di keenam lebar** |
| Jalan **"Hapus saringan"** | ada pada cabang kosong-karena-saringan |

### Halaman

| | Hasil |
|---|---|
| Gulir menyamping | **nol di keenam** |
| Elemen melewati tepi kanan / kiri | **nol / nol** |
| Satu `<h1>` | ya |
| Tombol tanpa nama terbaca | **nol** |

---

## 8. AKSESIBILITAS

Satu `<h1>` · nol tombol tanpa nama · nol kontrol tanpa label · penjaga peran ada ·
nol `window.confirm`.

**Lompatan hierarki judul TETAP ADA** (h1 → h4) — dan sengaja tidak diperbaiki, §15.

---

## 9. KEAMANAN DATA

**Nol baris tertulis.** Seluruh non-GET diblokir di lapisan jaringan; data Work Order
disuntikkan lewat **jawaban API**, tidak pernah menyentuh basis data. Nol fixture dibuat,
jadi nol yang perlu dibersihkan.

---

## 10. REGRESI

**Nol regresi dari batch ini.**

### Dua hal yang TERLIHAT seperti cacat produk dan ternyata bukan

**(1) Galat konsol 404** saat baris dimekarkan.
Ditelusuri: `GET /api/production-batches?work_order_id=900001` → 404, dari
`listProductionBatches.ts:27` *"Work Order tidak ditemukan."* — karena fixture menyuntik
Work Order ke **daftar**, sedangkan panel detail menanyakannya ke **basis data sungguhan**.
**MEASUREMENT DEFECT**, bukan product defect.

> Dugaan pertama saya keliru: saya menyangka 404 itu berasal dari penghadang non-GET saya
> sendiri (yang menjawab 503). Yang membetulkannya adalah **menangkap URL-nya**, bukan
> menalar.
>
> **Tetapi ia memberi bukti nyata untuk temuan #10**: ketika panggilan itu gagal, panel
> **tidak menampilkan apa pun** — kegagalannya diam.

**(2) Tabel kosong pada pengukuran pertama** — fixture memakai kunci snake_case. Ditangkap
dengan menghitung baris tabel.

---

## 11. TEMUAN YANG DITUNDA

| # | Temuan | Kenapa ditunda |
|---|---|---|
| **T-W1** | UI jeda/batal Work Order tidak ada | **Fitur hilang**, bukan cacat UI. Peran mana yang boleh = keputusan alur kerja. Nol pemilik task |
| **T-W2** | Hierarki judul h1 → h4 | **Lintas halaman & tanpa aturan**: `BomsPage` memakai `h3`, `ItemsPage` (rujukan yang disetujui) dan `WorkOrdersPage` memakai `h4`. Mengubah satu halaman melahirkan varian **ketiga** |
| **T-W3** | Field mati `scheduled_end` | Ada di state, dikirim di payload, ditulis server, kolomnya ada — **nol kontrol**. Menambah kontrol = fitur; mencabut = keputusan. **Business decision** |
| **T-W4** | Nol `invalidText` | Kelas lintas halaman (5 dari 154 kontrol) — pemilik alaminya F-03 |
| **T-W5** | Tidak ada ringkasan draf sebelum menyimpan | Aturan modal butir 4 memang jelas, tetapi menerapkannya mengubah modal jadi **bertahap** — perubahan alur kerja, bukan poles |
| **T-W6** | Panel detail: kegagalan muat **diam** | Terbukti lewat 404 di §10. Perbaikannya menuntut keadaan memuat + galat pada panel |
| **T-W7** | Empat peta label disalin ke 9/8/3/2 berkas | Kelas lintas halaman, sama seperti kosakata absensi yang sudah disatukan |

---

## 12. KEPEMILIKAN TASK

**Nol perubahan `build_tasks`. Nol task dibuat.**

| Temuan | Pemilik kanonik |
|---|---|
| W-1 … W-4 | **belum ada** — usulan: satu task revisi UI `/work-orders` |
| T-W1 | `PRD-12` **selesai** (sisi server). Sisi UI **tidak dimiliki siapa pun** |
| T-W4 | F-03 di register, belum dibuat |
| T-W7 | belum ada |

> `DS-23` · `DS-24` · `AUD-49` masih kosong; **11 temuan** di register menunggu ID.
> Jangan memakai "kode berikutnya" tanpa membaca register.

---

## 13. DEFINITION OF DONE

| Butir | Status |
|---|---|
| AS-IS diverifikasi · scope jelas · defects identified · Carbon cross-check | **✓** |
| Hierarki informasi · tabel usable · expanded content usable | **✓** |
| Actions usable · destructive action aman | **✓** (nol `window.confirm`, penjaga peran ada) |
| Form sesuai governance | **✓** — satu kolom |
| **Validation actionable** | **✗** — T-W4 |
| Loading · empty · error · success state | **✓** untuk tabel; **✗** untuk panel detail (T-W6) |
| Responsif 6 breakpoint · no horizontal overflow | **✓** |
| Keyboard | **✓** |
| **Accessibility** | **✗** — T-W2 |
| Regression tests · browser evidence | **✓** |
| No unexpected regression · production untouched · fixture cleanup | **✓** |
| **Canonical task ownership** | **✗** |
| Documentation · git clean | **✓** |

---

## 14. STATUS AKHIR

> **`/work-orders` — NOT COMPLETE menurut Definition of Done.**

Empat butir gagal: validasi belum actionable, keadaan panel detail, aksesibilitas hierarki
judul, dan kepemilikan task.

**Tiga dari empat adalah kelas lintas halaman atau tanpa aturan** — pola yang **sama persis**
dengan pilot `/routing`. Dua pilot berturut-turut gagal pada butir yang sama, dan itu bukan
kebetulan: **Definition of Done memuat butir yang tidak bisa dipenuhi satu halaman pada satu
waktu.**

## 15. APAKAH /work-orders SIAP JADI REFERENCE IMPLEMENTATION?

**Belum.** Dan alasannya bukan kualitas halamannya:

- `/company/setelan` sudah jadi rujukan untuk **halaman formulir penuh (D-A)**
- `/routing` sudah membuktikan **pola baris berulang (D-B)**
- `/work-orders` tidak menyumbang pola baru — ia **menerapkan** aturan modal satu kolom yang
  sudah ada

Nilainya bukan sebagai rujukan, melainkan sebagai **bukti bahwa aturan yang sudah ada bisa
diterapkan berulang**, dan sebagai penemu **kejadian keempat** dari kelas status-tanpa-pemicu.
