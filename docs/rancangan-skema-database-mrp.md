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
- `signature_url` (nullable — tanda tangan digital, diatur user itu sendiri lewat halaman Profil. File LAMA tidak pernah dihapus/ditimpa saat upload baru — cuma pointer ini yang berpindah — supaya dokumen yang SUDAH ditandatangani sebelumnya tidak ikut berubah)
- `created_at`

> **Catatan role:** `super_admin` = pemilik platform, tidak terikat 1 company. `company_admin` = pembuat akun pertama & pencipta company (bisa hapus company/nonaktifkan akun siapa pun, DAN satu-satunya level di atas manager yang boleh lihat gaji individual). `general_manager` = level setara `company_admin` di operasional, TAPI TANPA izin hapus company/nonaktifkan akun user lain, DAN TANPA akses lihat gaji individual. **Keenam department** (Production, PPIC, Finance, Purchasing, Warehouse, HR) konsisten punya tingkat *manager* dan *staff* — disiapkan dari awal meski beberapa posisi manager mungkin belum terisi orangnya di kondisi nyata sekarang. `hr_manager`/`hr_staff` punya akses penuh ke `employees` termasuk data gaji — satu-satunya department dengan akses itu selain `company_admin`.

### `document_signatures`
Tanda tangan digital GENERIK — dipakai lintas jenis dokumen apa pun yang butuh persetujuan bertanda tangan (dimulai dari Surat Jalan, dirancang untuk dipakai ulang ke jenis dokumen lain nanti tanpa perlu tabel baru tiap kali).
- `document_signature_id`, `company_id`
- `document_type` (teks bebas, mis. "shipment" — daftar akan bertambah seiring waktu)
- `document_id` (merujuk ke baris dokumen terkait — TANPA foreign key ketat, karena lintas tabel berbeda-beda tergantung `document_type`)
- `signed_by` (→ `user_id`), `signer_role_at_signing` (rekam role user PADA SAAT itu — jejak audit, tidak berubah meski role user berubah kemudian)
- `signature_url_snapshot` (SALINAN url tanda tangan pada momen itu — BUKAN link hidup ke `users.signature_url`, supaya dokumen lama tidak ikut berubah kalau user ganti tanda tangan nanti)
- `confirmation_text` (kalimat persis yang dicentang user, bisa beda tiap `document_type`)
- `signed_at`

> **Pola alur (berlaku umum, bukan cuma Surat Jalan):** buat dokumen (draft) → modal konfirmasi menampilkan preview + checkbox "[dokumen] sudah terkonfirmasi benar dan tambahkan signature saya" → tombol "Process" (mengunci dokumen + rekam tanda tangan + memicu transisi status kalau `document_type` itu punya state machine) — ATAU tombol "Cancel/Edit" untuk kembali ke draft tanpa apa pun tercatat.
>
> **Implementasi nyata pertama (Shipments, Sesi 2, 17 Agu 2026) SEDIKIT BEDA dari pola umum di atas** — tanda tangan direkam SAAT PENGIRIMAN DIBUAT (wizard 2 langkah: form → preview+tanda tangan), BUKAN saat status berubah. Transisi `draft→shipped` TETAP lewat aksi terpisah (sekarang bernama "Proses Pengiriman", lihat catatan `dispatch_photo_url` di bagian `shipments` di bawah — awalnya tombol "Dikirim" 1 klik, direvisi hari yang sama jadi wajib upload foto dulu), TIDAK terhubung ke `document_signatures` sama sekali — keduanya aksi independen. Fungsi `create_shipment_with_signature()` (migration `20260817180000`) menulis `shipments`+`shipment_lines`+`document_signatures` dalam 1 transaksi, status hasilnya TETAP `draft`.
>
> **Halaman cetak Surat Jalan (17 Agu 2026)** — dari "Daftar Pengiriman" (`/shipments`), tombol "Lihat / Cetak Surat Jalan" (di dalam panel detail baris, lihat catatan Expandable Data Table di bawah) membuka `/shipments/{shipment_id}/surat-jalan` (route BARU, sengaja DI LUAR grup layout `(shell)` supaya tidak ikut sidebar/header saat dicetak). Halaman ini query `document_signatures` untuk `document_type='shipment'` + `document_id=shipment_id` lalu menampilkan `signature_url_snapshot` yang TERSIMPAN (bukan `users.signature_url` langsung) — komponen `SuratJalanPreview` dipakai ulang persis sama dengan preview di Langkah 2 wizard, supaya tata letak preview dan hasil cetak identik. Tombol "Cetak / Simpan sebagai PDF" pakai print-to-PDF bawaan browser (`window.print()`), belum pakai library PDF khusus.
>
> **Panel detail per baris pengiriman (17 Agu 2026, revisi UI)** — awalnya tombol "Detail" membuka modal popup; direvisi HARI YANG SAMA jadi pola Carbon Design System *Expandable Data Table* (https://carbondesignsystem.com/components/data-table/usage/#expansion) — klik "Detail" membuka panel LANGSUNG di bawah baris terkait di tabel yang sama (bukan modal terpisah), berisi semua info pengiriman + tabel item + foto bukti pengiriman (kalau ada) + tombol aksi ("Lihat/Cetak Surat Jalan", "Proses Pengiriman" untuk draft, "Tandai Diterima" untuk shipped). Komponen `DataTable` generik (`src/components/ui/data-table.tsx`) diperluas dengan prop opsional `getRowId`/`expandedRowId`/`renderExpandedRow` untuk pola ini — reusable untuk tabel lain nanti, tidak cuma Shipments.

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
- `production_plant_id` (WAJIB diisi — plant mana yang terdampak, penting untuk kasus menyeluruh di bawah)
- `work_center_id` (nullable — dikosongkan kalau gangguan MENYELURUH 1 plant, mis. listrik padam se-pabrik, bukan 1 mesin spesifik)
- `work_order_id` (nullable), `production_batch_id` (nullable), `routing_step_id` (nullable), `shift_id`
- `started_at`, `resolved_at`, `description`

> **Gangguan menyeluruh (`work_center_id` kosong) HARUS cascade ke SEMUA batch aktif di plant itu** — bukan cuma yang eksplisit ditaut. Begitu dicatat, semua `production_batches` berstatus `in_progress` di `production_plant_id` itu otomatis ikut ter-flag "Blocked" (lewat `system_alerts`), bukan cuma satu WO yang kebetulan disebut di `work_order_id`. Begitu `resolved_at` diisi, semua yang tadi ter-flag otomatis kembali "Ready" — sama seperti kasus mesin rusak yang sudah teruji, cuma cakupannya lebih luas.

### `employees`
Data pekerja pabrik untuk keperluan biaya SDM — terpisah dari `users`. **Akses ke kolom gaji dibatasi ketat, lihat "Kontrol Akses Data Finansial" di atas.**
- `employee_id`, `company_id`, `production_plant_id` (nullable — pekerja lapangan biasanya terikat 1 lokasi, staf non-produksi mungkin tidak)
- `name`, `position` (mis. "Operator Produksi", "QC")
- `department` (production / ppic / finance / purchasing / warehouse / hr / management / fat / rnd — dipakai untuk filter dashboard per-department & scoping absensi; `fat`/`rnd` ditambahkan 21 Agu 2026 dari data payroll nyata)
- `wage_type` (hourly / daily / monthly / piece_rate)
- `wage_rate` (nilai sensitif — lihat kontrol akses)
- `linked_user_id` (nullable, merujuk ke `user_id`)
- `is_active`
- **Kolom payroll nyata (21 Agu 2026, Bagian C, semua NULLABLE — diisi bertahap sesuai data yang benar-benar diketahui, TIDAK dipaksa lengkap)**: `factory_employee_code` (kode karyawan pabrik, mis. "2508001"; null untuk freelance tanpa kode resmi), `employment_status` (kontrak/phl/freelance — BEDA dari `wage_type`, ini soal status kepegawaian bukan skema pembayaran), `ptkp_status` (mis. "K/2", "TK/0"), `ter_category` (mis. "TER A"/"TER B"), `ter_rate_percent`, `daily_meal_allowance` & `daily_transport_allowance` (Rupiah per hari HADIR, disimpan PER KARYAWAN — bukan tabel tarif-per-jabatan terpisah, supaya tidak perlu hardcode logic per jabatan di kode), `bpjs_kesehatan_enrolled` (boolean, **NULL berarti belum dikonfirmasi, BUKAN berarti tidak ikut** — jangan pernah baca NULL sebagai `false`)
- **Field finansial baru di atas (PTKP/TER/tunjangan/BPJS) ikut aturan privasi yang SAMA PERSIS dengan `wage_rate`** (lihat "Kontrol Akses Data Finansial") — bukan gerbang baru yang lebih longgar.

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
- **Kunci model biaya pemberi kerja (21 Agu 2026, Bagian D)** — SEMUA nullable/opsional per tenant, berubah tiap tahun, TIDAK di-hardcode di kode: `bpjs_wage_basis_floor`/`bpjs_wage_basis_ceiling` (basis iuran BPJS Ketenagakerjaan di-clamp ke rentang ini, BUKAN gaji individu mentah — mis. gaji di bawah floor tetap pakai basis floor), `bpjs_kesehatan_employer_rate_percent`, `bpjs_jkk_employer_rate_percent`, `bpjs_jkm_employer_rate_percent`, `bpjs_jht_employer_rate_percent`, `standard_working_days_per_month`. Kalau salah satu dari 6 kunci BPJS belum diisi untuk suatu company, kalkulasi biaya SDM FALLBACK ke gaji pokok saja (tanpa uplift) — TIDAK error, TIDAK menebak nilai default.

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
- `routing_step_id` (nullable, → `routing_steps.routing_step_id`) — tahap routing ITEM INDUK BOM ini yang MULAI memakai komponen ini (mis. Box baru dipakai di tahap "Filling Box", bukan sejak tahap pertama/Mixing). NULL = belum diklasifikasi, diperlakukan sebagai "dibutuhkan sejak tahap pertama routing" (perilaku konservatif, sama seperti sebelum kolom ini ada — tidak ada regresi untuk BOM yang belum diisi). Dipakai oleh Deteksi Konflik Perencanaan (`getPlanningFeasibility`) supaya kekurangan bahan tahap-akhir (mis. kemasan) hanya menunda tanggal SELESAI/kirim, bukan ikut menunda tanggal MULAI produksi. Harus menunjuk ke routing milik `parent_item_id` BOM itu sendiri (divalidasi saat simpan), bukan routing item lain.

### `work_centers`
Master data mesin/stasiun kerja — fisiknya ada di SATU lokasi pabrik.
- `work_center_id`, `company_id`, `production_plant_id`, `name`, `code`, `is_active`
- `capacity_hours_per_day` (nullable) — kapasitas PER UNIT mesin, dasar Dashboard Kapasitas.
- `unit_count` (integer, default 1, harus > 0) — jumlah unit mesin IDENTIK di Work Center ini (mis. 2 mesin Filling Sachet berjalan paralel). Kapasitas efektif total = `capacity_hours_per_day × unit_count`. Default 1 = perilaku lama persis untuk Work Center yang sudah ada.

### `routings`
Header urutan tahapan produksi per item — sengaja TETAP generik (tidak diikat 1 plant), dianggap sama di semua lokasi yang memproduksi item itu. Master data yang dipakai ULANG lintas banyak Work Order (persis BOM) — bukan didefinisikan ulang tiap WO.
- `routing_id`, `company_id`, `item_id`, `version`, `status` (draft / active / archived)

> **Edit = versi baru, BUKAN menimpa data lama:** kalau estimasi durasi tahap perlu diperbarui (mis. "Mixing" ternyata cuma 20 menit, bukan 1 jam seperti rencana awal) SETELAH routing berstatus `active` (sudah dipakai WO), buat baris `routings` baru dengan `version` naik + `routing_steps` baru, lalu `status` versi lama diubah jadi `archived`. WO yang SUDAH ADA tetap merujuk `routing_id` versi lamanya (riwayat tidak berubah), WO BARU otomatis pakai versi `active` terbaru. Kalau routing masih `draft` (belum pernah dipakai WO manapun), boleh diedit langsung di tempat tanpa perlu versi baru.

### `routing_steps`
- `routing_step_id`, `routing_id`, `sequence_no`, `step_name`
- `active_duration_minutes`, `wait_duration_minutes`
- `work_center_id` (opsional, referensi ke `work_centers`)
- `duration_per_unit_minutes` (numeric, nullable) — durasi BERBASIS LAJU untuk tahap yang kecepatannya ditentukan mesin (mis. Filling Sachet: 2 mesin × 15-20 pcs/menit). Kalau terisi, durasi aktif SEBENARNYA tahap ini = qty batch × nilai ini, BUKAN `active_duration_minutes` yang tetap — satu logika ini (`src/features/mrp/server/stepDuration.ts`) WAJIB dipakai konsisten di Gantt, Dashboard Kapasitas, dan detail blok Gantt. NULL = tahap biasa, tetap pakai `active_duration_minutes` (perilaku lama, tidak ada regresi).

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

> **Perhitungan margin (realized, per pengiriman):** dihitung PER PENGIRIMAN (bukan nunggu SO selesai total). Untuk tiap `shipment_lines`: **Pendapatan** = `qty_shipped × sales_order_lines.unit_price`, **Biaya** = biaya bahan (`work_order_consumption` × `lots.unit_cost`, proporsional ke lot yang dikirim) + biaya SDM (`work_order_assignments` terkait). **Margin** = Pendapatan − Biaya. Dihitung dari data yang ada, bukan tabel baru. Beda dari **Margin Watch** (proyeksi BERJALAN, sebelum pengiriman) di bawah.

### `sales_order_line_feasibility_snapshots`
D.4 (Fase Produksi Nyata) — snapshot `unit_per_batch`/`batches_per_day` yang dipakai `getPlanningFeasibility`, dikunci SEKALI (panggilan pertama untuk 1 baris SO), tidak pernah ikut berubah diam-diam kalau `production_standards` yang mendasarinya berubah belakangan.
- `sales_order_line_feasibility_snapshot_id`, `company_id`, `sales_order_line_id` (unik — 1 snapshot per baris SO)
- `unit_per_batch`, `batches_per_day`, `created_at`

### `sales_order_line_margin_snapshots`
Margin Watch Lapis 1 (20 Agu 2026) — baseline margin RENCANA per baris SO, pola snapshot SAMA PERSIS dengan feasibility di atas (dikunci sekali, immutable untuk kolom biaya/harga). Dipakai Lapis 2 (`getMarginWatch`) sebagai titik acuan proyeksi margin berjalan.
- `sales_order_line_margin_snapshot_id`, `company_id`, `sales_order_line_id` (unik)
- `unit_price` (disalin dari `sales_order_lines` saat snapshot dibuat)
- `standard_material_cost_per_unit`, `standard_packaging_cost_per_unit` (nullable — dari eksplosi BOM berjenjang × `items.standard_cost` tiap bahan/kemasan leaf, dibagi per tipe item)
- `standard_labor_cost_per_unit` (20 Agu 2026, Bagian B — SEKARANG SELALU ANGKA, dihitung dari `routing_step_standard_crew`, lihat tabel di bawah; SEBELUMNYA selalu NULL karena belum ada tabel kru — histori dipertahankan di komentar `computeStandardLaborCostPerUnit.ts`)
- `labor_cost_complete` (boolean) + `labor_cost_notes` (text[]) — pola identik `cost_data_complete`/`missing_cost_item_codes` di bawah, tapi untuk SDM: kalau ADA level produksi (item top ATAU WIP bersarang) yang routing/kru/`production_standards`-nya belum lengkap, jumlah PARSIAL tetap ditampilkan (BUKAN disembunyikan jadi null/0) dan `labor_cost_notes` menjelaskan persis level mana yang dilewati dan kenapa
- `cost_data_complete` (boolean) + `missing_cost_item_codes` (text[]) — eksplisit menandai kalau ADA bahan/kemasan leaf yang belum punya `items.standard_cost`, supaya baseline yang tidak lengkap TIDAK diam-diam dianggap benar 100%
- `margin_floor_threshold` (nullable, numeric) — SATU-SATUNYA kolom yang BOLEH di-`UPDATE` dari app layer (preferensi pemilik order, kapan saja); kolom lain immutable sejak snapshot dibuat
- `created_at`

> **Margin Watch Lapis 2 (pembongkaran selisih, dihitung LIVE tiap panggilan, TIDAK disnapshot):** dari baseline di atas dibandingkan data AKTUAL (`lots.unit_cost`/`purchase_order_lines.unit_price` yang belum diterima, `work_order_consumption`, `work_order_step_progress.qty_reject`, `compute_production_batch_labor_cost()`), dipecah 5 kategori — Selisih Harga Bahan/Kemasan (bandingkan ke **harga master LIVE**, bukan snapshot — sengaja, supaya menangkap drift terbaru), Selisih Pemakaian Bahan, Selisih Reject, Biaya SDM Aktual (kategori "sdm" — **PERINGATAN 20 Agu 2026, masih berlaku: `compute_production_batch_labor_cost()` pakai basis per jam/per shift (dari `work_order_assignments.actual_hours`), BEDA STRUKTUR dari basis standar `standard_labor_cost_per_unit` (kru harian ÷ batch/hari). Selama basisnya beda, kategori ini bisa menunjukkan selisih PALSU, bukan selisih SDM sungguhan. Update 21 Agu 2026 (Bagian D): kedua sisi SEKARANG SAMA-SAMA memasukkan biaya pemberi kerja BPJS untuk karyawan `wage_type='monthly'` (lihat `company_settings` kunci `bpjs_*`), jadi komponen itu sudah konsisten — tapi perbedaan basis PER-JAM vs PER-BATCH-÷-STANDAR di atas belum ditambal.**), Lembur & Shift Tambahan (jam dengan `is_overtime` ATAU shift mulai ≥14:00, proksi generik "shift tambahan" — tidak hardcode nama shift). Kategori tanpa data cukup ditandai `complete:false` + `incomplete_reason` eksplisit, TIDAK PERNAH diam-diam jadi 0.

### `routing_step_standard_crew`
20 Agu 2026 (Bagian B) — komposisi kru standar per LINI produksi (per `routing`), dipakai `computeStandardLaborCostPerUnit.ts` untuk menghitung `standard_labor_cost_per_unit` di atas. **Basis SATU baris agregat per ROUTING, bukan per tahap** (keputusan final pemilik produk setelah pemetaan per-tahap terbukti tidak cocok dengan cara kru sungguhan bekerja — kru bergilir lintas tahap dalam 1 hari kerja, bukan 1 orang terpaku di 1 tahap).
- `routing_step_standard_crew_id`, `company_id`, `routing_id`, `routing_step_id` (NULLABLE — disiapkan untuk presisi per-tahap di masa depan kalau datanya tersedia, TIDAK WAJIB diisi sekarang)
- `role_label` (teks bebas, mis. "Operator Mixing"), `wage_type` (`daily`/`monthly`/`hourly`/`piece_rate`), `headcount`, `hours_per_day`
- `is_full_day_dedicated` (boolean) — membedakan kru PHL/kontrak yang didedikasikan penuh 1 hari kerja ke lini ini (dihitung sebagai upah 1 hari penuh) vs kru `monthly` yang dialokasikan proporsional ke jam (mis. SPV yang mengawasi beberapa lini sekaligus)
- `source` (`ESTIMASI_MANUAL` / `DIPELAJARI`), `notes`
- **Formula biaya SDM standar per batch** = `Σ(headcount × biaya-harian-per-orang) ÷ production_standards.batches_per_day` lini itu. Biaya harian per orang tergantung `wage_type`: `daily` = rata-rata `wage_rate` karyawan aktif tipe itu (PHL dibayar penuh 1 hari terlepas jam kerja); `monthly` + `is_full_day_dedicated` = `(rata-rata wage_rate ÷ jam kerja standar/bulan) × jam kerja standar/hari`; `monthly` tanpa dedikasi penuh = proporsional ke `hours_per_day`; `hourly` = `rata-rata wage_rate × hours_per_day`. **Penyederhanaan yang diketahui, belum diperbaiki**: rata-rata `wage_rate` diambil company-wide per `wage_type`, TIDAK difilter per plant/departemen.
- **RIWAYAT PENTING**: angka agregat ASLI di spesifikasi awal proyek (Rp169.642,86/batch gummy, Rp336.126,37/batch serbuk, basis 36 jam-orang) TERBUKTI SALAH — pemilik produk sendiri mengakui itu menghitung ganda (upah 1 kru dibebankan penuh ke tiap batch, padahal 1 kru sama mengerjakan beberapa batch/hari). Formula di atas menggantikannya, TIDAK mereproduksi angka lama itu.

### `shipments` & `shipment_lines`
Satu SO bisa dikirim bertahap (parsial).
- Header: `shipment_id`, `company_id`, `sales_order_id`, `shipment_date`, `status`
- `pod_token` (nullable — dibuat otomatis, ACAK/tidak bisa ditebak, SAAT status jadi `shipped`; dipakai di URL halaman Bukti Penerimaan publik yang di-scan client, TANPA login)
- `dispatch_photo_url` (nullable, terisi SAAT status jadi `shipped` — foto bukti dari sisi INTERNAL staf gudang saat memuat/mengirim barang, migration `20260817190000`. WAJIB diisi di alur UI sebelum transisi `draft→shipped` bisa dilakukan (lihat catatan implementasi di bawah) — BEDA dari `delivery_confirmations.photo_url` yang dari sisi CUSTOMER)
- Line: `shipment_line_id`, `shipment_id`, `sales_order_line_id`, `item_id`, `qty_shipped`, `lot_id`

> **Implementasi UI "Proses Pengiriman" (17 Agu 2026)** — transisi `draft→shipped` TIDAK LAGI 1 klik tombol biasa. Staf WAJIB upload foto bukti pengiriman lewat modal "Proses Pengiriman" (dibuka dari panel detail baris pengiriman di "Daftar Pengiriman", pola Carbon *Expandable Data Table*) — baru setelah foto sukses diupload, `shipments.status` diubah ke `shipped` (memicu trigger `process_shipment_shipped()` yang sudah ada, tidak direstrukturisasi) DAN `dispatch_photo_url` terisi dalam 1 `UPDATE` yang sama (`processShipmentDispatch.ts`). Endpoint status lama (`PATCH /api/shipments/status`) SEKARANG HANYA menerima target `delivered` — target `shipped` sengaja dikeluarkan dari situ supaya transisi ini tidak bisa dilewati tanpa foto.
>
> **Label kolom Status di UI (17 Agu 2026, TIDAK mengubah nilai `status` di database)** — di tabel "Daftar Pengiriman", nilai `shipped` ditampilkan sebagai **"Di Proses"** (barang sudah keluar gudang, dalam perjalanan) dan `delivered` sebagai **"Terkirim"** (sudah sampai ke penerima) — lebih sesuai arti kata sehari-hari daripada nama kolom database aslinya. `draft`/`cancelled` tetap "Draft"/"Batal". Panel detail baris pengiriman JUGA menampilkan, KHUSUS untuk status selain `draft`: stok lot TERKINI (`lots.quantity_on_hand` saat itu) dan total qty sudah dikirim untuk SO line yang sama di SELURUH pengiriman (`sales_order_lines.qty_shipped`/`qty_ordered`, bukan cuma qty di baris pengiriman ini) — supaya staf bisa langsung lihat bukti stok benar-benar berkurang tanpa perlu buka halaman lain.

### `delivery_confirmations`
Bukti Penerimaan (Proof of Delivery) dari CLIENT — diisi lewat halaman PUBLIK tanpa login (akses via `pod_token`, bukan lewat akun sistem). Client bukan user terdaftar, jadi tabel ini TIDAK terikat `user_id` seperti pola tanda tangan internal (`document_signatures`) — ini pengakuan dari pihak luar, bukan persetujuan staf internal.
- `delivery_confirmation_id`, `shipment_id`
- `photo_url` (foto bukti dari client, Supabase Storage)
- `received_by_name` (nullable, diisi manual — bisa beda dari `shipments.recipient_name` yang direncanakan saat pengiriman dibuat)
- `confirmed_at`

> **Keamanan halaman publik:** akses HANYA lewat `pod_token` (acak, panjang, tidak bisa ditebak dari `shipment_id`) — bukan RLS berbasis JWT seperti tabel lain. Halaman ini TIDAK BOLEH menampilkan harga/biaya apa pun (sesuai Kontrol Akses Data Finansial — berlaku ganda di sini karena bukan cuma soal role, tapi diakses pihak LUAR perusahaan sama sekali). Submit sukses memicu transisi `shipped→delivered` (target status yang sudah ada di state machine `shipments`).

> **Implementasi Sesi 3 (17 Agu 2026) — SELESAI, diverifikasi lewat 5 skenario negatif** — route `/pod/[token]` (`app/pod/[token]/page.tsx`, sengaja DI LUAR grup `(shell)`, TIDAK ADA pemeriksaan sesi Supabase sama sekali di komponennya — halaman PERTAMA di seluruh sistem yang genuinely tanpa login). Lookup shipment HANYA lewat `getShipmentByPodToken.ts` (server function baru, TIDAK pakai `getCurrentUser()`) — field yang dikembalikan dibatasi ketat (nomor surat jalan, tanggal, alamat, daftar item+qty+satuan SAJA; TIDAK PERNAH menyentuh `sales_order_lines.unit_price`/`lots.unit_cost`/`items.standard_cost`). Token tidak ditemukan ATAU `status != 'shipped'` menghasilkan SATU pesan generik yang sama ("Link Tidak Valid") — sengaja tidak membedakan "token salah" vs "sudah dipakai" supaya tidak jadi oracle. Submit (`confirmDelivery.ts`, `POST /api/pod/[token]/confirm`) memvalidasi ULANG token+status FRESH saat submit (tidak percaya state halaman yang sudah lama terbuka), upload foto ke bucket BARU `delivery-confirmation-photos` (public read, TIDAK ADA policy insert untuk role apa pun — beda dari bucket lain di proyek ini yang masih punya policy insert 'authenticated' sebagai defense-in-depth; di sini itu justru jadi celah karena tidak ada pengunjung authenticated yang legal menulis), lalu memanggil fungsi atomik BARU `confirm_delivery()` (migration `20260817210000`) yang mengunci baris (`for update`) + insert `delivery_confirmations` + transisi status dalam 1 transaksi — mencegah submit ganda dari 2 request hampir bersamaan dengan token yang sama.
>
> **Bukti 5 skenario negatif (browser context baru tanpa cookies/session sama sekali, bukan cuma dugaan)**: (1) akses tanpa login sama sekali — berhasil, nol header Authorization terkirim; (2) token tebakan/salah — ditolak bersih "Link Tidak Valid", nol data ditampilkan; (3) akses ulang token yang SUDAH dipakai (baik lewat halaman maupun POST langsung ke endpoint confirm) — ditolak; (4) DOM halaman + respons JSON API diperiksa mentah — nol kata kunci harga/biaya, dibuktikan dengan menanam 1 nilai harga unik (`8171731`) di data uji dan memastikan angka itu tidak pernah muncul di mana pun pada halaman/response; (5) isolasi lintas company — token perusahaan lain (2 company nyata dipakai) masing-masing HANYA mengembalikan data shipment miliknya sendiri, tidak bocor ke company lain.

## Kelompok 5: Produksi

### `production_batches`
Level eksekusi NYATA di lantai produksi — 1 Work Order biasanya dikerjakan lewat beberapa batch fisik terpisah (3-5 per shift, umum di operasional Anda), masing-masing dengan bahan, hasil, dan jejak lot sendiri-sendiri (penting untuk isolasi traceability BPOM/halal kalau ada masalah kualitas di 1 batch spesifik). PPIC (atau siapa pun yang berwenang) bebas menentukan `planned_qty` tiap batch — TIDAK terpaku ke ukuran standar BOM (mis. BOM ditulis basis 10kg, tapi batch produksi riil bisa sampai 50kg — sistem otomatis scale kebutuhan bahan sesuai `planned_qty` batch ini, ditambah `boms.buffer_percentage`).
- `production_batch_id`, `company_id`, `work_order_id`, `batch_number` (mis. "WO-0012-B003" — rekomendasi otomatis default, TAPI staf boleh menimpanya dengan format sendiri, mis. format pabrik "3TM13082601"; kalau ditimpa, dipakai apa adanya. Unik PER PERUSAHAAN — `unique(company_id, batch_number)`, bukan lagi per Work Order — supaya tidak ada 2 batch dengan nomor sama di 1 perusahaan meski nomornya diisi manual)
- `shift_id`, `planned_qty`, `uom`
- `planned_date` (date, nullable — kapan batch ini SEHARUSNYA dikerjakan, diisi PPIC saat bikin batch. Beda dari `started_at` yang baru terisi setelah benar-benar mulai — ini yang jadi acuan Dashboard Kapasitas Work Center, bukan `started_at`/`created_at`, supaya perencanaan ke depan/minggu depan terhitung benar)
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
- `is_overtime` (boolean, default false) — penanda LEMBUR (kasus jarang: orang yang seharusnya pulang lanjut bekerja). TIDAK mengubah tarif yang dipakai (tarif lembur belum ditentukan pemilik produk) — murni penanda supaya baris ini bisa dikoreksi begitu tarif lembur diputuskan.
- `work_date` (date) — dipakai oleh `compute_production_batch_labor_cost()` untuk PHL (`wage_type='daily'`): tarif per jam = `wage_rate ÷ jam shift yang diikuti` (dari `shifts.start_time`/`end_time` lewat `shift_id` baris ini), BUKAN dibagi rata dengan jam kerja hari itu — shift 2 (evening, jam lebih pendek) dengan demikian dihitung sebagai HARI KERJA TERPISAH bernilai penuh `wage_rate`, bukan dipecah proporsional. Baris tanpa `shift_id` tetap pakai `work_calendar_weekday_hours`/`work_calendar_saturday_hours` global (perilaku lama, tidak ada regresi).
- `replacement_for_assignment_id` (nullable, → `work_order_assignment_id`)
- `scheduled_hours`, `actual_hours`, `qty_produced` (nullable, khusus `wage_type` = piece_rate)

### `work_order_step_progress`
Visibilitas real-time tahap produksi per BATCH — penting karena batch-batch dalam 1 shift bisa berada di tahap BERBEDA secara bersamaan (mis. Batch 1 sedang curing 48 jam, sementara Batch 3 baru mixing) — juga basis kalkulasi proyeksi stok (lihat `system_alerts`).
- `work_order_step_progress_id`, `work_order_id`, `production_batch_id`, `routing_step_id`, `shift_id`
- `qty_input` (nullable — jumlah yang MASUK ke tahap ini), `uom_input` (nullable — satuan bisa beda dari output, mis. kg masuk → pcs keluar di tahap Cetak)
- `status` (pending / in_progress / completed), `qty_recorded` (jumlah BAIK yang KELUAR/dihasilkan tahap ini, SUDAH TIDAK TERMASUK reject — nama kolom dipertahankan apa adanya, cuma diperjelas maknanya sebagai "output baik"), `uom`, `started_at`, `completed_at`, `notes`
- `qty_reject` (nullable) — jumlah REJECT/cacat di tahap ini, terpisah dari susut proses biasa (`qty_input − qty_recorded`, mis. evaporasi/spillage). `qty_reject` adalah SEBAGIAN dari total susut itu (divalidasi: `qty_reject ≤ qty_input − qty_recorded` kalau ketiganya terisi), bukan angka tambahan di luar susut yang sudah ada. `reject_reason` (nullable, teks bebas — pemilik produk belum punya daftar kategori baku).

> **Tracking penyusutan antar-tahap:** `qty_input` tahap berikutnya SEBAIKNYA otomatis disarankan dari `qty_recorded` (output) tahap sebelumnya pada `production_batch` yang sama — BUKAN dari `production_batches.planned_qty` awal. Ini yang bikin sistem tahu "yang benar-benar masuk Cetak cuma 9,5kg, bukan 10kg teoritis," dan penyusutan (`qty_input − qty_recorded`) di tiap tahap bisa dilaporkan & diakumulasikan sampai akhir produksi untuk manajemen — laporan ini DIHITUNG dari data yang ada, bukan tabel baru.

> **Tanggal kejadian ≠ tanggal input (pola pabrik nyata: pencatatan LINTAS HARI adalah normal, bukan pengecualian):** `started_at`/`completed_at` TIDAK dipaksa ke waktu server saat API dipanggil — endpoint pencatatan progres (`recordWorkOrderStepProgress.ts`) menerima `record_date` opsional (default hari ini) yang dilekatkan ke stempel waktu yang tersimpan, supaya staf bisa mencatat hari ini progres yang SEBENARNYA terjadi 1-2 hari lalu (mis. laporan Filling untuk batch yang di-mixing 2 hari sebelumnya). Batas: tidak boleh tanggal MASA DEPAN, tidak boleh SEBELUM `production_batches.created_at` batch itu; kalau >7 hari ke belakang, cuma peringatan lembut (tidak ditolak). K8 (`learnFromBatchCore.ts`) membuang sampel `active_duration_minutes` di atas 480 menit (1 shift penuh) sebagai penjagaan — kalau start & complete tahap yang sama dicatat di 2 tanggal backdate yang JAUH berbeda, selisihnya adalah rentang KALENDER, bukan durasi aktif sungguhan, dan akan merusak pembelajaran kalau tidak disaring.

### `system_alerts`
Peringatan otomatis dari sistem.
- `system_alert_id`, `company_id`
- `alert_type` (material_shortage / po_delayed / low_stock / production_delay / worker_absence / production_disruption / so_ready_for_production / po_needs_approval / stock_depletion_forecast / expiry_risk_low_usage / margin_threshold_breach)
- `target_department` (nullable — production/ppic/finance/purchasing/warehouse/hr/management, dipakai `employees.department`. NULL = terlihat oleh semua department. `company_admin`/`general_manager` SELALU lihat semua alert, TERLEPAS dari kolom ini — bukan filter yang berlaku untuk mereka)
- `related_work_order_id`, `related_po_id`, `related_item_id` (nullable)
- `message`, `severity` (info/warning/critical), `status` (open / acknowledged / resolved), `created_at`
- `acknowledged_by`, `acknowledged_at`

> **Penentuan `target_department` saat alert dibuat** (mapping otomatis dari `alert_type`, bukan manual tiap kali): `material_shortage`/`stock_depletion_forecast`/`expiry_risk_low_usage`/`low_stock` → `purchasing` + `warehouse`; `worker_absence` → `production` + `hr`; `production_disruption`/`production_delay` → `production` + `ppic`; `so_ready_for_production` → `ppic`; `po_needs_approval` → sesuai `customer_po_approvals.department` yang bersangkutan (finance/ppic/management); `po_delayed` → `purchasing`. Kalau 1 alert relevan untuk >1 department, bisa dibuat >1 baris (1 per department) daripada 1 baris multi-value — lebih sederhana untuk query & status baca per department.

> **Proyeksi stok habis & risiko kadaluarsa (`stock_depletion_forecast`, `expiry_risk_low_usage`):** dihitung dari **rata-rata pemakaian harian** tiap item (dari riwayat `work_order_consumption`), **dihitung ULANG setiap kali ada data baru masuk** (tiap akhir shift/update batch) — real-time, bukan terjadwal.
> - `stock_depletion_forecast`: sisa stok ÷ rata-rata pemakaian harian = perkiraan hari sampai habis. Kalau mendekati `suppliers.lead_time_days`, alert dini ke Purchasing.
> - `expiry_risk_low_usage`: kalau proyeksi "habis terpakai" LEBIH LAMA dari `lots.expiry_date` (bahan keburu kadaluarsa sebelum habis, kasus khas bahan MOQ besar tapi pemakaian kecil) → alert risiko dini, bukan cuma H-berapa hari standar.

> **`margin_threshold_breach` (Margin Watch, 20 Agu 2026) — overload `related_po_id` beda dari alert lain.** Alert ini terkait `sales_order_line`, BUKAN `work_order`/`item`, jadi `related_po_id` (kolom fleksibel tanpa FK) dipakai menyimpan `sales_order_line_id` untuk tipe ini secara khusus — ditulis lewat fungsi mandiri `upsert_margin_threshold_alert()`, BUKAN `upsert_department_alert()`/`resolve_department_alerts()` yang dipakai alert lain (keduanya, sejak migration `20260819150000` audit keamanan, mengharuskan `related_work_order_id`/`related_item_id` untuk menurunkan `company_id` — diam-diam tidak melakukan apa pun kalau keduanya NULL, persis kasus alert margin). `target_department` = `finance` + `management` (2 baris).

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
