# SALES_CRM_STATE_MACHINE_RECONCILIATION

**Temuan utama: aturan perpindahan status DITEGAKKAN DI BASIS DATA** lewat pemicu
`enforce_status_transition` — bukan hanya di aplikasi. Sepuluh pemicu aktif di tabel Sales.

| Tabel | Pemicu |
|---|---|
| `customer_purchase_orders` | `enforce_status_transition` · `audit_log_trigger` · `customer_purchase_orders_create_approvals` |
| `customer_po_approvals` | `enforce_status_transition` |
| `sales_orders` | `enforce_status_transition` · `audit_log_trigger` |
| `shipments` | `enforce_status_transition` · `audit_log_trigger` · `shipments_process_shipped` |
| `shipment_lines` | `enforce_shipment_line_qty_limit` |

## Customer PO

Status: `new` · `on_hold` · `cancelled` · `processed` (CHECK constraint).

| Transisi | Aktor | Jalur aplikasi | Vonis |
|---|---|---|---|
| → `new` | pembuat PO | modal 4 langkah | **IMPLEMENTED** |
| `new` → `processed` | setelah 3 persetujuan | tombol proses | **IMPLEMENTED** |
| `new` → `on_hold` | — | **tidak ada** | **CONFLICT (SC-02)** |
| `new` → `cancelled` | — | **tidak ada** | **CONFLICT (SC-02)** |

## PO Approval

Status `pending` · `approved` · `rejected`; departemen `finance` · `ppic` · `manager`.
`UNIQUE(po_id, department)` → tepat tiga baris per PO, dibuat otomatis pemicu.
Ketiga transisi punya jalur aplikasi. **IMPLEMENTED.**

## Sales Order — **KONFLIK TERBESAR**

Status: `confirmed` · `in_production` · `completed` · `cancelled`.

> **Hanya `confirmed` yang bisa dicapai.** Penyisiran seluruh repositori menemukan
> satu-satunya penulis `sales_orders` adalah `processCustomerPurchaseOrder.ts`, dan ia hanya
> melakukan `insert` serta `delete` kompensasi. **Nol `update` status di seluruh kode.**

Akibatnya: order akan tampak *dikonfirmasi* selamanya meski produksi dan pengiriman tuntas.
Pemicu penegak transisi **sudah ada di basis data** — yang hilang adalah sisi aplikasi.

**Kelas yang sama sudah tercatat tiga kali di `CLAUDE.md`** (tombol tanpa efek, status WO tak
tercapai, alert tak terpicu). Ini kejadian **kelima**. Task: **PJL-03**.

## Shipment

Ditegakkan pemicu; `shipments_process_shipped` memproses stok dan `qty_shipped` saat dikirim;
`enforce_shipment_line_qty_limit` menolak kirim melebihi pesanan. **IMPLEMENTED.**

## Quotation · Contract · RMA · Complaint · Commission
**MISSING** — entitasnya belum ada, jadi tidak ada state machine untuk direkonsiliasi.
