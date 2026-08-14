# Rancangan Skema Database — MRP Multi-Tenant
### PT. Indo Taste Manufacture (Tenant Pertama)

Dokumen ini adalah rancangan struktur database sistem MRP. Ditulis dalam bahasa yang mudah dibaca — nama tabel & kolom pakai istilah teknis standar (bahasa Inggris, konvensi umum database), penjelasannya dalam Bahasa Indonesia.

---

## Prinsip Desain

1. **Multi-tenant sejak baris pertama** — hampir semua tabel punya kolom `company_id`. Ini yang memisahkan data PT. Indo Taste dari perusahaan lain yang nanti akan pakai sistem ini.
2. **Row-Level Security (RLS)** — diterapkan di level database (Supabase/Postgres), bukan cuma di kode aplikasi. Dua lapis pengaman, bukan satu.
3. **Generik untuk industri manufaktur apa pun** — struktur Item/BOM/Routing tidak di-hardcode khusus gummy/serbuk.
4. **BOM per unit output, bukan per batch** — supaya scaling resep dihitung otomatis oleh sistem.
5. **Konvensi penamaan primary key**: `nama_tabel_tunggal_id` (mis. tabel `employees` → primary key `employee_id`). Nama ini identik dengan nama yang dipakai tabel lain saat mereferensikannya sebagai foreign key.
6. **Multi-plant sejak awal** — 1 company bisa punya beberapa lokasi pabrik fisik (`production_plants`), masing-masing dengan gudang, mesin, tenaga kerja sendiri.
7. **Data finansial dibatasi ketat** — lihat bagian "Kontrol Akses Data Finansial" di bawah, ini prinsip lintas-tabel yang berlaku di banyak tempat.
8. **Dashboard per-department, data tetap satu sumber** — begitu login, tampilan diarahkan sesuai `role`/`department` user (Warehouse lihat dashboard ala WMS, HRD lihat data karyawan, dst) — TAPI ini murni soal TAMPILAN/ROUTING di aplikasi, BUKAN pemisahan tabel. `items`, `work_orders`, dan tabel lain yang lintas-department (dipakai lebih dari 1 department) TETAP satu tabel, satu sumber kebenaran — cukup difilter/ditata beda sesuai sudut pandang department yang login.

---

## Kontrol Akses Data Finansial

Ini bukan satu tabel, tapi aturan lintas-tabel yang berlaku di beberapa kolom sensitif — dicatat terpusat di sini supaya tidak tercecer.

| Data | Yang Boleh Lihat | Yang TIDAK Boleh Lihat |
|---|---|---|
| Harga jual, margin, biaya gabungan (`sales_order_lines.unit_price`, hasil kalkulasi margin, `lots.unit_cost` di laporan biaya) | `company_admin`, `general_manager`, `finance_manager` | Production, PPIC, Warehouse, Purchasing (kecuali poin di bawah) |
| **Gaji individual** (`employees.wage_rate`, `wage_type`) | **HANYA** `company_admin` (Direktur) dan `hr_manager`/`hr_staff`, serta karyawan itu sendiri untuk data dirinya | `general_manager` DAN `finance_manager` — TIDAK terkecuali, meski mereka boleh lihat data finansial lain di atas |
| Total biaya SDM per batch/laporan (angka akumulasi) | Sama seperti baris pertama (`finance_manager` dkk) | — (ini beda dari gaji individual — cuma angka total, bukan rincian per-orang) |
| Harga di PO ke supplier (`purchase_order_lines.unit_price`) yang MEREKA SENDIRI input | `purchasing_manager`, `purchasing_staff` (karena ini memang tugas mereka bertransaksi) | Tetap tidak bisa lihat dashboard margin/biaya gabungan perusahaan |

**Kenapa gaji dipisah dari data finansial lain:** ini soal etika perusahaan Anda — Finance mengurus keuangan perusahaan secara agregat, tapi gaji personal adalah privasi yang cuma HRD & karyawan bersangkutan yang tahu.

---

## Kelompok 1: Akses & Tenant

### `companies`
Satu baris = satu perusahaan pelanggan (tenant).
- `company_id`, `name`, `industry_type` (mis. "food_manufacturing")
- `subscription_plan_id` → referensi ke `subscription_plans`
- `status` (trial / active / suspended)
- `logo_url` (nullable — referensi ke file di Supabase Storage, diatur company_admin/general_manager lewat Data Perusahaan)
- `created_at`

### `subscription_plans`
Paket langganan yang tersedia.
- `subscription_plan_id`, `name` (mis. "Starter", "Business")
- `price`, `billing_cycle` (bulanan/tahunan)
- `max_users`, `max_items` (batasan sesuai paket)
- `created_at`

### `users`
- `user_id`, `company_id`, `name`, `email`
- `auth_uid` (penghubung ke `auth.users.id` milik Supabase Auth — WAJIB ada, sistem login bergantung pada ini)
- `role` (super_admin / company_admin / general_manager / production_manager / production_staff / ppic_manager / ppic_staff / finance_manager / finance_staff / purchasing_manager / purchasing_staff / warehouse_manager / warehouse_staff / hr_manager / hr_staff / viewer)
- `status` (active/invited/suspended)
- `avatar_url` (nullable — referensi ke file di Supabase Storage, diatur user itu sendiri lewat halaman Profil)
- `created_at`

> **Catatan role:** `super_admin` = pemilik platform, tidak terikat 1 company. `company_admin` = pembuat akun pertama & pencipta company (bisa hapus company/nonaktifkan akun siapa pun, DAN satu-satunya level di atas manager yang boleh lihat gaji individual). `general_manager` = level setara `company_admin` di operasional, TAPI TANPA izin hapus company/nonaktifkan akun user lain, DAN TANPA akses lihat gaji individual. **Keenam department** (Production, PPIC, Finance, Purchasing, Warehouse, HR) konsisten punya tingkat *manager* dan *staff* — disiapkan dari awal meski beberapa posisi manager mungkin belum terisi orangnya di kondisi nyata sekarang. `hr_manager`/`hr_staff` punya akses penuh ke `employees` termasuk data gaji — satu-satunya department dengan akses itu selain `company_admin`.

### `invitations`
Undangan company_admin/manager ke calon anggota tim baru.
- `invitation_id`, `company_id`, `email` (email yang diundang)
- `role` (role yang akan didapat setelah diterima)
- `invited_by` (merujuk ke `user_id`)
- `status` (pending / accepted / expired)
- `token` (kode unik untuk proses accept)
- `expires_at`, `created_at`, `accepted_at`

---

## Kelompok 2: Master Data Produksi

### `production_plants`
Satu company bisa punya beberapa lokasi pabrik fisik berbeda (mis. PT ITM: 2 lokasi produksi gummy, 1 lokasi produksi minuman serbuk). Rujukan lokasi untuk mesin, stok, tenaga kerja, dan work order. **Untuk saat ini, 1 plant = 1 gudang** (tidak perlu tabel `warehouses` terpisah — bisa direvisit kalau nanti 1 plant butuh multi-gudang fisik).
- `production_plant_id`, `company_id`, `name`, `address`
- `product_focus` (nullable, teks bebas — mis. "gummy", "powder_drink") — dipakai sebagai **saran/default cerdas** saat memilih plant pada aksi "Process" PO→SO, BUKAN validasi keras yang memblokir pilihan lain
- `is_active`

### `shifts`
Definisi shift kerja pabrik (mis. Shift Pagi 07:00-15:00, Shift Malam 15:00-23:00) — per lokasi pabrik, karena jam kerja bisa beda antar lokasi.
- `shift_id`, `company_id`, `production_plant_id`, `name`, `start_time`, `end_time`, `is_active`

### `production_disruptions`
Mencatat gangguan operasional yang menyebabkan produksi terhambat/terhenti — mesin rusak, listrik padam, faktor eksternal, ATAU produksi dialihkan ke pekerjaan lain yang lebih mendesak.
- `production_disruption_id`, `company_id`
- `disruption_type` (equipment_breakdown / utility_outage / external_factor / reprioritized / other) — `reprioritized` dipakai saat WO di-pause karena dialihkan ke pekerjaan lain
- `work_center_id` (nullable), `work_order_id`, `routing_step_id` (nullable), `shift_id`
- `started_at`, `resolved_at`, `description`

### `employees`
Data pekerja pabrik untuk keperluan biaya SDM — terpisah dari `users`. **Akses ke kolom gaji dibatasi ketat, lihat "Kontrol Akses Data Finansial" di atas.**
- `employee_id`, `company_id`, `production_plant_id` (nullable — pekerja lapangan biasanya terikat 1 lokasi, staf non-produksi mungkin tidak)
- `name`, `position` (mis. "Operator Produksi", "QC")
- `department` (production / ppic / finance / purchasing / warehouse / hr / management — dipakai untuk filter dashboard per-department & scoping absensi)
- `wage_type` (hourly / daily / monthly / piece_rate)
- `wage_rate` (nilai sensitif — lihat kontrol akses)
- `linked_user_id` (nullable, merujuk ke `user_id`)
- `is_active`

### `employee_attendance`
Absensi harian umum (jam masuk-pulang) — berlaku untuk SEMUA karyawan termasuk staf kantoran (Finance, HRD sendiri, dst) yang tidak pernah masuk ke Work Order sama sekali. Terpisah dari `work_order_assignments` yang tujuannya beda (biaya produksi, bukan kehadiran). Fondasi awal untuk modul HRD yang akan meluas ke payroll/legal nanti — tidak dibangun sekaligus sekarang.
- `employee_attendance_id`, `company_id`, `employee_id`
- `attendance_date`
- `check_in_at`, `check_out_at` (nullable sampai check-out)
- `status` (present / late / absent / on_leave / sick)
- `notes` (nullable)

> **Akses:** `company_admin` & `hr_manager`/`hr_staff` — akses penuh semua karyawan. Manager tiap department — bisa lihat absensi staf DI department mereka sendiri (`employees.department` yang sama), untuk keperluan perencanaan kerja. Karyawan — cuma bisa lihat/submit absensinya sendiri.

### `company_settings`
Konstanta yang bisa beda per perusahaan (tenant).
- `company_setting_id`, `company_id`, `setting_key` (mis. "standard_hours_per_day"), `setting_value`

### `items`
Semua "benda" yang dikenal sistem — bahan mentah, WIP, produk jadi, kemasan. Punya **2 satuan berbeda** untuk mengakomodasi pola beli-per-kg-pakai-per-gram (atau kombinasi satuan lain).
- `item_id`, `company_id`, `item_code`, `name`
- `type` (raw_material / wip / finished_good / packaging)
- `base_uom` (satuan dasar/pakai — dipakai di BOM & stok, mis. gram, ml, pcs)
- `purchase_uom` (satuan beli — dipakai Purchasing saat bikin PO, mis. kg, liter, dus, pcs)
- `uom_conversion_factor` (berapa `base_uom` per 1 `purchase_uom` — mis. 1000 untuk kg→gram; kalau `purchase_uom` = `base_uom`, factor = 1, otomatis tanpa konversi)
- `shelf_life_days`, `min_stock_level`, `reorder_point`, `reorder_qty`, `is_active`
- `standard_cost` (nullable — nilai sensitif, lihat "Kontrol Akses Data Finansial")
- `bpom_registration_number` (nullable — mis. "BPOM RI MD 023733999101561", khusus produk jadi yang sudah teregistrasi)

> **Catatan MOQ:** sengaja TIDAK dimodelkan. Purchasing beli sesuai realita (termasuk MOQ dari supplier), lalu input hasil pembelian sesuai data invoice apa adanya — sistem tidak memvalidasi/membatasi jumlah beli.

### `boms`
Header resep/komposisi. Satu item bisa punya beberapa versi (`version`), resep lama tetap tersimpan untuk histori/audit.
- `bom_id`, `company_id`, `parent_item_id` (→ `item_id`), `version`, `standard_yield_qty`, `standard_yield_uom`, `status` (draft / active / archived)
- `buffer_percentage` (nullable, mis. 3-5 — diatur PPIC saat bikin/edit BOM, kompensasi kehilangan produksi akibat kendala mesin dsb. Dipakai untuk hitung kebutuhan bahan mentah SEBENARNYA: `qty_dibutuhkan = (rasio BOM × qty target batch) × (1 + buffer_percentage/100)` — supaya walau ada yang terbuang di proses, hasil akhir tetap kena target)

### `bom_lines`
Daftar komponen per BOM, dalam `base_uom`.
- `bom_line_id`, `bom_id`, `component_item_id` (→ `item_id`), `qty_per_unit_output`, `uom`

### `work_centers`
Master data mesin/stasiun kerja — fisiknya ada di SATU lokasi pabrik.
- `work_center_id`, `company_id`, `production_plant_id`, `name`, `code`, `is_active`

### `routings`
Header urutan tahapan produksi per item — sengaja TETAP generik (tidak diikat 1 plant), dianggap sama di semua lokasi yang memproduksi item itu.
- `routing_id`, `company_id`, `item_id`, `version`

### `routing_steps`
- `routing_step_id`, `routing_id`, `sequence_no`, `step_name`
- `active_duration_minutes`, `wait_duration_minutes`
- `work_center_id` (opsional, referensi ke `work_centers`)

### `formula_templates`
Menyimpan "Base Formula" sebagai referensi murni untuk R&D — TIDAK terhubung fungsional ke produksi.
- `formula_template_id`, `company_id`, `name`, `notes`, `reference_composition`

---

## Kelompok 3: Inventory & Traceability

### `lots`
Stok dipecah per lot, per lokasi pabrik (karena stok secara fisik ada di satu tempat, dan 1 plant = 1 gudang).
- `lot_id`, `company_id`, `production_plant_id`, `item_id`, `lot_number`
- `expiry_date`, `produced_or_received_date`
- `quantity_on_hand` (dalam `base_uom`), `source_type` (purchased / produced / customer_supplied)
- `status` (available / quarantine / expired / consumed)
- `unit_cost` (nullable — nilai sensitif, lihat "Kontrol Akses Data Finansial")
- `source_customer_purchase_order_id` (nullable, → `customer_purchase_order_id`) — WAJIB diisi kalau `source_type = customer_supplied`, untuk lacak balik bahan/kemasan kiriman client ke PO asalnya

> **Bahan/kemasan dari client (`customer_supplied`):** pola umum di operasional Anda — client kadang kirim sendiri bahan/kemasan (botol, box, bahan aktif, dst) untuk dipakai produksi order mereka. Lot dengan `source_type = customer_supplied` otomatis `unit_cost = 0` (karena memang tidak dibeli), supaya kalkulasi margin tetap akurat tanpa logika khusus tambahan. **Catatan penting:** karena ini kepunyaan client tertentu (bukan stok umum perusahaan), sebaiknya UI memberi peringatan lembut (bukan blokir keras) kalau lot ini coba dipakai di Work Order yang terhubung ke customer BERBEDA dari `source_customer_purchase_order_id`-nya — mencegah salah pakai bahan kiriman client A untuk produksi client B.

### `lot_genealogy`
Jejak "lot ini dibuat dari lot apa saja" — inti traceability BPOM/halal.
- `lot_genealogy_id`, `output_lot_id` (→ `lot_id`), `component_lot_id` (→ `lot_id`), `qty_consumed`

### `stock_movements`
Log setiap pergerakan stok (audit trail).
- `stock_movement_id`, `company_id`, `lot_id`
- `movement_type` (receipt / production_issue / production_output / shipment / adjustment)
- `qty`, `reference_doc`, `created_at`, `created_by`

---

## Kelompok 4: Procurement & Sales

### `suppliers`
- `supplier_id`, `company_id`, `name`, `contact_info`, `lead_time_days`, `supplier_type` (material_supplier / subcontractor / both)

### `purchase_orders` & `purchase_order_lines`
PO KITA ke supplier (beda dari `customer_purchase_orders`). Form "Create PO" di dashboard Purchasing punya field **alamat kirim** berupa pilihan `production_plant_id` — begitu dipilih, sistem otomatis tahu barang ini nanti masuk gudang plant mana saat diterima.
- Header: `purchase_order_id`, `company_id`, `supplier_id`, `production_plant_id` (alamat kirim/tujuan), `status`, `order_date`, `expected_date`
- Line: `purchase_order_line_id`, `purchase_order_id`, `item_id`, `qty_ordered` (dalam `purchase_uom`), `qty_received`, `unit_price` (dalam `purchase_uom` — Purchasing boleh lihat & input ini, karena memang tugas mereka bertransaksi, lihat "Kontrol Akses Data Finansial")

### `goods_receipts` & `goods_receipt_lines`
Konfirmasi kedatangan barang oleh Warehouse — memicu stok bertambah dan otomatis "menyelesaikan" alert kekurangan bahan yang terkait.
- Header: `goods_receipt_id`, `company_id`, `purchase_order_id`, `production_plant_id`, `received_date`, `received_by` (→ `user_id`), `status`
- Line: `goods_receipt_line_id`, `goods_receipt_id`, `purchase_order_line_id`, `item_id`, `qty_received` (dalam `purchase_uom`, sistem otomatis konversi ke `base_uom` pakai `uom_conversion_factor` saat membuat `lot` baru), `lot_id` (lot baru yang tercipta dari penerimaan ini)

> **Alur konversi satuan:** Purchasing input PO & terima invoice sesuai satuan beli (mis. "275kg, Rp 268.000/kg"). Saat Warehouse konfirmasi barang datang, sistem otomatis konversi ke satuan dasar (275.000 gram, Rp 268/gram) dan itulah yang tersimpan di `lots.unit_cost` — BOM & pemakaian produksi otomatis cocok karena sama-sama `base_uom`.

### `customers`
Order bisa dari perusahaan (dengan PIC yang bisa beda-beda tiap order) atau perorangan langsung.
- `customer_id`, `company_id`, `name` (nama perusahaan ATAU nama perorangan, tergantung `customer_type`)
- `customer_type` (company / individual)
- `contact_info`

### `customer_purchase_orders` & `customer_purchase_order_lines`
PO dari client — TERPISAH dari `sales_orders`. Statusnya berjalan sebelum jadi komitmen produksi, dan **masih bisa diedit/ditunda/dibatalkan** selama di status `new`. Wajib disetujui **3 department secara terpisah** (lihat `customer_po_approvals`) sebelum tombol "Process" aktif — begitu diproses, `sales_orders` otomatis tercipta dari sini (data lines di-*copy*, bukan cuma dirujuk).
- Header: `customer_purchase_order_id`, `company_id`, `customer_id`, `po_number`, `po_date`, `requested_ship_date`
- `pic_name`, `pic_position`, `pic_phone`, `pic_email` (nullable — data PIC order INI spesifik, karena bisa beda tiap order meski perusahaan client-nya sama, mis. beda staf R&D yang mengajukan)
- `status` (new / on_hold / cancelled / processed) — `new` → `processed` HANYA boleh terjadi kalau ketiga baris `customer_po_approvals` berstatus `approved`
- `payment_terms` (full / tempo), `payment_status` (pending / partial / confirmed)
- `processed_by` (nullable, → `user_id`), `processed_at`
- Line: `customer_purchase_order_line_id`, `customer_purchase_order_id`, `item_id` (SETIAP VARIAN kemasan/ukuran = `item_id` terpisah), `qty_ordered`, `unit_price` (harga jual disepakati — nilai sensitif, lihat "Kontrol Akses Data Finansial")

### `customer_po_approvals`
Approval wajib dari 3 department sebelum PO client bisa diproses jadi SO — sekaligus mekanisme notifikasi. 3 baris dibuat OTOMATIS (satu per department) begitu PO baru dibuat, semua mulai `pending`.
- `customer_po_approval_id`, `customer_purchase_order_id`
- `department` (finance / ppic / manager)
- `status` (pending / approved / rejected)
- `approved_by` (nullable, → `user_id` dari role sesuai department), `approved_at`
- `notes` (nullable — terutama kalau `rejected`)

> **Pemetaan department ke role:** `manager` → `company_admin`/`general_manager`, `finance` → `finance_manager`, `ppic` → `ppic_manager`. Sengaja level *manager*, bukan *staff*. Begitu PO baru dibuat, sistem kirim `system_alerts` ke role yang sesuai.

### `sales_orders` & `sales_order_lines`
Tercipta OTOMATIS saat `customer_purchase_orders` diproses — komitmen produksi yang sudah "terkunci". Orang yang klik "Process" WAJIB memilih `production_plant_id` — penting karena menentukan SDM (termasuk PHL) yang tersedia untuk ditugaskan (`employees` terikat per plant).
- Header: `sales_order_id`, `company_id`, `customer_purchase_order_id`, `customer_id`
- `so_number` (nomor SO internal yang bisa dibaca manusia, format sesuai kebiasaan Anda mis. "020/2-ITM/2026" — auto-generated saat "Process" diklik; BEDA dari `customer_purchase_orders.po_number` yang merujuk nomor PO milik client)
- `production_plant_id` (dipilih saat "Process"), `status` (confirmed / in_production / completed / cancelled), `created_at`
- Line: `sales_order_line_id`, `sales_order_id`, `item_id`, `qty_ordered`, `unit_price` (disalin dari PO)

> **Satu SO line bisa punya BANYAK Work Order** — PPIC bebas memecah 1 SO line jadi beberapa WO (mis. per hari/per kapasitas produksi: WO day 1, day 2, day 3), tidak harus 1:1. Dashboard PO tetap menjumlahkan total progres dari semua WO yang terhubung ke SO line yang sama.

> **Perhitungan margin:** dihitung PER PENGIRIMAN (bukan nunggu SO selesai total). Untuk tiap `shipment_lines`: **Pendapatan** = `qty_shipped × sales_order_lines.unit_price`, **Biaya** = biaya bahan (`work_order_consumption` × `lots.unit_cost`, proporsional ke lot yang dikirim) + biaya SDM (`work_order_assignments` terkait). **Margin** = Pendapatan − Biaya. Dihitung dari data yang ada, bukan tabel baru.

### `shipments` & `shipment_lines`
Satu SO bisa dikirim bertahap (parsial).
- Header: `shipment_id`, `company_id`, `sales_order_id`, `shipment_date`, `status`
- Line: `shipment_line_id`, `shipment_id`, `sales_order_line_id`, `item_id`, `qty_shipped`, `lot_id`

---

## Kelompok 5: Produksi

### `production_batches`
Level eksekusi NYATA di lantai produksi — 1 Work Order biasanya dikerjakan lewat beberapa batch fisik terpisah (3-5 per shift, umum di operasional Anda), masing-masing dengan bahan, hasil, dan jejak lot sendiri-sendiri (penting untuk isolasi traceability BPOM/halal kalau ada masalah kualitas di 1 batch spesifik). PPIC (atau siapa pun yang berwenang) bebas menentukan `planned_qty` tiap batch — TIDAK terpaku ke ukuran standar BOM (mis. BOM ditulis basis 10kg, tapi batch produksi riil bisa sampai 50kg — sistem otomatis scale kebutuhan bahan sesuai `planned_qty` batch ini, ditambah `boms.buffer_percentage`).
- `production_batch_id`, `company_id`, `work_order_id`, `batch_number` (mis. "WO-0012-B003")
- `shift_id`, `planned_qty`, `uom`
- `status` (planned / in_progress / completed / cancelled)
- `started_at`, `completed_at`

### `work_orders`
Perintah produksi (SPK) — jantung eksekusi MRP, level rencana besar (bisa dipecah jadi banyak `production_batches`).
- `work_order_id`, `company_id`, `production_plant_id`, `item_id`, `bom_id`, `routing_id`
- `sales_order_line_id` (nullable — 1 SO line bisa dipecah jadi banyak WO)
- `planned_qty`
- `status` (planned / in_progress / paused / completed / cancelled) — `paused` dipakai saat WO dihentikan sementara (mis. dialihkan ke pekerjaan lain mendesak), bisa dilanjutkan lagi tanpa kehilangan progres
- `priority` (mis. low / normal / high / urgent — bantu PPIC tentukan mana yang didahulukan saat rebutan sumber daya)
- `scheduled_start`, `scheduled_end`, `actual_start_at`, `actual_completed_at`
- `subcontractor_id` (nullable, disiapkan untuk nanti)

> **"Ready to Start" / dependency (ala Jira, tapi otomatis):** WO dianggap siap mulai HANYA kalau tidak ada `system_alerts` berstatus `open` yang terkait `work_order_id` itu (kekurangan bahan, SDM belum lengkap, mesin rusak). Kalau masih ada alert terbuka → WO otomatis "Blocked" dengan alasan spesifik ditampilkan. Ini TIDAK perlu link manual antar-WO seperti Jira — cukup pantau status alert yang sudah ada. Kasus WO saling bergantung (mis. WO Gummy butuh Base Gelatin dari WO lain yang belum selesai) otomatis tertangani lewat alert kekurangan bahan yang sama, tanpa perlu definisikan "WO A depends on WO B" secara eksplisit.

### `work_order_outputs`
Satu BATCH bisa menghasilkan lebih dari satu output (produk jadi + sisa reprocessable).
- `work_order_output_id`, `work_order_id`, `production_batch_id`, `item_id`, `shift_id`, `output_type` (main_output / reprocessable_waste / disposed_waste), `qty`, `lot_id`

### `work_order_consumption`
Bahan/lot yang benar-benar dipakai per BATCH — identitas ke batch baru tercatat SAAT dipakai (bukan sejak bahan datang), memungkinkan 1 lot dipakai lintas banyak batch/WO/PO sampai habis.
- `work_order_consumption_id`, `work_order_id`, `production_batch_id`, `component_lot_id` (→ `lot_id`), `qty_consumed`, `shift_id`, `recorded_at`

### `work_order_assignments`
Penugasan pekerja per BATCH — sumber data biaya SDM (nilai sensitif, lihat "Kontrol Akses Data Finansial"). Perlu tahu persis siapa terlibat di batch mana (bukan cuma level WO+shift).
- `work_order_assignment_id`, `work_order_id`, `production_batch_id`, `employee_id`, `routing_step_id` (nullable), `shift_id`
- `status` (planned / confirmed / absent / replaced / completed / unplanned_addition)
- `replacement_for_assignment_id` (nullable, → `work_order_assignment_id`)
- `scheduled_hours`, `actual_hours`, `qty_produced` (nullable, khusus `wage_type` = piece_rate)

### `work_order_step_progress`
Visibilitas real-time tahap produksi per BATCH — penting karena batch-batch dalam 1 shift bisa berada di tahap BERBEDA secara bersamaan (mis. Batch 1 sedang curing 48 jam, sementara Batch 3 baru mixing) — juga basis kalkulasi proyeksi stok (lihat `system_alerts`).
- `work_order_step_progress_id`, `work_order_id`, `production_batch_id`, `routing_step_id`, `shift_id`
- `status` (pending / in_progress / completed), `qty_recorded`, `uom`, `started_at`, `completed_at`, `notes`

### `system_alerts`
Peringatan otomatis dari sistem.
- `system_alert_id`, `company_id`
- `alert_type` (material_shortage / po_delayed / low_stock / production_delay / worker_absence / production_disruption / so_ready_for_production / po_needs_approval / stock_depletion_forecast / expiry_risk_low_usage)
- `related_work_order_id`, `related_po_id`, `related_item_id` (nullable)
- `message`, `severity` (info/warning/critical), `status` (open / acknowledged / resolved), `created_at`
- `acknowledged_by`, `acknowledged_at`

> **Proyeksi stok habis & risiko kadaluarsa (`stock_depletion_forecast`, `expiry_risk_low_usage`):** dihitung dari **rata-rata pemakaian harian** tiap item (dari riwayat `work_order_consumption`), **dihitung ULANG setiap kali ada data baru masuk** (tiap akhir shift/update batch) — real-time, bukan terjadwal.
> - `stock_depletion_forecast`: sisa stok ÷ rata-rata pemakaian harian = perkiraan hari sampai habis. Kalau mendekati `suppliers.lead_time_days`, alert dini ke Purchasing.
> - `expiry_risk_low_usage`: kalau proyeksi "habis terpakai" LEBIH LAMA dari `lots.expiry_date` (bahan keburu kadaluarsa sebelum habis, kasus khas bahan MOQ besar tapi pemakaian kecil) → alert risiko dini, bukan cuma H-berapa hari standar.

---

## Kelompok 6: Billing

### `invoices`
- `invoice_id`, `company_id`, `subscription_plan_id`, `amount`, `status` (unpaid/paid/overdue), `payment_gateway_ref`, `period_start`, `period_end`

---

## Relasi Kunci (Ringkasan)

```
companies ──< users
companies ──< production_plants ──< shifts, work_centers, lots, work_orders, employees (semua terikat lokasi fisik)
companies ──< items ──< boms ──< bom_lines ──> items (component, bisa WIP)
items ──< routings ──< routing_steps
items ──< lots ──< lot_genealogy (lot ke lot lain)
suppliers ──< purchase_orders ──< purchase_order_lines ──> items (PO KITA ke supplier, punya production_plant_id sbg tujuan kirim)
purchase_orders ──< goods_receipts ──< goods_receipt_lines ──> lots (konfirmasi barang datang, trigger stok baru)
customers ──< customer_purchase_orders ──< customer_purchase_order_lines ──> items
customer_purchase_orders ──< customer_po_approvals (3 baris: finance/ppic/manager)
customer_purchase_orders ──processed──> sales_orders ──< sales_order_lines ──> items (lines disalin dari PO)
sales_order_lines ──< work_orders (1 SO line bisa dipecah jadi banyak WO)
work_orders ──> items, boms, routings, production_plants
work_orders ──< production_batches (1 WO dipecah jadi banyak batch fisik — 3-5 per shift)
production_batches ──< work_order_outputs ──> items, lots (bisa multi-output)
production_batches ──< work_order_consumption ──> lots
production_batches ──< work_order_assignments ──> employees (siapa terlibat di batch mana)
production_batches ──< work_order_step_progress (progres per batch, karena bisa beda tahap bersamaan)
work_orders ──< system_alerts (dipantau untuk status "Ready to Start"/"Blocked")
companies ──< invoices ──> subscription_plans
```
