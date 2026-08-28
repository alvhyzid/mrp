# SALES_CRM_DATABASE_RECONCILIATION

13 tabel. Introspeksi langsung (baca-saja) atas kolom, constraint, RLS, dan pemicu.

## Kardinalitas — DIUKUR, bukan diasumsikan

> `sales_orders.customer_purchase_order_id` **NOT NULL** + **`UNIQUE`**
> → **1 PO ↔ tepat 1 SO.**

Konsekuensi yang harus disadari sebelum apa pun dibangun di atasnya:
- **tidak ada** 1 PO → banyak SO (split order),
- **tidak ada** 1 SO → banyak PO (konsolidasi),
- **tidak ada** SO tanpa PO (penjualan langsung),
- pemenuhan sebagian ditangani di tingkat **pengiriman**, bukan pemecahan order.

## Constraint

| Tabel | Kunci unik | CHECK |
|---|---|---|
| `customer_purchase_orders` | `(company_id, po_number)` · `(company_id, idempotency_key)` | status · payment_terms · payment_status |
| `customer_po_approvals` | `(po_id, department)` | departemen · status |
| `sales_orders` | `(customer_purchase_order_id)` · `(company_id, so_number)` · `(company_id, idempotency_key)` | status |
| `customer_purchase_order_lines` | — | — |
| `sales_order_lines` | — | — |

**Idempotency ada** di PO dan SO. **Pencegahan duplikat nomor ada.**

## Isolasi tenant

RLS **aktif di 10 dari 10** tabel Sales.

| Tabel | Kebijakan |
|---|---|
| `customer_purchase_orders` | 3 |
| `customers` · `customer_po_approvals` · `customer_delivery_addresses` · `sales_orders` · `shipments` · `shipment_lines` | 2 |
| `customer_purchase_order_lines` · `delivery_confirmations` | 1 |
| **`sales_order_lines`** | **0** |

`sales_order_lines`: RLS aktif tanpa kebijakan = **menolak semua** bagi klien non-service-role.
**Aman (gagal-tertutup), bukan bocor** — tetapi menyimpang dari sembilan tabel lain, dan akan
diam-diam mematahkan pembacaan langsung dari klien bila kelak ada.

## Yang TIDAK ada di model

Mata uang · pajak · diskon · UOM per baris · tanggal janji per baris · lampiran ·
revisi/amendment · konfigurasi produk · entitas kontak.

## Integritas & data historis

Data nyata: **1** pelanggan · **1** PO · **3** persetujuan · **0** SO · **0** pengiriman.
**Nol data historis berisiko.** Nol baris yatim mungkin terjadi karena FK lengkap.

**Nol migrasi destruktif dilakukan atau direncanakan di audit ini.**
