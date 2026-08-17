# Prioritas Fitur — Acuan MRPeasy Enterprise

Dokumen ini memetakan seluruh fitur paket Enterprise MRPeasy ke tingkat prioritas pembangunan, supaya kita tahu mana yang masuk MVP, mana yang menyusul, dan mana yang ditunda dulu — tanpa kehilangan visi jangka panjang untuk menyamai/melampaui MRPeasy.

---

## Tier 1 — Sudah Tercakup di Rancangan MVP Kita

Fitur ini sudah ada di roadmap Fase 3-6 dan skema database yang sudah kita rancang.

> **Legenda status (per audit 15 Agu 2026, diverifikasi lewat kode + query database langsung, bukan asumsi dari skema — diperbarui 16 Agu 2026 setelah Purchasing/Goods Receipts/Lot Genealogy dibangun, lalu diperbarui lagi 16 Agu 2026 setelah Bell Icon Notifikasi Terpusat dibangun):** ✅ = sudah dibangun DAN sudah bisa dipakai lewat UI/alur nyata. 🟡 = sebagian — ada kode/skema/backend nyata, tapi ada bagian penting yang belum bisa dipakai (jelaskan di kolom status). ❌ = belum dibangun sama sekali, baru rancangan di skema/dokumen.

| Fitur MRPeasy | Status di Rancangan Kita |
|---|---|
| BOM single & multi-level | ✅ Halaman `/boms` — CRUD penuh, sudah dipakai |
| Routing | ✅ Halaman `/routing` — CRUD penuh, dipakai Gantt & Work Order |
| Lot Traceability | ✅ `lots` (stok per-lot) jalan (Stock Summary, konsumsi produksi) DAN `lot_genealogy` sekarang tertulis otomatis — begitu hasil produksi (`work_order_outputs`) dicatat dari halaman `/production`, lot barunya otomatis ditautkan ke lot-lot bahan yang dikonsumsi batch yang sama. Diverifikasi 16 Agu 2026: 1 lot dari PO supplier → dipakai produksi → lot hasil produksi → `lot_genealogy` mencatat rantainya dengan benar, baik lebar (multi-lot per batch) maupun kedalaman (multi-level, lot hasil dipakai lagi jadi input produksi berikutnya). Bug penutup ditemukan & diperbaiki 16 Agu 2026: form "Buat Work Order" sempat MEWAJIBKAN pilih SO line walau `work_orders.sales_order_line_id` memang dirancang nullable (untuk WO produksi WIP di muka, mis. Base Gelatin, belum terikat SO) — validasi client+server sekarang membiarkannya kosong untuk item tipe apa pun, dibuktikan dengan WO baru (id 86) tersimpan tanpa SO line lewat form nyata. Dengan ini PRIORITAS 1 (Purchasing + Goods Receipts + Lot Genealogy) dinyatakan TUNTAS. |
| Expiry Date Management | ✅ `lots.expiry_date` dipakai nyata di `WorkOrdersPage` (pemilihan lot) dan proyeksi stok |
| Manufacturing/Work Order tracking | ✅ Halaman `/work-orders` — CRUD penuh, dipakai |
| Workforce Planning | 🟡 Skema (`work_order_assignments`), RLS, dan alert `worker_absence` sudah jalan di backend — TAPI tidak ada UI untuk benar-benar menugaskan pekerja ke batch. Satu-satunya kode yang menyentuh tabel ini cuma MENAMPILKAN (panel detail Gantt), bukan menulis |
| Purchase Order tracking | ✅ Halaman `/purchasing` (buat PO ke supplier: pilih supplier, item, qty dalam `purchase_uom`, harga, plant tujuan) DAN konfirmasi barang datang dari Dashboard Warehouse (`goods_receipts`) — konversi `purchase_uom` → `base_uom` otomatis, lot baru & `stock_movements` tercipta, `purchase_order_lines.qty_received` ter-update, alert `material_shortage` terkait otomatis resolve. Diverifikasi 16 Agu 2026 dengan PO nyata (5kg → 5000g, biaya per-gram terhitung benar). |
| Material Requirements Planning (MRP I) | ✅ Perhitungan kebutuhan bahan dari BOM × `planned_qty` batch jalan nyata saat WO/batch dibuat, terbukti dari alert `material_shortage` yang benar-benar muncul |
| Stock visibility (on hand/available) | ✅ Dashboard Warehouse — Stock Summary jalan nyata dari `lots`/`stock_movements` |
| Production status real-time per tahap | ✅ `work_order_step_progress` — dicatat & ditampilkan nyata (Production dashboard, panel detail Gantt) |
| Peringatan otomatis kekurangan bahan/PO telat | 🟡 `material_shortage` sudah jalan & terbukti (trigger otomatis, resolve otomatis saat goods receipt — sekarang goods receipt-nya sendiri juga sudah punya UI). `po_delayed` MASIH TIDAK PERNAH bisa muncul — cuma ada logika RESOLVE-nya (saat goods receipt), belum ada logika yang mengecek "PO ini `expected_date`-nya sudah lewat tapi belum diterima" untuk MEMBUAT alert ini |
| Laporan produksi harian/per-shift (batch, hasil curing, filling, siap kirim) | 🟡 Data mentahnya lengkap (`shifts`, `work_order_step_progress.qty_recorded`) dan bisa dilihat manual per Work Order — belum ada halaman laporan/rekap yang merangkumnya per hari/shift |
| Tampilan telusur 1 nomor PO (BOM, status, jadwal, progres, sisa kirim) | ✅ `SalesOrdersPage` sudah punya list + detail (SO, WO terkait, progres) DAN sekarang menampilkan "Sudah Dikirim"/"Sisa Belum Dikirim" per baris item + "Riwayat Pengiriman" (Sesi 3B, 17 Agu 2026) — diverifikasi nyata lewat browser: SO 001/8-ITM/2026 dikirim parsial 2x (100+50 dari 300 dipesan), halaman detail menunjukkan sisa 150 pcs dengan benar |
| Estimasi tanggal selesai berbasis kecepatan produksi aktual | ❌ Belum ada logika/halaman apa pun yang menghitung ini — data historis (`work_order_step_progress`) tersedia tapi belum diolah |
| Kalkulasi biaya BOM (standar & aktual dari lot) | 🟡 Biaya PER KOMPONEN sudah ditampilkan (`items.standard_cost` di detail BOM) — belum ada kalkulasi TOTAL biaya BOM (jumlah semua komponen), baru angka satuan |
| Laporan biaya lengkap per batch/PO (bahan + SDM + durasi) | ❌ Belum ada — datanya tersebar (`work_order_consumption`, `work_order_assignments`) tapi belum ada satu pun fungsi/halaman yang merangkumnya jadi laporan |
| Dashboard biaya PO real-time/per-shift untuk pemilik (progres, biaya bahan, biaya SDM, total berjalan) | ❌ Belum ada — nol implementasi ditemukan |
| **Margin/profit per pengiriman** (sistem keuangan inti: pendapatan − biaya bahan − biaya SDM, dihitung saat barang dikirim) | 🟡 Sesi 3A+3B (17 Agu 2026): pengiriman NYATA sudah bisa dibuat & dikelola LEWAT UI oleh Warehouse/PPIC (halaman `/shipments`) — pilih SO bersisa qty, saran lot FEFO otomatis (bisa diganti), alamat tujuan wajib per pengiriman (beda-beda meski SO/customer sama), transisi draft→shipped (stok berkurang tepat di sini, diverifikasi) →delivered. Diverifikasi end-to-end lewat browser sungguhan termasuk pengiriman PARSIAL 2x dengan alamat berbeda + percobaan kirim melebihi sisa DITOLAK dengan pesan jelas dari database. BELUM ADA: fungsi kalkulasi margin itu sendiri (belum digarap sama sekali) dan Surat Jalan PDF (Sesi 3C) |
| **Tanda Tangan Digital pada dokumen** (bukan fitur MRPeasy, tapi requirement Anda — persetujuan bertanda tangan sebelum dokumen dikunci) | 🟡 Sesi 1 (17 Agu 2026): fondasi GENERIK siap dipakai ulang lintas jenis dokumen — upload/ganti tanda tangan lewat Profil (file lama TIDAK PERNAH terhapus, diverifikasi upload 3x berturut-turut, url lama tetap bisa diakses semua), komponen `ConfirmAndSignModal` (preview + checkbox wajib + tombol Process/Cancel) diuji dengan data dummy: snapshot tanda tangan tercatat BENAR sesuai tanda tangan yang berlaku SAAT itu, dibuktikan eksplisit tidak ikut berubah walau user ganti tanda tangan setelahnya. BELUM ADA: dipasang ke dokumen nyata (Surat Jalan, Sesi 2) |
| Penanganan pekerja (PHL) absen mendadak & penggantian di hari-H | 🟡 Skema & alert siap (`work_order_assignments.status`, `replacement_for_assignment_id`) tapi TIDAK BISA dicoba karena bergantung pada UI penugasan pekerja yang belum ada (lihat "Workforce Planning" di atas) |
| Penambahan pekerja mendadak di luar rencana | 🟡 Sama seperti di atas — kolom `unplanned_addition` siap di skema, tidak bisa dicoba tanpa UI penugasan pekerja |
| Pencatatan gangguan produksi (mesin, listrik padam, faktor eksternal lain) sebagai penjelasan selisih target vs hasil | ✅ Halaman `/production` — termasuk gangguan menyeluruh 1 plant (FASE 5, diverifikasi 15 Agu 2026), plus gangguan spesifik 1 mesin |
| Multi-tenant (bukan fitur MRPeasy, tapi requirement Anda) | ✅ `company_id` + RLS aktif sejak Fase 1 |
| *(bukan dari tabel di atas, tapi terdeteksi saat audit)* Proyeksi stok habis & risiko kadaluarsa (`stock_depletion_forecast`, `expiry_risk_low_usage`) | ✅ `stock_depletion_forecast` diverifikasi BENAR-BENAR menghasilkan alert nyata (16 Agu 2026): item RM-GLUTATHIONE sengaja dikonsumsi sampai tersisa 1g → alert "Proyeksi stok habis dalam 3.3 hari (lead time pemasok 14 hari)" muncul otomatis di `system_alerts`, severity `critical`. `expiry_risk_low_usage` masih belum pernah teruji — sampai sekarang tidak ada satu pun lot di database yang punya `expiry_date` terisi (bukan bug, memang belum pernah ada yang mengisi), jadi kondisinya belum pernah bisa dicek. |
| Penyesuaian Stok Manual (adjustment) | ✅ Dibangun 16 Agu 2026 (audit fondasi arsitektur menemukan `adjustment` sudah terdaftar sebagai `movement_type` valid sejak awal skema, tapi tidak ada satu pun fitur yang pernah membuatnya). Form di Dashboard Warehouse — pilih lot, isi jumlah (+/-), wajib pilih alasan (selisih stok opname/kerusakan/lainnya). `lots.quantity_on_hand` dan `stock_movements` ter-update ATOMIK lewat 1 fungsi database, ditolak kalau bikin stok negatif. Akses sengaja dibatasi ke `warehouse_manager`+leadership, BUKAN staf biasa. Diverifikasi dengan penyesuaian nyata (stok 140→138) dan percobaan gagal (staf produksi ditolak 403, penyesuaian yang bikin minus ditolak). |
| *(bukan dari tabel MRPeasy, fitur yang diminta terpisah)* Notifikasi Terpusat (Bell Icon) | ✅ Dibangun 16 Agu 2026. Sebelumnya TIDAK ADA badge/dropdown notifikasi terpusat di manapun (dikonfirmasi lewat audit kode sebelum dibangun) — cuma ada tabel alert per-halaman (Warehouse dashboard, kolom "open_alert_count" di Work Orders). Sekarang: icon lonceng di header (`AppShell`) tiap halaman, badge = jumlah alert `open` relevan (company_admin/general_manager lihat SEMUA; role lain cuma lihat `target_department` null ATAU sesuai department mereka — dihitung dari role login, bukan input client), klik alert → tandai `acknowledged` (badge berkurang) + navigasi ke halaman terkait. Real-time lewat Supabase Realtime (`system_alerts` ditambahkan ke publication `supabase_realtime`) — badge naik OTOMATIS tanpa reload begitu alert baru dibuat, plus bunyi notifikasi singkat (ada toggle bisu, tersimpan di localStorage browser). Diverifikasi 16 Agu 2026 dengan alert `so_ready_for_production` nyata: badge `ppic_manager` naik via realtime & lewat REST scope=my_department, badge `warehouse_manager` TIDAK berubah (department beda), `company_admin` melihat semuanya, dan klik-acknowledge terbukti mengurangi badge ke 0. |

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
