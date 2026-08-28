# SALES_CRM_ASIS_ARCHITECTURE_BASELINE

> AUDIT SAJA. HEAD `138f8ec`. Nol perubahan sumber, nol migrasi, nol mutasi data.
> Hierarki bukti yang dipakai: **runtime → basis data → route → API → uji → navigasi → dokumen.**

## 1. EXECUTIVE SUMMARY

Inti komersial FABRIX **sudah dibangun dan berkualitas lebih baik daripada yang diperkirakan
dokumen arsitektur v0.1**: Customer PO, persetujuan tiga departemen, Sales Order, feasibility,
margin, pengiriman, dan POD seluruhnya ada — dan **state machine-nya ditegakkan di DATABASE**,
bukan hanya di aplikasi.

Tiga hal yang menentukan seluruh laporan ini:

1. **Batas domain TIDAK dilanggar.** Diukur: pembuatan Sales Order menulis **hanya** ke
   `sales_orders`, `sales_order_lines`, dan status PO. **Nol** tulisan ke `work_orders`,
   `lots`, `stock_movements`, `production_batches`, invoice, atau akuntansi.
2. **Alurnya belum pernah berjalan tuntas.** Data nyata: 1 pelanggan · 1 PO · 3 persetujuan ·
   **0 Sales Order · 0 Work Order · 0 pengiriman**.
3. **Sales Order punya empat status; hanya satu yang bisa dicapai.** Tidak ada satu baris kode
   pun yang mengubah `sales_orders.status`.

## 2. AUDIT SCOPE

19 kapabilitas Sales/CRM · 6 halaman · 24 route API · 23 modul server · 13 tabel · 8 berkas uji.

## 3. EVIDENCE REVIEWED

| Jenis | Isi |
|---|---|
| RUNTIME | 4 halaman Sales × 3 lebar + modal dibuka; non-GET diblokir, **nol** terkirim |
| DATABASE | kolom, constraint, RLS, 10 pemicu, isi data nyata (baca-saja) |
| ROUTE/API | 24 route + pemakainya |
| CODE | 23 modul server, 6 halaman |
| TEST | 8 berkas uji terkait |
| DOCUMENT | v0.1, tinjauan v0.2, `CLAUDE.md` SD-1..13, registry task |

## 4–23. CAPABILITY INVENTORY

Lihat `SALES_CRM_ASIS_INVENTORY.md` — 19 kapabilitas dengan status dan bukti.

## 24–26. ENTITY & DATA MODEL

**13 tabel.** Yang inti:

| Tabel | Kolom | Constraint kunci |
|---|---|---|
| `customer_purchase_orders` | 21 | `UNIQUE(company_id, po_number)` · `UNIQUE(company_id, idempotency_key)` · CHECK status 4 nilai |
| `customer_purchase_order_lines` | **5** | FK saja — **tanpa** UOM, tanggal, pajak, diskon |
| `customer_po_approvals` | 7 | `UNIQUE(po_id, department)` · CHECK departemen {finance, ppic, manager} |
| `sales_orders` | 12 | **`UNIQUE(customer_purchase_order_id)`** · `UNIQUE(company_id, so_number)` · CHECK status |
| `sales_order_lines` | **6** | FK saja; `qty_shipped` dipelihara **pemicu** |

**Snapshot identitas mitra ADA** di PO dan SO (`customer_name_snapshot`,
`customer_billing_address_snapshot`, `customer_npwp_snapshot`) — PMB-07a terbukti.

**Yang TIDAK ada di model**: currency · tax · discount · UOM per baris · promised date ·
lampiran · revisi/amendment · konfigurasi produk.

## 27. STATE MACHINES

**Ditegakkan pemicu database `enforce_status_transition`** pada `customer_purchase_orders`,
`customer_po_approvals`, `sales_orders`, `shipments`.

| Entitas | Status | Bisa dicapai dari aplikasi? |
|---|---|---|
| Customer PO | `new` · `on_hold` · `cancelled` · `processed` | `new` (buat) · `processed` (proses). **`on_hold` dan `cancelled` tidak punya tombol.** |
| PO Approval | `pending` · `approved` · `rejected` | ketiganya ✓ |
| **Sales Order** | `confirmed` · `in_production` · `completed` · `cancelled` | **HANYA `confirmed`** |
| Shipment | ada, ditegakkan pemicu | ✓ (dispatch → POD) |

## 28–29. ROUTES / PAGES / UI BEHAVIOR

| Halaman | Baris | Kontrol | `invalidText` | Modal | `window.confirm` | `AreaNotifikasi` | Kegagalan diam |
|---|---:|---:|---:|---:|---:|---|---:|
| CustomersPage | 530 | 11 | **0** | 1 | **1** | tidak | 1 |
| CustomerPurchaseOrdersPage | 1120 | 21 | **0** | 1 (4 langkah) | 0 | **ya** | 3 |
| SalesOrdersPage | 1235 | 4 | **0** | 0 | **2** | tidak | 0 |
| ShipmentsPage | 1077 | 8 | 1 | 2 | 0 | tidak | 0 |

Runtime (3 lebar): **nol gulir menyamping, nol elemen melewati tepi, satu `h1`, nol lompatan
judul, nol galat konsol**. Modal "Tambah pelanggan baru" 10 kontrol **nol tanpa label**; modal
"Buat PO klien baru" bertahap **4 langkah**.

## 30. API / SERVICES

24 route. **Empat tanpa pemanggil UI**: tiga `customer-delivery-addresses` +
`/api/sales-orders/[id]/margin`.

## 31. PERMISSIONS

`canManageCustomerPo` · `canQuickCreateCustomerPo` · `canManageShipments` ·
`canProposeProductionStandard` · `canDecideProductionStandardProposal`.
RLS **aktif di 10 dari 10** tabel Sales. **`sales_order_lines` aktif tetapi NOL kebijakan** —
gagal-tertutup (aman), tetapi menyimpang dari sembilan tabel lain.

## 32. WORKFLOW / APPROVAL

Pemicu `customer_purchase_orders_create_approvals` membuat **tiga baris persetujuan otomatis**
saat PO dibuat. `UNIQUE(po_id, department)` menjamin tepat satu per departemen.

## 33–34. INTEGRATIONS & CROSS-DOMAIN

Lihat `SALES_CRM_CROSS_DOMAIN_FINDINGS.md`.

## 35. SOURCE-OF-TRUTH FINDINGS

Nol sumber kebenaran ganda ditemukan. Setiap kapabilitas punya satu pemilik.

## 36. ARCHITECTURE CONFLICTS

| ID | Konflik | Status |
|---|---|---|
| **SC-01** | `sales_orders` punya 4 status, **3 tidak bisa dicapai** — nol kode mengubah status | **CONFLICT** |
| **SC-02** | Customer PO `on_hold`/`cancelled` tidak punya jalur aplikasi | **CONFLICT** |
| **SC-03** | `sales_order_lines` RLS aktif, nol kebijakan | **PARTIAL** (gagal-tertutup) |
| **SC-04** | Pembuatan SO memakai kompensasi manual, bukan transaksi | **PARTIAL** |
| **SC-05** | `customer_delivery_addresses` lengkap di server, **nol layar** | **CONFLICT** |

## 37–43

Lihat `SALES_CRM_GAP_REGISTER.md`, `SALES_CRM_RISK_REGISTER.md`,
`SALES_CRM_CORRECTION_PLAN.md`.
