# SALES_CRM_KEEP_ADAPT_MIGRATE_REPLACE_MATRIX

> **REPLACE BUKAN BAWAAN.** Dari 19 kapabilitas, **nol** direkomendasikan REPLACE.

| Kapabilitas | Keadaan sekarang | Keputusan | Alasan | Bukti | Dampak | Migrasi | Perlu persetujuan arsitektur? |
|---|---|---|---|---|---|---|---|
| Customer / Account | CRUD + arsip/pulih, RLS, snapshot | **KEEP** | Berjalan dan teruji; `PMB-03` menunggu persetujuan, bukan perbaikan | uji `supplier_customer_alur1` | nol | nol | tidak |
| Contact | menempel di PO sebagai 4 kolom | **ADAPT** | Kontak berulang antar-PO harus diketik ulang; entitas kontak menyusul SALES-1 | kolom `pic_*` | rendah | ya, saat entitas lahir | ya — entitas baru |
| Lead | tidak ada | **MISSING** | — | nav `belum-ada` | — | — | ya (SALES-1/CRM-lite) |
| Opportunity | tidak ada | **MISSING** | — | nav `belum-ada` | — | — | ya |
| Sample (penjualan) | hanya sampel STANDAR PRODUKSI | **MISSING** | Entitas yang ada milik domain Produksi, bukan Sales | `production_standard_samples` | — | — | ya (SALES-3) |
| Product Configuration | tidak ada | **MISSING** | CustomerProduct = akar keluhan repeat-PO | tinjauan §H1 | — | — | ya (SALES-1) |
| Pricing | harga per baris dokumen; nol master harga jual | **ADAPT** | Mesin margin sudah ada — waterfall = lapisan tipis, bukan mesin baru | tinjauan §11 | sedang | — | ya (SALES-2) |
| Quotation | tidak ada | **MISSING** | Penawaran hidup di luar sistem | nav `belum-ada` | — | — | ya (SALES-2) |
| Contract | tidak ada | **MISSING** | Diparkir sampai ada permintaan nyata | SLS-90 | — | — | ya + keputusan bisnis |
| **Customer PO** | 3 tabel, 3 pemicu, persetujuan 3 departemen | **KEEP + ADAPT** | Inti benar; kurang `on_hold`/`cancelled` di layar, dan baris kurang UOM/tanggal/pajak | skema + pemicu | rendah | tidak untuk status; ya bila kolom baris ditambah | sebagian |
| **Sales Order** | 2 tabel + 2 snapshot, pemicu transisi | **KEEP + ADAPT** | Model benar dan batas domain bersih; **3 dari 4 status tidak bisa dicapai** | SC-01 | **tinggi** | tidak | ya (PJL-03) |
| Demand Signal | Work Order (PPIC) | **KEEP** | Bukan milik Sales | — | nol | nol | tidak |
| Fulfillment (feasibility) | snapshot + kunci baseline | **KEEP** | Terbukti 2 uji; tinjauan menyuruh PERLUAS, bukan tulis ulang | 2 uji | nol | nol | tidak |
| Delivery / Shipment / POD | 4 tabel, 3 pemicu, QR publik | **KEEP** | Lengkap dan teruji | `shipments_physical_stage` | nol | nol | tidak |
| Alamat kirim pelanggan | server lengkap, **nol layar** | **ADAPT** | Kapabilitas ada tetapi tidak bisa dipakai siapa pun | SC-05 | sedang | nol | keputusan produk |
| Return / RMA | tidak ada | **MISSING** | — | nav `belum-ada` | — | — | ya (SALES-5) |
| Complaint | NCR ada di Quality | **ADAPT** | Tinjauan: komplain = NCR tipe baru + tautan SO, **bukan sistem kedua** | tinjauan §27 | sedang | — | ya (SALES-5) |
| Commission | tidak ada | **MISSING** | Diparkir | SLS-90 | — | — | ya + keputusan bisnis |
| Forecast | tidak ada | **DEPRECATE** | **DITOLAK sebagai konsep**, bukan tertunda | SLS-90, nav `ditolak` | nol | nol | sudah diputuskan |
| Analytics | margin dua tingkat | **KEEP + ADAPT** | Mesin ada; KPI sales (OTD, win-rate) belum | `margin_watch` | rendah | nol | ya (SALES-5) |

## Rekap

| Keputusan | Jumlah |
|---|---|
| **KEEP** (termasuk KEEP+ADAPT) | **8** |
| ADAPT | **4** |
| MIGRATE | **0** |
| DEPRECATE | **1** |
| **REPLACE** | **0** |
| MISSING | **8** |

**Nol REPLACE.** Tidak ada satu pun implementasi yang terbukti tidak layak.
