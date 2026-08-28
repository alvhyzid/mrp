# SALES_CRM_ENTITY_RECONCILIATION

| Entitas aktual | Pemilik saat ini | Pemilik kanonik | Sumber kebenaran | Vonis |
|---|---|---|---|---|
| `customers` | Sales | Sales | tabelnya | **SESUAI** |
| `customer_delivery_addresses` | Sales | Sales | tabelnya | **SESUAI** — tanpa layar |
| `customer_purchase_orders` (+lines, +approvals) | Sales | Sales | tabelnya | **SESUAI** |
| `sales_orders` (+lines) | Sales | Sales | tabelnya | **SESUAI** |
| `sales_order_line_margin_snapshots` | Sales/Finance | Sales mengonsumsi Costing | snapshot | **SESUAI** — Sales **tidak** memiliki kebenaran biaya |
| `sales_order_line_feasibility_snapshots` | PPIC | Planning | snapshot | **SESUAI** |
| `shipments` (+lines, +POD) | Logistik | Delivery | tabelnya | **SESUAI** |
| `production_standard_samples` | Produksi | Produksi | tabelnya | **SESUAI** — bukan sampel penjualan |
| `work_orders` | PPIC | Planning/Manufacturing | tabelnya | **SESUAI** — Sales tidak membuatnya |

**Nol sumber kebenaran ganda. Nol entitas berpemilik salah. Nol entitas duplikat.**

## Yang hilang, dan pemiliknya bila kelak dibuat

| Entitas | Pemilik | Tahap |
|---|---|---|
| Contact (terpisah dari PO) | Sales | SALES-1 |
| CustomerProduct | Sales | SALES-1 |
| Lead · Opportunity | Sales | SALES-1 |
| Quotation | Sales | SALES-2 |
| SampleRequest | Sales | SALES-3 |
| Contract | Sales | diparkir |
| RMA · Complaint | Sales (komplain = **NCR tipe baru**, bukan entitas kedua) | SALES-5 |
| Commission | Sales | diparkir |

**Peringatan kepemilikan**: komplain pelanggan **tidak boleh** melahirkan sistem kedua —
tinjauan arsitektur menetapkannya sebagai tipe NCR yang sudah dimiliki Quality, dengan tautan
ke SO/pengiriman.
