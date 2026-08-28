# SALES_CRM_CROSS_DOMAIN_FINDINGS

| Antarmuka | Produsen | Konsumen | Keadaan | Vonis |
|---|---|---|---|---|
| SO terkonfirmasi → Demand | Sales | PPIC (`work_orders`) | Work Order dibuat **manual** dari SO, bukan otomatis | **PARTIAL** — dan itu **benar** menurut batas domain |
| Perubahan SO → perubahan Demand | Sales | PPIC | **belum ada** perubahan SO | **MISSING** (SALES-4) |
| ATP/kelayakan ↔ Inventory/Planning | Planning | Sales | feasibility engine + snapshot + kunci baseline | **IMPLEMENTED** |
| Permintaan biaya/harga ↔ Costing | Costing | Sales | mesin margin dua tingkat | **IMPLEMENTED** |
| Komitmen kirim ↔ Logistik | Sales | Logistik | `shipments` menunjuk `sales_order_lines` | **IMPLEMENTED** |
| Status pengiriman → Sales | Logistik | Sales | `qty_shipped` dipelihara **pemicu** `shipments_process_shipped` | **IMPLEMENTED** |
| Status invoice → Sales | Finance | Sales | modul invoice belum ada | **MISSING** |
| Status pembayaran → Sales/Komisi | Finance | Sales | `payment_status` ada di PO, nol integrasi | **PARTIAL** |
| Status RMA → Sales | Sales | Sales | belum ada | **MISSING** |

## Batas domain — DIUJI, bukan diasumsikan

Pembuatan Sales Order diukur menulis **hanya** ke `sales_orders`, `sales_order_lines`, dan
status PO.

**Nol** tulisan ke: `work_orders` · `lots` · `stock_movements` · `production_batches` ·
invoice · akuntansi.

> **Sales Order adalah komitmen komersial, dan implementasinya memperlakukannya begitu.**
> Tidak ada pelanggaran batas yang ditemukan.

## Aturan SD yang menyentuh lintas domain

`SD-2` (SO tidak mengubah BOM) **BERLAKU & TERBUKTI** lewat snapshot BOM/routing.
`SD-13` (rujukan lintas domain tertelusur) **BERLAKU & TERBUKTI** lewat jejak lot.
`SD-3` `SD-4` `SD-5` berstatus **KOSONG, bukan terbukti** — pelakunya (peran `sales`,
konsep reservasi) belum ada. **Penjaganya wajib lahir bersama fiturnya.**
