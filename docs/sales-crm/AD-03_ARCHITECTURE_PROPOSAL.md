> **DIPERLUAS 30 Agu 2026.** Analisis penuh beserta bukti terukur, matriks transisi, dan tiga
> opsi kanonik ada di `AD03_SALES_ORDER_STATE_MACHINE_RECONCILIATION.md`. Berkas ini
> **dipertahankan apa adanya** sebagai catatan usulan awal — bukan dihapus, supaya jejak
> pemikirannya tidak hilang.

<!-- Dipindahkan dari SALES_CRM_DECISION_PROPOSALS.md pada 29 Agu 2026 atas permintaan
     §30 perintah eksekusi, yang meminta berkas bernama sendiri per keputusan.
     ISINYA DIPINDAHKAN, bukan disalin -- supaya tidak lahir dua sumber untuk satu keputusan. -->

# AD-03 — Nama status Sales Order

## Problem
Registry tata kelola mencantumkan **11** state; basis data mencantumkan **4**. Registry
sendiri melarang penyalinan buta. §14 melarang menambah 7, menghapus 4, membuat hybrid,
maupun menduplikasi.

## Evidence
`docs/00-GOVERNANCE/FABRIX_STATE_MACHINE_REGISTRY.md` baris 15–17 ·
`sales_orders_status_check` = `confirmed | in_production | completed | cancelled` ·
`status_transition_rules` (4 aturan) · `status_transition_log` **0 baris**.

## Klasifikasi setiap status (§14)

| Nama di registry | Golongan | Dasar |
|---|---|---|
| `DRAFT` | **COMMERCIAL** | Sales belum mengajukan |
| `SUBMITTED` | **APPROVAL** | masuk alur persetujuan |
| `VALIDATING` | **APPROVAL** | tahap pemeriksaan |
| `PENDING_APPROVAL` | **APPROVAL** | menunggu tiga departemen |
| `CONFIRMED` | **COMMERCIAL** | ada hari ini |
| `IN_FULFILLMENT` | **PRODUCTION DERIVED** | menurut AD-01 bukan milik Sales |
| `PARTIALLY_FULFILLED` | **SHIPMENT DERIVED** | menurut AD-01 bukan milik Sales |
| `FULFILLED` | **SHIPMENT DERIVED** | menurut AD-01 bukan milik Sales |
| `CLOSED` | **COMMERCIAL** | penutupan komersial menurut BD-01 |
| `CANCELLED` | **COMMERCIAL** | terminal, ada hari ini |
| `REJECTED` | **APPROVAL** | hasil penolakan persetujuan, terminal |

| Nama di basis data | Golongan | Nasib yang diusulkan |
|---|---|---|
| `confirmed` | COMMERCIAL | **DIPERTAHANKAN** |
| `in_production` | **PRODUCTION DERIVED** | **BUKAN status tersimpan** — dihitung |
| `completed` | COMMERCIAL | **DIPERTAHANKAN**, setara `CLOSED` |
| `cancelled` | COMMERCIAL | **DIPERTAHANKAN** |

## Temuan yang mendamaikan keduanya

> **Lima state awal registry SUDAH DIIMPLEMENTASIKAN — pada entitas yang berbeda.**

`DRAFT` / `SUBMITTED` / `VALIDATING` / `PENDING_APPROVAL` / `REJECTED` seluruhnya hidup di
**PO Klien** dan `customer_po_approvals` (tiga departemen, `pending → approved | rejected`).
Sales Order **lahir setelah** kelimanya selesai — itu sebabnya ia lahir `confirmed`.

Jadi jarak 11-vs-4 **bukan** sebelas state yang hilang. Ia adalah **lima state di entitas
sebelumnya**, **tiga state yang menurut AD-01 milik domain lain**, dan **tiga yang memang
sudah ada**.

## Model yang diusulkan

**Sales Order menyimpan HANYA state komersial:**

```
confirmed  →  completed        (butuh BD-01: pemenuhan + PPIC + Finance + Manager/GM)
confirmed  →  cancelled        (BD-02/BD-03)
```

**Yang dihitung, tidak pernah disimpan:** kemajuan produksi (Work Order), kemajuan
pengiriman (Shipment), status pembayaran (Finance).

## Migration impact
Mencabut **dua** baris `status_transition_rules` yang menyangkut `in_production`, dan
mempertimbangkan mencabut `in_production` dari CHECK constraint. **Nol baris data
terdampak** — `status_transition_log` kosong dan tidak ada SO ber-status itu.

## UI / API / Test impact
UI: Tag status komersial + Tag eksekusi turunan **sudah** terpisah sejak WS-A — nol
perubahan tampilan diperlukan. API: `listSalesOrders` sudah mengirim `status` dan
`eksekusi` terpisah. Test: `status_eksekusi_sales_order` sudah menjaga penurunannya.

## Rekomendasi
**Perbarui registry mengikuti model di atas**, lalu kode mengikuti registry — sehingga
registry kembali jadi sumber tunggal. **Status: MENUNGGU KEPUTUSAN.**

---
