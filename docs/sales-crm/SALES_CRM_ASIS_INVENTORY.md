# SALES_CRM_ASIS_INVENTORY

> **AUDIT SAJA.** Nol perubahan sumber, nol migrasi, nol mutasi data. HEAD `138f8ec`.
> Kosakata status: `IMPLEMENTED` · `PARTIAL` · `DOCUMENTED ONLY` · `MISSING` · `CONFLICT` · `UNKNOWN`.

## Sembilan belas kapabilitas

| # | Capability | Entity | Owner | Source of Truth | Route | Page | API | Service | Database | Permission | Workflow | Test | Status | Confidence |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Customer / Account | `customers` | Sales | `customers` | `/customers` | CustomersPage | 4 route | `createCustomer` `updateCustomer` `listCustomers` `deleteOrArchiveCustomer` | ada, RLS 2 kebijakan | `canManageCustomerPo` | arsip/pulih | `supplier_customer_alur1` | **IMPLEMENTED** | HIGH |
| 2 | Contact | kolom `pic_*` di PO | Sales | PO | — | — | — | — | 4 kolom di `customer_purchase_orders` | — | — | — | **PARTIAL** — kontak menempel ke PO, bukan entitas | HIGH |
| 3 | Lead | — | Sales | — | — | nav `belum-ada` | — | — | — | — | — | — | **MISSING** | HIGH |
| 4 | Opportunity | — | Sales | — | — | nav `belum-ada` | — | — | — | — | — | — | **MISSING** | HIGH |
| 5 | Sample | `production_standard_samples` | Produksi | batch | — | — | 2 route | `learn-standard-sample` | ada | `canProposeProductionStandard` | usul/putus | — | **PARTIAL** — sampel STANDAR PRODUKSI, bukan sampel penjualan | HIGH |
| 6 | Product Configuration (komersial) | — | Sales | — | — | — | — | — | — | — | — | — | **MISSING** — CustomerProduct belum ada | HIGH |
| 7 | Pricing | `unit_price` per baris + `supplier_item_prices` | Sales / Purchasing | baris dokumen | — | di dalam Items | `supplier-item-prices` | `upsertSupplierItemPrice` | ada | — | — | — | **PARTIAL** — harga jual per pelanggan tidak ada master-nya | HIGH |
| 8 | Quotation | — | Sales | — | — | nav `belum-ada` | — | — | — | — | — | — | **MISSING** | HIGH |
| 9 | Contract | — | Sales | — | — | — | — | — | — | — | — | — | **MISSING** | HIGH |
| 10 | **Customer PO** | `customer_purchase_orders` + lines + approvals | Sales | tabelnya | `/customer-purchase-orders` | CustomerPurchaseOrdersPage | 4 route | 4 modul | 3 tabel, 3 pemicu | `canManageCustomerPo` `canQuickCreateCustomerPo` | 3 departemen | — | **IMPLEMENTED** | HIGH |
| 11 | **Sales Order** | `sales_orders` + lines | Sales | tabelnya | `/sales-orders` | SalesOrdersPage | 6 route | `listSalesOrders` `processCustomerPurchaseOrder` | 2 tabel + 2 snapshot, 2 pemicu | turunan PO | dari persetujuan PO | `margin_v1_acceptance` | **PARTIAL** — lihat §CONFLICT | HIGH |
| 12 | Demand Signal | Work Order | PPIC | `work_orders` | `/work-orders` | WorkOrdersPage | ada | ada | ada | ada | ada | ada | **IMPLEMENTED (di luar Sales)** | HIGH |
| 13 | Fulfillment Coordination | feasibility snapshot | PPIC | `sales_order_line_feasibility_snapshots` | `/sales-orders` | SalesOrdersPage | 2 route | `getPlanningFeasibility` `lockFeasibilityBaseline` | ada | — | kunci baseline | 2 test | **IMPLEMENTED** | HIGH |
| 14 | Delivery Coordination | `shipments` + lines + POD | Logistik | `shipments` | `/shipments` `/pod/[token]` | 3 halaman | 4 route | 6 modul | 4 tabel, 3 pemicu | `canManageShipments` | dispatch→POD | `shipments_physical_stage` | **IMPLEMENTED** | HIGH |
| 15 | Return / RMA | — | Sales | — | — | nav `belum-ada` | — | — | — | — | — | — | **MISSING** | HIGH |
| 16 | Customer Complaint | NCR (Quality) | Quality | NCR | — | nav `belum-ada` | — | — | NCR ada | — | — | — | **MISSING sebagai Sales** — NCR ada di Quality | MEDIUM |
| 17 | Commission | — | Sales | — | — | — | — | — | — | — | — | — | **MISSING** | HIGH |
| 18 | Sales Forecast | — | — | — | — | nav `ditolak` | — | — | — | — | — | — | **MISSING — DITOLAK sebagai konsep** (SLS-90) | HIGH |
| 19 | Sales Analytics | margin watch + KPI | Sales / Finance | snapshot margin | `/sales-orders` `/operating-profit` | 2 halaman | 3 route | `getMarginWatch` `lockMarginBaseline` | `sales_order_line_margin_snapshots` | — | kunci baseline | `margin_watch` | **PARTIAL** — margin ada, KPI sales belum | HIGH |

## Rekap

| Status | Jumlah |
|---|---|
| IMPLEMENTED | **5** (Customer, Customer PO, Fulfillment, Delivery, + Demand di luar Sales) |
| PARTIAL | **5** (Contact, Sample, Pricing, Sales Order, Analytics) |
| MISSING | **8** (Lead, Opportunity, Product Config, Quotation, Contract, RMA, Complaint, Commission) |
| MISSING — ditolak | **1** (Forecast) |

**Lima kapabilitas inti komersial sudah ada dan berjalan.** Yang hilang seluruhnya adalah
lapisan *pra-order* (lead → opportunity → sample → quotation → contract) dan *pasca-order*
(RMA, complaint, commission).
