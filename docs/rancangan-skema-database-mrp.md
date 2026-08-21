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
Satu company bisa punya beberapa lokasi pabrik fisik berbeda. Rujukan lokasi untuk mesin, stok, tenaga kerja, dan work order. **Untuk saat ini, 1 plant = 1 gudang** (tidak perlu tabel `warehouses` terpisah — bisa direvisit kalau nanti 1 plant butuh multi-gudang fisik).
- `production_plant_id`, `company_id`, `name`, `address`
- `product_focus` (nullable, teks bebas — mis. "gummy", "powder_drink") — dipakai sebagai **saran/default cerdas** saat memilih plant pada aksi "Process" PO→SO, BUKAN validasi keras yang memblokir pilihan lain
- `is_active` — plant `is_active=false` DIKECUALIKAN dari kalkulasi kapasitas/perencanaan, dan `createWorkOrder` MENOLAK pembuatan Work Order di plant ini (400, pesan eksplisit)
- `alias_notes` (nullable, 27 Agu 2026) — sebutan lain di lapangan untuk plant yang sama (mis. "KL Bizhub (Karanglo)" dikenal juga sebagai "Gudang KL BIZ" di dokumen stock opname dan "Karanglo" sehari-hari)

> **PT ITM (27 Agu 2026, setelah konsolidasi) — 3 plant nyata:** (1) **Ruko Dieng** — produksi Gummy, beroperasi; (2) **Puncak Dieng** — produksi Gummy, `is_active=false` (BELUM beroperasi); (3) **KL Bizhub (Karanglo)** — produksi Minuman Serbuk, beroperasi. Sebelumnya sistem sempat punya 4 baris plant (termasuk "Karanglo" dan "KL Bizhub" sebagai 2 baris terpisah padahal 1 lokasi fisik yang sama, dan "Pabrik Utama PT ITM" — sisa demo lama, 33 karyawan nonaktif + 2 work_center tak terpakai, dihapus total) — digabung/dibereskan lewat migrasi `20260827090000_consolidate_production_plants.sql`.

### `shifts`
Definisi shift kerja pabrik (mis. Shift Pagi 07:00-15:00, Shift Malam 15:00-23:00) — per lokasi pabrik, karena jam kerja bisa beda antar lokasi.
- `shift_id`, `company_id`, `production_plant_id`, `name`, `start_time`, `end_time`, `is_active`

### `production_disruptions`
Mencatat gangguan operasional yang menyebabkan produksi terhambat/terhenti — mesin rusak, listrik padam, faktor eksternal, ATAU produksi dialihkan ke pekerjaan lain yang lebih mendesak.
- `production_disruption_id`, `company_id`
- `disruption_type` (equipment_breakdown / utility_outage / external_factor / reprioritized / changeover / other) — `reprioritized` dipakai saat WO di-pause karena dialihkan ke pekerjaan lain; `changeover` (25 Agu 2026, tumpangan §5 rencana KPI) dipakai saat waktu produksi habis untuk ganti produk antar batch — membuka KPI backlog SMED (`metric.downtime_persen_pareto`) dengan riwayat sejak dini, bukan menunggu KPI-2 dibangun
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
Rekap HARIAN kehadiran per karyawan — berlaku untuk SEMUA karyawan termasuk staf kantoran yang tidak pernah masuk ke Work Order. Terpisah dari `work_order_assignments` (tujuannya beda: biaya produksi, bukan kehadiran). **DIPERLUAS 23 Agu 2026 (Absensi Geo-QR Gelombang 1)**: dulu diisi manual, sekarang DIHITUNG ULANG dari `attendance_events` (ledger di bawah) — TIDAK PERNAH diedit field-per-field oleh kode aplikasi lagi.
- `employee_attendance_id`, `company_id`, `employee_id`, `attendance_date`
- `check_in_at`, `check_out_at` (nullable sampai check-out) — `notes` (nullable)
- `status` — DIPERLUAS (union, bukan diganti): 5 nilai lama `present`/`late`/`absent`/`on_leave`/`sick` TETAP VALID (data lama tetap terbaca) + nilai baru `BELUM_HADIR`/`HADIR`/`ISTIRAHAT`/`PULANG`/`TERLAMBAT`/`DI_LUAR_AREA`/`IZIN`/`SAKIT`/`CUTI`/`ALPA`/`KOREKSI_PENDING`
- **Kolom BARU 23 Agu 2026**: `production_plant_id`, `work_minutes`/`late_minutes`/`overtime_minutes` (dihitung dari kalender kerja `company_settings`, bukan diketik), `source_event_ids` (integer[], jejak event ledger yang membentuk rekap ini), `geofence_status` (`DALAM`/`LUAR`/`TANPA_GPS`), `flags` (jsonb, mis. auto-close lupa clock-out)

> **Akses:** `company_admin` & `hr_manager`/`hr_staff` — akses penuh semua karyawan. Manager tiap department — bisa lihat absensi staf DI department mereka sendiri (`employees.department` yang sama). Karyawan — cuma bisa lihat/submit absensinya sendiri. **Digerbang di TypeScript (service-role client), BUKAN di RLS langsung** — RLS tabel ini/turunannya hanya batas company, gerbang per-role lebih halus tetap satu tempat (`listAttendanceByDate` dkk).

### `company_settings`
Konstanta yang bisa beda per perusahaan (tenant).
- `company_setting_id`, `company_id`, `setting_key` (mis. "standard_hours_per_day"), `setting_value`
- **Kunci model biaya pemberi kerja (21 Agu 2026, Bagian D)** — SEMUA nullable/opsional per tenant, berubah tiap tahun, TIDAK di-hardcode di kode: `bpjs_wage_basis_floor`/`bpjs_wage_basis_ceiling` (basis iuran BPJS Ketenagakerjaan di-clamp ke rentang ini, BUKAN gaji individu mentah — mis. gaji di bawah floor tetap pakai basis floor), `bpjs_kesehatan_employer_rate_percent`, `bpjs_jkk_employer_rate_percent`, `bpjs_jkm_employer_rate_percent`, `bpjs_jht_employer_rate_percent`, `standard_working_days_per_month`. Kalau salah satu dari 6 kunci BPJS belum diisi untuk suatu company, kalkulasi biaya SDM FALLBACK ke gaji pokok saja (tanpa uplift) — TIDAK error, TIDAK menebak nilai default.
- **`payroll_period_start_day` (21 Agu 2026, Bagian E, DIPAKAI sejak migration `20260821140000`)** — tanggal mulai periode gaji pabrik (mis. `26` = periode gaji 26 bulan sebelumnya s/d 25 bulan berjalan). Keputusan pemilik produk: Laba Operasional bulanan (`get_monthly_operating_profit()`) IKUT periode ini (bukan bulan kalender) — fungsi sekarang mengembalikan `period_start`/`period_end` eksplisit selain `total_margin`/`overhead`/`operating_profit`. Company TANPA kunci ini diisi tetap fallback ke bulan kalender persis perilaku lama (zero regresi). **`monthly_overhead_baseline` di bawah ini MASIH angka statis manual** (belum dihitung sebagai SISA dari total biaya pemberi kerja − biaya SDM tercatat di batch, per instruksi yang belum bisa diterapkan penuh — lihat HANDOFF.md).
- **`currency_code` (21 Agu 2026, Bagian F)** — kode mata uang tenant (default `'IDR'`). Dibaca oleh `formatCurrency()` (`src/lib/currency.ts`) sebagai DEFAULT parameter — TAPI belum ada kode yang membaca kunci ini secara dinamis dari `company_settings` per request dan mengopernya ke `formatCurrency`; semua pemanggilan saat ini pakai default bawaan fungsi. Cukup untuk sekarang (cuma ada tenant IDR), tapi perlu kerja tambahan (alirkan `currency_code` dari `company_settings` ke tiap komponen) kalau nanti ada tenant currency lain.

### `items`
Semua "benda" yang dikenal sistem — bahan mentah, WIP, produk jadi, kemasan. Punya **2 satuan berbeda** untuk mengakomodasi pola beli-per-kg-pakai-per-gram (atau kombinasi satuan lain).
- `item_id`, `company_id`, `item_code`, `name`
- `type` (raw_material / wip / finished_good / packaging)
- `base_uom` (satuan dasar/pakai — dipakai di BOM & stok, mis. gram, ml, pcs)
- `purchase_uom` (satuan beli — dipakai Purchasing saat bikin PO, mis. kg, liter, dus, pcs)
- `uom_conversion_factor` (berapa `base_uom` per 1 `purchase_uom` — mis. 1000 untuk kg→gram; kalau `purchase_uom` = `base_uom`, factor = 1, otomatis tanpa konversi)
- `shelf_life_days`, `min_stock_level`, `reorder_point`, `reorder_qty`, `is_active`
- `standard_cost` (nullable — nilai sensitif, lihat "Kontrol Akses Data Finansial")
- `cost_unverified` (boolean, default false, 26 Agu 2026 — formula resmi Gummy Zala V2/Drinkme V1) — beda dari `standard_cost` null (harga TIDAK ADA): di sini harga ADA dan ikut dihitung ke biaya standar, cuma statusnya "belum dikonfirmasi purchasing". `cost_unverified_note` (nullable) — alasan singkatnya. Dipakai Margin Watch untuk peringatan terpisah dari `missing_cost_item_codes`.
- `bpom_registration_number` (nullable — mis. "BPOM RI MD 023733999101561", khusus produk jadi yang sudah teregistrasi)

> **Catatan MOQ:** sengaja TIDAK dimodelkan. Purchasing beli sesuai realita (termasuk MOQ dari supplier), lalu input hasil pembelian sesuai data invoice apa adanya — sistem tidak memvalidasi/membatasi jumlah beli.

### `boms`
Header resep/komposisi. Satu item bisa punya beberapa versi (`version`), resep lama tetap tersimpan untuk histori/audit.
- `bom_id`, `company_id`, `parent_item_id` (→ `item_id`), `version`, `standard_yield_qty`, `standard_yield_uom`, `status` (draft / active / archived)
- `buffer_percentage` (nullable, mis. 3-5 — diatur PPIC saat bikin/edit BOM, kompensasi kehilangan produksi akibat kendala mesin dsb. Dipakai untuk hitung kebutuhan bahan mentah SEBENARNYA: `qty_dibutuhkan = (rasio BOM × qty target batch) × (1 + buffer_percentage/100)` — supaya walau ada yang terbuang di proses, hasil akhir tetap kena target)
- **`standard_yield_basis_note`/`standard_yield_source` (21 Agu 2026)** — keterangan asal-usul `standard_yield_qty`, keduanya nullable, diisi manual lewat form edit BOM. `standard_yield_source` pola sama dengan `production_standards.source` (ESTIMASI_MANUAL/DIPELAJARI). **PENTING soal tampilan**: `standard_yield_uom` di kolom ini BISA drift dari satuan asli item (bebas diketik manual saat bikin BOM, pernah kejadian nyata tersimpan "pcs" generik padahal item-nya sebenarnya "botol") — UI (`BomsPage.tsx`) SEKARANG selalu menampilkan `items.base_uom` milik `parent_item_id` (field `parent_item_base_uom` dari `listBoms`), BUKAN `boms.standard_yield_uom`, supaya tidak ikut drift. Kolom `standard_yield_uom` di database TETAP ada (dipakai internal/histori), cuma TIDAK dipakai lagi sebagai sumber label tampilan.

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
- `routing_id`, `company_id`, `item_id`, `version`
- `archived_at`, `archived_by` (→ `users.user_id`) (Sesi 7, 21 Agu 2026) — NULL berarti versi ini aktif dan boleh dipilih Work Order baru. Diisi lewat aksi "Arsipkan" (server yang MEMUTUSKAN arsip vs hapus permanen berdasar ada/tidaknya Work Order yang memakainya — lihat "Jalan Keluar Master Data" di bawah), DITOLAK kalau versi ini sedang dipakai batch berstatus `in_progress`.

> **DRIFT DOKUMENTASI (ditemukan 27 Agu 2026, SEBAGIAN DISELESAIKAN 21 Agu 2026 Sesi 7):** paragraf ini tadinya mendeskripsikan kolom `status` (draft/active/archived) yang ternyata tidak pernah dibuat. Sesi 7 MENUTUP separuh gap ini — bukan dengan kolom `status` enum seperti rencana lama, tapi pola `archived_at`/`archived_by` (sama seperti `sales_order_line_margin_snapshots.archived_at`) — sehingga sebuah VERSI routing sekarang bisa diarsipkan/dipulihkan lewat layar. **Yang BELUM diselesaikan** (tetap utang teknis, lihat `HANDOFF.md`): perilaku "edit = versi baru otomatis" di paragraf di bawah ini MASIH TIDAK DITEGAKKAN SISTEM — `updateRouting.ts` masih menimpa isi versi yang SAMA di tempat (hapus semua `routing_steps` lalu tulis ulang), bukan membuat baris `routings` versi baru. Snapshot Sesi 6A melindungi ANGKA batch yang sudah berjalan/selesai dari efek edit ini, tapi routing itu sendiri tidak otomatis bercabang jadi versi baru saat diedit.

> **Edit = versi baru, BUKAN menimpa data lama (niat desain — MASIH BELUM DITEGAKKAN SISTEM, lihat catatan drift di atas):** kalau estimasi durasi tahap perlu diperbarui (mis. "Mixing" ternyata cuma 20 menit, bukan 1 jam seperti rencana awal) SETELAH routing dipakai WO, idealnya dibuat baris `routings` baru dengan `version` naik + `routing_steps` baru, versi lama diarsipkan (`archived_at` terisi). WO yang SUDAH ADA tetap merujuk `routing_id` versi lamanya (riwayat tidak berubah), WO BARU otomatis pakai versi aktif terbaru. Hari ini yang SUDAH benar: mengarsipkan sebuah versi (lewat layar Routing) membuatnya hilang dari dropdown pemilihan Work Order baru — yang BELUM benar: mengedit sebuah versi tidak otomatis membuat versi baru, masih menimpa versi yang sama.

### `routing_steps`
- `routing_step_id`, `routing_id`, `sequence_no`, `step_name`
- `active_duration_minutes`, `wait_duration_minutes`
- `work_center_id` (opsional, referensi ke `work_centers`)
- `duration_per_unit_minutes` (numeric, nullable) — durasi BERBASIS LAJU untuk tahap yang kecepatannya ditentukan mesin (mis. Filling Sachet: 2 mesin × 15-20 pcs/menit). Kalau terisi, durasi aktif SEBENARNYA tahap ini = qty batch × nilai ini, BUKAN `active_duration_minutes` yang tetap — satu logika ini (`src/features/mrp/server/stepDuration.ts`) WAJIB dipakai konsisten di Gantt, Dashboard Kapasitas, dan detail blok Gantt. NULL = tahap biasa, tetap pakai `active_duration_minutes` (perilaku lama, tidak ada regresi).

### `production_standards` (K8, 18-19 Agu 2026) — DITEMUKAN belum pernah punya entri sendiri di sini walau dirujuk puluhan kali di dokumen ini; dilengkapi 25 Agu 2026
Standar produksi per item (opsional per `routing_step_id` untuk metrik level-tahap) — dasar
kapasitas/feasibility/biaya SDM standar di seluruh sistem.
- `production_standard_id`, `company_id`, `item_id`, `routing_step_id` (nullable — null utk metrik level-item, terisi utk level-tahap)
- `metric_key` (`yield_percentage`/`unit_per_batch`/`active_duration_minutes`/`batches_per_day` — `batches_per_day` ditambahkan 18 Agu 2026 utk Deteksi Konflik Perencanaan)
- `value`, `source` (`ESTIMASI_MANUAL`/`DIPELAJARI`), `sample_count`, `last_calculated_at`
- `pinned`/`pin_reason` — kunci nilai supaya tidak ikut "dipelajari" otomatis
- `last_approved_by`/`last_approved_at` (19 Agu 2026) — audit ringkas siapa mengesahkan nilai SAAT INI (riwayat lengkap ada di `production_standard_proposals` di bawah)
- unik `(company_id, item_id, routing_step_id, metric_key)`

> **Flip ESTIMASI_MANUAL→DIPELAJARI BUKAN otomatis** (D.1, 19 Agu 2026) — `propose_production_standard()` HANYA menulis ke `production_standard_proposals`, tidak pernah menyentuh `value`/`source` langsung; penerapan cuma lewat `decide_production_standard_proposal()` (planner: `ppic_manager`/leadership). **Median untuk sampel kecil** (D.2): n<10 pakai `percentile_cont(0.5)` tanpa buang outlier (tidak bermakna statistik di n kecil); n≥10 baru mean + buang outlier ±2σ.

### `production_standard_proposals`
Riwayat LENGKAP usulan flip standar — 1 baris per usulan, disetujui/ditolak eksplisit oleh planner.
- `production_standard_proposal_id`, `company_id`, `item_id`, `routing_step_id`
- `metric_key`, `old_value`/`old_source`, `proposed_value`
- `calculation_method` (`median`/`mean_trimmed`), `sample_count`
- `status` (`pending`/`approved`/`rejected`), `created_at`/`updated_at`, `decided_by`/`decided_at`

### `production_standard_samples`
Sampel mentah (satu baris per batch/observasi) yang menjadi dasar `proposed_value` di atas.
- `production_standard_sample_id`, `company_id`, `item_id`
- `routing_step_id` (nullable, ditambahkan 19 Agu 2026 — TANPA ini sampel durasi dari tahap BERBEDA pada item yang sama akan tercampur jadi satu rolling window yang salah)
- `metric_key`, `sample_value`, `recorded_at`

### `production_standard_exclusions`
Batch yang GAGAL gerbang kelengkapan (D.3, 19 Agu 2026) — log tercatat dilaporkan, BUKAN dilewati diam-diam (sekaligus indikator disiplin pengisian data tahap).
- `production_standard_exclusion_id`, `company_id`, `production_batch_id`, `item_id`, `reason`, `missing_routing_step_ids` (integer[]), `created_at`

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
- `notes` (nullable, 27 Agu 2026) — konteks non-finansial yang tidak tertampung kolom lain (mis. siapa yang mengajukan dari sisi internal, catatan penyesuaian tanggal dokumen). Ditambahkan saat kerangka studi kasus MLVT ETAWAFIT dibangun (`20260827120000_mlvt_case_study_skeleton.sql`).
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
D.4 (Fase Produksi Nyata) — snapshot `unit_per_batch`/`batches_per_day` yang dipakai `getPlanningFeasibility`, tidak pernah ikut berubah diam-diam kalau `production_standards` yang mendasarinya berubah belakangan.
- `sales_order_line_feasibility_snapshot_id`, `company_id`, `sales_order_line_id`
- `unit_per_batch`, `batches_per_day`, `created_at`
- `archived_at`, `archived_reason`, `locked_by` (→ `user_id`), `relock_reason` (Sesi 0C, 21 Agu 2026 — lihat catatan "Kunci vs Lihat" di bawah)
- `unit_per_batch_source`, `unit_per_batch_sample_count`, `batches_per_day_source`, `batches_per_day_sample_count` (Sesi 5, 21 Agu 2026) — salinan `production_standards.source`/`sample_count` PERSIS pada saat dikunci, supaya orang yang membaca selisih (drift) tahu apakah baseline ini tebakan kasar (`ESTIMASI_MANUAL`) atau hasil belajar dari batch nyata (`DIPELAJARI`, dengan jumlah sampel). Murni kejujuran asal-usul — gerbang kelengkapan `lockFeasibilityBaseline.ts` TIDAK berubah, `ESTIMASI_MANUAL` tetap boleh dikunci.

> **Kunci vs Lihat (Sesi 0C, 21 Agu 2026) — berlaku SAMA PERSIS untuk feasibility & margin snapshot di bawah.** SEBELUMNYA baris ini lahir *lazy* pada panggilan PERTAMA `getPlanningFeasibility`/`getMarginWatch` (desain sengaja awal, lihat riwayat di HANDOFF Sesi 0/0B) — TAPI investigasi menemukan tombol yang terlihat "Cek Kelayakan"/"Margin Watch" (murni lihat) bisa memicu penulisan permanen oleh role TANPA kewenangan finansial. Sekarang: **membaca (menghitung & menampilkan) TIDAK PERNAH menulis apa pun** — kalau belum ada baris AKTIF (`archived_at IS NULL`), angka dihitung LIVE dan dikembalikan dengan `locked:false`, TIDAK disimpan. Mengunci adalah aksi TERPISAH (`lockFeasibilityBaseline.ts`/`lockMarginBaseline.ts`), bergerbang: (1) role berkewenangan finansial (`company_admin`/`general_manager`/`finance_manager`, DITEGAKKAN di RLS insert/update, bukan cuma TypeScript), (2) data lengkap (feasibility: standar ada; margin: `cost_data_complete=true`, ditolak dgn pesan eksplisit kalau tidak), (3) kunci ULANG (baseline sudah ada) HANYA `company_admin` + alasan wajib diisi. Constraint `unique(sales_order_line_id)` LAMA diganti **unique index PARSIAL** `WHERE archived_at IS NULL` — HANYA 1 baris AKTIF per baris SO, tapi baris lama TIDAK dihapus saat dikunci ulang, hanya diarsipkan (Doktrin 7).

### `sales_order_line_margin_snapshots`
Margin Watch Lapis 1 (20 Agu 2026) — baseline margin RENCANA per baris SO. Dipakai Lapis 2 (`getMarginWatch`) sebagai titik acuan proyeksi margin berjalan.
- `sales_order_line_margin_snapshot_id`, `company_id`, `sales_order_line_id`
- `unit_price` (disalin dari `sales_order_lines` saat baseline dikunci)
- `standard_material_cost_per_unit`, `standard_packaging_cost_per_unit` (nullable — dari eksplosi BOM berjenjang × `items.standard_cost` tiap bahan/kemasan leaf, dibagi per tipe item)
- `standard_labor_cost_per_unit` (20 Agu 2026, Bagian B — SEKARANG SELALU ANGKA, dihitung dari `routing_step_standard_crew`, lihat tabel di bawah; SEBELUMNYA selalu NULL karena belum ada tabel kru — histori dipertahankan di komentar `computeStandardLaborCostPerUnit.ts`)
- `labor_cost_complete` (boolean) + `labor_cost_notes` (text[]) — pola identik `cost_data_complete`/`missing_cost_item_codes` di bawah, tapi untuk SDM: kalau ADA level produksi (item top ATAU WIP bersarang) yang routing/kru/`production_standards`-nya belum lengkap, jumlah PARSIAL tetap ditampilkan (BUKAN disembunyikan jadi null/0) dan `labor_cost_notes` menjelaskan persis level mana yang dilewati dan kenapa
- `cost_data_complete` (boolean) + `missing_cost_item_codes` (text[]) — eksplisit menandai kalau ADA bahan/kemasan leaf yang belum punya `items.standard_cost`, supaya baseline yang tidak lengkap TIDAK diam-diam dianggap benar 100% — **SEKARANG JUGA gerbang keras**: `lockMarginBaseline.ts` MENOLAK mengunci selama `cost_data_complete=false` (Sesi 0C 0C.4), pesan sebut persis item mana yang kurang
- `unverified_cost_item_codes` (text[], 26 Agu 2026) — beda dari `missing_cost_item_codes`: item DI SINI punya `standard_cost` dan IKUT dijumlah ke `standard_material_cost_per_unit`/`standard_packaging_cost_per_unit`, cuma `items.cost_unverified=true` (harga asumsi, belum dikonfirmasi purchasing) — ditampilkan sebagai peringatan terpisah, bukan alasan "belum lengkap"
- `margin_floor_threshold` (nullable, numeric) — preferensi pemilik order, BOLEH di-`UPDATE` kapan saja LEWAT baris AKTIF (`archived_at IS NULL`) — SEKARANG mensyaratkan baseline sudah terkunci lebih dulu (lihat catatan "Kunci vs Lihat" di atas)
- `created_at`
- `archived_at`, `archived_reason`, `locked_by` (→ `user_id`), `relock_reason` (Sesi 0C — sama seperti feasibility snapshot di atas)

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
- `rework` (boolean, default false, 25 Agu 2026 — tumpangan §5 rencana KPI) — ditandai operator/SPV saat "Selesaikan Batch" kalau batch ini reproses ulang; dasar KPI backlog `metric.rejection_persen`/FPY nanti (KPI-2/3, belum dibangun), tapi datanya mulai terekam SEKARANG supaya punya riwayat sejak dini.
- `routing_snapshot_taken_at`, `snapshotted_bom_id` (→ `boms.bom_id`), `snapshotted_bom_version`, `snapshotted_buffer_percentage`, `snapshotted_routing_id` (→ `routings.routing_id`) (Sesi 6A, 21 Agu 2026) — lihat catatan "Snapshot Routing & BOM per Batch" di bawah. `routing_snapshot_taken_at` NULL berarti: batch belum dimulai (masih `planned`, tetap sengaja baca master hidup), ATAU batch lama dari SEBELUM fitur ini ada (tidak diisi snapshot karangan, ditandai apa adanya di UI).

> **Snapshot Routing & BOM per Batch (Sesi 6A, 21 Agu 2026) — risiko yang ditutup:** `work_orders.bom_id`/`routing_id` HANYA referensi ke baris yang BISA berubah isinya (`updateRouting.ts`/`updateBom.ts` menghapus+menulis ulang `routing_steps`/`bom_lines` untuk `routing_id`/`bom_id` yang SAMA, bukan bikin versi baru — dikonfirmasi lewat kode, bukan diasumsikan). Tanpa snapshot, mengedit routing/BOM hari ini diam-diam mengubah "durasi standar tahap" (`getGanttBlockDetail.ts`, Gantt Produksi `getWorkCenterGantt.ts`, Kapasitas Work Center `getWorkCenterCapacity.ts`) dan "Kebutuhan Bahan" (`WorkOrdersPage.tsx`) yang ditampilkan untuk batch yang SUDAH SELESAI kemarin — bukan cuma batch baru. Sekarang: `startProductionBatch.ts` membekukan `routing_steps` (→ `production_batch_routing_step_snapshots`), `routing_step_standard_crew` (→ `production_batch_standard_crew_snapshots`, disiapkan untuk kebutuhan ke depan — belum ada tampilan level-batch yang memakainya hari ini) dan `bom_lines` (→ `production_batch_bom_line_snapshots`) PERSIS SAAT batch itu mulai (bukan saat dibuat/selesai). Keempat fungsi tampilan di atas membaca dari snapshot kalau `routing_snapshot_taken_at` terisi, dan tetap membaca master hidup kalau belum (batch belum dimulai). Layar Routing menampilkan peringatan jujur "dipakai N batch berjalan — perubahan tidak akan mengubah batch tersebut" (bukan blokir) kalau versi itu sedang dipakai. Aritmatika TIDAK berubah — cuma SUMBER angkanya (snapshot beku vs master hidup).

### `production_batch_routing_step_snapshots`
Tahap routing beku PER BATCH (Sesi 6A). `routing_step_id`/`work_center_id` disimpan sebagai referensi HISTORIS SAJA (bukan FK wajib — baris `routing_steps` aslinya bisa diganti ID baru oleh `updateRouting.ts`), `work_center_name`/`work_center_code` disalin PERSIS supaya tetap benar walau work center itu sendiri berganti nama nanti.
- `production_batch_routing_step_snapshot_id`, `company_id`, `production_batch_id`
- `routing_step_id`, `sequence_no`, `step_name`, `work_center_id`, `work_center_name`, `work_center_code`
- `active_duration_minutes`, `wait_duration_minutes`, `duration_per_unit_minutes`, `snapshot_taken_at`

### `production_batch_standard_crew_snapshots`
Standar kru beku PER BATCH (Sesi 6A) — salinan `routing_step_standard_crew` PERSIS saat batch dimulai. Disiapkan untuk kebutuhan ke depan (belum ada tampilan level-batch yang membacanya hari ini, karena `routing_step_standard_crew` sendiri belum punya UI tulis sama sekali per audit Sesi 5).
- `production_batch_standard_crew_snapshot_id`, `company_id`, `production_batch_id`
- `routing_step_standard_crew_id`, `role_label`, `wage_type`, `headcount`, `hours_per_day`, `is_full_day_dedicated`, `source`, `notes`, `snapshot_taken_at`

### `production_batch_bom_line_snapshots`
Baris BOM beku PER BATCH (Sesi 6A). `component_item_id` AMAN di-FK (items tidak pernah hard-delete). `bom_line_id`/`routing_step_id` referensi historis saja, sama alasannya dengan tabel routing di atas.
- `production_batch_bom_line_snapshot_id`, `company_id`, `production_batch_id`
- `bom_line_id`, `component_item_id` (→ `item_id`), `qty_per_unit_output`, `uom`, `routing_step_id`, `snapshot_taken_at`

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

### `status_transition_rules` (16 Agu 2026) — DITEMUKAN sudah ada di `daftar-database-sederhana.md` tapi belum di dokumen ini; dilengkapi 25 Agu 2026
Daftar transisi status yang SAH per tabel — ditegakkan LANGSUNG di database lewat trigger, bukan cuma di kode aplikasi, jadi tidak bisa dilewati walau lewat koneksi service-role sekalipun.
- `status_transition_rule_id`, `table_name`, `from_status`, `to_status`
- Diterapkan ke 5 tabel: `customer_purchase_orders`, `sales_orders`, `work_orders`, `production_batches`, `customer_po_approvals`. Contoh transisi yang DITOLAK trigger: PO Client `Batal` → `Sudah Diproses`.

### `status_transition_log`
Audit trail terpusat, dicatat OTOMATIS oleh trigger yang sama setiap kali ada transisi status yang sah — beda dari kolom `approved_by`/`acknowledged_by` per tabel yang cuma menyimpan aksi TERAKHIR (riwayat sebelumnya tertimpa hilang).
- `status_transition_log_id`, `company_id`, `table_name`, `record_id`
- `from_status`, `to_status`, `changed_by` (nullable), `changed_at`, `reason` (nullable)

---

## Kelompok 6: Billing

### `invoices`
- `invoice_id`, `company_id`, `subscription_plan_id`, `amount`, `status` (unpaid/paid/overdue), `payment_gateway_ref`, `period_start`, `period_end`

---

## Kelompok 7: Kamus (K1, 21 Agu 2026)

docs/rencana-modul-kamus-paralel.md. Antrean internal supaya pemilik produk & tim
menjelaskan MAKNA kolom/metrik data secara paralel — BUKAN sistem AI (tanpa panggilan
LLM), draf awal ditulis Claude Code manual.

### `kamus_terms`
- `kamus_term_id`, `company_id`, `scope` (`FIELD`/`METRIC`/`RELATION`/`RULE`)
- `entity` (nama tabel, FIELD/RELATION), `field` (nama kolom, FIELD saja) — null selain itu
- `term_key` (unik dibaca manusia, mis. `bom_lines.qty_per_unit_output` / `metric.margin_kontribusi`) — unik `(company_id, term_key)`
- `priority` (1-5), `domain` (`uang`/`kuantitas`/`status`/`standar`/`proses`/`lainnya`)
- `suggested_role` (teks bebas, BUKAN FK — proyek ini tidak punya tabel `roles` terpisah)
- `status` (`BELUM`/`DRAF_AI`/`DIJAWAB`/`DIKONFIRMASI`/`TIDAK_RELEVAN`), `ai_draft`
- `answer_plain`/`answer_pitfall`/`answer_range`, `answered_by`/`answered_at`, `confirmed_by`/`confirmed_at`
- `assigned_to_role`, `assigned_note`, `created_at`/`updated_at`, `version`

### `kamus_term_history`
Audit trail — SATU-SATUNYA preseden pola "riwayat per-field" di proyek ini sebelum
`kpi_registry_history` (Kelompok 11) meniru pola yang sama. Diisi OTOMATIS oleh trigger
`kamus_terms_track_history()` (BEFORE UPDATE), bukan ditulis manual dari server function.
- `kamus_term_history_id`, `kamus_term_id`, `changed_by`, `changed_at`, `field_changed`, `old_value`, `new_value`

### `kamus_routing_rules`
Aturan routing "kolom bernama begini → sarankan department X menjawab", dipakai generator backlog.
- `kamus_routing_rule_id`, `company_id`, `domain`, `entity_pattern` (pola nama tabel/kata kunci), `suggested_role`, `rationale`, `created_at`

> **Akses**: SELECT terbuka untuk semua staf company (antrean = hak semua orang tahu jawab). TIDAK ADA policy INSERT/UPDATE untuk `authenticated` sama sekali (default deny) — SEMUA tulis lewat server function pakai admin client dengan gerbang role di TypeScript.

---

## Kelompok 8: Dashboard Proyek AI (K1b, 21 Agu 2026)

docs/instruksi-dashboard-proyek-ai.md. Alat internal LEADERSHIP-ONLY (company_admin/
general_manager) — progres roadmap fitur AI dari data nyata, bukan kira-kira.

### `ai_project_phases`
- `ai_project_phase_id`, `company_id`, `code`, `name`, `description`, `weight_percent`, `sort_order`, `status` (`BELUM`/`BERJALAN`/`SELESAI`/`DITUNDA`) — unik `(company_id, code)`

### `ai_project_tasks`
- `ai_project_task_id`, `company_id`, `ai_project_phase_id`, `code`, `name`, `description`
- `weight_percent` (bobot DI DALAM fase, jumlah per fase = 100)
- `owner_type` (`PEMILIK_PRODUK`/`TIM`/`CLAUDE_CODE`/`CAMPURAN`), `suggested_role`
- `progress_source` (`AUTO_QUERY`/`CHECKLIST`/`MANUAL_PERCENT`), `progress_key` (kunci rumus utk AUTO_QUERY)
- `action_type` (`BUKA_KAMUS`/`BUKA_CHECKLIST`/`BUKA_HALAMAN`/`INFO_SAJA`), `action_target`
- `blocked_by` (integer[], prasyarat task lain), `status`, `sort_order`
- `manual_percent`/`manual_percent_set_by`/`manual_percent_set_at` — HANYA dipakai `progress_source=MANUAL_PERCENT`, ditegakkan app layer (`parseAiProjectTaskInput`) supaya AUTO_QUERY TIDAK PERNAH bisa diketik manual

### `ai_project_checklist_items`
- `ai_project_checklist_item_id`, `ai_project_task_id`, `label`, `done`, `done_by`, `done_at`, `note`, `sort_order`

### `ai_project_progress_snapshots`
Snapshot manual (tombol "Ambil Snapshot Sekarang", belum ada cron) — BUKAN time-series metrik
generik (lihat catatan `kpi_snapshots`, Kelompok 11, kenapa tabel ini TIDAK dipakai ulang).
- `ai_project_progress_snapshot_id`, `company_id`, `taken_at`, `overall_percent`, `per_phase` (jsonb)

> **Akses**: SENGAJA TIDAK ADA policy authenticated sama sekali (default deny total, lebih ketat dari Kamus) — SEMUA baca/tulis lewat server function + gerbang `isCompanyLeadership()` di TypeScript. Alasan: roadmap internal proyek AI, bukan pekerjaan operasional harian yang relevan semua departemen.

---

## Kelompok 9: Kesiapan AI Tenant (22-24 Agu 2026)

docs/spesifikasi-kesiapan-ai-tenant.md. TENANT-FACING (beda dari Kelompok 8 yang internal) —
skor kesiapan per kemampuan AI + gerbang beneran (bukan cuma peringatan), tanpa LLM.

### `ai_capabilities`
Katalog GLOBAL (bukan per-tenant — baru ada satu tenant nyata, prinsip "jangan bangun
abstraksi spekulatif utk tenant yang belum ada"). 6 dari 7 kemampuan diseed langsung di
migration (kecuali "Advisor/saran tindakan" — butuh eval suite yang belum ada).
- `ai_capability_id`, `code` (unik), `name`, `description`, `tier` (`CORE`/`INSIGHT`/`COPILOT`), `sort_order`, `created_at`

### `ai_capability_requirements`
Prasyarat terukur per kemampuan.
- `ai_capability_requirement_id`, `capability_id`, `code`, `label`, `metric_key`, `threshold`, `comparator` (`GTE`/`LTE`), `weight`, `is_blocking`, `sort_order` — unik `(capability_id, code)`

### `ai_capability_status`
Hasil evaluasi PER TENANT — dihitung ulang `recomputeAiReadiness()` (LIVE tiap dashboard
dibuka, di-cache lewat upsert; belum ada cron).
- `ai_capability_status_id`, `company_id`, `capability_id`, `readiness_percent`, `is_unlocked`, `blocking_reasons` (jsonb), `computed_at` — unik `(company_id, capability_id)`

### `ai_capability_overrides`
Pengecualian sadar (demo/uji) — HANYA `super_admin` platform (BUKAN admin tenant manapun, termasuk `company_admin`), wajib beralasan + berbatas waktu. Tidak ada UI tenant yang mengarah ke sini.
- `ai_capability_override_id`, `company_id`, `capability_id`, `unlocked_by`, `reason`, `expires_at`, `created_at`

### `ai_answer_feedback`
Disiapkan (§3.6 dokumen), BELUM ADA pemanggil nyata — tidak ada fitur AI yang menjawab pakai LLM di proyek ini saat ini.
- `ai_answer_feedback_id`, `company_id`, `capability_id`, `user_id`, `question`, `answer`, `feedback_reason`, `readiness_snapshot` (jsonb), `created_at`

> **Rumus kesiapan**: `persen = min(100, aktual/ambang × 100)` per prasyarat; kemampuan terbuka HANYA kalau SEMUA prasyarat `is_blocking=true` terpenuhi (gerbang keras, bukan skor); skor kemampuan = rata-rata tertimbang (`weight`) persen tiap prasyarat.
> **Akses**: katalog (`ai_capabilities`/`ai_capability_requirements`) baca semua `authenticated`, tulis `super_admin` saja. `ai_capability_status` baca scoped company (tenant lihat miliknya sendiri). `ai_capability_overrides` HANYA `super_admin` baca MAUPUN tulis — admin tenant tidak bisa lihat/buat override tenant manapun.
> **Penyimpangan jujur**: `quality.ncr_root_cause` (butuh tabel NCR, tidak ada) dan kemampuan "Advisor" (butuh eval suite, tidak ada) TIDAK diseed — dilaporkan, bukan diproksi pakai tabel lain yang maknanya beda.

---

## Kelompok 10: Absensi Geo-QR — Gelombang 1 (23 Agu 2026)

docs/rancangan-absensi-geo-qr.md §11. HANYA Gelombang 1 (skema + state machine + geofence
+ ledger + rekap) — W2 (QR dinamis tablet), W3 (PWA karyawan), W4 (konsol HRD), W5
(integrasi kapasitas) DITUNDA. `employee_attendance` (Kelompok 2) DIPERLUAS jadi rekap
harian gelombang ini, bukan tabel `attendance_days` baru — lihat catatan di sana.
`production_plants` (Kelompok 2) juga dapat 3 kolom baru: `center_lat`/`center_lng`/
`geofence_radius_meters` (1 plant = 1 geofence, relasi 1:1 tidak butuh tabel `plant_geofences` terpisah).

### `attendance_events`
Ledger APPEND-ONLY (§6, §3.6 dokumen: "event adalah ledger; rekap harian adalah agregat").
`employee_attendance` dihitung ULANG dari sini, tidak pernah diedit manual field-per-field.
- `attendance_event_id`, `company_id`, `employee_id`, `production_plant_id`
- `event_type` (`IN`/`OUT`/`BREAK_START`/`BREAK_END`), `occurred_at`
- `method` (`QR_TABLET`/`GEO_PHONE`/`MANUAL_HRD`), `lat`/`lng`/`accuracy_m`
- `geofence_status` (`DALAM`/`LUAR`/`TANPA_GPS`), `device_id`
- `qr_token_id` (nullable, disiapkan utk W2 — belum ada penerbit token)
- `client_event_id` (unik `(company_id, client_event_id)` — kunci idempotensi: kirim 2× dgn ID sama = 1 event tersimpan)
- `photo_url`, `flags` (jsonb), `recorded_by` (diisi kalau `method=MANUAL_HRD`), `created_at`

> **Append-only murni disiplin aplikasi** (pola SAMA `status_transition_log`) — TIDAK ADA trigger keras yang memblokir UPDATE/DELETE (percobaan pertama migrasi memakainya, diperbaiki migration susulan karena menyulitkan pembersihan data test tanpa manfaat nyata), TIDAK ADA policy authenticated utk tulis, dan TIDAK ADA satu pun server function yang memanggil `.update()`/`.delete()` pada tabel ini — koreksi selalu MENAMBAH event baru.

### `attendance_devices`
Device binding ringan v1 (§2.5) — HP pertama karyawan terdaftar otomatis; ganti perangkat butuh approval HRD.
- `attendance_device_id`, `company_id`, `employee_id`, `device_fingerprint`, `device_type` (`EMPLOYEE_PHONE`/`GATE_TABLET`), `status` (`ACTIVE`/`PENDING_APPROVAL`/`REVOKED`), `registered_at`, `approved_by`/`approved_at` — unik `(employee_id, device_fingerprint)`

### `attendance_corrections`
Koreksi lupa-absen/salah-jam — state machine `PENDING`/`APPROVED`/`REJECTED`. Disetujui HRD → MENAMBAH event baru (tidak mengubah event asli).
- `attendance_correction_id`, `company_id`, `employee_id`, `attendance_date`, `requested_event_type` (`IN`/`OUT`), `requested_occurred_at`, `reason`, `status`, `requested_by`, `decided_by`/`decided_at`, `resulting_event_id`, `created_at`

### `leave_requests`
Izin/sakit/cuti — TIDAK lewat `attendance_events` (tidak ada scan utk ketidakhadiran), langsung menimpa status hari itu di `employee_attendance` setelah disetujui.
- `leave_request_id`, `company_id`, `employee_id`, `leave_type` (`IZIN`/`SAKIT`/`CUTI`), `start_date`/`end_date`, `reason`, `attachment_url`, `status`, `requested_by`, `decided_by`/`decided_at`, `created_at`

> **Akses**: RLS keempat tabel HANYA batas company (isolasi tenant) — gerbang per-role lebih halus (company_admin/HR lihat semua, manager lihat departemennya, karyawan lihat miliknya sendiri) DITEGAKKAN DI TYPESCRIP, bukan RLS langsung, supaya satu tempat mengubah aturan (pola SAMA `employee_attendance`). TIDAK ADA policy INSERT/UPDATE authenticated di keempat tabel.

---

## Kelompok 11: KPI (KPI-1, 25 Agu 2026)

docs/rencana-kerja-kpi.md + docs/penyerahan-opus-fitur-kpi.md + docs/revisi-kpi-visibilitas-tanggung-jawab.md.
**Catatan cakupan**: 4 modul sebelumnya (Kamus, Dashboard Proyek AI, Kesiapan AI, Absensi)
sempat DITEMUKAN belum pernah didokumentasikan di sini (25 Agu 2026, sesi yang sama) —
sudah DILENGKAPI sebagai Kelompok 7-10 di atas (bukan lagi utang, lihat catatan audit
lengkap di HANDOFF untuk daftar tabel LAIN yang juga ditemukan belum tercatat).

### `kpi_registry`
Satu baris per KPI aktif per tenant. `metric_key` WAJIB merujuk `kamus_terms.term_key` scope
METRIC (FK komposit `(company_id, metric_key)` → `kamus_terms(company_id, term_key)`) — rumus
KPI TIDAK PERNAH ditulis ulang di sini, kamus adalah satu-satunya sumber kebenaran rumus.
- `kpi_registry_id`, `company_id`, `metric_key`
- `kind` (`DISIPLIN`/`HASIL`) — DISIPLIN: target terkunci ideal, TIDAK bisa diedit tenant (gerbang di `updateKpiTarget.ts`, cek KIND sebelum cek role). HASIL: `target_value` null sampai baseline ≥2 bulan, lalu diisi manual lewat alur tercatat.
- `pillar` (`EFISIENSI`/`OPTIMASI`/`TRANSPARANSI`/`IMPROVEMENT`/`RECORD`)
- `owner_role` (text bebas, BUKAN FK — proyek ini tidak punya tabel `roles` terpisah, pola sama `kamus_terms.suggested_role`), `frequency` (`HARIAN`/`MINGGUAN`/`BULANAN`/`PER_KEJADIAN`)
- `target_value`, `target_set_at`, `target_set_by` — `benchmark_value`, `benchmark_label`, `benchmark_source` (arah industri, bukan kontrak) — `warn_threshold`, `alert_threshold`
- `attribution_level` (`INDIVIDU`/`TIM`/`LINI`/`PROSES`/`PERUSAHAAN`) — tingkat PALING RENDAH yang adil untuk KPI ini; yield SENGAJA LINI bukan INDIVIDU (dipengaruhi lot bahan/mesin/tahap sebelumnya, bukan kendali satu operator)
- `visibility` (jsonb array `DIRI`/`ATASAN`/`DEPARTEMEN`/`PUBLIK_AGREGAT`) — disimpan sesuai spek untuk KPI-4; enforcement AKTUAL KPI-1 pakai aturan lebih sederhana di `canViewKpi()` (leadership selalu boleh, role pemilik KPI boleh, role finance boleh untuk KPI berdomain uang)
- `improvement_levers` (text[], kurasi manual, belum diisi sesi ini) — `is_active`, `sort_order`

### `kpi_snapshots`
Time-series generik PERTAMA di proyek ini (dicek sebelum dibangun: tidak ada tabel snapshot
Fase 0.5/KPI-baseline yang bisa dipakai ulang — 3 tabel "snapshot" lain semuanya berbentuk
tetap milik satu baris pemilik, bukan time-series metric_key/period). Dihitung LIVE tiap
`/api/kpi` dibuka lalu di-upsert (belum ada cron/Vercel Cron di proyek ini, pola sama
`ai_capability_status`/`computeAiProjectProgress`) — KALAU Fase 0.5 KPI-baseline dibangun
kelak, HARUS memakai tabel ini, bukan tabel snapshot keempat.
- `kpi_snapshot_id`, `company_id`, `metric_key`, `period_start`, `period_end`
- `value` (nullable — null = belum bisa dihitung, BUKAN 0), `computed_at`, `inputs_hash`
- unik `(company_id, metric_key, period_start, period_end)`

### `kpi_actions`
"Setiap KPI merah pulang dengan tindakan tertulis" — skema disiapkan KPI-1, UI/alur
pembuatannya KPI-3 (belum dibangun, tabel kosong sesi ini).
- `kpi_action_id`, `company_id`, `kpi_registry_id`, `period` (label bebas), `finding`, `action_text`
- `owner_role` / `owner_user_id` (salah satu wajib), `due_date`, `status` (`TERBUKA`/`BERJALAN`/`SELESAI`/`BATAL`), `created_by`, `closed_at`

### `kpi_responsibilities`
Many-to-many KPI ↔ role/user, menjawab "KPI ini siapa yang bertanggung jawab?" secara
eksplisit di UI + mengisi kandidat penanggung jawab `kpi_actions`.
- `kpi_responsibility_id`, `company_id`, `kpi_registry_id`, `role` / `user_id` (salah satu wajib), `responsibility` (`PEMILIK`/`KONTRIBUTOR`/`PENDUKUNG`), `note`

### `kpi_registry_history`
Audit trail perubahan `target_value`/`visibility`/`attribution_level` — pola SAMA PERSIS
`kamus_term_history` (satu-satunya preseden audit-trail di proyek ini): satu baris per field
yang berubah, old/new value sebagai text.
- `kpi_registry_history_id`, `kpi_registry_id`, `changed_by`, `changed_at`, `field_changed`, `old_value`, `new_value`

**5 KPI kategori A diseed** (`seedKpiRegistry.ts`, idempoten): margin kontribusi bulanan
(`metric.margin_kontribusi`, dari RPC `get_monthly_operating_profit` yang sama dgn halaman
Laba Operasional — satu sumber kebenaran, bukan dihitung ulang beda jalur), biaya produksi
per unit (`metric.biaya_produksi_per_unit`, rata-rata sederhana lintas produk aktif dari
`computeStandardCostPerUnit`+`computeStandardLaborCostPerUnit`), laba operasional bulanan
(`metric.laba_operasional_bulanan`, RPC sama), yield per tahap (`metric.yield_per_tahap_produk`,
rata-rata `total_yield_pct` lintas batch selesai minggu berjalan — rumus PERSIS
`getBatchYieldSummary.ts`), nilai persediaan (`metric.nilai_persediaan`, Σ
`quantity_on_hand`×`unit_cost` lot available, BARU — sebelumnya tidak ada fungsi yang
menghitung ini). **Semua `target_value` null, TANPA KECUALI** (lihat riwayat KPI ke-6
di bawah — sempat ada 1 pengecualian, sudah dicabut).

**KPI ke-6, ditambahkan 25 Agu 2026 (koreksi pemilik produk)**: Margin Kontribusi %
(`metric.margin_kontribusi_persen`) — data SAMA dgn margin kontribusi Rupiah (RPC
`get_monthly_operating_profit`, periode sama), dinyatakan persentase = total margin ÷ total
nilai jual × 100. Diverifikasi via fixture test (`tests/kpi_module.test.ts`): harga+biaya
Gummy Zala (Rp108.000, biaya Rp34.307,23) → 68,2%; Drinkme (Rp33.000, biaya Rp26.817,29) →
18,7% (angka biaya DIPERBARUI 26 Agu 2026 setelah formula resmi Gummy Zala V2/Drinkme V1
diterapkan ke BOM — item-item ini sendiri sudah dihapus total dari sistem 26 Agu 2026 saat
penggantian studi kasus ke MLVT, fixture test tetap valid karena pakai item uji terisolasi).

> **RIWAYAT target 35% (dipasang 25 Agu, DICABUT 26 Agu 2026)**: sempat `target_value=35`
> (GPM kebijakan finance) diterapkan di KPI ini (bukan di KPI Rupiah, unit mismatch), dengan
> catatan GPM sesungguhnya dihitung SETELAH overhead pabrik sedangkan Margin Kontribusi
> BELUM (aturan K2) — angka KPI ini SELALU LEBIH TINGGI dari GPM riil. **Keputusan pemilik
> produk 26 Agu 2026: 35% itu angka dari KONTEKS SIMULASI PO lama (Gummy Zala/Drinkme),
> BUKAN kebijakan yang berlaku untuk studi kasus baru — DICABUT SEPENUHNYA** (migrasi
> `20260826140000_remove_gpm_35_target.sql`), target kembali null sama seperti 5 KPI lain.
> Target sekarang diisi PER PRODUK/ORDER lewat `updateKpiTarget.ts` yang sudah ada, bukan
> dipasang ulang di seed. Pertanyaan lama ke finance ("apakah GPM 35% dihitung setelah
> overhead pabrik?") jadi TIDAK RELEVAN lagi — dicatat di sini supaya tidak diulang.

---

## Kelompok 12: Master Dokumen — MD-1 (Bagian C, 26 Agu 2026)

Fondasi registry berkas — SATU tempat untuk semua dokumen masuk/keluar sistem (PO klien,
POD, surat jalan, COA, sertifikat Halal, spesifikasi bahan, kontrak, SOP). Registry di
ATAS storage yang sudah ada, bukan silo baru — semua unggahan BARU (aturan CLAUDE.md
"Aturan Unggah Berkas") lewat `uploadDocument.ts`, yang memanggil `uploadFileWithMetadata`
(checksum) LALU menambah baris registry, bukan menggantikannya. Gerbang waktu "setelah
SAS001 & SAS005 terkirim" di dokumen sumber DIBATALKAN eksplisit oleh pemilik produk 26
Agu 2026 ("asumsikan sudah ada, kita bangun semuanya nanti diperbaiki sambil jalan") —
berlaku untuk gerbang serupa di dokumen manapun.

### `document_types`
Konfigurasi PER TENANT — menambah/mengubah jenis dokumen tidak membongkar apa pun.
- `document_type_id`, `company_id`, `code`, `name` (unik per company)
- `owner_role` (nullable, departemen disarankan memiliki jenis ini — pola sama `kamus_terms.suggested_role`)
- `sensitivity_default` (`UMUM`/`DEPARTEMEN`/`TERBATAS`), `requires_expiry`, `retention_months` (nullable), `reminder_days_before` (integer[], nullable)
- Seed awal 9 jenis (§2 dokumen rencana, BELUM final — 2 dari 6 pertanyaan wawancara §7 masih pakai default sementara, ditandai HANDOFF): `PO_KLIEN`, `POD`, `SURAT_JALAN`, `COA`, `SERTIFIKAT_HALAL`, `SPEC_BAHAN`, `KONTRAK`, `SOP`, `LAINNYA`

### `documents`
- `document_id`, `company_id`, `doc_type` (merujuk `document_types.code`, bukan FK komposit — tetap valid dibaca meski baris jenisnya berubah)
- `title`, `doc_number` (nullable), `description` (nullable)
- `storage_path`, `mime_type`, `size_bytes`, `checksum_sha256`
- `issued_by` (nullable, free text), `issued_date`/`effective_date`/`expiry_date` (nullable)
- `status` (`AKTIF`/`KEDALUWARSA`/`DIARSIP`/`DIGANTI`)
- `version_group_id` (nullable, `document_id` versi pertama di grup), `version_no`, `superseded_by` (nullable, → `documents`)
- `sensitivity` (`UMUM`/`DEPARTEMEN`/`TERBATAS`) + `department` (nullable, wajib diisi kalau bukan UMUM — daftar nilai SAMA `employees.department`)
- `uploaded_by` (→ `users`), `uploaded_at`

> **Penyimpangan dari model data dokumen sumber** (diperiksa & didokumentasikan): `department_id`/`department_owner_role_id` → `department text`/`owner_role text` (proyek ini tidak punya tabel `roles`/`departments` terpisah). `ocr_text tsvector` SENGAJA TIDAK ditambahkan — itu scope MD-3 (pencarian isi dokumen), belum dipakai = kolom mati kalau ditambah sekarang.

> **Aturan §3.1 tidak bisa ditawar — "Hapus = arsip".** Dokumen bertaut entitas transaksi (via `document_links`) TIDAK PERNAH hard-delete. Hard delete HANYA untuk berkas yatim (`document_links` kosong), HANYA `company_admin` (bukan `general_manager` — sengaja lebih sempit dari leadership biasa, tindakan destruktif ireversibel), dengan alasan WAJIB tercatat permanen di `document_access_log` (action `delete` + `reason`, `document_id` nullable `ON DELETE SET NULL` supaya baris log tetap hidup setelah dokumennya hilang, `document_title_snapshot` disalin sebelum hilang).

> **Visibilitas sensitivity — ditegakkan DUA LAPIS, harus sinkron** (fungsi `jwt_document_department()`: departemen efektif dari ROLE, bukan `employees.department` — strip akhiran `_manager`/`_staff`; `company_admin`/`general_manager`/`admin_staff` tidak ter-map, lolos lewat `jwt_is_company_leadership()`). UMUM = semua orang di company; DEPARTEMEN = manager ATAU staff di departemen yang sama, atau leadership; TERBATAS = HANYA manager departemen yang sama, atau leadership (staff department sendiri TIDAK otomatis lihat TERBATAS departemennya — v1, relevan untuk kontrak kerja HRD). **Lapis 1**: RLS `documents`/storage policy bucket `documents` (bucket PRIVAT, PERTAMA di proyek ini — semua bucket sebelumnya public). **Lapis 2**: `listDocuments.ts`/`getDocumentSignedUrl.ts` pakai admin client (pola sama `listKamusTerms.ts` dkk), jadi filter yang SAMA PERSIS ditegakkan ULANG di TypeScript (`canViewDocument()` di `src/lib/roles.ts`) — RLS di sini cuma jaring pengaman untuk akses PostgREST/storage langsung, bukan satu-satunya gerbang endpoint aplikasi.

### `document_links`
Satu dokumen bisa menempel ke banyak entitas.
- `document_link_id`, `company_id`, `document_id` (→ `documents`), `entity_type` (nama tabel, mis. `lots`/`sales_orders`), `entity_id`, `link_role` (mis. `COA`/`SUMBER`/`SERTIFIKAT`/`POD`)

### `document_access_log`
Audit trail — HANYA leadership yang bisa baca (beda dari `status_transition_log`/`document_signatures` yang company-wide select, karena isinya "siapa membuka dokumen sensitif apa").
- `document_access_log_id`, `company_id`, `document_id` (nullable, `ON DELETE SET NULL`), `document_title_snapshot` (nullable), `accessed_by` (→ `users`), `action` (`view`/`download`/`delete`), `reason` (nullable, diisi untuk `delete`), `accessed_at`
- **View** dicatat HANYA untuk dokumen TERBATAS (UMUM/DEPARTEMEN tidak, supaya log tidak dibanjiri tanpa nilai audit)

> **"Lihat tanpa mengunduh" = signed URL berumur PENDEK (120 detik)** — viewer inline PDF/gambar langsung di halaman (pdf.js browser native lewat `<iframe>`), bukan URL permanen yang bisa disebar. Jenis office (xlsx/docx) v1 = unduh saja (keputusan eksplisit pemilik produk, "jangan bangun konversi dokumen"), validasi magic-bytes: PDF/gambar 100% dari byte; xlsx/docx dikonfirmasi kontainer ZIP asli + dipercaya dari ekstensi klaim (byte magic number TIDAK bisa membedakan xlsx/docx/pptx sendirian tanpa buka `[Content_Types].xml`, didokumentasikan sebagai keterbatasan v1 di `src/lib/imageUpload.ts`).

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
companies ──< kamus_terms ──< kamus_term_history; kamus_routing_rules terpisah (aturan saran, bukan per-term)
companies ──< ai_project_phases ──< ai_project_tasks ──< ai_project_checklist_items; ai_project_progress_snapshots terpisah (snapshot manual)
ai_capabilities ──< ai_capability_requirements (katalog GLOBAL, bukan per-company)
companies ──< ai_capability_status ──> ai_capabilities; companies ──< ai_capability_overrides, ai_answer_feedback ──> ai_capabilities
employees ──< attendance_events, attendance_devices, attendance_corrections, leave_requests; employee_attendance dihitung ULANG dari attendance_events
kamus_terms ──< kpi_registry (metric_key, FK komposit) ──< kpi_snapshots, kpi_actions, kpi_responsibilities, kpi_registry_history
```
