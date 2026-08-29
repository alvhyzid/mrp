# SALES_CRM_NEXT_WORK_ORDERS

**Tanggal:** 29 Agustus 2026 · **Sumber:** `SALES_CRM_FINDING_RECONCILIATION.md`
**Format:** §14 perintah batch · **Klasifikasi:** §16

> **CARA MEMBACA BERKAS INI.** Setiap WO diberi salah satu dari lima klasifikasi. WO
> ber-klasifikasi menunggu **TIDAK BOLEH dikerjakan** — bukan "sebaiknya jangan". Membuat
> WO **tidak menaikkan progress**; menulis dokumen ini juga tidak.

| WO | Judul | Prioritas | Klasifikasi |
|---|---|---|---|
| WO-S01 | Sales Order Lifecycle & Approval | P0 | WAITING FOR ARCHITECTURE + BUSINESS DECISION |
| WO-S02 | Sales Order Transaction Integrity | P0 | SAFE TO INVESTIGATE → menunggu AD-02 |
| WO-S03 | Sales Order Row Access | P1 | **SAFE TO IMPLEMENT** |
| WO-S04 | Customer PO Hold / Cancel | P1 | WAITING FOR BUSINESS DECISION |
| WO-S05 | Pemilih alamat tersimpan di pengiriman | P1 | **SAFE TO IMPLEMENT** |
| WO-S05b | Nasib kolom lama + alamat di tingkat SO | P2 | WAITING FOR ARCHITECTURE DECISION |

---

# WO-S01

## Title
Sales Order Lifecycle & Approval — menghidupkan status yang tidak pernah tercapai

## Source Finding
SC-01

## Priority
**P0**

## Objective
Sales Order dapat bergerak melewati siklus hidupnya lewat layar, dengan wewenang ditegakkan
server dan setiap perpindahan tercatat beserta alasannya.

## Current AS-IS
SO lahir `confirmed` dan tidak pernah berubah. Nol `.update()` pada `sales_orders` di seluruh
`src/`. `status_transition_log` **0 baris**.

## Evidence
`processCustomerPurchaseOrder.ts:117` (status literal) · `status_transition_rules` (4 aturan) ·
trigger `enforce_status_transition` · `getDashboardSummary.ts:30` sudah menghitung
`in_production` yang mustahil.

## Business Rule
**BELUM ADA untuk `completed` dan `cancelled`.** Yang **sudah** ada dan terbukti bekerja:
persetujuan tiga departemen (finance/ppic/manager) pada PO Klien, digerbang ganda di
`process_customer_purchase_order()` dan `enforce_status_transition()`.

## Architecture Boundary
DEC-S11: Sales memiliki `cancelled`; Manufacturing memiliki `in_production`; Logistics + bukti
penyelesaian berkontribusi pada `completed`. **Domain lain tidak boleh menulis kolom Sales
secara diam-diam** — bila opsi A dipilih, penulisannya lewat kontrak yang disebutkan, bukan
lewat `update` langsung dari kode domain lain.

## Required Change
Ditentukan **setelah** AD-01. Opsi B (rekomendasi) berarti: pertahankan visibilitas turunan
WS-A, bangun aksi **Batalkan** bersama alasan, cabut dua aturan transisi yang jadi mati,
perbaiki dashboard.

## Files / Areas to Inspect
`src/features/mrp/server/eksekusiSalesOrder.ts` · `listSalesOrders.ts` ·
`SalesOrdersPage.tsx` · `getDashboardSummary.ts` · `status_transition_rules` ·
`docs/00-GOVERNANCE/FABRIX_STATE_MACHINE_REGISTRY.md`

## Database Impact
Opsi A: nihil. Opsi B: mencabut 2 baris `status_transition_rules` (data, bukan struktur).

## API Impact
Endpoint baru untuk pembatalan SO.

## UI Impact
Aksi merusak → **wajib berjauhan dari aksi biasa** (aturan modal #9) + modal varian
**berbahaya** (C.2).

## Permission Impact
Menunggu **BD-02**. **Jangan menebak.**

## Cross-Domain Impact
Menentukan bentuk penyerahan SO → Work Order.

## Migration Impact
Opsi B: satu migrasi data kecil. Opsi A: nihil.

## Tests Required
Transisi sah diterima · transisi terlarang **ditolak dengan pesan yang bisa dibaca** ·
`status_transition_log` bertambah · peran tanpa wewenang ditolak **di server** ·
dashboard tidak lagi menghitung status mustahil · pengawas: tidak ada status di CHECK yang
tidak punya pemicu.

## UX Acceptance
Enam lebar wajib · tiga pemeriksaan tepi · galat tingkat field bila relevan.

## Business Acceptance
Pemilik produk mengenali arti tiap status tanpa dijelaskan.

## Security Acceptance
Wewenang di server, bukan penyembunyian tombol.

## Evidence Required
Tangkapan layar 6 lebar · keluaran test · baris `status_transition_log` sebelum/sesudah.

## Dependencies
AD-01, BD-01..BD-04.

## Blockers
**BL-02** (terbuka).

## Decision Gate
**AD-01 + BD-01..BD-04 wajib tertutup sebelum baris kode pertama.**

## Definition of Done
Setiap status dapat dicapai lewat layar atau dicabut dari CHECK; nol status tanpa pemicu.

## Classification
**WAITING FOR ARCHITECTURE DECISION + WAITING FOR BUSINESS DECISION**

---

# WO-S02

## Title
Sales Order Transaction Integrity — satu jalur kanonik, menyerap snapshot identitas

## Source Finding
SC-04 (+ SC-01b diserap)

## Priority
**P0**

## Objective
Pembuatan Sales Order atomik sungguhan, lewat **satu** jalur, yang menyalin snapshot
identitas dan tetap idempoten.

## Current AS-IS
Dua implementasi lengkap. Yang dipakai (TypeScript) memakai kompensasi `delete` manual dan
**tidak** menyalin tiga kolom snapshot. Yang atomik (fungsi DB) **tidak dipanggil aplikasi**.

## Evidence
`processCustomerPurchaseOrder.ts:113-121` (kolom insert) · `:167-171` (kompensasi) ·
`public.process_customer_purchase_order()` migrasi `20260827480000` · nol pemanggil RPC di
`src/` · `listSalesOrders.ts:105` (akibat di layar).

## Business Rule
Sudah tetap dan tidak perlu keputusan baru: 1 PO Klien ↔ tepat 1 Sales Order · 3 persetujuan
wajib · hanya company leadership yang boleh memproses · identitas komersial beku saat terbit.

## Architecture Boundary
Menyentuh fungsi `security definer` dan **memindahkan penegakan wewenang** dari service-role
ke JWT → **bukan** keputusan teknis biasa.

## Required Change
Setelah AD-02. Opsi A: tambah `idempotency_key` ke fungsi DB; TypeScript jadi pemanggil RPC
+ penerjemah galat; **pengawas** yang gagal keras bila ada jalur kedua menulis `sales_orders`.

## Files / Areas to Inspect
`processCustomerPurchaseOrder.ts` · `app/api/customer-purchase-orders/process/route.ts` ·
migrasi `20260812153200`, `20260813100000`, `20260827480000` ·
`tests/pmb07a_identity_snapshot.test.ts`

## Database Impact
Opsi A: `create or replace function` + parameter/logika idempotensi. Nol perubahan tabel.

## API Impact
Bentuk balasan **dipertahankan** (`success`, `sales_order_id`, `so_number`, `replayed`).

## UI Impact
Nihil bila pesan galat tetap terbaca sama.

## Permission Impact
Berpindah dari `appUser`+service-role ke `jwt_company_id()`+`jwt_is_company_leadership()` —
**wajib diuji per peran**, bukan diasumsikan setara.

## Cross-Domain Impact
Penomoran SO (kelas cacat "nomor = jumlah baris" yang sudah tercatat di CLAUDE.md).

## Migration Impact
Satu migrasi fungsi. **Nol data disentuh.**

## Tests Required
**Wajib ada test yang benar-benar MENGGAGALKAN insert baris** dan membuktikan nol SO tersisa —
test yang hanya memanggil jalur sukses **tidak diterima** · idempotensi: dua permintaan
bersamaan → satu SO · snapshot terisi · setiap peran diuji · pengawas jalur kedua.

## UX Acceptance
Pesan galat tetap Bahasa Indonesia yang bisa dibaca orang pabrik — **bukan** `raise exception`
mentah.

## Business Acceptance
PO diproses dua kali tidak melahirkan SO kedua; gagal di tengah tidak meninggalkan sisa.

## Security Acceptance
Nol pelemahan wewenang; isolasi tenant terbukti.

## Evidence Required
Keluaran test kegagalan · hitung baris sebelum/sesudah di tenant uji.

## Dependencies
Nihil terhadap WO-S01.

## Blockers
AD-02.

## Decision Gate
**Penyelidikan boleh SEKARANG. Perubahan kode menunggu AD-02.**

## Definition of Done
Satu jalur; kegagalan tidak menyisakan apa pun; snapshot terisi; pengawas mencegah jalur kedua.

## Classification
**SAFE TO INVESTIGATE** → implementasi **WAITING FOR ARCHITECTURE DECISION**

---

# WO-S03

## Title
Sales Order Row Access — menutup satu-satunya tabel Sales tanpa kebijakan RLS

## Source Finding
SC-03

## Priority
**P1 / KEAMANAN**

## Objective
`sales_order_lines` dijaga di tingkat baris seperti seluruh tetangganya, tanpa mengubah
perilaku jalur aplikasi yang ada.

## Current AS-IS
RLS menyala, **0 kebijakan** → gagal-tertutup. Seluruh 8 tabel Sales lainnya punya kebijakan.

## Evidence
Sensus `pg_policy` proyek nyata (tabel di SC-03 E1) · pola pembanding
`customer_po_lines_write_ppic` · `sales_orders_update_ppic`.

## Business Rule
Tidak perlu aturan baru — **selaraskan dengan induknya**. Melahirkan model peran kedua
dilarang CLAUDE.md.

## Architecture Boundary
**PERLUAS** yang ada (`jwt_company_id()`, `jwt_app_role()`, `jwt_is_company_leadership()`).
Dilarang membuat sistem izin paralel.

## Required Change
Kebijakan SELECT ber-scope company lewat induk `sales_orders`, dan kebijakan tulis yang
menyelaraskan peran dengan `sales_orders_update_ppic`, memakai bentuk `EXISTS` yang sama
persis dengan `customer_po_lines_write_ppic`.

## Files / Areas to Inspect
Migrasi baru · `src/lib/roles.ts` · kebijakan `customer_purchase_order_lines` sebagai cetakan.

## Database Impact
Menambah kebijakan. **Nol perubahan tabel, nol data disentuh.**

## API Impact
Nihil (service role tetap lewat).

## UI Impact
Nihil.

## Permission Impact
Menambah lapis kedua; tidak mencabut apa pun. Sesuai aturan *"pengaman lama dicabut hanya
setelah penggantinya terbukti"* — di sini **tidak ada yang dicabut**.

## Cross-Domain Impact
Nihil.

## Migration Impact
Satu migrasi, tiga proyek (nyata, staging, CI).

## Tests Required
Pengguna berwenang company sama → baris terlihat · pengguna company lain → **nol baris,
dibuktikan langsung** · peran tanpa wewenang tulis → ditolak server · jalur aplikasi yang ada
**tidak berubah** (regresi).

## UX Acceptance
Tidak ada perubahan tampilan yang diharapkan; bila ada, itu regresi.

## Business Acceptance
Tidak terlihat pengguna — itu memang tujuannya.

## Security Acceptance
Isolasi tenant terbukti lewat test yang dijalankan, **bukan lewat pembacaan kebijakan**.

## Evidence Required
Keluaran test isolasi · sensus `pg_policy` sesudah, menunjukkan `sales_order_lines` > 0.

## Dependencies
**Nihil.**

## Blockers
**Nihil.**

## Decision Gate
**Tidak ada gerbang.**

## Definition of Done
Nol tabel Sales dengan RLS menyala dan nol kebijakan; isolasi terbukti; nol regresi.

## Classification
**SAFE TO IMPLEMENT**

---

# WO-S04

## Title
Customer PO Hold / Cancel — memberi pemicu pada status yang sudah punya aturan

## Source Finding
SC-02

## Priority
**P1**

## Objective
PO Klien dapat ditahan, dilepas, dan dibatalkan lewat layar oleh orang yang berwenang, dengan
alasan tercatat.

## Current AS-IS
`on_hold`/`cancelled` hanya label + warna Tag. Nol endpoint, nol tombol. Kejadian **keenam**
kelas "status tanpa pemicu".

## Evidence
`CustomerPurchaseOrdersPage.tsx:69-78` · sensus `on_hold` = 2 berkas (halaman + glossary) ·
`status_transition_rules` (5 aturan) · `status_transition_log.reason` selalu `null`.

## Business Rule
**Bentuknya sudah terjawab bukti:** `on_hold -> processed` **tidak ada** → konversi ke SO
terblokir selama ditahan; `cancelled` **terminal**; riwayat terjaga di
`status_transition_log`. **Artinya belum:** BD-05, BD-06, BD-07.

## Architecture Boundary
Mesin statusnya sudah kanonik — **jangan membangun yang kedua**. Yang dibangun hanya pemicu,
wewenang, dan alasan.

## Required Change
Setelah BD-05..07: aksi UI + endpoint + penegakan peran + alasan (dan bila wajib, isi kolom
`reason` yang hari ini selalu kosong).

## Files / Areas to Inspect
`CustomerPurchaseOrdersPage.tsx` · `src/features/mrp/server/` · `enforce_status_transition()` ·
`src/lib/roles.ts`

## Database Impact
Nihil pada struktur. Kemungkinan: mengisi `reason` yang selama ini `null`.

## API Impact
Endpoint transisi status PO Klien.

## UI Impact
Aksi merusak **berjauhan** dari aksi biasa · modal **berbahaya** untuk batal, **transaksional**
untuk tahan/lepas.

## Permission Impact
**BD-06. Jangan menebak.**

## Cross-Domain Impact
Konversi PO → SO: sudah dijaga trigger; jalur aplikasi wajib memberi pesan yang bisa dibaca.

## Migration Impact
Kemungkinan mengubah `enforce_status_transition()` agar meneruskan alasan.

## Tests Required
tahan · lepas · batal · transisi terlarang ditolak (`processed -> on_hold`,
`cancelled -> new`) · peran ditegakkan **server** · audit · PO ditahan **tidak bisa** diproses.

## UX Acceptance
Enam lebar · tiga pemeriksaan tepi · galat tingkat field pada isian alasan.

## Business Acceptance
Pemilik produk mengenali arti "Ditunda" tanpa dijelaskan.

## Security Acceptance
Server menolak, bukan tombol disembunyikan.

## Evidence Required
Tangkapan layar · keluaran test · baris `status_transition_log`.

## Dependencies
BD-05, BD-06, BD-07.

## Blockers
Ketiga keputusan itu.

## Decision Gate
**JANGAN membuat tombol sebelum ketiganya dijawab** (§7.2).

## Definition of Done
Ketiga aksi hidup, berwenang, beralasan, teruji, dan tercatat.

## Classification
**WAITING FOR BUSINESS DECISION**

---

# WO-S05

## Title
Pemilih alamat tersimpan di formulir pengiriman

## Source Finding
SC-05 bagian (a) · SC-05b

## Priority
**P1**

## Objective
Alamat yang sudah didaftarkan di halaman Pelanggan dapat **dipilih** saat membuat pengiriman,
tanpa mengetik ulang — dan alamat sekali-pakai tetap bisa diketik.

## Current AS-IS
Server sudah menerima & memvalidasi `delivery_address_id` sepenuhnya. Formulir pengiriman
**tidak pernah mengirimnya** dan tidak pernah memuat daftarnya.

## Evidence
`createShipmentWithSignature.ts:81-108` (validasi lengkap: company, arsip, salin ke teks beku) ·
`:201` (jejak id) · sensus `ShipmentsPage.tsx`: **nol** `delivery_address_id`, **nol**
pemanggilan `/api/customer-delivery-addresses` · `ShipmentsPage.tsx:268-274` (bawaan dari
riwayat pengiriman).

## Business Rule
Tidak perlu aturan baru. Yang berlaku sudah tetap: alamat yang **dipilih saat itu** dibekukan
ke `shipments.delivery_address`; pengiriman historis tidak ikut berubah bila master berubah.

## Architecture Boundary
**Nol perubahan sumber kebenaran.** Teks beku tetap sumber kebenaran; id tetap jejak
referensi; `customers.shipping_address` **tidak disentuh sama sekali** (itu WO-S05b).

## Required Change
Muat alamat pelanggan saat formulir dibuka · kontrol pilih dengan pilihan "ketik alamat
sekali pakai" · kirim `delivery_address_id` bila dipilih · keadaan kosong yang menawarkan
jalan ke pengelolaan alamat · sembunyikan alamat terarsip.

## Files / Areas to Inspect
`src/features/mrp/pages/ShipmentsPage.tsx` · `createShipmentWithSignature.ts` (baca saja) ·
`app/api/customer-delivery-addresses/route.ts` · `CustomersPage.tsx` (cetakan UI yang sudah
disetujui)

## Database Impact
**NIHIL.**

## API Impact
**NIHIL** — memakai endpoint yang sudah ada.

## UI Impact
Satu kontrol pilih + keadaan kosong di modal pembuatan pengiriman. Komponen Carbon yang sudah
dipakai; **jangan membuat pola baru** (§19).

## Permission Impact
**NIHIL** — pembaca alamat sama dengan pembuat pengiriman.

## Cross-Domain Impact
**NIHIL.**

## Migration Impact
**NIHIL.**

## Tests Required
Alamat tersimpan dipilih → `delivery_address` terisi teks dari daftar dan `delivery_address_id`
tercatat · alamat sekali-pakai tetap bekerja · alamat terarsip **tidak** bisa dipilih ·
pelanggan tanpa alamat → keadaan kosong, bukan kontrol kosong · alamat master diubah **setelah**
pengiriman terbit → pengiriman **tidak berubah** (snapshot terbukti).

## UX Acceptance
Enam lebar (360/672/768/1280/1440/1920) · **tiga** pemeriksaan tepi · nama yang terbaca
pembaca layar (`titleText` + `hideLabel`, **bukan** `titleText=""`) · fokus keyboard terlihat ·
keadaan memuat/kosong/galat ditangani.

## Business Acceptance
Petugas gudang tidak perlu mengetik ulang alamat yang sudah terdaftar.

## Security Acceptance
Server sudah memvalidasi kepemilikan company dan status arsip — **jangan** melemahkannya
dengan mempercayai kiriman klien.

## Evidence Required
Tangkapan layar 6 lebar · keluaran test · bukti snapshot tidak berubah setelah master diubah.

## Dependencies
**Nihil.**

## Blockers
**Nihil.**

## Decision Gate
**Tidak ada gerbang** — §17 dipatuhi: bagian yang menunggu keputusan (WO-S05b) dipisahkan,
bagian ini jalan.

## Definition of Done
Alamat tersimpan dapat dipilih dan terbukti dibekukan; alamat sekali-pakai tetap ada; enam
lebar lulus; nol perubahan skema.

## Classification
**SAFE TO IMPLEMENT**

---

# WO-S05b

## Title
Nasib `customers.shipping_address` + alamat tujuan di tingkat Sales Order

## Source Finding
SC-05 bagian (b) & (c) · BL-04

## Priority
P2

## Objective
Menghapus kemungkinan salah paham antara kolom lama dan daftar alamat, dan menentukan perlu
tidaknya alamat di tingkat Sales Order.

## Current AS-IS
`customers.shipping_address` dapat diisi lewat formulir pelanggan dan **tidak pernah dibaca
oleh apa pun yang membuat pengiriman**. `sales_orders` **tidak punya kolom alamat sama sekali**.

## Evidence
Sensus pemakai `shipping_address` (4 berkas, seluruhnya daftar/formulir) · daftar kolom
`sales_orders` terukur · data nyata: **0** pelanggan dengan kolom itu terisi, **0** baris
`customer_delivery_addresses`, **0** pengiriman.

## Business Rule
**BD-08 belum dijawab.**

## Architecture Boundary
Menyentuh skema → **ditahan** sesuai §10.4 (dilarang menghapus/memigrasi/mengganti nama/
mengubah sumber sebelum sumber kebenaran ditetapkan).

## Required Change
Setelah BL-04 & BD-08. Rekomendasi bertahap: sembunyikan kolom lama dari formulir dulu
(reversibel, nol risiko data), cabut kolomnya **hanya setelah** WO-S05 terbukti dipakai.

## Database Impact
Kelak: migrasi. **Bukan sekarang.**

## Tests Required
Bila kolom dicabut: nol pembaca tersisa, dibuktikan sensus, bukan diyakini.

## Dependencies
BL-04, BD-08, dan **WO-S05 terbukti dipakai**.

## Blockers
Ketiganya.

## Decision Gate
**Nol perubahan skema di batch ini.**

## Definition of Done
Satu tempat untuk alamat kirim pelanggan; nol field yang bisa diisi tanpa berdampak.

## Classification
**WAITING FOR ARCHITECTURE DECISION**

---

# WO-S06

**TIDAK DIBUAT.** Syaratnya — *"ONLY IF current evidence shows implementation conflict"* —
diperiksa dan **tidak terpenuhi**. Lihat bagian *Master Document / DEC-S10* di
`SALES_CRM_FINDING_RECONCILIATION.md`.

---
---

# GELOMBANG KEDUA — WS-S01..WS-S08 (29 Agustus 2026)

**Pemicu:** empat keputusan bisnis DITUTUP pemilik produk — **BD-02** (wewenang membatalkan
Sales Order), **BD-03** (pembatalan setelah Work Order / setelah produksi), **BD-06** (tahan /
lepas / batalkan PO klien), **BD-07** (jejak keputusan wajib).

**Yang MASIH terbuka dan sengaja tidak ditebak:** **BD-01** — sebuah order dianggap SELESAI
kapan. §8 perintah menyatakannya tegas: *"Jika business rule belum cukup untuk menentukan
final completion condition: jangan invent. Record: OPEN BUSINESS DECISION."*

| WS | Judul | Prioritas | Status |
|---|---|---|---|
| **WS-S03** | Jalur kanonik pembuatan Sales Order | **P0** | **DONE** |
| **WS-S02** | Snapshot identitas pelanggan di Sales Order | **P0** | **DONE** — diserap WS-S03 |
| **WS-S07** | Analisis sumber kebenaran alamat lama | P1 | **DONE (analisis)** — keputusan tetap terbuka |
| **WS-S06** | Akses baris Sales Order | P1 | **SEBAGIAN** — `sales_order_lines` selesai (SEC-19); matriks penuh belum |
| **WS-S05** | Kategori alasan + jejak keputusan | P1 | **READY** — tetapi kolomnya WAJIB lahir bersama WS-S04 |
| **WS-S04** | PO klien: tahan / lepas / tolak / batalkan | P1 | **READY** |
| **WS-S01** | Siklus hidup + persetujuan + pembatalan Sales Order | **P0** | **SEBAGIAN TERBLOKIR** — pembatalan READY, penyelesaian menunggu **BD-01** |
| **WS-S08** | Usulan prinsip audit keputusan FABRIX-wide | P2 | **DONE (usulan)** — tidak diterapkan, sesuai §14 |

---

## WS-S03 — Jalur kanonik pembuatan Sales Order · **DONE**

### Required Change (dilakukan)
Fungsi kanonik `process_customer_purchase_order()` diperluas dengan **idempotensi**, sehingga
ia kini memiliki SELURUH kemampuan yang tadinya hanya dimiliki jalur TypeScript.
`processCustomerPurchaseOrder.ts` **tidak lagi menulis apa pun** — ia memanggil fungsi itu
lewat klien ber-sesi pengguna dan menerjemahkan pesan galat jadi kode status HTTP.

### Keputusan teknis yang perlu diketahui sesi berikutnya
**Kunci idempotensi DITURUNKAN di dalam fungsi, bukan jadi parameter baru.** Grant di Postgres
melekat pada **tanda tangan** fungsi, dan proyek ini sudah pernah mengalami regresi grant
akibat menambah parameter ke RPC. Diukur sesudah migrasi: tanda tangan tetap
`(integer, integer)` dan **grant identik di ketiga proyek**.

**Urutan pemeriksaan berubah dengan sengaja**: pengenalan pengulangan diletakkan SEBELUM
gerbang "status harus new", karena pada percobaan kedua PO-nya sudah `processed` — dan
urutan lama akan menolak pengulangan yang sah dengan pesan yang membingungkan.

### Evidence
`tests/jalur_kanonik_sales_order.test.ts` — **11 pemeriksaan**, seluruhnya lulus.
**Empat mutasi diuji; keempatnya menggigit** setelah satu pengetatan:

| Mutasi | Akibat |
|---|---|
| fungsi DB berhenti menyalin snapshot identitas | 3 test gagal |
| pengenalan pengulangan dicabut dari fungsi DB | **awalnya NOL test gagal** → penjaga diperketat |
| lapisan aplikasi berhenti memanggil fungsi kanonik | 1 test gagal |
| jalur ketiga ditanam di berkas server lain | 1 test gagal |

**Pengetatan yang lahir dari mutasi kedua, dan kenapa ia penting:** test pengulangan lewat
lapisan aplikasi TETAP HIJAU walau jaminan di basis datanya dicabut — karena lapisan aplikasi
punya pemeriksaan kosmetik yang menjawab lebih dulu dan tidak pernah memanggil fungsinya.
Ditambahkan test `(e2)` yang memanggil fungsi kanonik **langsung**, melewati lapisan itu.

### Batas yang disebut terang-terangan
Kriteria terima §10 menyebut *"kegagalan di tahap insert baris tidak meninggalkan SO yatim"*.
Kegagalan itu **tidak bisa dipaksa** dari permukaan yang bisa dicapai test — diukur:
`sales_order_lines` dan `customer_purchase_order_lines` punya kekangan **identik** (FK item
yang sama, `numeric(14,4)` yang sama, nol CHECK di keduanya), jadi baris PO klien yang sah
selalu sah sebagai baris Sales Order. Yang diuji sebagai gantinya adalah keatomikan **satuan
kerjanya** lewat tabrakan nomor SO, dengan tiga bukti terpisah: nol Sales Order, nol baris,
dan **PO klien tidak berpindah status** — padahal perpindahan itu langkah TERAKHIR fungsi.

---

## WS-S07 — Analisis sumber kebenaran alamat lama · **DONE (analisis)**

### Hasil, dan ia menutup pertanyaannya
Sensus seluruh `src/`, `app/`, `tests/`, dan `scripts/`: `customers.shipping_address` punya
**LIMA titik sentuh, seluruhnya di dalam lingkaran CRUD pelanggan**:

```
listCustomers.ts:23          -> dimuat ke daftar
customerValidation.ts:21,54  -> diurai dari formulir
CustomersPage.tsx:52,81,294,319,806 -> keadaan formulir + satu kotak isian
```

**NOL pembaca** di pembuatan pengiriman, layanan pengiriman, surat jalan, POD, Sales Order,
atau API mana pun selain CRUD pelanggan. **Nol baris** berisi nilai di data nyata.

**Vonis: kolom ini WRITE-ONLY.** Orang bisa mengetik alamat di sana dan alamat itu tidak akan
pernah dipakai apa pun — tanpa satu pun tanda di layar. Ini golongan C menurut CLAUDE.md,
dengan pembeda penting dari Nomor BPOM / Kode Halal: keduanya nol perhitungan **tetapi
berguna sebagai catatan kepatuhan**, sedangkan kotak ini **menyaru sebagai field operasional**.

### Yang TIDAK dilakukan, dan kenapa
§13 melarang `drop` / `migrate` / `rename` / `remove` / `rewrite` sampai analisisnya tuntas.
Analisisnya kini tuntas — **tetapi keputusan atas nasib kolomnya tetap milik Architecture
Guardian**, bukan Claude Code. Rekomendasi tidak berubah: **sembunyikan isiannya dulu**
(reversibel, nol risiko data), cabut kolomnya **hanya setelah** WO-S05 terbukti dipakai.

---

## WS-S05 — Kategori alasan + jejak keputusan · **READY, dengan kendala urutan**

Rancangan lengkapnya di `SALES_CRM_DECISION_AUDIT_ARCHITECTURE.md`. Ringkasnya:
**PERLUAS `status_transition_log` dengan lima kolom**, jangan membuat entitas keputusan baru.

**KENDALA YANG MENGIKAT:** kelima kolom itu **tidak boleh lahir sendirian**. Kolom audit yang
selalu `null` adalah bentuk yang sama persis dengan "status tanpa pemicu" — dan
`status_transition_log.reason` **sudah membuktikannya**: ia ada sejak awal dan nol baris
pernah mengisinya. Kolomnya lahir **bersama penulis pertamanya**, yaitu WS-S04.

**Konsekuensi teknis yang harus disadari sekarang, bukan ditemukan belakangan:** karena
trigger tidak menerima parameter dan PostgREST tidak mengizinkan dua pernyataan dalam satu
transaksi, tombol Tahan/Lepas/Batalkan **wajib lewat fungsi basis data** — bukan lewat
`update` dari kode aplikasi.

---

## WS-S04 — PO klien: tahan / lepas / tolak / batalkan · **READY**

Aturan bisnisnya **sudah tertutup** (BD-06), dan bentuk transisinya sudah kanonik di
`status_transition_rules`. Yang dibangun: fungsi basis data per keputusan, tombolnya, katalog
kategori alasan per departemen (§2), dan pengisian kelima kolom WS-S05.

**Satu hal yang WAJIB diperiksa saat membangunnya, dan sudah terukur:** BD-06 menyatakan
*"Sales tidak boleh sembarang release blocker department lain"* — sedangkan
`status_transition_rules` hari ini hanya mengenal bentuk `on_hold -> new`, **tanpa** konsep
"departemen mana yang menahan". Jadi departemen penahan harus tersimpan (di
`actor_department_snapshot`) dan **dibaca kembali** saat pelepasan. Aturan itu **tidak
tertegakkan sendiri** oleh mesin status yang ada.

---

## WS-S01 — Siklus hidup Sales Order · **SEBAGIAN TERBLOKIR**

**READY sekarang** (BD-02 & BD-03 tertutup): pembatalan sebelum konfirmasi, permintaan
pembatalan setelah konfirmasi, tinjauan dampak setelah Work Order / setelah produksi.

**TERBLOKIR:** penyelesaian order — **BD-01 masih terbuka**.

**KENDALA ARSITEKTUR yang belum hilang:** AD-01 tetap terbuka — apakah `in_production` dan
`completed` adalah status **tersimpan** (seperti `status_transition_rules` memperlakukannya)
atau **diturunkan** (seperti DEC-S11 menempatkannya). Pembatalan **tidak** bergantung pada
jawaban itu, jadi ia boleh jalan lebih dulu.

**LARANGAN KERAS dari §7 dan §27, dicatat supaya tidak tergerus saat implementasi:**
pembatalan **TIDAK BOLEH menghapus** Sales Order, Work Order, riwayat produksi, pemakaian
bahan, riwayat persediaan, ketertelusuran lot, maupun riwayat pengiriman. Kuantitas yang
sudah terkirim tetap menjadi eksekusi historis; pembatalan hanya berlaku pada komitmen yang
**belum** dieksekusi.
