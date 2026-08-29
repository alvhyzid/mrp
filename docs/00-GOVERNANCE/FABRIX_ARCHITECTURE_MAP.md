# FABRIX ARCHITECTURE MAP
## Canonical map of layers, domains, and ownership

### UX layer
Overview; Control Tower; Sales & CRM; Product & Engineering; Planning & APS; Supply Chain; Manufacturing; Quality; Traceability; Maintenance; Finance & Costing; Data & Analytics; AI; Integrations; Administration.

### Business domains
Commercial/Sales; Product; Engineering; Planning; Procurement; Inventory; Manufacturing; Scheduling/APS; Quality; Traceability; Maintenance; Costing; Finance; Analytics; AI; Integration; Platform.

### Technical layer
Application/domain services, persistence, APIs, jobs, events, integrations, observability, security, deployment.

### Source-of-truth baseline
| Concern | Owner |
|---|---|
| Customer commercial relationship | Sales |
| Product identity | Product |
| Manufacturing definition (BOM/Formula/Routing) | Engineering |
| Demand/MPS/MRP | Planning |
| Supplier/procurement commitment | Procurement |
| Physical inventory | Inventory/Warehouse |
| Production intent/execution | Manufacturing/MES boundary |
| Schedule/resource timing | Scheduling/APS |
| Quality disposition | Quality |
| Genealogy | Traceability |
| Equipment availability | Maintenance |
| Manufacturing cost | Costing |
| Accounting | Finance |
| Shipment execution | Logistics/Delivery |
| Users/access | Platform |
| Analytics | Derived from source domains |
| AI recommendations | AI layer |
| External-system state | Integration |

### Rule
UX placement never determines domain ownership, database ownership, or service boundaries.


---

# KEADAAN TERUKUR — 29 Agustus 2026

> **Bagian di atas adalah PETA YANG DIRENCANAKAN. Bagian ini adalah YANG BENAR-BENAR ADA**,
> diukur langsung dari repositori dan basis data produksi (baca-saja). Keduanya sengaja
> dipisah: peta rencana tidak boleh terbaca sebagai laporan keadaan.

## Ukuran sistem

| Hal | Jumlah |
|---|---|
| Tabel (schema `public`) | **96** |
| View | 8 |
| Fungsi basis data | **72** |
| Kebijakan RLS | **161** |
| Trigger | 28 |
| Migrasi | **333** |
| Route halaman | 27 |
| Route API | **128** |
| Berkas test | **90** |

## Domain yang benar-benar berkode

| Domain (`src/features/`) | Halaman | Modul server | Catatan |
|---|---|---|---|
| **mrp** | 14 | **109** | Domain terbesar; memuat Sales, Item, BOM, Routing, Work Order, Pengiriman, Pembelian |
| auth | 10 | 7 | Identitas, profil, undangan |
| attendance | 1 | 9 | Kehadiran |
| kamus | 1 | 9 | Kamus istilah |
| kpi | 2 | 9 | KPI |
| ai-project | 1 | 8 | Pelacakan proyek AI |
| documents | 1 | 7 | Dokumen |
| ai-readiness | 1 | 6 | Kesiapan AI |
| hr | 1 | 6 | SDM |
| company | 2 | 5 | Setelan perusahaan |
| team | 1 | 4 | Anggota tim |
| process-mining | 1 | 3 | Process mining |
| signatures | 0 | 2 | Tanda tangan (komponen bersama) |
| ppic · production · warehouse | 1 masing-masing | **0** | Halaman saja; logikanya di `mrp` |
| navigasi | 0 | 0 | Kerangka aplikasi |

> **Catatan batas domain yang jujur:** `mrp` memuat **109 dari 184** modul server. Peta di
> atas membedakan Commercial/Sales, Planning, Procurement, Inventory, Manufacturing,
> Scheduling, dan Logistics sebagai domain terpisah — **di kode, ketujuhnya berada di satu
> folder**. Batas domain hari ini ditegakkan lewat **peran dan kebijakan RLS**, bukan lewat
> struktur folder.

## DIBANGUN vs DIPAKAI — dua hal berbeda

Diukur di tenant nyata PT Indo Taste Manufacture, baca-saja:

| Entitas | Baris nyata | Artinya |
|---|---|---|
| Karyawan | **30** | **dipakai sungguhan** |
| Pengguna | 8 | 7 dari 8 berakhiran `@debug.mrp` |
| KPI | 6 | terisi |
| Perusahaan | 2 | PT Indo Taste + satu tenant uji |
| Item · Pelanggan · PO klien | **1** masing-masing | baru dicoba |
| **BOM · Routing · Sales Order · Work Order · Batch · Pengiriman · Lot · Supplier · PO supplier · Penerimaan · Dokumen** | **0** | **belum pernah dipakai** |

> **KONSEKUENSI YANG HARUS DISADARI SIAPA PUN YANG MEMBACA PETA INI:** inti manufaktur
> sudah **terbangun** dan **belum terpakai**. Setiap pernyataan "fitur X bekerja" hari ini
> bersandar pada **test**, bukan pada pemakaian nyata. Itu bukan cacat — sistem memang
> sengaja diselesaikan dulu sebelum dipakai (lihat CLAUDE.md). Tetapi ia mengubah arti
> kata "terbukti": terbukti di test, belum terbukti di lantai produksi.

## Kepemilikan sumber kebenaran — yang SUDAH DITEGAKKAN

Tabel rencana di atas mencantumkan 17 pemilik. Yang benar-benar **ditegakkan kode** hari ini:

| Concern | Pemilik | Ditegakkan lewat | Bukti |
|---|---|---|---|
| Hubungan komersial pelanggan | **Sales** | `CUSTOMER_PO_MANAGE_ROLES`, RLS | `tests/peran_sales.test.ts` |
| Status komersial Sales Order | **Sales** | `sales_orders.status` + trigger | `status_eksekusi_sales_order` |
| Kemajuan produksi | **Manufacturing** | **diturunkan**, tidak disimpan di Sales | `eksekusiSalesOrder.ts` |
| Kemajuan pengiriman | **Logistics** | **diturunkan**, tidak disimpan di Sales | idem |
| Alamat yang tercetak | **Logistics** | `shipments.delivery_address` (beku) | `pmb07b_delivery_addresses` |
| Identitas mitra di dokumen | dokumen penerbit | snapshot beku saat terbit | `jalur_kanonik_sales_order` |
| Pengguna & akses | **Platform** | `users.role` + 161 kebijakan RLS | `matriks_keamanan_sales` |
| **Pembayaran & piutang** | **Finance** | — | **DOMAINNYA TIDAK ADA** (FIN-02) |

**Concern yang belum punya pemilik yang ditegakkan:** akuntansi, biaya manufaktur, mutu,
ketertelusuran, pemeliharaan, penjadwalan/APS, analitik. Berkode sebagian, **tanpa batas
kepemilikan yang diuji**.
