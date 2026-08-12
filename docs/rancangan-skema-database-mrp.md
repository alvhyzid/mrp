# Rancangan Skema Database — MRP Multi-Tenant
### PT. Indo Taste Manufacture (Tenant Pertama)

Dokumen ini adalah rancangan awal (draft v1) struktur database sistem MRP. Ditulis dalam bahasa yang mudah dibaca — nama tabel & kolom pakai istilah teknis standar (bahasa Inggris, konvensi umum database), penjelasannya dalam Bahasa Indonesia.

---

## Prinsip Desain

1. **Multi-tenant sejak baris pertama** — hampir semua tabel punya kolom `company_id`. Ini yang memisahkan data PT. Indo Taste dari perusahaan lain yang nanti akan pakai sistem ini.
2. **Row-Level Security (RLS)** — akan diterapkan di level database (Supabase/Postgres), bukan cuma di kode aplikasi. Artinya walaupun ada bug di kode, database sendiri menolak mengeluarkan data perusahaan lain ke user yang salah. Dua lapis pengaman, bukan satu.
3. **Generik untuk industri manufaktur apa pun** — struktur Item/BOM/Routing tidak di-hardcode khusus gummy/serbuk, supaya bisa dipakai perusahaan manufaktur lain nanti.
4. **BOM per unit output, bukan per batch** — supaya scaling resep (seperti resep lab yang di-scale-up) dihitung otomatis oleh sistem.
5. **Konvensi penamaan primary key**: `nama_tabel_tunggal_id` (mis. tabel `employees` → primary key `employee_id`). Nama ini identik dengan nama yang dipakai tabel lain saat mereferensikannya sebagai foreign key — konsisten di mana pun dipakai, best practice standar.

---

## Kelompok 1: Akses & Tenant

### `companies`
Satu baris = satu perusahaan pelanggan (tenant).
- `company_id`, `name`, `industry_type` (mis. "food_manufacturing")
- `subscription_plan_id` → referensi ke `subscription_plans`
- `status` (trial / active / suspended)
- `created_at`

### `subscription_plans`
Paket langganan yang tersedia.
- `subscription_plan_id`, `name` (mis. "Starter", "Business")
- `price`, `billing_cycle` (bulanan/tahunan)
- `max_users`, `max_items` (batasan sesuai paket)

### `users`
- `user_id`, `company_id`, `name`, `email`, `auth_uid` (referensi ke Supabase Auth `auth.users.id` — password dikelola sepenuhnya oleh Supabase Auth, tidak disimpan ulang di tabel ini)
- `role` (super_admin / company_admin / production_staff / warehouse_staff / purchasing_staff / viewer)
- `status` (active/invited/suspended)

> **Catatan:** `super_admin` adalah role khusus Anda (pemilik platform) — tidak terikat ke satu `company_id`, bisa lihat semua tenant lewat Admin Panel nanti.

---

## Kelompok 2: Master Data Produksi

### `shifts`
Definisi shift kerja pabrik (mis. Shift Pagi 07:00-15:00, Shift Malam 15:00-23:00).
- `shift_id`, `company_id`, `name`, `start_time`, `end_time`, `is_active`

### `production_disruptions`
Mencatat gangguan operasional yang menyebabkan produksi terhambat/terhenti — tidak terbatas pada mesin rusak, juga mencakup listrik padam atau kejadian tak terduga lainnya. Jadi alasan tercatat kenapa hasil aktual meleset dari target, bukan cuma catatan verbal.
- `production_disruption_id`, `company_id`
- `disruption_type` (equipment_breakdown / utility_outage / external_factor / other) — pilihan kategori: mesin, listrik/air padam, faktor eksternal (cuaca, dll), atau lainnya
- `work_center_id` (nullable — diisi kalau memang terkait mesin tertentu; dikosongkan kalau gangguan menyeluruh seperti listrik padam yang tidak spesifik ke satu mesin)
- `work_order_id`, `routing_step_id` (nullable — kalau gangguan terjadi di tengah pengerjaan batch tertentu)
- `shift_id`
- `started_at`, `resolved_at`, `description`

> **Contoh kasus:** Target 1 Januari = 5 batch, pegawai sudah dialokasikan penuh untuk 5 batch. Mesin rusak jam 10:00, perbaikan selesai jam 13:00 → dicatat 1 baris `production_disruptions` (`equipment_breakdown`, terkait `work_center_id` mesin tsb, 10:00-13:00). Kalau penyebabnya listrik padam se-pabrik, dicatat `utility_outage` tanpa `work_center_id` spesifik. Akhir shift hasil cuma 3 batch (`work_order_outputs`) meski tenaga kerja lengkap untuk 5 — selisih antara rencana dan hasil jadi punya penjelasan tercatat.

### `employees`
Data pekerja pabrik untuk keperluan biaya SDM — terpisah dari `users` karena tidak semua pekerja lapangan butuh akun login sistem.
- `employee_id`, `company_id`, `name`, `position` (mis. "Operator Produksi", "QC")
- `wage_type` (hourly / daily / monthly / piece_rate)
- `wage_rate` (angka sesuai `wage_type`: per jam / per hari / per bulan / per pieces)
- `linked_user_id` (nullable — kalau pekerja ini juga punya akun login sistem, merujuk ke `user_id`)
- `is_active`

### `company_settings`
Konstanta yang bisa beda per perusahaan (tenant) — dipakai a.l. untuk konversi gaji harian/bulanan jadi tarif per jam saat kalkulasi biaya batch.
- `company_setting_id`, `company_id`, `setting_key` (mis. "standard_hours_per_day", "standard_hours_per_month")
- `setting_value`

### `items`
Semua "benda" yang dikenal sistem — bahan mentah, WIP, produk jadi, kemasan.
- `item_id`, `company_id`, `item_code`, `name`
- `type` (raw_material / wip / finished_good / packaging)
- `uom` (satuan: g, ml, pcs, dll)
- `shelf_life_days` (untuk hitung expiry — penting untuk Base Gelatin, dll)
- `min_stock_level`, `is_active`
- `reorder_point` (nullable — titik stok kapan harus pesan ulang, lebih presisi dari sekadar `min_stock_level`)
- `reorder_qty` (nullable — jumlah standar yang biasa dipesan ulang, dipakai sistem untuk menyarankan kuantitas PO otomatis)
- `standard_cost` (nullable — harga acuan per unit, dasar kalkulasi biaya BOM untuk perencanaan/quoting)

### `boms`
Header resep/komposisi. Satu item bisa punya beberapa versi BOM (resep berubah seiring waktu, versi lama tetap tersimpan untuk histori/audit).
- `bom_id`, `company_id`, `parent_item_id` (item yang diproduksi, merujuk ke `item_id`)
- `version`, `standard_yield_qty`, `standard_yield_uom`
- `status` (draft / active / archived)

### `bom_lines`
Daftar komponen per BOM.
- `bom_line_id`, `bom_id`, `component_item_id` (merujuk ke `item_id`)
- `qty_per_unit_output`, `uom`
> Kalau `component_item_id` menunjuk ke item bertipe `wip` (mis. Base Gelatin), sistem otomatis tahu ini butuh produksi 2 lapis — tinggal ikuti BOM item tersebut lagi secara rekursif.

### `work_centers`
Master data mesin/stasiun kerja — sebelumnya cuma teks bebas di `routing_steps`, sekarang jadi data master supaya downtime bisa dilacak per mesin.
- `work_center_id`, `company_id`, `name`, `code`, `is_active`

### `routings`
Header urutan tahapan produksi per item (terpisah dari resep).
- `routing_id`, `company_id`, `item_id`, `version`

### `routing_steps`
- `routing_step_id`, `routing_id`, `sequence_no`, `step_name`
- `active_duration_minutes` (waktu kerja aktif)
- `wait_duration_minutes` (waktu tunggu pasif — curing, bloom, dll)
- `work_center_id` (opsional, referensi ke `work_centers`)

### `formula_templates`
Menyimpan "Base Formula" gummy sebagai referensi murni — TIDAK terhubung fungsional ke produksi, hanya starting point saat bikin resep varian baru.
- `formula_template_id`, `company_id`, `name`, `notes`, `reference_composition` (teks bebas/JSON)

---

## Kelompok 3: Inventory & Traceability

### `lots`
Stok dipecah per lot, bukan angka total.
- `lot_id`, `company_id`, `item_id`, `lot_number`
- `expiry_date`, `produced_or_received_date`
- `quantity_on_hand`, `source_type` (purchased / produced)
- `status` (available / quarantine / expired / consumed)
- `unit_cost` (nullable — biaya aktual per unit di lot ini; dari harga PO kalau dibeli, atau hasil kalkulasi dari biaya lot komponen yang dipakai kalau diproduksi sendiri)

### `lot_genealogy`
Jejak "lot ini dibuat dari lot apa saja" — inti dari traceability BPOM/halal.
- `lot_genealogy_id`, `output_lot_id` (lot hasil produksi, merujuk ke `lot_id`)
- `component_lot_id` (lot bahan yang dipakai, merujuk ke `lot_id`)
- `qty_consumed`

### `stock_movements`
Log setiap pergerakan stok (audit trail).
- `stock_movement_id`, `company_id`, `lot_id`
- `movement_type` (receipt / production_issue / production_output / shipment / adjustment)
- `qty`, `reference_doc`, `created_at`, `created_by`

---

## Kelompok 4: Procurement & Sales

### `suppliers`
- `supplier_id`, `company_id`, `name`, `contact_info`, `lead_time_days`
- `supplier_type` (material_supplier / subcontractor / both) — kolom disiapkan untuk fitur subcontracting nanti

### `purchase_orders` & `purchase_order_lines`
PO ke supplier untuk bahan baku yang kurang.
- Header: `purchase_order_id`, `company_id`, `supplier_id`, `status`, `order_date`, `expected_date`
- Line: `purchase_order_line_id`, `purchase_order_id`, `item_id`, `qty_ordered`, `qty_received`, `unit_price`

### `customers`
- `customer_id`, `company_id`, `name`, `contact_info`

### `sales_orders` & `sales_order_lines`
PO dari client (titik awal alur kerja Anda).
- Header: `sales_order_id`, `company_id`, `customer_id`, `po_number`, `status`, `order_date`, `requested_ship_date`
- Line: `sales_order_line_id`, `sales_order_id`, `item_id` (produk jadi), `qty_ordered`

### `shipments` & `shipment_lines`
Satu PO bisa dikirim bertahap (parsial) — tabel ini mencatat tiap pengiriman sebagai peristiwa terpisah.
- Header: `shipment_id`, `company_id`, `sales_order_id`, `shipment_date`, `status`
- Line: `shipment_line_id`, `shipment_id`, `sales_order_line_id`, `item_id`, `qty_shipped`, `lot_id` (lot/batch mana yang dikirim — untuk traceability)

> **Sisa kuantitas PO** dihitung otomatis: `qty_ordered` dikurangi total `qty_shipped` dari semua `shipment_lines` terkait — tidak disimpan sebagai angka statis supaya selalu akurat real-time.

---

## Kelompok 5: Produksi

### `work_orders`
Perintah produksi — jantung dari eksekusi MRP.
- `work_order_id`, `company_id`, `item_id`, `bom_id`, `routing_id`
- `sales_order_line_id` (nullable — menghubungkan work order ke PO/Sales Order asal, supaya bisa ditelusuri dari 1 nomor PO)
- `planned_qty`
- `status` (planned / in_progress / completed / cancelled)
- `scheduled_start`, `scheduled_end`, `actual_start_at`, `actual_completed_at`
- `subcontractor_id` (nullable — kolom disiapkan untuk fitur subcontracting nanti, belum dipakai sekarang)

### `work_order_outputs`
Satu work order bisa menghasilkan **lebih dari satu output** — sesuai proses gummy Anda: produk jadi siap kemas DAN sisa produksi yang masih bisa dimasak ulang jadi bahan baku batch berikutnya (*rework/regrind*).
- `work_order_output_id`, `work_order_id`, `item_id` (produk jadi ATAU item "sisa reprocessable"), `shift_id`
- `output_type` (main_output / reprocessable_waste / disposed_waste)
- `qty`, `lot_id` (lot baru yang tercipta dari output ini)

> **Catatan:** Sisa produksi yang bisa dipakai lagi (`reprocessable_waste`) dicatat sebagai `item` baru bertipe `wip` — sehingga bisa langsung muncul sebagai komponen di `bom_lines` batch produksi berikutnya, tanpa perlu tipe data baru.

### `work_order_consumption`
Bahan/lot apa saja yang benar-benar dipakai di satu work order (sumber data untuk `lot_genealogy`). Berlaku juga kalau yang dipakai adalah lot sisa produksi yang di-reprocess.
- `work_order_consumption_id`, `work_order_id`, `component_lot_id` (merujuk ke `lot_id`), `qty_consumed`
- `shift_id`, `recorded_at` (kapan/shift mana pemakaian ini tercatat — dasar breakdown biaya bahan per hari/shift)

### `work_order_assignments`
Workforce Planning — pekerja mana ditugaskan ke work order/tahap produksi mana. Sekaligus sumber data biaya SDM per batch. Satu pekerja yang bekerja di beberapa shift berbeda pada work order yang sama akan punya beberapa baris terpisah (satu per shift) — supaya biaya SDM bisa dipecah harian.
- `work_order_assignment_id`, `work_order_id`, `employee_id` (dari tabel `employees`, bukan `users`)
- `routing_step_id` (opsional — kalau penugasan setingkat tahap spesifik, bukan seluruh work order)
- `shift_id`
- `status` (planned / confirmed / absent / replaced / completed / unplanned_addition) — menangani kasus PHL yang direncanakan tapi mendadak tidak masuk, ATAU sebaliknya pegawai tambahan yang mendadak dimasukkan di luar rencana awal
- `replacement_for_assignment_id` (nullable, merujuk ke `work_order_assignment_id` di tabel ini sendiri — kalau baris ini adalah pengganti dari penugasan lain yang batal)
- `scheduled_hours`, `actual_hours` (jam kerja rencana vs aktual)
- `qty_produced` (nullable — khusus untuk pekerja dengan `wage_type` = piece_rate, mis. jumlah botol yang dikemas orang itu)

> **Contoh alur:** Rencana: PHL A & PHL B ditugaskan shift pagi (status `planned`). PHL B mendadak tidak masuk → status diubah jadi `absent` (`actual_hours` = 0, tidak dihitung biaya). Kalau ada pengganti (PHL C) datang, dibuat baris baru dengan `replacement_for_assignment_id` menunjuk ke penugasan PHL B. Kalau tidak ada pengganti, work order otomatis tercatat berjalan dengan tenaga kerja lebih sedikit dari rencana — datanya tetap akurat tanpa perlu diedit manual.

### `work_order_step_progress`
Visibilitas real-time — tahap mana dari sebuah work order yang sedang berjalan sekarang. Krusial untuk proses dengan waktu tunggu panjang seperti curing 48 jam atau bloom 12 jam. Juga sumber data untuk laporan harian/shift (total hasil curing, total filling botol, dll) — operator catat kuantitas saat menyelesaikan tiap tahap, laporan tersusun otomatis.
- `work_order_step_progress_id`, `work_order_id`, `routing_step_id`, `shift_id`
- `status` (pending / in_progress / completed)
- `qty_recorded` (jumlah/kuantitas di checkpoint tahap ini — mis. "48kg hasil curing"), `uom`
- `started_at`, `completed_at`, `notes`

### `system_alerts`
Peringatan otomatis dari sistem — menggantikan ketergantungan pada komunikasi manual (Discord). Contoh kasus nyata: work order dijadwalkan mulai tanggal X, tapi bahan bakunya belum cukup stok DAN PO terkait sudah lewat perkiraan tanggal datang → sistem otomatis buat alert ke role Purchasing & Production, bukan menunggu orang lapor.
- `system_alert_id`, `company_id`, `alert_type` (material_shortage / po_delayed / low_stock / production_delay / worker_absence / production_disruption)
- `related_work_order_id`, `related_po_id`, `related_item_id` (nullable, sesuai konteks)
- `message`, `severity` (info/warning/critical)
- `status` (open / acknowledged / resolved), `created_at`
- `acknowledged_by`, `acknowledged_at`

---

## Kelompok 6: Billing *(kerangka awal — detail menyusul saat integrasi Xendit/Midtrans)*

### `invoices`
- `invoice_id`, `company_id`, `subscription_plan_id`
- `amount`, `status` (unpaid/paid/overdue)
- `payment_gateway_ref`, `period_start`, `period_end`

---

## Relasi Kunci (Ringkasan)

```
companies ──< users
companies ──< items ──< boms ──< bom_lines ──> items (component, bisa WIP)
items ──< routings ──< routing_steps
items ──< lots ──< lot_genealogy (lot ke lot lain)
sales_orders ──< sales_order_lines ──> items
work_orders ──> items, boms, routings
work_orders ──< work_order_outputs ──> items, lots (bisa multi-output: produk jadi + sisa reprocessable)
work_orders ──< work_order_consumption ──> lots
work_orders ──< work_order_assignments ──> employees
purchase_orders ──< purchase_order_lines ──> items
companies ──< invoices ──> subscription_plans
```

---

## Catatan Terbuka

Struktur ini belum menyentuh **multi-plant** secara eksplisit — akan ditambahkan kolom `plant_id` di tabel terkait saat masuk fase ekspansi (sesuai roadmap), sengaja ditunda supaya MVP tetap fokus.
