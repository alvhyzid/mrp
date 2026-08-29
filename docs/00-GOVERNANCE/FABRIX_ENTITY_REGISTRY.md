# FABRIX ENTITY REGISTRY
## Canonical business vocabulary and ownership registry

Every major entity must have one canonical definition and owner.

Required fields:
- Entity ID
- Canonical name
- Business definition
- Domain owner
- UX contexts
- Source of truth
- Lifecycle/state owner
- Key relationships
- Immutable/snapshot requirements
- Cross-domain references
- Migration notes
- ADR reference if disputed

### Initial registry
Customer, Contact, Lead, Opportunity, Sample Request, Product, Item, SKU, Variant, Configuration, BOM, Formula, Routing, Operation, Specification, Revision, Engineering Change, Supplier, Purchase Requisition, RFQ, Purchase Order, Goods Receipt, Inventory, Warehouse, Location, Lot, Batch, Demand, MPS, MRP Run, Planned Order, Production Order, Work Order, Schedule, Quality Inspection, NCR, CAPA, Equipment, Maintenance Order, Delivery Order, Shipment, POD, Invoice, Payment, Costing, WIP.

### Naming rule
Do not create synonyms for existing canonical entities without an ADR.


---

# REGISTRI TERISI — 29 Agustus 2026

> Daftar di atas adalah **kosakata**: 45 nama entitas, tanpa satu pun pemilik, sumber
> kebenaran, atau pemilik siklus hidup. Bagian ini mengisinya untuk entitas yang
> **benar-benar ada di basis data**, dengan bukti. Entitas yang belum ada ditandai apa
> adanya — **bukan dikira sudah ada karena namanya tercantum di atas**.

**Kolom "Terpakai"** menjawab pertanyaan yang berbeda dari "Ada": ia menghitung baris nyata
di tenant PT Indo Taste. Entitas yang ada tetapi nol baris **belum pernah dipakai**.

## Komersial / Sales

| Entitas | Tabel | Pemilik | Sumber kebenaran | Terpakai |
|---|---|---|---|---|
| Customer | `customers` | **Sales** | tabel itu sendiri | 1 |
| Customer Delivery Address | `customer_delivery_addresses` | **Sales** | daftar master; **yang tercetak** = salinan beku di pengiriman | 0 |
| Customer PO | `customer_purchase_orders` | **Sales** | tabel + `status_transition_rules` | 1 |
| Customer PO Approval | `customer_po_approvals` | **tiap departemen** (finance/ppic/manager) | tabel | 3 |
| Sales Order | `sales_orders` | **Sales** (komersial saja) | `status` untuk komersial; eksekusi **diturunkan** | 0 |
| Payment Term | `payment_terms` · `payment_term_steps` | **Sales/Komersial** | tabel | 0 |
| Payment Obligation | `sales_order_payment_obligations` | **transaksi** (beku) | snapshot; **bukan** catatan pembayaran | 0 |
| Cancellation Request | `cancellation_requests` | **Sales** mengajukan, **Manager/GM** memutuskan | tabel | 0 |
| Lead · Opportunity · Quotation · Sample · Contract · Complaint/RMA | — | — | **TIDAK ADA** | — |
| Customer Product Code | — | — | **TIDAK ADA** (DEC-S04 closed, belum dibangun) | — |

## Produk & Rekayasa

| Entitas | Tabel | Pemilik | Terpakai |
|---|---|---|---|
| Item | `items` | **Product/Engineering** | 1 |
| BOM | `boms` · `bom_lines` | **Engineering** | 0 |
| Routing | `routings` · `routing_steps` | **Engineering** | 0 |

## Manufaktur & Perencanaan

| Entitas | Tabel | Pemilik | Terpakai |
|---|---|---|---|
| Work Order | `work_orders` | **Manufacturing** | 0 |
| Production Batch | `production_batches` | **Manufacturing** | 0 |
| Work Center | `work_centers` | Manufacturing/PPIC | — |
| Demand · MPS · MRP Run · Planned Order | — | — | **TIDAK ADA sebagai entitas** |

## Persediaan & Ketertelusuran

| Entitas | Tabel | Pemilik | Terpakai |
|---|---|---|---|
| Lot | `lots` | **Inventory/Warehouse** | 0 |
| Stock Movement | `stock_movements` | **Inventory** | — |
| Genealogy | jejak lot pada batch & pengiriman | **Traceability** | 0 |

## Pengadaan & Logistik

| Entitas | Tabel | Pemilik | Terpakai |
|---|---|---|---|
| Supplier | `suppliers` | **Procurement** | 0 |
| Purchase Order | `purchase_orders` · `purchase_order_lines` | **Procurement** | 0 |
| Goods Receipt | `goods_receipts` | **Warehouse** | 0 |
| Shipment | `shipments` · `shipment_lines` | **Logistics** | 0 |
| POD | `delivery_confirmations` | **Logistics** | 0 |

## SDM — satu-satunya domain dengan data nyata bermakna

| Entitas | Tabel | Pemilik | Terpakai |
|---|---|---|---|
| Employee | `employees` | **HR** | **30** |
| Attendance Event | `attendance_events` | **HR** | 0 |
| Employee Cost Category | `employee_cost_category_history` | **Finance** menetapkan, HR menyediakan fakta | — |

## Keuangan — **KOSONG, dan ini gap arsitektur**

| Entitas | Status |
|---|---|
| **Payment (penerimaan dari pelanggan)** | **TIDAK ADA** |
| **Receivable / piutang** | **TIDAK ADA** |
| Ledger · Journal · Jatuh tempo | **TIDAK ADA** |
| `invoices` | **ADA — dan BUKAN piutang pelanggan.** FK ke `subscription_plans`, kolom `period_start`/`period_end`/`payment_gateway_ref`, **nol** `customer_id`. Ini **FABRIX menagih tenant**-nya |

> **FIN-02.** Karena Finance tidak ada, status pembayaran **tidak bisa diturunkan** —
> dan itulah yang memblokir **BD-10**, gerbang produksi, serta gerbang pengiriman.
> Jangan membangunnya dari Sales.
>
> **KOREKSI 29 Agu 2026 (malam):** kalimat ini sebelumnya berbunyi *"...yang pada gilirannya
> memblokir penyelesaian Sales Order"*. **Itu tidak lagi benar.** Pemilik produk menetapkan
> penyelesaian Sales Order berbasis **PEMENUHAN**, bukan pembayaran — order boleh **COMPLETED**
> meski pelanggan masih menunggak.

## Platform & Jejak

| Entitas | Tabel | Pemilik |
|---|---|---|
| User & Role | `users.role` (teks ber-CHECK) | **Platform** |
| Decision Record | `status_transition_log` (**diperluas**: pelaku, peran, departemen, kategori alasan) | lintas domain |
| Data Change Audit | `data_change_audit_log` | lintas domain |
| Reason Catalogue | `decision_reason_categories` | master seluruh tenant |

> **Catatan yang wajib dibaca bersama tabel di atas:** FABRIX **tidak punya** tabel `roles`,
> `permissions`, `role_permissions`, maupun `departments`. Kepemilikan ditegakkan lewat
> **nama peran** di `src/lib/roles.ts` (diimpor 113 berkas) dan **161 kebijakan RLS** —
> bukan lewat entitas izin. Departemen **diturunkan dari peran**, bukan disimpan.


---

## Entitas baru 29 Agustus 2026 (malam)

| Entitas | Tabel | Pemilik | Isinya | Terpakai |
|---|---|---|---|---|
| Konfirmasi penutupan Sales Order | `sales_order_completion_approvals` | Sales (PJL-03) | keputusan **manusia** menuju penutupan: konfirmasi pemenuhan (ppic) dan penutupan (manager), beserta cuplikan pemenuhan sebagai penjaga data basi | 0 di tenant nyata |

**Yang sengaja BUKAN isinya**: fakta produksi dan pengiriman. Keduanya tetap milik Manufacturing
dan Logistik, dan **diturunkan saat dibaca** — tabel ini hanya menyimpan keputusan, bukan salinan
fakta domain lain.
