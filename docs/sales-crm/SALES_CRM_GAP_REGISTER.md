# SALES_CRM_GAP_REGISTER

Golongan: **CORRECTION** · **COMPLETION** · **MIGRATION** · **REPLACEMENT** · **NEW CAPABILITY**

> Aturan yang ditegakkan: kapabilitas yang ADA tetapi rusak **tidak boleh** digolongkan
> NEW CAPABILITY.

## CORRECTION — kapabilitas sah, implementasinya salah/kurang

| ID | Gap | Bukti | Task terkait | Prioritas |
|---|---|---|---|---|
| **G-C01** | `sales_orders` punya 4 status; **nol kode** mengubahnya → SO tampak `confirmed` selamanya | grep seluruh repo: satu-satunya penulis `sales_orders` adalah `processCustomerPurchaseOrder` (insert + delete kompensasi) | **PJL-03** | **P1** |
| **G-C02** | Customer PO `on_hold` & `cancelled` tidak punya jalur aplikasi | CHECK 4 nilai; UI hanya buat & proses | — | P2 |
| **G-C03** | Pembuatan SO memakai **kompensasi manual**, bukan transaksi: bila insert baris gagal, SO dihapus lewat query kedua; bila delete itu gagal, tertinggal SO tanpa baris | `processCustomerPurchaseOrder.ts:159-169` | — | P2 |
| **G-C04** | `sales_order_lines` RLS aktif dengan **nol kebijakan** | pg_policy | — | P2 (gagal-tertutup, bukan bocor) |
| **G-C05** | Nol `invalidText` di seluruh 44 kontrol form Sales | sensus | **DS-25** | P2 |
| **G-C06** | Tiga `window.confirm` (`/customers` 1, `/sales-orders` 2) | sensus | **DS-06** | P2 |
| **G-C07** | 4 kegagalan yang tidak terlihat di halaman Sales | sensus `if (ok)` tanpa else | — | P2 |
| **G-C08** | Nomor SO dihitung dari jumlah baris tahun berjalan | — | **SLS-07** | P2 |

## COMPLETION — kapabilitas sah, fungsi wajibnya kurang

| ID | Gap | Bukti | Prioritas |
|---|---|---|---|
| **G-P01** | Baris PO & SO tanpa **UOM, tanggal janji, pajak, diskon, mata uang** | skema: 5 dan 6 kolom | P2 |
| **G-P02** | Nol **revisi/amendment** pada PO maupun SO | nol kolom versi | P2 |
| **G-P03** | Nol lampiran pada PO | skema | P3 |
| **G-P04** | `customer_delivery_addresses` lengkap di server, **nol layar** | 3 route nol pemanggil | P1 |
| **G-P05** | Kontak pelanggan tidak punya entitas — menempel di PO | kolom `pic_*` | P2 |

## MIGRATION

**NIHIL.** Tidak ada model yang perlu dipindahkan. Data komersial nyata: 1 pelanggan, 1 PO,
3 persetujuan — dan **nol** SO/pengiriman. Tidak ada data historis yang berisiko.

## REPLACEMENT

**NIHIL.** Nol implementasi terbukti tidak layak.

## NEW CAPABILITY — benar-benar belum ada

| ID | Kapabilitas | Tahap | Gerbang |
|---|---|---|---|
| G-N01 | Lead & Opportunity (CRM-lite) | SALES-1 | BL-01 |
| G-N02 | CustomerProduct / konfigurasi komersial | SALES-1 | BL-01 |
| G-N03 | Quotation + pricing waterfall | SALES-2 | BL-01 |
| G-N04 | Sample Request | SALES-3 | BL-01 |
| G-N05 | SO Change Request + dampak | SALES-4 | BL-01 |
| G-N06 | Komplain sebagai NCR + retur ringkas + KPI sales | SALES-5 | BL-01 |
| G-N07 | Contract / commercial agreement | **diparkir** | pemicu SLS-90 |
| G-N08 | Commission | **diparkir** | pemicu SLS-90 |

**Forecast TIDAK ada di daftar ini** — ia **ditolak**, bukan tertunda.
