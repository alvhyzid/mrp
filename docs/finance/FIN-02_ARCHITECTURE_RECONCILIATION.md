# FIN-02 ARCHITECTURE RECONCILIATION

**Tanggal:** 29 Agustus 2026 (malam) · **Penyusun:** Claude Code
**Sifat:** REKONSILIASI — **nol kode, nol migrasi, nol tabel Finance**
**Dokumen induk:** `FIN-02_CUSTOMER_RECEIVABLE_DOMAIN_GAP.md` (paket penyelidikan)
**Penyerahan:** `docs/sales-crm/SALES_CRM_FIN02_ARCHITECTURE_HANDOFF.md`

---

## 1. Executive Summary

Pemilik produk menetapkan **empat aturan bisnis baru** yang mengunci hal-hal yang sebelumnya
terbuka. Rekonsiliasi ini menemukan bahwa **satu rantai penghambat yang tercatat di sembilan
tempat kini SALAH**, dan memperbaikinya adalah temuan terpenting batch ini.

**Yang berubah — dan ini melepas satu penghambat besar:**

> **Penyelesaian Sales Order TIDAK LAGI tergantung pada pembayaran.**
> Sebelumnya seluruh dokumen menyatakan: FIN-02 memblokir BD-10, dan BD-10 memblokir
> penyelesaian Sales Order. Dengan keputusan pemilik produk 29 Agu 2026, **rantai itu putus**:
> Sales Order boleh **COMPLETED** meski pelanggan masih punya tunggakan.

| Hal | Sebelum | Sesudah keputusan pemilik produk |
|---|---|---|
| **BD-01** (kapan order selesai) | **OPEN** | **TERKUNCI** — berbasis **pemenuhan**, bukan pembayaran |
| **BD-09** (toleransi kurang-kirim) | **OPEN** | **TERKUNCI** — **nol toleransi otomatis** |
| **BD-10** (kapan pembayaran terpenuhi) | OPEN, memblokir penyelesaian SO | **tetap OPEN/BLOCKED**, tapi **tidak lagi memblokir penyelesaian SO** |
| Penyelesaian Sales Order | **TERBLOKIR** | **SIAP DIBANGUN** — aturannya terkunci |

**Yang tetap:** FIN-02 **OPEN**, DEC-S05 **CLOSED**, progres **64%**.

**Yang lahir baru sebagai kebutuhan arsitektur:** **Gerbang Produksi** dan **Gerbang
Pengiriman** yang digerakkan milestone pembayaran — keduanya **belum boleh dibangun**, karena
verifikasi pembayaran belum punya pemilik.

## 2. Latest Evidence

Seluruhnya dari katalog basis data proyek nyata, **hanya membaca**, 29 Agustus 2026.

| Bukti | Hasil | Cara diperoleh |
|---|---|---|
| Ukuran skema | **96 tabel dasar** (tabel+view: 104) | `information_schema.tables`, `BASE TABLE`, skema `public` |
| Domain pembayaran pelanggan | **TIDAK ADA** | nol tabel `*payment*` di luar 3 milik Sales |
| Piutang pelanggan | **TIDAK ADA** | nol tabel `*receiv*` / `*piutang*` |
| Buku besar pelanggan | **TIDAK ADA** | nol `*ledger*` / `*journal*` / `*jurnal*` |
| Jatuh tempo pelanggan | **TIDAK ADA** | satu-satunya `due_date` milik `kpi_actions` |
| Rekonsiliasi pembayaran | **TIDAK ADA** | nol fungsi/tabel |
| `invoices` | **penagihan langganan FABRIX ke tenant** | FK ke `subscription_plans`, **nol kolom `customer_id`** |
| Kewajiban memuat keadaan pembayaran? | **TIDAK** | nol kolom `paid_amount`/`payment_date`/`payment_status`/`payment_reference` |
| Kewajiban historis beku? | **YA** | seluruh nilai `*_snapshot`; **nol trigger**; penjadwalan ulang **ditolak** |
| Tabel Finance dibuat batch ini | **NOL** | nol migrasi di giliran ini |
| Status Sales Order yang sah | `confirmed` · `in_production` · `completed` · `cancelled` | kekangan `CHECK` |
| Transisi yang sudah sah | `confirmed→in_production`, `in_production→completed`, keduanya `→cancelled` | `status_transition_rules` |

**Catatan penting dari baris terakhir:** transisi `in_production → completed` **sudah sah di
basis data**. Yang belum ada bukan jalurnya, melainkan **tindakan yang menggerakkannya**.

## 3. Current Finance Capability

Yang ada dan **benar-benar bekerja**: biaya SDM tiga golongan, baseline finansial terkunci,
Margin Watch, laba operasional, dan penagihan langganan FABRIX ke tenant (`invoices`).

Seluruhnya soal **BIAYA, MARGIN, dan tagihan FABRIX** — **nol** di antaranya menyentuh
**uang masuk dari pelanggan tenant**.

## 4. Missing Finance Capability

Daftar penemuan kapabilitas (**bukan daftar yang harus dibangun sekarang**), 20 butir:

| # | Kapabilitas | Ada? |
|---|---|---|
| 1 | Customer Invoice | **TIDAK** |
| 2 | Receivable | **TIDAK** |
| 3 | Payment | **TIDAK** |
| 4 | Payment Allocation | **TIDAK** |
| 5 | Payment Milestone | **SEBAGIAN** — pemicunya ada di termin, verifikasinya tidak |
| 6 | Due Date | **SEBAGIAN** — offset dibekukan, titik nolnya belum ditetapkan |
| 7 | Partial Payment | **TIDAK** |
| 8 | Overpayment | **TIDAK** |
| 9 | Underpayment | **TIDAK** |
| 10 | Payment Reversal | **TIDAK** |
| 11 | Refund | **TIDAK** |
| 12 | Credit Balance | **TIDAK** |
| 13 | Aging | **TIDAK** |
| 14 | Outstanding Balance | **TIDAK** |
| 15 | Payment Verification | **TIDAK** |
| 16 | Payment Reconciliation | **TIDAK** |
| 17 | Payment Clearance | **TIDAK** |
| 18 | Financial Adjustment | **TIDAK** |
| 19 | Write-off | **TIDAK** |
| 20 | Customer Account Statement | **TIDAK** |

**Dua yang bertanda SEBAGIAN adalah yang paling mudah salah baca**: keduanya punya *bahan* di
sisi Sales dan **nol pemroses** di sisi Finance. Bahan tanpa pemroses bukan kapabilitas.

## 5. Payment Terms

**Aturan komersial, milik Sales/Commercial. Sudah ada dan terverifikasi.**

Ia **spesifik per transaksi**: master boleh berubah, transaksi yang sudah memakainya tidak ikut
berubah. Empat pemicu yang sah: `konfirmasi_order` · `sebelum_produksi` · `sebelum_kirim` ·
`setelah_kirim_n_hari`.

**Payment Terms menentukan MILESTONE. Milestone dapat menentukan GERBANG AKTIVITAS** — dan
gerbangnya **mengikuti termin transaksi itu**, bukan aturan global.

## 6. Payment Obligation

**Komitmen komersial per Sales Order.** Ia menyatakan **APA YANG HARUS DIBAYAR**, dan hanya itu.

**Ia BUKAN**: buku besar pembayaran · saldo piutang · penerimaan kas · penyelesaian keuangan.

Beku dan historis, **terbukti secara struktural**: seluruh nilai termin disalin sebagai
snapshot, nol trigger, dan fungsi penjadwalan **menolak** menjadwal ulang Sales Order yang sudah
punya jadwal.

**Larangan yang tetap berlaku:** jangan menambahkan `paid_amount`, `payment_date`,
`payment_status`, atau `payment_reference` **hanya supaya tampilan terlihat lengkap**. Tampilan
yang lengkap di atas sumber yang tidak ada adalah tampilan yang berbohong.

## 7. Actual Payment

**Milik Finance. Belum ada.** Nol tabel, nol fungsi, nol kolom.

Konsekuensi yang harus disadari: pertanyaan "berapa yang sudah dibayar" hari ini **tidak punya
jawaban di sistem mana pun** — bukan jawabannya nol, melainkan **tidak ada tempat bertanya**.

## 8. Receivable

**Milik Finance. Belum ada.**

Apa yang **melahirkan** piutang belum ditentukan — tagihan terbit, pengiriman, Sales Order, atau
milestone kontrak. Keempatnya menghasilkan **angka piutang yang berbeda pada bulan yang sama**,
jadi ini tidak boleh ditebak.

## 9. Payment Verification

**Milik Finance. Belum ada.**

Ini yang membuat gerbang produksi dan gerbang pengiriman **belum bisa dibangun**: gerbang
membutuhkan jawaban "milestone ini sudah terpenuhi", dan **tidak ada pihak yang berwenang
menjawabnya**. Membiarkan Sales menjawabnya sendiri berarti penjual menyatakan uangnya sudah
masuk — dan itu melanggar pemisahan tugas.

## 10. Payment Clearance

**Belum ada. ARSITEKTUR MENUNGGU.**

Bentuk yang diajukan untuk ditinjau: Finance menerbitkan **sinyal pelunasan milestone** yang
**dibaca** Produksi dan Pengiriman. Sinyal, bukan salinan status; dan **satu arah**.

## 11. Production Gate

**Konsep terkunci oleh pemilik produk; implementasi MENUNGGU ARSITEKTUR.**

Bila termin transaksi memuat **"60% sebelum produksi"**, maka gerbang produksi membaca
**kebutuhan pembayaran** + **hasil verifikasi Finance**:

| Keadaan | Produksi |
|---|---|
| Milestone belum terverifikasi | **TERTAHAN — menunggu pembayaran** |
| Milestone terverifikasi | **BOLEH JALAN** |
| Termin tidak memuat syarat sebelum produksi | **BOLEH JALAN** — tidak ada gerbang |

**DILARANG membuat aturan global `belum bayar = terblokir`.** Gerbangnya lahir dari **termin
transaksi itu**, bukan dari kebijakan yang berlaku ke semua order.

**Pengecualian bukan tombol.** Sales **tidak boleh** melewati gerbang sendiri. Setiap
pengecualian butuh: wewenang · pemilik keputusan · pelaku · alasan · waktu · Decision Record ·
kaitan ke transaksi · bukti · otorisasi yang dihasilkan.

## 12. Shipment Gate

Sama bentuknya, beda pemicunya:

| Termin | Pengiriman |
|---|---|
| **"40% sebelum kirim"** | **TERTAHAN** sampai milestone itu **terverifikasi** |
| **"30 hari setelah kirim"** | **TIDAK tertahan** — tagihannya memang jatuh sesudah barang berangkat |

Ini contoh paling jelas kenapa aturan global salah: dua termin yang sah menghasilkan perilaku
**berlawanan** untuk keadaan "belum dibayar" yang sama persis.

**Batas yang sudah berlaku hari ini dan tidak boleh dilanggar:** kewajiban pembayaran **tidak
memiliki** status pengiriman. Pengiriman tetap milik Delivery/Logistics. Terukur: nol baris kode
pada tabel pembayaran yang menulis ke `shipments`.

## 13. Sales Order Completion

**ATURAN BISNIS TERKUNCI oleh pemilik produk, 29 Agustus 2026.**

Sales Order boleh **COMPLETED** meski pelanggan **masih punya tunggakan**.

**Syarat penyelesaian — seluruhnya soal PEMENUHAN, nol soal pembayaran:**

1. Seluruh kuantitas yang menjadi komitmen SO **telah diproduksi**.
2. Seluruh kuantitas yang harus dikirim **telah dikirim**.
3. PPIC/Fulfillment **mengonfirmasi** pemenuhan selesai.
4. Manager/GM melakukan **konfirmasi akhir** sesuai alur.

**Kombinasi yang SAH — ketiganya:**

| Sales Order | Pembayaran |
|---|---|
| COMPLETED | OUTSTANDING |
| COMPLETED | PARTIALLY PAID |
| COMPLETED | PAID |

**Kurang kirim TIDAK otomatis selesai, dan TIDAK ADA toleransi otomatis.** Dipesan 10.000,
terkirim 9.800, sisa 200 → **BELUM SELESAI**. Sisa komitmen tetap terlacak sampai **dipenuhi**
atau **dibatalkan secara sah**.

### Rekonsiliasi dengan AD-01 — tampak bertentangan, sebenarnya tidak

AD-01 menetapkan status eksekusi **DITURUNKAN**, bukan disimpan. Syarat 3 dan 4 di atas
menyiratkan sesuatu yang **disimpan**. Keduanya bisa berdiri bersama, dan begini caranya:

> **Kemajuan pemenuhan DITURUNKAN** dari produksi & pengiriman — ia fakta, dan fakta tidak perlu
> disalin. **Penutupan order adalah KEPUTUSAN** — ia tindakan sadar manusia, dan keputusan wajib
> tercatat beserta pelakunya.

Ini sejalan dengan aturan proyek yang sudah berlaku: *status mencatat KEPUTUSAN, bukan
menyimpulkan dari angka.* Order yang **angkanya** sudah terpenuhi **belum** otomatis selesai —
ia menunggu konfirmasi PPIC dan Manager/GM.

**Yang masih milik AD-03 dan belum diputuskan:** apakah `in_production` disimpan atau diturunkan,
dan penamaan status. Penyelesaian order **tidak menunggu AD-03** — transisi
`in_production → completed` sudah sah di basis data hari ini.

## 14. Cancellation Interaction

**ATURAN TERKUNCI, sudah berimplementasi** (PJL-11, 17 pemeriksaan).

Yang dibatalkan adalah **komitmen**, bukan sejarah. Sales **mengajukan**; Manager/GM
**memutuskan**; pemohon **tidak bisa** memutus permintaannya sendiri.

**Yang WAJIB tetap utuh:** produksi · pengiriman · pemakaian bahan · persediaan · pembayaran ·
riwayat keputusan.

**Akibat keuangan dari pembatalan adalah milik Finance.** **DILARANG** membuat logika
pengembalian dana di sisi Sales.

**Kaitan dengan §13:** sisa komitmen yang tidak akan pernah dipenuhi **diselesaikan lewat
pembatalan yang sah**, bukan lewat toleransi diam-diam. Itu sebabnya "nol toleransi otomatis"
tidak membuat order menggantung selamanya — ia memaksa keputusan yang tercatat.

## 15. Domain Ownership

| Peran | Domain |
|---|---|
| **Menetapkan aturan** pembayaran | Sales / Commercial |
| **Memverifikasi** pembayaran | **Finance** |
| **Menyatakan** status pembayaran | **Finance** |
| **Menerbitkan** pelunasan (clearance) | **Finance** |
| **Menjalankan** produksi | Manufacturing |
| **Menjalankan** pengiriman | Delivery / Logistics |
| **Menyetujui** pengecualian | wewenang sesuai tata kelola |

**Jangan menyatukan semuanya menjadi persetujuan Sales.** Sales **tidak boleh** memutasi status
pembayaran. Manufacturing dan Delivery **tidak boleh mengarang** kebenaran pembayaran.

## 16. Source of Truth

| Hal | Sumber kebenaran | Keadaan |
|---|---|---|
| Payment Terms | `payment_terms` + `payment_term_steps` | **ADA** · Sales |
| Payment Obligation | `sales_order_payment_obligations` (beku) | **ADA** · Commercial Transaction |
| Pemenuhan (diproduksi/dikirim) | produksi & pengiriman, **diturunkan** | **ADA** · Manufacturing & Logistics |
| Penutupan Sales Order | **keputusan tercatat** | **BELUM DIBANGUN** — aturannya terkunci |
| Actual Payment | — | **HILANG** · Finance |
| Receivable | — | **HILANG** · Finance |
| Payment Status | **turunan** dari dua baris di atas | **BELUM BISA DIHITUNG** |

## 17. Cross-Domain Contract

| Kode | Kontrak | Keadaan |
|---|---|---|
| **K-06** | Sales → kewajiban; Finance → pembayaran & piutang; Sales **membaca** status turunan | **BELUM ADA** |
| **K-07** | Finance → **pelunasan milestone** → Produksi (gerbang produksi) | **BELUM ADA — arsitektur menunggu** |
| **K-08** | Finance → **pelunasan milestone** → Pengiriman (gerbang pengiriman) | **BELUM ADA — arsitektur menunggu** |
| **K-09** | Pemenuhan (Manufacturing + Logistics) → **penutupan Sales Order** | **ATURAN TERKUNCI, kontrak belum ditulis** |

Ketiga kontrak baru mengikuti aturan yang sama: **satu arah untuk kebenaran, dua arah untuk
visibilitas**, dan **status milik domain lain diturunkan, tidak disalin**.

## 18. Decision Record

Memakai mekanisme kanonik yang **sudah ada** — `status_transition_log` yang diperluas +
`decision_reason_categories`. **DILARANG membuat `finance_decision_log`.**

Keputusan berkonsekuensi yang relevan: pengecualian pembayaran · pembebasan pembayaran ·
produksi sebelum DP · pengiriman sebelum pembayaran · pembatalan · amandemen komersial ·
otorisasi keuangan lain.

**Yang harus bisa direkonstruksi:** SIAPA · APA · KAPAN · KENAPA · ATAS APA · KEADAAN SEBELUM ·
KEADAAN SESUDAH · BUKTI · TRANSAKSI/VERSI.

**Pemilik keputusan ≠ pelaku** — dan inilah **syarat DEC-S10 pertama yang masih kurang**: hari
ini hanya **pelaku** yang tercatat. Dua syarat lain: rujukan versi transaksi, dan bukti pendukung.

## 19. Security

Keadaan keamanan kewajiban pembayaran **diverifikasi ulang batch ini dan tidak dilemahkan**:

- `terapkan_payment_terms` hanya bisa dipanggil `postgres`, `authenticated`, `service_role` —
  **`anon` dan `PUBLIC` tidak ada** (dibaca dari `proacl`, bukan dari niat migrasi).
- Isolasi tenant lewat `company_id` + RLS tetap berlaku.
- **Nol jalur mutasi Finance publik** dibuat batch ini — nol fungsi baru sama sekali.

Aturan untuk Finance kelak: **nol fungsi boleh dipanggil `anonymous`** tanpa alasan arsitektur
tertulis. PostgreSQL memberi izin `PUBLIC` pada setiap fungsi baru secara bawaan; pencabutannya
harus eksplisit (pelajaran SEC-21, kerentanan yang terbukti nyata).

## 20. Blockers

| Penghambat | Pemilik | Kenapa menghambat | Ketergantungan | Keputusan yang dibutuhkan | Workstream terdampak |
|---|---|---|---|---|---|
| **FIN-02** | Architecture Guardian → Finance | Sumber kebenaran pembayaran & piutang pelanggan tidak ada | — (akar) | Kepemilikan domain + entitas kanonik | WS-CUSTOMER-PAYMENT · WS-CUSTOMER-RECEIVABLE |
| **BD-10** | Finance | "Kewajiban terpenuhi" tidak punya tempat berpijak | FIN-02 | Kapan pembayaran dinyatakan terpenuhi | Status pembayaran · tampilan tunggakan |
| **Payment Clearance** | Finance | Belum ada pihak yang berwenang menyatakan milestone lunas | FIN-02 · BD-10 | Bentuk kontrak pelunasan | K-07 · K-08 |
| **Production Gate** | Manufacturing (membaca Finance) | Gerbang butuh verifikasi yang belum ada pemiliknya | Payment Clearance | Bentuk & wewenang pengecualian | Otorisasi produksi |
| **Shipment Gate** | Delivery (membaca Finance) | Sama, untuk pengiriman | Payment Clearance | Bentuk & wewenang pengecualian | Otorisasi pengiriman |
| **SO Completion** | Sales (aturan) + PPIC/Manager (konfirmasi) | **TIDAK LAGI TERHALANG PEMBAYARAN** — aturan bisnisnya sudah terkunci | alur konfirmasi PPIC & Manager/GM | *(tidak ada — sudah diputuskan)* | PJL-03 |
| **Finance Contract (K-06)** | Architecture Guardian | Kontrak lintas domain belum ditulis | FIN-02 | Bentuk kontrak | Visibilitas keuangan Sales |

**Baris yang paling penting dibaca: SO Completion.** Ia **keluar** dari daftar yang menunggu
keputusan, dan masuk ke daftar yang **siap dikerjakan**.

## 21. Architecture Guardian Questions

24 pertanyaan final, **sudah digolongkan** menurut siapa yang berhak menjawab — lihat
`FIN-02_CUSTOMER_RECEIVABLE_DOMAIN_GAP.md`, bagian *Penggolongan pertanyaan*.

**Nol pertanyaan dijawab sendiri di dokumen ini.**

## 22. Recommended Next Sequence

1. **Bangun penutupan Sales Order** (PJL-03). **Tidak menunggu Finance** — aturannya terkunci,
   transisinya sudah sah, dan sisanya adalah alur konfirmasi PPIC + Manager/GM beserta jejak
   keputusannya. *Batch ini tidak mengerjakannya, sesuai perintah berhenti.*
2. **Keputusan FIN-02** oleh Architecture Guardian — kepemilikan domain & entitas kanonik.
3. **Kontrak pelunasan (K-07/K-08)** setelah verifikasi pembayaran punya pemilik.
4. **Gerbang produksi & pengiriman**, mengikuti termin transaksi — **bukan** aturan global.
5. **Layar termin pembayaran** (PJL-13), supaya terminnya bisa lahir tanpa perintah basis data.
6. **AD-03** — kosakata status, yang membuka amandemen Sales Order.

---

**Penutup.** Batch ini **nol kode, nol migrasi, nol tabel Finance**. Yang bertambah adalah
kejelasan: satu rantai penghambat yang keliru diperbaiki, dua keputusan bisnis terkunci, dan tiga
kontrak lintas domain baru diberi nama supaya bisa diputuskan — bukan dibangun diam-diam.
