# Matriks Status Navigasi + Peta Sekarang vs Dituju + Daftar Konflik

**25 Agu 2026.** Menyandingkan sitemap §19 dokumen IA dengan apa yang benar-benar ada.
Status diisi **dari bukti audit** (`docs/ar0-inventaris-as-is.md`), bukan dari dokumen.

Taksonomi §3: 🔵 jadi + route terverifikasi · 🟢 jadi · 🟡 sebagian · 🟠 halaman ada belum
berfungsi · ⚪ arsitektur saja · 🔴 belum ada · ⚫ belum bisa dipastikan

> **Angka besarnya lebih dulu, supaya tidak tenggelam**: sitemap §19 memuat **± 200 item** di
> 15 workspace. Yang punya halaman terverifikasi: **32**. Sisanya ⚪ atau 🔴.
> **Sekitar 84% navigasi yang diusulkan dokumen belum punya apa pun di baliknya.**
> Ini bukan alasan mengecilkan rencana — pemilik produk sudah memutuskan seluruh item
> ditampilkan dengan penanda status. Ini alasan agar **penanda statusnya jujur**.

---

## Peta per workspace

### 1. Overview
| Item | Status | Route |
|---|---|---|
| Dashboard | 🔵 | `/dashboard` |
| My Work | 🔴 | — |
| Notifications | 🟡 | lonceng notifikasi ada di header, **halaman tidak ada** |
| Tasks & Approvals | 🟡 | persetujuan PO klien ada di dalam halamannya, **belum terkonsolidasi** |
| Recent Activity | 🔴 | — |

### 2. Control Tower
Sembilan item, **seluruhnya 🔴**. Tidak ada satu pun halaman. Dokumen sendiri menempatkannya
sebagai halaman kurasi yang menyusul (D.6).

### 3. Sales & CRM
| Item | Status | Route |
|---|---|---|
| Customers | 🔵 | `/customers` |
| Customer PO | 🔵 | `/customer-purchase-orders` |
| Sales Orders | 🔵 | `/sales-orders` |
| Delivery | 🔵 | `/shipments` |
| Leads · Opportunities · Contacts · Sample Requests · Quotations · Pricing · Returns/RMA · Complaints · Commission | 🔴 | — |

### 4. Product & Engineering
| Item | Status | Route |
|---|---|---|
| Items / SKU | 🔵 | `/items` |
| BOM | 🔵 | `/boms` |
| Routing | 🔵 | `/routing` |
| Products · Variants · Configurations · Parameters · Formula · Operations · Specifications · Revisions · Effectivity · Engineering Changes · Approvals | 🔴 | — |

### 5. Planning & APS
| Item | Status | Route |
|---|---|---|
| Scheduling / Gantt | 🟢 | di dalam `/ppic` |
| MRP / Material Requirements | 🟡 | kebutuhan bahan ada di dalam `/ppic` & `/work-orders` |
| **Sales Forecast** | ⛔ **DITOLAK** | keputusan tercatat (SLS-90) — **bukan "direncanakan"** |
| Scenario Planning · Pegging | ⚪ | diparkir |
| Demand Planning · Demand Review · MPS · Planned Orders · Capacity/RCCP · Exceptions | 🔴 | — |

### 6. Supply Chain
| Item | Status | Route |
|---|---|---|
| Stock Overview · Lots/Batches | 🟢 | di dalam `/warehouse` |
| Suppliers · Purchase Orders | 🟢 | di dalam `/purchasing` |
| Goods Receipt | 🟡 | ada endpoint `goods-receipts`, layarnya menempel di `/purchasing` |
| **Reservations** | 🔴 | **konsep reservasi belum ada sama sekali** (SD-5) |
| Stock by Warehouse · Stock Movement · Expiry · Warehouses · Locations · Receiving · Picking · Putaway · Transfer · Requisitions · RFQ · Supplier Quotations · Supplier Confirmation | 🔴 | — |

### 7. Manufacturing
| Item | Status | Route |
|---|---|---|
| Work Orders | 🔵 | `/work-orders` |
| Production Schedule | 🟢 | di dalam `/ppic` |
| Production Output · Material Consumption | 🟢 | di dalam `/production` |
| Scrap / Rework | 🟡 | `work_order_outputs` mencatatnya, layar khusus tidak ada |
| Production Orders · Dispatch Board · Production Operations · Subcontracting · Production Reports | 🔴 | — |

### 8. Quality
Sembilan item, **seluruhnya 🔴**. Catatan penting dari CLAUDE.md: **belum ada petugas QC
tersendiri** — tahap QC dikerjakan Spv Produksi yang merangkap. Membangun workspace Quality
penuh sekarang berarti membangun untuk peran yang belum ada.

### 9. Traceability
| Item | Status | Route |
|---|---|---|
| Lot / Batch Genealogy | 🟢 | tabel `lot_genealogy` terisi, **tidak ada layarnya** |
| Forward / Backward Trace · Recall Analysis · Traceability Reports · dll | 🔴 | — |

> Ini kandidat terkuat untuk **kejutan §32**: ketertelusuran lot **sudah berjalan di data** dan
> merupakan syarat kepatuhan BPOM/halal, tapi **tidak punya satu layar pun**.

### 10. Maintenance
Delapan item, **seluruhnya ⚪ diparkir**.

### 11. Finance & Costing
| Item | Status | Route |
|---|---|---|
| Manufacturing Costing · Standard Cost · Cost Variance | 🟢 | di dalam `/operating-profit` & `/items` |
| Accounts Receivable/Payable · Invoices · Payments · General Ledger · Actual Cost · WIP · Inventory Valuation · Financial Reports | 🔴 | — |

### 12. Data & Analytics
| Item | Status | Route |
|---|---|---|
| KPI | 🔵 | `/kpi`, `/kpi/saya` |
| Operational / Manufacturing Analytics | 🟢 | `/process-mining` |
| **Report Builder** | ⚪ | diparkir — **bentrok dengan "Create Report" di §10, lihat konflik K-3** |
| Analytics Dashboard · Spreadsheet · Data Explorer · Dashboard Builder · Supply Analytics · Import/Export | 🔴 | — |

### 13. AI
| Item | Status | Route |
|---|---|---|
| AI Insights | 🔵 | `/ai-project` |
| (kesiapan AI tenant) | 🔵 | `/ai-readiness` — **tidak ada di sitemap dokumen** |
| AI Assistant · AI Forecast · AI Planning · AI Detection · AI Automation | 🔴 | — |

### 14. Integrations
Enam item, **seluruhnya 🔴**.

### 15. Administration
| Item | Status | Route |
|---|---|---|
| Users & Roles | 🔵 | `/team` |
| System Settings | 🔵 | `/company` |
| Master Data | 🟡 | tersebar di `/items`, `/customers`, `/routing` — bukan satu tempat |
| **Numbering / Sequences** | 🔴 | **tidak ada penghitung tersimpan sama sekali** — nomor dihitung ulang dari jumlah baris |
| Approval · Workflow · Audit Log · Companies/Tenants · Permissions | 🔴 | — |

---

## Halaman yang ADA tapi TIDAK ADA di sitemap dokumen

Dokumen IA tidak menyebutkan ini, padahal seluruhnya sudah berjalan:

| Halaman | Usulan rumah |
|---|---|
| `/attendance` (Absensi Geo-QR) | workspace baru **People**, atau Administration |
| `/hr` (Dasbor HRD) | sama |
| `/kamus` (Antrean Kamus) | Administration → Master Data |
| `/documents` (Master Dokumen) | Administration |
| `/whats-new` | menu pengguna, bukan navigasi kiri |
| `/build-tasks` (Daftar Tugas Pembangunan) | **mode internal saja** |
| `/debug`, `/test-tenant` | **mode internal saja** |

> Dokumen IA sepenuhnya melewatkan **kepegawaian dan absensi**, padahal itu modul yang sudah
> berjalan dan menopang seluruh perhitungan biaya SDM. Ini bukan kesalahan kecil dokumen —
> tanpa perbaikan, menyalin sitemap apa adanya akan **menghilangkan modul yang sudah dipakai**.

---

## Daftar konflik

| Kode | Konflik | Usulan |
|---|---|---|
| **K-1** | `/company/setelan` tidak bisa dibuka sama sekali | Perbaiki dulu sebelum masuk menu. Menu yang menunjuk halaman yang mengalihkan ke login lebih buruk daripada tidak ada menunya |
| **K-2** | Sitemap tidak memuat Absensi & HRD | Tambahkan workspace **People**; jangan salin sitemap apa adanya |
| **K-3** | "Create Report" jadi quick-create, tapi Report Builder diparkir | Quick-create v1 diisi aksi yang terbukti ada. Daftar usulan di bawah |
| **K-4** | Dokumen memakai emoji sebagai ikon | Sudah dijawab: ikon Carbon. Emoji di dokumen ilustrasi belaka |
| **K-5** | Istilah "Work Order" vs "Batch" | Kamus menang. Perlu keputusan pemilik produk untuk label navigasi Inggris |
| **K-6** | 16 peran, nol pengguna nyata | Satu mode navigasi, sesuai fakta proyek baru |
| **K-7** | `/ai-readiness` menulis saat dibuka | Perbaiki; sekaligus tinjau ulang halaman lain sekelasnya |

## Quick-create v1 — hanya aksi yang TERBUKTI ada

Diambil dari halaman yang benar-benar berfungsi, bukan dari §10 dokumen:
Item baru · Pelanggan baru · Supplier baru · Sales Order baru · PO klien baru · Work Order
baru · BOM baru.

**"Create Report" TIDAK masuk** — pembuatnya belum ada.
