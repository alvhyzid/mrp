# SALES_CRM_IMPLEMENTATION_CHANGELOG

## WS-01 / WS-03 — PO klien: galat menempel di isian yang salah · 29 Agu 2026

**Golongan keputusan: SAFE LOCAL CORRECTION.** Aturannya sudah kanonik (`DS-25`), kontraknya
sudah ada dan terbukti di dua modul, dan **nol aturan bisnis diubah**. Tidak ada keputusan
baru yang diambil.

### Masalah

PO klien adalah formulir **terbesar** di permukaan Sales: 21 kontrol, **modal bertahap empat
langkah**, baris item berulang. Seluruh penolakan muncul sebagai **satu kalimat di dasar
modal** — dan pada modal bertahap, kalimat itu bisa berada di **langkah yang berbeda** dari
isian yang salah.

### Yang berubah — tiga berkas

| Berkas | Perubahan |
|---|---|
| `customerPurchaseOrderValidation.ts` | memakai `buatKontrakGalatField`; hasil membawa `field` + `line`; **kalimat pesan tidak diubah satu pun** |
| `createCustomerPurchaseOrder.ts` | meneruskan `field`/`line`; **mencari indeks baris** yang itemnya tidak sah; galat 409 nomor ganda kini menunjuk `po_number` |
| `CustomerPurchaseOrdersPage.tsx` | `poFieldError` sebagai daftar · 6 kontrol menerima `invalid`+`invalidText` · notifikasi digerbang · galat dicabut saat isian diubah / baris dihapus · **modal melompat ke langkah tempat isian itu berada** |

**Bonus koreksi**: `paymentTermsOptions` sebelumnya **disalin** di halaman dan di modul
validasi. Dua salinan untuk satu daftar — menambah pilihan di satu tempat membuat server dan
layar tidak sepakat, dan tidak ada yang berbunyi. Sekarang satu sumber.

### Cacat yang saya PERKENALKAN sendiri lalu perbaiki

Ditemukan lewat **menjalankan**, bukan membaca: jawaban 409 untuk `po_number` (langkah 0)
dikirim saat modal berada di langkah 3. Kontrolnya ditandai dengan benar — tetapi langkahnya
**sedang tersembunyi**, jadi layar tidak menampilkan apa pun, dan notifikasi formulir ikut
digerbang mati karena *"sudah ada galat field"*.

Kelas yang sama dengan field tak dikenal: galatnya bukan salah tempat, **galatnya hilang**.
Bedanya penyebabnya bukan nama yang salah melainkan **langkah** yang salah.

Diperbaiki dengan peta `LANGKAH_FIELD` + `setLangkah`, dan dikunci uji (k). Diverifikasi ulang
di peramban: modal **pindah dari langkah 3 ke langkah 0** dan pesannya muncul di `po-nomor`.

### Uji

`tests/validasi_field_po_klien.test.ts` — **11 penjaga**, MERAH lebih dulu (7 gagal), HIJAU
sesudah. **Enam mutasi dibuktikan menggigit**, satu di antaranya berbunyi di **typecheck**
(`TS2345` saat nama field salah ketik di server).

> **Satu penjaga saya sendiri terlalu longgar dan diperketat**: uji (h) semula hanya mencari
> `galatPoKlien('x')`, sehingga mencabut `invalidText` sambil membiarkan `invalid` tetap
> **hijau** — padahal kontrolnya menyala merah **tanpa menjelaskan apa yang salah**. Kini
> kedua properti wajib ada.

### Bukti peramban

Enam lebar (360–1920), non-GET diblokir, **nol baris tertulis**:

| Kasus | Hasil |
|---|---|
| Server menolak baris (`qty_ordered`, line 0) | ditandai di `po-qty-0`, `aria-invalid="true"` + `aria-errormessage` |
| Server menolak isian tingkat atas (`po_number`, 409) | **modal pindah ke langkah 0**, pesan di `po-nomor` |
| Field tak dikenal (`po_numberr`) | **naik ke notifikasi formulir dengan kalimat aslinya** |
| Galat izin (403) | notifikasi formulir, nol tanda field |
| Enam lebar | pesan tampil di keenamnya, **nol terpotong**, kaki modal terlihat, nol gulir mendatar di modal |

### UX FINDING — dicatat, TIDAK diperbaiki

**Problem**: di **360px**, tombol **"Batal"** di kaki modal bertahap terpotong tepi kiri —
terukur `kiri: −63, kanan: 50`.
**Current**: tiga tombol berjajar di `ModalFooter` Carbon tanpa pembungkusan di layar sempit.
**Expected**: seluruh aksi terjangkau di 360px (aturan responsif proyek).
**Governance**: `FooterBertahap` adalah **komponen bersama**, dipakai **4 halaman**
(BOM, PO klien, Master Item, HR). §32 mewajibkan **audit konsumen lebih dulu**, bukan
perbaikan lokal.
**Impact**: pengguna di HP tidak bisa menekan "Batal" di keempat formulir bertahap.
**Fix**: belum dilakukan — butuh audit konsumen + penjaga.
**Regression**: menyentuh 4 halaman sekaligus.

---

## WS-05 — Alamat tujuan kirim: kapabilitas yang ada akhirnya punya layar · 29 Agu 2026

**Golongan keputusan: COMPLETION.** Keputusan **DEC-S09 sudah ditutup** pemilik produk —
*"BUILD THE UI"*. Entitas, tabel, RLS, arsip/pulih, dan **tiga route** sudah ada sejak PMB-07b
dengan **nol** halaman memakainya. Ini melengkapi yang PARTIAL, **bukan** membangun yang baru.

### Yang berubah

| Berkas | Perubahan |
|---|---|
| `customerDeliveryAddresses.ts` | memakai `buatKontrakGalatField`; enam galat golongan A membawa `field` |
| `CustomersPage.tsx` | baris tabel bisa **dimekarkan** (pola yang sama dengan Purchasing/Items/BOM); panel alamat dengan keadaan memuat · kosong-ber-aksi · galat; modal tambah; **modal danger** untuk arsip |
| `customers.scss` | gaya panel; kolom mengikuti **lebar wadah** (aturan D-B), bukan lebar layar |

**Nol pola baru**: baris mekar, modal Carbon, kontrak validasi, dan aksi merusak seluruhnya
memakai cetakan FABRIX yang sudah ada.

### REGRESI YANG SAYA PERKENALKAN, DITEMUKAN DAN DIPERBAIKI SEBELUM COMMIT

Sapuan baseline mencatat `/customers` **bersih di enam lebar**. Setelah perubahan pertama saya,
ia **menggulir menyamping di keenamnya** (1712 vs 1440).

Diisolasi bertahap, dan tiga dugaan pertama **salah**:

| Dugaan | Hasil |
|---|---|
| Fixture data | **bukan** — meluber juga dengan data kosong |
| `TableExpandHeader` | **bukan** — dicabut, tetap meluber |
| SCSS baru | **bukan** — TSX lama + SCSS baru = bersih |
| **Dua modal yang saya tambahkan** | **YA** — dicabut, meluber hilang |

**Sebabnya**: kedua modal saya letakkan **di luar** blok `canManage`, sedangkan modal yang
sudah ada di halaman ini berada **di dalamnya**. Dipindahkan ke dalam (dengan fragment) →
**1440 vs 1440**, bersih lagi.

> **Batas kejujuran**: mekanisme persisnya — kenapa modal Carbon tertutup di luar blok itu
> menambah 272px lebar dokumen — **belum saya telusuri sampai akar CSS-nya**. Yang saya
> lakukan adalah menyamakan dengan pola yang sudah terbukti di halaman yang sama. Itu
> memperbaiki gejalanya dan konsisten dengan cetakan; ia **bukan** penjelasan penyebabnya.

### Uji & bukti

`tests/alamat_kirim_pelanggan.test.ts` — **10 penjaga**, MERAH lebih dulu (10 gagal, modulnya
belum ada), HIJAU sesudah.

Bukti peramban, enam lebar, non-GET diblokir, **nol baris tertulis**:

| Kasus | Hasil |
|---|---|
| Panel berisi | 1 alamat, tombol arsip |
| Panel kosong | **menawarkan aksi** ("Tambah alamat pertama"), bukan hanya "belum ada" |
| Modal tambah | 4 kontrol, **nol tanpa label** |
| Galat field dari server | ditandai di `alamat-label`, `aria-invalid="true"` + `aria-errormessage` |
| Field tak dikenal | naik ke notifikasi formulir dengan kalimat aslinya |
| Arsip | **modal danger Carbon**, bukan `window.confirm` |
| Enam lebar | panel tampil, satu `h1`, nol lompatan judul, **nol gulir, nol luber** |

### Temuan dicatat, tidak diselesaikan

Tabel `customers` **masih punya kolom `shipping_address` tunggal** berdampingan dengan tabel
daftar `customer_delivery_addresses`. Dua tempat menyimpan hal yang mirip. PMB-07b menetapkan
alamat sebagai **daftar**, jadi kolom tunggal itu kemungkinan warisan — tetapi mana yang jadi
sumber kebenaran saat pengiriman dibuat **belum diverifikasi**, dan mencabut kolom adalah
migrasi yang menyentuh data. **ARCHITECTURE DECISION REQUIRED.**

---

## 29 Agustus 2026 — gelombang kedua sampai kelima

Dicatat berurutan, termasuk **apa yang saya laporkan keliru dan bagaimana diketahuinya**.
Bagian terakhir sengaja ditulis apa adanya: dua dari lima gelombang lahir karena laporan
gilirannya sendiri ternyata belum benar.

### Gelombang 2 — WS-S03: satu jalur kanonik pembuatan Sales Order

| Aspek | Isi |
|---|---|
| Basis data | `process_customer_purchase_order()` diperluas idempotensi. **Tanda tangan tidak diubah** supaya grant tidak regresi — diukur: identik di tiga proyek |
| Aplikasi | `processCustomerPurchaseOrder.ts` **berhenti menulis**; memanggil RPC lewat klien ber-sesi pengguna |
| Menutup | SC-04 **dan** SC-01b — snapshot identitas ikut tersalin |
| Bukti | 11 pemeriksaan · 4 mutasi, **keempatnya menggigit setelah 1 pengetatan** |
| Batas | Kegagalan di tahap *insert baris* **tidak bisa dipaksa** — kedua tabel berkendala identik. Yang diuji: keatomikan satuannya lewat tabrakan nomor SO |

### Gelombang 3 — WS-S04 + WS-S05: jejak keputusan & aksi PO klien

| Aspek | Isi |
|---|---|
| Keputusan arsitektur | **PERLUAS** `status_transition_log` (5 kolom), **bukan** tabel audit baru |
| Katalog alasan | `decision_reason_categories`, 26 kategori, master seluruh tenant tanpa `company_id` |
| Aksi | `tahan_po_klien` · `lepas_po_klien` · `batalkan_po_klien` |
| Aturan ditegakkan | Penghalang satu departemen **tidak bisa dilepas** departemen lain (BD-06) |
| Bukti | 14 pemeriksaan · 5 mutasi, kelimanya menggigit · 6 lebar × (panel + modal) bersih |
| Sengaja bersamaan | Kolom audit **tidak boleh lahir tanpa penulisnya** — kolom `reason` yang selalu null sudah membuktikannya |

### Gelombang 4 — SEC-21: lubang keamanan P0

**Ditemukan penjaga proyek ini, bukan oleh saya.** Pemanggil **tanpa login** membuat Sales
Order sungguhan (id 901) di perusahaan yang bukan miliknya.

Dua sebab: hak `EXECUTE` bawaan Postgres ke `PUBLIC`, dan gerbang yang **gagal terbuka**
karena `if NULL` tidak pernah dieksekusi.

Ditutup dengan `wajib_identitas_tenant()` + pencabutan `anon` dari enam fungsi (setelah
diperiksa terhadap **145 kebijakan RLS**: nol yang memakainya).

### Gelombang 5 — SEC-23: laporan gelombang 4 ternyata belum lengkap

**Verifikasi independen membantah laporan sendiri.** Sesi ber-`company_id` **tanpa
`app_role`** masih bisa membuat Sales Order — **pola yang sama, gerbang yang berbeda**.

`wajib_identitas_tenant()` memeriksa identitas dan perusahaan, **bukan peran**.

Ditutup dengan `coalesce(…, false)` di seluruh gerbang peran, dan — yang lebih penting —
**pengawas kelasnya** (`pg_proc_risiko_null`) yang menyisir **seluruh** fungsi, bukan tiga
yang kebetulan ketahuan.

### Yang saya laporkan keliru, dan koreksinya

| Klaim | Kenyataan |
|---|---|
| "Identitas dibekukan di PO **dan Sales Order**" | Jalur aplikasi **tidak** menyalinnya. Diperbaiki di WS-S03 |
| "11 → 5 fungsi terbuka anon" | Benar **hanya** untuk `SECURITY DEFINER`. Sebenarnya **14 dari 53** |
| "Lubang keamanan sudah ditutup" (gelombang 4) | **Pintu kedua masih terbuka.** Ditutup di gelombang 5 |
| "Halaman punya 3 cacat" (WS-S05) | **Ketiganya cacat alat ukur saya**, bukan cacat halaman |

### Temuan dicatat, sengaja tidak dikerjakan

`SEC-20` (9 tabel non-Sales ber-RLS tanpa kebijakan) · `SEC-22` (4 penolong RLS yang
menerima identitas sebagai parameter) · `AUD-50` (5 tabel ber-jejak tanpa pengisi) ·
`INF-28` (pemulihan pencadangan belum terbukti) · `PJL-09` (kolom alamat lama) ·
`PJL-10` (konflik nama status) · `DS-26` (penolakan yang sama tampil di dua tempat).
