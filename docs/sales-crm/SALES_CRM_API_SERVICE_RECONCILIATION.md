# SALES_CRM_API_SERVICE_RECONCILIATION

24 route API Sales/CRM · 23 modul server.

## Route tanpa pemanggil UI — 4

| Route | Metode | Vonis |
|---|---|---|
| `/api/customer-delivery-addresses` | GET POST PATCH | **CONFLICT** — kapabilitas tanpa layar |
| `/api/customer-delivery-addresses/[id]` | DELETE | sama |
| `/api/customer-delivery-addresses/[id]/restore` | POST | sama |
| `/api/sales-orders/[id]/margin` | GET | **PARTIAL** — margin dipakai lewat route per-baris |

## Batas transaksi — temuan

`processCustomerPurchaseOrder.ts` melakukan **tiga tulisan berurutan tanpa transaksi**:
insert SO → insert baris SO → update status PO. Bila insert baris gagal, SO dihapus lewat
**query kompensasi** (`baris 169`). Bila query kompensasi itu sendiri gagal, tertinggal
**Sales Order tanpa baris** — dan `UNIQUE(customer_purchase_order_id)` akan menolak percobaan
ulang. **SC-04**, prioritas P2.

## Idempotency

`idempotency_key` ada di PO dan SO dengan kunci unik per company. **IMPLEMENTED.**

## Otorisasi

Diperiksa di sisi server pada setiap modul (bukan hanya disembunyikan di UI):
`canManageCustomerPo` · `canQuickCreateCustomerPo` · `canManageShipments`.

## Event / outbox

**MISSING.** Tinjauan arsitektur menetapkan *outbox ringan* (`domain_events`) sebagai
pengganti event bus. Belum ada. Bukan penghalang hari ini — dicatat untuk SALES-4/5.
