# SALES & CRM — FIN-02 ARCHITECTURE HANDOFF

**Tanggal:** 29 Agustus 2026 · **Penyusun:** Claude Code · **Sifat:** RECONCILE → DOCUMENT → HANDOFF → **STOP**
**Untuk:** Architecture Guardian
**Dokumen pendamping:** `docs/finance/FIN-02_CUSTOMER_RECEIVABLE_DOMAIN_GAP.md` (paket penyelidikan lengkap + 24 pertanyaan)

> **Ringkas untuk Architecture Guardian:**
> **YANG DITEMUKAN** — domain Finance untuk piutang pelanggan **tidak ada**.
> **YANG DIBANGUN** — Payment Terms + Payment Obligation.
> **YANG TIDAK DIBANGUN** — Actual Payment + Customer Receivable.
> **KENAPA** — belum ada pemilik/mekanisme Finance yang kanonik.
> **YANG TERHALANG** — BD-10.
> **YANG HARUS DIPUTUSKAN** — FIN-02.
> **YANG SALES BUTUHKAN DARI FINANCE** — kontrak visibilitas/pelunasan turunan.
> **YANG SALES TIDAK BOLEH MILIKI** — pembayaran nyata, piutang, rekonsiliasi, buku besar keuangan.

---

## DEC-S05

**CLOSED.**

Keputusan pemilik produk ditutup pada lapisan komersialnya, dan implementasinya **terverifikasi**
untuk dua lapisan pertama. Dua lapisan terakhir **sengaja tidak dibangun** — bukan karena kurang
waktu, melainkan karena pemiliknya belum ada.

| Lapisan DEC-S05 | Keadaan | Pemilik |
|---|---|---|
| Payment Terms | **DIBANGUN & TERVERIFIKASI** | Sales / Commercial |
| Payment Obligation / Schedule | **DIBANGUN & TERVERIFIKASI** | Commercial Transaction |
| Actual Customer Payment | **TIDAK DIBANGUN** | Finance — *belum ada* |
| Customer Receivable | **TIDAK DIBANGUN** | Finance — *belum ada* |

## Implemented

| Hal | Bukti |
|---|---|
| `payment_terms` · `payment_term_steps` — aturan pembayaran yang bisa dipakai ulang | migrasi `20260911100000` |
| Tahap memakai **persentase ATAU nominal tetap**, tidak boleh keduanya | kekangan `CHECK` di basis data |
| Termin **nonaktif** tidak bisa dipakai transaksi baru; transaksi lama tetap sah | `terapkan_payment_terms` |
| `sales_order_payment_obligations` — komitmen **beku** per Sales Order | migrasi `20260911100000` |
| Jumlah kewajiban **wajib sama persis** dengan nilai Sales Order, atau penjadwalan dibatalkan | penjaga rekonsiliasi di `terapkan_payment_terms` |
| Panel **Jadwal pembayaran** di halaman Sales Order + keterangan batasnya | `SalesOrdersPage.tsx` |
| 15 pemeriksaan otomatis | `tests/payment_terms_obligation.test.ts` |
| Verifikasi peramban di enam lebar layar, nol elemen keluar dari kedua tepi | `scratchpad/e2e/decs05-verif2.log` |

## Not Implemented

**Actual Customer Payment** dan **Customer Receivable** — beserta verifikasi, rekonsiliasi,
jatuh tempo pelanggan, umur piutang, dan buku besar pelanggan.

**Ini bukan pekerjaan yang tertinggal. Ini pekerjaan yang belum boleh dimulai dari Sales.**

## AS-IS Finance Evidence

Sensus katalog basis data proyek nyata, 29 Agustus 2026, **setiap angka disertai saringannya**:

| Yang dicari | Hasil |
|---|---|
| Tabel dasar skema `public` | **96** (tabel + view: **104**) |
| Tabel `*payment*` | **3** — seluruhnya milik Sales |
| Tabel piutang (`*receiv*`, `*piutang*`) | **NIHIL** |
| Buku besar (`*ledger*`, `*journal*`, `*jurnal*`) | **NIHIL** |
| Kolom jatuh tempo | **1** — `kpi_actions.due_date`, milik modul KPI |
| Kolom "sudah dibayar" (`*paid*`, `*dibayar*`) | **NIHIL di seluruh 96 tabel** |
| Tabel `*invoice*` | **1** — `invoices`, **bukan** yang dicari |

**`invoices` JANGAN disalahgolongkan.** Kolomnya `subscription_plan_id`,
`payment_gateway_ref`, `period_start`, `period_end`, dan **nol kolom `customer_id`**. FK-nya ke
`subscription_plans`. Itu **FABRIX menagih tenant**, bukan **tenant menagih pelanggan**.

> **Soal angka "101 tabel" di batch sebelumnya:** benar pada saat sensus pertama — ia menghitung
> **tabel + view** *sebelum* tiga tabel payment lahir (104 − 3 = 101). Sensus hari ini memakai
> saringan lebih ketat: **96 tabel dasar**. Kesimpulannya identik; hanya penyebutnya kini
> membawa saringannya.

## FIN-02

**ARCHITECTURE GAP / CROSS-DOMAIN DEPENDENCY. Status: OPEN.**

Tercatat di Daftar Tugas sebagai `FIN-02`, di registri kontrak sebagai **K-06 (BELUM ADA)**, dan
diuraikan penuh di `docs/finance/FIN-02_CUSTOMER_RECEIVABLE_DOMAIN_GAP.md`.

**Tidak diselesaikan secara lokal.** Nol tabel piutang/pembayaran/ledger dibuat di giliran ini.

## BD-10

**OPEN / BLOCKED BY FIN-02.**

**Tidak ditutup**, dan alasannya bukan formalitas: sumber kebenaran pembayaran dan piutang
pelanggan **belum ada**, sehingga pernyataan "kewajiban pembayaran terpenuhi" tidak punya tempat
berpijak. Menutup BD-10 hari ini berarti menyatakan sesuatu yang tidak bisa dibuktikan sistem.

## Payment Terms

Aturan komersial, **milik Sales**. Master yang bisa dipakai ulang lintas Sales Order.
Berisi tahap-tahap: label, porsi (persentase **atau** nominal tetap), pemicu penagihan, dan
offset jatuh tempo.

Empat pemicu yang sah hari ini: `konfirmasi_order` · `sebelum_produksi` · `sebelum_kirim` ·
`setelah_kirim_n_hari`.

## Payment Obligation

**Komitmen komersial per Sales Order**, dan hanya itu.

Ia menyatakan **APA YANG HARUS DIBAYAR PELANGGAN**, bukan **APA YANG SUDAH DIBAYAR**.

**Beku dan historis — terbukti secara struktural, bukan lewat niat:**

```
sales_order_payment_obligations:
  sales_order_payment_obligation_id, company_id, sales_order_id, sequence_no,
  payment_term_id,
  payment_term_name_snapshot, label_snapshot, percentage_snapshot,
  trigger_event_snapshot, due_offset_days_snapshot,
  amount, created_at
```

- Seluruh nilai termin **disalin sebagai snapshot** saat penjadwalan.
- **Nol trigger** pada ketiga tabel payment → tidak ada yang menghitung ulang diam-diam.
- **Satu-satunya** fungsi yang menyentuhnya adalah `terapkan_payment_terms`, dan fungsi itu
  **menolak** menjadwal ulang: *"Sales Order ini sudah punya jadwal pembayaran. Perubahan termin
  mengikuti alur amandemen komersial."*
- Konsekuensinya persis seperti yang diminta: Master berubah **60/40 → 50/50**, SO-001 **tetap
  60/40**.

**Nol kolom** `paid_amount` · `payment_date` · `payment_status` · `payment_reference` —
**diverifikasi langsung ke katalog kolom**, bukan diasumsikan. Menambahkannya sekarang akan
menciptakan **UNREACHABLE SOURCE OF TRUTH**, dan itu cacat arsitektur.

### Aturan pembulatan — CATATAN PENTING

Tahap terakhir **menyerap sisa pembulatan**, dan penjadwalan **dibatalkan** bila totalnya tidak
sama persis dengan nilai Sales Order.

> **Ini KEPUTUSAN IMPLEMENTASI SAAT INI, BUKAN aturan Finance kanonik yang sudah ada.**
> Ia dipilih karena tidak ada aturan pembulatan resmi untuk dirujuk, dan karena kehilangan satu
> rupiah dalam penjumlahan kewajiban lebih berbahaya daripada satu tahap yang berbeda satu
> rupiah dari porsinya. **Bila Finance kelak menetapkan aturan pembulatan yang berbeda, aturan
> Finance yang menang** dan bagian ini diganti — bukan sebaliknya.

## Actual Payment Boundary

**Milik Finance. Belum ada. Tidak boleh dibangun dari Sales.**

Yang **dilarang** dibuat: `sales_payments` · `customer_payment_status` · tabel pembayaran
sementara · tabel pembayaran "future-ready" — tanpa keputusan arsitektur.

## Receivable Boundary

**Milik Finance. Belum ada. Tidak boleh dibangun dari Sales.**

Yang **dilarang** dibuat: `sales_receivables` · `sales_ar` · `customer_ledger` ·
`sales_invoices_for_customer`.

**Apa yang melahirkan piutang belum ditentukan** (Pertanyaan 4) — tagihan terbit, pengiriman,
Sales Order, atau milestone kontrak. Keempatnya menghasilkan angka piutang yang berbeda pada
bulan yang sama, jadi ini **tidak boleh ditebak**.

## Source of Truth

| Hal | Sumber kebenaran | Keadaan |
|---|---|---|
| Payment Terms | `payment_terms` + `payment_term_steps` | **ADA** · Sales |
| Payment Obligation | `sales_order_payment_obligations` (beku) | **ADA** · Commercial Transaction |
| Actual Payment | — | **HILANG** · Finance |
| Customer Receivable | — | **HILANG** · Finance |
| Payment Status | **turunan**, bukan tersimpan | **BELUM BISA DIHITUNG** |

**Nol sumber kebenaran keuangan kedua diciptakan di giliran ini.**

## Sales Visibility

Yang **sudah** terlihat di halaman Sales Order: Payment Terms · jadwal · porsi · nilai rupiah
tiap tahap · kapan ditagihkan.

Yang **belum bisa** terlihat: status pembayaran · jumlah terbayar · sisa · tunggakan.

**Nilai palsu TIDAK ditampilkan** — ini sudah dipatuhi hari ini, bukan rencana. Panel jadwal
memuat kolom *Tahap · Kapan ditagihkan · Porsi · Nilai* saja, dengan keterangan menetap:

> *"Ini komitmen pembayaran, bukan catatan pembayaran. FABRIX belum mencatat penerimaan
> pembayaran, jadi berapa yang sudah dibayar dan berapa yang tertunggak belum bisa ditampilkan
> di sini."*

Menampilkan `Rp0`, "Paid", atau "Outstanding" hari ini akan **menyesatkan**: nol yang berarti
"belum ada datanya" tidak bisa dibedakan dari nol yang berarti "memang belum dibayar".

## Finance Dependency

Sales **tidak bisa melanjutkan** tiga hal sampai Finance ada:

1. Menyatakan Sales Order **lunas** → BD-10.
2. Menyatakan Sales Order **selesai** → BD-01 mensyaratkan konfirmasi Finance.
3. Menampilkan **tunggakan** dan **umur piutang**.

## Cross-Domain Contract

**K-06 · Sales ↔ Finance — BELUM ADA.**

Bentuk yang **diajukan untuk ditinjau**, bukan diputuskan: Sales **menghasilkan** kewajiban →
Finance **mencatat** pembayaran & piutang → Sales **MEMBACA** status turunannya.

**Payment Clearance:** belum ada kontraknya. **Tidak diimplementasikan** di giliran ini, sesuai
perintah — dicatat sebagai **CROSS-DOMAIN DECISION REQUIRED** (Pertanyaan 14).

**Batas pengiriman yang sudah berlaku:** tahap `sebelum_kirim` **hanya menyatakan kapan tagihan
jatuh**; ia **tidak memiliki** status pengiriman. Terukur: nol baris kode pada tabel payment
yang menulis ke `shipments`. Satu-satunya sebutan "shipment" di migrasinya adalah **komentar
bukti** yang dipertahankan sesuai perintah:

```
-- sebelum_kirim : sebelum transisi shipments draft -> shipped (ada hari ini)
```

## Security

Tetap **gagal tertutup**, dan diverifikasi ulang di giliran ini:

- `terapkan_payment_terms` dapat dipanggil **hanya** oleh `postgres`, `authenticated`,
  `service_role`. **`anon` dan `PUBLIC` tidak ada dalam daftar izinnya** — dibaca dari `proacl`
  di katalog, bukan dari niat di migrasi.
- Identitas, tenant/`company_id`, peran, dan kepemilikan diperiksa **sebelum** data tersentuh.
- Sales **boleh membaca** visibilitas keuangan turunan; Sales **tidak boleh memutasi** data
  Finance; Finance pemilik mutasi keuangan.
- Aturan yang berlaku untuk fungsi Finance kelak: **nol fungsi baru boleh dipanggil
  `anonymous`** tanpa alasan arsitektur tertulis. PostgreSQL memberi izin `PUBLIC` pada setiap
  fungsi baru secara bawaan — pencabutannya harus eksplisit (pelajaran SEC-21).

## DEC-S10

Keputusan keuangan berkonsekuensi **wajib** memakai mekanisme Decision Record **kanonik yang
sudah ada**: `status_transition_log` yang diperluas (pelaku, peran, departemen, kategori alasan,
catatan) + master `decision_reason_categories`.

**DILARANG membuat `finance_decision_log`.**

Termasuk: pembebasan pembayaran · penyesuaian piutang · keputusan pelunasan · persetujuan
keuangan · pengecualian pembayaran · keputusan pengembalian dana · penghapusan piutang.

## Architecture Gaps

| Kode | Jurang | Status |
|---|---|---|
| **FIN-02** | Domain Finance piutang pelanggan tidak ada | **OPEN** — menunggu Architecture Guardian |
| **BD-10** | Kapan kewajiban pembayaran dinyatakan terpenuhi | **BLOCKED BY FIN-02** |
| **BD-01** | Kapan sebuah order dianggap selesai | **OPEN** |
| **BD-09** | Toleransi kurang-kirim | **OPEN** |
| **AD-03** | Kosakata status Sales Order (11 vs 4) | **OPEN** — tercatat ADR-011 PROPOSED |
| **K-06** | Kontrak Sales ↔ Finance | **BELUM ADA** |
| **PJL-13** | Termin pembayaran belum bisa dibuat lewat layar | tercatat |
| **PJL-14** | Dua konsep "termin pembayaran" hidup berdampingan | tercatat |

## Work Plan

`docs/SALES_CRM_WORK_PLAN.md` diperbarui:

| Workstream | Status |
|---|---|
| **WS-PAYMENT-TERMS** | **DONE / VERIFIED** |
| **WS-PAYMENT-OBLIGATION** | **DONE / VERIFIED** |
| **WS-CUSTOMER-PAYMENT** | **BLOCKED BY FIN-02** |
| **WS-CUSTOMER-RECEIVABLE** | **BLOCKED BY FIN-02** |

**Progres tetap 64%.** Menulis dokumen FIN-02 **tidak menaikkan progres** — yang bertambah
adalah kejelasan, bukan kapabilitas.

## Decision Register

`docs/sales-crm/SALES_CRM_DECISION_REGISTER.md` diperbarui: DEC-S05 **CLOSED** dengan bukti
implementasi, batas domain (Actual Payment + Receivable milik Finance), dan ketergantungan
**FIN-02**. **BD-10 tetap OPEN.**

## Architecture Guardian Questions

**24 pertanyaan** disusun dan **tidak satu pun dijawab** — lihat
`docs/finance/FIN-02_CUSTOMER_RECEIVABLE_DOMAIN_GAP.md`, bagian *Pertanyaan untuk Architecture
Guardian*.

Empat yang paling menentukan urutan pekerjaan berikutnya:

- **Pertanyaan 4** — apa yang melahirkan piutang.
- **Pertanyaan 5** — apa yang melahirkan kewajiban pembayaran.
- **Pertanyaan 10** — bagaimana Finance memaparkan status turunan ke Sales.
- **Pertanyaan 14** — apakah pelunasan menggerbangi pengiriman.

## Evidence

| Bukti | Cara diperoleh |
|---|---|
| Sensus 96 tabel + saringan per pencarian | kueri `information_schema` ke proyek nyata, **hanya membaca** |
| Kolom `invoices` & FK-nya | katalog `pg_constraint` + `information_schema.columns` |
| Kolom kewajiban (nol kolom pembayaran) | `information_schema.columns` |
| Nol trigger pada tabel payment | `pg_trigger`, `tgisinternal = false` |
| Satu-satunya fungsi penyentuh kewajiban | `pg_get_functiondef` disisir se-skema |
| Izin `terapkan_payment_terms` | kolom `proacl` di `pg_proc` |
| Penolakan penjadwalan ulang | baris 55–57 migrasi `20260911110000` |
| Layar tidak mengarang nilai pembayaran | `SalesOrdersPage.tsx` + log verifikasi peramban |
| Regresi penuh | **90 berkas · 667 lulus · 7 dilewati · 0 gagal**, dicocokkan dengan 674 pemeriksaan di kode sumber |

**Nol perubahan kode dan nol migrasi di giliran ini.** Nol data keuangan nyata disentuh.

## Current Progress

**64%**

Tidak dinaikkan. Bobot fase hanya berubah bila kriteria terima kapabilitas bisnis berubah — dan
dokumentasi bukan kapabilitas.

## Next Required Decision

**FIN-02.**

Sampai Architecture Guardian memutuskan kepemilikan domain Finance, entitas kanoniknya, dan
kontrak lintas domainnya: **FIN-02 OPEN, BD-10 BLOCKED, dan Sales berhenti di sini.**

---

# PEMBARUAN PENYERAHAN — 29 Agustus 2026 (malam)

> **Dokumen ini adalah PERMINTAAN KEPUTUSAN ARSITEKTUR, bukan permintaan implementasi.**
> *(This document is an architecture decision request, not an implementation request.)*

## Apa yang berubah sejak penyerahan pertama

Pemilik produk mengunci **empat aturan bisnis**. Satu di antaranya **memutus rantai penghambat**
yang sebelumnya tercatat di sembilan tempat di repositori ini.

### 1. Penyelesaian Sales Order TIDAK tergantung pembayaran — **rantai lama SALAH**

**Yang tercatat sebelumnya, dan kini dikoreksi:** *"FIN-02 memblokir BD-10, dan BD-10 memblokir
penyelesaian Sales Order."*

**Yang benar sejak 29 Agu 2026:** Sales Order boleh **COMPLETED** meski pelanggan masih punya
**tunggakan**. Syaratnya **seluruhnya soal pemenuhan**:

1. Seluruh kuantitas komitmen **diproduksi**; 2. seluruhnya **dikirim**;
3. PPIC/Fulfillment **mengonfirmasi**; 4. Manager/GM **konfirmasi akhir**.

Kombinasi **SAH**: COMPLETED + OUTSTANDING · COMPLETED + PARTIALLY PAID · COMPLETED + PAID.

**Akibat langsung:** **BD-01 TERKUNCI**, dan **penyelesaian Sales Order KELUAR dari daftar yang
terhalang** — ia kini pekerjaan yang siap dijadwalkan (PJL-03), **bukan** keputusan yang ditunggu.

### 2. Kurang kirim — **nol toleransi otomatis** (BD-09 TERKUNCI)

Dipesan 10.000, terkirim 9.800 → **BELUM SELESAI**. Sisa komitmen tetap terlacak sampai
**dipenuhi** atau **dibatalkan secara sah**. Tidak ada ambang otomatis.

### 3. Status pembayaran TERPISAH dari siklus Sales Order

`UNPAID → PARTIALLY PAID → PAID`, dan **tidak digabung** dengan status Sales Order.

### 4. Gerbang aktivitas mengikuti TERMIN TRANSAKSI, bukan aturan global

"60% sebelum produksi" → gerbang **produksi**. "40% sebelum kirim" → gerbang **pengiriman**.
"30 hari setelah kirim" → **tidak ada gerbang**.

**DILARANG membuat aturan global `belum bayar = terblokir`** — dua termin yang sama-sama sah
menghasilkan perilaku **berlawanan** untuk keadaan "belum dibayar" yang sama persis.

## Rantai penghambat — versi yang benar

| Yang dulu tercatat | Yang benar sekarang |
|---|---|
| FIN-02 → BD-10 → **penyelesaian SO terblokir** | FIN-02 → BD-10 → **status pembayaran & gerbang** terblokir. **Penyelesaian SO TIDAK terblokir** |
| BD-09 **OPEN**, menahan penyelesaian SO | BD-09 **TERKUNCI** — nol toleransi |
| BD-01 **OPEN** | BD-01 **TERKUNCI** — berbasis pemenuhan |

Sembilan tempat yang memuat rantai lama sudah dikoreksi **dengan menyebut apa yang sebelumnya
tertulis** — bukan dihapus seolah tidak pernah ada.

## Yang HARUS diputuskan Architecture Guardian

1. **Kepemilikan domain FIN-02** — siapa pemilik piutang pelanggan.
2. **Entitas Finance kanonik.**
3. **Sumber kebenaran pembayaran nyata.**
4. **Sumber kebenaran piutang.**
5. **Kontrak Payment Clearance** — bentuk sinyal pelunasan milestone.
6. **Kontrak Gerbang Produksi (K-07).**
7. **Kontrak Gerbang Pengiriman (K-08).**
8. **Otorisasi pengecualian** — siapa boleh melewati gerbang, dan dengan jejak apa.
9. **Kaitan Decision Record** — memakai mekanisme kanonik yang sudah ada, bukan yang baru.

## Kontrak lintas domain yang diberi nama batch ini

| Kode | Kontrak | Keadaan |
|---|---|---|
| **K-06** | Sales ↔ Finance (kewajiban ↔ pembayaran & piutang) | **BELUM ADA** |
| **K-07** | Finance → pelunasan milestone → **Produksi** | **BELUM ADA — arsitektur menunggu** |
| **K-08** | Finance → pelunasan milestone → **Pengiriman** | **BELUM ADA — arsitektur menunggu** |
| **K-09** | Pemenuhan → **penutupan Sales Order** | **ATURAN TERKUNCI**, kontrak belum ditulis |

Diberi nama supaya **bisa diputuskan**, bukan supaya bisa dibangun diam-diam.

## Pertanyaan — kini bergolongan

**35 pertanyaan** (24 lama + 11 baru), digolongkan A–E supaya tidak salah alamat:
**A = 8** bisnis · **B = 11** arsitektur · **C = 9** kebutuhan domain Finance · **D = 6** kontrak
lintas domain · **E = 0** · **1** bergolongan ganda.

Nol pertanyaan dihapus. Nol pertanyaan dijawab sendiri.
Daftar penuh: `docs/finance/FIN-02_CUSTOMER_RECEIVABLE_DOMAIN_GAP.md`.

## Keadaan yang tidak berubah

**FIN-02 OPEN** · **BD-10 OPEN/BLOCKED** · **DEC-S05 CLOSED** · **progres 64%** ·
**nol kode, nol migrasi, nol tabel Finance**.

Sembilan keputusan DEC-S02..S10 **tidak dibuka kembali**. Ketergantungan yang ditemukan dicatat
sebagai **DEPENDENCY**, bukan sebagai keputusan yang dibuka ulang.
