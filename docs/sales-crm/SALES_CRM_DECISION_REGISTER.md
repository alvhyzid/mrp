# SALES_CRM_DECISION_REGISTER

**Diperbarui:** 29 Agustus 2026 · **Menjawab:** §14 perintah eksekusi

> **BACA DUA KOLOM, BUKAN SATU.** Keputusan **CLOSED** tidak berarti kapabilitasnya ada.
> Dari sembilan keputusan yang ditutup pemilik produk, **delapan belum berimplementasi** —
> dan itu keadaan yang normal, bukan kelalaian. Yang berbahaya adalah membacanya sebagai
> "sudah jadi".

## Baseline bisnis yang terkunci

| Kode | Keputusan | Keputusan | Implementasi | Bukti |
|---|---|---|---|---|
| **DEC-S02** | Quotation jadi dokumen komersial terstruktur & berversi | **CLOSED** · format menunggu tinjauan | **MISSING** | nol tabel/kolom |
| **DEC-S03** | Sample: Sales meminta, R&D mengerjakan, antrean & ketersediaan bahan terlihat | **CLOSED** | **MISSING** | `production_standard_samples` bukan ini |
| **DEC-S04** | Kode produk pelanggan berdampingan dengan kode internal | **CLOSED** | **MISSING** | nol tabel/kolom |
| **DEC-S05** | Payment terms → jadwal → kewajiban → pembayaran → piutang, berlapis | **CLOSED** | **PARTIAL — dua lapis komersial DONE/VERIFIED** | **dua lapis pertama ADA & terverifikasi** (`payment_terms`, `payment_term_steps`, `sales_order_payment_obligations`, 15 pemeriksaan + verifikasi peramban 6 lebar). Dua lapis terakhir **BUKAN milik Sales** — Actual Payment & Customer Receivable milik **Finance**, dan domainnya tidak ada. **Ketergantungan: FIN-02.** Penyerahan: `docs/finance/FIN-02_CUSTOMER_RECEIVABLE_DOMAIN_GAP.md` |
| **DEC-S06** | Commercial Agreement mengikat harga/volume/termin | **CLOSED sebagai kapabilitas TO-BE** | **MISSING** | nol tabel |
| **DEC-S07** | Komplain → investigasi → retur → disposisi → penggantian | **CLOSED** | **MISSING** | `delivery_confirmations` adalah POD |
| **DEC-S08** | Amandemen Sales Order, bukan edit senyap | **CLOSED** | **MISSING** | versi hanya di BOM/routing/dokumen |
| **DEC-S09** | Alamat pelanggan ≠ pelacakan pengiriman | **CLOSED sebagai konsep** | **IMPLEMENTED** | daftar master + pembekuan + pemilih |
| **DEC-S10** | Decision Record ≠ Audit Log | **CLOSED sebagai prinsip** | **PARTIAL** | 3 syarat belum ada |
| **DEC-S11** | Kepemilikan status antar domain | **CLOSED** | **IMPLEMENTED** | visibilitas eksekusi diturunkan |
| **DEC-S12** | `admin_staff` **BUKAN** Sales; peran Sales wajib ada | **CLOSED** | **IMPLEMENTED** | SEC-24, 16 pemeriksaan |
| **BD-02** | Wewenang membatalkan Sales Order | **CLOSED** | **IMPLEMENTED** | PJL-11, 17 pemeriksaan |
| **BD-03** | Pembatalan setelah WO / produksi | **CLOSED** | **PARTIAL** | keadaan eksekusi tercatat; alur tinjauan dampak formal belum |
| **BD-06** | Tahan / lepas / batalkan PO klien | **CLOSED** | **IMPLEMENTED** | PJL-08 + peran Sales |
| **BD-07** | Jejak keputusan wajib | **CLOSED** | **PARTIAL** | lihat DEC-S10 |
| **AD-01** | Sales tidak memiliki status produksi/pengiriman | **CLOSED** | **IMPLEMENTED** | eksekusi diturunkan, tidak disimpan |
| **AD-02** | Jalur kanonik pembuatan Sales Order | **CLOSED** | **IMPLEMENTED** | WS-S03, 11 pemeriksaan |
| **BD-01** | Kapan Sales Order dianggap **selesai** | **CLOSED** 29 Agu 2026 | **IMPLEMENTED** | berbasis **pemenuhan**, bukan pembayaran. Boleh COMPLETED meski menunggak. **PJL-03 selesai** — 23 pemeriksaan, empat mutasi menggigit, bukti peramban enam lebar |
| **BD-09** | Toleransi kurang-kirim | **CLOSED** 29 Agu 2026 | **IMPLEMENTED** | **nol toleransi otomatis**. Ditegakkan server dan diuji: 9.800 dari 10.000 ditolak, angkanya disebut di pesannya |
| **BD-11** | Status pembayaran **terpisah** dari siklus Sales Order | **CLOSED** 29 Agu 2026 | **N/A** | `UNPAID → PARTIALLY PAID → PAID`, tidak digabung dengan status SO |
| **DEC-S13** | Pelepasan darurat penghalang | **CLOSED** 30 Agu 2026 — **YA, wajib ada** | **IMPLEMENTED** | wewenang bernama sendiri, alasan wajib bercatatan, sejarah penahanan utuh. 15 pemeriksaan, 3 mutasi menggigit |
| **BD-12** | Gerbang aktivitas mengikuti **termin transaksi**, bukan aturan global | **CLOSED** 29 Agu 2026 | **MISSING** | "60% sebelum produksi" → gerbang produksi; "40% sebelum kirim" → gerbang kirim; "30 hari setelah kirim" → **tidak ada gerbang**. Implementasi menunggu FIN-02 |

## Masih terbuka

| Kode | Pertanyaan | Memblokir |
|---|---|---|
| **AD-03** | Kosakata status Sales Order: registry 11 vs implementasi 4 | penamaan status, amandemen |
| **BD-10** | Dari mana Finance menyatakan kewajiban pembayaran terpenuhi | **OPEN / BLOCKED BY FIN-02.** Menahan **status pembayaran** dan **gerbang produksi/pengiriman**. **TIDAK menahan penyelesaian Sales Order** (dikoreksi 29 Agu 2026 malam). **TIDAK ditutup** — sumber kebenaran pembayaran & piutang pelanggan belum ada |
| **DEC-S02 format** | Bentuk akhir quotation menunggu tinjauan pemilik produk | pembangunan quotation |

## Tiga syarat DEC-S10 yang belum terpenuhi

1. **Decision owner ≠ actor** — hari ini hanya **pelaku** yang tercatat, bukan **otoritas
   yang bertanggung jawab**. Bisa dikerjakan **tanpa menunggu apa pun**.
2. **Rujukan versi transaksi** — menunggu DEC-S08 (versi Sales Order belum ada).
3. **Bukti pendukung** — belum ada mekanismenya.

## Aturan membaca berkas ini

Sebuah baris baru boleh berpindah ke **IMPLEMENTED** bila ada **bukti yang dijalankan** —
test yang lulus **dan** mutasinya menggigit. Dokumentasi saja **tidak pernah** cukup.


---

## DEC-S05 — batas domain yang dicatat bersama keputusannya (29 Agu 2026)

Keputusan ini **CLOSED**, dan yang dicatat di sini adalah **batasnya**, supaya sesi berikutnya
tidak melanjutkannya ke wilayah yang bukan miliknya.

| Lapisan | Pemilik | Keadaan |
|---|---|---|
| Payment Terms | Sales / Commercial | **DONE / VERIFIED** |
| Payment Obligation / Schedule | Commercial Transaction | **DONE / VERIFIED** |
| **Actual Customer Payment** | **Finance** | **TIDAK DIBANGUN** — pemiliknya belum ada |
| **Customer Receivable** | **Finance** | **TIDAK DIBANGUN** — pemiliknya belum ada |
| **Payment Reconciliation** | **Finance** | **TIDAK DIBANGUN** |

**Yang DILARANG, dan larangannya tetap berlaku sampai FIN-02 diputuskan:** menambahkan
`paid_amount`, `payment_date`, `payment_status`, atau `payment_reference` ke kewajiban
pembayaran bila kolom itu mewakili **pembayaran yang sesungguhnya**. Kolom seperti itu akan jadi
**sumber kebenaran yang tak terjangkau** — terisi dari mana pun tidak jelas, dan tidak ada yang
berwenang membenarkannya.

**Diverifikasi 29 Agu 2026 langsung ke katalog kolom:** keempat kolom itu **tidak ada**.

### Aturan pembulatan — keputusan implementasi, bukan aturan Finance kanonik

Tahap terakhir **menyerap sisa pembulatan**; penjadwalan **dibatalkan** bila total kewajiban
tidak sama persis dengan nilai Sales Order.

Ini **KEPUTUSAN IMPLEMENTASI SAAT INI**, diambil karena tidak ada aturan pembulatan Finance yang
bisa dirujuk. **Bila Finance kelak menetapkan aturan berbeda, aturan Finance yang menang.**
Perbedaan ini dicatat sengaja supaya tidak kelak dikira "aturan akuntansi yang sudah baku".

### Kewajiban bersifat historis — terbukti, bukan diniatkan

Master termin berubah **60/40 → 50/50**; Sales Order lama **tetap 60/40**. Buktinya struktural:
seluruh nilai termin disalin sebagai `*_snapshot`, **nol trigger** pada ketiga tabel payment, dan
fungsi penjadwalan **menolak** menjadwal ulang Sales Order yang sudah punya jadwal.


---

## Aturan bisnis yang TERKUNCI 29 Agustus 2026 (malam) — dan apa yang berubah karenanya

Empat keputusan pemilik produk. Dicatat di sini **beserta akibatnya terhadap catatan lama**,
karena salah satunya membatalkan rantai penghambat yang sudah terlanjur ditulis di sembilan
tempat.

### 1. Penyelesaian Sales Order = PEMENUHAN, bukan pembayaran (BD-01)

Sales Order boleh **COMPLETED** meski pelanggan masih punya tunggakan. Syaratnya: seluruh
kuantitas komitmen **diproduksi**, seluruhnya **dikirim**, PPIC/Fulfillment **mengonfirmasi**,
Manager/GM **konfirmasi akhir**.

**SAH:** COMPLETED + OUTSTANDING · COMPLETED + PARTIALLY PAID · COMPLETED + PAID.

> **KOREKSI YANG DIBAWANYA.** Sebelumnya berkas ini dan delapan berkas lain mencatat bahwa
> **BD-10 memblokir penyelesaian Sales Order**. **Itu tidak lagi benar.** BD-10 tetap terbuka,
> tetapi yang ditahannya adalah **status pembayaran** dan **gerbang produksi/pengiriman** —
> bukan penutupan order.

### 2. Kurang kirim: nol toleransi otomatis (BD-09)

Sisa komitmen tetap terlacak sampai **dipenuhi** atau **dibatalkan secara sah**. Tidak ada
ambang yang diam-diam menganggap order selesai.

### 3. Status pembayaran terpisah dari siklus order (BD-11)

`UNPAID → PARTIALLY PAID → PAID`, berdiri sendiri. **Jangan digabung** dengan status Sales Order.

### 4. Gerbang mengikuti termin transaksi, bukan aturan global (BD-12)

**DILARANG** membuat aturan `belum bayar = terblokir` yang berlaku ke semua order: dua termin
yang sama-sama sah menghasilkan perilaku **berlawanan** untuk keadaan "belum dibayar" yang sama.

**Pengecualian bukan tombol.** Sales tidak boleh melewati gerbang sendiri; setiap pengecualian
butuh wewenang, pemilik keputusan, pelaku, alasan, waktu, Decision Record, kaitan transaksi,
bukti, dan otorisasi yang dihasilkan.

### Catatan penomoran

**BD-11 dan BD-12 adalah kode baru** yang diberikan di berkas ini untuk dua aturan yang
sebelumnya belum punya kode. Bila Architecture Guardian sudah memakai kode lain untuk keduanya,
kode di sini yang menyesuaikan — **bukan aturannya**.


---

## Rekonsiliasi 30 Agustus 2026 — FIN-02 · BD-10 · AD-03 · DEC-S13

| Kode | Hasil giliran ini |
|---|---|
| **FIN-02** | **Kontrak DIDEFINISIKAN** (`FIN02_SALES_FINANCE_PAYMENT_CONTRACT.md`, 22 bagian). Sisi Finance **tetap belum ada** — nol tabel dibuat. **Masih OPEN** |
| **BD-10** | **DIREKONSILIASI & DIVERIFIKASI**: disisir seluruh `src`, `app`, dan migrasi untuk pola *"belum lunas → tidak boleh selesai"* — **nol kejadian**. Pemisahan pembayaran vs penyelesaian **berlaku di kode, bukan hanya di dokumen** |
| **AD-03** | **AUDIT + USULAN** (`AD03_SALES_ORDER_STATE_MACHINE_RECONCILIATION.md`, 18 bagian). **Implementasi tidak diubah** — menunggu Architecture Guardian |
| **DEC-S13** | **DIBANGUN & TERVERIFIKASI** |

### Konflik yang ditemukan dan TIDAK ditambal buta

**`customer_purchase_orders.payment_status`** — ditampilkan di layar sebagai "Status bayar",
**tidak pernah ditulis kode mana pun**, nilainya selalu bawaan kolom `pending`. Ini persis kelas
"angka yang berbohong tanpa terlihat berbohong". Didokumentasikan penuh (FINDING/AS-IS/EVIDENCE/
TO-BE/GAP/OWNERSHIP/IMPACT/RECOMMENDATION/DECISION REQUIRED) dan dicatat sebagai **PJL-17**.


---

## Penutupan keputusan 30 Agustus 2026 — PJL-16 · PJL-17 · AD-03 · DEC-S13

| Kode | Keputusan | Implementasi |
|---|---|---|
| **PJL-16** | **CLOSED** — Sales Order boleh selesai **tanpa Work Order** bila dipenuhi dari stok/buffer yang sah | **IMPLEMENTED** — syarat Work Order dicabut; sumber pemenuhan diturunkan dari jejak lot |
| **PJL-17** | **CLOSED** — biarkan apa adanya, **jangan** membuat status pembayaran palsu | **PARKED** — menunggu Finance (FIN-02) |
| **AD-03** | **CLOSED** — cabut `in_production` | **IMPLEMENTED** — 4 status → **3** |
| **DEC-S13** | **CLOSED** — wewenang darurat **General Manager saja** | **IMPLEMENTED** — Company Admin ditolak |

### Kenapa PJL-17 diparkir, bukan dikerjakan

Satu-satunya cara "memperbaiki" tampilan status pembayaran hari ini adalah **mengarang
datanya** — dan itu persis yang dilarang. Pemicu bangun: domain Finance ada.

### Prinsip yang dikunci PJL-16

> **SO COMPLETED = komitmen komersial terpenuhi. BUKAN "harus ada Work Order".**

Dua jalur pemenuhan sama-sama sah: lewat **produksi**, dan lewat **stok yang sudah ada**.
Yang tetap wajib: **pengiriman 100%**, dan bila Work Order memang ada, **seluruhnya selesai**.


---

## Gerbang deployment 30 Agustus 2026

| Keputusan | Status | Catatan |
|---|---|---|
| **UAT di basis data production** | **DITOLAK** Architecture Guardian | penanda `UJI-` bukan batas keamanan |
| **Pilihan B — pisahkan lingkungan** | **DISETUJUI & DIJALANKAN** | INF-11 **PASS** |
| **Dorong ke `main` demi UAT** | **DILARANG** | commit kandidat tetap di lokal |
| **INF-03 deployment staging** | **TERBUKA** | butuh tindakan pemilik produk di Vercel |
