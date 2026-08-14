# Daftar Database — Format Sederhana

Dokumen pendamping dari `rancangan-skema-database-mrp.md`. Tiap tabel ditulis sebagai satu "database" berdiri sendiri dengan daftar field-nya.

**Konvensi penamaan ID:** setiap primary key memakai pola `nama_tabel_tunggal_id`.

**Kontrol Akses Data Finansial (berlaku lintas tabel):**
- Harga jual/margin/biaya gabungan → HANYA `company_admin`, `general_manager`, `finance_manager`
- Gaji individual (`employees.wage_rate`) → HANYA `company_admin` + `hr_manager`/`hr_staff` + karyawan sendiri. `general_manager` dan `finance_manager` TIDAK termasuk (cuma dapat angka total, bukan rincian per-orang)
- Harga di PO ke supplier → boleh dilihat `purchasing_manager`/`purchasing_staff` (mereka yang input), tapi tetap tidak bisa lihat dashboard margin perusahaan

---

## Kelompok 1: Akses & Tenant

**Database Perusahaan** (`companies`)
- ID Perusahaan (company_id) · Nama (name) · Jenis Industri (industry_type) · ID Paket Langganan (subscription_plan_id) · Status (status) · Logo Perusahaan — file di Supabase Storage (logo_url) · Tanggal Dibuat (created_at)

**Database Paket Langganan** (`subscription_plans`)
- ID Paket (subscription_plan_id) · Nama Paket (name) · Harga (price) · Siklus Tagihan (billing_cycle) · Maksimal User (max_users) · Maksimal Item (max_items)

**Database Pengguna/Login** (`users`)
- ID User (user_id) · ID Perusahaan (company_id) · Nama (name) · Email (email) · Penghubung Akun Login Supabase (auth_uid)
- Peran/Role (role): super_admin / company_admin / general_manager / production_manager / production_staff / ppic_manager / ppic_staff / finance_manager / finance_staff / purchasing_manager / purchasing_staff / warehouse_manager / warehouse_staff / hr_manager / hr_staff / viewer
- Status (status) · Foto Profil — file di Supabase Storage (avatar_url) · Tanggal Dibuat (created_at)

**Database Undangan Anggota Tim** (`invitations`)
- ID Undangan (invitation_id) · ID Perusahaan (company_id) · Email Diundang (email) · Role (role) · Diundang Oleh (invited_by) · Status (status) · Kode Undangan (token) · Tanggal Kadaluarsa (expires_at) · Tanggal Dibuat (created_at) · Tanggal Diterima (accepted_at)

---

## Kelompok 2: Master Data Produksi

**Database Lokasi Pabrik** (`production_plants`)
- ID Pabrik (production_plant_id) · ID Perusahaan (company_id) · Nama Lokasi (name) · Alamat (address) · Fokus Produk — saran, bukan pembatas (product_focus) · Status Aktif (is_active)

**Database Shift Kerja** (`shifts`)
- ID Shift (shift_id) · ID Perusahaan (company_id) · ID Lokasi Pabrik (production_plant_id) · Nama Shift (name) · Jam Mulai (start_time) · Jam Selesai (end_time) · Status Aktif (is_active)

**Database Gangguan Produksi** (`production_disruptions`)
- ID Gangguan (production_disruption_id) · ID Perusahaan (company_id)
- Jenis: mesin/listrik padam/faktor eksternal/dialihkan ke pekerjaan lain/lainnya (disruption_type)
- ID Mesin (work_center_id) · ID Work Order (work_order_id) · ID Tahap (routing_step_id) · ID Shift (shift_id) · Waktu Mulai (started_at) · Waktu Selesai (resolved_at) · Keterangan (description)

**Database Pekerja** (`employees`) — *akses gaji dibatasi, lihat kontrol akses di atas*
- ID Pekerja (employee_id) · ID Perusahaan (company_id) · ID Lokasi Pabrik — nullable (production_plant_id) · Nama (name) · Posisi (position)
- Department: production/ppic/finance/purchasing/warehouse/hr/management (department)
- Jenis Upah (wage_type) · Tarif Upah — SENSITIF (wage_rate) · ID User Terkait (linked_user_id) · Status Aktif (is_active)

**Database Absensi Harian** (`employee_attendance`)
- ID Absensi (employee_attendance_id) · ID Perusahaan (company_id) · ID Pekerja (employee_id)
- Tanggal (attendance_date) · Jam Masuk (check_in_at) · Jam Pulang (check_out_at)
- Status: hadir/telat/absen/cuti/sakit (status) · Catatan (notes)

**Database Pengaturan Perusahaan** (`company_settings`)
- ID Pengaturan (company_setting_id) · ID Perusahaan (company_id) · Kunci (setting_key) · Nilai (setting_value)

**Database Bahan/Produk** (`items`)
- ID Item (item_id) · ID Perusahaan (company_id) · Kode Item (item_code) · Nama Item (name)
- Tipe: bahan mentah/setengah jadi/produk jadi/kemasan (type)
- Satuan Dasar/Pakai — dipakai di BOM & stok (base_uom)
- Satuan Beli — dipakai Purchasing (purchase_uom)
- Faktor Konversi Satuan Beli→Dasar (uom_conversion_factor)
- Umur Simpan Hari (shelf_life_days) · Stok Minimum (min_stock_level) · Titik Pesan Ulang (reorder_point) · Jumlah Pesan Ulang (reorder_qty) · Status Aktif (is_active)
- Biaya Standar — SENSITIF (standard_cost)
- Nomor Registrasi BPOM — nullable (bpom_registration_number)

> Catatan: MOQ (minimum order quantity) sengaja tidak dimodelkan — Purchasing input sesuai realita pembelian.

**Database Resep/Komposisi** (`boms`)
- ID BOM (bom_id) · ID Perusahaan (company_id) · ID Item Induk (parent_item_id) · Versi (version) · Jumlah Hasil Standar (standard_yield_qty) · Satuan Hasil (standard_yield_uom) · Status (status)
- Persentase Buffer — diatur PPIC, kompensasi kehilangan produksi (buffer_percentage)

**Database Detail Komponen Resep** (`bom_lines`)
- ID Baris (bom_line_id) · ID BOM (bom_id) · ID Item Komponen (component_item_id) · Jumlah per Unit Output (qty_per_unit_output) · Satuan (uom)

**Database Mesin/Stasiun Kerja** (`work_centers`)
- ID Mesin (work_center_id) · ID Perusahaan (company_id) · ID Lokasi Pabrik (production_plant_id) · Nama Mesin (name) · Kode Mesin (code) · Status Aktif (is_active)
- Kapasitas Jam per Hari — nullable, dasar Dashboard Kapasitas (capacity_hours_per_day)

**Database Header Alur Produksi** (`routings`)
- ID Routing (routing_id) · ID Perusahaan (company_id) · ID Item (item_id) · Versi (version)

**Database Tahapan Produksi** (`routing_steps`)
- ID Tahap (routing_step_id) · ID Routing (routing_id) · Nomor Urut (sequence_no) · Nama Tahap (step_name) · Durasi Aktif Menit (active_duration_minutes) · Durasi Tunggu Menit (wait_duration_minutes) · ID Mesin (work_center_id)

**Database Referensi Formula** (`formula_templates`)
- ID Formula (formula_template_id) · ID Perusahaan (company_id) · Nama (name) · Catatan (notes) · Komposisi Referensi (reference_composition)

---

## Kelompok 3: Inventory & Traceability

**Database Stok per Lot/Batch** (`lots`)
- ID Lot (lot_id) · ID Perusahaan (company_id) · ID Lokasi Pabrik (production_plant_id) · ID Item (item_id) · Nomor Lot (lot_number)
- Tanggal Kadaluarsa (expiry_date) · Tanggal Terima/Produksi (produced_or_received_date) · Jumlah Tersedia dalam satuan dasar (quantity_on_hand) · Sumber: dibeli/diproduksi/dari client (source_type) · Status (status)
- ID PO Client Asal — wajib diisi kalau sumbernya dari client (source_customer_purchase_order_id)
- Biaya per Unit — SENSITIF, otomatis 0 kalau dari client (unit_cost)

**Database Jejak Lot** (`lot_genealogy`)
- ID Jejak (lot_genealogy_id) · ID Lot Hasil (output_lot_id) · ID Lot Komponen (component_lot_id) · Jumlah Terpakai (qty_consumed)

**Database Pergerakan Stok** (`stock_movements`)
- ID Pergerakan (stock_movement_id) · ID Perusahaan (company_id) · ID Lot (lot_id) · Jenis Pergerakan (movement_type) · Jumlah (qty) · Dokumen Referensi (reference_doc) · Tanggal (created_at) · Dibuat Oleh (created_by)

---

## Kelompok 4: Procurement & Sales

**Database Pemasok** (`suppliers`)
- ID Pemasok (supplier_id) · ID Perusahaan (company_id) · Nama (name) · Info Kontak (contact_info) · Lead Time Hari (lead_time_days) · Jenis Pemasok (supplier_type)

**Database Header PO ke Supplier** (`purchase_orders`)
- ID PO (purchase_order_id) · ID Perusahaan (company_id) · ID Supplier (supplier_id)
- ID Lokasi Pabrik — alamat kirim, tujuan gudang (production_plant_id)
- Status (status) · Tanggal Order (order_date) · Tanggal Diharapkan (expected_date)

**Database Detail Item PO ke Supplier** (`purchase_order_lines`)
- ID Baris (purchase_order_line_id) · ID PO (purchase_order_id) · ID Item (item_id) · Jumlah Dipesan dalam satuan beli (qty_ordered) · Jumlah Diterima (qty_received)
- Harga Satuan dalam satuan beli — boleh dilihat Purchasing (unit_price)

**Database Header Penerimaan Barang** (`goods_receipts`)
- ID Penerimaan (goods_receipt_id) · ID Perusahaan (company_id) · ID PO (purchase_order_id) · ID Lokasi Pabrik (production_plant_id) · Tanggal Terima (received_date) · Diterima Oleh (received_by) · Status (status)

**Database Detail Penerimaan Barang** (`goods_receipt_lines`)
- ID Baris (goods_receipt_line_id) · ID Penerimaan (goods_receipt_id) · ID Baris PO (purchase_order_line_id) · ID Item (item_id) · Jumlah Diterima dalam satuan beli (qty_received) · ID Lot Baru (lot_id)

**Database Client** (`customers`)
- ID Client (customer_id) · ID Perusahaan (company_id) · Nama (name)
- Tipe: perusahaan/perorangan (customer_type)
- Info Kontak (contact_info)

**Database Header PO dari Client** (`customer_purchase_orders`)
- ID PO Client (customer_purchase_order_id) · ID Perusahaan (company_id) · ID Client (customer_id) · Nomor PO Client (po_number) · Tanggal PO (po_date) · Tanggal Kirim Diminta (requested_ship_date)
- Nama PIC (pic_name) · Jabatan PIC (pic_position) · No HP PIC (pic_phone) · Email PIC (pic_email)
- Status: baru/ditunda/batal/sudah diproses (status)
- Syarat Pembayaran (payment_terms) · Status Pembayaran (payment_status)
- Diproses Oleh (processed_by) · Waktu Diproses (processed_at)

**Database Detail Item PO dari Client** (`customer_purchase_order_lines`)
- ID Baris (customer_purchase_order_line_id) · ID PO Client (customer_purchase_order_id) · ID Item (item_id) · Jumlah Dipesan (qty_ordered)
- Harga Jual per Unit — SENSITIF (unit_price)

**Database Approval PO — 3 Department** (`customer_po_approvals`)
- ID Approval (customer_po_approval_id) · ID PO Client (customer_purchase_order_id)
- Department: finance/ppic/manager (department) · Status: menunggu/disetujui/ditolak (status)
- Disetujui Oleh — level manager (approved_by) · Waktu Disetujui (approved_at) · Catatan (notes)

**Database Header SO** (`sales_orders`)
- ID SO (sales_order_id) · ID Perusahaan (company_id) · ID PO Client Asal (customer_purchase_order_id) · ID Client (customer_id)
- Nomor SO Internal — format sendiri, beda dari nomor PO client (so_number)
- ID Lokasi Pabrik — dipilih wajib saat "Process" (production_plant_id)
- Status (status) · Tanggal Dibuat (created_at)

**Database Detail Item SO** (`sales_order_lines`)
- ID Baris (sales_order_line_id) · ID SO (sales_order_id) · ID Item (item_id) · Jumlah Dipesan (qty_ordered)
- Harga Jual per Unit — SENSITIF, disalin dari PO (unit_price)

**Database Header Pengiriman** (`shipments`)
- ID Pengiriman (shipment_id) · ID Perusahaan (company_id) · ID SO (sales_order_id) · Tanggal Kirim (shipment_date) · Status (status)

**Database Detail Item Dikirim** (`shipment_lines`)
- ID Baris (shipment_line_id) · ID Pengiriman (shipment_id) · ID SO Line (sales_order_line_id) · ID Item (item_id) · Jumlah Dikirim (qty_shipped) · ID Lot (lot_id)

---

## Kelompok 5: Produksi

**Database Perintah Produksi / SPK** (`work_orders`)
- ID Work Order (work_order_id) · ID Perusahaan (company_id) · ID Lokasi Pabrik (production_plant_id) · ID Item (item_id) · ID BOM (bom_id) · ID Routing (routing_id)
- ID SO Line Asal — nullable, 1 SO line bisa banyak WO (sales_order_line_id)
- Jumlah Rencana (planned_qty)
- Status: rencana/berjalan/dijeda/selesai/batal (status)
- Prioritas: rendah/normal/tinggi/mendesak (priority)
- Jadwal Mulai (scheduled_start) · Jadwal Selesai (scheduled_end) · Waktu Aktual Mulai (actual_start_at) · Waktu Aktual Selesai (actual_completed_at)
- ID Subkontraktor (subcontractor_id)

> WO dianggap "siap mulai" kalau tidak ada `system_alerts` terbuka yang terkait WO itu (bahan kurang/SDM kurang/mesin rusak) — mekanisme dependency otomatis, bukan link manual antar-WO.

**Database Batch Produksi** (`production_batches`)
- ID Batch (production_batch_id) · ID Perusahaan (company_id) · ID Work Order (work_order_id) · Nomor Batch (batch_number)
- ID Shift (shift_id) · Jumlah Rencana — bebas diatur PPIC, tidak terpaku ukuran standar BOM (planned_qty) · Satuan (uom)
- Tanggal Rencana — kapan batch SEHARUSNYA dikerjakan, dasar Dashboard Kapasitas (planned_date)
- Status: rencana/berjalan/selesai/batal (status) · Waktu Mulai (started_at) · Waktu Selesai (completed_at)

> 1 Work Order biasanya dikerjakan lewat 3-5 batch fisik per shift — masing-masing punya bahan, hasil, dan jejak lot sendiri untuk traceability BPOM/halal.

**Database Hasil Produksi** (`work_order_outputs`)
- ID Hasil (work_order_output_id) · ID Work Order (work_order_id) · ID Batch (production_batch_id) · ID Item Hasil (item_id) · ID Shift (shift_id) · Jenis Output (output_type) · Jumlah (qty) · ID Lot Baru (lot_id)

**Database Bahan Terpakai** (`work_order_consumption`)
- ID Pemakaian (work_order_consumption_id) · ID Work Order (work_order_id) · ID Batch (production_batch_id) · ID Lot Komponen (component_lot_id) · Jumlah Terpakai (qty_consumed) · ID Shift (shift_id) · Waktu Dicatat (recorded_at)

**Database Penugasan Pekerja** (`work_order_assignments`) — *biaya SDM sensitif, lihat kontrol akses*
- ID Penugasan (work_order_assignment_id) · ID Work Order (work_order_id) · ID Batch (production_batch_id) · ID Pekerja (employee_id) · ID Tahap (routing_step_id) · ID Shift (shift_id)
- Status (status) · ID Penugasan Digantikan (replacement_for_assignment_id) · Jam Rencana (scheduled_hours) · Jam Aktual (actual_hours) · Jumlah Dihasilkan (qty_produced)

**Database Progres Tahap Produksi** (`work_order_step_progress`)
- ID Progres (work_order_step_progress_id) · ID Work Order (work_order_id) · ID Batch (production_batch_id) · ID Tahap (routing_step_id) · ID Shift (shift_id) · Status (status) · Jumlah Tercatat (qty_recorded) · Satuan (uom) · Waktu Mulai (started_at) · Waktu Selesai (completed_at) · Catatan (notes)

**Database Notifikasi Sistem** (`system_alerts`)
- ID Alert (system_alert_id) · ID Perusahaan (company_id)
- Jenis Alert: kekurangan bahan/PO telat/stok rendah/produksi terlambat/pekerja absen/gangguan produksi/SO siap produksi/PO butuh approval/**proyeksi stok habis**/**risiko kadaluarsa karena jarang dipakai** (alert_type)
- ID Work Order Terkait, ID PO Terkait, ID Item Terkait (nullable) · Pesan (message) · Tingkat Keparahan (severity) · Status (status) · Tanggal Dibuat (created_at) · Dikonfirmasi Oleh (acknowledged_by) · Waktu Dikonfirmasi (acknowledged_at)

> Proyeksi stok/kadaluarsa dihitung dari rata-rata pemakaian harian (`work_order_consumption`), dihitung ulang tiap ada data baru masuk (real-time, bukan terjadwal).

---

## Kelompok 6: Billing

**Database Tagihan** (`invoices`)
- ID Tagihan (invoice_id) · ID Perusahaan (company_id) · ID Paket Langganan (subscription_plan_id) · Jumlah (amount) · Status (status) · Referensi Payment Gateway (payment_gateway_ref) · Periode Mulai (period_start) · Periode Selesai (period_end)
