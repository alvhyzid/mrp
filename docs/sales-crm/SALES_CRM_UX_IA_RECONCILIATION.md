# SALES_CRM_UX_IA_RECONCILIATION

## Navigasi

Workspace **Sales & CRM** sudah ada dan **jujur menandai apa yang belum dibangun**:

| Item | Status di navigasi |
|---|---|
| Customers · Customer PO · Sales Orders | `aktif` |
| Pricing | `sebagian` — "harga per pelanggan ada di dalam Items" |
| Quotations · Returns/RMA · Complaints · Leads & Opportunities · Sample Requests | `belum-ada` |

Shipments berada di workspace lain (Logistik) — **benar menurut kepemilikan domain**.

## Runtime — diukur

Empat halaman Sales di tiga lebar (360 · 768 · 1440), non-GET diblokir:

**Nol gulir menyamping · nol elemen melewati tepi · satu `h1` · nol lompatan judul ·
nol galat konsol.**

| Modal | Hasil |
|---|---|
| "Tambah pelanggan baru" | 10 kontrol, **nol tanpa label**, kaki terlihat, nol gulir mendatar |
| "Buat PO klien baru" | modal **bertahap 4 langkah**, kaki terlihat |

## Utang UX per halaman

| Halaman | `invalidText` | `window.confirm` | `AreaNotifikasi` | Kegagalan diam |
|---|---:|---:|---|---:|
| CustomersPage | **0** | **1** | tidak | 1 |
| CustomerPurchaseOrdersPage | **0** | 0 | **ya** | 3 |
| SalesOrdersPage | **0** | **2** | tidak | 0 |
| ShipmentsPage | 1 | 0 | tidak | 0 |

**Nol dari 44 kontrol form Sales punya galat tingkat field.** Kontrak validasi FABRIX
(`DS-25`) sudah ada dan terbukti di dua modul lain — Sales belum memakainya.

## Klasifikasi

| Temuan | Golongan |
|---|---|
| Status SO tak bisa berubah | **cacat arsitektur** |
| Alamat kirim tanpa layar | **kapabilitas hilang** |
| Nol `invalidText` | **utang kelas** (DS-25) |
| 3 `window.confirm` | **utang kelas** (DS-06) |
| `AreaNotifikasi` 1 dari 4 halaman | **konsistensi** |
