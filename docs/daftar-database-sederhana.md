# Daftar Database — Format Sederhana

Dokumen pendamping dari `rancangan-skema-database-mrp.md`. Tiap tabel ditulis sebagai satu "database" berdiri sendiri dengan daftar field-nya.

**Konvensi penamaan ID:** setiap primary key memakai pola `nama_tabel_tunggal_id`.

**Cara baca dokumen ini:** daftar field di tiap tabel menggambarkan skema yang SUDAH ADA di database sungguhan. Bagian yang masih rencana yang disepakati tapi BELUM dibangun ditandai eksplisit **`[RENCANA — BELUM DIBANGUN]`**, terpisah dari field yang sudah nyata.

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
- Status (status) · Foto Profil — file di Supabase Storage (avatar_url) · Tanda Tangan Digital — file di Supabase Storage (signature_url, 17 Agu 2026 — file LAMA tidak pernah dihapus/ditimpa saat ganti tanda tangan, supaya dokumen yang sudah ditandatangani tidak ikut berubah) · Tanggal Dibuat (created_at)

**Database Tanda Tangan Dokumen** (`document_signatures`, 17 Agu 2026)
- Fondasi GENERIK untuk dokumen apa pun yang butuh persetujuan bertanda tangan (dimulai dari Surat Jalan)
- ID Tanda Tangan (document_signature_id) · ID Perusahaan (company_id) · Jenis Dokumen (document_type, mis. "shipment") · ID Dokumen (document_id)
- Ditandatangani Oleh (signed_by) · Role Penandatangan Saat Itu (signer_role_at_signing — dicatat, tidak ikut berubah meski role user berubah kemudian)
- Salinan Gambar Tanda Tangan Saat Itu (signature_url_snapshot — BUKAN link hidup ke tanda tangan user sekarang, supaya dokumen lama tetap menunjukkan tanda tangan yang berlaku saat ditandatangani)
- Kalimat Konfirmasi (confirmation_text) · Waktu Tanda Tangan (signed_at)

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
- Jenis: mesin/listrik padam/faktor eksternal/dialihkan ke pekerjaan lain/**ganti produk (changeover, BARU 25 Agu 2026)**/lainnya (disruption_type)
- ID Lokasi Pabrik — wajib diisi (production_plant_id)
- ID Mesin — kosong kalau gangguan menyeluruh (work_center_id) · ID Work Order (work_order_id) · ID Batch (production_batch_id) · ID Tahap (routing_step_id) · ID Shift (shift_id) · Waktu Mulai (started_at) · Waktu Selesai (resolved_at) · Keterangan (description)

**Database Pekerja** (`employees`) — *akses gaji dibatasi, lihat kontrol akses di atas*
- ID Pekerja (employee_id) · ID Perusahaan (company_id) · ID Lokasi Pabrik — nullable (production_plant_id) · Nama (name) · Posisi (position)
- Department: production/ppic/finance/purchasing/warehouse/hr/management/fat/rnd (department)
- Jenis Upah (wage_type) · Tarif Upah — SENSITIF (wage_rate) · ID User Terkait (linked_user_id) · Status Aktif (is_active)
- Kode Karyawan Pabrik (factory_employee_code, mis. "2508001") · Status Kepegawaian: kontrak/phl/freelance (employment_status)
- Status PTKP (ptkp_status) · Golongan TER (ter_category) · Tarif TER % (ter_rate_percent) — SEMUA SENSITIF, akses sama dengan Tarif Upah
- Tunjangan Makan/Hari (daily_meal_allowance) · Tunjangan Transport/Hari (daily_transport_allowance) — SENSITIF, per karyawan (bukan tabel tarif per jabatan)
- Ikut BPJS Kesehatan? (bpjs_kesehatan_enrolled) — SENSITIF, kosong berarti belum dikonfirmasi (bukan berarti tidak ikut)

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
- Harga Belum Terverifikasi? — BARU 26 Agu 2026, beda dari "harga kosong": di sini harga ADA tapi belum dikonfirmasi purchasing (cost_unverified) · Catatan (cost_unverified_note)
- Nomor Registrasi BPOM — nullable (bpom_registration_number)

> Catatan: MOQ (minimum order quantity) sengaja tidak dimodelkan — Purchasing input sesuai realita pembelian.

**Database Resep/Komposisi** (`boms`)
- ID BOM (bom_id) · ID Perusahaan (company_id) · ID Item Induk (parent_item_id) · Versi (version) · Jumlah Hasil Standar (standard_yield_qty) · Satuan Hasil (standard_yield_uom) · Status (status)
- Persentase Buffer — diatur PPIC, kompensasi kehilangan produksi (buffer_percentage)

**Database Detail Komponen Resep** (`bom_lines`)
- ID Baris (bom_line_id) · ID BOM (bom_id) · ID Item Komponen (component_item_id) · Jumlah per Unit Output (qty_per_unit_output) · Satuan (uom)
- ID Tahap Routing — nullable, tahap alur produksi ITEM INDUK yang mulai memakai komponen ini (mis. kemasan box baru dipakai di tahap "Filling Box", bukan sejak tahap pertama); kosong = dianggap dibutuhkan sejak tahap pertama, supaya kelayakan jadwal (Sales Order) bisa membedakan bahan yang menghalangi MULAI produksi vs yang cuma menghalangi SELESAI/kirim (routing_step_id)

**Database Mesin/Stasiun Kerja** (`work_centers`)
- ID Mesin (work_center_id) · ID Perusahaan (company_id) · ID Lokasi Pabrik (production_plant_id) · Nama Mesin (name) · Kode Mesin (code) · Status Aktif (is_active)
- Kapasitas Jam per Hari — nullable, PER UNIT mesin, dasar Dashboard Kapasitas (capacity_hours_per_day)
- Jumlah Unit — default 1, jumlah mesin identik yang jalan paralel (mis. 2 mesin Filling Sachet); kapasitas total efektif = Kapasitas Jam per Hari × Jumlah Unit (unit_count)

**Database Header Alur Produksi** (`routings`)
- ID Routing (routing_id) · ID Perusahaan (company_id) · ID Item (item_id) · Versi (version)
- **[RENCANA — BELUM DIBANGUN]** Status: draft/aktif/diarsipkan (status) — dengan aturan edit = versi baru begitu status `aktif`; detail di `rancangan-skema-database-mrp.md`

**Database Tahapan Produksi** (`routing_steps`)
- ID Tahap (routing_step_id) · ID Routing (routing_id) · Nomor Urut (sequence_no) · Nama Tahap (step_name) · Durasi Aktif Menit (active_duration_minutes) · Durasi Tunggu Menit (wait_duration_minutes) · ID Mesin (work_center_id)
- Durasi per Unit (Laju) — nullable, menit per 1 unit qty batch, untuk tahap berkecepatan mesin (mis. Filling Sachet); kalau terisi, dipakai sebagai durasi sebenarnya (qty × nilai ini) di Gantt/Kapasitas/kelayakan, menggantikan Durasi Aktif Menit tetap (duration_per_unit_minutes)

**Database Referensi Formula** (`formula_templates`)
- ID Formula (formula_template_id) · ID Perusahaan (company_id) · Nama (name) · Catatan (notes) · Komposisi Referensi (reference_composition)

**Database Standar Produksi** (`production_standards`) — K8, 18-19 Agu 2026
- ID Standar (production_standard_id) · ID Perusahaan (company_id) · ID Item (item_id) · ID Tahap (routing_step_id, nullable)
- Jenis Metrik: persen yield/unit per batch/durasi aktif menit/batch per hari (metric_key) · Nilai (value)
- Sumber: estimasi manual/dipelajari dari data (source) · Jumlah Sampel (sample_count) · Terakhir Dihitung (last_calculated_at)
- Dikunci? (pinned) · Alasan Dikunci (pin_reason) — supaya tidak ikut dipelajari otomatis
- Disahkan Oleh (last_approved_by) · Waktu Sahkan (last_approved_at)
- Perubahan nilai TIDAK PERNAH otomatis — sistem hanya mengusulkan (lihat tabel usulan di bawah), planner yang mengesahkan

**Database Usulan Standar Produksi** (`production_standard_proposals`)
- ID Usulan (production_standard_proposal_id) · ID Perusahaan (company_id) · ID Item (item_id) · ID Tahap (routing_step_id)
- Jenis Metrik (metric_key) · Nilai Lama/Sumber Lama (old_value/old_source) · Nilai Diusulkan (proposed_value)
- Cara Hitung: median/rata-rata dibuang pencilan (calculation_method) · Jumlah Sampel (sample_count)
- Status: menunggu/disetujui/ditolak (status) · Diputuskan Oleh (decided_by) · Waktu Putus (decided_at)

**Database Sampel Standar Produksi** (`production_standard_samples`)
- ID Sampel (production_standard_sample_id) · ID Perusahaan (company_id) · ID Item (item_id) · ID Tahap (routing_step_id, nullable)
- Jenis Metrik (metric_key) · Nilai Sampel (sample_value) · Waktu Catat (recorded_at)

**Database Pengecualian Standar Produksi** (`production_standard_exclusions`)
- ID Pengecualian (production_standard_exclusion_id) · ID Perusahaan (company_id) · ID Batch (production_batch_id) · ID Item (item_id)
- Alasan (reason) · ID Tahap yang Datanya Kosong (missing_routing_step_ids) · Waktu Catat (created_at)
- Batch yang gagal gerbang kelengkapan data tahap — dicatat sebagai log, bukan dilewati diam-diam

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
- Kode Alasan — nullable, cuma untuk penyesuaian manual: selisih stok opname/kerusakan/lainnya (reason_code) · Catatan Bebas — nullable, wajib kalau alasan "lainnya" (notes)

> Penyesuaian Stok Manual: form di Dashboard Warehouse (khusus Manager Warehouse + Direktur/GM, BUKAN staf Warehouse biasa) — pilih lot, isi jumlah (boleh minus), wajib pilih alasan. Stok lot dan riwayat pergerakan ter-update bersamaan (1 transaksi), tidak bisa bikin stok jadi minus.

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
- Kunci Anti-Duplikat — nullable, cegah submit ganda (idempotency_key)

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
- Kunci Anti-Duplikat — nullable, diisi otomatis server (bukan client) supaya double-click "Process" tidak bikin 2 SO untuk 1 PO yang sama (idempotency_key)

**Database Detail Item SO** (`sales_order_lines`)
- ID Baris (sales_order_line_id) · ID SO (sales_order_id) · ID Item (item_id) · Jumlah Dipesan (qty_ordered)
- Harga Jual per Unit — SENSITIF, disalin dari PO (unit_price)
- Jumlah Sudah Dikirim (qty_shipped) — otomatis bertambah tiap ada pengiriman berstatus "shipped" (17 Agu 2026)

**Database Baseline Margin (Margin Watch)** (`sales_order_line_margin_snapshots`)
- ID Baris SO (sales_order_line_id, unik) · Harga Jual (unit_price) · Biaya Bahan Standar per Unit (standard_material_cost_per_unit) · Biaya Kemasan Standar per Unit (standard_packaging_cost_per_unit)
- Biaya SDM Standar per Unit (standard_labor_cost_per_unit) — 20 Agu 2026: SEKARANG SUDAH dihitung dari data kru nyata (lihat tabel Kru Standar Lini Produksi di bawah), sebelumnya selalu kosong
- SDM Sudah Lengkap? (labor_cost_complete) · Catatan Bagian Mana Belum Terhitung (labor_cost_notes) — kalau ada tahap produksi yang kru-nya belum diisi datanya, angka yang tampil tetap dihitung dari bagian yang SUDAH ada datanya (bukan disembunyikan jadi kosong), tapi ditandai belum 100% lengkap
- Data Biaya Lengkap? (cost_data_complete) · Kode Item yang Belum Punya Harga Master (missing_cost_item_codes)
- Kode Item Harganya Belum Terverifikasi — BARU 26 Agu 2026, beda dari di atas: harga ADA dan ikut dihitung, cuma belum dikonfirmasi purchasing (unverified_cost_item_codes)
- Ambang Margin Minimum — satu-satunya yang boleh diubah kapan saja, kirim peringatan kalau proyeksi margin turun di bawahnya (margin_floor_threshold)
- Dikunci sekali saat pertama kali panel Margin Watch dibuka untuk baris SO itu — tidak berubah lagi meski harga master berubah belakangan (sama seperti standar K8/kelayakan jadwal)

**Database Kru Standar Lini Produksi** (`routing_step_standard_crew`, 20 Agu 2026)
- Berapa orang, tipe upah (harian/bulanan/per jam), dan jam kerja standar untuk 1 lini produksi (per routing, bukan per tahap) — dipakai untuk menghitung Biaya SDM Standar per Unit di atas
- Diisi dari data lapangan nyata (jumlah orang tiap tahap produksi gummy & serbuk yang diberikan pemilik pabrik), bukan tebakan
- Rumus: (total gaji harian semua kru lini itu) ÷ (jumlah batch standar yang bisa diproduksi lini itu dalam 1 hari) — supaya 1 kru yang sama tidak dihitung berkali-kali untuk tiap batch yang mereka kerjakan dalam sehari

**Database Header Pengiriman** (`shipments`)
- ID Pengiriman (shipment_id) · ID Perusahaan (company_id) · ID SO (sales_order_id) · Tanggal Kirim (shipment_date) · Status (status: draft/shipped/delivered/cancelled)
- Nomor Surat Jalan (shipment_number, otomatis dibuat, unik per perusahaan) · Nomor Kendaraan (vehicle_number) · Nama Sopir (driver_name)
- Alamat Tujuan (delivery_address, WAJIB diisi tiap pengiriman) · Nama Penerima (recipient_name) · No. HP Penerima (recipient_phone)
- Foto Bukti Pengiriman (dispatch_photo_url, 17 Agu 2026) — WAJIB diupload staf gudang saat menekan "Proses Pengiriman", baru setelah foto tersimpan status berubah jadi "shipped" dan stok berkurang
- Token Bukti Penerimaan (pod_token, 17 Agu 2026) — dibuat otomatis & acak saat status jadi "shipped", dipakai di link/QR code yang di-scan client untuk konfirmasi barang diterima TANPA perlu login

**Database Detail Item Dikirim** (`shipment_lines`)
- ID Baris (shipment_line_id) · ID Pengiriman (shipment_id) · ID SO Line (sales_order_line_id) · ID Item (item_id) · Jumlah Dikirim (qty_shipped) · ID Lot (lot_id, WAJIB diisi — jejak lot untuk tiap pengiriman)

**Database Bukti Penerimaan dari Client** (`delivery_confirmations`, 17 Agu 2026)
- ID Konfirmasi (delivery_confirmation_id) · ID Pengiriman (shipment_id)
- Foto Bukti Diterima (photo_url, foto dari CLIENT saat scan QR — beda dari dispatch_photo_url yang dari staf gudang) · Nama Penerima (received_by_name, diisi manual oleh client, opsional) · Waktu Dikonfirmasi (confirmed_at)
- Diisi lewat halaman publik `/pod/[token]` — client scan QR code di Surat Jalan fisik, TANPA perlu akun/login sama sekali. Setelah konfirmasi berhasil, status pengiriman otomatis berubah jadi "delivered" dan link/QR yang sama tidak bisa dipakai lagi.

> **17 Agu 2026:** Stok baru benar-benar berkurang saat status pengiriman diubah jadi "shipped" lewat tombol "Proses Pengiriman" (bukan saat baris ditambahkan) — supaya staf bisa siapkan draft pengiriman dulu tanpa stok berkurang duluan sebelum benar-benar dikirim. Sejak revisi hari yang sama, tombol ini WAJIB disertai upload foto bukti pengiriman sebagai bukti visual barang benar-benar dimuat/dikirim.

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
- ID Batch (production_batch_id) · ID Perusahaan (company_id) · ID Work Order (work_order_id) · Nomor Batch — rekomendasi otomatis, boleh ditimpa staf dengan format sendiri, unik per PERUSAHAAN (batch_number)
- ID Shift (shift_id) · Jumlah Rencana — bebas diatur PPIC, tidak terpaku ukuran standar BOM (planned_qty) · Satuan (uom)
- Tanggal Rencana — kapan batch SEHARUSNYA dikerjakan, dasar Dashboard Kapasitas (planned_date)
- Status: rencana/berjalan/selesai/batal (status) · Waktu Mulai (started_at) · Waktu Selesai (completed_at)
- Rework? — ditandai saat "Selesaikan Batch", BARU 25 Agu 2026 (rework)

> 1 Work Order biasanya dikerjakan lewat 3-5 batch fisik per shift — masing-masing punya bahan, hasil, dan jejak lot sendiri untuk traceability BPOM/halal.

**Database Hasil Produksi** (`work_order_outputs`)
- ID Hasil (work_order_output_id) · ID Work Order (work_order_id) · ID Batch (production_batch_id) · ID Item Hasil (item_id) · ID Shift (shift_id) · Jenis Output (output_type) · Jumlah (qty) · ID Lot Baru (lot_id)

**Database Bahan Terpakai** (`work_order_consumption`)
- ID Pemakaian (work_order_consumption_id) · ID Work Order (work_order_id) · ID Batch (production_batch_id) · ID Lot Komponen (component_lot_id) · Jumlah Terpakai (qty_consumed) · ID Shift (shift_id) · Waktu Dicatat (recorded_at)

**Database Penugasan Pekerja** (`work_order_assignments`) — *biaya SDM sensitif, lihat kontrol akses*
- ID Penugasan (work_order_assignment_id) · ID Work Order (work_order_id) · ID Batch (production_batch_id) · ID Pekerja (employee_id) · ID Tahap (routing_step_id) · ID Shift (shift_id)
- Status (status) · ID Penugasan Digantikan (replacement_for_assignment_id) · Jam Rencana (scheduled_hours) · Jam Aktual (actual_hours) · Jumlah Dihasilkan (qty_produced)
- Penanda Lembur — tidak mengubah tarif (tarif lembur belum ditentukan), cuma penanda untuk dikoreksi nanti (is_overtime)

**Database Progres Tahap Produksi** (`work_order_step_progress`)
- ID Progres (work_order_step_progress_id) · ID Work Order (work_order_id) · ID Batch (production_batch_id) · ID Tahap (routing_step_id) · ID Shift (shift_id)
- Jumlah Masuk ke Tahap Ini (qty_input) · Satuan Masuk — bisa beda dari keluaran (uom_input)
- Status (status) · Jumlah Keluar/Dihasilkan BAIK (qty_recorded) · Satuan Keluar (uom) · Waktu Mulai (started_at) · Waktu Selesai (completed_at) · Catatan (notes)
- Jumlah Reject — cacat/gagal di tahap ini, terpisah dari susut proses biasa (qty_reject) · Alasan Reject, teks bebas (reject_reason)
- Waktu Mulai/Selesai TIDAK dipaksa "sekarang" — staf bisa pilih tanggal kejadian sebenarnya saat mencatat (boleh mundur beberapa hari, tidak boleh maju atau sebelum batch dibuat)

**Database Notifikasi Sistem** (`system_alerts`)
- ID Alert (system_alert_id) · ID Perusahaan (company_id)
- Jenis Alert: kekurangan bahan/PO telat/stok rendah/produksi terlambat/pekerja absen/gangguan produksi/SO siap produksi/PO butuh approval/**proyeksi stok habis**/**risiko kadaluarsa karena jarang dipakai**/**proyeksi margin di bawah ambang** (alert_type)
- Department Tujuan — nullable, null berarti terlihat semua department; company_admin/general_manager selalu lihat semua terlepas kolom ini (target_department)
- ID Work Order Terkait, ID PO Terkait, ID Item Terkait (nullable) · Pesan (message) · Tingkat Keparahan (severity) · Status (status) · Tanggal Dibuat (created_at) · Dikonfirmasi Oleh (acknowledged_by) · Waktu Dikonfirmasi (acknowledged_at)

> Proyeksi stok/kadaluarsa dihitung dari rata-rata pemakaian harian (`work_order_consumption`), dihitung ulang tiap ada data baru masuk (real-time, bukan terjadwal).

> Department Tujuan ditentukan OTOMATIS dari jenis alert (bukan diisi manual): kekurangan bahan/proyeksi stok habis/risiko kadaluarsa/stok rendah → Purchasing + Warehouse; pekerja absen → Production + HR; gangguan produksi/produksi terlambat → Production + PPIC; SO siap produksi → PPIC; PO butuh approval → sesuai department approval yang bersangkutan (Finance/PPIC/Manajemen); PO telat → Purchasing. Kalau 1 alert relevan untuk lebih dari 1 department, dibuat lebih dari 1 baris (1 baris per department) — ditampilkan di Bell Icon Notifikasi header aplikasi, badge-nya cuma menghitung alert yang relevan untuk department user yang login.

**Database Aturan Transisi Status** (`status_transition_rules`)
- ID Aturan (status_transition_rule_id) · Nama Tabel (table_name) · Status Asal (from_status) · Status Tujuan (to_status)

> Daftar transisi status yang SAH per tabel — ditegakkan LANGSUNG di database (bukan cuma di kode aplikasi) lewat trigger, jadi tidak bisa dilewati walau lewat koneksi service-role sekalipun. Diterapkan ke 5 tabel (16 Agu 2026): PO Client, SO, Work Order, Batch Produksi, Approval PO Client. Contoh yang DITOLAK: PO Client status "Batal" lompat jadi "Sudah Diproses".

**Database Riwayat Transisi Status** (`status_transition_log`)
- ID Riwayat (status_transition_log_id) · ID Perusahaan (company_id) · Nama Tabel (table_name) · ID Baris (record_id)
- Status Asal (from_status) · Status Tujuan (to_status) · Diubah Oleh — nullable (changed_by) · Waktu (changed_at) · Alasan — nullable (reason)

> Dicatat OTOMATIS oleh trigger yang sama di atas, setiap kali ada transisi status yang sah — audit trail terpusat, beda dari kolom `approved_by`/`acknowledged_by` per tabel yang cuma menyimpan aksi terakhir (riwayat sebelumnya hilang tertimpa).

---

## Kelompok 6: Billing

**Database Tagihan** (`invoices`)
- ID Tagihan (invoice_id) · ID Perusahaan (company_id) · ID Paket Langganan (subscription_plan_id) · Jumlah (amount) · Status (status) · Referensi Payment Gateway (payment_gateway_ref) · Periode Mulai (period_start) · Periode Selesai (period_end)

---

## Kelompok 7: Kamus (21 Agu 2026)

**Database Istilah Kamus** (`kamus_terms`)
- ID Istilah (kamus_term_id) · ID Perusahaan (company_id) · Cakupan (scope: Field/Metrik/Relasi/Aturan)
- Nama Tabel (entity) · Nama Kolom (field) · Kunci Istilah (term_key) · Prioritas 1-5 (priority)
- Kategori (domain: uang/kuantitas/status/standar/proses/lainnya) · Departemen Disarankan (suggested_role)
- Status (status: Belum/Draf AI/Dijawab/Dikonfirmasi/Tidak Relevan) · Draf AI (ai_draft)
- Jawaban Sederhana/Jebakan/Rentang Wajar (answer_plain/answer_pitfall/answer_range)
- Dijawab/Dikonfirmasi Oleh & Kapan (answered_by/at, confirmed_by/at) · Ditugaskan ke (assigned_to_role) · Versi (version)

**Database Riwayat Istilah Kamus** (`kamus_term_history`)
- ID Riwayat (kamus_term_history_id) · ID Istilah (kamus_term_id) · Diubah Oleh/Kapan (changed_by/changed_at) · Field Berubah (field_changed) · Nilai Lama/Baru (old_value/new_value)

**Database Aturan Routing Kamus** (`kamus_routing_rules`)
- ID Aturan (kamus_routing_rule_id) · ID Perusahaan (company_id) · Kategori (domain) · Pola Nama (entity_pattern) · Departemen Disarankan (suggested_role) · Alasan (rationale)

> Semua staf company boleh baca (antrean terbuka utk siapa saja yang tahu jawab). Tulis hanya lewat sistem, tidak ada jalan pintas.

---

## Kelompok 8: Dashboard Proyek AI (21 Agu 2026)

> Khusus pemilik & manajemen (leadership) — alat internal roadmap fitur AI, bukan fitur operasional harian.

**Database Fase Proyek AI** (`ai_project_phases`)
- ID Fase (ai_project_phase_id) · ID Perusahaan (company_id) · Kode (code) · Nama (name) · Keterangan (description) · Bobot % (weight_percent) · Urutan (sort_order) · Status (status)

**Database Tugas Proyek AI** (`ai_project_tasks`)
- ID Tugas (ai_project_task_id) · ID Fase (ai_project_phase_id) · Kode/Nama/Keterangan · Bobot % dalam fase (weight_percent)
- Jenis Pemilik (owner_type: Pemilik Produk/Tim/Claude Code/Campuran) · Departemen Disarankan (suggested_role)
- Sumber Progres (progress_source: Hitung Otomatis/Checklist/Persen Manual) · Kunci Rumus (progress_key)
- Jenis Aksi & Tujuannya (action_type/action_target) · Prasyarat (blocked_by) · Status · Urutan
- Persen Manual + Siapa/Kapan (manual_percent/manual_percent_set_by/at) — HANYA dipakai kalau sumber progresnya "Persen Manual"

**Database Checklist Tugas Proyek AI** (`ai_project_checklist_items`)
- ID Item (ai_project_checklist_item_id) · ID Tugas (ai_project_task_id) · Label (label) · Selesai? (done) · Diselesaikan Oleh/Kapan (done_by/at) · Catatan (note) · Urutan (sort_order)

**Database Snapshot Progres Proyek AI** (`ai_project_progress_snapshots`)
- ID Snapshot (ai_project_progress_snapshot_id) · ID Perusahaan (company_id) · Diambil Kapan (taken_at) · Persen Total (overall_percent) · Rincian per Fase (per_phase)

---

## Kelompok 9: Kesiapan AI Tenant (22-24 Agu 2026)

> Terlihat SEMUA staf login (beda dari Dashboard Proyek AI yang khusus leadership) — skor kesiapan tiap kemampuan AI perusahaan.

**Database Katalog Kemampuan AI** (`ai_capabilities`) — sama untuk semua tenant (belum bisa dikonfigurasi per perusahaan)
- ID Kemampuan (ai_capability_id) · Kode (code) · Nama/Keterangan (name/description) · Tingkat (tier: Inti/Wawasan/Copilot) · Urutan (sort_order)

**Database Prasyarat Kemampuan AI** (`ai_capability_requirements`)
- ID Prasyarat (ai_capability_requirement_id) · ID Kemampuan (capability_id) · Kode/Label · Kunci Metrik (metric_key) · Ambang (threshold) · Pembanding (comparator: ≥/≤) · Bobot (weight) · Mengunci Keras? (is_blocking) · Urutan

**Database Status Kesiapan AI** (`ai_capability_status`) — dihitung ulang otomatis, bukan diisi manual
- ID Status (ai_capability_status_id) · ID Perusahaan (company_id) · ID Kemampuan (capability_id) · Persen Siap (readiness_percent) · Terbuka? (is_unlocked) · Alasan Terkunci (blocking_reasons) · Dihitung Kapan (computed_at)

**Database Pengecualian Kemampuan AI** (`ai_capability_overrides`) — HANYA staf platform kami (super_admin), BUKAN admin perusahaan tenant manapun
- ID (ai_capability_override_id) · ID Perusahaan (company_id) · ID Kemampuan (capability_id) · Dibuka Oleh (unlocked_by) · Alasan (reason) · Kedaluwarsa (expires_at)

**Database Umpan Balik Jawaban AI** (`ai_answer_feedback`) — disiapkan, belum ada fitur AI yang memakainya
- ID (ai_answer_feedback_id) · ID Perusahaan (company_id) · ID Kemampuan (capability_id) · ID Pengguna (user_id) · Pertanyaan/Jawaban (question/answer) · Alasan Feedback (feedback_reason) · Cuplikan Kesiapan (readiness_snapshot)

---

## Kelompok 10: Absensi Geo-QR — Gelombang 1 (23 Agu 2026)

> HANYA Gelombang 1 (pencatatan dasar). Gelombang 2-5 (QR dinamis tablet, aplikasi karyawan, konsol HRD penuh, integrasi kapasitas) BELUM dikerjakan.

**Database Kejadian Absensi** (`attendance_events`) — CATATAN PERMANEN, tidak pernah diedit/dihapus
- ID Kejadian (attendance_event_id) · ID Perusahaan (company_id) · ID Karyawan (employee_id) · ID Lokasi Pabrik (production_plant_id)
- Jenis (event_type: Masuk/Keluar/Mulai Istirahat/Selesai Istirahat) · Waktu Kejadian (occurred_at)
- Cara Absen (method: QR Tablet/GPS HP/Manual HRD) · Lokasi GPS (lat/lng/accuracy_m)
- Status Area (geofence_status: Dalam/Luar/Tanpa GPS) · ID Perangkat (device_id) · ID Token QR (qr_token_id, disiapkan utk nanti)
- ID Kejadian dari Aplikasi (client_event_id, mencegah tercatat dobel) · Foto (photo_url) · Dicatat Oleh (recorded_by, kalau manual HRD)

**Database Perangkat Absensi** (`attendance_devices`)
- ID (attendance_device_id) · ID Perusahaan (company_id) · ID Karyawan (employee_id) · Sidik Jari Perangkat (device_fingerprint) · Jenis (device_type: HP Karyawan/Tablet Gerbang) · Status (Aktif/Menunggu Persetujuan/Dicabut) · Terdaftar Kapan (registered_at) · Disetujui Oleh/Kapan (approved_by/at)

**Database Koreksi Absensi** (`attendance_corrections`)
- ID Koreksi (attendance_correction_id) · ID Perusahaan (company_id) · ID Karyawan (employee_id) · Tanggal (attendance_date)
- Jenis Diminta (requested_event_type: Masuk/Keluar) · Waktu Diminta (requested_occurred_at) · Alasan (reason)
- Status (Menunggu/Disetujui/Ditolak) · Diminta/Diputuskan Oleh & Kapan · Hasil jadi Kejadian Baru (resulting_event_id)

**Database Pengajuan Izin/Sakit/Cuti** (`leave_requests`)
- ID Pengajuan (leave_request_id) · ID Perusahaan (company_id) · ID Karyawan (employee_id) · Jenis (leave_type: Izin/Sakit/Cuti)
- Tanggal Mulai/Selesai (start_date/end_date) · Alasan (reason) · Lampiran (attachment_url) · Status · Diminta/Diputuskan Oleh & Kapan

> **Database Kehadiran Karyawan** (`employee_attendance`, sudah ada sejak Kelompok 2) DIPERLUAS gelombang ini: kolom baru ID Lokasi Pabrik, Menit Kerja/Terlambat/Lembur (dihitung otomatis dari kejadian di atas, bukan diketik), Jejak Kejadian Sumber, Status Area, Tanda Khusus (flags). Sekarang dihitung ULANG dari `attendance_events`, bukan diisi manual lagi.
> **Database Lokasi Pabrik** (`production_plants`, Kelompok 2) dapat 3 kolom baru: Titik Tengah Lintang/Bujur & Radius Area (center_lat/center_lng/geofence_radius_meters) — 1 pabrik = 1 area, tanpa tabel terpisah.

---

## Kelompok 11: KPI (25 Agu 2026)

> Catatan: 4 modul sebelumnya (Kamus, Dashboard Proyek AI, Kesiapan AI, Absensi) sempat
> ditemukan belum pernah ditambahkan ke dokumen ini — sudah dilengkapi sebagai Kelompok
> 7-10 di atas pada sesi yang sama (25 Agu 2026).

**Database Daftar KPI** (`kpi_registry`)
- ID KPI (kpi_registry_id) · ID Perusahaan (company_id) · Kunci Metrik di Kamus (metric_key)
- Jenis: Disiplin atau Hasil (kind) · Pilar (pillar: Efisiensi/Optimasi/Transparansi/Improvement/Record)
- Peran Pemilik (owner_role) · Frekuensi (frequency: Harian/Mingguan/Bulanan/Per Kejadian)
- Target (target_value) — nullable, kosong = "baseline dulu, target kemudian" · Kapan/Siapa Set Target (target_set_at/target_set_by)
- Benchmark Industri (benchmark_value/benchmark_label/benchmark_source) — arah, bukan kontrak
- Ambang Peringatan/Bahaya (warn_threshold/alert_threshold)
- Tingkat Keadilan Atribusi (attribution_level: Individu/Tim/Lini/Proses/Perusahaan) · Siapa Boleh Lihat (visibility)
- Cara Menaikkan KPI Ini (improvement_levers) — belum diisi

> "Disiplin" = target ideal terkunci sejak hari pertama, tidak bisa diubah tenant. "Hasil" =
> nilai dibiarkan terekam dulu (baseline), target diisi belakangan oleh pemilik KPI.

**Database Riwayat Nilai KPI** (`kpi_snapshots`)
- ID Snapshot (kpi_snapshot_id) · ID Perusahaan (company_id) · Kunci Metrik (metric_key)
- Periode Mulai/Selesai (period_start/period_end) · Nilai (value) — nullable kalau belum bisa dihitung
- Kapan Dihitung (computed_at) · Jejak Data Sumber (inputs_hash)

> Dihitung otomatis tiap halaman KPI dibuka (belum ada penjadwal/cron di proyek ini).

**Database Tindakan KPI** (`kpi_actions`) — skema siap, belum ada halaman untuk membuatnya
- ID Tindakan (kpi_action_id) · ID KPI (kpi_registry_id) · Periode (period) · Temuan (finding) · Tindakan (action_text)
- Penanggung Jawab: Peran atau Orang (owner_role/owner_user_id) · Tenggat (due_date) · Status (status: Terbuka/Berjalan/Selesai/Batal)

**Database Penanggung Jawab KPI** (`kpi_responsibilities`)
- ID (kpi_responsibility_id) · ID KPI (kpi_registry_id) · Peran atau Orang (role/user_id) · Peran Tanggung Jawab (responsibility: Pemilik/Kontributor/Pendukung) · Catatan (note)

**Database Riwayat Perubahan KPI** (`kpi_registry_history`)
- ID Riwayat (kpi_registry_history_id) · ID KPI (kpi_registry_id) · Diubah Oleh/Kapan (changed_by/changed_at) · Field yang Berubah (field_changed) · Nilai Lama/Baru (old_value/new_value)

---

## Kelompok 12: Master Dokumen (MD-1, 26 Agu 2026)

Satu tempat untuk semua berkas masuk/keluar sistem — PO klien, POD, surat jalan, COA, sertifikat Halal, spesifikasi bahan, kontrak, SOP. Registry DI ATAS storage yang sudah ada, bukan sistem upload kedua.

**Database Jenis Dokumen** (`document_types`) — konfigurasi per perusahaan
- ID (document_type_id) · Kode (code) · Nama (name) · Departemen Disarankan (owner_role) · Sensitivitas Default (sensitivity_default) · Wajib Ada Tanggal Kedaluwarsa? (requires_expiry) · Retensi Bulan (retention_months) · Hari Pengingat Sebelum Kedaluwarsa (reminder_days_before)
- Seed awal 9 jenis: PO Klien, POD, Surat Jalan, COA, Sertifikat Halal, Spesifikasi Bahan, Kontrak, SOP, Lainnya

**Database Dokumen** (`documents`)
- ID (document_id) · Jenis (doc_type) · Judul (title) · Nomor (doc_number) · Deskripsi (description)
- Lokasi Berkas (storage_path) · Tipe File (mime_type) · Ukuran (size_bytes) · Checksum (checksum_sha256)
- Penerbit (issued_by) · Tanggal Terbit/Berlaku/Kedaluwarsa (issued_date/effective_date/expiry_date)
- Status: Aktif/Kedaluwarsa/Diarsip/Diganti (status)
- Grup Versi (version_group_id) · Nomor Versi (version_no) · Digantikan Oleh (superseded_by)
- Sensitivitas: Umum/Departemen/Terbatas (sensitivity) · Departemen (department) · Diunggah Oleh/Kapan (uploaded_by/uploaded_at)

> Hapus = arsip. Dokumen bertaut entitas transaksi TIDAK PERNAH dihapus permanen. Hapus permanen HANYA untuk berkas yatim (tanpa tautan), HANYA oleh company_admin, dengan alasan wajib tercatat.
> Visibilitas TERBATAS/DEPARTEMEN ditegakkan DUA LAPIS (database DAN aplikasi) supaya tidak bisa dilewati.

**Database Tautan Dokumen** (`document_links`) — satu dokumen bisa menempel ke banyak entitas
- ID (document_link_id) · ID Dokumen (document_id) · Jenis Entitas (entity_type) · ID Entitas (entity_id) · Peran Tautan (link_role, mis. COA/SUMBER/SERTIFIKAT)

**Database Log Akses Dokumen** (`document_access_log`) — hanya leadership yang bisa baca
- ID (document_access_log_id) · ID Dokumen (document_id, nullable) · Nama Dokumen Tersimpan (document_title_snapshot) · Diakses Oleh (accessed_by) · Aksi: Lihat/Unduh/Hapus (action) · Alasan (reason) · Waktu (accessed_at)
- "Lihat" dicatat HANYA untuk dokumen Terbatas (supaya log tidak penuh tanpa nilai audit)

> 6 KPI awal sudah diisi (Margin Kontribusi, Margin Kontribusi %, Biaya per Unit, Laba Operasional, Yield per Tahap, Nilai Persediaan) — semua nilai target kosong TANPA KECUALI (baseline dulu, target kemudian). Margin Kontribusi % sempat punya target 35% (kebijakan GPM finance untuk konteks Gummy Zala/Drinkme lama) 25 Agu 2026, DICABUT 26 Agu 2026 (keputusan pemilik produk: angka itu khusus konteks lama, bukan kebijakan berlaku umum) saat studi kasus diganti MLVT.
