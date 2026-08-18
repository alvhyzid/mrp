# HANDOFF — Kondisi Terkini Proyek

Dokumen kerja lintas-sesi (pola B.11, lihat `docs/rencana-kerja-playbook-ams.md`). Tiap sesi Claude Code WAJIB baca ini dulu sebelum mulai, dan memperbarui bagian relevan begitu sesi selesai. Klaim di sini harus tetap diverifikasi ulang, bukan otomatis dipercaya — HANDOFF ini rangkuman, bukan pengganti bukti.

---

## GELOMBANG 1 & 2 — Seed Real Case + Implementasi Margin v1 (18 Agu 2026)

Lanjutan GELOMBANG 0 (di bawah) setelah pemilik produk melengkapi 2 blocker data yang dicatat sebelumnya: `docs/data-produksi-itm-ekstrak.md` (ekstrak `DATA_PRODUKSI_PT_ITM.pdf` + koreksi pemilik produk — 33 karyawan, SOP gummy/serbuk, 28 harga bahan baku individual, harga kemasan final). Kedua angka premix serbuk (PMSW/PMAC/PMFL/PMVITC/PMSRH) **diverifikasi cocok PERSIS** dengan agregat `Bahan/g` di spec §5 Contoh 2 sebelum dipakai (mis. PMSW: 50g maltodextrin×Rp20 + 20g stevia×Rp900 + 30g sucralose×Rp40 = Rp20.200/100g = **Rp202,00/g**, sama persis dengan tabel spec) — bukti data ekstrak konsisten dengan spec, bukan sekadar dipercaya begitu saja.

### GELOMBANG 1 — SEBAGIAN BESAR SELESAI, 2 hal SENGAJA belum (lihat "BLOCKER BARU" di bawah)

Script idempotent `scripts/seed-realcase-itm.js` (jalankan `node scripts/seed-realcase-itm.js`, dev server harus hidup di port 3000 karena bagian PO client lewat API asli, bukan insert DB langsung):

1. **28 item bahan baku** + harga (`items.standard_cost`, per gram/ml dari harga/kg ekstrak §4), **10 item kemasan** (item lama dikoreksi harganya, item baru dibuat — botol PET N200, label, inner/outer box, stiker segel, karton gummy isi 27, sachet, box isi 14, plastic wrap, karton serbuk isi 42).
2. **BOM lengkap & TERVERIFIKASI**: Premix Gelatin (WIP baru `WIP-PREMIX-GELATIN-ZALA`, 3 bahan) dan Gummy Zala (FG baru `FG-GUMMY-ZALA-N200`, 14 bahan + 6 baris kemasan, per 1 botol) — SEMUA rasio & harga dari spec §5 Contoh 1, diverifikasi cocok lewat acceptance test (lihat GELOMBANG 2 di bawah). 5 premix serbuk (`PMSW001ITM`/`PMAC001ITM`/`PMFLV001ITM` dikoreksi dari BOM fiktif lama, `PM-VITC-001ITM`/`PM-SRH-001ITM` baru) — rasio dari spec, harga dari ekstrak, **cocok persis** dengan agregat spec (lihat verifikasi di atas).
3. **Routing**: Premix Gelatin (1 langkah, wait 12 jam), Gummy Zala (9 langkah dari ekstrak §2 Cooking→Pengepakan, wait Setting 1 jam + Curing 3 hari sesuai SOP), 5 premix serbuk (1 langkah "Mixing Premix" masing-masing). **`active_duration_minutes` SEMUA berlabel ESTIMASI_MANUAL** (K8) — ekstrak eksplisit bilang PDF tidak beri angka durasi aktif, jadi diisi estimasi kasar sesuai instruksi ("estimasi kasar BERLABEL", bukan blocker).
4. **`production_standards`** (tabel baru, pola K8): yield_percentage & unit_per_batch untuk Gummy Zala (85%, 51 botol/batch) dan Box Serbuk (95%, 226,19 box/batch), **batches_per_day=5** untuk Gummy Zala (dari ekstrak "kapasitas pipeline... 5 batch gummy/hari").
5. **33 karyawan** persis daftar ekstrak §1 (nama, jabatan, department, gaji/skema) — idempotent by (name, position), diverifikasi tidak dobel setelah run ulang.
6. **Konfigurasi biaya** (`company_settings`): `labor_costing_method=labor_log`, `scrap_valuation=zero`, `overhead_allocation=off`, `monthly_overhead_baseline=60500000`, `work_calendar_weekday_hours=7`, `work_calendar_saturday_hours=5`, `standard_hours_per_month=173.3333`.
7. **Customer PT Sastro Media + 2 PO REAL lewat API RESMI** (bukan insert status langsung) — SAS001 (10 Agu→10 Sep, 20.000 botol Gummy Zala @ Rp108.000) dan SAS005 (12 Agu→12 Sep, 10.000 box Drinkme @ Rp33.000): create → approve 3 department (finance/ppic/manager, akun debug approver) → Process→SO, semua via `POST /api/customer-purchase-orders`, `/approve`, `/process` sungguhan. Hasil: SO `003/8-ITM/2026` & `004/8-ITM/2026`, status `confirmed`.
8. **Stok**: seluruh bahan baku baru = 0 (tidak ada lot dibuat). Supplier "Vendor China (Botol PET)", PO 30.500 pcs Botol PET N200, `order_date` 17 Agu, `expected_date` **22 Agu 2026**, status `ordered` (belum diterima) — persis skenario real case.

**BLOCKER BARU ditemukan saat eksekusi (dicatat di sini, sesuai protokol "catat & lewati"):**

1. **Resep top-level Drinkme Lemon (item `PMBX001ITM`) TIDAK bisa dibangun** — spec §5 Contoh 2 cuma memberi AGREGAT biaya per premix (mis. PMSW Rp203,1538/g) dan 3 kontributor terbesar batch (PMFL/sorbitol powder/psylium), TIDAK memberi rasio LENGKAP berapa gram tiap 1 dari 5 premix + bahan curah (sorbitol powder/psylium/inulin/dll) per 1 box output. Ekstrak §3 (SOP 12 proses) juga cuma menjelaskan URUTAN PROSES, bukan rasio resep. BOM lama (fiktif, dari `scripts/seed-debug-powder-drink.js`, komentarnya sendiri bilang "data UJI bukan resep asli") **DIBIARKAN APA ADANYA** — tidak ditimpa dengan angka karangan. Nama item `PMBX001ITM`/`PMSC001ITM` TIDAK diubah brandingnya ke "Drinkme Lemon" (masih generik) karena BOM-nya sendiri belum benar.
   **Yang dibutuhkan:** rasio resep top-level Drinkme (gram tiap 5 premix + bahan curah lain per 1 box isi 14 sachet, atau per 1 sachet).
2. **Pembersihan data demo lama (poin 8 instruksi asli) BELUM dijalankan** — environment kerja ini **tidak punya Docker** (dicoba ulang: `pg_dump` langsung tidak ada di PATH, dan bahkan `supabase db dump --linked --data-only` — versi yang seharusnya tidak butuh Docker karena connect ke remote — TETAP gagal dengan `LegacyDockerRunError`, CLI Supabase selalu shell-out ke pg_dump lewat container terlepas dari target lokal/remote). Syarat WAJIB instruksi asli ("pg_dump backup dulu, staging dulu, baru dev") tidak bisa dipenuhi jujur dari sini. Data real-case baru TETAP ADITIF (tidak menghapus apa pun) — demo lama & data baru berdampingan untuk sementara.
   **Yang dibutuhkan:** jalankan `supabase db dump --linked --data-only -f backup.sql` dari environment YANG PUNYA Docker Desktop (mesin lokal Anda, atau CI runner) sebagai backup, baru beri lampu hijau untuk pembersihan.

### GELOMBANG 2 — Implementasi Margin v1 — SELESAI (inti), acceptance test 4/4 lulus dengan angka literal

**1. Biaya lot hasil produksi** (`recordWorkOrderOutput.ts`, diperluas) — saat "Catat Hasil Produksi" bikin lot output baru:
- `lots.unit_cost` = (Σ bahan NON-KEMASAN dari `work_order_consumption` × `unit_cost` lot yang dipakai + Σ biaya SDM batch) ÷ qty output UTAMA.
- **`lots.packaging_cost`** (kolom baru) = Σ bahan KEMASAN (item `type='packaging'`) dari batch yang sama ÷ qty output utama — **DIPISAH dari `unit_cost`**, koreksi penting: verifikasi ulang terhadap spec §5 Contoh 1 menunjukkan spec menampilkan & menghitung "Biaya produksi per botol" (Rp22.891,33) dan "Kemasan per botol" (Rp8.829,63) sebagai **2 ANGKA TERPISAH** (baru dijumlah di langkah Margin, rumus §3), BUKAN 1 angka gabungan seperti asumsi awal GELOMBANG 0A. Mekanisme konsumsi kemasan (GELOMBANG 0A, `work_order_consumption`) tetap TIDAK berubah — cuma bagaimana `unit_cost` lot DIHITUNG dari konsumsi itu yang dikoreksi.
- reprocessable_waste/disposed_waste: `unit_cost=0, packaging_cost=0` (K7).
- Biaya SDM dihitung lewat `compute_production_batch_labor_cost()` (fungsi DB baru, TANPA gate JWT — dipanggil endpoint yang jalan lewat service-role) — SATU sumber kebenaran yang sama dipakai fungsi tampilan.

**2. Labor log** — **DITEMUKAN: sebelum ini TIDAK ADA satu pun endpoint yang menulis ke `work_order_assignments`** (tabel & fungsi agregat WO-level sudah ada dari sesi lama, tapi tidak pernah dipakai). Dibangun dari nol:
- `POST /api/work-orders/labor-log` (`recordLaborLog.ts`) — catat `actual_hours`/`qty_produced`/`work_date` per (batch, karyawan), upsert (1 baris per orang per batch).
- `work_order_assignments.work_date` (kolom baru) — dibutuhkan supaya tarif PHL/harian tahu hari itu Sabtu atau bukan (K4).
- **Bug presisi ditemukan & diperbaiki**: `actual_hours`/`scheduled_hours` sebelumnya `numeric(6,2)` — MEMBULATKAN jam kerja saat DISIMPAN (bukan cuma tampilan), pelanggaran K10 nyata (ditemukan lewat acceptance test: "20 menit" premix tersimpan jadi 0,33 jam bukan 0,3333, selisih ~Rp38 di batch nyata). Diperlebar ke `numeric(9,4)`.
- `get_production_batch_labor_cost_total()` (TOTAL, akses `company_admin`/`general_manager`/`finance_manager`/HR) dan `get_production_batch_labor_cost_detail()` (RINCIAN PER-ORANG, akses **company_admin SAJA** — K1 "Aturan tampilan": GM/finance cuma lihat total) — `GET /api/production-batches/[batchId]/labor-cost`.

**3. Margin** — `get_sales_order_margin()` (per SO) & `get_monthly_operating_profit()` (bulanan): `biaya = qty_shipped × (lots.unit_cost + lots.packaging_cost)`, `margin = revenue − biaya`. **DIHITUNG DARI DATA YANG ADA** (`shipment_lines`/`lots`), tidak ada tabel baru untuk margin itu sendiri. Akses `canViewFinancialData` (company_admin/GM/finance_manager) — `GET /api/sales-orders/[salesOrderId]/margin`, `GET /api/reports/monthly-operating-profit?year=&month=`.

**4. Acceptance test literal — `tests/margin_v1_acceptance.test.ts`, 4/4 LULUS:**
- **Contoh 1a & 1b (Premix Gelatin + Gummy Zala) — END-TO-END lewat operasi DB SUNGGUHAN** (fixture company terisolasi, insert lot/`work_order_consumption`/`work_order_assignments` sungguhan + RPC produksi asli `compute_production_batch_labor_cost`) — total premix Rp166.156,23 ✓, Rp80,5922/g ✓, bahan gummy Rp997.814,95 ✓, SDM Rp169.642,86 ✓, Rp22.891,33/botol ✓, kemasan Rp8.829,63/botol ✓, margin Rp76.279,04/botol ✓. Kuantitas bahan diturunkan presisi penuh dari (subtotal spec ÷ harga) — BUKAN dari kolom kuantitas yang sudah dibulatkan 2 desimal di tabel spec — supaya reproduksi tidak kena efek berantai pembulatan tampilan.
- **Contoh 2 (serbuk Drinkme) & Contoh 3 (agregasi) — FORMULA-LEVEL** (bukan lewat DB sungguhan) — karena resep top-level Drinkme masih blocked (lihat atas), test ini memvalidasi RUMUS (pembagian biaya/output, margin, agregasi − overhead) memakai angka literal yang MEMANG diberikan spec, bukan seluruh pipeline produksi sungguhan.

**5. Deteksi Konflik Perencanaan** — `getPlanningFeasibility.ts`, `GET /api/sales-order-lines/[salesOrderLineId]/planning-feasibility`: kebutuhan batch (qty÷unit_per_batch), kapasitas (batches_per_day), hari kerja tersedia (kalender kerja tenant), deteksi blocker material (komponen BOM stok 0 + PO supplier belum diterima → tanggal mulai paling awal = `expected_date` PO itu). **Diverifikasi hidup terhadap SAS001 sungguhan** (bukan simulasi):
  ```
  batches_needed: 393, days_needed: 79
  material_blocked_until: "2026-08-22"  <- PERSIS ETA PO botol China
  total_working_days_to_deadline: 21    <- PERSIS "21 hari tersisa per 18 Agu" di spec
  effective_working_days_after_material_block: 17  <- PERSIS "17 hari kerja terakhir" di spec
  feasible: false
  realistic_qty_deliverable_on_time: 4335
  ```
  **SAS005 belum bisa dihitung** — `batches_per_day` untuk item serbuk TIDAK ADA di spec maupun ekstrak (cuma disebut eksplisit untuk gummy: "5 batch gummy/hari"), endpoint dengan BENAR melaporkan "data belum ada" (bukan menebak angka kapasitas). Instruksi asli minta "SAS005 harus tampil feasible/ketat" — ini MENUNGGU angka kapasitas batch/hari serbuk dari pemilik produk, bukan bug.

**File migrasi baru** (7 file, `20260818100000` s.d. `20260818160000`): `production_standards` + job pembelajaran K8, `work_order_assignments.work_date`, primitif biaya SDM internal, kalkulasi margin, metric `batches_per_day`, `lots.packaging_cost`, dan perbaikan presisi `actual_hours`.

Typecheck bersih, `npm run build` sukses (semua route baru terdaftar), **37/37 test lulus** (33 lama + 4 acceptance baru).

### Yang MENUNGGU keputusan/data dari pemilik produk (ringkasan lengkap)
1. Rasio resep top-level Drinkme Lemon (gram tiap komponen per 1 box/sachet) — blocker BOM Drinkme.
2. Backup `pg_dump`/`supabase db dump` dari environment yang punya Docker — blocker pembersihan data demo.
3. Angka kapasitas `batches_per_day` untuk lini produksi serbuk — blocker verifikasi SAS005 di fitur Deteksi Konflik Perencanaan.

Begitu ketiganya tersedia: (1) BOM Drinkme bisa dilengkapi + acceptance Contoh 2 diulang end-to-end lewat DB sungguhan, (2) pembersihan demo bisa dieksekusi sesuai urutan asli (backup→staging→dev), (3) SAS005 bisa diverifikasi "feasible/ketat" sesuai kriteria selesai asli.

---

## GELOMBANG 0 — Prasyarat Margin v1 (18 Agu 2026) — SELESAI. GELOMBANG 1/2 — BLOCKED, lihat catatan di bawah

Instruksi: kerjakan GELOMBANG 0 → 1 → 2 otonom, boleh lewati bagian yang butuh keputusan bisnis (catat di sini, jangan improvisasi/tunggu). GELOMBANG 0 selesai penuh & terverifikasi. GELOMBANG 1 & 2 **BELUM dimulai** — bukan lupa, tapi 2 blocker data konkret ditemukan di awal (lihat bagian "BLOCKER" di bawah) yang membuat sebagian besar isi Gelombang 1/2 tidak bisa dikerjakan jujur tanpa mengarang data bisnis.

### 0A — Konsumsi Kemasan: TIDAK ADA kode yang diubah (dikonfirmasi tidak perlu)

Audit sebelumnya (2 audit terpisah, hasil sama) sudah membuktikan alur `work_order_consumption → stock_movements → lot` untuk item `packaging` **sudah berfungsi penuh tanpa perubahan kode**:
- `recordWorkOrderConsumption.ts` tidak pernah memfilter `item.type`.
- Form "Catat Pemakaian Bahan" (`WorkOrdersPage.tsx`) menampilkan SEMUA baris BOM item yang diproduksi, termasuk packaging, sama seperti raw material.
- BOM line picker & validasi server (`BomsPage.tsx`, `bomValidation.ts`) tidak melarang tipe item apa pun jadi komponen.
- Data nyata: 3 BOM aktif sungguhan sudah punya komponen packaging (Botol PET N200 di BOM Gummy Zala, Sachet Film & Box Karton di BOM serbuk), dipakai Work Order in_progress/planned nyata.

Kesimpulannya: gap yang ada murni operasional (staf belum terbiasa isi baris packaging saat mencatat konsumsi; 1 item belum pernah di-goods-receipt), BUKAN batasan sistem. Tidak ada perubahan kode di 0A — sesuai instruksi "kalau audit A menyatakan sudah bisa semua, tulis konfirmasi itu di HANDOFF dan lanjut".

### 0B — Saldo Awal Stok (Opening Balance) — fitur baru, SELESAI & terverifikasi

**Masalah:** sebelum ini, tidak ada cara UI membuat LOT BARU tanpa lewat goods receipt (PO supplier) — jadi tidak ada cara resmi menginput stok pabrik yang sudah ada sebelum sistem dipakai.

**Yang dibangun** (pola sama persis dengan `record_manual_stock_adjustment` yang sudah ada):
- Migration `supabase/migrations/20260818000000_stock_opening_balance.sql` — (a) tambah `'opening_balance'` ke `lots_source_type_check` (source_type baru, sengaja BUKAN reuse `'purchased'`, supaya lot hasil entri saldo awal tetap bisa dibedakan dari goods receipt sungguhan — traceability tetap jujur); (b) fungsi atomik `create_opening_balance_lot()` — insert `lots` baru (`status='available'`) + insert `stock_movements` (`movement_type='adjustment'`, `reference_doc='Saldo awal stok opname'`, `reason_code='stock_opname_variance'`) dalam 1 transaksi.
- Server: `src/features/mrp/server/recordOpeningBalance.ts` (validasi item/plant milik company, qty > 0, auto-generate `lot_number` kalau field nomor lot supplier dikosongkan: `SALDO-AWAL-{item_code}-{timestamp}`) + route `app/api/stock-adjustments/opening-balance/route.ts`.
- Akses: `canAdjustStock` — role yang SAMA PERSIS dengan Penyesuaian Stok Manual biasa (`warehouse_manager` + `company_admin`/`general_manager`), tidak perlu fungsi role baru.
- UI: `WarehouseDashboardPage.tsx`, card "Penyesuaian Stok Manual" sekarang punya toggle 2 mode — "Sesuaikan Lot yang Ada" (form lama, tidak berubah) vs **"Saldo Awal (Lot Baru)"** (form baru: Item, Plant/Gudang, Jumlah, Tanggal Kadaluarsa opsional, Nomor Lot Supplier opsional, Catatan opsional, tombol "Catat Saldo Awal").

**Cara pakai (untuk saat pemilik produk input data stok pabrik dari PDF):**
1. Buka `/warehouse`, scroll ke card "Penyesuaian Stok Manual".
2. Klik tab "Saldo Awal (Lot Baru)".
3. Pilih Item, pilih Plant/Gudang tujuan, isi Jumlah. Nomor Lot Supplier & Tanggal Kadaluarsa opsional (isi kalau datanya ada). Catatan opsional (mis. "Stok opname 18 Agustus 2026").
4. Klik "Catat Saldo Awal" — sistem langsung buat 1 lot baru dengan stok itu, langsung bisa dipakai (muncul di ringkasan stok, bisa dipilih di dropdown lot untuk konsumsi batch/pengiriman, dst.) persis seperti lot dari goods receipt biasa.
5. Ulangi 1×1 per item yang datanya ada di PDF stok opname.

**Bukti verifikasi (browser sungguhan, login `warehouse.a@debug.mrp`):**
- Toggle mode berfungsi, form baru tampil dengan field lengkap.
- Submit sungguhan → `POST /api/stock-adjustments/opening-balance` → `200 {"success":true,"lot_id":591,"lot_number":"SALDO-AWAL-...-1787034812931","stock_movement_id":370}`.
- Pesan sukses di UI: `Saldo awal tercatat — lot baru "SALDO-AWAL-..." dengan stok 123.5.`
- DB dicek langsung: `lots` baris baru dengan `source_type:"opening_balance"`, `status:"available"`, qty benar; `stock_movements` baris baru dengan `movement_type:"adjustment"`, `reference_doc:"Saldo awal stok opname"`, `reason_code:"stock_opname_variance"`, `notes` tersimpan sesuai input.
- `status:"available"` membuktikan lot ini langsung bisa dipakai jalur konsumsi batch yang sama seperti lot lain (query `listLots.ts` yang dipakai dropdown konsumsi hanya mensyaratkan `status='available' AND quantity_on_hand>0`).

Typecheck bersih, `npm run build` sukses (route `/api/stock-adjustments/opening-balance` terdaftar), 33/33 test tetap lulus.

### BLOCKER untuk GELOMBANG 1 & 2 — dicatat di sini sesuai instruksi ("jangan improvisasi, jangan tunggu, catat & lewati")

Sebelum menulis kode Gelombang 1, saya cek dulu ketersediaan 2 sumber acuan yang instruksi minta: `docs/spesifikasi-aturan-biaya-v1.md` (SUDAH ADA di repo, rev. 3 final, 175 baris — dibaca penuh) dan `DATA_PRODUKSI_PT_ITM.pdf` (referensi utama untuk data karyawan & SOP routing). Hasil pengecekan:

1. **`DATA_PRODUKSI_PT_ITM.pdf` TIDAK ditemukan di mana pun** — dicari di seluruh direktori proyek, `Downloads`, `Desktop`, dan pencarian filesystem penuh (`find /`). File ini TIDAK pernah diberikan ke sesi Claude Code manapun (spec v1 menyebutnya sebagai basis kerja "Claude Fable" — kemungkinan PDF ini hanya pernah dibaca sesi/tool LAIN, bukan di sini). Ini memblokir:
   - **Data 30 karyawan sungguhan** (nama, posisi, department, tier gaji per orang) — spec v1 §2 cuma punya 3 TIER tarif (SPV Produksi Rp3,5jt, Pegawai kontrak Rp2jt, PHL Rp50rb/hari), TIDAK ada daftar 30 nama+posisi+department+tier assignment per orang.
   - **Tahapan SOP routing gummy & serbuk** (nama tahap, urutan, `active_duration_minutes` per tahap) — spec v1 cuma punya wait_duration untuk 3 titik (premix 12 jam, setting 1 jam, curing 3 hari), BUKAN struktur routing lengkap (nama tahap apa saja, urutan, durasi aktif tiap tahap).

2. **Harga per-bahan untuk 5 premix serbuk (PMSW/PMAC/PMFL/PMVITC/PMSRH) UNDERDETERMINED** — spec v1 §5 Contoh 2 cuma memberi rasio komposisi (mis. "PMSW: malto 50 + stevia 20 + sucralose 30" per 100g) dan biaya AGREGAT per gram (`Rp203,1538/g` utk PMSW dst.), TIDAK memberi harga per-bahan individual (malto/stevia/sucralose/derasi orange/ascorbic/sereh). Sistem menghitung biaya BOTTOM-UP dari `item.standard_cost`/`lot.unit_cost` × qty BOM — untuk mereproduksi angka agregat itu PERSIS, saya butuh harga tiap bahan individual, dan dari 1 persamaan (total agregat) dengan ≥2 bahan tak diketahui per premix, ini underdetermined (tidak bisa diselesaikan tanpa mengarang salah satu harga). Mengarang angka ini melanggar instruksi "jangan improvisasi keputusan bisnis" — harga bahan adalah fakta bisnis, bukan sesuatu yang boleh saya tebak.

**Yang TIDAK terblokir dan seharusnya bisa dikerjakan di sesi berikutnya begitu 2 hal di atas tersedia** (karena datanya SUDAH lengkap di spec v1, dikutip literal): item + harga kemasan gummy & serbuk, BOM Premix Gelatin (2 level, semua bahan+harga ada di §5 Contoh 1), BOM Gummy Zala (14 bahan + harga lengkap ada di §5 Contoh 1), customer + 2 PO REAL (SAS001/SAS005, tanggal+qty+harga semua ada di §4), stok bahan baku=0 + PO supplier botol China 30.500pcs ETA 22 Agu (ada di §4), konfigurasi biaya per tenant (§2, semua nilai ada). Bagian ini SENGAJA belum saya kerjakan sekarang — bukan karena terblokir data, tapi karena Gelombang 1 instruksinya adalah SATU seed script koheren (idempotent, real case), dan mengerjakan sebagian besar tapi sengaja melubangi bagian karyawan/routing/premix-serbuk akan menghasilkan data yang TIDAK konsisten (mis. Work Order tanpa routing valid, BOM serbuk tidak lengkap) — lebih aman selesaikan sekaligus setelah data lengkap daripada seed setengah jadi yang berisiko dianggap "selesai" padahal keropos.

3. **Poin 8 Gelombang 1 (pembersihan data demo lama) SENGAJA belum dijalankan** — ini operasi destruktif skala besar (hapus data transaksional+master demo di SELURUH database dev, termasuk banyak fixture yang terkumpul lintas puluhan sesi sebelumnya) yang instruksinya sendiri minta kehati-hatian ekstra (backup, staging dulu). Karena scope "apa yang termasuk demo vs yang harus dipertahankan (struktur dipakai test)" perlu penilaian yang salahnya mahal & sulit dibalik, dan Gelombang 1 belum bisa dieksekusi utuh (lihat poin 1-2), langkah ini ditunda sampai seed real-case siap dijalankan — supaya pembersihan & seed baru terjadi berdekatan (tidak ada jendela waktu database "kosong" tanpa data kerja).

**Yang dibutuhkan dari pemilik produk sebelum Gelombang 1/2 bisa lanjut:**
- File `DATA_PRODUKSI_PT_ITM.pdf` (atau ekstraksi tertulis dari isinya): daftar 30 karyawan (nama, posisi, department, masuk tier gaji yang mana), dan tahapan SOP routing gummy & serbuk (nama tahap + urutan + estimasi durasi aktif tiap tahap).
- Harga per-bahan individual untuk 5 premix serbuk (malto, stevia, sucralose, derasi orange, ascorbic acid, sereh, dan bahan PMAC/PMVITC/PMSRH lainnya) — bukan cuma agregat per premix yang sudah ada di spec.

Begitu 2 hal ini tersedia, Gelombang 1 (seed real-case + pembersihan demo) dan Gelombang 2 (implementasi margin + acceptance test §5 + deteksi konflik perencanaan) siap dikerjakan berurutan sesuai instruksi asli — tidak perlu instruksi ulang, cukup lampirkan data yang kurang.

---

## Pengerasan validasi upload file publik & internal (18 Agu 2026) — SELESAI

Pemilik produk minta verifikasi konkret: bisakah endpoint upload foto POD (`/pod/[token]`, publik tanpa login) menerima file BUKAN gambar (di-rename ekstensinya) atau file berukuran raksasa?

**Ditemukan gap nyata** (dibuktikan lewat percobaan langsung, bukan cuma baca kode): `confirmDelivery.ts` (endpoint konfirmasi POD) cuma memvalidasi `Content-Type` yang DIKLAIM client — header itu sepenuhnya bisa dipalsukan. Percobaan nyata: file teks biasa di-rename `.png` + header dipalsukan `image/png` → **LOLOS**, benar-benar diproses sebagai foto bukti penerimaan sungguhan, mengubah 1 shipment asli (SJ-007/8-ITM/2026, shipment_id 181) jadi `delivered` dengan "foto" berupa file teks.

**Perbaikan:** `src/lib/imageUpload.ts` (baru, infrastruktur bersama) — sniffing magic bytes asli (signature PNG/JPEG/WEBP) menggantikan kepercayaan pada `Content-Type` klaim client, plus cek `Content-Length` SEBELUM body dibaca penuh ke memori (mencegah body raksasa dibuffer percuma sebelum ditolak). Diterapkan ke **5 endpoint upload** yang ada di sistem: `confirmDelivery.ts` (POD, publik), `uploadAvatar.ts`, `uploadSignature.ts`, `uploadCompanyLogo.ts`, `processShipmentDispatch.ts` — SEMUA endpoint upload di seluruh aplikasi, tidak ada yang tersisa dengan pola lama.

**Verifikasi ulang setelah fix** (request mentah + login sungguhan tiap endpoint): file disamarkan → `400 "Format file tidak didukung"` di kelimanya; file 20MB → `413` cepat (0,4 detik, sebelum selesai dibuffer); foto asli → tetap `200` sukses (regresi dicek, tidak ada endpoint yang jadi menolak upload sah).

**Pembersihan data yang sempat rusak akibat uji coba (SJ-007):** migration `supabase/migrations/20260817220000_fix_sj007_pod_upload_test_pollution.sql` — hapus baris `delivery_confirmations` palsu, kembalikan `shipments.status` ke `shipped`, **terbitkan `pod_token` BARU** (bukan reuse token lama yang sudah "terbakar" karena sempat terpakai — sesuai desain sistem sendiri). Trigger `enforce_status_transition` (menolak `delivered→shipped` secara sengaja, demi traceability BPOM/halal) dinonaktifkan SEMENTARA cuma untuk 1 statement koreksi ini, khusus `shipment_id=181`, lalu diaktifkan lagi di migrasi yang sama. Diverifikasi: token baru resolve normal, token lama tetap `{"valid":false}` selamanya.

Typecheck bersih, 33/33 test tetap lulus.

---

## Sesi — Carbon "DataTable with Toolbar": Toolbar + Modal untuk Semua Form "Tambah Baru" (17 Agu 2026) — SELESAI

Lanjutan dari sesi Carbon Data Table sebelumnya. Permintaan: pindahkan SEMUA form "tambah baru" dari Card/section inline di bawah tabel ke modal yang dipicu tombol di toolbar `DataTable` (bukan cuma spacing/style), naikkan spacing baris tabel, JANGAN ubah logika bisnis/validasi form yang sudah ada — murni pindah LOKASI & WADAH.

**FASE 1 — perluas komponen dasar (`src/components/ui/data-table.tsx`, `src/components/ui/table.tsx`):**
1. Prop baru `primaryAction?: { label: string; onClick: () => void }` — tombol aksi utama di kanan toolbar (di sebelah kotak pencarian, atau sendirian kalau tabel itu tidak punya pencarian). Toolbar sekarang muncul kalau SALAH SATU dari pencarian/primaryAction diisi (sebelumnya cuma kalau pencarian diisi).
2. Densitas baris dinaikkan signifikan — `TableHead` `h-8`→`h-12`, `TableCell` `py-1.5`→`py-3`, padding horizontal `px-3`→`px-4` (Carbon "Medium" density, ~48px/baris, sebelumnya setara "Compact" Carbon ~32px). Diukur langsung di browser: header 48px, baris data 61px (dengan teks 2 baris).
3. Dialog/modal generik (`src/components/ui/dialog.tsx`, Radix-based) SUDAH ADA dari sesi Shipments — dipakai ulang APA ADANYA untuk semua modal baru di bawah, tidak ada implementasi modal baru.

**FASE 2 — audit (dilaporkan, DIKONFIRMASI user sebelum eksekusi):** disurvei semua halaman dengan form "tambah baru" (lewat sub-agent Explore), dikategorikan:
- **Kategori A** (toolbar+modal): Item, BOM, Routing, Work Order, PO Client, Supplier, PO Supplier, undangan Tim, Gangguan Produksi (ditambahkan atas konfirmasi user, awalnya tidak disebut eksplisit).
- **Kategori B** (cuma ikut naik density dari FASE 1, TANPA tombol create dipaksakan): Sales Order (dikonfirmasi TIDAK ADA form create — tercipta otomatis dari proses PO Client), sub-tabel "SO belum terkirim" di Shipments (tampilan terfilter dari Sales Order, bukan entitas independen), tabel "Stok Saat Ini" Warehouse (hasil goods receipt/produksi, bukan input manual).
- **Kasus khusus, dikonfirmasi user**: Karyawan (Employees) — TIDAK disentuh (fitur create-nya memang belum pernah ada sama sekali di app manapun, bukan cuma "belum dipindah" — dicatat sebagai tugas TERPISAH setelah FASE 3, nanti langsung pakai pola toolbar+modal ini). Nested Customer di form PO Client — TETAP sebagai section expand INLINE di dalam modal PO Client yang sama (bukan modal-di-dalam-modal), sesuai keputusan eksplisit user.
- **Sengaja TIDAK disentuh** (beda pola, bukan "tabel + form di bawahnya"): "Buat Batch" & pencatatan hasil produksi di `WorkOrdersPage`/`ProductionDashboardPage` — aksi nested di dalam panel detail baris yang sudah expand, mirip modal "Proses Pengiriman" Shipments yang memang sengaja dipertahankan.

**FASE 3 — eksekusi bertahap, tiap kelompok diverifikasi lewat browser sebelum lanjut:**
1. **`WorkOrdersPage`** (contoh pola pertama) — tombol "Buat Work Order" pindah ke toolbar, form (SO/BOM/Routing/plant/qty/prioritas) pindah ke `Dialog`, auto-close saat sukses. Diverifikasi end-to-end: submit sungguhan → `200 OK` → modal tertutup → WO baru muncul di tabel.
2. **`PurchasingPage`** — KONVERSI dulu (langkah baru ditemukan saat audit): kedua tabel (Supplier, PO Supplier) SEBELUMNYA `<table>` mentah, sekarang `DataTable` penuh (search+pagination+expand-baris untuk detail baris item PO, menggantikan tampilan kartu-bertumpuk lama). Kedua form "tambah baru" pindah ke modal toolbar. Diverifikasi: buat Supplier baru sungguhan → sukses, expand-baris PO menampilkan detail item dengan benar.
3. **`ItemsPage`, `BomsPage`, `RoutingsPage`, `TeamManagePage`, `ProductionDashboardPage`** — form pindah ke modal toolbar. `ItemsPage` (form ganda create+edit, tombol "Edit" per baris JUGA buka modal yang sama) auto-close saat sukses. **`BomsPage`/`RoutingsPage` SENGAJA TIDAK auto-close saat sukses** — kode aslinya punya alasan teknis terdokumentasi (komentar di `handleSubmit`: `resetForm()` sengaja tidak dipanggil supaya pesan sukses tidak langsung ke-reset oleh React batching) untuk menjaga pesan konfirmasi tetap terlihat; perilaku itu dipertahankan APA ADANYA, modal ditutup manual oleh user. `ProductionDashboardPage`: daftar gangguan produksi (sebelumnya `<div>` list manual) JUGA dikonversi ke `DataTable`, sejalan dengan konversi PurchasingPage. Diverifikasi: submit Item baru sungguhan → sukses, modal tertutup, muncul di tabel.
4. **`CustomerPurchaseOrdersPage`** — form "Buat PO Client" (multi-section + daftar item dinamis) pindah ke modal toolbar; section "+ Baru" untuk Customer (SUDAH inline sejak awal, tidak perlu restrukturisasi) TETAP expand di dalam modal yang SAMA — dicek langsung: cuma ADA 1 elemen `[role="dialog"]` di halaman saat section Customer dibuka, bukan modal kedua. Diverifikasi: submit PO Client baru sungguhan (pilih client existing, isi baris item) → `200 OK`, modal tertutup, PO baru muncul di tabel.

**Build sukses, `tsc --noEmit` bersih, 33 test tetap lolos di SETIAP kelompok** (dicek ulang berkali-kali, tanpa regresi kumulatif).

**Insiden operasional berulang (bukan bug kode, sama seperti sesi-sesi sebelumnya)**: skrip Playwright beberapa kali menghasilkan `count()` 0 untuk elemen yang sebenarnya ADA — SELALU terjadi tepat setelah `npm run build` + restart dev server (cold-start Turbopack, screenshot pertama kadang menangkap state sebelum hydration selesai) — dikonfirmasi bukan bug aplikasi karena percobaan berikutnya (klik langsung, tanpa cek `count()` dulu) selalu berhasil.

**Belum dikerjakan (di luar cakupan sesi ini, dicatat eksplisit):** sorting kolom (klik header) — masih belum ditambahkan (keputusan sesi Carbon sebelumnya, belum berubah). Fitur create Karyawan — sengaja dilewati, jadi tugas terpisah.

---

## Sesi 3 — Halaman Publik Bukti Penerimaan (POD) + QR Code di Surat Jalan (17 Agu 2026) — SELESAI

Permintaan: halaman `/pod/[token]` TANPA login sama sekali — client scan QR di Surat Jalan fisik, konfirmasi barang diterima. Ditandai eksplisit sebagai "permukaan paling rawan diserang dari luar di seluruh sistem sejauh ini" dengan STOP CONDITION ketat (berhenti & lapor kalau ada keraguan keamanan, jangan improvisasi).

**Migration baru `20260817210000_pod_public_confirmation.sql`:**
- Bucket storage `delivery-confirmation-photos` (public read) — **SENGAJA TIDAK ADA policy insert untuk role apa pun** (anon MAUPUN authenticated), beda dari bucket lain di proyek ini yang masih punya policy insert 'authenticated' sebagai defense-in-depth. Di sini itu justru jadi CELAH (tidak ada pengunjung authenticated yang legal menulis ke bucket publik ini) — satu-satunya jalur tulis sah adalah service-role dari `confirmDelivery.ts` setelah validasi token+status sendiri.
- Fungsi atomik baru `confirm_delivery(p_pod_token, p_photo_url, p_received_by_name)` — kunci baris (`for update`) + insert `delivery_confirmations` + transisi `shipments.status` shipped→delivered dalam 1 transaksi (lewat `enforce_status_transition()` yang sudah ada, TIDAK direstrukturisasi). Row lock menjamin token tidak bisa dipakai 2x meski 2 request datang hampir bersamaan.

**Kode baru:**
- `getShipmentByPodToken.ts` (`GET /api/pod/[token]`) — lookup TANPA `getCurrentUser()`/JWT sama sekali (pengunjung tidak login). Field yang dikembalikan dibatasi ketat: nomor surat jalan, tanggal, alamat, daftar item+qty+satuan — TIDAK PERNAH menyentuh `unit_price`/`unit_cost`/`standard_cost`. Token tidak ditemukan ATAU status bukan `shipped` → SATU pesan generik yang sama ("tidak valid"), tidak membedakan biar tidak jadi oracle. Pesan error selalu generik, tidak pernah meneruskan error Postgres mentah.
- `confirmDelivery.ts` (`POST /api/pod/[token]/confirm`) — validasi ULANG token+status FRESH saat submit (bukan percaya state halaman lama), upload foto (PNG/JPG/WEBP, maks 5MB, nama file pakai UUID acak bukan cuma timestamp karena bucket ini public-read tanpa autentikasi), baru panggil `confirm_delivery()`.
- Halaman `PodConfirmationPage.tsx` + route `app/pod/[token]/page.tsx` — DI LUAR grup `(shell)`, **TIDAK ADA pemeriksaan sesi Supabase sama sekali** (beda dari SEMUA halaman lain di aplikasi ini) — pertama kalinya di seluruh sistem. Form: foto wajib, nama penerima opsional, checkbox persis "Barang sudah sesuai jenis dan jumlahnya", tombol "Barang Sudah Diterima" disabled sampai foto+checkbox terisi. Sukses → halaman "Terima Kasih" sederhana, tanpa redirect ke sistem internal.

**Bukti — 5 skenario negatif WAJIB, dijalankan lewat browser context BARU tanpa cookies/session sama sekali (bukan dugaan):**
1. Akses tanpa login sama sekali → berhasil, 0 header Authorization pernah terkirim, 0 cookies tersimpan.
2. Token tebakan/salah → "Link Tidak Valid" bersih, 0 data shipment tampil.
3. Submit lengkap (foto+nama+checkbox) → `200 OK`, dicek LANGSUNG di database: `status='delivered'`, 1 baris `delivery_confirmations` dengan `photo_url` terisi & `received_by_name` sesuai input.
4. Akses ulang token yang SAMA setelah sukses (baik lewat halaman maupun POST langsung ke endpoint confirm) → ditolak di KEDUA jalur.
5. DOM halaman + respons JSON API diperiksa mentah (bukan cuma tampilan) → 0 kata kunci harga/biaya. Dibuktikan dengan menanam 1 nilai harga UNIK (`8171731`, sengaja bukan angka bulat biasa) di data uji `sales_order_lines.unit_price` company lain — angka itu tidak pernah muncul di mana pun.
6. Isolasi lintas company — dibuat shipment `shipped` nyata untuk Company B (fixture terpisah: customer/item/lot/SO/CPO/shipment baru, prefix `PODTEST-B`), token masing-masing company HANYA mengembalikan data miliknya sendiri (dicek 2 arah: token A tidak bocorkan data B, token B tidak bocorkan data A).

**QR code di Surat Jalan (setelah Sesi 3 terverifikasi, sesuai instruksi):** `SuratJalanPreview.tsx` (dijadikan `'use client'`) sekarang generate QR (`qrcode` npm package, dependency baru) meng-encode `{origin}/pod/{pod_token}` lewat `useEffect`, ditampilkan di area tanda tangan "Penerima" pada dokumen. **Sengaja HANYA tampil kalau `podToken` diisi** — di preview wizard Langkah 2 (draft belum tersimpan) prop ini tidak dikirim sama sekali (tidak ada pod_token untuk shipment yang belum di-dispatch), QR baru muncul di halaman cetak (`SuratJalanPrintPage.tsx`) untuk shipment yang statusnya sudah lewat draft. Diverifikasi lewat browser: QR ter-generate sebagai data URL & tampil visual di lokasi yang benar.

**Build sukses, `tsc --noEmit` bersih, 33 test tetap lolos, tanpa regresi.**

---

## Sesi — Gaya Data Table Carbon Design System Diterapkan ke Seluruh Aplikasi (17 Agu 2026) — SELESAI

Permintaan: terapkan gaya Carbon Design System (https://carbondesignsystem.com/components/data-table/usage/) ke SEMUA data table di aplikasi, disesuaikan per fungsi tabelnya masing-masing (bukan seragam dipaksa sama semua).

**Survei dulu sebelum ubah kode** — didelegasikan ke sub-agent Explore untuk memetakan seluruh 19 pemakaian `<DataTable>` di 12 file halaman (lihat daftar lengkap di bawah), termasuk entity yang ditampilkan, estimasi jumlah baris realistis, kolom Aksi yang ada, dan apakah sudah pakai fitur expand-baris.

**Perubahan pada komponen generik `src/components/ui/data-table.tsx`** (dipakai lintas SEMUA halaman, `src/components/ui/`, bukan per-domain — sesuai CLAUDE.md):
1. **Zebra striping** (baris selang-seling) — SEKARANG BAKU, otomatis aktif di semua tabel tanpa perlu prop apa pun, dihitung dari index baris yang tampil (bukan CSS `:nth-child`, supaya tetap benar walau ada baris expand di antaranya).
2. **Toolbar pencarian** (opsional, prop `searchPlaceholder` + `getSearchText`) — kotak cari Carbon-style (ikon kaca pembesar + input) di atas tabel, filter client-side.
3. **Pagination** (opsional, prop `paginated` + `pageSize`) — footer Carbon-style "1–15 dari 42 item" + tombol halaman sebelumnya/berikutnya.
4. Fitur expand-baris (`getRowId`/`expandedRowId`/`renderExpandedRow`, sudah ada dari sesi sebelumnya) TETAP ADA, tidak diubah — tetap dipakai Shipments.

**Diterapkan SELEKTIF sesuai fungsi tabel** (bukan seragam) — 8 dari 19 tabel dapat pencarian+pagination (tabel besar/riwayat/master data yang realistis bisa puluhan-ratusan baris): `ItemsPage`, `BomsPage`, `RoutingsPage`, `SalesOrdersPage`, `CustomerPurchaseOrdersPage`, `WorkOrdersPage`, `ShipmentsPage` (tabel "Daftar Pengiriman", BUKAN tabel "SO belum terkirim" yang sengaja dibiarkan tanpa fitur ini karena isinya cuma antrian kerja pendek), `WarehouseDashboardPage` (tabel "Stok Saat Ini"). 11 tabel sisanya (antrian approval PPIC, absensi HR, daftar tim, alert gudang, PO supplier menunggu, dsb — semua terbatas/pendek by design) HANYA dapat zebra striping otomatis, TANPA pencarian/pagination — sesuai instruksi "sesuaikan tiap data table sesuai fungsi/penggunaannya", bukan dipasang sama rata semua tempat.

**2 bug NYATA ditemukan & diperbaiki selama verifikasi browser (bukan cuma masalah skrip tes):**
1. **Input pencarian awalnya pakai `type="search"`** — memicu perilaku heuristik autofill Chromium yang menulis ulang atribut `type`/`name` berkali-kali per detik pada input tanpa `name` eksplisit, membuat elemen "tidak stabil" untuk automation (Playwright fill/type timeout) — berpotensi juga menyebabkan gangguan UX nyata di browser sungguhan (bukan cuma masalah testing). **Diperbaiki**: ganti ke `type="text"` + `name="data-table-search"` eksplisit + `autoComplete="off"`.
2. **BUG SESUNGGUHNYA, bukan cuma gejala di atas**: variabel `pagedData` (hasil `.slice()` untuk pagination) dihitung ULANG sebagai array BARU di setiap render TANPA `useMemo` — @tanstack/react-table's `useReactTable` mensyaratkan referensi `data` STABIL; array baru tiap render memicu re-render internal ratusan kali/detik (dikonfirmasi lewat instrumentasi render-counter langsung: ~500-650 render/detik pada tabel manapun yang pakai pencarian). Ini nyaris tidak kelihatan di sebagian halaman (React cukup pintar tidak menyentuh DOM kalau nilai atribut tidak berubah), TAPI di `WarehouseDashboardPage` (banyak `<Input>` form lain di halaman yang sama) efeknya jadi terlihat sebagai ribuan mutasi DOM/detik — **dikonfirmasi BUKAN bug lama** lewat `git stash` ke versi sebelum perubahan sesi ini (baseline cuma ~30 mutasi/1.5 detik, wajar). **Diperbaiki**: bungkus `pagedData` dengan `useMemo` (deps: `paginated, filteredData, safePageIndex, pageSize`) — setelah perbaikan, mutasi turun kembali ke level baseline (~39/2 detik) di semua halaman.

**Insiden operasional (bukan bug kode, catatan berulang dari sesi sebelumnya)**: `npm run build` sempat dijalankan saat `next dev` aktif di folder sama beberapa kali sesi ini untuk verifikasi build sukses — tiap kali diikuti restart bersih (`kill` proses lama + `rm -rf .next` + `npm run dev` ulang) sebelum lanjut verifikasi browser, supaya tidak keliru mendiagnosis halaman corrupt sebagai bug aplikasi.

**Diverifikasi lewat browser sungguhan**: screenshot `ItemsPage` (pencarian "gummy" → 2 hasil benar, pagination "1–2 dari 2 item"), `BomsPage`/`WorkOrdersPage` (search+pagination+zebra tampil rapi), `ShipmentsPage` "Daftar Pengiriman" (pencarian "SJ-001" → 1 hasil benar, expand-baris tetap berfungsi bersamaan dengan pencarian+pagination), `PpicDashboardPage` (3 tabel kecil, HANYA zebra, tanpa pencarian — sesuai rencana). Semua tabel yang diuji berfungsi normal lewat interaksi Playwright standar (fill/click, tanpa workaround) SETELAH kedua bug di atas diperbaiki.

**Build sukses, `tsc --noEmit` bersih, 32 test tetap lolos, tanpa regresi** (dicek ulang setelah semua perubahan).

**Belum dikerjakan (di luar cakupan sesi ini, keputusan sadar)**: sorting kolom (klik header untuk urutkan) TIDAK ditambahkan — sebagian besar kolom di tabel-tabel ini dirender lewat `cell` majemuk (badge, teks 2 baris, breakdown multi-item) tanpa `accessorKey`/`accessorFn` yang bisa diurutkan langsung; menambahkannya butuh menyentuh definisi kolom di semua 12 file dengan risiko lebih besar dari yang diminta ("style", bukan restrukturisasi kolom). Overflow menu (titik tiga) untuk aksi per baris juga TIDAK ditambahkan — kolom Aksi yang ada sekarang cuma 1-2 tombol jelas, belum perlu disembunyikan di menu. Migrasi pola "Detail" Card-terpisah (BOMs/Routings/SalesOrders/CustomerPOs/WorkOrders/dst) ke expand-baris inline (seperti Shipments) JUGA tidak dikerjakan — itu perubahan STRUKTUR/perilaku halaman, bukan cuma gaya visual, dan tiap halaman detailnya beda-beda (form, sub-tabel, dsb) — kalau user mau ini juga, sebaiknya dikerjakan sebagai permintaan terpisah per halaman.

---

## Sesi 2 (KOREKSI FINAL) — Wizard Tanda Tangan Pengiriman (17 Agu 2026) — SEBAGIAN SELESAI (poin a-d selesai, halaman cetak Surat Jalan sudah ada, foto bukti pengiriman WAJIB sebelum stok berkurang sudah ada, QR Bukti Penerimaan/Sesi 3 menyusul)

> **Addendum — hardening DB-level (17 Agu 2026, dicatat di sini karena secara konsep bagian dari fitur ini, walau baris ini sendiri ter-commit bareng commit Carbon karena HANDOFF.md disentuh lagi belakangan)**: "foto bukti pengiriman wajib" sebelumnya cuma dijaga `updateShipmentStatus.ts` (level API) — celah ditutup di migration `20260817200000_shipment_dispatch_photo_db_guard.sql` dengan memperluas `enforce_status_transition()` (BUKAN trigger baru terpisah): transisi `shipments` draft→shipped dengan `dispatch_photo_url IS NULL` sekarang ditolak LANGSUNG oleh database, pesan "Foto bukti pengiriman wajib sebelum status diubah ke Di Proses." Dibuktikan dengan percobaan `UPDATE shipments SET status='shipped'` langsung lewat service-role (skip endpoint aplikasi sama sekali) — DITOLAK dengan error code `23514`, baris tetap draft. Jalur sah (dispatch_photo_url diisi bareng) tetap berhasil, tidak ada regresi. 3 test lama di `tests/shipments_physical_stage.test.ts` yang sebelumnya update status langsung tanpa foto (menguji hal lain — limit qty, pengurangan stok) diperbaiki supaya ikut mengisi `dispatch_photo_url`; ditambah 1 test baru khusus menguji guard ini. Total test naik dari 32 jadi 33, semua lolos.

**Ini MENGGANTI TOTAL pendekatan Sesi 2 sebelumnya** (modal di tombol "Dikirim", digabung dengan transisi status) — user mengoreksi: tombol "Dikirim" (draft→shipped, Sesi 3A/3B) TIDAK BOLEH disentuh sama sekali. Tanda tangan sekarang direkam SAAT PEMBUATAN pengiriman (wizard 2 langkah), BUKAN saat status berubah. Migration lama (`sign_and_ship_shipment()`, belum pernah ter-commit) sudah di-DROP dari database dev dan filenya dihapus sebelum sempat masuk git — bukan menimpa histori yang sudah commit, murni membatalkan pekerjaan lokal yang belum publik.

**Migration** `20260817180000_shipment_wizard_pod.sql` (catatan: sempat pakai timestamp `20260817170000` yang SUDAH pernah ditandai "applied" di database dari migrasi lama yang di-drop — `supabase db push` menolak karena versi itu dianggap sudah ada; diperbaiki dengan `supabase migration repair --status reverted 20260817170000` dulu baru push ulang dengan timestamp baru `20260817180000`):
- `shipments.pod_token` (nullable, unique) + tabel `delivery_confirmations` (Sesi 3 nanti)
- `process_shipment_shipped()` (Sesi 3A) **DIPERLUAS, bukan direstrukturisasi** — cuma tambah 1 `UPDATE shipments SET pod_token = gen_random_uuid()::text WHERE ... AND pod_token IS NULL` di akhir fungsi (trigger ini AFTER UPDATE, jadi assignment ke `NEW` tidak akan tersimpan — makanya pakai UPDATE eksplisit). Body loop pengurangan stok SAMA PERSIS, tidak ada 1 baris pun diubah.
- Fungsi BARU `create_shipment_with_signature()` — insert `shipments` (status TETAP `draft`) + `shipment_lines` (per baris, lewat `jsonb_array_elements`, tetap kena trigger `enforce_shipment_line_qty_limit` Sesi 3A apa adanya) + `document_signatures`, SEMUA dalam 1 transaksi. TIDAK menyentuh status/stok sama sekali — beda total dari fungsi lama yang di-drop.

**Kode baru:** `createShipmentWithSignature.ts` GANTI `createShipment.ts` lama (dihapus). `ConfirmAndSignModal` (Sesi 1) diperluas dengan prop opsional `cancelLabel`/`confirmLabel` (default tetap "Cancel/Edit"/"Process", tidak mengubah pemanggil lama) — dibutuhkan supaya Langkah 2 wizard bisa pakai label "Kembali"/"Buat Pengiriman" sesuai spec. `ShipmentsPage.tsx`: form "Buat Pengiriman" sekarang wizard 2 langkah — Langkah 1 (form yang sudah ada, tombol berubah jadi "Lanjut", MURNI validasi lokal, nol panggilan API) → Langkah 2 (`ConfirmAndSignModal`: preview + checkbox persis "Sudah di cek dan tambahkan tanda tangan saya" + Kembali/Buat Pengiriman). Tombol "Dikirim" (`handleTransition`) **TIDAK DIUBAH SAMA SEKALI** — dicek diff, nol perubahan di fungsi itu.

**Verifikasi browser sungguhan** (login `warehouse.a@debug.mrp`, SO nyata):
- Langkah 1 diisi (qty 15) → "Lanjut" → modal Langkah 2 terbuka menampilkan preview benar (SO, client, alamat, tabel item+qty+lot) — TANPA ada request API sama sekali di titik ini.
- "Kembali" diklik → kembali ke Langkah 1, qty MASIH terisi "15" (dicek lewat `inputValue()` langsung, bukan asumsi) — data tidak hilang.
- Ulangi: Lanjut → centang checkbox → "Buat Pengiriman" → `201 Created`, dicek database: `shipments.status='draft'` (BUKAN shipped), `pod_token=null` (belum ada), `document_signatures` tercatat dengan `confirmation_text` PERSIS "Sudah di cek dan tambahkan tanda tangan saya", stok lot TIDAK berubah (masih 80).
- Klik tombol "Dikirim" TERPISAH (tombol lama, tidak disentuh) → `200 OK` → dicek database: `status='shipped'`, **`pod_token` OTOMATIS terisi** (UUID acak), stok lot berkurang PERSIS 15 (80→65) — perilaku pengurangan stok identik dengan Sesi 3A, tidak berubah sama sekali.

**Build sukses, typecheck bersih, 32 test tetap lolos** (belum ada test baru — verifikasi lewat browser, konsisten pola sesi-sesi Shipments sebelumnya).

**Revisi UI setelah feedback user (masih sesi yang sama, sebelum sempat commit):** Langkah 1 sebelumnya cuma expand INLINE di bawah tabel, bukan modal sungguhan — dan preview Langkah 2 cuma ringkasan teks polos, bukan dokumen Surat Jalan sungguhan. Diperbaiki:
- Langkah 1 sekarang JUGA modal (`Dialog`/`DialogContent` Carbon-style, sama seperti pola `ConfirmAndSignModal`) — bukan expand inline lagi.
- Komponen baru `SuratJalanPreview.tsx` (`src/features/mrp/components/`) — dokumen ala cetak sungguhan (kop logo+nama perusahaan, judul "SURAT JALAN", info pengirim/penerima, tabel item, area tanda tangan Pengirim/Penerima) — dipakai sebagai isi Langkah 2, DIRANCANG dipakai ULANG untuk cetak PDF sungguhan nanti (Sesi 3C) supaya preview & hasil cetak PERSIS sama, bukan 2 implementasi berbeda.
- Diverifikasi ulang lewat browser: Langkah 1 tampil sebagai modal beneran, Langkah 2 menampilkan dokumen Surat Jalan (bukan ringkasan polos) dengan kop "PT ITM" + logo, tabel item lengkap, catatan "tanda tangan akan ditambahkan saat Buat Pengiriman diklik" di area tanda tangan (belum ada gambar tanda tangan di titik preview, sesuai — dokumen belum benar-benar ditandatangani). Alur Lanjut→Kembali→Lanjut→centang→submit tetap berfungsi sama seperti sebelumnya, 32 test tetap lolos, typecheck bersih.
- Data uji leftover dari sesi sebelum koreksi (`shipment_id=105`, draft tak terpakai yang mengunci 100 pcs kuota SO line) dibersihkan (dibatalkan lewat state machine, bukan dihapus paksa) supaya tidak mengganggu pengujian qty-limit berikutnya.

**GAP masih terbuka (poin (e) instruksi):** PDF Surat Jalan menampilkan tanda tangan + QR code `/pod/{pod_token}` — BELUM dikerjakan, menyusul bersama Sesi 3 (Sesi 3C/PDF belum pernah dibangun sama sekali sebelum sesi ini, sudah dilaporkan sebagai gap di sesi sebelumnya juga). `SuratJalanPreview.tsx` yang baru dibangun ini sudah siap dipakai ulang untuk itu.

**Revisi lanjutan (masih sesi yang sama, koreksi UI kedua dari user, setelah poin di atas):**
1. **Layout baris item Langkah 1 diperbaiki** — sebelumnya 1 baris grid 4 kolom (nama item + lot + qty sejajar, sempit/padat). Sekarang tiap baris item adalah kartu bordered: nama item baris sendiri (full width), DI BAWAHNYA grid 2 kolom (Lot kolom 1, Jumlah Kirim kolom 2). Ditambah divider (`border-t`) sebelum grup field alamat tujuan/penerima/kendaraan/sopir. Murni perubahan tata letak (className/struktur JSX), tidak ada logic yang berubah.
2. **BARU — halaman cetak Surat Jalan dari riwayat pengiriman**, menjawab kebutuhan user "bisa melihat surat jalan pdf yg sudah dibuat untuk kebutuhan di print/download" pada shipment yang SUDAH tersimpan (bukan cuma preview draft di wizard):
   - Server function baru `getShipmentDetail.ts` — ambil 1 shipment lengkap (header + baris item + item/lot/customer/company) DAN tanda tangannya dari `document_signatures` (`document_type='shipment'`, `document_id=shipment_id`) berikut nama penandatangan.
   - Route API baru `GET /api/shipments/[shipmentId]` — dynamic route PERTAMA di aplikasi ini, ikut pola `await params` sesuai Next.js versi ini (dicek di `node_modules/next/dist/docs/` sebelum menulis kode, sesuai instruksi proyek soal Next.js non-standar).
   - Halaman baru `app/shipments/[shipmentId]/surat-jalan/page.tsx` — SENGAJA ditaruh DI LUAR grup route `(shell)` supaya TIDAK ikut sidebar/header AppShell saat dicetak (murni dokumen). Komponen `SuratJalanPrintPage.tsx` melakukan authcheck sendiri (pola sama seperti halaman lain: cek sesi Supabase, redirect ke `/login` kalau belum login) lalu render ulang `SuratJalanPreview` yang SAMA PERSIS dipakai di wizard, kali ini dengan `signature_url_snapshot` ASLI yang tersimpan. Ada tombol "Cetak / Simpan sebagai PDF" (`window.print()`, elemen tombol disembunyikan otomatis saat print lewat kelas `print:hidden`) — belum pakai library PDF khusus, print-to-PDF bawaan browser cukup untuk kebutuhan ini.
   - Tombol "Lihat Surat Jalan" ditambahkan ke setiap baris tabel "Daftar Pengiriman" di `/shipments`, membuka halaman di atas di tab baru.
3. **Diverifikasi lewat browser sungguhan**: screenshot Langkah 1 menunjukkan nama item full-width dengan Lot(kol.1)/Jumlah Kirim(kol.2) di bawahnya + divider sebelum Alamat Tujuan, PERSIS sesuai permintaan. Klik "Lihat Surat Jalan" pada shipment nyata (SJ-009/8-ITM/2026) membuka halaman cetak berisi kop perusahaan+logo, data lengkap, tabel item, DAN gambar tanda tangan asli tersimpan (bukan placeholder) di area "Pengirim".
4. Build sukses, `tsc --noEmit` bersih, **32 test tetap lolos, tanpa regresi**.

**Revisi ketiga (masih sesi yang sama) — restrukturisasi Langkah 1 jadi 3 section + panel detail per baris (Carbon Expandable Data Table) + foto bukti pengiriman WAJIB sebelum stok berkurang:**
1. **Langkah 1 dipecah jadi 3 section berjudul**: "Detail Sales Order" (No. SO, client, lokasi produksi, DAN per baris item — qty SUDAH dikirim vs total dipesan vs sisa, data yang sebelumnya tidak ditampilkan sama sekali di form ini), "Produk" (form Lot+qty per baris, lebar kolom Lot dinaikkan jadi ~75% dari lebar area form lewat `grid-cols-[3fr_1fr]`, Jumlah Kirim cukup ~25%), "Detail Pengiriman" (alamat/penerima/kendaraan/sopir, field yang sudah ada). Alasan dari user: layout lama "terasa sesak, informasi tercampur jadi 1".
2. **Migration baru `20260817190000_shipment_dispatch_photo.sql`**: kolom `shipments.dispatch_photo_url` + bucket storage `shipment-dispatch-photos` (public read, write dibatasi role warehouse/PPIC + company_id lewat RLS, TIDAK ADA policy update/delete — sama seperti pola retensi bucket lain di proyek ini). Sudah di-push ke database dev, diverifikasi lewat 1 upload sungguhan (lihat poin 5).
3. **Transisi draft→shipped direstrukturisasi total** menjawab permintaan user (foto bukti WAJIB sebelum stok berkurang, dikonfirmasi via 3 pertanyaan klarifikasi ke user sebelum dikerjakan — kolom baru vs tabel baru, wajib vs opsional, "Tandai Diterima" ikut butuh foto atau tidak — user pilih rekomendasi di ketiganya): tombol lama "Kirim (Kurangi Stok)" DIHAPUS, diganti fungsi server baru `processShipmentDispatch.ts` (`POST /api/shipments/dispatch`, multipart/form-data) — validasi role+company+status draft, upload foto ke storage, BARU kalau sukses jalankan `UPDATE shipments SET status='shipped', dispatch_photo_url=... WHERE status='draft'` dalam 1 statement (trigger `process_shipment_shipped()` yang sudah ada dari Sesi 3A/3B TIDAK disentuh sama sekali, tetap jalan apa adanya lewat UPDATE ini). `updateShipmentStatus.ts` (`PATCH /api/shipments/status`) SEKARANG HANYA menerima target `delivered` — target `shipped` sengaja dikeluarkan dari daftar supaya tidak bisa dilewati tanpa foto lewat jalur itu. "Tandai Diterima" (shipped→delivered) TETAP tidak butuh foto, sesuai pilihan user.
4. **Koreksi arah UI PENTING, terjadi MID-TURN** (user mengirim pesan baru sebelum saya selesai menulis kode untuk poin 5): rencana awal saya adalah tombol "Detail" membuka MODAL popup berisi semua info + aksi. User menyela dengan referensi ke Carbon Design System *Expandable Data Table* (https://carbondesignsystem.com/components/data-table/usage/#expansion) dan menyarankan pola itu dipakai untuk info detail pengiriman + Surat Jalan + aksi proses lainnya. Saya HENTIKAN rencana modal, dan sebagai gantinya memperluas komponen `DataTable` GENERIK (`src/components/ui/data-table.tsx`, dipakai di banyak halaman lain — Items, BOMs, Work Orders, dst) dengan 3 prop opsional baru: `getRowId`, `expandedRowId`, `renderExpandedRow` — kalau tidak dipakai, tabel manapun yang sudah ada berperilaku PERSIS sama seperti sebelumnya (backward compatible, sudah dicek typecheck+build+32 test tetap lolos di semua halaman lain yang pakai `DataTable`). Klik "Detail" di baris Shipments sekarang membuka panel LANGSUNG di bawah baris itu (bukan modal) — isinya: info SO/alamat/penerima/kendaraan/sopir, tabel item, foto bukti pengiriman (kalau sudah ada), dan tombol aksi "Lihat/Cetak Surat Jalan" + "Proses Pengiriman" (draft) / "Tandai Diterima" (shipped). Modal HANYA dipakai lagi untuk "Proses Pengiriman" itu sendiri (upload foto) — karena itu aksi entri data yang butuh fokus, beda dari sekadar menampilkan detail.
5. **Diverifikasi lewat browser sungguhan (2 skrip Playwright terpisah)**: screenshot Langkah 1 menunjukkan 3 section berjudul dengan benar (termasuk "Sudah dikirim 10/2000 g (sisa 1990)" per baris item) dan Lot dropdown jelas lebih lebar dari Jumlah Kirim. Klik "Detail" pada shipment draft (SJ-009/8-ITM/2026) → panel terbuka LANGSUNG di bawah baris itu (dicek: 0 elemen `[role="dialog"]` di halaman = bukan modal), tombol "Proses Pengiriman" tampil. Klik tombol itu → modal upload foto terbuka, file PNG test diupload (preview gambar tampil), klik "Proses (Kurangi Stok)" → `POST /api/shipments/dispatch` mengembalikan `200 {status: 'shipped', dispatch_photo_url: 'https://.../shipment-dispatch-photos/1/190/dispatch-....png'}` — dicek di UI: status badge berubah "Draft"→"Terkirim", pesan "Terkirim — stok telah berkurang." muncul, "Sisa Qty Belum Terkirim" di tabel SO berkurang tepat sesuai qty dikirim (1990→1985 g). Dicek ulang: klik "Detail" pada shipment yang sama → foto bukti pengiriman yang baru diupload tampil di panel (`<img alt="Foto bukti pengiriman">` ditemukan).
6. Build sukses, `tsc --noEmit` bersih, **32 test tetap lolos, tanpa regresi** (dicek ulang setelah SEMUA perubahan poin 1-5 di atas).

**Revisi keempat (masih sesi yang sama) — kolom Aksi dirapikan, label Status diganti istilah, panel detail tampilkan stok+total terkini saat sudah diproses:**
1. **Kolom "Aksi" di "Daftar Pengiriman" sekarang HANYA berisi tombol "Detail"** — sebelumnya juga menampilkan pesan status transien (mis. "Terkirim — stok telah berkurang.") di bawah tombol, dipindah ke dalam panel detail (dekat tombol aksi) supaya kolom Aksi bersih. Kolom "Status" (yang SUDAH ada 1 kolom sebelum Aksi) tetap jadi satu-satunya tempat status ditampilkan permanen.
2. **Label status diganti supaya sesuai arti kata sehari-hari** (nilai `shipments.status` di database TIDAK berubah, cuma label tampilan): `shipped` → **"Di Proses"** (barang sudah keluar gudang, dalam perjalanan — sebelumnya keliru dilabeli "Terkirim"), `delivered` → **"Terkirim"** (barang sudah sampai ke penerima — sebelumnya "Diterima"). `draft`/`cancelled` tetap "Draft"/"Batal".
3. **Panel detail baris pengiriman sekarang menampilkan info tambahan KHUSUS untuk status selain draft**: 2 kolom baru di tabel item — "Stok Lot Saat Ini" (`lots.quantity_on_hand` TERKINI, bukan snapshot lama) dan "Total Sudah Dikirim (SO ini)" (`sales_order_lines.qty_shipped`/`qty_ordered` — total across SEMUA pengiriman untuk SO line itu, bukan cuma qty di baris pengiriman ini). `listShipments.ts` diperluas untuk JOIN data ini (lot stock + SO line cumulative). Foto bukti pengiriman juga disyaratkan `status !== 'draft'` sebelum ditampilkan (sebelumnya cuma cek ada/tidaknya foto — sekarang eksplisit selaras "kalau sudah terkirim baru tampil").
4. **Insiden operasional saat verifikasi (bukan bug kode)**: sempat menjalankan `npm run build` (production build) SAAT `next dev` server sesi ini masih aktif di folder yang sama — keduanya berbagi folder `.next`, menyebabkan dev server jadi corrupt (halaman `/shipments` macet di "Memuat..." dengan sidebar yang kehilangan beberapa menu). Diperbaiki dengan restart bersih: `kill` proses lama, `rm -rf .next`, `npm run dev` ulang. **Pelajaran untuk sesi berikutnya: JANGAN jalankan `npm run build` di folder yang sama saat `next dev` sedang aktif untuk verifikasi browser** — kalau perlu cek build sukses, terima delay restart dev server setelahnya, atau jalankan build di worktree terpisah.
5. **Diverifikasi lewat browser sungguhan setelah dev server displaikan ulang**: screenshot "Daftar Pengiriman" menunjukkan label "Di Proses"/"Terkirim"/"Draft"/"Batal" dengan warna badge yang sesuai. Panel detail shipment berstatus "Di Proses" (SJ-009) menampilkan kolom "Stok Lot Saat Ini" (mis. 1786 g) dan "Total Sudah Dikirim (SO ini)" (mis. 19/2000 g) + foto bukti pengiriman. Panel detail shipment berstatus "Draft" (SJ-008) TIDAK menampilkan 2 kolom itu maupun foto (sesuai — belum diproses, belum ada datanya).
6. Build sukses, `tsc --noEmit` bersih, **32 test tetap lolos, tanpa regresi**.

---

## Sesi 1 — Tanda Tangan Digital, Fondasi Generik (17 Agu 2026) — SELESAI

**Migration** `20260817160000_document_signatures.sql`: `users.signature_url` (nullable), tabel `document_signatures` (company_id, document_type, document_id — TANPA FK ketat karena lintas tabel beda-beda, signed_by, signer_role_at_signing, signature_url_snapshot, confirmation_text, signed_at), RLS select-only company-scoped (tidak ada policy insert/update/delete untuk role biasa — semua tulis lewat service-role, sama seperti mutation lain di app ini). Bucket storage `user-signatures` (public read, owner-write, **TIDAK ADA policy delete sama sekali** — sengaja, supaya retensi permanen ditegakkan juga di level RLS bukan cuma konvensi kode).

**Penyimpangan SENGAJA dari pola avatar/logo yang sudah ada** (`uploadAvatar.ts`/`uploadCompanyLogo.ts`): keduanya pakai path TETAP + `upsert:true` (file lama TERTIMPA di storage, cuma query-string cache-bust yang berubah) — kalau signature meniru pola itu, dokumen yang sudah ditandatangani akan ikut berubah begitu user ganti tanda tangan, MELANGGAR requirement inti fitur ini. `uploadSignature.ts` pakai path UNIK per upload (`{auth_uid}/signature-{timestamp}.{ext}`, `upsert:false`) — dicatat jelas di komentar kode supaya sesi berikutnya tidak "menormalkan" balik ke pola lama.

**Penyimpangan SENGAJA lain, dari deskripsi awal komponen** (bukan STOP CONDITION, tapi keputusan desain yang dilaporkan): instruksi awal menyiratkan `ConfirmAndSignModal` SENDIRI yang insert ke `document_signatures` lalu memanggil `onConfirm` terpisah — itu jadi 2 request/transaksi berbeda, bertentangan langsung dengan requirement Sesi 2 ("tanda tangan + transisi status HARUS 1 transaksi"). Diputuskan: `onConfirm` sepenuhnya dikendalikan PEMANGGIL (bisa panggil endpoint generik `/api/document-signatures` untuk kasus sederhana, atau 1 RPC gabungan untuk kasus butuh atomik) — modal murni "UI shell" (checkbox + preview + Process/Cancel), tidak insert apa pun sendiri. Endpoint generik `POST /api/document-signatures` (`recordDocumentSignature.ts`) tetap dibuat untuk kasus yang TIDAK butuh atomisitas.

**Kode baru:** domain feature baru `src/features/signatures/` (component `ConfirmAndSignModal`, server `recordDocumentSignature`), `src/features/auth/server/uploadSignature.ts`, section "Tanda Tangan Digital" di halaman Profil (upload/ganti, preview `object-contain` bukan `rounded-full` seperti avatar). `getCurrentUser()` (`supabaseServer.ts`) diperluas ambil `signature_url` juga.

**Verifikasi browser sungguhan** (login `warehouse.a@debug.mrp`):
- Upload tanda tangan 3x berturut-turut (v1, v2, balik ke konten v1 lagi sebagai v3) — SEMUA 3 URL tetap bisa diakses langsung (HTTP 200) SETELAH upload berikutnya, dibuktikan lewat fetch langsung ke tiap URL, bukan cuma asumsi.
- Halaman test sementara (`app/(shell)/debug-signature-test`, DIHAPUS lagi sebelum commit — bukan bagian permanen) dipakai untuk uji `ConfirmAndSignModal` dengan data dummy: tombol Process disabled sebelum checkbox dicentang, aktif setelah dicentang.
- **Skenario kunci yang diminta eksplisit — tanda tangan dokumen LAMA tidak ikut berubah:** dokumen dummy #1 ditandatangani saat signature_url = v2 → `signature_url_snapshot` tercatat = url v2. User lalu GANTI tanda tangan ke v3. Dokumen dummy #2 ditandatangani → snapshot = v3 (benar, yang baru). Dicek ulang ke database: baris dokumen #1 TETAP snapshot v2, TIDAK ikut berubah ke v3 — dibuktikan lewat query langsung, bukan asumsi.
- Cancel/Edit diuji: modal dibuka, TIDAK dicentang, klik Cancel — dicek tidak ada baris `document_signatures` baru tercipta.
- Data dummy (`document_type='debug_test'`) dibersihkan setelah verifikasi (beda dari data demo Shipments Sesi 3B yang sengaja dibiarkan — ini murni data uji, bukan penggunaan nyata). Tanda tangan asli `warehouse.a@debug.mrp` (hasil upload terakhir) SENGAJA dibiarkan tersimpan — akun ini sekarang punya tanda tangan sungguhan untuk dipakai uji Sesi 2 nanti.

**Build sukses, typecheck bersih, 32 test tetap lolos.**

**Belum dikerjakan:** Sesi 2 — pasang ke Shipments/Surat Jalan (ganti tombol transisi draft→shipped jadi buka modal, atomik dengan pencatatan tanda tangan, tampilkan tanda tangan di PDF Surat Jalan Sesi 3C).

---

## Sesi 3B — UI Pencatatan Pengiriman (17 Agu 2026) — SELESAI

**Kode baru:**
- Halaman `/shipments` (`ShipmentsPage.tsx`) — akses `canManageShipments` (leadership + warehouse_manager/staff + ppic_manager, sinkron RLS `shipments_write_warehouse`). 2 bagian: tabel SO bersisa qty + tombol "Buat Pengiriman" (form inline: qty per baris + lot FEFO tersaran otomatis dari `/api/lots` yang sudah terurut expiry_date terdekat — bisa diganti manual — + alamat tujuan WAJIB + penerima/kendaraan opsional), dan "Daftar Pengiriman" (riwayat semua shipment perusahaan + tombol transisi status sesuai status saat ini).
- Server: `createShipment.ts` (generate `shipment_number` format `SJ-{seq}/{bulan}-{kode}/{tahun}`, TERPISAH dari `so_number` tapi pola sama — sengaja HANYA 1 implementasi TypeScript, tidak diduplikasi jadi fungsi DB seperti `so_number` untuk menghindari utang sinkronisasi yang sama), `listShipments.ts`, `updateShipmentStatus.ts` — semua pesan error dari trigger Sesi 3A diteruskan APA ADANYA ke UI, tidak diterjemahkan ulang.
- `listSalesOrders.ts` diperluas (BUKAN diganti): tiap baris SO line sekarang bawa `qty_shipped`/`qty_remaining_to_ship`, tiap SO bawa `shipments: [...]` (riwayat). `listLots.ts` dapat parameter opsional `production_plant_id` (tidak mengubah pemanggil lama).
- `SalesOrdersPage.tsx` — HANYA ditambah kolom "Sudah Dikirim"/"Sisa Belum Dikirim" + section "Riwayat Pengiriman" (read-only), sesuai BATAS eksplisit ("jangan ubah halaman SO selain menambah info status pengiriman"). Trigger/logika Sesi 3A tidak disentuh sama sekali.
- Role baru `canManageShipments` di `src/lib/roles.ts`. Nav "Pengiriman" ditambah ke section Warehouse di `AppShell.tsx`.

**Verifikasi browser sungguhan** (login `warehouse.a@debug.mrp`, data real Company A/PT ITM, SO `001/8-ITM/2026` qty_ordered 300 pcs Gummy Strawberry Collagen):
- Saran lot FEFO benar-benar terisi otomatis di dropdown (dibuktikan dengan menambah 1 lot baru berexpiry dekat — lot lama semua `expiry_date` NULL, jadi sebelum ini tidak ada cara membuktikan FEFO secara visual — lot baru itu MUNCUL PALING ATAS, sesuai `ORDER BY expiry_date ASC NULLS LAST`).
- Pengiriman PARSIAL 2x untuk SO yang sama: SJ-001 (100 pcs, alamat "Jl. Melati No. 10, Jakarta Selatan") dan SJ-002 (50 pcs, alamat "Jl. Anggrek No. 25, Bandung") — ALAMAT BEDA per pengiriman, dibuktikan di screenshot Riwayat Pengiriman SO. Sisa qty terhitung benar di tiap tahap: 300→(draft, tetap 300)→(SJ-002 shipped)250→(SJ-001 shipped)150.
- Percobaan kirim 999 pcs lewat UI (sisa saat itu 150) → DITOLAK, pesan persis dari trigger tampil di form: "Jumlah melebihi sisa pesanan — sisa 150.0000, diminta 999.0000."
- Bonus (ditemukan organik, bukan direncanakan): sempat coba ship SJ-001 sebelum lot cukup stok (2 shipment draft kebetulan pakai lot FEFO yang sama, kombinasi qty-nya melebihi stok fisik lot itu) → DITOLAK bersih dengan pesan trigger asli: "Stok lot 234 tidak cukup untuk shipment_line 78 (stok tersedia 10.0000, diminta 100.0000)." — dibuktikan pengurangan stok TIDAK terjadi (status tetap draft). Lot ditambah stoknya (data demo milik sendiri) lalu ship ulang berhasil.
- Kedua shipment berhasil sampai status `delivered` (2 klik "Tandai Diterima" terpisah, masing-masing dikonfirmasi lewat response API 200).
- Halaman detail SO (`SalesOrdersPage.tsx`) menampilkan akurat: FG-GUMMY-STRAWCOL "Sudah Dikirim 150 pcs, Sisa 150 pcs", Riwayat Pengiriman 2 baris keduanya "Diterima" dengan alamat berbeda.
- Build produksi (`npm run build`) sukses, route `/shipments`+`/api/shipments`+`/api/shipments/status` terdaftar. `npm run typecheck` bersih. Test suite 32/32 tetap lolos (tidak ada test baru ditambah untuk UI — sesuai konvensi sesi ini, verifikasi UI lewat browser bukan lewat test otomatis DB-level).

**Catatan:** data demo (SO 001/8-ITM/2026, 2 shipment, 1 lot tambahan `GUMMY-FEFO-DEMO-NEAREXP`) SENGAJA TIDAK dibersihkan setelah verifikasi — ini bukan fixture test sekali-pakai seperti `tests/*.test.ts`, tapi penggunaan NYATA tenant debug Company A yang datanya memang dimaksudkan bisa dilihat langsung oleh user di browser.

**Belum dikerjakan:** Sesi 3C — PDF Surat Jalan. Fungsi kalkulasi margin per pengiriman.

---

## Sesi 3A (lanjutan sore) — Pembatasan qty_shipped vs qty_ordered (17 Agu 2026) — SELESAI

**MEMBALIK keputusan Sesi 3A pagi**: sebelumnya kirim melebihi sisa `qty_ordered` SO line SENGAJA diizinkan (konsisten dengan `goods_receipt_lines`). Instruksi eksplisit membalik ini KHUSUS untuk shipments — sekarang DITOLAK DI DATABASE, bukan cuma validasi form. `goods_receipt_lines` sendiri TIDAK disentuh, tetap seperti semula.

**Migration:** `20260817150000_shipment_lines_qty_limit_enforcement.sql`. Trigger baru `enforce_shipment_line_qty_limit` (BEFORE INSERT/UPDATE OF qty_shipped, sales_order_line_id ON shipment_lines) — jumlah baris ini merangkapkan seluruh baris `shipment_lines` NON-CANCELLED (draft + shipped, bukan cuma yang sudah shipped) untuk `sales_order_line_id` yang sama tidak boleh melebihi `qty_ordered`. Pesan error: "Jumlah melebihi sisa pesanan — sisa X, diminta Y." SECURITY DEFINER — perlu, karena `sales_order_lines` RLS-nya enabled TAPI NOL policy (default-deny total untuk role biasa, ditemukan saat menulis migrasi ini, bukan cuma asumsi).

**Keputusan desain yang TIDAK diminta eksplisit tapi konsekuensi logis:** baris shipment milik shipment `cancelled` dikecualikan dari total kumulatif — supaya percobaan pengiriman yang dibatalkan tidak permanen mengunci kuota qty (kalau tidak dikecualikan, staf tidak akan pernah bisa coba kirim ulang setelah 1 kali membatalkan shipment).

**Verifikasi:** `tests/shipments_physical_stage.test.ts` diperbarui (test lama "over-ship DIIZINKAN" diubah jadi "DITOLAK", ditambah 1 test baru "TEPAT SAMA dengan sisa -> DIIZINKAN" untuk batas atas). 7 test file ini lolos, 32 test seluruh suite lolos, ~46 detik. Dibuktikan konkret: insert baris qty=15 saat sisa=10 → DITOLAK sebelum baris sempat tercipta sama sekali (`shipment_lines` tetap 0 baris untuk shipment itu), `sales_order_lines.qty_shipped` TETAP 0 (bukan sebagian ter-update).

**CI sempat merah 1x lagi** (pola SAMA seperti sebelumnya, limit default Vitest berbeda kali ini): "Test timed out in 5000ms" di 1 assertion `cross_company_isolation.test.ts` — bukan bug, `testTimeout` default Vitest (5 detik) kelewat di bawah latensi CI, sama seperti `hookTimeout` sebelumnya tapi ini limit PER-TEST bukan per-hook. Dinaikkan sekalian ke 30 detik di `vitest.config.ts`, run berikutnya hijau bersih di kedua job (https://github.com/alvhyzid/mrp/actions/runs/31990280125).

**Belum dikerjakan:** Sesi 3B (UI) — termasuk instruksi baru "tampilkan sisa qty jelas SEBELUM submit" yang belum ada tempatnya karena UI shipments belum dibangun sama sekali.

---

## Sesi 3A — Fondasi Data Shipments (17 Agu 2026) — SELESAI

**Konteks:** didahului Laporan Arkeologi Shipments (query katalog Postgres langsung) yang menemukan: skema `shipments`/`shipment_lines` sudah ada sejak 12 Agu tapi NOL kode/trigger/data menyentuhnya; `stock_movements.movement_type` sudah mengantisipasi nilai `'shipment'`; pola trigger established (`process_goods_receipt_line()`, `trigger_recompute_stock_projection()`) yang jadi acuan wajib untuk implementasi ini.

**Migration:** `20260817140000_shipments_physical_stage.sql` — diterapkan ke dev (`kfvtrwuuqcjfkkuqizxt`) lewat `supabase db push --linked`.
- `shipment_lines.lot_id` diubah NOT NULL (traceability wajib)
- `shipments`: tambah `shipment_number` (unique per company, prefix `SJ-`), `vehicle_number`, `driver_name`, `delivery_address` (NOT NULL), `recipient_name`, `recipient_phone`
- `sales_order_lines.qty_shipped` (numeric(14,4) default 0, kumulatif — increment otomatis oleh trigger)
- `shipments` didaftarkan ke `enforce_status_transition()` (fungsi generik yang sama dipakai 5 tabel lain, DIPERLUAS dengan 1 cabang baru — bukan bikin fungsi terpisah): `draft→shipped`, `draft→cancelled`, `shipped→delivered`
- Trigger baru `process_shipment_shipped()` (AFTER UPDATE OF status ON shipments, WHEN draft→shipped) — mengurangi `lots.quantity_on_hand`, insert `stock_movements` (`movement_type='shipment'`), update `sales_order_lines.qty_shipped`, panggil `recompute_stock_projection_for_item()`, untuk SEMUA `shipment_lines` milik shipment itu (loop) — sengaja AFTER UPDATE di HEADER, bukan AFTER INSERT di tabel detail seperti 2 pola acuan, karena requirement eksplisit "stok jangan berkurang sebelum status jadi shipped"
- Fungsi baru `suggest_fefo_lots(item_id, production_plant_id)` — saran lot FEFO, SECURITY INVOKER (bukan DEFINER) supaya RLS `lots` tetap berlaku otomatis lewat privilese pemanggil

**Verifikasi nyata (script + test permanen, keduanya dijalankan terhadap dev asli):**
- `tests/shipments_physical_stage.test.ts` (test BARU, 6 test, masuk CI) — LOLOS 6/6. Suite penuh (5 file, 31 test) tetap LOLOS 31/31 setelah penambahan ini, ~42 detik.
- Alur penuh: buat shipment (draft) → tambah 2 baris (lot beda expiry) → **stok TIDAK berubah selagi draft** (dibuktikan before/after tepat di titik itu) → ubah status ke `shipped` → **stok berkurang TEPAT saat itu** (near-expiry 100→70, far-expiry 100→90) → `stock_movements` 2 baris (`movement_type=shipment`) tercatat → `sales_order_lines.qty_shipped` 0→40 → `status_transition_log` mencatat transisi.
- Negatif 1: insert `shipment_line` dengan `lot_id=NULL` → DITOLAK (`23502`, constraint NOT NULL).
- Negatif 2: transisi `draft→delivered` langsung (skip `shipped`) → DITOLAK (`enforce_status_transition`, `23514`).
- Negatif 3 (bonus, di luar yang diminta tapi relevan): kirim qty melebihi stok FISIK lot → DITOLAK, stok lot tidak berubah (tidak sampai negatif).
- Skenario 4 (bukan negatif — perilaku yang diminta untuk dilaporkan): kirim qty melebihi SISA `qty_ordered` SO line → **DIIZINKAN** (konsisten dengan `goods_receipt_lines.qty_received` yang juga tidak dibatasi terhadap `qty_ordered`, tidak ada preseden pembatasan seperti itu di manapun di codebase ini).
- `suggest_fefo_lots()` diverifikasi mengembalikan lot expiry terdekat lebih dulu.
- Semua data fixture (`ShipmentTestCorp`) dibersihkan total setelah verifikasi — dev DB dikonfirmasi kembali ke 0 baris `shipments`/`shipment_lines`.

**Dokumentasi diperbarui:** `rancangan-skema-database-mrp.md`, `daftar-database-sederhana.md`, `prioritas-fitur-mrpeasy-enterprise.md` (margin/profit per pengiriman & telusur PO diubah dari ❌/🟡-lama ke 🟡 dengan detail baru — BELUM ✅ karena UI Sesi 3B dan kalkulasi margin itu sendiri belum digarap).

**CI (dari Sesi 2C) sempat merah sekali gara-gara perubahan ini, sudah diperbaiki:** push pertama Sesi 3A membuat `role_hierarchy_financial_access.test.ts` (file test LAMA, tidak disentuh isinya) gagal "Hook timed out in 10000ms" di CI — akibat `fileParallelism:false` (fix Sesi 2C) ditambah file test ke-5 yang lebih berat, total waktu tunggu per-file melebihi limit default 10 detik Vitest di bawah latensi network CI. Diperbaiki dengan menaikkan `hookTimeout` ke 30 detik di `vitest.config.ts` (config bersama, BUKAN mengubah file test manapun) — commit terpisah, run berikutnya hijau bersih (kedua job: https://github.com/alvhyzid/mrp/actions/runs/31989356358).

**Belum dikerjakan (lanjutan eksplisit sesuai rencana):**
- Sesi 3B — UI Shipments (halaman, form, FEFO ter-tampil, transisi status lewat browser)
- Sesi 3C — PDF Surat Jalan
- Fungsi kalkulasi margin per pengiriman itu sendiri (skema/data sudah siap, fungsinya belum ditulis)

---

## Sesi 2C — CI GitHub Actions (16-17 Agu 2026) — SELESAI

**Status kriteria — semua tercapai:**
- [x] `supabase/config.toml` dibuat (repo ini SEBELUMNYA tidak punya sama sekali — migrasi selalu di-push langsung ke project remote, tidak pernah lewat `supabase db start` lokal)
- [x] Test baru `tests/cross_company_isolation.test.ts` (7 test) — mengisi gap Lapis 1 B.9 "isolasi antar company" yang TIDAK ADA di 3 file test manapun sebelumnya (`role_hierarchy_financial_access`/`employee_attendance_access` menguji antar-ROLE dalam 1 company, `super_admin` tidak menguji isolasi). Fixture 2 company terpisah (`IsolationTestCorp X`/`Y`, pola sama seperti `RoleTestCorp`), dibuat & dibersihkan total tiap run. Dijalankan terhadap dev asli LOLOS 7/7 sebelum di-commit — membuktikan RLS isolasi company memang bekerja, bukan cuma "test-nya ada". 3 file test lama TIDAK diubah.
- [x] `npm run typecheck` (`tsc --noEmit`, script baru) dan `npm test` (`vitest run` semua 4 file, script baru) — jalan otomatis tiap push lewat `.github/workflows/ci.yml`, 2 job paralel (`verify`, `rebuild-migrations`).
- [x] `rebuild-migrations` pakai **pg_dump ASLI** (`supabase/setup-cli@v1` → `supabase db start` di Docker runner GitHub → `supabase db dump --local`) — BUKAN lagi substitusi introspeksi `pg_catalog` dari Sesi 2A, sesuai instruksi eksplisit sesi itu.
- [x] 6 GitHub Secrets ditambahkan manual oleh user lewat GitHub web UI.
- [x] **Run hijau bersih tercapai**: https://github.com/alvhyzid/mrp/actions/runs/31966655990 — job `verify` selesai 1m33s, job `rebuild-migrations` selesai 1m51s (jauh di bawah target <5 menit).
- [x] **Demonstrasi red→green SUNGGUHAN dilakukan** (2 kali, lihat kronologi di bawah — bukan cuma 1 demo buatan, tapi 2 bug NYATA ditemukan+diperbaiki oleh CI itu sendiri di 2 run pertama, DITAMBAH 1 demo red→green sengaja sebagai bukti eksplisit sesuai permintaan).

### Kronologi (bukti CI benar-benar bekerja, bukan cuma "hijau kebetulan")

**Run 1 — https://github.com/alvhyzid/mrp/actions/runs/31965768475 — MERAH, 2 bug NYATA ditemukan:**
- `rebuild-migrations` gagal di langkah "Verifikasi dump berisi tabel inti": SEMUA 9 tabel yang dicek tidak ditemukan. Akar masalah (dibuktikan lewat `supabase db dump --local --dry-run` lokal, bukan tebakan): `supabase db dump` SELALU menyisipkan sed substitution `s/^CREATE TABLE "/CREATE TABLE IF NOT EXISTS "/` — pola grep versi pertama tidak mengizinkan "IF NOT EXISTS " di tengah, jadi tidak pernah cocok. Diperbaiki di commit `f5c89ea`.
- `verify` gagal di `npm test`: `Failed to create fixture company: JWT issued at future` di `beforeAll` salah satu file test.

**Run 2 — https://github.com/alvhyzid/mrp/actions/runs/31966431158 — SEBAGIAN MERAH, bug ke-2 dikonfirmasi:**
- `rebuild-migrations` **hijau** (perbaikan commit `f5c89ea` terbukti benar).
- `verify` MASIH merah, error SAMA PERSIS ("JWT issued at future") tapi kali ini di file test LAIN (`role_hierarchy_financial_access.test.ts`, bukan `cross_company_isolation.test.ts` lagi). Pola ini (file yang gagal berganti-ganti, SELALU tepat di request admin PALING AWAL sebuah file, tidak pernah gagal saat 1 file dijalankan sendirian) adalah signature lonjakan koneksi baru simultan ke Supabase — Vitest default menjalankan semua file test paralel, jadi ke-4 `beforeAll` menembak `adminClient.from('companies').insert()` ke project dev yang sama nyaris bersamaan. **Bukan bug di RLS/kode aplikasi** — diverifikasi dengan membaca log run, bukan diasumsikan. Diperbaiki dengan `fileParallelism: false` di `vitest.config.ts` (commit `67c96ce`), total durasi test tetap naik wajar (36 detik lokal, jauh di bawah target).

**Run 3 — https://github.com/alvhyzid/mrp/actions/runs/31966655990 — HIJAU BERSIH.** Kedua job sukses, dikonfirmasi lewat GitHub API (job `verify` 19:07:52→19:09:25, job `rebuild-migrations` 19:07:53→19:09:44).

**Run 4 — https://github.com/alvhyzid/mrp/actions/runs/31966811868 — MERAH SENGAJA (demo eksplisit).** Assertion `expect(1).toBe(2)` disisipkan sementara di `cross_company_isolation.test.ts` (commit `39c269e`), push, run merah tertangkap — dikonfirmasi lewat log run: tepat 1 test gagal (`AssertionError: expected 1 to be 2`), 25 test lain tetap lolos, job `rebuild-migrations` tidak terpengaruh. Assertion langsung dihapus di commit berikutnya, push lagi → **hijau lagi**, menutup demonstrasi.

**Kendala teknis & solusi (dicatat untuk sesi berikutnya):**
- `gh` CLI TIDAK TERSEDIA di sandbox ini (`gh auth status`/`gh secret list` → "command not found"), tidak ada package manager untuk memasangnya. Solusi: (a) user tambah GitHub Secrets manual lewat web UI — kredensial tidak pernah lewat chat; (b) untuk memantau run & baca log, user membuatkan **Fine-grained PAT scope `Actions: Read-only`** khusus repo ini (bukan admin/write) — cukup untuk `GET .../actions/runs` dan `GET .../actions/jobs/{id}/logs` (endpoint log WAJIB token beradmin/akses baca Actions, gagal 403 "Must have admin rights" tanpa token meski repo public — hanya endpoint run-list/run-detail yang bisa diakses publik tanpa token).
- Rate limit API publik tanpa token cuma 60/jam — cepat habis kalau polling manual berulang; pakai header `Authorization: Bearer <token>` menaikkan ke 5000/jam.
- Shell gotcha: variabel bernama `status` di zsh itu READ-ONLY (built-in), assignment ke `status=` di dalam skrip polling langsung `exit 1` "read-only variable: status" — jangan pernah pakai nama itu untuk variabel sendiri.

---

## Sesi 2B — Setup Staging (16 Agu 2026) — SELESAI (termasuk perbaikan bug nyata di kode bersama)

**Status kriteria — semua 3 tercapai:**
- [x] Aplikasi bisa diakses lewat URL Vercel staging: **https://mrp-staging-zeta.vercel.app**
- [x] Terhubung ke Supabase project staging (`mrp-rebuild-test-2A`/`nclkepwlsgmfbslgsajq`), BUKAN project dev — dibuktikan lewat tes negatif
- [x] Alur signup → login → invite → accept **jalan normal lewat form/UI sungguhan** (signup sempat gagal, akar masalahnya ditemukan & DIPERBAIKI — lihat di bawah)

### BUG NYATA DITEMUKAN & DIPERBAIKI: `custom-access-token` hook gagal untuk user yang BELUM punya baris `public.users`

**Kronologi:** percobaan pertama menyimpulkan "kemungkinan bug platform Supabase spesifik project staging" setelah 11 langkah eliminasi (semua tercatat di riwayat git). **Kesimpulan itu SALAH** — diralat sesi ini setelah pemilik produk meminta 1 diagnosa spesifik lagi (baca log INTERNAL fungsi, bukan pesan generik yang diterima klien; cek penanganan kasus "user belum punya company_id"; cek apakah bug yang sama ada di dev tapi belum pernah terpicu) berdasar referensi github.com/orgs/supabase/discussions/38579 (pesan "Hook requires authorization token" itu GENERIK untuk error internal APA PUN di dalam hook, bukan spesifik soal token).

**Akar masalah sebenarnya** (`supabase/functions/custom-access-token/index.ts`): fungsi query `public.users` by `auth_uid`, dan kalau TIDAK ADA baris ditemukan, mengembalikan `401 {"error": "company_id not found for auth_uid."}`. Untuk user yang BARU SAJA `signUp()`, baris `public.users` memang belum ada — dibuat BELAKANGAN oleh `registerCompanyAdmin.ts` SETELAH `signUp()` return. Kalau GoTrue langsung minta token/sesi di titik itu (terjadi kalau `mailer_autoconfirm=true`, ATAU kalau login normal untuk auth-user yang tidak punya baris `users` sama sekali), hook mengembalikan 401 tadi — yang oleh GoTrue dibungkus jadi pesan generik "Hook requires authorization token" yang sama sekali tidak menyebut akar masalah sebenarnya.

**Dikonfirmasi lewat `function_edge_logs` project staging** (bukan `auth_logs` yang cuma pesan generik) — log request MASUK ke fungsi dari GoTrue (`user_agent: Go-http-client/2.0`) dengan response **status_code 401** — persis cabang kode "company_id not found" di atas, bukan gagal token/secret sama sekali.

**Dikonfirmasi bug yang SAMA ADA DI DEV** — dites langsung (BUKAN lewat ubah config dev, murni panggilan API test): bikin 1 auth user via `admin.createUser()` TANPA baris `public.users` pendamping, coba `signInWithPassword` — **gagal dengan pesan generik yang SAMA PERSIS** di dev. Kesimpulan sesi sebelumnya ("dev masih normal") SALAH — dev cuma kebetulan tidak pernah memicu jalur ini karena (a) `mailer_autoconfirm=false` di dev membuat `signUp()` normal TIDAK langsung minta sesi (nunggu konfirmasi email dulu — baris `users` keburu dibuat oleh `registerCompanyAdmin.ts` di request yang sama sebelum user itu benar-benar login pertama kali), dan (b) semua akun test dev sejauh ini dibuat lewat seed script yang SELALU langsung membuat baris `users` pendamping, tidak pernah lewat form signup murni.

**Perbaikan** (di `supabase/functions/custom-access-token/index.ts`, dipakai bersama dev+staging — 1 kode sumber): kalau tidak ada baris `public.users` ditemukan, sekarang **mengembalikan claims apa adanya** (200 OK, tanpa `company_id`/`app_role`) alih-alih menolak dengan 401 — user tetap dapat sesi (belum ada klaim department/role sampai baris `users`-nya dibuat & mereka login ulang, yang memang sudah jadi alur normal `registerCompanyAdmin.ts`). Kasus lain (baris `users` ADA tapi `company_id`-nya `null`, mis. `super_admin`) TIDAK berubah perilakunya.

**Di-deploy ulang ke KEDUA project** (`supabase functions deploy custom-access-token --no-verify-jwt`, ke `nclkepwlsgmfbslgsajq` dan `kfvtrwuuqcjfkkuqizxt`) dan diverifikasi:
- Staging: `signUp()` asli lewat form `/register` → sukses → redirect `/login` → login sukses → dashboard ter-render lengkap dengan nama company yang baru didaftarkan (screenshot ada).
- Dev: `signUp()` langsung (skrip test, email domain gmail.com acak, langsung dihapus setelah) → sukses tanpa error. Kasus reproduksi (login user tanpa baris `users`) → sekarang sukses dapat sesi. Regresi dicek: user existing dengan company_id (`ppic.a@debug.mrp`) → JWT `company_id`/`app_role` tetap benar seperti sebelumnya.
- `npx vitest run` (18 test) + `npm run build` tetap lulus setelah perubahan.

**Pelajaran untuk sesi berikutnya:** jangan berhenti di kesimpulan "kemungkinan bug platform pihak ketiga" tanpa membaca log INTERNAL sistem yang benar-benar relevan (di sini: `function_edge_logs`, bukan cuma `auth_logs`) dan tanpa menguji ulang asumsi "sudah dicek di dev" dengan skenario yang BENAR-BENAR sama (bukan skenario yang kebetulan menghindari jalur kode bermasalah).

### Yang TERVERIFIKASI bekerja lewat browser sungguhan (screenshot ada di scratchpad sesi ini kalau perlu direproduksi)
- App live di https://mrp-staging-zeta.vercel.app, terhubung ke Supabase staging (bukan dev).
- **Signup ASLI** lewat form `/register` → sukses (setelah perbaikan bug di atas).
- **Login**: berhasil, redirect ke `/dashboard`, JWT `company_id`/`app_role` benar.
- **Invite**: form "Undang anggota baru" di `/team` diisi & disubmit lewat UI sungguhan → baris `invitations` tercipta dengan token asli.
- **Accept**: navigasi ke `/invite/accept?token=<token asli dari DB>` → "Undangan berhasil diterima" → diverifikasi di database: `invitations.status=accepted`, baris `users` baru dengan role & company_id benar.
- **Negatif — isolasi environment**: kredensial user DEV asli (`ppic.a@debug.mrp`) ditolak bersih "Invalid login credentials" saat dicoba di APLIKASI STAGING — membuktikan staging benar-benar project terpisah.

### Konfigurasi yang dibuat sesi ini (DEV hanya disentuh untuk deploy PERBAIKAN BUG di atas, tidak ada config lain yang diubah — diverifikasi berulang kali)
- Vercel project baru `mrp-staging` (org/team `ams-3670`, akun `alvansecures-9901`) — terhubung ke branch git `staging` (bukan `main`), env var `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` di-set untuk staging project, scoped ke Production DAN Preview+branch `staging`.
- Edge Function `custom-access-token` di-deploy ke staging dengan `--no-verify-jwt` (WAJIB untuk Auth Hook berbasis HTTPS).
- Secret `CUSTOM_ACCESS_TOKEN_HOOK_SECRETS` baru khusus staging (bukan pakai punya dev) — tersimpan di secrets Edge Function, TIDAK di git.
- Auth config staging: `hook_custom_access_token_enabled=true` + uri + secret, `site_url=https://mrp-staging-zeta.vercel.app`, `uri_allow_list` mencakup domain staging, `mailer_autoconfirm=true` (SENGAJA beda dari dev yang `false` — staging butuh ini supaya user test tidak perlu menerima email sungguhan; dicatat sebagai penyimpangan yang disadari).
- Branch git `staging` dibuat & di-push ke `origin/staging`.

### Data test yang tersisa di staging (evidence, bukan sisa yatim)
- 1 `companies` + 1 `users` company_admin (bootstrap awal sebelum bug ditemukan) + 1 `users` general_manager hasil accept undangan + 1 `invitations` berstatus accepted. Semua baris signUp yang gagal (sebelum perbaikan) dan test signup yang berhasil (setelah perbaikan) sudah dibersihkan.

### Belum dikerjakan (lanjutan)
- Sesi 2C — CI GitHub Actions, WAJIB pakai `pg_dump` asli untuk uji rebuild-migrasi (lihat catatan Sesi 2A di bawah).

---

## Sesi 2A — Uji Rebuild-from-Migrations (16 Agu 2026) — SELESAI

**Hasil akhir: diff schema KOSONG** antara database dev dan project hasil rebuild murni dari file migrasi — dibuktikan lewat snapshot skema komprehensif (43 tabel, 422 kolom, 204 constraint, 112 index, 14 trigger, 87 RLS policy, 7 view, 34 function, 43 sequence, 8 storage policy, 2 storage bucket, 7 event trigger — total 983 objek), MD5 identik di kedua sisi.

### Temuan: 3 tabel + 2 function + 1 event trigger "liar" (dibuat manual, tidak ada migrasinya)
Ditemukan lewat percobaan rebuild nyata (bukan cuma baca kode) — migrasi paling awal di repo langsung gagal karena tabel `companies` belum ada:
- Tabel `companies`, `users`, `subscription_plans` — fondasi SaaS dari Fase 3 awal proyek, dibuat manual lewat Supabase Dashboard sebelum disiplin migrasi-lewat-file diterapkan.
- Fungsi `is_super_admin_user()`, `rls_auto_enable()` + event trigger `ensure_rls` (RLS auto-enable untuk tabel baru) — juga tidak pernah tercatat.

**Sudah ditambal**: migrasi susulan `supabase/migrations/20260811100000_baseline_companies_users_subscription_plans.sql`, ditempatkan dengan timestamp SEBELUM migrasi pertama yang ada (supaya urutan dependency benar untuk rebuild dari nol). Di database dev, migrasi ini ditandai "applied" TANPA dieksekusi (`supabase migration repair ... --status applied`) karena tabel-tabelnya sudah dalam bentuk FINAL (bukan bentuk awal) — menjalankan ulang DDL-nya di dev berisiko me-regresi `companies_insert_admin` ke versi longgar sebelum diperketat migrasi lain. Sudah diverifikasi dev TIDAK berubah setelah repair.

### Keterbatasan yang WAJIB ditutup di Sesi 2C
Environment kerja sesi ini **tidak punya Docker maupun `pg_dump`** (dicoba: `supabase db dump` butuh Docker; dicek Homebrew/pg_dump lokal — tidak ada; tidak install apa pun tanpa izin). Atas persetujuan eksplisit pemilik produk, verifikasi diff dilakukan pakai fungsi introspeksi SQL kustom (`public.debug_schema_snapshot()`, migrasi `20260817130000` s.d. `20260817131000`) yang membaca `information_schema`/`pg_catalog` langsung — cakupannya dibuat SAMA KETAT dengan `pg_dump --schema-only` (kolom+tipe+nullable+default, semua jenis constraint dengan definisi persis, index, trigger DAN event trigger, RLS policy per role/command/ekspresi lengkap, definisi view, signature+body function, sequence, storage policy+bucket).

**INI SOLUSI SEMENTARA.** Saat Sesi 2C (setup CI GitHub Actions) dikerjakan, uji rebuild-migrasi yang jadi bagian PERMANEN di CI **WAJIB pakai `pg_dump` sesungguhnya** (GitHub Actions runner biasanya punya akses Postgres/Docker yang environment kerja lokal ini tidak punya) — bukan melanjutkan pakai `debug_schema_snapshot()`. Fungsi itu boleh tetap ada di skema (tidak mengganggu), tapi jangan dijadikan alat verifikasi permanen di CI.

### Project Supabase baru untuk uji ini
- Nama: `mrp-rebuild-test-2A`, ref `nclkepwlsgmfbslgsajq`, region `ap-southeast-2`, org `alvhyzid`.
- **JANGAN dihapus** — sesuai `docs/rencana-kerja-playbook-ams.md` Sesi 2B, project ini yang akan dipakai untuk staging (bukan bikin project ketiga), karena skemanya sudah terbukti bersih hasil rebuild dari migrasi.
- Kredensial (URL/anon key/service role key) belum ditambahkan ke `.env` mana pun — akan disiapkan saat Sesi 2B (setup staging + Vercel).
- Password database project ini: disimpan sementara di scratchpad sesi (tidak persisten lintas sesi) — Sesi 2B kemungkinan perlu reset password lewat Dashboard Supabase kalau sudah tidak diketahui lagi.

### File yang ditambahkan sesi ini
- `supabase/migrations/20260811100000_baseline_companies_users_subscription_plans.sql` — baseline susulan (lihat di atas).
- `supabase/migrations/20260817130000_debug_schema_snapshot_function.sql` + `20260817130500_...` + `20260817131000_...` — fungsi introspeksi (sementara, lihat keterbatasan di atas).

### Belum dikerjakan (lanjutan)
- ~~Sesi 2B — Setup Staging~~ → lihat bagian Sesi 2B di ATAS (dikerjakan setelah ini, SEBAGIAN selesai).
- Sesi 2C — CI GitHub Actions, WAJIB pakai pg_dump asli untuk uji rebuild-migrasi.

---

## Cara pakai dokumen ini
Tiap sesi baru: tambah bagian baru di ATAS (paling terbaru di atas) dengan format sama — apa yang dikerjakan, apa yang ditemukan, apa yang belum, bukti konkret (bukan ringkasan "sudah beres"). Jangan hapus riwayat sesi sebelumnya.
