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

**WS-01 Customer PO** ✅ · **WS-03 Sales UX** ✅ · **WS-04 Test** ✅ · **WS-05 Alamat kirim** ✅
· **WS-02 Sales Order** menunggu keputusan (DEC-S11)

## Current Step

Berikutnya yang READY: menerapkan kontrak validasi ke formulir **Pelanggan** dan
**Sales Order** — pola sudah terbukti di **empat** modul.

## Status

IN PROGRESS — sebagian workstream berjalan, sebagian terhalang

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

---

# BLOCKER LOG

| ID | Blocker | Phase | Impact | Owner | Since | Status | Resolution |
|---|---|---|---|---|---|---|---|
| ~~BL-01~~ | SALES-1..5 `ditunda_sadar` | H, I, J | — | Product Owner | 2026-08-28 | **DITUTUP 29 Agu** | **DEC-S01** mencabutnya: banyak order paralel eksplisit diizinkan |
| **BL-02** | WS-02 Sales Order: tiga dari empat status tidak bisa dicapai, tetapi KAPAN status berubah adalah aturan bisnis — dan sebagian mencerminkan proses domain lain | WS-02 | 1 koreksi P1 | Product Owner + Architecture Guardian | 2026-08-29 | **OPEN** | DEC-S11 |
| **BL-03** | Tombol "Batal" modal bertahap terpotong di 360px; komponen BERSAMA, 4 halaman konsumen | WS-03 | 4 halaman | Claude Code | 2026-08-29 | **OPEN** | audit konsumen dulu (§32) |
| **BL-04** | `customers.shipping_address` (kolom tunggal) hidup berdampingan dengan tabel daftar `customer_delivery_addresses`. Mana sumber kebenaran saat pengiriman dibuat **belum diverifikasi**; mencabut kolom = migrasi menyentuh data | WS-05 | 1 entitas | Architecture Guardian | 2026-08-29 | **OPEN** | **ARCHITECTURE DECISION REQUIRED** |

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
