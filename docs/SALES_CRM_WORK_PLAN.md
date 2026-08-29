# FABRIX SALES & CRM — WORK PLAN

## Overall Progress

**64% / 100%**

## Progress Bar

`[████████████▊░░░░░░░] 64%`

> **BACA INI SEBELUM ANGKANYA DIPAKAI.** 64% itu **bobot fase audit yang tuntas**, bukan
> "Sales hampir jadi". Seluruh **PEMBANGUNAN** ada di 36% sisanya — dan bagian terbesarnya
> (Fase H, 13%) **terhalang**. Yang selesai adalah: kita kini tahu persis apa yang ada, apa
> yang benar, apa yang salah, dan apa yang harus diputuskan.

## Current Phase

**PHASE H — IMPLEMENTATION (H1 Core Commercial Corrections)** · mode paralel

## Current Workstream

**GELOMBANG KEDELAPAN — DEC-S05 TERMIN & KEWAJIBAN PEMBAYARAN** (29 Agu 2026).

| Workstream | Status |
|---|---|
| **WS-PAYMENT-TERMS** | **DONE / VERIFIED** — aturan pembayaran bisa dipakai ulang, persentase atau nominal tetap |
| **WS-PAYMENT-OBLIGATION** | **DONE / VERIFIED** — komitmen **beku** per Sales Order, jumlahnya sama persis dengan nilai order |
| **WS-CUSTOMER-PAYMENT** | **BLOCKED BY FIN-02** — pencatatan uang masuk milik Finance, dan domainnya belum ada |
| **WS-CUSTOMER-RECEIVABLE** | **BLOCKED BY FIN-02** — piutang milik Finance, dan domainnya belum ada |

**BD-10 TIDAK ditutup** oleh pekerjaan ini, dan alasannya kini **terukur**: `payments`,
`receivables`, ledger, jatuh tempo — **seluruhnya nihil**. Yang bernama `invoices` adalah
**FABRIX menagih tenant**, bukan tenant menagih pelanggan.

> **Angka sensus, disertai saringannya** (diperbarui 29 Agu 2026 sore). Sensus pertama menyebut
> **101 tabel**; itu benar untuk **tabel + view sebelum tiga tabel payment lahir**. Sensus ulang
> hari ini dengan saringan lebih ketat: **96 tabel dasar** (tabel + view = 104). Kesimpulannya
> identik — nol tabel pembayaran pelanggan, nol piutang, nol ledger, nol jatuh tempo.

**Penyerahan FIN-02 sudah disusun** dan menunggu Architecture Guardian:
`docs/finance/FIN-02_CUSTOMER_RECEIVABLE_DOMAIN_GAP.md` (paket penyelidikan + 24 pertanyaan yang
**sengaja tidak dijawab sendiri**) dan `docs/sales-crm/SALES_CRM_FIN02_ARCHITECTURE_HANDOFF.md`.

**Progres TIDAK naik karena dokumen ini lahir.** Tetap **64%** — yang bertambah adalah
kejelasan, bukan kapabilitas. Angkanya hanya berubah bila kriteria terima kapabilitas bisnis
berubah.

## Gelombang ketujuh — permintaan pembatalan + Sales menahan PO klien

Dua kapabilitas yang tadinya terkunci peran Sales kini terbuka dan **terbukti bekerja**.

| Workstream | Status |
|---|---|
| **WS-SALES-ROLE** | **DONE** (gelombang keenam) |
| **WS-SALES-CANCEL** | **DONE** — permintaan ≠ pembatalan, pemohon ≠ pemutus |
| **WS-PO-HOLD** | **DONE** — Sales bisa menahan PO klien dengan alasan miliknya sendiri |

## Gelombang keenam — peran Sales + tujuh keputusan ditutup

**Peran `sales` kini ada sebagai peran tersendiri.** `admin_staff` **tidak disentuh** dan
tetap bukan Sales. **Nol pengguna nyata dipindahkan** — membuat peran bukan menugaskan orang.

**Tujuh keputusan bisnis ditutup pemilik produk:** DEC-S02 Quotation · S03 Sample ·
S04 Kode produk pelanggan · S05 Payment terms · S07 Komplain · S08 Amandemen SO ·
S09 Alamat kirim. **Keputusan CLOSED, implementasi OPEN** — ketujuhnya belum dibangun.
DEC-S06 tetap OPEN DISCOVERY; DEC-S10 butuh tinjauan arsitektur.

## Gelombang kelima — verifikasi independen (SEC-23)

Diminta memverifikasi ulang SEC-21 tanpa mempercayai laporannya sendiri.
**Verifikasi itu membantah laporan saya**: sesi yang membawa `company_id` tetapi **tanpa
klaim peran** masih bisa membuat Sales Order. **Sudah ditutup (SEC-23), dan pengawas
KELASNYA dibangun** — bukan hanya kasusnya.

**Koreksi angka:** "11 → 5 fungsi terbuka anon" benar hanya untuk `SECURITY DEFINER`.
Sebenarnya **14 dari 53** fungsi non-trigger dapat dipanggil anon; sembilan sisanya
**bukan** `SECURITY DEFINER` sehingga RLS tetap berlaku.

**Enam berkas keputusan** kini punya nama sendiri di `docs/sales-crm/`.

## Gelombang keempat — koreksi keamanan P0 (SEC-21)

Penjaga proyek ini menolak pekerjaan gelombang ketiga yang sudah saya laporkan selesai.
Ditelusuri, dan **terbukti dengan percobaan sungguhan**: pemanggil **tanpa login** dapat
membuat Sales Order untuk perusahaan yang bukan miliknya. **Sudah ditutup dan dibuktikan
tertutup.**

**Selesai gelombang ini:** SEC-21 (gagal-tertutup + pencabutan hak anon), matriks keamanan
9 skenario, perbaikan cacat penolong test bersama, verifikasi cakupan pencadangan.

**Usulan keputusan disiapkan, tidak diimplementasikan:** AD-03, BD-09, BD-10, Peran Sales,
Override — seluruhnya di `docs/sales-crm/SALES_CRM_DECISION_PROPOSALS.md`.

## Current Step

Menunggu lima keputusan di atas. Yang **tidak** terhalang: **permintaan pembatalan Sales
Order** — tetapi ia sendiri menunggu kejelasan **Peran Sales**, karena "Sales mengajukan"
tidak bisa ditegakkan tanpa peran yang mewakilinya.

> **Tiga temuan berubah material saat diverifikasi ulang**, dan itu mengubah pekerjaannya —
> bukan sekadar memperbarui catatan. **SC-04**: jalur atomik ternyata **sudah ada** di
> database dan tidak dipakai (jadi perbaikannya "pilih satu jalur", bukan "tulis transaksi").
> **SC-05**: sumber kebenaran alamat **sudah terverifikasi**, jadi BL-04 menyempit dari
> "sumber kebenaran mana" menjadi "nasib kolom lama". **SC-01**: mesin statusnya ternyata
> **sudah kanonik di database** — yang nihil adalah kode yang menggerakkannya.

## Status

IN PROGRESS — sebagian workstream berjalan, sebagian terhalang

## Selesai di gelombang ketujuh 29 Agu 2026 — pembatalan & tahan

| Kode | Hasil | Bukti |
|---|---|---|
| **PJL-11** | Sales **mengajukan** pembatalan; Manager/GM **memutuskan**. Mengajukan **tidak** membatalkan | `tests/permintaan_pembatalan.test.ts` (17) · **4 mutasi, keempatnya menggigit** |
| **WS-PO-HOLD** | Sales menahan PO klien dengan kategori alasan milik Sales, jejaknya mencatat peran & departemennya | terbukti di `tests/peran_sales.test.ts` butir (j) |

**Keputusan arsitektur yang paling menentukan:** menambah status `cancellation_requested`
akan lebih elegan — dan **ditolak**, karena **AD-03 masih terbuka** dan menambah status akan
mendahului keputusan itu. Bentuk yang dipilih **tidak menyentuh** `sales_orders.status`
selama tahap permintaan, sehingga tetap benar apa pun hasil AD-03.

**Yang tidak pernah dihapus:** pembatalan hanya mengubah **satu kolom status**. Nol
`DELETE`. Test (8) membuktikannya: pembatalan disetujui, dan riwayat pengiriman beserta
`qty_shipped` **terbukti tidak berubah**.

## Selesai di gelombang keenam 29 Agu 2026 — peran Sales

| Kode | Hasil | Bukti |
|---|---|---|
| **SEC-24** | Peran `sales` tersendiri, hak paling minimum | `tests/peran_sales.test.ts` (16) · **4 mutasi, keempatnya menggigit** |

**Arsitektur yang ditemukan dan menentukan bentuknya:** FABRIX **tidak punya** tabel
`roles`, `permissions`, `role_permissions`, maupun `departments` — nol, seluruhnya. Nama
peran **itulah** mekanisme kanoniknya. Membuat tabel izin baru justru akan melanggar
larangan membangun sistem peran paralel.

**Yang Sales dapat:** pelanggan + PO klien, dan departemen keputusan `sales` sehingga bisa
**menahan** PO klien sesuai BD-06.
**Yang Sales TIDAK dapat:** wewenang pimpinan, persetujuan Finance/PPIC/Manager, data
keuangan, upah, pembelian, BOM, Work Order, pengiriman, penyesuaian stok.

**Pemisahan yang paling mudah rusak** sengaja dipecah dua fungsi: `decisionDepartment()`
menjawab *departemen mana*, `canApproveDepartment()` menjawab *boleh menyetujui atau tidak*.

## Selesai di gelombang keempat 29 Agu 2026 — koreksi keamanan P0

| Kode | Hasil | Bukti |
|---|---|---|
| **SEC-21** | Pemanggil tanpa login **tidak lagi** bisa membuat Sales Order maupun membaca data keuangan | percobaan penyerang diulang → `42501`, **nol** SO tercipta · 11 → 5 fungsi terbuka anon |
| **Matriks keamanan** | 9 skenario §10, tiap penolakan diperiksa **alasannya** | `tests/matriks_keamanan_sales.test.ts` (8) · **2 mutasi menggigit** |
| **Penolong test** | `ensureAuthUser` gagal untuk email ber-huruf besar | diperbaiki **di kelasnya**, bukan di satu berkas |
| **Pencadangan** | 92 tabel diuji ekspor sungguhan, nol gagal | tabel baru mengekspor 26 baris |

**Temuan yang dicatat, tidak dikerjakan:** **SEC-22** (4 penolong RLS yang menerima
identitas sebagai parameter — mencabutnya akan memadamkan RLS berjalan) dan **INF-28**
(pencadangan terbukti bisa **diekspor**, belum terbukti bisa **dipulihkan**).

## Selesai di gelombang ketiga 29 Agu 2026

| WS | Hasil | Bukti |
|---|---|---|
| **WS-S04** | Jejak keputusan kini tahu **siapa, kenapa, dari apa ke apa** — `status_transition_log` diperluas 5 kolom + katalog 26 kategori alasan. **Nol tabel audit baru** | `tests/aksi_po_klien_jejak_keputusan.test.ts` (14) · migrasi `20260906100000` di 3 proyek |
| **WS-S05** | PO klien bisa **Ditahan / Dilepas / Dibatalkan**, dengan wewenang per departemen dan alasan wajib | migrasi `20260906110000` · **5 mutasi diuji, kelimanya menggigit** · bukti peramban 6 lebar × (panel + modal) |

**Temuan baru yang dicatat, bukan dikerjakan:** **PJL-10** (konflik registry vs implementasi
untuk nama status Sales Order) dan **AUD-50** (lima tabel ber-jejak lain yang pelakunya
belum pernah terisi — sengaja dikerjakan bersama fitur masing-masing, bukan sebagai sapuan).

## Selesai di gelombang kedua 29 Agu 2026

| WS | Hasil | Bukti |
|---|---|---|
| **WS-S03** | Pembuatan Sales Order kini **satu jalur**, atomik, dan membekukan identitas pelanggan | `tests/jalur_kanonik_sales_order.test.ts` (11) · migrasi `20260905100000` di 3 proyek · **4 mutasi diuji, keempatnya menggigit setelah 1 pengetatan** |
| **WS-S02** | Snapshot identitas pelanggan di Sales Order | **diserap WS-S03** — tidak dikerjakan terpisah, karena menambalnya sendiri akan melanggengkan dua jalur |
| **WS-S07** | Analisis sumber kebenaran alamat lama **tuntas** | sensus 5 titik sentuh, **nol pembaca** di jalur pengiriman, nol baris terisi |
| **WS-S08** | Usulan prinsip audit keputusan FABRIX-wide | `SALES_CRM_DECISION_AUDIT_ARCHITECTURE.md` — **usulan, tidak diterapkan** (§14) |

**Temuan arsitektur yang menentukan arah WS-S05:** FABRIX **sudah punya** mekanisme audit
keputusan kanonik (`status_transition_log`, ber-trigger di 6 tabel). Yang kurang **lima
kolom**, bukan satu tabel. Terukur: `data_change_audit_log` punya 598 baris dan **hanya 4
yang tahu siapa pelakunya** — sisanya mencatat peran *database*, bukan peran FABRIX.

## Selesai di giliran 29 Agu 2026 (batch rekonsiliasi)

**Dua work order tuntas — keduanya yang TIDAK menunggu keputusan siapa pun:**

| WO | Hasil | Bukti |
|---|---|---|
| **WO-S03** | `sales_order_lines` tidak lagi jadi satu-satunya tabel Sales ber-RLS tanpa kebijakan | `tests/akses_baris_sales_order_lines.test.ts` (7) · migrasi `20260904100000` di 3 proyek · **2 mutasi diuji, keduanya menggigit** |
| **WO-S05** | Alamat tersimpan bisa dipilih saat membuat pengiriman | `tests/wos05_pemilih_alamat_pengiriman.test.ts` (10) · **5 mutasi diuji, semuanya menggigit** · bukti peramban 6 lebar + 3 pemeriksaan tepi |

**Task tercatat di registry kanonik `build_tasks`** (bukan hanya di dokumen):
`SEC-19` selesai · `KRM-06` selesai · `PJL-07` menunggu (P0) · `PJL-08` menunggu ·
`SEC-20` menunggu · `DS-26` menunggu · `PJL-03` diperbarui dengan hasil rekonsiliasi.

**Angka tidak naik dan itu disengaja.** Kedua WO memenuhi kriteria terimanya sendiri, tetapi
**H1 maupun H2 belum tuntas seluruhnya** — dan bobot hanya diberikan per butir berbobot yang
tuntas, bukan per pekerjaan yang selesai.

> **KEMAJUAN TETAP 64%, DAN ITU DISENGAJA.** Dua workstream sudah menghasilkan kode yang
> teruji dan terverifikasi di peramban — tetapi **H1** (koreksi komersial) dan **H2**
> (pelengkapan kapabilitas) masing-masing belum tuntas seluruhnya. Aturan yang berlaku:
> jangan menaikkan angka hanya karena kode sudah ditulis, berkas berubah, atau commit
> bertambah. Angka naik saat butirnya benar-benar memenuhi kriteria terima.

## Completed

**64%** (Fase A, B, C, D, E tuntas + G1)

## Remaining

**36%** — dan seluruh pembangunan ada di sini

## Blockers

**SATU, dan ia menentukan batas pekerjaan hari ini:**

> **BL-01 — Seluruh program SALES-1..5 berstatus `ditunda_sadar` di registry kanonik, dan
> pemicu pembukaannya TERUKUR BELUM TERPENUHI.**
>
> Pemicu SLS-01: *"Setelah SATU ORDER BERJALAN TUNTAS di sistem, dari PO klien sampai barang
> terkirim."* Diukur di data nyata (baca-saja, 28 Agu 2026): **1 pelanggan · 1 PO klien ·
> 3 persetujuan · 0 Sales Order · 0 Work Order · 0 batch · 0 pengiriman · 0 konfirmasi terima.**
>
> Alurnya berhenti di persetujuan PO. Belum ada satu order pun yang tuntas.

**Yang diblokir**: PHASE H (implementasi) dan seterusnya.
**Yang TIDAK diblokir**: PHASE A–G — seluruhnya audit, rekonsiliasi, desain, dan penyiapan
keputusan. Tidak satu pun membangun sesuatu.

## Decisions Required

**DEC-S01 (PRODUCT DECISION REQUIRED)** — apakah pemicu SLS-01 tetap berlaku, atau program
Sales dibuka lebih awal? Tanpa jawaban ini, Phase H tidak boleh dimulai.

Ditambah **7 pertanyaan wawancara** yang sudah tercatat di tinjauan arsitektur (Bagian H) dan
belum pernah dijawab — lihat DECISION LOG.

## Current Objective

Menyusun gambaran AS-IS Sales/CRM yang terukur: apa yang benar-benar ada di repositori,
route, halaman, API, skema, izin, uji, dan perilaku runtime.

## Next Step

**B2 — Sales/CRM Route & Navigation Inventory**

## Last Updated

2026-08-28

---

# CATATAN LOKASI & KEPEMILIKAN

**Berkas ini BUKAN sistem pelacakan kedua.** Registry task kanonik tetap `build_tasks`
(SLS-00…SLS-07, SLS-90, PJL-xx, PMB-xx, AUD-18/19). Berkas ini **menunjuk** kode-kode itu dan
**tidak pernah** membuat kode baru. Bila terjadi perbedaan, `build_tasks` menang.

Hierarki dokumen yang berlaku, dari yang paling menang:

1. Keputusan pemilik produk
2. `CLAUDE.md` (termasuk SD-1..SD-13 yang sudah masuk)
3. `docs/review-fable-sales-architecture.md` — **menang atas** v0.1
4. `docs/FABRIX_Sales_Technical_Architecture_Fable5_v0_1.md` (v0.1)

---

# MASTER ROADMAP — 100%

| Phase | Nama | Bobot | Selesai | Status |
|---|---|---:|---:|---|
| **A** | Governance & Workspace Initialization | **8%** | **8%** | **DONE** |
| **B** | AS-IS Repository & Runtime Reconstruction | **12%** | **12%** | **DONE** |
| **C** | Existing Commercial Core Audit | **15%** | **15%** | **DONE** |
| **D** | Full Sales & CRM Domain Reconciliation | **15%** | **15%** | **DONE** |
| **E** | Entity / State / Boundary / UX Reconciliation | **12%** | **12%** | **DONE** |
| **F** | TO-BE / Business Rule / Acceptance Definition | 10% | 0% | **BLOCKED** — DEC-S02..S08 |
| **G** | Architecture Gate & Technical Design | 10% | **2%** | IN PROGRESS (G1 selesai) |
| **H** | Implementation / Correction / Completion | 13% | 0% | **IN PROGRESS** — H1 sebagian; SALES-1..5 tetap BLOCKED (BL-01) |
| **I** | Testing / UX Validation / E2E | 8% | 0% | NOT STARTED |
| **J** | Final Reconciliation & Release Certification | 7% | 0% | NOT STARTED |
| | **TOTAL** | **100%** | **64%** | |

---

# WORK PLAN TABLE

| ID | Phase | Work Item | Weight | Status | Progress | Started | Completed | Evidence | Blocker | Decision | Next |
|---|---|---|---:|---|---:|---|---|---|---|---|---|
| A1 | A | Repository & Governance Discovery | 2% | **DONE** | 2% | 2026-08-28 | 2026-08-28 | EV-01 | — | — | A2 |
| A2 | A | Canonical Architecture / Entity / State / Contract Review | 2% | **DONE** | 2% | 2026-08-28 | 2026-08-28 | EV-02 | — | — | A3 |
| A3 | A | Existing Sales/CRM Docs & Task Registry Discovery | 1% | **DONE** | 1% | 2026-08-28 | 2026-08-28 | EV-03 | — | DEC-S01 | A4 |
| A4 | A | Work Plan Artifact Creation | 1% | **DONE** | 1% | 2026-08-28 | 2026-08-28 | EV-04 | — | — | A5 |
| A5 | A | Execution Environment & Evidence Strategy Validation | 2% | **DONE** | 2% | 2026-08-28 | 2026-08-28 | EV-05 | — | — | B1 |
| B1 | B | Sales/CRM Repository Inventory | 2% | **IN PROGRESS** | — | 2026-08-28 | — | EV-06 | — | — | B2 |
| B2 | B | Route & Navigation Inventory | 1% | READY | — | — | — | — | — | — | B3 |
| B3 | B | Page & Component Inventory | 1% | READY | — | — | — | — | — | — | B4 |
| B4 | B | API / Service / Event Inventory | 1% | READY | — | — | — | — | — | — | B5 |
| B5 | B | Database / Schema / Migration Inventory | 2% | READY | — | — | — | — | — | — | B6 |
| B6 | B | Permission / Role / Authorization Inventory | 1% | READY | — | — | — | — | — | — | B7 |
| B7 | B | Existing Test / E2E Inventory | 1% | READY | — | — | — | — | — | — | B8 |
| B8 | B | Runtime / Browser Behavior Verification | 2% | READY | — | — | — | — | — | — | B9 |
| B9 | B | AS-IS Evidence Registry Completion | 1% | NOT STARTED | — | — | — | — | — | — | C1 |
| C1–C6 | C | Existing Commercial Core Audit | 15% | NOT STARTED | — | — | — | — | — | — | D |
| D1–D10 | D | Domain Reconciliation | 15% | NOT STARTED | — | — | — | — | — | — | E |
| E1–E6 | E | Entity/State/Boundary/UX Reconciliation | 12% | NOT STARTED | — | — | — | — | — | — | F |
| F1–F6 | F | TO-BE & Acceptance Definition | 10% | NOT STARTED | — | — | — | — | DEC-S02..08 | G |
| G1–G7 | G | Architecture Gate & Design | 10% | NOT STARTED | — | — | — | — | — | H |
| H1–H8 | H | Implementation | 13% | **BLOCKED** | 0% | — | — | — | **BL-01** | **DEC-S01** | I |
| I1–I8 | I | Testing / UX / E2E | 8% | NOT STARTED | — | — | — | — | — | J |
| J1–J7 | J | Final Reconciliation & Certification | 7% | NOT STARTED | — | — | — | — | — | — |

---

# PHASE A — GOVERNANCE & WORKSPACE INITIALIZATION

## Weight
8% — **SELESAI PENUH**

## Objective
Mengetahui aturan yang berlaku, arsitektur yang sudah diputuskan, pekerjaan yang sudah
tercatat, dan lingkungan bukti yang tersedia — sebelum menyentuh apa pun.

## Entry Criteria
Repositori bersih. HEAD `138f8ec`.

### A1 — Repository & Governance Discovery — 2% — **DONE**

**Output**: peta governance yang mengikat Sales/CRM.

**Temuan**:
- `CLAUDE.md` sudah memuat **SD-1..SD-13** beserta STATUS masing-masing. Empat berstatus
  **BERLAKU/TERBUKTI**, empat **BELUM RELEVAN**, tiga **KOSONG (bukan terbukti)**, satu
  **TIDUR**, dan **SD-11/SD-12 sudah jadi task** (`AUD-18`, `AUD-19`).
- Empat konflik governance terbuka (CONFLICT-1..4) + pencadangan `DS-23` — **nol** di antaranya
  khusus Sales.
- Aturan yang langsung mengikat pekerjaan ini: modal/form governance, D-A/D-B, kontrak validasi
  field, aturan responsif enam lebar, aturan aksi merusak, dan larangan sistem paralel.

**Acceptance**: seluruh dokumen governance yang menyebut Sales teridentifikasi. **Terpenuhi.**

### A2 — Canonical Architecture / Entity / State / Contract Review — 2% — **DONE**

**Output**: hierarki dokumen arsitektur + disposisi v0.1.

**Temuan menentukan**: `docs/review-fable-sales-architecture.md` **menang atas** v0.1 dan sudah
memberi disposisi untuk §1–§51. Isinya yang mengikat pekerjaan ini:

| Hal | Ketetapan |
|---|---|
| Greenfield | **DIBATALKAN** — v0.2 ditulis sebagai PERLUASAN codebase |
| ATP/CTP §17–18 | **PERLUAS** feasibility engine yang ada, jangan tulis ulang |
| Complaint §27 | **NCR tipe baru**, bukan sistem kedua |
| Delivery §22–25 | modul `shipments` sudah ada |
| Costing/Pricing §10–11 | mesin biaya & margin sudah ada — pricing waterfall = lapisan tipis |
| Forecast §29–30 | **DITOLAK**, diparkir (SLS-90) |
| Event bus §33 | **outbox ringan**, bukan bus eksternal |
| Arsitektur | modular monolith, schema `sales` — bukan service terpisah |
| Urutan | **SALES-1..5**, satu tahap satu rilis |

**Acceptance**: setiap konsep v0.1 punya disposisi. **Terpenuhi** — dilakukan oleh dokumen
tinjauan, diverifikasi ada di §D-nya.

### A3 — Existing Docs & Task Registry Discovery — 1% — **DONE**

**Output**: daftar task Sales/CRM yang sudah ada.

**31 task menyerempet Sales/CRM.** Yang menentukan:

| Kode | Nama | Status |
|---|---|---|
| **SLS-00** | Keputusan modul Sales — peta cakrawala, **bukan program yang dijalankan sekarang** | `ditunda_sadar` |
| SLS-01..05 | SALES-1..5 | `ditunda_sadar` |
| SLS-90 | Modul diparkir + pemicunya | `ditunda_sadar` |
| SLS-06 | PO klien butuh persetujuan **tiga** departemen oleh tiga peran berbeda | `menunggu` |
| SLS-07 | Nomor dokumen dihitung dari jumlah baris | `menunggu` |
| AUD-18 | **SD-11** konfigurasi pelanggan tidak boleh memutasi master produksi | `menunggu` |
| AUD-19 | **SD-12** harga di Sales Order belum dibekukan | `menunggu` |
| PJL-01/02 | Alur PO→approval→SO→WO · Halaman Sales Order | `selesai` |
| PJL-03 | Tombol Selesai/Batal Sales Order | `menunggu` |
| PMB-03 | Supplier & Pelanggan CRUD lengkap | `menunggu_persetujuan` |
| PMB-08 | Cabut form Tambah Client dari modal PO | `menunggu` |
| PMB-09 | Halaman Pelanggan: riwayat order & performa | `menunggu` |

**Acceptance**: nol kode task baru dibuat; seluruh pekerjaan menunjuk kode yang sudah ada.
**Terpenuhi.**

### A4 — Work Plan Artifact Creation — 1% — **DONE**

**Output**: berkas ini.

### A5 — Execution Environment & Evidence Strategy Validation — 2% — **DONE**

| Kemampuan | Status | Bukti |
|---|---|---|
| Server pengembangan | jalan | HTTP 200 `/login` |
| Tenant uji | ada (`company.b@debug.mrp`) | dipakai di seluruh sapuan sebelumnya |
| Peramban terotomasi | ada | Playwright, 174 pengukuran terakhir |
| **Penghadang mutasi** | **terbukti** | seluruh non-GET diblokir; audit terakhir mengirim **nol** non-GET |
| Basis data baca-saja | terbukti | Management API `select` |
| Uji | 79 berkas / 535 kasus | filesystem |
| Penghadang project nyata | ada | `guardAgainstRealProject.ts` |

**Acceptance**: seluruh jenis bukti (CODE, DATABASE, RUNTIME, ROUTE, API, TEST, UX) bisa
dihasilkan tanpa mutasi. **Terpenuhi.**

## Exit Criteria
Governance diketahui · arsitektur berdisposisi · task terdaftar · rencana bisa dibuka ·
lingkungan bukti terbukti. **Seluruhnya terpenuhi.**

## Current Progress
**8% dari 8%.**

---

# PHASE B — AS-IS REPOSITORY & RUNTIME RECONSTRUCTION

## Weight
12%

## Objective
Membangun gambaran terukur tentang apa yang BENAR-BENAR ada, bukan apa yang dokumen katakan
ada.

## Entry Criteria
Phase A selesai. **Terpenuhi.**

### B1 — Sales/CRM Repository Inventory — 2% — **IN PROGRESS**

**Sudah terukur** (bukti EV-06):

| Lapisan | Jumlah |
|---|---|
| Route API berdomain Sales/CRM | **28** |
| Halaman | **6** (4 shell + 2 non-shell) |
| Modul server | **23** |
| Tabel basis data | **13** |

**Halaman**: `/customers` · `/customer-purchase-orders` · `/sales-orders` · `/shipments` ·
`/shipments/[id]/surat-jalan` (cetak) · `/pod/[token]` (publik).

**Tabel**: `customers` · `customer_delivery_addresses` · `customer_purchase_orders` ·
`customer_purchase_order_lines` · `customer_po_approvals` · `sales_orders` ·
`sales_order_lines` · `sales_order_line_margin_snapshots` ·
`sales_order_line_feasibility_snapshots` · `shipments` · `shipment_lines` ·
`delivery_confirmations` · `production_standard_samples`.

**Belum selesai**: pemetaan komponen per halaman, dan klasifikasi KEEP/ADAPT/MIGRATE/… per
modul. **Karena itu B1 belum DONE.**

### B2–B9
READY (B2–B8) / NOT STARTED (B9). Belum dikerjakan — bobotnya **belum** dihitung.

## Exit Criteria
Setiap lapisan Sales/CRM punya inventaris terukur, dan setiap butirnya punya disposisi
KEEP/ADAPT/MIGRATE/DEPRECATE/REPLACE/MISSING/CONFLICT/UNKNOWN.

## Current Progress
**0% dari 12%** — B1 berjalan, belum memenuhi acceptance.

---

# PHASE C..J — DETAIL

Belum dimulai. Bobot dan work item mengikuti roadmap master di atas tanpa perubahan.
Detail per subphase akan ditulis saat phase-nya dimasuki, mengikuti format §41.

**Catatan khusus PHASE C**: audit mendalam Customer PO dan Sales Order **wajib memperhitungkan
bahwa alurnya BELUM PERNAH BERJALAN TUNTAS** (0 SO, 0 pengiriman di data nyata). Audit tidak
bisa mengandalkan data historis; ia harus mengandalkan pembacaan kode, skema, dan uji.

---

# CURRENT POSITION

## Overall
**64%**

## Current Phase
PHASE F — TO-BE / Business Rule / Acceptance Definition (**BLOCKED**)

## Current Work Item
F1 — TO-BE Capability Model

## What Has Been Completed
**Fase A, B, C, D, E tuntas + G1.** Keluarannya **21 dokumen** di `docs/sales-crm/`:
inventaris AS-IS, baseline arsitektur, matriks KEEP/ADAPT/MIGRATE/REPLACE, register gap,
register risiko, tujuh rekonsiliasi (entitas, state machine, basis data, API, UX/IA, izin,
lintas domain), audit uji, rekonsiliasi task, rekonsiliasi TO-BE, dan rencana koreksi.

**Temuan terbesar**: batas domain **tidak dilanggar**, state machine ditegakkan di **basis
data**, dan **nol** implementasi perlu diganti. Yang salah: Sales Order punya empat status
dan **hanya satu yang bisa dicapai**.

## What Is Being Worked On
**WS-01 + WS-03 + WS-04 SELESAI** (29 Agu 2026): galat PO klien kini menempel di isian yang
salah, di modal bertahap empat langkah. Tiga berkas berubah, 11 penjaga baru, enam mutasi
dibuktikan menggigit, bukti peramban di enam lebar. Suite 528 → **539 lulus, nol gagal**.

**Satu cacat saya perkenalkan sendiri lalu perbaiki**: menandai isian di langkah yang sedang
tersembunyi membuat galatnya hilang sama sekali. Ditemukan lewat menjalankan, dikunci uji (k).

**Satu UX FINDING dicatat, tidak diperbaiki**: tombol "Batal" di kaki modal bertahap terpotong
tepi kiri pada 360px (terukur −63px). Komponen bersama, 4 halaman konsumen — §32 mewajibkan
audit konsumen lebih dulu.

**WS-05 SELESAI** (29 Agu 2026): alamat tujuan kirim akhirnya punya layar. Golongan
**COMPLETION** — entitas, tabel, RLS, arsip/pulih, dan tiga route sudah ada sejak PMB-07b
dengan **nol** halaman memakainya. Baris pelanggan kini bisa dimekarkan; panel alamat punya
keadaan memuat, kosong **ber-aksi**, dan galat; arsip lewat **modal danger**, bukan
`window.confirm`. 10 penjaga baru, suite **549 lulus**.

**REGRESI YANG SAYA PERKENALKAN, DITEMUKAN SEBELUM COMMIT**: `/customers` mulai menggulir
menyamping di keenam lebar. **Tiga dugaan pertama saya salah** (fixture, `TableExpandHeader`,
SCSS); penyebabnya kedua modal baru yang saya letakkan **di luar** blok `canManage` sementara
modal yang sudah ada berada di dalamnya. Dipindahkan → bersih lagi. Mekanisme CSS persisnya
**belum ditelusuri** — itu disebutkan apa adanya di changelog.

## What Is Next
Jawaban atas sepuluh keputusan. Bila DEC-S01 membuka gerbang, urutan koreksi ada di
`SALES_CRM_CORRECTION_PLAN.md` (K-01 lebih dulu).

## Blockers
**BL-01** — program SALES-1..5 `ditunda_sadar`, pemicunya terukur belum terpenuhi. Memblokir
PHASE H dan seterusnya. **Tidak** memblokir A–G.

## Decisions Required
**DEC-S01** (memblokir H) + tujuh pertanyaan wawancara Bagian H yang belum dijawab.

## Risks
- **R-01** — audit komersial tanpa data historis: 0 SO dan 0 pengiriman berarti perilaku nyata
  hanya bisa disimpulkan dari kode dan uji, bukan dari pemakaian.
- **R-02** — dua dokumen arsitektur (v0.1 dan tinjauan) bisa dibaca terbalik oleh sesi
  berikutnya. Hierarki ditulis di berkas ini untuk mencegahnya.
- **R-03** — `PMB-03` berstatus `menunggu_persetujuan`: sebagian pekerjaan pelanggan mungkin
  sudah selesai tetapi belum diakui.

## Latest Evidence
EV-01..EV-06 (lihat EVIDENCE LOG).

## Last Completed Work Item
A5 — Execution Environment & Evidence Strategy Validation.

## Next Ready Work Item
B2 — Route & Navigation Inventory.

---

# WORK PLAN CHANGE LOG

| Date | Change | Reason | Impact on Progress | Decision |
|---|---|---|---|---|
| 2026-08-28 | Rencana dibuat, bobot A–J dikunci sesuai perintah | Baseline resmi workstream | Denominator 100% ditetapkan | — |
| 2026-08-28 | PHASE H ditandai BLOCKED sejak awal | BL-01 terukur di data nyata | Nol — bobot tidak diubah | DEC-S01 |
| 2026-08-29 | Fase B, C, D, E ditandai DONE + G1 | 21 dokumen audit selesai dengan bukti terukur | 8% → **64%** | — |
| 2026-08-29 | Fase F ditandai BLOCKED | Aturan bisnis butuh jawaban DEC-S02..S08 | Nol | DEC-S02..S08 |
| 2026-08-29 | DEC-S09 ditambahkan | Alamat kirim lengkap di server tanpa layar (SC-05) | Nol | DEC-S09 |
| 2026-08-29 | **DEC-S01 menutup BL-01** | Baseline bisnis baru: banyak order paralel eksplisit diizinkan; gerbang "satu order tuntas" **dicabut** | H tidak lagi terhalang seluruhnya | DEC-S01 |
| 2026-08-29 | **Rekonsiliasi SC-01..SC-05 selesai** | 2 temuan tetap, **3 berubah material**, **2 temuan baru** (SC-01b, SC-05b) | **Nol** — bobot tidak diubah, 64% tetap | AD-01, AD-02, BD-01..08 |
| 2026-08-29 | **BL-04 dipersempit** | Sumber kebenaran alamat terverifikasi lewat sensus kode; yang tersisa hanya nasib kolom lama | Nol — tetapi **membuka WO-S05** yang tadinya ikut terblokir | BL-04 |
| 2026-08-29 | **BL-05 dibuka** | Dua implementasi lengkap pembuatan SO ditemukan saat verifikasi SC-04 | Nol pada bobot; menaikkan SC-04 jadi P0 dengan bentuk perbaikan berbeda | AD-02 |
| 2026-08-29 | WS-01, WS-03, WS-04, WS-05 selesai | Dua koreksi + satu pelengkapan, seluruhnya teruji | Nol — H1/H2 belum tuntas | — |

---

# DECISION LOG

| ID | Decision | Reason | Authority | Date | Affected Phase | Impact |
|---|---|---|---|---|---|---|
| **DEC-S01** | Apakah pemicu SLS-01 tetap berlaku, atau program Sales dibuka lebih awal? | SLS-01 mensyaratkan satu order tuntas; terukur 0 SO / 0 pengiriman | **PRODUCT DECISION REQUIRED** | terbuka | **H, I, J** | memblokir 28% |
| DEC-S02 | Bagaimana penawaran harga dibuat HARI INI, dan apa isinya? | Agar quotation memformalkan kebiasaan nyata | PRODUCT | terbuka | F, SALES-2 | — |
| DEC-S03 | Alur sampel hari ini: siapa minta, buat, bayar, berapa lama, macet di mana? | Dasar SALES-3 | PRODUCT | terbuka | F, SALES-3 | — |
| DEC-S04 | Klien mana yang memakai kode produk sendiri di PO? (2–3 contoh) | Akar keluhan repeat-PO | PRODUCT | terbuka | F, SALES-1 | — |
| DEC-S05 | Payment terms per klien + pernah ada masalah piutang? | Credit profile lite | PRODUCT | terbuka | F | — |
| DEC-S06 | Pernah ada permintaan kontrak harga/volume komitmen? | Pemicu membuka blanket contract | PRODUCT | terbuka | D6 | — |
| DEC-S07 | Seberapa sering retur/komplain setahun, bentuknya apa? | Dasar SALES-5 | PRODUCT | terbuka | D8 | — |
| DEC-S08 | Seberapa sering qty/tanggal berubah setelah konfirmasi? | Memvalidasi prioritas SALES-4 | PRODUCT | terbuka | D7 | — |
| **DEC-S11** | Pemisahan kepemilikan status Sales Order antar domain | Sales memiliki CANCELLED; Manufacturing memiliki IN PRODUCTION; Logistics berkontribusi pada COMPLETED | **PRODUCT** | **DITUTUP 29 Agu** | H | membuka WS-A (visibilitas turunan) |
| **AD-01** | Status eksekusi SO **disimpan** (aturan DB) atau **diturunkan** (DEC-S11)? | `status_transition_rules` mengizinkan `in_production`/`completed` sebagai status tersimpan; DEC-S11 memberikannya ke domain lain | **ARCHITECTURE DECISION REQUIRED** | terbuka | WO-S01 | memblokir siklus hidup SO |
| **AD-02** | Jalur kanonik pembuatan SO: **fungsi DB** atau **TypeScript**? | Dua implementasi lengkap hidup berdampingan; yang dipakai tidak atomik dan tidak menyalin snapshot identitas | **ARCHITECTURE DECISION REQUIRED** | terbuka | WO-S02 | memblokir perbaikan P0 |
| **BD-01** | Order dianggap SELESAI kapan — terkirim, ditandatangani terima, atau lunas? | Menentukan arti `completed` | PRODUCT | terbuka | WO-S01 | — |
| **BD-02** | Siapa boleh membatalkan Sales Order? | Wewenang tidak boleh ditebak | PRODUCT | terbuka | WO-S01 | — |
| **BD-03** | Boleh batal setelah Work Order dibuat / produksi mulai? Perlu persetujuan siapa? | Bahan sudah terpakai — pembatalan berbiaya nyata | PRODUCT | terbuka | WO-S01 | — |
| **BD-04** | Bila satu departemen MENOLAK PO Klien: PO bisa diperbaiki, atau mati? | `rejected` ada di CHECK, akibatnya belum ditentukan | PRODUCT | terbuka | WO-S01, WO-S04 | — |
| **BD-05** | Apa arti "Ditunda" bagi PO Klien dalam pekerjaan sehari-hari? | Tanpa ini tombolnya cuma mengubah warna | PRODUCT | terbuka | WO-S04 | — |
| **BD-06** | Siapa boleh menahan, melepas, membatalkan PO Klien? | Wewenang | PRODUCT | terbuka | WO-S04 | — |
| **BD-07** | Alasan wajib diisi saat menahan/membatalkan? | Kolom `reason` sudah ada dan selalu kosong | PRODUCT | terbuka | WO-S04 | — |
| **BD-08** | Alamat tujuan ditetapkan saat order diterima, atau cukup saat dikirim? | Menentukan perlu-tidaknya kolom alamat di SO | PRODUCT | terbuka | WO-S05b | — |
| **AD-03** | Nama status Sales Order: registry kanonik (11 state) atau implementasi (4 state)? | Registry sendiri melarang penyalinan buta; menyalinnya menambah 7 state tanpa pemicu, dan 3 di antaranya melanggar AD-01 | **ARCHITECTURE DECISION REQUIRED** | terbuka | WS-S01 | memblokir penamaan status |
| **BD-09** | Apa aturan pemenuhan yang dipakai — berapa toleransi kurang/lebih kirim yang dianggap "terpenuhi"? | BD-01 mensyaratkan "kuantitas terpenuhi sesuai aturan pemenuhan"; aturannya belum ada | PRODUCT | terbuka | WS-S01 | — |
| **BD-10** | Dari mana Finance menyatakan kewajiban pembayaran terpenuhi? | `payment_terms` hanya `full`/`tempo`; **nol** tabel jatuh tempo maupun penerimaan pembayaran — Finance belum punya tempat menyatakannya | PRODUCT | terbuka | WS-S01 | — |
| **DEC-S12** | Apakah `admin_staff` memang peran Sales, atau peran `sales` sungguhan belum ada? | 16 peran, tak satu pun `sales`; BD-06 menyebut Sales boleh menahan PO — hari ini tidak bisa ditegakkan | **PRODUCT** | terbuka | permintaan pembatalan, WS-S05 | memblokir "Sales mengajukan" |
| **DEC-S13** | Perlukah aksi **Override** saat pemegang peran departemen penahan tidak tersedia? | BD-06 mengunci pelepasan ke departemen penahan; bila orangnya tidak ada, PO tertahan tanpa jalan keluar | **PRODUCT + ARCHITECTURE** | terbuka | WS-S05 | — |
| **DEC-S12** | Apakah `admin_staff` peran Sales, atau peran Sales belum ada? | 16 peran, tak satu pun `sales` | **PRODUCT** | **DITUTUP 29 Agu** — `admin_staff` **BUKAN** Sales; peran Sales tersendiri **WAJIB** ada | SEC-24 | dibangun |
| **DEC-S02** | Quotation jadi objek terstruktur di dalam FABRIX | Hari ini dibuat di Excel; tidak bisa dilacak, direvisi, atau diketahui kedaluwarsanya | **PRODUCT** | **DITUTUP 29 Agu** | SLS-08 | implementasi OPEN |
| **DEC-S03** | Sample: alur, kepemilikan, pembayaran, pengiriman | Sales meminta, R&D membuat, Finance memverifikasi bila berbayar, Logistik mengirim | **PRODUCT** | **DITUTUP 29 Agu** | SLS-08 | implementasi OPEN |
| **DEC-S04** | Kode produk pelanggan hidup berdampingan dengan kode FABRIX | Kode pelanggan **tidak boleh** melahirkan Product baru — ia rujukan, bukan identitas | **PRODUCT** | **DITUTUP 29 Agu** | SLS-08 | implementasi OPEN |
| **DEC-S05** | Payment terms **dinegosiasikan** per transaksi, dan di-snapshot | Customer Master hari ini tidak bisa merekonstruksi terms historis | **PRODUCT** | **DITUTUP 29 Agu** | SLS-08 | bertemu **BD-10** yang masih terbuka |
| **DEC-S07** | Komplain tercatat & tertelusur sampai batch | Batch **tidak** diduplikasi di Sales — tetap milik Traceability | **PRODUCT** | **DITUTUP 29 Agu** | SLS-08 | implementasi OPEN |
| **DEC-S08** | Perubahan qty/tanggal setelah konfirmasi lewat **amandemen**, bukan edit senyap | Nilai asli + usulan + keputusan + pelaku + alasan + waktu disimpan | **PRODUCT** | **DITUTUP 29 Agu** | SLS-08 | implementasi OPEN |
| **DEC-S06** | Kontrak / komitmen volume | Belum ada bukti kebutuhan nyata | **PRODUCT** | **OPEN DISCOVERY** | — | jangan dibangun dulu |
| **DEC-S10** | Master Document vs catatan keputusan vs catatan transaksi | Keputusan bisnis wajib tetap bisa direkonstruksi dari catatan transaksional | **ARCHITECTURE REVIEW** | terbuka | — | — |

---

# BLOCKER LOG

| ID | Blocker | Phase | Impact | Owner | Since | Status | Resolution |
|---|---|---|---|---|---|---|---|
| ~~BL-01~~ | SALES-1..5 `ditunda_sadar` | H, I, J | — | Product Owner | 2026-08-28 | **DITUTUP 29 Agu** | **DEC-S01** mencabutnya: banyak order paralel eksplisit diizinkan |
| **BL-02** | WS-02 Sales Order: tiga dari empat status tidak bisa dicapai, tetapi KAPAN status berubah adalah aturan bisnis — dan sebagian mencerminkan proses domain lain | WS-02 | 1 koreksi P1 | Product Owner + Architecture Guardian | 2026-08-29 | **OPEN** | DEC-S11 |
| **BL-03** | Tombol "Batal" modal bertahap terpotong di 360px; komponen BERSAMA, 4 halaman konsumen | WS-03 | 4 halaman | Claude Code | 2026-08-29 | **OPEN** | audit konsumen dulu (§32) |
| **BL-04** | *(DIPERSEMPIT 29 Agu)* Sumber kebenaran alamat pengiriman **SUDAH TERVERIFIKASI**: `shipments.delivery_address` (teks beku) yang menang; `delivery_address_id` jejak referensi; `customers.shipping_address` **tidak pernah dibaca** saat mengirim. Sisa keputusan: **nasib kolom lama** (menyentuh skema) | WO-S05b | 1 kolom, **0 baris terisi** | Architecture Guardian | 2026-08-29 | **OPEN (dipersempit)** | **ARCHITECTURE DECISION REQUIRED** — bagian UI-nya (WO-S05) TIDAK ikut terblokir |
| **BL-05** | *(BARU 29 Agu)* Pembuatan Sales Order punya **DUA implementasi lengkap**: fungsi DB `process_customer_purchase_order()` (atomik, menyalin snapshot identitas, **nol pemanggil aplikasi**) dan `processCustomerPurchaseOrder.ts` (dipakai route, kompensasi manual, **tidak menyalin snapshot**) | WO-S02 | **P0**, 0 baris terdampak (0 SO) | Architecture Guardian | 2026-08-29 | **OPEN** | **AD-02** |

---

# RISK LOG

| ID | Risk | Phase | Likelihood | Impact | Mitigation |
|---|---|---|---|---|---|
| R-01 | Audit komersial tanpa data historis | C | TINGGI | SEDANG | audit dari kode + skema + uji, dan sebutkan batasnya |
| R-02 | Dua dokumen arsitektur dibaca terbalik | E, F, G | SEDANG | TINGGI | hierarki ditulis di berkas ini |
| R-03 | `PMB-03` menunggu persetujuan — status pekerjaan pelanggan tidak pasti | C1 | SEDANG | RENDAH | verifikasi di C1 |
| R-04 | SD-3/SD-4/SD-5 berstatus **KOSONG, bukan terbukti** | E5 | SEDANG | TINGGI | test penjaga lahir bersama fiturnya |

---

# EVIDENCE LOG

| Evidence ID | Type | Location | Related Work Item | Status |
|---|---|---|---|---|
| EV-01 | DOCUMENTATION | `CLAUDE.md` (SD-1..SD-13), `docs/FABRIX-Carbon-UX-Governance/` | A1 | VALID |
| EV-02 | ARCHITECTURE | `docs/review-fable-sales-architecture.md`, `docs/FABRIX_Sales_Technical_Architecture_Fable5_v0_1.md` | A2 | VALID |
| EV-03 | TASK | `build_tasks` (31 task Sales/CRM, baca-saja) | A3 | VALID |
| EV-04 | DOCUMENTATION | berkas ini | A4 | VALID |
| EV-05 | RUNTIME | server dev, tenant uji, penghadang non-GET terbukti | A5 | VALID |
| EV-06 | CODE + ROUTE + DATABASE | 28 route API · 6 halaman · 23 modul server · 13 tabel | B1 | PARTIAL |
| EV-07 | DATABASE | isi data nyata: 1 customer, 1 PO, 3 approval, 0 SO/WO/batch/shipment | BL-01 | VALID |

---

# UX COMPLIANCE CHECKLIST

Belum berlaku — belum ada implementasi UI di workstream ini. Akan diisi saat PHASE H dibuka.
Standar yang akan dipakai: shell FABRIX · Carbon · D-A/D-B · kontrak validasi field ·
`AreaNotifikasi` · aksi merusak lewat modal danger · enam lebar responsif · aksesibilitas.

# TESTING PROGRESS
Belum dimulai (PHASE I). Uji Sales/CRM yang SUDAH ada dihitung di B7.

# E2E PROGRESS
Belum dimulai (PHASE I).

# MIGRATION PROGRESS
Belum dimulai (PHASE H). **Nol migrasi dibuat sejauh ini.**

# FINAL ACCEPTANCE CHECKLIST

Seluruh butir §42 perintah masih **kosong**. Tidak satu pun boleh dicentang sebelum
phase-nya dijalankan dan buktinya ada.

---

## Gelombang kesembilan — rekonsiliasi FIN-02 & aturan bisnis terkunci (29 Agu 2026, malam)

**Nol kode, nol migrasi, nol tabel Finance.** Isinya rekonsiliasi, dokumentasi, penyerahan.

| Workstream | Status |
|---|---|
| **WS-PAYMENT-TERMS** | **DONE / VERIFIED** |
| **WS-PAYMENT-OBLIGATION** | **DONE / VERIFIED** |
| **WS-CUSTOMER-PAYMENT** | **BLOCKED BY FIN-02** |
| **WS-CUSTOMER-RECEIVABLE** | **BLOCKED BY FIN-02** |
| **WS-SO-COMPLETION** | **UNBLOCKED — SIAP DIJADWALKAN** (aturan terkunci; **tidak** dikerjakan batch ini) |
| **WS-PAYMENT-GATE** | **ARCHITECTURE PENDING** — gerbang produksi & pengiriman, menunggu FIN-02 |

### Yang berubah paling material: satu rantai penghambat ternyata keliru

Sembilan tempat di repositori mencatat **FIN-02 → BD-10 → penyelesaian Sales Order terblokir**.
Keputusan pemilik produk 29 Agu 2026 **memutus rantai itu**: penyelesaian Sales Order berbasis
**PEMENUHAN** (diproduksi + dikirim + konfirmasi PPIC + konfirmasi Manager/GM), **bukan**
pembayaran. Order boleh **COMPLETED** meski pelanggan masih menunggak.

Kesembilan tempat sudah dikoreksi **dengan menyebut bunyi lamanya**, bukan dihapus.

| Keputusan | Sebelum | Sesudah |
|---|---|---|
| **BD-01** kapan order selesai | OPEN | **CLOSED** — berbasis pemenuhan |
| **BD-09** toleransi kurang-kirim | OPEN | **CLOSED** — **nol toleransi otomatis** |
| **BD-10** kapan pembayaran terpenuhi | OPEN, menahan penyelesaian SO | **OPEN**, menahan **status pembayaran & gerbang** saja |

### Kontrak lintas domain yang diberi nama (belum ada, belum dibangun)

**K-07** Finance → pelunasan milestone → **Produksi** · **K-08** Finance → pelunasan milestone →
**Pengiriman** · **K-09** Pemenuhan → **penutupan Sales Order**.

### Dokumen

`docs/finance/FIN-02_ARCHITECTURE_RECONCILIATION.md` (22 bagian) ·
`docs/finance/FIN-02_CUSTOMER_RECEIVABLE_DOMAIN_GAP.md` (**35 pertanyaan bergolongan A–E**) ·
`docs/sales-crm/SALES_CRM_FIN02_ARCHITECTURE_HANDOFF.md`.

### Progres

**TETAP 64%.** Rekonsiliasi dan dokumentasi **tidak menaikkan progres** — yang menaikkannya hanya
kapabilitas workstream yang benar-benar selesai dan terverifikasi. **WS-SO-COMPLETION baru
"boleh dimulai", belum "selesai".**


---

## Gelombang kesepuluh — PJL-03 penutupan Sales Order (29 Agu 2026, malam)

| Workstream | Status |
|---|---|
| **WS-SO-COMPLETION** | **DONE / VERIFIED** — 23 pemeriksaan, empat mutasi menggigit, bukti peramban enam lebar; regresi penuh **91 berkas · 690 lulus · 0 gagal** |
| **WS-PAYMENT-TERMS** · **WS-PAYMENT-OBLIGATION** | **DONE / VERIFIED** (gelombang kesembilan) |
| **WS-CUSTOMER-PAYMENT** · **WS-CUSTOMER-RECEIVABLE** | **BLOCKED BY FIN-02** |
| **WS-PAYMENT-GATE** | **ARCHITECTURE PENDING** — menunggu FIN-02 |

**Apa yang sekarang bisa dilakukan sistem:** PPIC mengonfirmasi bahwa seluruh barang sudah
diproduksi dan dikirim; Manager/GM menutup ordernya. **Tunggakan pembayaran tidak menghalangi.**
Kurang kirim **menghalangi** — nol toleransi. Layar menyebut **sebab** bila belum bisa ditutup,
bukan sekadar "tidak bisa".

**Yang ditemukan saat mengerjakannya, dan menentukan bentuk pekerjaannya:** transisi
`confirmed → completed` **tidak ada** di aturan transisi, dan `in_production` **tidak pernah
ditulis kode mana pun** — sehingga penutupan mustahil bahkan bila tombolnya dibuat. Satu jalur
ditambahkan; **nol status baru**, jadi AD-03 tetap terbuka.

**Temuan yang dicatat dan TIDAK dikerjakan:** **PJL-16** — Sales Order tanpa Work Order sama
sekali tidak bisa ditutup (gagal tertutup, disengaja). Arah sebaliknya mengubah arti kata
"selesai", jadi keputusannya milik pemilik produk.

### Progres

**TETAP 64%.** PJL-03 memang selesai dan terverifikasi, tetapi **Fase H memuat banyak butir**
dan bobot kenaikannya adalah **kriteria terima milik arsitek** — bukan angka yang boleh saya
karang sendiri. Yang bisa saya nyatakan dengan bukti: **satu workstream berpindah dari
"terhalang" ke "selesai & terverifikasi"**.


---

## Gelombang kesebelas — FIN-02 · BD-10 · AD-03 · DEC-S13 (30 Agu 2026)

| Workstream | Status |
|---|---|
| **WS-FIN02-CONTRACT** | **DOCUMENTED** — kontrak antar domain didefinisikan; sisi Finance tetap belum ada |
| **WS-BD10-RECONCILE** | **VERIFIED** — nol kode menggerbangi penyelesaian SO dengan pembayaran |
| **WS-AD03-AUDIT** | **PROPOSAL** — audit 11 status + tiga opsi kanonik; implementasi **tidak diubah** |
| **WS-DEC-S13** | **DONE / VERIFIED** — 15 pemeriksaan, 3 mutasi menggigit, peramban 6 lebar bersih; regresi penuh **92 berkas · 705 lulus · 0 gagal** |

## STATUS PENYERAHAN — untuk agen berikutnya (30 Agu 2026)

**Apa yang berubah**: pelepasan darurat penghalang PO klien ada dan terbukti; kontrak
Sales↔Finance punya bentuk tertulis; kosakata status Sales Order sudah diaudit penuh.

**Apa yang tersisa**: FIN-02 (butuh keputusan kepemilikan domain Finance) · AD-03 (butuh
keputusan A/B/C) · PJL-13 layar termin · PJL-15 gerbang pembayaran · PJL-16 order tanpa Work
Order · PJL-17 "Status bayar" yang tidak punya sumber · QA-04 jalur emas.

**Keputusan TERKUNCI**: AD-01 · AD-02 · BD-01 · BD-02 · BD-03 · BD-06 · BD-07 · BD-09 · BD-11 ·
BD-12 · DEC-S02..S12 · **DEC-S13**.

**Keputusan TERBUKA**: FIN-02 · BD-10 · AD-03 · lingkup wewenang darurat (lebih sempit dari
kepemimpinan?) · PJL-16 · PJL-17 · format Quotation.

**Kontrak yang kini ADA**: K-01..K-05 · K-09 (pemenuhan → penutupan). **Didefinisikan tapi
sisi seberangnya belum ada**: K-06. **Belum ada**: K-07 · K-08.

**Status yang masih ditinjau**: `in_production` — tersimpan di skema, **tidak pernah ditulis**.

**Wewenang yang ada**: 17 peran · `canApproveDepartment` (finance/ppic/manager) ·
`decisionDepartment` (+sales) · `EMERGENCY_HOLD_RELEASE_ROLES` (**baru**).

**Ketergantungan lintas domain yang tersisa**: Sales menunggu **Finance** (pembayaran, piutang,
gerbang) dan **Manufacturing/Logistik** (fakta pemenuhan — sudah berjalan lewat turunan).

### Progres

**TETAP 64%.**


---

## Gelombang kedua belas — penutupan keputusan (30 Agu 2026)

| Workstream | Status |
|---|---|
| **WS-PJL16-STOCK-FULFILLMENT** | **DONE / VERIFIED** — 25 pemeriksaan, 2 mutasi menggigit, bukti peramban skenario stok |
| **WS-AD03-STATE-CUTOVER** | **DONE / VERIFIED** — `in_production` dicabut, nol baris terdampak |
| **WS-DECS13-AUTHORITY** | **DONE / VERIFIED** — GM saja, 16 pemeriksaan, mutasi menggigit |
| **WS-PJL17-PAYMENT-DISPLAY** | **PARKED** — keputusan: jangan mengarang data |
| **WS-HANDOFF-ENGINEERING** | **DONE** — `SALES_TO_ENGINEERING_PRODUCT_HANDOFF.md` (23 bagian) |

**Progres TETAP 64%.** Empat keputusan ditutup dan tiga di antaranya berimplementasi, tetapi
bobot fase mengikuti kriteria terima di rencana ini — bukan jumlah keputusan, dokumen, atau test.


### Bukti akhir gelombang kedua belas

Regresi penuh: **92 berkas · 708 lulus · 7 dilewati · 0 gagal** (1.691 detik), dicocokkan ke
kode sumber **715 = 715**. Test khusus Sales: **155 pemeriksaan di 11 berkas**.
Uji mutasi kumulatif batch ini: **3 penjaga dirusak, ketiganya menggigit** (5 · 3 · 2 kegagalan).
Lint **28 = patokan**. Keamanan data: nol sisa fixture di kedua project.
