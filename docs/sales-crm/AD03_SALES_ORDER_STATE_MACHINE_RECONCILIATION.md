# AD-03 — REKONSILIASI MESIN STATUS SALES ORDER

**Tanggal:** 30 Agustus 2026 · **Sifat:** AUDIT + USULAN ARSITEKTUR
**KEPUTUSAN DIAMBIL 30 Agustus 2026 — OPSI A DIJALANKAN.** Bagian di bawah dipertahankan apa
adanya sebagai jejak audit; hasil akhirnya ada di bagian **KEPUTUSAN & PELAKSANAAN** di paling bawah.
**Menggantikan** analisis ringkas di `AD-03_ARCHITECTURE_PROPOSAL.md` (isinya diperluas, bukan dibuang).

## 1. Ringkasan eksekutif

Jarak **11 vs 4** bukan sebelas status yang hilang, melainkan **satu kesalahpahaman tentang
ENTITAS mana yang memiliki status mana**.

Diukur dari basis data dan kode, bukan dari dokumen:

- **5 status awal registry sudah ada — di ENTITAS SEBELUMNYA**, yaitu PO Klien dan tabel
  persetujuannya. Sales Order **lahir sesudah** kelimanya selesai; itu sebabnya ia lahir
  langsung `confirmed`.
- **3 status registry milik DOMAIN LAIN** (produksi & pengiriman) dan menurut AD-01 memang
  **tidak boleh disimpan** di Sales.
- **3 status memang sudah ada** dan dipakai.

**Usulan**: pertahankan **4 status tersimpan**, akui **5 status di PO Klien**, dan tegaskan
**3 status turunan** sebagai turunan — bukan kolom.

## 2. Bukti AS-IS

| Sumber | Isi terukur |
|---|---|
| `sales_orders_status_check` | `confirmed` · `in_production` · `completed` · `cancelled` |
| `status_transition_rules` (sales_orders) | `confirmed→in_production` · `confirmed→cancelled` · `in_production→completed` · `in_production→cancelled` · **`confirmed→completed`** (ditambah PJL-03) |
| `customer_purchase_orders_status_check` | `new` · `on_hold` · `cancelled` · `processed` |
| `customer_po_approvals.status` | `pending` · `approved` · `rejected` |
| Penulis status SO di seluruh sistem | `putuskan_pembatalan()` → `cancelled` · `selesaikan_sales_order()` → `completed` |
| Penulis `in_production` | **NIHIL** — tidak ada satu pun kode yang menulisnya |
| Turunan eksekusi | `turunkanEksekusiSo()` — produksi & pengiriman **dihitung saat dibaca** |
| Dokumen arsitektur Sales §15 | DRAFT → SUBMITTED → VALIDATING → PENDING_APPROVAL → CONFIRMED → IN_FULFILLMENT → PARTIALLY_FULFILLED → FULFILLED → CLOSED, terminal CANCELLED & REJECTED |

## 3. Status yang ada

**Tersimpan di Sales Order (4):** `confirmed` · `in_production` · `completed` · `cancelled`.
**Tersimpan di PO Klien (4):** `new` · `on_hold` · `cancelled` · `processed`.
**Tersimpan di persetujuan (3):** `pending` · `approved` · `rejected`.
**Turunan, tidak tersimpan:** produksi (`belum`/`direncanakan`/`berjalan`/`selesai`) ·
pengiriman (`belum`/`sebagian`/`penuh`).

## 4. Inventaris status (11 nama registry)

| Status | Sumber | Implementasi sekarang | Pemilik | Arti | Tersimpan/Turunan | Domain | Pemilik transisi | Pemicu | Ketergantungan | Bukti | Konflik |
|---|---|---|---|---|---|---|---|---|---|---|---|
| DRAFT | dok §15 | **PO Klien `new`** | Sales | belum diajukan | tersimpan | Sales | Sales | pembuatan PO | — | `customer_purchase_orders` | nama beda, hal sama |
| SUBMITTED | dok §15 | **PO Klien `new` + baris approval `pending`** | Sales | menunggu ditinjau | tersimpan | Sales | Sales | pembuatan PO | approvals | `customer_po_approvals` | tidak terpisah dari DRAFT |
| VALIDATING | dok §15 | **tidak ada sebagai status** | — | tahap pemeriksaan | — | — | — | — | — | nol kolom | **tidak diimplementasikan** |
| PENDING_APPROVAL | dok §15 | **`customer_po_approvals.pending`** (3 departemen) | Approval | menunggu 3 departemen | tersimpan | Sales/Approval | departemen berwenang | approve/reject | peran | fungsi approval | — |
| CONFIRMED | dok §15 | **`sales_orders.confirmed`** | Sales | komitmen komersial sah | tersimpan | Sales | `process_customer_purchase_order` | 3 persetujuan | PO Klien | kekangan + fungsi | — |
| IN_FULFILLMENT | dok §15 | **turunan** `produksi`/`pengiriman` | Manufacturing + Logistik | sedang dikerjakan | **turunan** | lintas domain | — | WO & pengiriman | — | `turunkanEksekusiSo` | `sales_orders.in_production` ADA tapi **tidak pernah ditulis** |
| PARTIALLY_FULFILLED | dok §15 | **turunan** `pengiriman='sebagian'` | Logistik | terkirim sebagian | **turunan** | Logistik | — | `qty_shipped` | — | `turunkanEksekusiSo` | — |
| FULFILLED | dok §15 | **turunan** `pengiriman='penuh'` | Logistik | terkirim penuh | **turunan** | Logistik | — | `qty_shipped` | — | `turunkanEksekusiSo` | — |
| CLOSED | dok §15 | **`sales_orders.completed`** | Sales | order ditutup | tersimpan | Sales | `selesaikan_sales_order` | konfirmasi PPIC + pimpinan | pemenuhan | PJL-03 | nama beda |
| CANCELLED | dok §15 | **`sales_orders.cancelled`** | Sales | dibatalkan | tersimpan | Sales | `putuskan_pembatalan` | keputusan pimpinan | permintaan | PJL-11 | — |
| REJECTED | dok §15 | **`customer_po_approvals.rejected`** | Approval | ditolak saat persetujuan | tersimpan | Sales/Approval | departemen berwenang | reject | — | fungsi approval | ada di **entitas sebelumnya** |

## 5. Klasifikasi kepemilikan

| Golongan | Status |
|---|---|
| **A. SALES-OWNED** | CONFIRMED · CLOSED (`completed`) · CANCELLED · DRAFT/SUBMITTED (di PO Klien) |
| **B. APPROVAL** | PENDING_APPROVAL · REJECTED · *(VALIDATING — tidak ada)* |
| **C. MANUFACTURING-DERIVED** | IN_FULFILLMENT (bagian produksi) |
| **D. FULFILLMENT-DERIVED** | gabungan produksi + pengiriman (dasar kelayakan penutupan) |
| **E. SHIPMENT-DERIVED** | PARTIALLY_FULFILLED · FULFILLED |
| **F. FINANCE-DERIVED** | *(tidak ada di daftar 11 — dan memang jangan ditambahkan sebelum Finance ada)* |
| **G. DOMAIN LAIN** | — |

## 6. Tersimpan vs turunan

| Tersimpan (sah) | Turunan (tidak boleh jadi kolom) |
|---|---|
| `confirmed` · `completed` · `cancelled` | produksi · pengiriman · pemenuhan |
| PO Klien: `new` · `on_hold` · `processed` · `cancelled` | status pembayaran (Finance, belum ada) |
| Persetujuan: `pending` · `approved` · `rejected` | |

**`in_production` adalah kasus batas**: ia **tersimpan secara skema** tetapi **turunan secara
kenyataan** — nol kode menulisnya. Inilah inti keputusan AD-03.

## 7. Transisi yang ada

```
Sales Order : confirmed → in_production*      confirmed → completed     confirmed → cancelled
              in_production* → completed      in_production* → cancelled
PO Klien    : new → on_hold      on_hold → new      new → processed      new/on_hold → cancelled
Persetujuan : pending → approved | rejected
```
`*` jalur yang aturannya ada tetapi **tidak pernah bisa terjadi** — tidak ada penulisnya.

## 8. Transisi yang hilang

| Hilang | Akibat |
|---|---|
| `completed → cancelled` | order yang sudah ditutup tidak bisa dibatalkan — **sengaja**, dan sesuai "jangan menulis ulang sejarah" |
| `cancelled → *` | pembatalan final — **sengaja** |
| Pemicu `→ in_production` | status ada, jalannya tidak — **inti AD-03** |

## 9. Transisi yang bertentangan

**Nol transisi bertentangan ditemukan.** Yang ada adalah **status tanpa pemicu**
(`in_production`), dan itu masuk kelas cacat proyek "status yang terdaftar tapi tidak pernah
dicapai" — sudah tiga kali terjadi.

## 10. Ketergantungan lintas domain

| Butuh | Dari |
|---|---|
| Kelayakan penutupan | Manufacturing (`work_orders.status`) + Logistik (`qty_shipped`) |
| Tampilan kemajuan | keduanya, **diturunkan** |
| Gerbang pembayaran | Finance — **belum ada** (K-07/K-08) |

## 11. Usulan kanonik

**Opsi A — DIREKOMENDASIKAN.** Tiga status tersimpan: `confirmed` · `completed` · `cancelled`.
`in_production` **dicabut dari kekangan** dan digantikan sepenuhnya oleh turunan yang sudah
berjalan.
*Untung*: nol status tanpa pemicu; sejalan AD-01/DEC-S11.
*Rugi*: perlu migrasi kekangan; **wajib** memastikan nol baris memakainya (**terukur: nol**).

**Opsi B.** Pertahankan empat, dan **beri pemicu** kepada `in_production` (ditulis saat Work
Order pertama berjalan).
*Rugi*: melahirkan **sumber kebenaran kedua** untuk fakta milik Manufacturing — melanggar AD-01.

**Opsi C.** Pertahankan apa adanya, terima status mati.
*Rugi*: cacat "status tak pernah dicapai" dibiarkan hidup.

## 12. Matriks transisi (usulan Opsi A)

| Dari \ Ke | confirmed | completed | cancelled |
|---|---|---|---|
| **confirmed** | — | ✅ `selesaikan_sales_order` | ✅ `putuskan_pembatalan` |
| **completed** | ❌ | — | ❌ |
| **cancelled** | ❌ | ❌ | — |

## 13. Otorisasi

| Transisi | Wewenang | Prasyarat |
|---|---|---|
| → `confirmed` | 3 persetujuan departemen | PO Klien `new` |
| → `completed` | **kepemimpinan**, setelah konfirmasi **PPIC** | pemenuhan lengkap |
| → `cancelled` | **kepemimpinan**, atas permintaan | pemohon ≠ pemutus |

## 14. Syarat jejak keputusan

Setiap transisi wajib menghasilkan baris `status_transition_log` ber-pelaku, peran, departemen,
kategori alasan, dan catatan. **Sudah berlaku** untuk `completed` dan `cancelled`.
**Belum ada penulis** untuk `confirmed` (lahir dari fungsi, bukan tindakan manusia langsung) —
dicatat sebagai pertanyaan terbuka.

## 15. Implikasi migrasi

Opsi A butuh perubahan kekangan `CHECK`. **Prasyarat wajib**: nol baris berstatus
`in_production` — **terukur hari ini: nol** (nol Sales Order sama sekali di tenant nyata).
Aturan transisi lama yang menyebut `in_production` ikut dibersihkan. **Jangan dijalankan
sebelum keputusan diambil.**

## 16. Implikasi pengujian

Test yang harus lahir bersama keputusan: kekangan menolak status lama; turunan tetap benar;
kelayakan penutupan tidak berubah; jejak keputusan tetap terisi. Test PJL-03 yang ada
**tidak** bergantung pada `in_production`, jadi Opsi A tidak merusaknya.

## 17. Keputusan yang masih terbuka

1. **Opsi A / B / C** — milik Architecture Guardian.
2. Apakah `completed` diganti nama jadi `closed` mengikuti registry? (**Rekomendasi: jangan** —
   penggantian nama status yang sudah dipakai memerlukan migrasi data tanpa manfaat perilaku.)
3. Apakah `VALIDATING` benar-benar dibutuhkan, atau memang tidak pernah ada.
4. Siapa pelaku yang tercatat saat sebuah Sales Order lahir `confirmed`.

## 18. Rekomendasi

**Ambil Opsi A**, dan jalankan **hanya** saat tenant nyata masih nol Sales Order — jendela itu
**terbuka hari ini** dan akan tertutup begitu order pertama sungguhan dibuat. Setelah itu,
mencabut status memerlukan migrasi data historis.

> **STOP sesuai §25**: implementasi tidak diubah sebelum keputusan ini ditinjau.


---

# KEPUTUSAN & PELAKSANAAN — 30 Agustus 2026

## Keputusan

**OPSI A dijalankan**: `in_production` **DICABUT** sebagai status Sales Order.
**Nol status pengganti dibuat** — celahnya memang tidak perlu diisi, karena kemajuan produksi
sudah diturunkan dari Work Order sejak AD-01/DEC-S11.

## FINDING · AS-IS · EVIDENCE · TO-BE · GAP · OWNERSHIP · IMPACT · RECOMMENDATION · DECISION

**FINDING** — `sales_orders.in_production` adalah status yang **tidak pernah dicapai**.
**AS-IS** — terdaftar di kekangan `CHECK` dan di dua aturan transisi.
**EVIDENCE** — nol kode di seluruh repositori menulisnya; satu-satunya penulis status Sales
Order adalah `putuskan_pembatalan()` dan `selesaikan_sales_order()`; **nol baris** memakainya
di ketiga project.
**TO-BE** — tiga status tersimpan: `confirmed` · `completed` · `cancelled`.
**GAP** — status mati membuat pembaca mengira Sales menyimpan kemajuan produksi.
**OWNERSHIP** — kemajuan produksi milik **Manufacturing**, diturunkan saat dibaca.
**IMPACT** — nol data terdampak (nol baris); dashboard yang menyaring `in_production`
diselaraskan; label status di layar dibuang.
**RECOMMENDATION** — dijalankan sekarang, selagi jendelanya terbuka.
**DECISION** — **CLOSED**, dilaksanakan.

## Yang berubah

| Hal | Sebelum | Sesudah |
|---|---|---|
| Kekangan status | 4 nilai | **3 nilai** |
| Aturan transisi Sales Order | 5 baris | **2 baris** (`confirmed→completed`, `confirmed→cancelled`) |
| Label status di layar | 4 | **3** |
| Saringan dashboard | `in ('confirmed','in_production')` | `= 'confirmed'` |

**Pengaman migrasi**: bila ada satu saja baris berstatus `in_production`, migrasinya **gagal
keras** dengan menyebut jumlahnya — pencabutan tidak boleh membuat baris nyata melanggar
kekangannya sendiri.

## Yang TIDAK berubah

Turunan produksi/pengiriman (`turunkanEksekusiSo`) · kelayakan penutupan · jejak keputusan ·
`customer_purchase_orders` (4 status) · `customer_po_approvals` (3 status).

## Status registry yang masih terbuka

`VALIDATING` **tidak diimplementasikan** dan tidak diusulkan — belum ada bukti ia dibutuhkan.
Siapa pelaku yang tercatat saat Sales Order lahir `confirmed` **masih terbuka**.
