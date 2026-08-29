<!-- Dipindahkan dari SALES_CRM_DECISION_PROPOSALS.md pada 29 Agu 2026 atas permintaan
     §30 perintah eksekusi, yang meminta berkas bernama sendiri per keputusan.
     ISINYA DIPINDAHKAN, bukan disalin -- supaya tidak lahir dua sumber untuk satu keputusan. -->

# BD-10 — Dari mana Finance menyatakan pembayaran terpenuhi

## Problem
BD-01 mensyaratkan konfirmasi Finance bahwa kewajiban pembayaran **sesuai payment terms**
sudah terpenuhi. Finance **belum punya tempat untuk menyatakannya**.

## Evidence, disensus 29 Agu 2026

| Yang dicari | Yang ada |
|---|---|
| entitas penerimaan pembayaran **dari pelanggan** | **NIHIL** |
| tabel jatuh tempo / termin | **NIHIL** |
| tabel piutang | **NIHIL** |
| `payment_terms` | ada di `customer_purchase_orders`, nilainya `full` \| `tempo` |
| `payment_status` | ada di `customer_purchase_orders`: `pending` \| `partial` \| `confirmed` |

> **Satu tabel bernama `invoices` MEMANG ADA, dan ia BUKAN yang dicari.** Kolomnya —
> `subscription_plan_id`, `period_start`, `period_end`, `payment_gateway_ref` — menunjukkan
> ia untuk **FABRIX menagih tenant-nya sendiri** (langganan SaaS), bukan untuk PT Indo Taste
> menagih pelanggannya. Nol baris, nol pemakai di kode aplikasi.
> Dicatat di sini supaya sesi berikutnya tidak menyangka pertanyaan ini sudah terjawab
> hanya karena ada tabel yang namanya terdengar cocok.

`customer_purchase_orders.payment_status` **sudah ada** dan berisi tiga nilai. **Sensus
kode: nol jalur aplikasi yang mengubahnya** — pola yang sama persis dengan status PO klien
sebelum WS-S05.

## Yang TIDAK boleh dilakukan (§16)
**Jangan** membuat `sales_orders.paid = true`. Itu akan menjadikan Sales pemilik kebenaran
pembayaran — melanggar AD-01, dan menciptakan sumber kebenaran kedua yang akan menyimpang
dari catatan Finance yang sebenarnya.

## Pilihan

| | Model | Catatan |
|---|---|---|
| **A** | Finance menyatakan **per PO klien** lewat `payment_status` yang sudah ada | paling murah; `tempo` tidak punya tempat mencatat jatuh tempo |
| **B** | Entitas **penerimaan pembayaran** tersendiri, `payment_status` diturunkan darinya | benar secara akuntansi; pekerjaan domain Finance, bukan Sales |
| **C** | Konfirmasi **manual Finance** per Sales Order, dengan jejak keputusan | memakai fondasi WS-S04 apa adanya; tidak menjawab "berapa yang sudah dibayar" |

## Rekomendasi
**Opsi B adalah yang benar, dan ia BUKAN pekerjaan Sales.** Sales hanya boleh **membaca**
status pembayaran yang otoritatif. **Opsi C dapat menjadi jembatan sementara** — asalkan
dicatat tegas sebagai jembatan, bukan sebagai kebenaran pembayaran.

**MENUNGGU KEPUTUSAN ARSITEKTUR + PEMILIK PRODUK.**

---
