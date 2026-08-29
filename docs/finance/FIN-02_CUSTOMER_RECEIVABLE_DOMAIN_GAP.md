# FIN-02 — CUSTOMER RECEIVABLE DOMAIN GAP

**Status:** OPEN · menunggu keputusan Architecture Guardian
**Disusun:** 29 Agustus 2026, oleh Claude Code, dari sisi Sales & CRM
**Sifat dokumen:** PENYERAHAN (handoff), **bukan** rancangan Finance
**Aturan baca:** dokumen ini **tidak memutuskan apa pun**. Ia mengumpulkan bukti, menandai
batas domain, dan menyerahkan 24 pertanyaan yang **hanya boleh dijawab Architecture Guardian**.

> **Kenapa dokumen ini ada di `docs/finance/` dan bukan di `docs/sales-crm/`:** isinya adalah
> kebutuhan **domain Finance**. Menaruhnya di folder Sales akan memberi kesan Sales memilikinya —
> dan justru itu yang tidak boleh terjadi.
>
> **Diperiksa lebih dulu:** tidak ada dokumen arsitektur Finance yang sudah ada di repositori
> (disisir 29 Agu 2026 di seluruh `docs/**.md`). Karena itu dokumen ini **baru**, bukan duplikat.

---

## 1. Keadaan sekarang (AS-IS)

FABRIX hari ini **tidak memiliki domain Finance untuk piutang pelanggan**. Yang ada hanya
**separuh sisi komersial** dari alur pembayaran, dan separuh itu milik Sales:

| Lapisan | Ada? | Pemilik | Bentuknya hari ini |
|---|---|---|---|
| Payment Terms (aturan pembayaran) | **ADA** | Sales / Commercial | `payment_terms`, `payment_term_steps` |
| Payment Obligation (komitmen per order) | **ADA** | Commercial Transaction | `sales_order_payment_obligations` |
| **Actual Payment** (uang benar-benar masuk) | **TIDAK ADA** | *belum ada pemilik* | — |
| **Customer Receivable** (piutang) | **TIDAK ADA** | *belum ada pemilik* | — |
| **Payment Verification** | **TIDAK ADA** | *belum ada pemilik* | — |
| **Payment Reconciliation** | **TIDAK ADA** | *belum ada pemilik* | — |
| **Due date pelanggan** | **TIDAK ADA** | *belum ada pemilik* | — |
| **Customer financial ledger** | **TIDAK ADA** | *belum ada pemilik* | — |

## 2. Bukti

Disensus langsung terhadap katalog basis data proyek nyata, 29 Agustus 2026.
**Setiap angka disertai saringannya**, karena angka tanpa saringan sudah pernah menyesatkan di
proyek ini.

| Yang dicari | Saringan | Hasil |
|---|---|---|
| Ukuran skema | `information_schema.tables`, `table_schema='public'`, `BASE TABLE` | **96 tabel** |
| Ukuran skema termasuk view | `table_schema='public'` (tabel + view) | **104** |
| Tabel ber-nama `*payment*` | `table_name ilike '%payment%'` | **3** — seluruhnya milik Sales: `payment_terms`, `payment_term_steps`, `sales_order_payment_obligations` |
| Tabel piutang | `ilike '%receiv%' or ilike '%piutang%'` | **NIHIL** |
| Buku besar | `ilike '%ledger%' / '%journal%' / '%jurnal%'` | **NIHIL** |
| Jatuh tempo | kolom `ilike '%due_date%' or '%jatuh_tempo%'` | **1** — `kpi_actions.due_date`, milik modul KPI, **bukan** keuangan |
| Kolom "sudah dibayar" | kolom `ilike '%paid%' or '%dibayar%'` | **NIHIL di seluruh 96 tabel** |
| Tabel ber-nama `*invoice*` | `ilike '%invoice%'` | **1** — `invoices`, dan **bukan** yang dicari (lihat §3) |

> **Catatan angka, ditulis karena laporan sebelumnya memakai angka lain.** Perintah batch ini
> menyebut *"101 tables inspected"*. Angka itu **benar pada saat sensus pertama**: ia menghitung
> **tabel + view** *sebelum* tiga tabel payment lahir (104 − 3 = 101). Sensus hari ini memakai
> saringan yang lebih ketat dan menyebut **96 tabel dasar**. **Kesimpulannya tidak berubah sama
> sekali** — nol tabel pembayaran pelanggan, nol piutang, nol ledger, nol jatuh tempo — hanya
> penyebutnya yang kini disertai saringannya.

## 3. Kapabilitas Finance yang sudah ada — dan yang menyamar

Satu-satunya tabel bernuansa keuangan pelanggan adalah `invoices`, dan **ia bukan yang dicari**.

```
invoices: invoice_id, company_id, subscription_plan_id, amount, status,
          payment_gateway_ref, period_start, period_end, created_at
FK      : company_id -> companies · subscription_plan_id -> subscription_plans
```

**Nol kolom `customer_id`. FK-nya ke `subscription_plans`.** Artinya `invoices` adalah
**FABRIX menagih TENANT-nya** (langganan SaaS), bukan **tenant menagih PELANGGANNYA**.

> **JANGAN salah golongkan tabel ini.** Memakainya untuk piutang pelanggan akan mencampur dua
> arah uang yang berlawanan di dalam satu tabel — dan sejak saat itu tidak ada satu query pun
> yang bisa menjawab "berapa piutang kita" tanpa penyaring yang harus diingat orang.

Kapabilitas keuangan lain yang **ada** dan **tidak menjawab kebutuhan ini**: biaya SDM tiga
golongan, baseline finansial terkunci, Margin Watch, laba operasional. Seluruhnya soal
**BIAYA dan MARGIN**, bukan **PENERIMAAN UANG**.

## 4. Apa yang hilang

1. Tempat mencatat **penerimaan pembayaran** dari pelanggan.
2. Tempat mencatat **piutang** beserta umurnya.
3. Mekanisme **verifikasi** pembayaran (siapa memastikan uangnya benar masuk).
4. Mekanisme **rekonsiliasi** antara kewajiban, tagihan, dan pembayaran.
5. Mekanisme **jatuh tempo** untuk pelanggan.
6. Status pembayaran **turunan** yang bisa dibaca Sales tanpa dimiliki Sales.

## 5. Kenapa Sales tidak boleh memilikinya

1. **Sales adalah sumber kebenaran KOMERSIAL, bukan KEUANGAN.** Ia menyatakan *apa yang harus
   dibayar*, bukan *apa yang sudah dibayar*.
2. **Sumber kebenaran ganda tidak pernah mengumumkan dirinya.** Bila Sales menyimpan
   `paid_amount` dan kelak Finance lahir, keduanya akan berbeda pada suatu hari, dan tidak ada
   yang tahu mana yang benar. Kelas cacat "dua jalur hidup" sudah berulang di proyek ini.
3. **Pemisahan tugas.** Orang yang menjual tidak boleh menyatakan uangnya sudah masuk.
4. **Kolom yang tidak punya pengisi adalah CACAT, bukan persiapan.** Menambahkan
   `payment_status` sekarang berarti membuat kolom yang tidak akan pernah diisi kode mana pun —
   dan pengguna yang melihatnya akan mengira sistem memantau sesuatu.

## 6. Kepemilikan domain yang dibutuhkan

**Ini pertanyaan, bukan jawaban.** Yang bisa dikatakan dari sisi Sales hanyalah: pemiliknya
**bukan Sales**, dan pemiliknya harus **satu**, bukan tersebar.

Yang harus ditetapkan Architecture Guardian: nama domainnya, batas wewenangnya, peran mana yang
boleh memutasi data keuangan, dan siapa yang boleh **melihat** tanpa boleh **mengubah**.

## 7. Entitas yang dibutuhkan — sebagai KEBUTUHAN, bukan rancangan

Daftar ini menyebut **kebutuhan yang terbukti dari alur**, bukan tabel yang harus dibuat.
Bentuk akhirnya milik Architecture Guardian.

| Kebutuhan | Kenapa terbukti dibutuhkan |
|---|---|
| Pencatatan penerimaan uang | tanpa ini, "lunas" tidak punya sumber |
| Piutang per pelanggan | tanpa ini, "tertunggak" tidak punya sumber |
| Tagihan ke pelanggan (invoice) | **belum tentu perlu** — lihat Pertanyaan 3 |
| Verifikasi pembayaran | pemisahan tugas: pencatat ≠ pemverifikasi |
| Rekonsiliasi | menghubungkan kewajiban ↔ tagihan ↔ pembayaran |
| Jatuh tempo | `due_offset_days` sudah **disimpan** di kewajiban, belum ada yang **menghitungnya** |

## 8. Sumber kebenaran yang dibutuhkan

| Hal | Sumber kebenaran | Keadaan |
|---|---|---|
| Aturan pembayaran | `payment_terms` + `payment_term_steps` | **ADA**, milik Sales |
| Komitmen per order | `sales_order_payment_obligations` (beku) | **ADA**, milik Commercial Transaction |
| Uang yang benar-benar masuk | **belum ada** | **HILANG** |
| Piutang | **belum ada** | **HILANG** |
| Status pembayaran | **turunan** dari dua baris di atas | **TIDAK BISA DIHITUNG** hari ini |

## 9. Kontrak lintas domain

Kontrak **K-06 (Sales ↔ Finance)** tercatat di
`docs/00-GOVERNANCE/FABRIX_CROSS_DOMAIN_CONTRACTS.md` sebagai **BELUM ADA**.

Bentuk yang **diusulkan untuk ditinjau** (bukan diputuskan):
Sales **menghasilkan** kewajiban → Finance **mencatat** pembayaran dan piutang → Sales
**MEMBACA** status turunannya. Satu arah untuk kebenaran, dua arah untuk visibilitas.

## 10. Implikasi keamanan

- Setiap fungsi keuangan baru wajib **gagal tertutup**: identitas, tenant, `company_id`, peran,
  izin, dan kepemilikan diperiksa **sebelum** data keuangan tersentuh.
- **Nol fungsi baru boleh bisa dipanggil `anonymous`** tanpa alasan arsitektur tertulis.
  PostgreSQL memberi izin pakai ke `PUBLIC` pada **setiap** fungsi baru — pencabutannya harus
  eksplisit. Ini bukan kehati-hatian teoretis: kelalaian yang sama pernah membuat pemanggil
  **tanpa login** berhasil membuat Sales Order (SEC-21).
- Sales: **boleh membaca** visibilitas keuangan turunan. Sales: **tidak boleh memutasi** data
  Finance. Finance: pemilik mutasi keuangan.

**Keadaan hari ini pada tiga tabel payment (terukur):** `terapkan_payment_terms` hanya bisa
dipanggil `postgres`, `authenticated`, `service_role` — **`anon` dan `PUBLIC` tidak ada dalam
daftar**.

## 11. Implikasi mesin status

- Kewajiban pembayaran **sengaja tidak punya kolom status**. Status pembayaran harus
  **DITURUNKAN**, bukan disimpan — sejalan dengan AD-01 dan DEC-S11 yang sudah berlaku untuk
  status produksi dan pengiriman.
- Penyelesaian Sales Order (`completed`) **terhalang** sampai status pembayaran punya sumber.
- **Jangan menambahkan status pembayaran ke mesin status Sales Order** sebelum Finance ada:
  status yang tidak pernah dipicu adalah cacat, dan itu sudah tiga kali terjadi di proyek ini.

## 12. Integrasi pembayaran

Belum ada dan **belum boleh dibangun**. `invoices.payment_gateway_ref` yang ada milik
**penagihan langganan FABRIX ke tenant**, bukan jalur pembayaran pelanggan tenant.

## 13. Hubungan dengan Invoice

**Belum ditentukan.** Apakah tagihan pelanggan diperlukan sebagai entitas tersendiri adalah
**Pertanyaan 3**. Yang pasti: `invoices` yang ada **tidak boleh dipakai ulang** untuk itu.

## 14. Hubungan dengan Receivable

**Belum ditentukan.** Apa yang **melahirkan** piutang — tagihan terbit, pengiriman, Sales Order,
atau milestone kontrak — adalah **Pertanyaan 4**, dan **jangan ditebak**. Keempat pemicu itu
menghasilkan angka piutang yang berbeda di bulan yang sama.

## 15. Verifikasi pembayaran

Belum ada. Prinsip yang sudah mengikat di proyek ini dan akan berlaku otomatis: **pemeriksa ≠
pelapor**, dan konflik pemisahan tugas dideteksi **saat penugasan peran**, bukan lewat laporan
bulanan.

## 16. Rekonsiliasi

Belum ada. Yang perlu direkonsiliasi kelak: kewajiban (ada) ↔ tagihan (belum ada) ↔ pembayaran
(belum ada) ↔ piutang (belum ada). **Tiga dari empat belum ada**, sehingga rekonsiliasi belum
punya bahan.

## 17. Jatuh tempo

`due_offset_days_snapshot` **sudah dibekukan** di setiap baris kewajiban. Yang belum ada adalah
**titik nolnya** — offset dihitung sejak kapan: tanggal tagihan, tanggal kirim, atau tanggal
konfirmasi order. Itu **Pertanyaan 8**.

## 18. Umur piutang (aging)

Belum ada, dan **tidak bisa ada** sebelum §17 dijawab: umur piutang adalah selisih terhadap
jatuh tempo, dan jatuh tempo belum punya titik nol.

## 19. Visibilitas Sales

Kelak Sales perlu melihat: Payment Terms · jadwal · kewajiban · status pembayaran · jumlah
terbayar · sisa · tunggakan.

**Empat pertama sudah ada dan nyata. Tiga terakhir belum punya sumber.**

**Yang berlaku sekarang, dan sudah dipatuhi:** layar **tidak boleh mengarang** nilainya.
Halaman Sales Order hari ini menampilkan kolom *Tahap · Kapan ditagihkan · Porsi · Nilai* —
**nol kolom "Terbayar" dan nol kolom "Sisa"** — disertai kalimat menetap di bawah tabelnya:

> *"Ini komitmen pembayaran, bukan catatan pembayaran. FABRIX belum mencatat penerimaan
> pembayaran, jadi berapa yang sudah dibayar dan berapa yang tertunggak belum bisa ditampilkan
> di sini."*

**Menampilkan `Rp0` atau "Outstanding" hari ini akan menyesatkan**, karena nol yang berarti
"belum ada datanya" tidak bisa dibedakan dari nol yang berarti "memang belum dibayar".

## 20. Visibilitas PPIC / Delivery

**Belum ditentukan** — Pertanyaan 12 dan 13. Terkait erat dengan **Pertanyaan 14**: apakah
pelunasan menggerbangi pengiriman.

**Batas yang sudah berlaku hari ini:** tahap `sebelum_kirim` pada termin pembayaran **hanya
menyatakan KAPAN suatu tagihan jatuh**, dan **tidak memiliki** status pengiriman. Pengiriman
tetap milik Delivery/Logistics. Terukur: nol baris kode pada ketiga tabel payment yang menulis
ke `shipments`; satu-satunya sebutan "shipment" di migrasinya adalah **komentar** yang mencatat
arti tahap itu terhadap mesin status pengiriman yang sudah ada:

```
-- sebelum_kirim : sebelum transisi shipments draft -> shipped (ada hari ini)
```

## 21. Implikasi keputusan / persetujuan

Keputusan keuangan yang berkonsekuensi **wajib** memakai mekanisme Decision Record kanonik yang
**sudah ada** (`status_transition_log` yang diperluas + `decision_reason_categories`).

**DILARANG membuat `finance_decision_log`.** Contoh keputusan yang termasuk: pembebasan
pembayaran, penyesuaian piutang, keputusan pelunasan, persetujuan keuangan, pengecualian
pembayaran, keputusan pengembalian dana, penghapusan piutang.

## 22. Implikasi migrasi

- **Nol tabel keuangan pelanggan boleh dibuat** sebelum FIN-02 diputuskan.
- Migrasi hanya untuk **struktur dan master semua tenant** — nol baris berisi nama, alamat, atau
  angka milik satu perusahaan.
- Kewajiban pembayaran yang sudah lahir **tidak boleh ditulis ulang** oleh migrasi Finance kelak.
  Ia **snapshot komitmen komersial**, bukan cache yang boleh disegarkan.

## 23. Implikasi pengujian

Test yang **wajib lahir bersama** Finance, bukan sesudahnya:

1. Sales **tidak bisa** memutasi data Finance (uji penolakan, **menyebut lapisan mana** yang
   menolak).
2. Status pembayaran **diturunkan**, bukan disimpan — mengubah pembayaran mengubah tampilan
   Sales **tanpa** kolom status di sisi Sales.
3. Kewajiban historis **tidak berubah** ketika Payment Term Master diubah.
4. Pembayaran sebagian, kelebihan bayar, dan pembalikan **tidak merusak** total kewajiban.
5. Isolasi antar tenant pada seluruh tabel keuangan baru.
6. Selalu ada **kasus berhasil yang berwenang** berdampingan dengan kasus ditolak — penjaga yang
   menolak semua orang tidak boleh menyamar jadi penjaga yang benar.

## 24. Keputusan arsitektur yang masih terbuka

**24 pertanyaan di bawah. Tidak satu pun dijawab di dokumen ini** — dan itu disengaja.

---

# PERTANYAAN UNTUK ARCHITECTURE GUARDIAN

> **Dilarang dijawab sendiri oleh Claude Code maupun oleh sisi Sales.**

| # | Pertanyaan |
|---|---|
| 1 | Apa entitas Finance kanonik untuk **piutang pelanggan**? |
| 2 | Apa entitas Finance kanonik untuk **pembayaran pelanggan yang sesungguhnya**? |
| 3 | Apakah **Customer Invoice** diperlukan? Bila ya: siapa pemiliknya dan apa hubungannya dengan Sales Order? |
| 4 | Apa yang **melahirkan piutang** — tagihan terbit, pengiriman, Sales Order, atau milestone kontrak? **JANGAN DITEBAK.** |
| 5 | Apa yang **melahirkan kewajiban pembayaran** — Sales Order, Invoice, Contract, atau Payment Term? Jelaskan hubungannya. |
| 6 | Bagaimana Finance **mengonsumsi** Payment Obligation milik Sales? |
| 7 | Bagaimana Finance melaporkan **Paid · Outstanding · Overdue · Partially Paid**? |
| 8 | Apa mekanisme **jatuh tempo** kanonik (titik nol offset-nya dari mana)? |
| 9 | Bagaimana **rekonsiliasi** pembayaran bekerja? |
| 10 | Bagaimana Finance **memaparkan status pembayaran turunan** ke Sales? |
| 11 | Informasi keuangan apa yang boleh dilihat **Sales**? |
| 12 | Informasi keuangan apa yang boleh dilihat **PPIC**? |
| 13 | Informasi keuangan apa yang boleh dilihat **Delivery**? |
| 14 | Apakah **pelunasan menggerbangi pengiriman**, dan bila ya, bagaimana bentuk kontraknya? |
| 15 | Apa yang terjadi bila **pembayaran nyata berbeda** dari kewajiban? |
| 16 | Bagaimana **pembayaran sebagian** direpresentasikan? |
| 17 | Bagaimana **kelebihan bayar** direpresentasikan? |
| 18 | Bagaimana **pengembalian dana (refund)** ditangani? |
| 19 | Bagaimana **pembalikan pembayaran (reversal)** ditangani? |
| 20 | Bagaimana **penyesuaian piutang** ditangani? |
| 21 | Bagaimana **Sales Order yang dibatalkan** tercermin di kewajiban keuangan? |
| 22 | Bagaimana **amandemen Sales Order** tercermin di kewajiban keuangan? |
| 23 | Apa hubungan antara **Payment Terms · Payment Obligation · Invoice · Payment · Receivable · Reconciliation**? |
| 24 | Keputusan keuangan mana yang **wajib** memakai Decision Record DEC-S10? |

---

## Sampai keputusan itu diambil

**FIN-02 tetap OPEN. BD-10 tetap BLOCKED.**

**DILARANG** membuat: `sales_receivables` · `sales_payments` · `sales_invoices_for_customer` ·
`customer_payment_status` · `customer_ledger` · `sales_ar` · tabel pembayaran sementara · tabel
pembayaran "future-ready" — atau entitas lain yang secara fungsi mengambil alih Finance.

---

# PENGGOLONGAN & DAFTAR FINAL PERTANYAAN (29 Agustus 2026, malam)

**Nol pertanyaan dihapus.** 24 pertanyaan di atas tetap berlaku; di sini ditambahkan
**golongan** tiap pertanyaan dan **sebelas pertanyaan baru** yang muncul setelah pemilik produk
mengunci aturan penyelesaian order dan gerbang pembayaran.

**Kenapa digolongkan:** supaya **tidak ada pertanyaan teknis yang disodorkan ke pemilik produk**,
dan tidak ada pertanyaan bisnis yang diputuskan sendiri oleh arsitek. Salah alamat pada dua arah
itu sama-sama menghasilkan keputusan yang tidak sah.

| Kode | Golongan | Dijawab oleh |
|---|---|---|
| **A** | BUSINESS DECISION | **Pemilik produk** |
| **B** | ARCHITECTURE DECISION | **Architecture Guardian** |
| **C** | FINANCE DOMAIN REQUIREMENT | Architecture Guardian + Finance |
| **D** | CROSS-DOMAIN CONTRACT | **Architecture Guardian** |
| **E** | IMPLEMENTATION DETAIL | Claude Code, **setelah** A–D ditetapkan |

## Pertanyaan 1–24 — dengan golongannya

| # | Pertanyaan (ringkas) | Gol. | Catatan |
|---|---|---|---|
| 1 | Entitas kanonik **piutang** | **B** | |
| 2 | Entitas kanonik **pembayaran nyata** | **B** | |
| 3 | Apakah **Customer Invoice** diperlukan? Pemilik & hubungannya dengan SO | **B** | perlunya = A; bentuk & kepemilikan = B |
| 4 | Apa yang **melahirkan piutang** | **A** | menentukan **arti angka piutang** — wajib pemilik produk |
| 5 | Apa yang **melahirkan kewajiban pembayaran** | **B** | hari ini: Sales Order |
| 6 | Bagaimana Finance **mengonsumsi** Payment Obligation | **D** | |
| 7 | Bagaimana Finance melaporkan Paid/Outstanding/Overdue/Partially Paid | **C** | termasuk cara menghitung **outstanding balance** |
| 8 | Mekanisme **jatuh tempo** (titik nol offset) | **A** | menentukan arti "terlambat" |
| 9 | Bagaimana **rekonsiliasi** bekerja | **C** | |
| 10 | Bagaimana Finance **memaparkan status turunan** ke Sales | **D** | |
| 11 | Informasi keuangan apa yang boleh dilihat **Sales** | **A** | kebijakan hak akses = wilayah pemilik produk |
| 12 | ...oleh **PPIC** | **A** | |
| 13 | ...oleh **Delivery** | **A** | |
| 14 | Apakah pelunasan **menggerbangi pengiriman** | **D** | **bagian bisnisnya sudah TERJAWAB** (mengikuti termin transaksi); sisanya bentuk kontrak |
| 15 | Bila **pembayaran nyata berbeda** dari kewajiban | **A** | |
| 16 | **Pembayaran sebagian** | **C** | siklusnya sudah terkunci: UNPAID → PARTIALLY PAID → PAID |
| 17 | **Kelebihan bayar** | **C** | |
| 18 | **Pengembalian dana** | **C** | kebijakannya A, mekanismenya C |
| 19 | **Pembalikan pembayaran** | **C** | |
| 20 | **Penyesuaian piutang** | **C** | |
| 21 | **Sales Order dibatalkan** → kewajiban keuangan | **A** | akibat keuangannya **milik Finance**, nol logika refund di Sales |
| 22 | **Amandemen Sales Order** → kewajiban keuangan | **A** | bergantung DEC-S08 |
| 23 | Hubungan Terms · Obligation · Invoice · Payment · Receivable · Reconciliation | **B** | |
| 24 | Keputusan keuangan mana yang wajib **DEC-S10** | **B** | daftar awal sudah disusun, perlu disahkan |

## Pertanyaan 25–35 — baru, lahir dari aturan gerbang & penyelesaian order

| # | Pertanyaan | Gol. |
|---|---|---|
| 25 | Bagaimana Finance memberi **otorisasi/pelunasan ke Produksi**? | **D** |
| 26 | Bagaimana Finance memberi **otorisasi/pelunasan ke Pengiriman**? | **D** |
| 27 | Bagaimana **payment allocation** terhadap kewajiban dilakukan (uang masuk menutup tahap yang mana)? | **C** |
| 28 | Bagaimana **kaitan transaksi/versi** dilakukan pada catatan keuangan? | **B** |
| 29 | Bagaimana **otorisasi lintas domain** dilakukan secara umum? | **B** |
| 30 | Bagaimana **keadaan pembayaran historis** dipertahankan saat nilai berubah? | **B** |
| 31 | Bagaimana integrasi Finance dilakukan **tanpa** sumber kebenaran ganda? | **B** |
| 32 | Bagaimana **umur piutang (aging)** dihitung? | **C** |
| 33 | Bagaimana **milestone pembayaran diterjemahkan menjadi gerbang**? | **D** |
| 34 | **Siapa** yang memutuskan **payment clearance**? | **B** |
| 35 | Bagaimana **pengecualian gerbang pembayaran** diotorisasi? | **A + B** |

**Ringkasan golongan (35 pertanyaan):** A = 8 · B = 11 · C = 9 · D = 6 · E = 0, ditambah **satu pertanyaan bergolongan ganda** (35 = A + B). Dihitung dari kolom golongan di kedua tabel.
**Nol pertanyaan bergolongan E** — dan itu wajar: detail implementasi belum boleh ada
pertanyaannya sebelum A sampai D ditetapkan.

## Daftar penemuan kapabilitas (20 butir)

Dipakai sebagai **cakupan minimum** penyelidikan Finance — **bukan daftar yang harus dibangun**.
Keadaan terukurnya ada di `FIN-02_ARCHITECTURE_RECONCILIATION.md` §4:

Customer Invoice · Receivable · Payment · Payment Allocation · Payment Milestone · Due Date ·
Partial Payment · Overpayment · Underpayment · Payment Reversal · Refund · Credit Balance ·
Aging · Outstanding Balance · Payment Verification · Payment Reconciliation · Payment Clearance ·
Financial Adjustment · Write-off · Customer Account Statement.

**Dua di antaranya bertanda SEBAGIAN** (Payment Milestone, Due Date): bahannya ada di sisi Sales,
**pemrosesnya tidak ada** di sisi Finance. Bahan tanpa pemroses bukan kapabilitas.
