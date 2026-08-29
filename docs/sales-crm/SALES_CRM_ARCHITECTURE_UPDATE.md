# ARCHITECTURE UPDATE

## Date
29 Agustus 2026

## Workstream
WS-SALES-ROLE · WS-SALES-CANCEL · WS-PO-HOLD · SEC-21 · SEC-23

## Decision References
BD-02, BD-03, BD-06, BD-07, AD-01, AD-02, DEC-S11, DEC-S12 (peran Sales) — **CLOSED**
DEC-S02..DEC-S10 — **CLOSED sebagai baseline bisnis**, implementasi sebagian besar **OPEN**
AD-03, BD-09, BD-10, DEC-S13 (override) — **OPEN**

---

## KONFLIK YANG DICATAT, BUKAN DIPUTUSKAN SENDIRI (§0)

> **Dokumen tata kelola kanonik adalah KERANGKA, bukan registri terisi.** Ini bukan
> kritik — ini keadaan yang harus diketahui siapa pun yang diminta "membaca Entity
> Registry untuk menentukan pemilik".

Terukur 29 Agu 2026:

| Dokumen | Panjang | Isi sebenarnya |
|---|---|---|
| `FABRIX_ENTITY_REGISTRY.md` | **24 baris** | Daftar **nama** entitas. **Nol** pemilik domain, **nol** sumber kebenaran, **nol** state owner |
| `FABRIX_CROSS_DOMAIN_CONTRACTS.md` | **29 baris** | Kerangka + dua kalimat contoh. **Nol** kontrak sungguhan |
| `FABRIX_ADR_REGISTER.md` | **39 baris** | Template ADR. **Nol** ADR tercatat |
| `FABRIX_STATE_MACHINE_REGISTRY.md` | 33 baris | "Baseline examples" yang **melarang dirinya sendiri disalin** |

Sementara implementasinya memuat **101 tabel**, **69 fungsi**, **157 kebijakan RLS**,
**28 trigger**, dan **89 berkas test**.

**IMPLICASINYA UNTUK CARA KERJA, dan ini yang paling penting:** perintah "tentukan pemilik
dari Entity Registry" **tidak bisa dijalankan apa adanya** — registrinya tidak memuat
kepemilikan. Yang benar-benar menentukan kepemilikan hari ini adalah **kode**:
`src/lib/roles.ts`, kebijakan RLS, dan fungsi basis data.

**Yang dilakukan giliran ini:** bagian registri yang **disentuh pekerjaan ini** diisi di
bawah. Mengisi seluruhnya adalah pekerjaan tersendiri yang belum diperintahkan.

**ARCHITECTURE GUARDIAN REVIEW DIMINTA** untuk memutuskan apakah registri diisi menyeluruh,
atau ditandai tegas sebagai kerangka supaya tidak dikira otoritatif.

---

## AS-IS Evidence — sembilan keputusan diadu dengan kenyataan

Disensus terhadap 101 tabel dan seluruh kolom, 29 Agu 2026.

| Keputusan | Status implementasi | Bukti terukur |
|---|---|---|
| **DEC-S02** Quotation | **MISSING** | nol tabel/kolom ber-nama quotation atau penawaran |
| **DEC-S03** Sample | **MISSING** | `production_standard_samples` **bukan** ini — ia pencuplikan statistik standar produksi |
| **DEC-S04** Kode produk pelanggan | **MISSING** | nol tabel, nol kolom |
| **DEC-S05** Payment terms / obligation | **PARTIAL** | hanya kolom teks `payment_terms` (`full`\|`tempo`) di PO klien. **Nol** jadwal, **nol** kewajiban, **nol** piutang |
| **DEC-S06** Contract / Agreement | **MISSING** | nol tabel |
| **DEC-S07** Return / Complaint / RMA | **MISSING** | `delivery_confirmations` adalah POD, bukan retur |
| **DEC-S08** Amendment | **MISSING** | versi hanya ada di `boms`, `routings`, `documents`, `kamus_terms` — **tidak** di Sales Order |
| **DEC-S09** Alamat kirim | **IMPLEMENTED** | daftar master + pembekuan di pengiriman + pemilih di layar |
| **DEC-S10** Decision Record | **PARTIAL** | lihat bagian tersendiri di bawah |

**Delapan dari sembilan keputusan yang ditutup belum punya implementasinya.** Itu memang
diharapkan (§15: *decision CLOSED ≠ implementation DONE*) — dicatat di sini supaya tidak
ada yang membaca "CLOSED" sebagai "sudah ada".

---

## TO-BE yang benar-benar dibangun giliran ini

**Peran Sales** sebagai peran tersendiri · **Permintaan pembatalan** (mengajukan ≠
membatalkan, pemohon ≠ pemutus) · **Sales menahan PO klien** · **dua lubang keamanan
ditutup** beserta pengawas kelasnya.

## Changed Entities

| Entitas | Perubahan | Pemilik domain |
|---|---|---|
| `users.role` | nilai `sales` **ditambahkan**; nol nilai dibuang | Keamanan/Identitas |
| `cancellation_requests` | **BARU** — permintaan pembatalan, dua entitas | **Sales** |
| `decision_reason_categories` | **BARU** (gelombang sebelumnya) + kategori Sales | Master seluruh tenant |
| `status_transition_log` | **DIPERLUAS** 5 kolom jejak keputusan | Lintas domain |
| `sales_order_lines` | kebijakan RLS **ditambahkan** (sebelumnya nol) | Sales |

## Ownership

**Sales memiliki:** pelanggan, PO klien, Sales Order (komersial), permintaan pembatalan,
penahanan ber-blocker Sales.
**Sales TIDAK memiliki:** produksi, pengiriman, keuangan, mutu, formula/BOM, dan
**tidak memperoleh wewenang persetujuan apa pun**.

## Source of Truth

| Hal | Sumber kebenaran | Sales boleh |
|---|---|---|
| Status komersial Sales Order | `sales_orders.status` | **memiliki** |
| Kemajuan produksi | Work Order | membaca (diturunkan) |
| Kemajuan pengiriman | Shipment | membaca (diturunkan) |
| Alamat yang tercetak | `shipments.delivery_address` (beku) | membaca |
| Status pembayaran | **belum ada pemiliknya** — BD-10 terbuka | — |

## State Machine

**TIDAK ADA state baru ditambahkan** — dan itu keputusan sadar, bukan kelalaian.
Menambah `cancellation_requested` akan mendahului **AD-03** yang masih terbuka. Permintaan
hidup di tabelnya sendiri; pembatalan akhirnya memakai transisi `confirmed → cancelled`
**yang sudah ada**. Bentuk ini tetap benar apa pun hasil AD-03.

## Decision / Approval

Alur kanonik yang ditegakkan: **DECISION → AUTHORIZATION → STATE TRANSITION**.
UI **bukan** otoritas: seluruh perpindahan status terjadi di dalam fungsi basis data yang
menegakkan wewenangnya sendiri.

### DEC-S10 diadu dengan implementasinya — apa adanya

| Syarat §10 | Ada? |
|---|---|
| tindakan · keadaan sebelum · sesudah · waktu | **ya** |
| actor user ID · nama · peran · departemen (snapshot) | **ya** |
| kategori alasan · catatan tambahan | **ya** |
| entitas terkait · transaksi terkait | **ya** |
| rujukan persetujuan | kolom **ada**, belum diisi |
| **decision owner ≠ actor** | **TIDAK** — hanya pelaku yang tercatat |
| **rujukan versi transaksi** | **TIDAK** — versi Sales Order belum ada (DEC-S08) |
| **bukti pendukung** | **TIDAK** |

**Tiga syarat belum terpenuhi.** Dua di antaranya menunggu kapabilitas lain (versi
transaksi butuh DEC-S08). **Decision owner ≠ actor** bisa dikerjakan tanpa menunggu apa
pun — dicatat sebagai celah, bukan dianggap selesai.

## Cross-Domain Impact
**Nihil.** Nol tabel domain lain diubah. Pembatalan tidak menyentuh Work Order, produksi,
persediaan, maupun pengiriman.

## Security Impact
Dua kerentanan ditutup (SEC-21, SEC-23) beserta **pengawas kelasnya**
(`pg_proc_risiko_null`). Peran Sales dibuat dengan hak paling minimum dan **nol** wewenang
persetujuan. Seluruh fungsi baru: `PUBLIC`/`anon` dicabut, gerbang gagal-tertutup.

## UX Impact
Panel Pembatalan di Sales Order · modal kategori alasan + catatan · riwayat permintaan
beserta keadaan eksekusi saat diajukan. Nol pola visual baru.

## Test Evidence
`peran_sales` (16) · `permintaan_pembatalan` (17) · `matriks_keamanan_sales` (11) ·
`aksi_po_klien_jejak_keputusan` (16) · `jalur_kanonik_sales_order` (11).
**Mutasi:** 4 + 4 + 2 + 5 + 4 = **19**, seluruhnya menggigit.

## Data Safety
Nol data nyata dihapus/diubah. Nol pengguna nyata dipindahkan. Seluruh percobaan di
perusahaan uji yang dibuat dan dihapus sendiri.

## Remaining Gaps
Delapan dari sembilan keputusan belum berimplementasi · tiga syarat DEC-S10 belum ada ·
registri arsitektur masih kerangka · pemulihan pencadangan belum terbukti (INF-28).

## Open Decisions
**AD-03** kosakata status · **BD-09** toleransi kurang-kirim · **BD-10** pemilik status
pembayaran · **DEC-S13** override · **DEC-S02 format** quotation menunggu tinjauan.

## Next Recommended Work
**DEC-S05 (Payment Terms → Payment Obligation)**, dan alasannya bukan urutan daftar:
ia **satu-satunya** yang membuka **BD-10**, dan BD-10 kini memblokir status pembayaran serta gerbang produksi/pengiriman *(bukan penyelesaian Sales Order — dikoreksi 29 Agu 2026 malam)*. Rantai lama menyebut penyelesaian Sales
Order. Quotation (DEC-S02) bernilai tinggi tetapi **tidak membuka apa pun yang terhalang**.


---
---

# ARCHITECTURE UPDATE — DEC-S05

## Date
29 Agustus 2026 (giliran kedua)

## Workstream
WS-PAYMENT-TERMS · WS-PAYMENT-OBLIGATION · WS-FINANCE-INTEGRATION

## Decision References
**DEC-S05 — CLOSED.** BD-10 **tetap terbuka**, dan sebabnya kini terukur.

## AS-IS Evidence — audit Finance menyeluruh

Disensus terhadap **101 tabel**, bukan disimpulkan dari nama:

| Yang dicari | Hasil |
|---|---|
| `payments` | **NIHIL** |
| `receivables` / `accounts_receivable` | **NIHIL** |
| buku besar / jurnal | **NIHIL** |
| jatuh tempo | **NIHIL** |
| `invoices` | **ADA — dan bukan yang dicari** |

`invoices` punya FK ke `subscription_plans`, kolom `period_start` / `period_end` /
`payment_gateway_ref`, dan **nol kolom `customer_id`**. Itu **FABRIX menagih tenant-nya**,
bukan tenant menagih pelanggan. Nol pemakai di kode aplikasi.

> **ARCHITECTURE GAP: domain Finance untuk piutang pelanggan TIDAK ADA.** Tercatat sebagai
> **FIN-02**. Tidak dibangun dari Sales — §40 melarangnya tegas.

## TO-BE yang dibangun
Dua lapis pertama dari empat: **aturan pembayaran** dan **komitmen pembayaran**. Dua lapis
terakhir — pembayaran sungguhan dan piutang — **tidak dibangun**, karena pemiliknya belum ada.

## Changed Entities

| Entitas | Sifat | Pemilik |
|---|---|---|
| `payment_terms` | **BARU** — aturan bisa dipakai ulang | Sales / Komersial |
| `payment_term_steps` | **BARU** — tahap, persentase **atau** nominal tetap, berpemicu | Sales / Komersial |
| `sales_order_payment_obligations` | **BARU** — komitmen **beku** per Sales Order | Sales / Komersial |

## Source of Truth

| Hal | Pemilik | Ada? |
|---|---|---|
| Aturan pembayaran | Sales/Komersial | **ya** |
| Komitmen pembayaran | transaksi (Sales) | **ya** |
| **Pembayaran sungguhan** | **Finance** | **TIDAK ADA** |
| **Piutang** | **Finance** | **TIDAK ADA** |
| Status pembayaran | diturunkan dari dua di atas | **tidak bisa** |

## State Machine
**Nol status ditambahkan.** Tabel kewajiban **sengaja tanpa kolom status** — status yang
tidak punya sumber tidak akan pernah bisa dicapai, dan kolom seperti itu adalah cacat.

## Cross-Domain Boundary
Sales **tidak** membuat `sales_payment` maupun `sales_receivable`. Dijaga test: nol tabel
pembayaran/piutang boleh lahir, dan tabel kewajiban **tidak boleh** punya kolom
`paid_amount`, `payment_date`, atau `status`.

## Finance Integration
**BLOCKED.** Begitu Finance ada, status kewajiban dapat **diturunkan** dari nilai kewajiban
vs pembayaran terverifikasi — **tanpa satu pun kolom status disimpan di sisi Sales**.

## Tiga hal yang TIDAK ditebak, jawabannya dari pengukuran

| Pertanyaan | Bukti | Jawaban |
|---|---|---|
| Mata uang (§17) | nol kolom `currency`/`fx` di seluruh skema | **satu mata uang**; multi-currency = gap terbuka |
| Dasar pajak (§18) | **nol** kolom pajak/diskon | persentase atas total baris SO; **OPEN** bila pajak kelak ada |
| Pemicu "sebelum kirim" (§19) | `status_transition_rules`: `draft → shipped` | sebelum perpindahan itu — **tidak dikarang** |
| Presisi (§25) | uang di sistem ini `numeric(14,4)` | kewajiban memakai yang sama |

## Rounding
Tidak ada mekanisme kanonik untuk dipakai ulang. Kriteria terima §25 sendiri menuntut jumlah
kewajiban **sama persis** dengan nilai transaksi; saat persentase tidak habis dibagi,
**tahap terakhir menyerap sisanya**. **Aturan yang DIPILIH**, bukan perilaku yang ditemukan.

## Security
`terapkan_payment_terms`: `SECURITY DEFINER`, dibuka `wajib_identitas_tenant()`, gerbang
peran ber-`coalesce`, kepemilikan perusahaan `is distinct from`, `PUBLIC`/`anon` dicabut.
Menulis ke tabel kewajiban hanya lewat fungsi — nol kebijakan tulis.

## Test Evidence
`tests/payment_terms_obligation.test.ts` — **15 pemeriksaan**. Tiga mutasi diuji.
Mencabut penyerapan sisa → fungsi **menolak** (`P0001`), bukan menulis angka meleset.
Mutasi mencabut penjaga jumlah akhir **saja** tidak menggigit — dan itu **bukan cacat**:
penyerapan sisa membuat ketidakseimbangan mustahil, sehingga penjaganya memang lapis kedua.

## UX
Panel **Jadwal pembayaran** di detail Sales Order, dengan kalimat batas yang menyebutkan
apa adanya bahwa ini **komitmen, bukan catatan pembayaran**. Enam lebar bersih; markup tabel
diverifikasi semantik (`thead` + `th[scope=col]`).

## Data Safety
Nol data nyata disentuh. Seluruh percobaan di perusahaan uji yang dibuat dan dihapus sendiri.

## Remaining Gaps
**FIN-02** (domain Finance) · dasar pajak **OPEN** · multi-currency **OPEN** · overpayment
**OPEN** (§27 — tidak dikarang karena Finance belum ada) · prioritas termin
Contract→Quotation→Customer default **OPEN** (§16 — ketiganya belum ada, jadi belum ada konflik).

## Open Decisions
AD-03 · BD-09 · **BD-10 (diblokir FIN-02)** · DEC-S13 · dasar pajak · multi-currency.

## Next Recommended Work
**FIN-02** — domain Finance. Ia satu-satunya yang membuka BD-10, dan BD-10 memblokir
penyelesaian Sales Order. **Tetapi ia milik domain Finance, bukan Sales** — sesuai
§45, batch ini berhenti di sini.

---

# PEMBARUAN ARSITEKTUR — POST DEC-S05 · RECONCILE & HANDOFF (29 Agustus 2026, sore)

Giliran ini **nol kode, nol migrasi**. Isinya: rekonsiliasi, dokumentasi, penyerahan, berhenti.

## DEC-S05 — status resmi

**CLOSED.**

| Lapisan | Keadaan | Pemilik |
|---|---|---|
| Payment Terms | **VERIFIED** | Sales / Commercial |
| Payment Obligation / Schedule | **VERIFIED** | Commercial Transaction |
| Actual Customer Payment | **NOT IMPLEMENTED** | Finance — belum ada |
| Customer Receivable | **NOT IMPLEMENTED** | Finance — belum ada |

**Alasan dua yang terakhir tidak dibangun: FIN-02.** Bukan kekurangan waktu — kekurangan
**pemilik domain**.

## BD-10

**OPEN / BLOCKED BY FIN-02.** Tidak ditutup, dan tidak boleh ditutup sampai sumber kebenaran
pembayaran & piutang pelanggan ada.

## Verifikasi ulang yang dijalankan giliran ini

Seluruhnya **membaca**, nol menulis — dan seluruhnya dari katalog basis data, bukan dari niat
yang tertulis di migrasi:

| Yang diperiksa | Hasil |
|---|---|
| Kolom pembayaran nyata di kewajiban (`paid_amount`, `payment_date`, `payment_status`, `payment_reference`) | **NIHIL** — keempatnya tidak ada |
| Trigger pada tiga tabel payment | **NIHIL** — tidak ada yang menghitung ulang diam-diam |
| Fungsi yang menyentuh kewajiban | **satu** — `terapkan_payment_terms` |
| Perilaku saat dijadwal ulang | **ditolak** dengan pesan yang mengarahkan ke alur amandemen |
| Izin `terapkan_payment_terms` (`proacl`) | `postgres`, `authenticated`, `service_role` — **tanpa `anon`, tanpa `PUBLIC`** |
| Kepemilikan status pengiriman oleh payment | **nol baris** menulis ke `shipments`; satu-satunya sebutan adalah komentar bukti |
| Layar mengarang nilai pembayaran | **tidak** — nol kolom "Terbayar"/"Sisa", disertai kalimat batas |

## Koreksi angka sensus

Sensus Finance pertama menyebut **101 tabel**. Angka itu benar untuk **tabel + view sebelum tiga
tabel payment lahir** (104 − 3 = 101). Sensus ulang hari ini dengan saringan lebih ketat
menyebut **96 tabel dasar**. **Kesimpulan tidak berubah**: nol tabel pembayaran pelanggan, nol
piutang, nol ledger, nol jatuh tempo pelanggan.

## Dokumen yang lahir

| Dokumen | Isi |
|---|---|
| `docs/finance/FIN-02_CUSTOMER_RECEIVABLE_DOMAIN_GAP.md` | paket penyelidikan 24 bagian + **24 pertanyaan yang sengaja tidak dijawab** |
| `docs/sales-crm/SALES_CRM_FIN02_ARCHITECTURE_HANDOFF.md` | penyerahan resmi ke Architecture Guardian |

Diperiksa lebih dulu: **tidak ada dokumen arsitektur Finance yang sudah ada** di repositori,
jadi ini bukan duplikat.

## Progres

**Tetap 64%.** Dokumentasi bukan kapabilitas — angkanya hanya berubah bila kriteria terima
kapabilitas bisnis berubah.

## Yang TIDAK dikerjakan, sesuai perintah

Quotation · Sample · Kode Produk Pelanggan · Contract · Retur/RMA · Amandemen Sales Order ·
Alamat Pengiriman — **tidak dimulai**. Batch ini berhenti setelah penyerahan.

---

# PERNYATAAN ARSITEKTUR RESMI — 29 Agustus 2026 (malam)

| Hal | Keadaan |
|---|---|
| **FIN-02** | **OPEN / BLOCKED** — domain Finance untuk piutang pelanggan **tidak ada** |
| **DEC-S05** | **CLOSED** |
| Payment Terms | **IMPLEMENTED / VERIFIED** |
| Payment Obligation | **IMPLEMENTED / VERIFIED** |
| Actual Payment | **NOT IMPLEMENTED** |
| Customer Receivable | **NOT IMPLEMENTED** |
| Payment Verification | **NOT IMPLEMENTED** |
| **BD-10** | **OPEN / BLOCKED** sampai arsitektur Finance ditetapkan |
| **BD-01** · **BD-09** | **TERKUNCI** 29 Agu 2026 — penyelesaian berbasis pemenuhan, nol toleransi |
| Payment Clearance · Production Gate · Shipment Gate | **ARCHITECTURE PENDING** |
| Progres | **64%** — tidak dinaikkan |
| Perubahan kode · migrasi · tabel Finance | **0 · 0 · 0** |

**Koreksi yang dibawa batch ini:** rantai *"BD-10 memblokir penyelesaian Sales Order"* **tidak
lagi berlaku**. Yang ditahan BD-10 adalah **status pembayaran** dan **gerbang
produksi/pengiriman**. Penyelesaian Sales Order kini **siap dibangun** (PJL-03) dan **tidak
menunggu Finance**.

Rincian penuh: `docs/finance/FIN-02_ARCHITECTURE_RECONCILIATION.md`.

---

# BATCH 30 AGUSTUS 2026 — FIN-02 · BD-10 · AD-03 · DEC-S13

## Yang berubah di kode

**Hanya DEC-S13.** Tiga workstream lain menghasilkan **audit dan dokumen**, bukan kode —
dan itu memang perintahnya.

| Kode | Bentuk hasil |
|---|---|
| **FIN-02** | kontrak antar domain didefinisikan · **nol tabel Finance dibuat** |
| **BD-10** | rekonsiliasi + **verifikasi kode**: nol tempat yang menggerbangi penyelesaian dengan pembayaran |
| **AD-03** | audit 11 status + usulan kanonik · **implementasi tidak disentuh** |
| **DEC-S13** | **dibangun**: pelepasan darurat penghalang PO klien |

## DEC-S13 — ringkas

Wewenang **bernama sendiri** (`EMERGENCY_HOLD_RELEASE_ROLES` ↔ `jwt_boleh_lepas_darurat()`),
bukan disimpulkan dari "kebetulan pimpinan". **Bukan jalan pintas**: penghalang milik departemen
sendiri **ditolak** dengan arahan memakai jalur biasa. **Sejarah utuh**: baris penahanan asli
tidak disentuh; pelepasan darurat menjadi baris **baru** ber-`authority_basis` dan
`overridden_department`.

**Nol** tabel penghalang baru · **nol** tabel log baru · **nol** peran baru.

## Temuan yang paling perlu dibaca

**Versi pertama migrasi DEC-S13 menulis ulang trigger `enforce_status_transition` dari
ingatan**, dan diam-diam menghilangkan: gerbang tiga persetujuan PO klien, kewajiban foto bukti
pengiriman, penentuan `record_id` per tabel, kode galat `23514`, dan fallback `changed_by`.

**Ditangkap sebelum diterapkan** dengan membandingkan ke `pg_get_functiondef()` yang sungguhan.
Ini contoh persis dari aturan proyek yang sudah tertulis — dan kali ini aturannya menyelamatkan
lima perilaku sekaligus.

## Konflik yang didokumentasikan, bukan ditambal

`customer_purchase_orders.payment_status` — ditampilkan, tidak pernah ditulis. **PJL-17**.

## Progres

**Tetap 64%.** Satu keputusan ditutup dan satu kapabilitas kecil lahir; bobot fase tidak
berubah karena kriteria terimanya milik arsitek.

---

# BATCH 30 AGUSTUS 2026 (II) — PENUTUPAN KEPUTUSAN PJL-16 · PJL-17 · AD-03 · DEC-S13

## Perubahan implementasi

| Kode | Yang berubah di kode |
|---|---|
| **PJL-16** | Syarat "minimal satu Work Order" **dicabut** dari kelayakan penutupan. Sumber pemenuhan **diturunkan** dari `shipment_lines.lot_id` → `work_order_outputs` / `lots.source_type`. Layar menampilkan "Dipenuhi dari". **Nol kolom baru.** |
| **AD-03** | `in_production` **dicabut** dari kekangan status; dua aturan transisi dihapus; label & saringan dashboard diselaraskan |
| **DEC-S13** | Wewenang darurat dipersempit ke **`general_manager` saja** |
| **PJL-17** | **Nol perubahan** — sesuai keputusan |

## Perubahan arsitektur

**Sales Order kini 3 status tersimpan.** Kemajuan produksi tetap **turunan**.
Kontrak **K-09** diperluas: pemenuhan boleh datang dari **produksi** maupun **stok**, dan
sumbernya **dibaca dari jejak lot** — bukan disimpan di Sales.

## Perubahan keamanan

`company_admin` **kehilangan** wewenang pelepasan darurat. Alasannya bukan hierarki melainkan
**jenis wewenang**: `company_admin` adalah administrator sistem (pengguna, undangan, setelan);
memberinya kuasa melampaui penghalang departemen berarti wewenang teknis diam-diam menjadi
wewenang komersial.

## Bukti

25 pemeriksaan penutupan · 16 pemeriksaan darurat · **3 mutasi menggigit** (5/3/2 kegagalan),
dipulihkan → 25 dan 16 hijau lagi.

## Penyerahan berikutnya

`SALES_TO_ENGINEERING_PRODUCT_HANDOFF.md` — 23 bagian, termasuk daftar tegas **apa yang
Engineering/Product TIDAK BOLEH duplikasi** dan satu temuan baru: **harga jual tidak berversi
dan tidak punya master** (PJL-18).


---

# GERBANG STAGING & UAT — 30 Agustus 2026

**Nol perubahan arsitektur di giliran ini.** Seluruh pekerjaan Sales & CRM di-commit menjadi
`0db1524` (115 berkas, +17.810 baris) dan **berhenti sebelum didorong**.

**Temuan yang menentukan**: situs yang selama ini disebut *staging* adalah **production**, dan
ia memakai **basis data nyata** — dibuktikan dari berkas JavaScript yang dikirim situsnya
sendiri (`kfvtrwuuqcjfkkuqizxt`). Karena itu "deploy ke staging untuk UAT" **tidak tersedia
sebagai tindakan yang aman** sampai lingkungan ujinya dipisahkan (INF-11) atau pemilik produk
memilih menerima risikonya secara sadar.

**Skema basis data sudah lebih maju daripada kode ter-deploy** di ketiga project (339 migrasi),
dan itu diperiksa **tidak merusak**: seluruh perubahan bersifat tambahan, dan status yang
dicabut (`in_production`) tidak pernah ditulis kode mana pun.
