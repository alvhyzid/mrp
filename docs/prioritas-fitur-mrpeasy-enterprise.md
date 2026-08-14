# Prioritas Fitur — Acuan MRPeasy Enterprise

Dokumen ini memetakan seluruh fitur paket Enterprise MRPeasy ke tingkat prioritas pembangunan, supaya kita tahu mana yang masuk MVP, mana yang menyusul, dan mana yang ditunda dulu — tanpa kehilangan visi jangka panjang untuk menyamai/melampaui MRPeasy.

---

## Tier 1 — Sudah Tercakup di Rancangan MVP Kita

Fitur ini sudah ada di roadmap Fase 3-6 dan skema database yang sudah kita rancang.

| Fitur MRPeasy | Status di Rancangan Kita |
|---|---|
| BOM single & multi-level | ✅ `boms`, `bom_lines` |
| Routing | ✅ `routings`, `routing_steps` |
| Lot Traceability | ✅ `lots`, `lot_genealogy` |
| Expiry Date Management | ✅ `lots.expiry_date` |
| Manufacturing/Work Order tracking | ✅ `work_orders` |
| Workforce Planning | ✅ `work_order_assignments` |
| Purchase Order tracking | ✅ `purchase_orders` |
| Material Requirements Planning (MRP I) | ✅ inti dari arsitektur BOM+Inventory |
| Stock visibility (on hand/available) | ✅ `lots`, `stock_movements` |
| Production status real-time per tahap | ✅ `work_order_step_progress` |
| Peringatan otomatis kekurangan bahan/PO telat | ✅ `system_alerts` |
| Laporan produksi harian/per-shift (batch, hasil curing, filling, siap kirim) | ✅ `shifts`, `work_order_step_progress.qty_recorded` |
| Tampilan telusur 1 nomor PO (BOM, status, jadwal, progres, sisa kirim) | ✅ `work_orders.sales_order_line_id`, `shipments` |
| Estimasi tanggal selesai berbasis kecepatan produksi aktual | ✅ Perhitungan dari `work_order_step_progress` historis |
| Kalkulasi biaya BOM (standar & aktual dari lot) | ✅ `items.standard_cost`, `lots.unit_cost` |
| Laporan biaya lengkap per batch/PO (bahan + SDM + durasi) | ✅ `employees`, `work_order_assignments`, gabungan seluruh data produksi |
| Dashboard biaya PO real-time/per-shift untuk pemilik (progres, biaya bahan, biaya SDM, total berjalan) | ✅ Semua tabel biaya diberi `shift_id`/timestamp — bisa dilihat kumulatif live maupun dipecah per hari |
| **Margin/profit per pengiriman** (sistem keuangan inti: pendapatan − biaya bahan − biaya SDM, dihitung saat barang dikirim) | ✅ `unit_price` di line PO/SO + biaya yang sudah ada (`lots.unit_cost`, `work_order_assignments`) — dihitung otomatis, bukan tabel terpisah |
| Penanganan pekerja (PHL) absen mendadak & penggantian di hari-H | ✅ `work_order_assignments.status`, `replacement_for_assignment_id`, alert `worker_absence` |
| Penambahan pekerja mendadak di luar rencana | ✅ `work_order_assignments.status = unplanned_addition` |
| Pencatatan gangguan produksi (mesin, listrik padam, faktor eksternal lain) sebagai penjelasan selisih target vs hasil | ✅ `work_centers`, `production_disruptions`, alert `production_disruption` |
| Multi-tenant (bukan fitur MRPeasy, tapi requirement Anda) | ✅ `company_id` + RLS |

---

## Tier 2 — Prioritas Tinggi, Susulan Setelah MVP Jalan (v1.1)

Fitur ini penting dan relatif murah/cepat ditambahkan karena selaras dengan arsitektur yang sudah ada.

| Fitur | Kenapa Penting untuk Anda | Dampak ke Skema |
|---|---|---|
| **Custom Fields** | Krusial untuk multi-tenant — perusahaan lain (industri berbeda) bisa sesuaikan data tanpa kita ubah kode | Tambah tabel `custom_field_definitions` + `custom_field_values` |
| **Quality Control** | Relevan untuk functional supplement — perlu checkpoint QC sebelum produk keluar gudang | Tambah tabel `quality_inspections`, terhubung ke `work_orders`/`lots` |
| **Multiple Stocks (Warehouse)** | Untuk kalau ada gudang bahan baku terpisah dari gudang barang jadi | Tambah tabel `warehouses`, `lots` dapat kolom `warehouse_id` |
| **Barcode Printing & Scanning** | Percepat proses gudang, kurangi human error input manual | Tambah kolom `barcode` di `items`/`lots`, fitur UI scan |
| **Two-Factor Authentication** | Keamanan data multi-tenant — Supabase Auth sudah dukung ini secara bawaan | Tidak perlu tabel baru, tinggal aktifkan fitur Supabase |
| **Serial Number Tracking** | Kalau suatu saat perlu lacak per-unit, bukan cuma per-lot | Tambah tabel `serial_numbers` |
| **Sales Management dasar (quoting, invoicing)** | Melengkapi alur dari PO masuk sampai pengiriman | Tambah tabel `quotes`, `sales_invoices` |

---

## Tier 3 — Bisa Ditunda (Backlog Jangka Panjang)

Fitur ini bernilai tapi kompleks dan belum terbukti dibutuhkan mendesak oleh operasional PT. Indo Taste saat ini.

| Fitur | Catatan |
|---|---|
| Master Production Schedule (MPS) & Sales Forecasting | Butuh data historis produksi dulu supaya forecast berguna — belum ada datanya di awal |
| **Prediksi keterlambatan berbasis "pembelajaran" pola historis (ML)** | Butuh minimal 6-12 bulan data produksi nyata untuk dilatih — dibangun setelah sistem berjalan cukup lama, bukan di MVP. Fondasi datanya (`work_order_step_progress`, `system_alerts`) sudah disiapkan dari sekarang. |
| Maintenance Management System (MMS) penuh | Berguna, tapi bukan blocker operasional harian. **Catatan:** ini beda dengan "pencatatan gangguan mesin" yang sudah masuk Tier 1 — MMS penuh mencakup penjadwalan perawatan preventif, riwayat servis, dan stok spare part; yang di Tier 1 baru sebatas mencatat KAPAN & KENAPA mesin berhenti saat itu terjadi. |
| Subcontracting | **Perlu dikonfirmasi**: apakah PT Indo Taste (atau calon pelanggan lain) pernah outsource sebagian proses produksi ke pihak luar? |
| Product Configurator / Matrix BOM | Baru relevan kalau varian produk sangat banyak kombinasinya (mis. tiap rasa × tiap ukuran × tiap bahan aktif otomatis generate varian) |
| Return Merchandise Authorization (RMA) | Alur retur dari client — bisa ditambah setelah ada volume transaksi nyata |
| Approval System (workflow persetujuan) | Lebih relevan saat jumlah user/tim sudah besar |
| Co-product / Disassembly BOM | **Perlu dikonfirmasi**: apakah ada produk sampingan (byproduct) dari proses produksi gummy/serbuk? |
| Backward Scheduling | Optimasi penjadwalan lanjutan, MVP cukup pakai forward scheduling dulu |
| Multiple Production Sites | Sudah direncanakan di Fase 5 (ekspansi multi-plant) |
| Revision/Version Control BOM | Konsepnya sudah ada via kolom `version` di `boms`, tinggal dikembangkan UI-nya nanti |

---

## Pertanyaan Terbuka untuk Divalidasi

1. Apakah ada **produk sampingan/byproduct** dari proses produksi gummy atau serbuk (co-product)?
2. Apakah PT. Indo Taste (atau target pelanggan lain nanti) pernah **outsource sebagian proses produksi** ke pihak ketiga (subcontracting)?
3. Dari Tier 2 di atas, mana yang menurut Anda **paling mendesak** untuk masuk lebih awal — sebelum yang lain?
