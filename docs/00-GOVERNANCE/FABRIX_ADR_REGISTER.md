# FABRIX ADR REGISTER
## Architecture Decision Record control

Use an ADR for:
- cross-domain ownership changes
- canonical entity changes
- state-machine changes
- UX top-level navigation changes
- data model migrations with business impact
- security/tenant model changes
- integration contract changes
- AI authority/action changes
- changes that invalidate an existing task or architecture baseline

### ADR template
ID:
Title:
Status: PROPOSED / ACCEPTED / REJECTED / SUPERSEDED
Date:
Problem:
Context:
Options:
Decision:
Rationale:
Business impact:
UX impact:
Technical impact:
Data/migration impact:
Security impact:
Testing impact:
Affected domains:
Affected documents:
Supersedes:
Superseded by:
Approver:
Evidence:

### Rule
No silent architectural overwrite.

---

# REGISTRI ADR TERISI — 29 Agustus 2026

> Bagian di atas adalah **cetakan kosong**. Nol ADR pernah dicatat, padahal keputusan
> arsitektur yang mengikat sudah diambil dan sudah berjalan di kode. Bagian ini
> mencatatnya **surut**, dengan bukti, supaya tidak ada penimpaan diam-diam.
>
> **Aturan pengisian**: hanya keputusan yang **benar-benar sudah diambil** yang berstatus
> ACCEPTED. Yang belum diputuskan tetap PROPOSED — **tidak dinaikkan hanya karena kodenya
> sudah ditulis**.

## Ringkasan

| ID | Judul | Status | Domain |
|---|---|---|---|
| ADR-001 | Isolasi tenant lewat RLS ber-`company_id` | ACCEPTED | seluruh |
| ADR-002 | Biaya SDM tiga golongan, bukan dua | ACCEPTED | Costing |
| ADR-003 | Jejak keputusan memperluas log yang ada, tidak membuat tabel kedua | ACCEPTED | seluruh |
| ADR-004 | Dilarang membangun sistem identitas/peran/persetujuan paralel | ACCEPTED | Keamanan |
| ADR-005 | Deviasi resmi dari Carbon: isi lebar penuh | ACCEPTED | UX |
| ADR-006 | Sales tidak memiliki status produksi/pengiriman (AD-01) | ACCEPTED | Sales ↔ Mfg ↔ Log |
| ADR-007 | Satu jalur kanonik pembuatan Sales Order (AD-02) | ACCEPTED | Sales |
| ADR-008 | Peran Sales tersendiri; `admin_staff` bukan Sales (DEC-S12) | ACCEPTED | Keamanan |
| ADR-009 | Mengajukan pembatalan ≠ membatalkan | ACCEPTED | Sales |
| ADR-010 | Kewajiban pembayaran tanpa pencatatan pembayaran (DEC-S05) | ACCEPTED sebagian | Sales ↔ Finance |
| ADR-011 | Kosakata status Sales Order (AD-03) | **PROPOSED** | Sales |

---

## ADR-001 · Isolasi tenant lewat RLS ber-`company_id`
**Status** ACCEPTED · **Tanggal** fondasi proyek
**Masalah** Isolasi data antar tenant tidak boleh bergantung pada filter di kode aplikasi.
**Keputusan** Setiap tabel utama ber-`company_id`, dan isolasinya ditegakkan **Row-Level
Security di Postgres** — bukan `where` di aplikasi.
**Alasan** Filter aplikasi bocor lewat satu query yang lupa; RLS tidak bisa dilupakan.
**Dampak keamanan** 161 kebijakan aktif. Diuji langsung: tenant uji melihat **0 dari 30**
karyawan tenant nyata.
**Utang yang diketahui** **9 tabel** ber-RLS **tanpa satu pun kebijakan** — RLS menyala
berarti **menolak semua**, jadi ini bukan lubang, melainkan tabel yang tidak bisa diakses
lewat jalur pengguna. Dicatat **SEC-20**.
**Bukti** `tests/rls_isolation*.test.ts` · katalog `pg_policies`.

## ADR-002 · Biaya SDM tiga golongan, bukan dua
**Status** ACCEPTED · **Tanggal** 23 Agu 2026 · **Penyetuju** pemilik produk
**Masalah** Bila seluruh non-direct digabung jadi satu "indirect", gaji Direktur ikut
membebani HPP.
**Keputusan** **Direct · Manufacturing Overhead · General & Administrative.** Dua golongan
pertama masuk HPP; yang ketiga **tidak sama sekali**. Dasar pembagian: **jumlah batch**.
**Dampak bisnis** Menentukan **arti** angka HPP dan margin.
**Dokumen terdampak** `CLAUDE.md` (naskah lengkap, termasuk penggolongan 30 karyawan).

## ADR-003 · Jejak keputusan memperluas log yang ada
**Status** ACCEPTED · **Tanggal** 29 Agu 2026
**Masalah** Jejak keputusan (siapa, kenapa) belum ada, sementara **dua** sistem jejak sudah
ada: `status_transition_log` dan `data_change_audit_log`.
**Opsi** (a) tabel `decision_records` baru · (b) perluas `status_transition_log` ·
(c) perluas `data_change_audit_log`.
**Keputusan** **(b)**. Ditambah 5 kolom + tabel master `decision_reason_categories`.
Konteks pelaku dialirkan lewat `set_config` berlingkup transaksi, dibaca trigger.
**Alasan** (a) melahirkan sumber kebenaran ketiga; (c) mencampur *apa yang berubah* dengan
*kenapa diputuskan*.
**Dampak pengujian** 16 pemeriksaan.
**Keterbatasan yang disadari** `update` biasa **tetap** berpindah status dan tetap tercatat,
hanya tanpa pelaku dan alasan. **5 dari 6** mesin status belum punya pengisi — **AUD-50**.

## ADR-004 · Dilarang membangun sistem identitas/peran/persetujuan paralel
**Status** ACCEPTED · **Tanggal** 25 Agu 2026
**Keputusan** Bila yang ada bisa diperluas dengan aman, **dilarang** membuat sistem kedua.
Urutan: pertahankan → perluas → pindahkan (dokumentasikan dulu) → cabut → tanya pemilik produk.
**Alasan** Sistem izin kedua tidak pernah mengumumkan dirinya; sejak ia lahir, **tidak ada
satu tempat pun yang bisa menjawab "siapa boleh apa"**.
**Bukti kepatuhan** Peran Sales ditambahkan lewat mekanisme kanonik yang sudah ada
(`users.role` + `src/lib/roles.ts` + RLS), **bukan** tabel `roles`/`permissions` baru.

## ADR-005 · Deviasi resmi dari Carbon: isi lebar penuh
**Status** ACCEPTED · **Tanggal** 25 Agu 2026 · **Penyetuju** pemilik produk
**Keputusan** FABRIX memakai **lebar penuh**, bukan grid berbatas lebar Carbon.
**Alasan** ERP padat data; memotong kolom diam-diam sudah jadi cacat berulang (RSP-01/02).
**Batas** Hanya **lebar**. Tinggi header, token jarak, perilaku layar sempit, SkipToContent,
dan fokus keyboard **tetap** mengikuti Carbon.

## ADR-006 · Sales tidak memiliki status produksi/pengiriman
**Status** ACCEPTED · **Tanggal** 29 Agu 2026 · **Kode asal** AD-01
**Opsi** (a) kolom status eksekusi di `sales_orders` · (b) turunan murni saat dibaca.
**Keputusan** **(b)** — `turunkanEksekusiSo`, **nol** kolom status disimpan di Sales.
**Alasan** Status yang disalin akan basi tanpa berbunyi; pemiliknya Manufacturing/Logistics.
**Bukti** `tests/status_eksekusi_sales_order.test.ts` (11).

## ADR-007 · Satu jalur kanonik pembuatan Sales Order
**Status** ACCEPTED · **Tanggal** 29 Agu 2026 · **Kode asal** AD-02
**Masalah** **Dua** implementasi hidup. Yang terpakai **bukan** yang atomik dan **tidak**
membekukan identitas mitra.
**Keputusan** Satu-satunya jalur: fungsi basis data `process_customer_purchase_order()`.
Lapisan aplikasi **tidak menulis apa pun**; ia memanggil RPC lewat klien ber-lingkup pengguna.
**Idempotensi** kunci **diturunkan** `cpo-<id>` + kekangan unik — bukan penanda yang bisa
dilewati.
**Dampak keamanan** Ditemukan & ditutup **dua** kerentanan saat pekerjaan ini: hibah `PUBLIC`
bawaan Postgres (SEC-21) dan gerbang yang **dilewati** karena semantik NULL SQL (SEC-23).
**Bukti** `tests/jalur_kanonik_sales_order.test.ts` (11) · `matriks_keamanan_sales.test.ts` (11).

## ADR-008 · Peran Sales tersendiri; `admin_staff` bukan Sales
**Status** ACCEPTED · **Tanggal** 29 Agu 2026 · **Kode asal** DEC-S12 · **Penyetuju** pemilik produk
**Keputusan** Peran `sales` ditambahkan ke mekanisme kanonik. Hak: mengelola PO klien &
membuat cepat. **Bukan** hak: Work Order, pengiriman, memutus pembatalan.
**Batas yang ditegaskan pemilik produk** Membuat peran: **ya**. Menugaskan orang sungguhan:
**tidak**. Sampai hari ini **nol** pengguna berperan `sales` di tenant nyata.
**Bukti** `tests/peran_sales.test.ts` (16).

## ADR-009 · Mengajukan pembatalan ≠ membatalkan
**Status** ACCEPTED · **Tanggal** 29 Agu 2026
**Keputusan** Tabel `cancellation_requests` berkunci entitas + id. `ajukan_pembatalan()`
**tidak mengubah status dokumen sama sekali**; `putuskan_pembatalan()` hanya untuk
kepemimpinan, dan **menolak pemohon memutus permintaannya sendiri**.
**Alasan** Pemohon ≠ pemutus. Riwayat eksekusi yang sudah terjadi **tidak ditulis ulang**;
permintaan menyimpan cuplikan keadaan **saat diajukan**.
**Catatan** Sengaja **bukan** status Sales Order baru, karena **AD-03 masih terbuka**.
**Bukti** `tests/permintaan_pembatalan.test.ts` (17).

## ADR-010 · Kewajiban pembayaran tanpa pencatatan pembayaran
**Status** ACCEPTED sebagian · **Tanggal** 29 Agu 2026 · **Kode asal** DEC-S05
**Keputusan** Dibangun **dua lapis pertama**: `payment_terms`, `payment_term_steps`,
`sales_order_payment_obligations` (cuplikan **beku**). **Sengaja nol kolom**
`paid_amount`/`payment_date`/`status`.
**Alasan** Menaruh pembayaran aktual di Sales akan melahirkan **sumber kebenaran kedua** —
persis yang dilarang pemilik produk.
**Aturan pembulatan** Tahap terakhir **menyerap sisa**, dijaga pemeriksaan rekonsiliasi yang
membatalkan penjadwalan bila jumlahnya tidak persis sama dengan nilai SO.
**Terhalang** Domain Finance untuk piutang pelanggan **tidak ada** — **FIN-02** → **BD-10**.
**Bukti** `tests/payment_terms_obligation.test.ts` (15).

## ADR-011 · Kosakata status Sales Order — **PROPOSED**
**Status** **PROPOSED** · **Kode asal** AD-03
**Masalah** Baseline arsitektur menyebut **11** status; implementasi memakai **4**.
**Opsi** (a) implementasi menyusul baseline · (b) baseline diturunkan ke kenyataan ·
(c) status turunan untuk tampilan, status tersimpan tetap 4.
**Keputusan** **BELUM DIAMBIL.** Menunggu pemilik produk.
**Yang terhalang** penamaan status, amandemen SO, penyelesaian SO.
**Aturan yang berlaku sementara** Status baru **hanya** ditambahkan bersama pemicu dan
akibatnya — nilai enum yang tidak pernah dipicu adalah **cacat, bukan persiapan**.

---

## Aturan yang berlaku maju

1. **ADR ditulis SEBELUM kodenya**, bukan sesudah. Sebelas ADR di atas dicatat surut karena
   registrinya kosong; itu **pengecualian sekali**, bukan cara kerja.
2. **PROPOSED tidak naik jadi ACCEPTED karena kodenya sudah jalan.** Yang menaikkan hanya
   keputusan pemilik produk.
3. **Nol penimpaan senyap** — mengubah ADR yang ACCEPTED berarti ADR baru yang
   `Supersedes` yang lama.
