# FABRIX — UI QUALITY SWEEP REPORT

**28 Agustus 2026 · HEAD `5692ec5` · AUDIT SAJA — nol perubahan sumber, nol perubahan `build_tasks`**

---

## 1. RINGKASAN EKSEKUTIF

Sapuan ini mencari **kelas cacat**, bukan cacat per halaman, sebelum rollout dimulai.
Hasilnya **membalik dua kesan** yang lahir dari angka mentah — dan itu bagian paling
berharga dari sapuan ini.

| Kelas | Dugaan awal | Yang terukur |
|---|---|---|
| **N-1 DatePicker** | kelas lintas halaman | **satu-satunya pemakaian di repo**, dan sudah diperbaiki. `pattern=` tidak ada di tempat lain |
| **Notifikasi berhasil-sebagai-gagal** | 9 halaman "bersyarat ada-tidaknya pesan" | **nol halaman** menunjukkan tanda tangan `/purchasing` yang persis — cacat itu **tunggal** |
| **Validasi bawaan** | tertutup bersama N-1 | **TEMUAN BARU**: 5 atribut `required` di `/items` **tidak pernah menegakkan apa pun** |
| **Galat form** | `invalidText` 5 dari 154 | **terkonfirmasi persis**: 5 pemakaian di 4 berkas vs 123 `InlineNotification` |

**Kesimpulan untuk rollout**: tidak diperlukan penulisan ulang lintas halaman. Yang
diperlukan adalah **satu perbaikan pada komponen modal bertahap bersama** (temuan baru
di bawah) dan penerapan bertahap arsitektur galat form.

---

## 2. INVENTARIS DATEPICKER

Ditelusuri sampai implementasinya, bukan sekadar nama komponen.

| Berkas | Komponen | Format | Pola bawaan | Wajib | Dalam form | Risiko |
|---|---|---|---|---|---|---|
| `company/SetelanPerhitunganPage.tsx` | `DatePicker` + `DatePickerInput` | `Y-m-d` | **ditimpa** `\d{4}-\d{2}-\d{2}` | tidak | **ya** | **A — konsisten** |

**Tidak ada baris kedua.** `DatePicker` muncul di **satu** berkas di seluruh repositori, dan
`pattern=` muncul di **satu** tempat — yaitu perbaikan yang sudah dipasang.

### Klasifikasi

| Kelas | Jumlah |
|---|---|
| **A** — format dan pola bawaan konsisten | **1** |
| B — format berbeda tetapi validasi benar | 0 |
| C — format berbeda dan validasi dapat membisukan submit | **0** |
| D — tidak memakai validasi bawaan | 0 |
| E — tidak dapat diverifikasi | 0 |

---

## 3. TEMUAN DATEPICKER — DAN KELAS YANG LEBIH LUAS DI BALIKNYA

N-1 sebagai **cacat DatePicker** sudah tertutup. Tetapi berhenti di situ akan melewatkan
kelas sebenarnya, yaitu **validasi bawaan peramban yang tidak melakukan apa yang dikira**.

Sapuan diperluas ke **setiap `<form>` di repositori** dan permukaan validasi bawaannya.

| Berkas | `<form>` | `submit` | `pattern` | `required` |
|---|---|---|---|---|
| `auth/LoginPage` · `RegisterPage` · `ForgotPasswordPage` · `ResetPasswordPage` | 1 | 1 | 0 | 1–4 |
| `auth/ProfilePage` · `documents/DocumentsPage` | 1 | 1 | 0 | 0–1 |
| `company/SetelanPerhitunganPage` | 1 | 1 | **1** | 0 |
| **`mrp/ItemsPage`** | **1** | **0** | 0 | **5** |
| `hr/HrDashboardPage` · `mrp/BomsPage` · `CustomerPurchaseOrdersPage` · `RoutingsPage` · `WorkOrdersPage` | **0** | 0 | 0 | 0 |

### TEMUAN BARU — `required` di `/items` tidak pernah berlaku

`ItemsPage` memakai `<form id="form-item" onSubmit={handleSubmit}>` dan menyimpannya lewat
`requestSubmit()`. Itu **API yang benar** — `requestSubmit()` menjalankan validasi bawaan,
tidak seperti `submit()` — dan komentar di kode yang menjelaskannya **akurat**.

Yang tidak disadari: **langkahnya dirender bersyarat**, sehingga kontrolnya **unmount**.

| Langkah | `required` terpasang | `checkValidity()` |
|---|---|---|
| 0 | 2 (`item_code`, `name`) | **false** |
| 1 | 3 (`base_uom`, `purchase_uom`, `uom_conversion_factor`) | **false** |
| **2 — tempat simpan terjadi** | **0** | **true** |

**Diukur di peramban**: dengan **seluruh field wajib kosong**, menekan "Tambah item" di
langkah 2 tetap mengirim `POST /api/items`.

Jadi kelima atribut `required` itu **tidak menegakkan apa pun**. Berpindah langkah juga
tidak memvalidasi — `FooterBertahap` hanya menaikkan nomor langkah.

**Ini kelas yang sama dengan N-1, arah berlawanan**: yang satu validasi **terlalu ketat**
sampai membisukan submit; yang ini **lolos hampa**. Keduanya penjaga yang tidak berbunyi.

**Integritas data TIDAK terancam** — server tetap menolak. Yang hilang adalah galat inline
di field, dan atribut `required` memberi kesan perlindungan yang tidak ada.

**TIDAK DIPERBAIKI DI SAPUAN INI**, dan alasannya bukan kehati-hatian umum: perbaikannya
hidup di **komponen modal bertahap bersama** dan menyentuh **empat halaman** sekaligus.
Itu persis pekerjaan yang perintah sapuan larang dilakukan sambil menyapu.

---

## 4. PERBAIKAN

**Nol perbaikan dilakukan di batch ini.** Kasus yang sama dengan `/company/setelan`
**tidak ditemukan** — DatePicker hanya dipakai satu kali, dan sudah diperbaiki di batch
sebelumnya.

---

## 5. SAPUAN GALAT FORM

Terkonfirmasi persis seperti angka Master Plan, dihitung ulang setelah komentar dibuang:

| | Jumlah |
|---|---|
| `invalidText` | **5**, di 4 berkas: `ProfilePage` 2 · `CompanySettingsPage` 1 · `HrDashboardPage` 1 · `ShipmentsPage` 1 |
| `InlineNotification` | **123**, di 37 berkas |
| `helperText` | 57 |

> **Kolom `aria-describedby`/`aria-invalid` bernilai 0 di semua halaman, dan itu BUKAN
> temuan tersendiri**: Carbon memasang keduanya sendiri ketika `invalid`/`invalidText`
> dipakai. Nolnya hanya berarti tidak ada yang menulisnya dengan tangan.

**Pesan galat tanpa rujukan field** yang paling sering: `'Gagal menyimpan'` (7×),
`'Terjadi kesalahan.'` (2×), `'Gagal menyimpan.'` (2×).

### Akibatnya bagi pengguna

Ketika formulir gagal, empat pertanyaan yang harus terjawab:

| Pertanyaan | Terjawab hari ini? |
|---|---|
| Apa yang salah | **ya** — lewat notifikasi |
| **Field mana yang salah** | **TIDAK** untuk 149 dari 154 kontrol berlabel |
| Apa yang harus diperbaiki | sebagian |
| Apakah data sudah tersimpan | **ya** sejak `/purchasing` diperbaiki |

**Severity: HIGH.** **Pemilik kanonik: belum ada** — register mencatatnya sebagai
F-03, berstatus *"NEW CANONICAL ID REQUIRED"*, belum dibuat.

**Rekomendasi**: dikerjakan sebagai **kelas**, bukan per halaman, dan dimulai dari formulir
yang paling sering gagal — bukan dari yang paling banyak field.

---

## 6. SAPUAN SEMANTIK NOTIFIKASI

Ini bagian yang **membalik kesan angka mentah**, dan cara membaliknya layak dicatat.

**Angka mentah** menunjukkan 9 halaman merender notifikasi dengan syarat *ada-tidaknya
pesan* — pola yang sama dengan `/purchasing`. Terlihat seperti kelas lintas halaman.

**Tetapi pola itu hanya jadi cacat bila variabel pesan yang sama JUGA membawa teks
berhasil.** Diperiksa satu per satu:

| Halaman | Pesan berhasil masuk variabel itu? | Memeriksa status? | Putusan |
|---|---|---|---|
| `HrDashboardPage` | tidak | ya (2) | aman |
| `BomsPage` | tidak | ya (2) | aman |
| `CustomerPurchaseOrdersPage` | ya (1) | ya (2) | aman |
| `ItemsPage` | ya (2) — tetapi berbentuk `{kind, message}` | ya (2) | aman |
| `RoutingsPage` | ya (1) | ya (3) | aman |
| `WorkOrdersPage` | ya (2) | ya (6) | aman |
| `ProductionDashboardPage` | ya (2) | ya (2) | aman |
| `PpicDashboardPage` | ya (2) | ya (2) | aman |
| `CustomersPage` | ya (3) — berbentuk `{kind, message}` | ya (1) | aman |

**Nol halaman menunjukkan tanda tangan `/purchasing` yang persis.** Cacat itu **tunggal**.

### Tujuh judul "Gagal" yang dipaku mati — diperiksa per variabel

| Halaman | Variabel | Bisa berisi teks berhasil? |
|---|---|---|
| `ShipmentsPage` · `TeamManagePage` · `DocumentsPage` · `AiProjectDashboardPage` | `dispatchError` · `membersError` · `error` | **tidak** — namanya sendiri galat |
| `ItemsPage` | `supplierPriceFormMessage` | **tidak** — 5 pemanggilan setter, nol berisi teks berhasil |
| `PpicDashboardPage` | `approvalMessage` | **tidak** — 2 pemanggilan, nol berhasil |
| `ProductionDashboardPage` | `*FormMessage` | **tidak** — 4 pemanggilan, nol berhasil |

Ketiga yang bernama generik **diperiksa isinya**, bukan disimpulkan dari namanya.

**Sisa risikonya LATEN, bukan aktual**: judul yang dipaku mati berarti begitu ada yang
mengarahkan teks berhasil ke salah satu variabel itu, ia **diam-diam** menjadi cacat
`/purchasing`. Itu utang desain, bukan cacat hari ini.

---

## 7. REKONSILIASI REGISTER TASK

**Nol perubahan pada `build_tasks`.**

| Kode | Keadaan |
|---|---|
| `DS-21` | **selesai** — indikator langkah. Tabrakan dengan pencadangan register **sudah didokumentasikan** di `FABRIX_TASK_ID_RECONCILIATION_DS21_DS22.md`, menunggu keputusan |
| `DS-22` | **selesai** — kolom baris komponen BOM. **Tidak ada tabrakan** |
| `DS-23` · `DS-24` · `AUD-49` | **kosong** |

**Sebelas temuan di register masih menunggu ID** (`NEW CANONICAL ID REQUIRED`), termasuk
F-03 (validasi tingkat field) yang menjadi pemilik alami temuan bagian 5.

Registri: **324 task · 114 selesai · 3 dibatalkan · 34 ditunda sadar**.

> **Peringatan yang berlaku untuk setiap batch berikutnya**: skrip kode kanonik hanya
> membaca `build_tasks`, sedangkan pencadangan hidup di **markdown**. Selama keduanya
> terpisah, tabrakan `DS-21` akan terulang.

---

## 8. KESIAPAN HALAMAN

22 halaman dalam lingkup revisi. **Governance sudah tersedia untuk seluruhnya** (D-A dan
D-B diterima, cetakan ada). Yang membedakan kesiapan adalah **pemilik task** dan
**penghalang keputusan bisnis**.

| Halaman | Severity | Cacat | Ketergantungan | Pola rujukan | Siap? |
|---|---|---|---|---|---|
| `/routing` | HIGH | 15 | — | **DS-22** (baris berulang) | **SIAP** |
| `/work-orders` | HIGH | 13 | — | DS-22 · cetakan modal | **SIAP** |
| `/customers` | HIGH | 16 | — | cetakan modal | **SIAP** |
| `/production` | HIGH | 14 | — | DS-22 (2 blok) | **SIAP** |
| `/ppic` | HIGH | 17 | — | DS-22 · DS-19 sedang dikerjakan | **SIAP** (risiko tinggi) |
| `/sales-orders` | HIGH | 11 | — | cetakan tabel | **SIAP** |
| `/shipments` | HIGH | 11 | — | cetakan modal | **SIAP** |
| `/documents` | HIGH | 7 | — | cetakan form dokumen (DS-09) | **SIAP** |
| `/team` | HIGH | 6 | — | cetakan modal | **SIAP** |
| `/attendance` | HIGH | 10 | **N-2** | — | **TERHALANG** — arti status absensi |
| `/kpi/saya` | HIGH | 8 | — | — | **SIAP** |
| `/pod/[token]` | HIGH | 7 | KRM-05 | layar publik | **SIAP** |
| `/hr` | CRITICAL→ | 11 | **N-2** | — | **SEBAGIAN** — P0 selesai, sisanya terhalang |
| `/purchasing` | CRITICAL→ | 14 | **N-3** | — | **SEBAGIAN** — P0 selesai, keunikan terhalang |
| `/boms` | MEDIUM | 11 | — | sudah patuh sebagian | **SIAP** |
| `/warehouse` · `/kamus` · `/build-tasks` · `/company/setelan` · `/ai-project` · `/items` · `/customer-purchase-orders` | MEDIUM–LOW | 4–11 | — | cetakan | **SIAP** |

**Nol halaman terhalang oleh ketiadaan governance.** Dua terhalang keputusan bisnis
(N-2, N-3), dan **seluruhnya** belum punya pemilik task kanonik.

---

## 9. LIMA HALAMAN BERIKUTNYA

Diurut menurut **nilai pakai ulang dan pentingnya alur kerja**, bukan menurut mana yang
terlihat paling buruk.

### 1 · `/routing`
- **KENAPA** — baris berulangnya **terparah di seluruh repo**: 642px per baris di 360px,
  terhitung dari metrik font sungguhan (BOM sebelum DS-22: 462px)
- **KETERGANTUNGAN** — nihil
- **POLA** — DS-22 sudah terbukti dan langsung berlaku
- **RISIKO** — rendah; perbaikannya satu aturan CSS
- **NILAI PAKAI ULANG** — **tertinggi**: ia membuktikan pola DS-22 di luar BOM

### 2 · `/work-orders`
- **KENAPA** — alur manufaktur inti, dipakai harian, 13 cacat
- **KETERGANTUNGAN** — nihil
- **POLA** — DS-22 + cetakan modal
- **RISIKO** — sedang; 1.189 baris
- **NILAI PAKAI ULANG** — tinggi

### 3 · `/production`
- **KENAPA** — 14 cacat, dan memuat **dua** blok baris berulang sekelas DS-22
- **KETERGANTUNGAN** — nihil
- **RISIKO** — sedang
- **NILAI PAKAI ULANG** — tinggi

### 4 · `/customers`
- **KENAPA** — 16 cacat, master data yang mengalir ke SO dan pengiriman
- **KETERGANTUNGAN** — nihil
- **RISIKO** — rendah
- **NILAI PAKAI ULANG** — sedang

### 5 · `/ppic`
- **KENAPA** — **17 cacat, terbanyak di sistem**
- **KETERGANTUNGAN** — `DS-19` masih `sedang_dikerjakan`
- **RISIKO** — **tertinggi**: 1.964 baris, komponen terbesar di repo
- **NILAI PAKAI ULANG** — sedang
- **Ditaruh terakhir dari lima justru karena risikonya**, bukan karena kurang penting

---

## 10. PENILAIAN IMPLEMENTASI RUJUKAN

`/company/setelan` diperiksa terhadap seluruh butir D-A:

| Butir | Keadaan |
|---|---|
| `<form>` sungguhan · submit · `preventDefault` | **ada** |
| Pengelompokan bermakna (`<Tile>` + `<h2>`) | **ada** — 6 `<h2>`, nol lompatan hierarki |
| Kisi responsif `auto-fit` | **ada** — 1 kolom di 360/672, 2 kolom mulai 768 |
| Lebar terbaca dibatasi | **ada** — terkunci 960px mulai 1280 |
| Jarak dari token Carbon | **ada** |
| Keyboard · Enter mengirim | **ada** — terbukti mengirim `PATCH` |
| Validasi bawaan selaras | **ada** — `pattern` diselaraskan ke `dateFormat` |
| Aksi: satu primary, sekunder `kind="secondary"` | **ada** |
| Keadaan memuat · berhasil · galat · izin | **ada** |
| Responsif enam lebar | **ada** — nol gulir menyamping, nol elemen melewati tepi |

### REFERENCE GAP — dua, keduanya TIDAK kritis

| # | Gap | Dampak |
|---|---|---|
| **RG-1** | Nol `invalid`/`invalidText` — galat masih tingkat halaman | sama dengan 149 kontrol lain; **bukan penghalang rollout**, tetapi cetakan ini belum bisa jadi contoh untuk arsitektur galat |
| **RG-2** | 18 tombol bantuan `cds--toggletip-button` berukuran 16×16 | komponen Carbon apa adanya; dicatat, bukan cacat kita |

**Tidak ada gap kritis. Rollout boleh dimulai.**

---

## 11. KESESUAIAN BOM

Diaudit terhadap D-A, D-B, governance modal, dan governance responsif. **Tidak disentuh.**

| Butir | BOM |
|---|---|
| Tetap modal bertahap | **patuh** |
| Penanda langkah responsif | **patuh** — DS-21 |
| Baris berulang ikut lebar wadah | **patuh** — DS-22 |
| Nol `window.confirm` | **patuh** |
| Notifikasi bersama | **patuh** |
| Keadaan memuat | **patuh** |
| **Galat menempel field** | **MENYIMPANG** — `invalidText` nol |
| **Ukuran kontrol seragam** | **MENYIMPANG** — satu `NumberInput` tanpa `size` di baris komponen |
| **Validasi antar langkah** | **MENYIMPANG** — sama seperti `/items`: berpindah langkah tidak memvalidasi |

---

## 12. KEPUTUSAN BISNIS YANG MASIH DIBUTUHKAN

Keduanya **tidak dijawab di sini**, dan keduanya **tidak menghentikan** pekerjaan yang tidak
bergantung padanya.

**N-2 — `DI_LUAR_AREA` dihitung hadir atau tidak?** Orangnya **memang absen masuk**, hanya
di luar area yang ditetapkan. Menghalangi: `/attendance`, dan sisa `/hr`.

**N-3 — keunikan supplier: nama atau kode tersendiri?** Menghalangi: sisa `/purchasing`.

---

## 13. TEMUAN YANG DITUNDA

| # | Temuan | Kenapa ditunda |
|---|---|---|
| **S-1** | `required` di `/items` tidak menegakkan apa pun; validasi antar langkah tidak berjalan | perbaikannya di **komponen modal bertahap bersama**, menyentuh **4 halaman** — pekerjaan tersendiri |
| **S-2** | Arsitektur galat form: `invalidText` 5 dari 154 | kelas lintas halaman; pemilik alaminya F-03 di register |
| **S-3** | Tujuh judul `"Gagal"` dipaku mati | risiko **laten**, bukan cacat hari ini |
| **S-4** | BOM menyimpang di tiga butir | bukan regresi; menunggu gilirannya |
| **S-5** | RG-1 pada halaman rujukan | ikut S-2 |

---

## 14. RISIKO

| # | Risiko |
|---|---|
| **R-1** | **S-1 menyentuh komponen bersama yang dipakai 4 halaman.** Memperbaikinya sambil menyapu akan mengubah perilaku BOM, PO Klien, Master Item, dan Karyawan sekaligus — persis yang perintah sapuan larang |
| **R-2** | **Nol dari 22 halaman punya pemilik task kanonik.** Setiap rollout akan menghadapi pertanyaan ID yang sama, dan `DS-21` sudah membuktikan tabrakannya nyata |
| **R-3** | **Pencadangan ID hidup di markdown, pengalokasian membaca basis data.** Tabrakan akan terulang selama keduanya terpisah |
| **R-4** | `/ppic` 1.964 baris dengan 17 cacat, dan `DS-19` masih berjalan di berkas yang sama — risiko bentrok |

---

## 15. BATCH BERIKUTNYA YANG DIREKOMENDASIKAN

1. **`/routing`** — nilai pakai ulang tertinggi, risiko terendah, pola sudah terbukti.
2. **S-1** sebagai batch tersendiri — validasi antar langkah di komponen bersama.
3. **Jawab N-2 dan N-3** — keduanya membuka halaman yang sekarang terhalang.
4. **S-2** sebagai kelas — arsitektur galat form, dimulai dari formulir yang paling sering gagal.

**JANGAN** memulai rollout 22 halaman sekaligus.
