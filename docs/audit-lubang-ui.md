# AUD-04/H.4 — Kenapa Halaman Pelanggan Lolos Audit 2 Kali (22 Agu 2026)

**Hipotesis awal task ini SALAH ALAMAT.** Dugaan awal: "dropdown yang berfungsi membuat auditor menganggap sudah ada jalan masuk, padahal itu bukan halaman kelola." Diverifikasi lewat `git show` ke commit asli tiap versi dokumen ini — baris mentah `customers` **SUDAH BENAR sejak audit PERTAMA** (Sesi 5, commit `518bfff`): "hanya dropdown, tanpa halaman daftar" / Edit "TIDAK ADA". **TETAP benar** di audit ulang berbasis introspection skema (Sesi 7, commit `4dd117c`): ditandai `[MASTER]`, "TIDAK ADA halaman daftar", masuk daftar 5 layar master data yang perlu dibangun dari nol. Audit ini **tidak pernah salah membaca datanya** — di kedua versi.

**Akar penyebab sebenarnya, DUA hal berbeda:**

1. **Tidak ada jalur mekanis dari temuan-yang-benar di dokumen ini ke Daftar Tugas Pembangunan (`build_tasks`).** Task yang akhirnya membangun halaman Pelanggan (PMB-03, "Alur 1") punya `origin = 'pemilik_produk'` — lahir dari **permintaan langsung pemilik produk**, bukan dari promosi otomatis/manual atas baris yang sudah benar di dokumen ini. Sebuah baris audit bisa 100% akurat dan tetap tidak pernah jadi pekerjaan selama tidak ada manusia yang secara terpisah menariknya jadi permintaan — ini kelas masalah "audit tanpa gigi" (findings tanpa *forcing function*), bukan "audit yang keliru."
2. **`docs/checklist-audit-jalan-kaki.md` (audit jalan-kaki per peran) disusun berbasis ALUR KERJA HARIAN per peran** (Gudang/Produksi SPV/Produksi Operator/PPIC/Purchasing) — **tidak ada satu pun bagian "PERAN: SALES/PELANGGAN."** Master data yang jarang dipakai (menambah pelanggan baru, bukan pekerjaan harian) secara struktural tidak akan pernah muncul di audit bergaya "jalan satu hari kerja penuh", karena disusun per-LANGKAH-KERJA, bukan per-TABEL/LAYAR. `suppliers` kebetulan lolos audit ini karena dipakai di langkah harian Purchasing (#5: "Daftarkan supplier baru") — `customers` tidak dipakai di alur harian peran manapun yang tercakup checklist itu.

**Perbaikan yang dijalankan sesi ini (bukan proses otomatis permanen — itu butuh tooling terpisah):**
- Audit per-tabel di bawah ini **sudah mekanis sejak Sesi 7** (introspection skema sungguhan, bukan ingatan) — bagian itu tidak perlu ditulis ulang lagi.
- **Sinkronisasi manual satu kali**: setiap baris `[MASTER]`/`[X]` di bawah dengan Buat=ya DAN Keluar bermasalah/tidak ada, dicocokkan ke `build_tasks` (dicari per nama tabel/fungsi). Hasil: **7 baris ternyata belum pernah punya task sama sekali** — dicatat sebagai `DOC-03`, `ABS-03`, `ABS-04`, `PRD-12`, `PRD-13`, `PRD-14`, `KPI-03`. Detail tiap temuan ada di task masing-masing (Daftar Tugas Pembangunan).
- `docs/checklist-audit-jalan-kaki.md` **tidak** ditambah bagian "PERAN: SALES/PELANGGAN" pada sesi ini (perubahan cakupan checklist itu di luar permintaan H.4) — tapi mekanismenya dicatat di sini supaya keputusan "audit jalan-kaki tidak menutup celah master-data yang jarang dipakai, harus selalu disandingkan dengan audit per-tabel di dokumen ini" tidak hilang untuk audit berikutnya.

---

# Audit Lengkap Tabel — Sesi 7 (21 Agu 2026, menggantikan cakupan Sesi 5)

## Kenapa dokumen ini ditulis ulang, bukan ditambal

Sesi 7.1 menemukan 5 tabel (`routings`, `companies`, `invitations`, `shipments`, `work_orders`) yang seharusnya bertanda [X] tapi tidak pernah masuk daftar akhir Sesi 5. Pemilik produk meminta penjelasan MEKANISME-nya, bukan sekadar "kelalaian" — karena mekanisme yang sama kemungkinan meloloskan tabel lain juga. Investigasi menemukan **DUA mekanisme berbeda**, bukan satu:

**Mekanisme A — sinkronisasi daftar tabel dengan skema tidak pernah dicek ulang lewat sumber otoritatif.** "72 tabel" Sesi 5 ternyata dikumpulkan dari ingatan/dokumen rancangan, BUKAN dari daftar tabel sungguhan di database. Dibandingkan langsung dengan API introspection Supabase (lihat metodologi baru di bawah) — **37 tabel tidak pernah disebut sama sekali** di `audit-lubang-ui.md` versi Sesi 5. Mayoritas termasuk 2 kelompok yang bisa dijelaskan (bukan acak): (a) modul yang dibangun SETELAH baseline Sesi 5 disusun (mis. `production_batch_*_snapshots` dari Sesi 6A — secara harfiah belum ada saat Sesi 5 berjalan), dan (b) modul yang sudah ada tapi domainnya tidak pernah disinkronkan ulang ke daftar audit (KPI: `kpi_actions`/`kpi_responsibilities`/`kpi_snapshots`/`kpi_registry_history`; Kamus: `kamus_terms`/`kamus_term_history`; AI-Project/AI-Readiness: seluruh `ai_*`; Dokumen: `document_access_log`/`document_links`). Ini BUKAN 5 tabel yang hilang — ini gejala bahwa daftar tabel itu sendiri tidak pernah disinkronkan ulang ke skema yang sebenarnya.

**Mekanisme B — tabel yang SUDAH disurvei datanya benar, tapi tidak lolos ke daftar klasifikasi akhir.** Ini mekanisme spesifik untuk `routings`/`companies`/`invitations`/`shipments`/`work_orders`. Kelimanya SUDAH ADA di tabel per-domain Sesi 5 dengan kolom Create/Edit/Arsip-Hapus yang TERISI BENAR (Arsip/Hapus = "TIDAK ADA" untuk kelimanya, persis kondisi sebenarnya) — jadi DATA MENTAHNYA TIDAK SALAH. Yang gagal adalah LANGKAH SINTESIS: mengubah baris tabel per-domain jadi baris bernomor di "Ringkasan Akhir [P]/[X]" dilakukan dengan membaca-lalu-memilih (pattern-matching temuan yang "terasa penting"), BUKAN dengan menyapu MEKANIS setiap baris tabel per-domain dan menandai [X] kalau Buat=ya DAN (Ubah=ya ATAU Ubah=sebagian) DAN Arsip/Hapus=TIDAK ADA. Karena langkah sintesis ini tidak mekanis, benar seperti dugaan pemilik produk: **kemungkinan tabel lain juga lolos** — dan memang benar, ditemukan lagi 3 baris [P] (Sales Order, PO Customer, Dokumen) yang seharusnya JUGA [X] dengan pola yang SAMA persis.

## Metodologi baru — bisa diverifikasi ulang oleh siapa pun

Daftar tabel TIDAK diambil dari dokumen/ingatan. Diambil langsung dari API introspection Supabase (`GET {project_url}/rest/v1/` dengan service-role key — PostgREST mencetak setiap tabel/view di schema `public` sebagai path, setara `information_schema.tables` untuk skema yang di-expose) pada 21 Agu 2026, lalu dicocokkan ke `CREATE TABLE`/`CREATE VIEW` di `supabase/migrations/*.sql` untuk memisahkan tabel asli dari view keamanan (`*_secure`, `work_orders_readiness`).

**Hasil: 87 entitas total di schema public = 80 tabel asli + 7 view keamanan.** Sesi 5 mengklaim 72 (76 kalau baris/`_lines` dihitung terpisah) — selisih dari 80 tabel asli adalah **4 tabel** (kalau baseline dibandingkan ke 76) atau **8 tabel** (kalau ke 72), TAPI selisih riil jauh lebih besar dari itu (37 tabel tidak pernah disebut sama sekali — lihat Mekanisme A) karena banyak yang SEHARUSNYA di luar "72" itu justru pernah disinggung sepintas di teks tanpa masuk hitungan resmi. Angka "72" itu sendiri tidak pernah bisa dilacak ke satu sumber tunggal yang mekanis — kesimpulan paling jujur: angka itu adalah PERKIRAAN dari cakupan yang terasa lengkap saat itu, bukan hasil penghitungan sistematis.

## Daftar LENGKAP 80 tabel — kategori & jalur keluar

Kategori: **[E]** = baris anak (`_lines`/`_steps`) yang diedit menyatu dengan form header-nya (tidak dihitung sebagai tabel terpisah, sesuai konvensi Sesi 5 sendiri). **[LOG]** = ledger/log/snapshot append-only BY DESIGN (CLAUDE.md invarian #6/#4: traceability tidak boleh kehilangan jejak) — arsip/hapus TIDAK BERLAKU secara konsep, bukan gap. **[TX]** = dokumen transaksi bisnis (bukan master data) — di luar BATAS eksplisit Sesi 7 ("hanya master data"), dicatat supaya kelihatan, bukan disembunyikan. **[NOCRUD]** = tidak ada Buat/Ubah lewat layar sama sekali (butuh dibangun dari nol, beda kelas pekerjaan dari "tambah tombol keluar"). **[MASTER]** = tabel master data dengan Buat+Ubah tersambung layar TAPI Keluar bermasalah — **INI cakupan sisa Sesi 7**. **[OK]** = sudah lengkap (Lihat/Buat/Ubah/Keluar semua tersambung layar dengan benar).

| # | Tabel | Kategori | Lihat | Buat | Ubah | Keluar |
|---|---|---|---|---|---|---|
| 1 | `ai_answer_feedback` | [LOG] | tidak ada layar terpisah | ya (widget umpan balik) | tidak berlaku | tidak berlaku |
| 2 | `ai_capabilities` | [LOG] | ya (AiReadinessPage) | sistem (seed) | sistem (recompute) | tidak berlaku |
| 3 | `ai_capability_overrides` | [NOCRUD] | tidak ada | fungsi ada, TIDAK ADA layar (kode mati) | tidak ada | tidak ada |
| 4 | `ai_capability_requirements` | [LOG] | ya (bagian gating) | sistem (seed) | tidak ada | tidak berlaku |
| 5 | `ai_capability_status` | [LOG] | ya | sistem (recompute) | sistem (recompute) | tidak berlaku |
| 6 | `ai_project_checklist_items` | [OK] | ya | seed | ya (centang selesai) | tidak berlaku (bukan dihapus, dicentang) |
| 7 | `ai_project_phases` | [LOG] | ya | seed | tidak ada | tidak berlaku (rencana kerja tetap) |
| 8 | `ai_project_progress_snapshots` | [LOG] | ya (grafik) | otomatis | tidak berlaku | tidak berlaku |
| 9 | `ai_project_tasks` | [LOG] | ya | seed | ya (`setAiProjectTaskManualPercent`) | tidak ada (dampak kecil, alat internal tracking) |
| 10 | `attendance_corrections` | sudah tercatat [X] #18 | ya (sisi approve) | fungsi ada, TIDAK ADA form pengajuan | ya (approve/reject) | tidak berlaku |
| 11 | `attendance_devices` | sudah tercatat [X] #17 | tidak ada | otomatis (self-register) | TIDAK ADA alur approve/revoke | tidak ada |
| 12 | `attendance_events` | [LOG] | ya (rekap) | sistem/self-service | ya (koreksi via attendance_corrections) | tidak berlaku |
| 13 | `bom_lines` | [E] | menyatu `boms` | menyatu | menyatu | menyatu |
| 14 | `boms` | [MASTER] — **bug 7.4 ditemukan** | ya | ya | ya | ADA (`status=archived`) TAPI dropdown BOM di `WorkOrdersPage.tsx` TIDAK mengecualikan yang diarsipkan |
| 15 | `companies` | [MASTER] (tenant sendiri, bukan MRP produksi — perlu keputusan cakupan) | ya | ya (self-signup) | ya (`updateCompany.ts`: nama, jenis industri) | TIDAK ADA |
| 16 | `company_settings` | sudah tercatat [P][X] #7 | TIDAK ADA layar sama sekali | — | — | — |
| 17 | `customer_po_approvals` | [LOG] | ya (bagian PO) | otomatis | ya (approve/reject) | tidak berlaku |
| 18 | `customer_purchase_order_lines` | [E] | menyatu | menyatu | menyatu | menyatu |
| 19 | `customer_purchase_orders` | [TX] | ya | ya | sebagian (audit lama [P] #2, SEHARUSNYA JUGA [X]) | TIDAK ADA |
| 20 | `customers` | **[SELESAI Alur 1]** | ya (`/customers`, halaman baru) | ya | ya | ya (Hapus/Arsipkan/Pulihkan, dibangun 21 Agu 2026) |
| 21 | `delivery_confirmations` | [LOG] | ya | RPC shipment | tidak berlaku (sengaja append-only) | tidak berlaku |
| 22 | `document_access_log` | [LOG] | tidak ada layar terpisah | otomatis | tidak berlaku | tidak berlaku |
| 23 | `document_links` | [E] | menyatu `documents` | otomatis saat upload | menyatu | menyatu |
| 24 | `document_signatures` | [LOG] | ya (di Shipments) | RPC shipment | tidak ada (sengaja append-only) | tidak ada (sengaja) |
| 25 | `document_types` | [NOCRUD] | TIDAK ADA layar kelola | TIDAK ADA UI (hanya service-role) | TIDAK ADA | TIDAK ADA |
| 26 | `documents` | [TX] (dekat selesai) | ya | ya (upload) | TIDAK ADA | fungsi lengkap (`hardDeleteOrphanDocument.ts`) TAPI TIDAK ADA tombol (audit lama [P] #3, SEHARUSNYA JUGA [X]) |
| 27 | `employee_attendance` | [LOG] | ya (rekap) | otomatis (hasil hitung) | tidak berlaku | tidak berlaku |
| 28 | `employees` | [MASTER] — **perlu verifikasi 7.4** | ya | ya | ya | ADA (`is_active`) — pemakaian di dropdown Work Order SUDAH benar (filter `is_active`), TAPI belum dicek exhaustif di semua tempat lain |
| 29 | `formula_templates` | dorman, 0 dampak aktif | — | — | — | — |
| 30 | `goods_receipt_lines` | [E] | menyatu | menyatu | menyatu | menyatu |
| 31 | `goods_receipts` | [TX] | TIDAK ADA riwayat/daftar | ya | TIDAK ADA | TIDAK ADA |
| 32 | `invitations` | [MASTER] (tim/administrasi, bukan MRP produksi — perlu keputusan cakupan) | tidak ada (hanya lewat status `users`) | ya | ya (accept) | TIDAK ADA (tidak bisa membatalkan undangan salah kirim) |
| 33 | `invoices` | sesuai rencana, fase billing belum mulai | — | — | — | — |
| 34 | `items` | [MASTER] — **bug 7.4 ditemukan** | ya | ya | ya | ADA (`is_active`) TAPI dropdown item di `CustomerPurchaseOrdersPage.tsx`, `BomsPage.tsx`, `RoutingsPage.tsx` TIDAK mengecualikan yang nonaktif |
| 35 | `kamus_routing_rules` | dorman | — | — | — | — |
| 36 | `kamus_term_history` | [LOG] | ya (riwayat) | otomatis | tidak berlaku | tidak berlaku |
| 37 | `kamus_terms` | [OK] (by design — dokumentasi permanen, sengaja tidak dihapus) | ya | otomatis (generator) | ya (jawab/konfirmasi) | tidak berlaku |
| 38 | `kpi_actions` | [NOCRUD] | ya (bagian kartu KPI) | TIDAK ADA UI | TIDAK ADA UI | TIDAK ADA |
| 39 | `kpi_registry` | [MASTER] (+ gap lebih besar dari sekadar arsip — lihat audit lama [P] #4) | ya | seed | fungsi ada (`updateKpiTarget`/`updateKpiVisibility`) TIDAK tersambung layar | ADA (`is_active`) TAPI TIDAK ADA UI toggle |
| 40 | `kpi_registry_history` | [LOG] | ya (riwayat) | otomatis | tidak berlaku | tidak berlaku |
| 41 | `kpi_responsibilities` | [NOCRUD] | ya (bagian kartu KPI) | hanya via seed script | TIDAK ADA UI | TIDAK ADA |
| 42 | `kpi_snapshots` | [LOG] | ya (sparkline) | otomatis | tidak berlaku | tidak berlaku |
| 43 | `leave_requests` | sudah tercatat [X] #18 | ya (sisi approve) | fungsi ada, TIDAK ADA form pengajuan | ya (approve/reject) | tidak berlaku |
| 44 | `lot_genealogy` | [LOG] + sudah tercatat [P][I] #5 (tidak ada layar LIHAT) | TIDAK ADA layar | otomatis | tidak berlaku | tidak berlaku |
| 45 | `lots` | [LOG] — LEDGER, dikecualikan eksplisit BATAS Sesi 7 | ya | otomatis | ya (adjustment tercatat) | tidak berlaku (ledger) |
| 46 | `production_batch_bom_line_snapshots` | [LOG] | tidak langsung | otomatis (Sesi 6A) | tidak berlaku | tidak berlaku |
| 47 | `production_batch_routing_step_snapshots` | [LOG] | ya (Gantt/detail blok) | otomatis (Sesi 6A) | tidak berlaku | tidak berlaku |
| 48 | `production_batch_standard_crew_snapshots` | [LOG] | tidak langsung | otomatis (Sesi 6A) | tidak berlaku | tidak berlaku |
| 49 | `production_batches` | [TX] — LEDGER produksi, dikecualikan eksplisit BATAS Sesi 7 | ya | ya | hanya reschedule tanggal (audit lama [X] #21) | TIDAK ADA |
| 50 | `production_disruptions` | [LOG] | ya | ya (lapor) | ya (resolve) | tidak berlaku |
| 51 | `production_plants` | [NOCRUD] — sudah tercatat [X] #14 | dropdown saja, TIDAK ADA halaman master | TIDAK ADA | TIDAK ADA | TIDAK ADA |
| 52 | `production_standard_exclusions` | [LOG]/[E] menyatu alur standar | — | ya | — | — |
| 53 | `production_standard_proposals` | [OK] (usulan diputuskan, bukan dihapus) | ya | otomatis | ya (setuju/tolak) | tidak berlaku |
| 54 | `production_standard_samples` | [LOG] | — | otomatis | tidak berlaku | tidak berlaku |
| 55 | `production_standards` | sudah tercatat [I][X] #24 (gap: tidak bisa override manual) | ya | tidak langsung | TIDAK ADA fitur pin/override | TIDAK ADA |
| 56 | `purchase_order_lines` | [E] | menyatu | menyatu | menyatu | menyatu |
| 57 | `purchase_orders` | [TX] | ya | ya | TIDAK ADA (audit lama [X] #20) | TIDAK ADA |
| 58 | `routing_step_standard_crew` | [NOCRUD] — sudah tercatat [X] #13 | TIDAK ADA | TIDAK ADA | TIDAK ADA | TIDAK ADA |
| 59 | `routing_steps` | [E] | menyatu `routings` | menyatu | menyatu | menyatu |
| 60 | `routings` | **[SELESAI Sesi 7 bagian 1]** | ya | ya | ya | ya (Hapus/Arsipkan/Pulihkan, dibangun 21 Agu 2026) |
| 61 | `sales_order_line_feasibility_snapshots` | [LOG] — baseline terkunci sengaja | ya | sistem (kunci) | tidak berlaku | tidak berlaku |
| 62 | `sales_order_line_margin_snapshots` | [LOG] — baseline terkunci sengaja | ya | sistem (kunci) | tidak berlaku | tidak berlaku |
| 63 | `sales_order_lines` | [E] | menyatu | menyatu | menyatu | menyatu |
| 64 | `sales_orders` | [TX] | ya | otomatis (dari PO) | TIDAK ADA (audit lama [P] #1, SEHARUSNYA JUGA [X]) | TIDAK ADA |
| 65 | `shifts` | [NOCRUD] — sudah tercatat [X] #15 | TIDAK ADA | TIDAK ADA | TIDAK ADA | TIDAK ADA |
| 66 | `shipment_lines` | [E] | menyatu | menyatu | menyatu | menyatu |
| 67 | `shipments` | [TX] | ya | ya | ya (dispatch/delivered) | TIDAK ADA (`cancelled` cuma label — ditemukan 7.1) |
| 68 | `status_transition_log` | [LOG] | ya (riwayat) | otomatis | tidak berlaku | tidak berlaku |
| 69 | `status_transition_rules` | dorman | — | — | — | — |
| 70 | `stock_movements` | [LOG] — LEDGER, dikecualikan eksplisit BATAS Sesi 7 | ya (sebagian) | otomatis | tidak berlaku | tidak berlaku (ledger) |
| 71 | `subscription_plans` | sesuai rencana, fase billing belum mulai | — | — | — | — |
| 72 | `suppliers` | **[SELESAI Alur 1]** | ya | ya | ya | ya (Hapus/Arsipkan/Pulihkan, dibangun 21 Agu 2026) |
| 73 | `system_alerts` | [LOG] (auto-generated, hanya acknowledge) | ya | otomatis | ya (acknowledge) | tidak berlaku |
| 74 | `users` | [OK] | ya | ya (invite/accept) | ya | ya (soft, status suspended) |
| 75 | `work_centers` | [MASTER] (+ gap lebih besar: tidak bisa buat/ubah identitas — audit lama [X] #16) | ya (dropdown+dashboard) | TIDAK ADA | sebagian (kapasitas saja) | ADA (`is_active`) TAPI TIDAK ADA UI toggle |
| 76 | `work_order_assignments` | [E]/[LOG] menyatu WO | menyatu | menyatu | menyatu | menyatu |
| 77 | `work_order_consumption` | [LOG] — traceability BPOM/halal | ya | ya (catat pemakaian) | tidak berlaku | tidak berlaku |
| 78 | `work_order_outputs` | [LOG] — traceability BPOM/halal | ya | ya (catat hasil) | tidak berlaku | tidak berlaku |
| 79 | `work_order_step_progress` | [LOG] — traceability BPOM/halal | ya | ya (catat progres) | tidak berlaku | tidak berlaku |
| 80 | `work_orders` | [TX] | ya | ya | `status` tidak pernah diubah kode manapun (audit lama [I] #23, perlu klarifikasi + SEHARUSNYA JUGA masuk radar [X]) | TIDAK ADA |

## Jawaban langsung poin 3 — daftar LENGKAP tabel dengan Buat+Ubah tapi TANPA jalan keluar (bukan hanya yang [P])

Menyapu tabel di atas MEKANIS (bukan pilih-pilih) untuk baris berkategori [MASTER] atau [TX] dengan Buat=ya DAN Keluar=TIDAK ADA/bermasalah:

**Master data (di dalam BATAS "hanya master data" Sesi 7 — 5 layar sisa + 3 selesai):**
1. `routings` — **SELESAI** (Sesi 7 bagian 1).
2. `suppliers` — **SELESAI** (Alur 1, 21 Agu 2026) — CRUD lengkap + Hapus/Arsipkan/Pulihkan + daftar bahan yang dipasok (`supplier_item_prices`, tabel baru).
3. `customers` — **SELESAI** (Alur 1) — halaman baru `/customers`, CRUD lengkap + Hapus/Arsipkan/Pulihkan.
4. `boms` — kolom arsip ADA, tapi dropdown WO tidak mengecualikan yang diarsipkan (bug, bukan bangun dari nol).
5. `items` — kolom arsip ADA, tapi dropdown item di 3 layar (PO Klien, BOM, Routing) tidak mengecualikan yang nonaktif (bug baru ditemukan).
6. `employees` — kolom arsip ADA, satu titik pemakaian sudah benar, belum dicek exhaustif.
7. `work_centers` — kolom arsip ADA di database, TIDAK ADA UI toggle sama sekali.
8. `kpi_registry` — kolom arsip ADA di database, TIDAK ADA UI toggle (plus gap lebih besar: target juga tidak bisa diisi).

**Di luar BATAS "hanya master data" (dokumen transaksi — dicatat, TIDAK dibangun sesi ini kecuali diminta):**
- `sales_orders`, `customer_purchase_orders`, `shipments`, `work_orders`, `purchase_orders`, `goods_receipts`, `documents`.

**Perlu keputusan cakupan dari pemilik produk (bukan MRP produksi murni, tapi juga bukan tabel transaksi ledger):**
- `companies` (pengaturan tenant sendiri — "keluar" di sini lebih ke arah suspend/nonaktifkan akun sendiri, bukan hal yang wajar dilakukan sendiri).
- `invitations` (batalkan undangan salah kirim).

**Butuh dibangun dari nol (bukan sekadar tambah tombol keluar — CRUD dasarnya sendiri belum ada, kelas pekerjaan berbeda):**
`production_plants`, `shifts`, `routing_step_standard_crew`, `document_types`, `kpi_actions`, `kpi_responsibilities`, `company_settings`, `ai_capability_overrides` (kode mati).

---

# Audit Lubang UI — Sesi 5 (21 Agu 2026, historis — lihat catatan di atas soal keterbatasan cakupan)

Audit read-only, tanpa perubahan kode. Metodologi: untuk setiap tabel di skema (kecuali tabel sistem Supabase & tabel murni teknis/konfigurasi validasi), ditelusuri lewat `grep` langsung ke kode — apakah ada `.insert(`/`.update(`/`.delete(` yang benar-benar terhubung ke sebuah halaman (`app/**/page.tsx` → `src/features/<domain>/pages/*.tsx`), bukan cuma fungsi server yang ada tapi tidak pernah dipanggil dari layar manapun ("mati"). **72 tabel utama diperiksa** (76 kalau 4 tabel baris/`_lines` yang menyatu dengan tabel headernya dihitung terpisah) — **DIKOREKSI Sesi 7: daftar "72" ini tidak disinkronkan dari skema sungguhan, lihat bagian atas dokumen ini untuk audit lengkap 80 tabel.**

Parameter klasifikasi (persis dari pemilik produk, boleh lebih dari satu tanda per baris):
- **[P] PENTING UNTUK USER** — pekerjaan tidak bisa jalan tanpa ini
- **[I] HARUS DIINFORMASIKAN** — perlu DILIHAT untuk mengambil keputusan
- **[X] JALUR INTERAKSI** — user harus bisa create/edit/delete

---

## Jawaban Langsung — 5.7 (routing_step_standard_crew vs. durasi siklus nyata)

**Ini DUA lubang yang BERBEDA, bukan satu — satu layar standar produksi TIDAK menutup keduanya sekaligus:**

1. **`routing_step_standard_crew`** (komposisi kru standar per lini: jumlah orang, peran, jenis upah) — **TIDAK ADA jalur masuk data sama sekali**. Bukan cuma "belum ada UI" — tabel ini bahkan **tidak diisi lewat script seed manapun** (grep ke 9 file `scripts/seed-*.js` = nol hasil). Satu-satunya `INSERT` di seluruh repo ada di file test (`tests/standard_labor_cost.test.ts`), yang dihapus lagi di akhir test. **Dikonfirmasi lewat query langsung: baris untuk company_id=1 (PT ITM) = 0.** RLS di migrasinya sudah menyiapkan akses tulis untuk `ppic_manager`/`production_manager`/`hr_manager`, tapi tidak ada satu halaman/fungsi pun yang pernah dibangun untuk memakainya. Ini butuh **layar CRUD baru dari nol**.

2. **Durasi siklus nyata per tahap** (mis. mixer dari timbang sampai bubuk siap isi) — **SUDAH ADA jalur lengkap, cuma tidak dinamai "cycle time"**: waktu mulai/selesai nyata dicatat lewat layar "Progres Tahap" yang sudah ada (`recordWorkOrderStepProgress.ts`, halaman `/production`), lalu dipelajari otomatis jadi usulan standar (`learnFromBatchCore.ts`, metric `active_duration_minutes`, membuang sampel >480 menit sebagai penjagaan data backdate), dan disetujui lewat layar "Usulan Standar" yang sudah ada juga (`/ppic`). Yang **belum ada** di sini hanyalah laporan tren "durasi aktual vs standar" — bukan pencatatan datanya (data historisnya lengkap, tersimpan, dan dipakai; cuma belum ada grafik/tabel untuk melihatnya kembali). Ini penambahan **kecil** (laporan/di atas data yang sudah ada), bukan pipa pencatatan baru.

**Kesimpulan untuk Sesi 3**: perlu 2 pekerjaan terpisah — (a) layar CRUD kru standar (baru, ukuran sedang) dan (b) laporan durasi aktual vs standar (kecil, tinggal menampilkan data yang sudah terekam).

---

## Ringkasan per Domain

### Fondasi (Companies/Users/Tim)
| Tabel | View | Create | Edit | Arsip/Hapus |
|---|---|---|---|---|
| `companies` | ya (`/company`) | ya (self-signup `/register`) | ya (`updateCompany.ts`) | TIDAK ADA |
| `subscription_plans` | TIDAK ADA | TIDAK ADA | TIDAK ADA | TIDAK ADA — **sesuai rencana**: fase billing (Xendit/Midtrans) belum dimulai per CLAUDE.md, bukan gap aktif |
| `users` | ya (`/team`) | ya (invite/accept) | ya (`updateTeamMember.ts`) | soft (status suspended) |
| `document_signatures` | ya (di dalam Shipments) | ya (RPC shipment) | TIDAK ADA (sengaja, append-only) | TIDAK ADA (sengaja) |
| `invitations` | TIDAK ADA (hanya lewat status `users`) | ya (`inviteTeamMember.ts`) | ya (accept) | TIDAK ADA (tidak bisa membatalkan undangan salah kirim) |

### Master Data Produksi
| Tabel | View | Create | Edit | Arsip/Hapus |
|---|---|---|---|---|
| `production_plants` | dropdown saja, tanpa halaman master | **TIDAK ADA** | **TIDAK ADA** | **TIDAK ADA** |
| `shifts` | **TIDAK ADA** | **TIDAK ADA** | **TIDAK ADA** | **TIDAK ADA** |
| `company_settings` | **TIDAK ADA** | **TIDAK ADA** | **TIDAK ADA** | **TIDAK ADA** |
| `work_centers` | ya (dropdown + dashboard kapasitas) | **TIDAK ADA** | sebagian (kapasitas saja, bukan nama/kode) | TIDAK ADA |
| `items` | ya (`/items`) | ya | ya | ya (soft, via `is_active`) |
| `boms` | ya (`/boms`) | ya | ya | ya (status `archived`) |
| `routings` | ya (`/routing`) | ya | ya (**tanpa proteksi kalau routing sedang dipakai WO aktif**) | TIDAK ADA (kolom `status` bahkan tidak pernah dibuat di migrasi manapun — drift dokumentasi lama) |
| `routing_step_standard_crew` | **TIDAK ADA** | **TIDAK ADA** | **TIDAK ADA** | **TIDAK ADA** — lihat jawaban 5.7 |
| `formula_templates` | TIDAK ADA | TIDAK ADA | TIDAK ADA | TIDAK ADA — tabel dorman, tidak direferensikan kode manapun, tidak ada dampak aktif hari ini |
| `production_standards` | ya (di panel Kelayakan Jadwal) | tidak langsung (lahir dari alur belajar+setuju) | TIDAK ADA fitur pin/override manual | TIDAK ADA |

### Rantai Pasok & Penjualan
| Tabel | View | Create | Edit | Arsip/Hapus |
|---|---|---|---|---|
| `suppliers` | ya (`/purchasing`) | ya | **TIDAK ADA** | **TIDAK ADA** |
| `purchase_orders` | ya | ya | TIDAK ADA (kecuali transisi status otomatis saat terima barang) | TIDAK ADA |
| `goods_receipts` | **TIDAK ADA riwayat/daftar** | ya (`/warehouse`) | TIDAK ADA | TIDAK ADA |
| `customers` | hanya dropdown, **tanpa halaman daftar** | ya | **TIDAK ADA** | TIDAK ADA |
| `customer_purchase_orders` | ya | ya | hanya transisi `processed`; **status `on_hold`/`cancelled` ada LABEL-nya di layar tapi TIDAK ADA kode yang pernah menyetelnya** | TIDAK ADA |
| `sales_orders` | ya (`/sales-orders`) | otomatis (dari proses PO) | **TIDAK ADA — status tidak PERNAH berubah dari `confirmed` oleh kode manapun** | TIDAK ADA |
| `shipments` | ya | ya (wizard tanda tangan) | ya (dispatch + delivered) | TIDAK ADA (status `cancelled` cuma label) |
| `invoices` | TIDAK ADA | TIDAK ADA | TIDAK ADA | TIDAK ADA — **sesuai rencana**: fase billing belum dimulai, bukan gap aktif |

### Eksekusi Produksi & HR/Absensi
| Tabel | View | Create | Edit | Arsip/Hapus |
|---|---|---|---|---|
| `production_batches` | ya | ya | hanya reschedule tanggal | TIDAK ADA |
| `work_orders` | ya | ya | **kolom status tidak pernah diubah kode manapun — perlu klarifikasi apakah field ini sudah tidak dipakai (digantikan status batch) atau memang lubang** | TIDAK ADA |
| `employees` | ya (`/hr`) | ya | ya | ya (soft, `is_active`) |
| `attendance_devices` | TIDAK ADA | otomatis (self-register) | **TIDAK ADA alur approve/revoke HRD walau didesain di skema** | TIDAK ADA |
| `attendance_corrections` | ya (sisi approve) | fungsi+API ada, **TIDAK ADA form pengajuan di layar manapun** | ya (approve/reject) | TIDAK ADA |
| `leave_requests` | ya (sisi approve) | fungsi+API ada, **TIDAK ADA form pengajuan di layar manapun** | ya (approve/reject) | TIDAK ADA |
| `lot_genealogy` | **TIDAK ADA layar traceability** | otomatis | TIDAK ADA | TIDAK ADA |

### KPI / AI / Kamus / Dokumen
| Tabel | View | Create | Edit | Arsip/Hapus |
|---|---|---|---|---|
| `kpi_registry` | ya (`/kpi`) | ya (seed) | **fungsi `updateKpiTarget`/`updateKpiVisibility` ADA tapi tidak dipanggil dari layar manapun — target KPI tidak bisa pernah diisi lewat aplikasi** | TIDAK ADA |
| `documents` | ya (`/documents`) | ya (upload) | TIDAK ADA | **fungsi hapus (`hardDeleteOrphanDocument.ts`) sudah lengkap termasuk cek keamanan & alasan wajib, tapi TIDAK ADA tombol di layar manapun yang memanggilnya** |
| `ai_capability_overrides`, `ai_answer_feedback` | TIDAK ADA | fungsi ada, tidak tersambung route/layar (kode mati) | TIDAK ADA | TIDAK ADA |

---

## Bukti Negatif (b) — 3 Tabel "UI Lengkap" (path halaman + nama fungsi persis, bukan asumsi)

1. **`items`** — VIEW `app/(shell)/items/page.tsx` → `ItemsPage.tsx` → `listItems()`. CREATE → `createItem()` (`src/features/mrp/server/createItem.ts:46`, `.insert`). EDIT → `updateItem()` (`updateItem.ts:66`, `.update`). ARSIP → checkbox `is_active` di form edit yang sama, ditulis oleh `updateItem()` juga.
2. **`boms`** — VIEW `app/(shell)/boms/page.tsx` → `BomsPage.tsx` → `listBoms()`. CREATE → `createBom()` (`createBom.ts:64`, `.insert`). EDIT → `updateBom()` (`updateBom.ts:81`, `.update`). ARSIP → `status='archived'` lewat form edit yang sama (`BomsPage.tsx:19-30`), ditulis `updateBom()`.
3. **`employees`** — VIEW `app/(shell)/hr/page.tsx` → `HrDashboardPage.tsx` → `listEmployees()`. CREATE → `createEmployee()` (`createEmployee.ts:47`, `.insert`). EDIT → `updateEmployee()` (`updateEmployee.ts:67`, `.update`). ARSIP → checkbox `is_active` di form edit yang sama (`HrDashboardPage.tsx:685-686`), ditulis `updateEmployee()` — hapus keras memang sengaja tidak ada (FK ke riwayat penugasan/absensi).

Ketiganya diverifikasi lewat pembacaan kode langsung (bukan tebakan nama file) — create, edit, dan arsip masing-masing benar-benar menulis ke tabelnya sendiri lewat fungsi yang disebut.

---

## 5.6 — Tulis Tanpa Jejak Siapa/Kapan/Kenapa (klasifikasi [P], temuan lanjutan Sesi 0C)

Pelajaran Sesi 0/0B/0C: yang berbahaya bukan cuma data tanpa layar, tapi juga perubahan tanpa jejak. Ditemukan lewat pembacaan langsung tiap fungsi insert/update (bukan dugaan):

| Kelompok | Tabel & aksi | Kenapa berbahaya |
|---|---|---|
| **SDM/Payroll paling sensitif** | `employees` (create/edit `wage_rate`, BPJS, PTKP — tidak ada kolom `created_by`/`updated_by` sama sekali) | Siapa pun yang berhasil masuk dengan `canManageHr` bisa mengubah gaji karyawan tanpa jejak siapa yang mengubah |
| **Eskalasi operasional** | `production_disruptions` create/resolve (tidak ada `created_by`/`resolved_by`) | Gangguan yang bisa mem-blokir seluruh pabrik tidak tercatat siapa yang melaporkan/menutupnya |
| **Transaksi inti** | `suppliers`, `purchase_orders`, `customers`, `customer_purchase_orders` (create — tidak ada `created_by`), `sales_orders` (lahir otomatis, tidak ada `created_by`) | Order/data mitra bisa dibuat tanpa jejak siapa yang menginput, kalau butuh audit "siapa yang input PO ini" — tidak bisa dijawab sistem |
| **Transisi pengiriman** | `shipments` status draft→shipped (`processShipmentDispatch.ts`, tidak ada kolom `dispatched_by`/`shipped_at`) dan shipped→delivered (`updateShipmentStatus.ts`, tidak ada `delivered_by`/`delivered_at`) | Perpindahan status pengiriman fisik (bukti sudah dimuat truk / sudah sampai) tidak tercatat siapa staf yang menekannya |
| **Traceability produksi** | `lot_genealogy` insert (tidak ada kolom aktor sama sekali), `work_order_step_progress` insert/update (tidak ada kolom aktor sama sekali), `work_order_outputs`/`work_order_consumption` insert (tidak ada `recorded_by`), `work_orders`/`production_batches` insert (tidak ada `created_by`) | Ini justru tulang punggung traceability BPOM/halal yang menurut CLAUDE.md wajib — tapi siapa yang mencatat progres tahap/output/konsumsi tidak terekam sama sekali |
| **Data salah label (bukan cuma hilang, tapi keliru)** | `attendance_events` — jalur tutup-otomatis (`closeStaleOpenAttendanceDays.ts`) menyisipkan event dengan `method='MANUAL_HRD'` dan `recorded_by=null` — seolah HRD yang menutup manual, padahal sistem yang menutup otomatis | Kalau ada audit ketenagakerjaan/BPJS, catatan ini MENYESATKAN soal siapa yang bertanggung jawab menutup absensi |

`companies`/`users` juga tidak punya kolom `created_by`/`updated_by` sama sekali secara struktural — ini disebut terpisah karena levelnya berbeda (kolom itu memang tidak pernah dirancang ada), bukan "lupa mengisi" seperti baris-baris di atas.

---

## Ringkasan Akhir — Urutan [P] → [X] → [I]

| # | Lubang | Tag | Dampak Bisnis | Perkiraan Besar |
|---|---|---|---|---|
| 1 | Sales Order tidak pernah berubah status lewat aplikasi (`sales_orders`) | [P] | SO akan tampak "confirmed" selamanya di sistem walau produksi & pengiriman sudah tuntas semua, membuat laporan/status order tidak bisa dipercaya | Sedang |
| 2 | PO Customer tidak bisa ditunda/dibatalkan walau tombolnya sudah ada di layar (`customer_purchase_orders`) | [P] | Order bermasalah (customer minta tunda/batal) mengendap selamanya berstatus "baru" karena tidak ada kode yang benar-benar menjalankan aksinya | Sedang |
| 3 | Hapus dokumen sudah lengkap di backend tapi tombolnya tidak dipasang (`documents`) | [P] | Dokumen salah upload/kadaluarsa tidak bisa dihapus lewat aplikasi — padahal logic keamanan & alasan wajib sudah selesai dibangun, tinggal sambung tombol | Kecil |
| 4 | Target KPI tidak pernah bisa diisi lewat aplikasi (`kpi_registry`) | [P] | Seluruh desain KPI mengandalkan "baseline dulu, target menyusul", tapi tombol pengisi target tidak tersambung — KPI selamanya tanpa target walau baseline sudah cukup lama terkumpul | Kecil |
| 5 | Tidak ada layar traceability lot (`lot_genealogy`) | [P][I] | Kalau BPOM/auditor halal minta bukti asal-usul sebuah lot produk jadi, datanya ada di database tapi tidak ada satu layar pun untuk menampilkannya — harus query manual | Sedang |
| 6 | Routing bisa diedit langsung walau sedang dipakai Work Order aktif, tanpa peringatan (`routings`) | [P] | Mengubah routing yang sedang berjalan bisa diam-diam mengubah dasar hitungan biaya batch yang sedang diproduksi, tanpa ada yang tahu | Sedang |
| 7 | Tidak ada layar pengaturan tenant (`company_settings`) | [P][X] | Kalau tarif BPJS pemerintah naik atau tanggal mulai periode gajian berubah, tidak ada satu tombol pun di aplikasi untuk menyesuaikannya — wajib ubah database langsung tiap kali | Sedang |
| 8 | Tulis tanpa jejak — SDM/Payroll (`employees`) | [P] | Perubahan gaji/BPJS/PTKP karyawan tidak tercatat siapa yang mengubah | Kecil (tambah kolom + isi otomatis) |
| 9 | Tulis tanpa jejak — transaksi inti (`suppliers`,`purchase_orders`,`customers`,`customer_purchase_orders`,`sales_orders`) | [P] | Tidak bisa dijawab "siapa yang menginput order/data mitra ini" kalau dibutuhkan audit | Kecil-Sedang |
| 10 | Tulis tanpa jejak — transisi pengiriman (`shipments`) | [P] | Siapa yang menandai barang "sudah dimuat"/"sudah sampai" tidak terekam | Kecil |
| 11 | Tulis tanpa jejak — traceability produksi (`lot_genealogy`,`work_order_step_progress`,`work_order_outputs`,`work_order_consumption`,`work_orders`,`production_batches`) | [P] | Tulang punggung traceability BPOM/halal tidak merekam siapa yang mencatat progres/output/konsumsi | Sedang |
| 12 | Absensi tutup-otomatis salah label sebagai "manual HRD" (`attendance_events`) | [P] | Kalau ada audit ketenagakerjaan, catatan menyesatkan soal siapa yang menutup absensi — sistem otomatis tercatat seolah keputusan HRD | Kecil (perbaiki label method) |
| 13 | `routing_step_standard_crew` tidak punya jalur masuk data sama sekali | [X] | Standar SDM per lini (dipakai hitung biaya SDM standar tiap batch) hanya bisa diisi lewat perintah database langsung — kalau komposisi kru berubah, biaya SDM standar di Margin Watch diam-diam salah sampai developer turun tangan. **Dikonfirmasi: 0 baris untuk PT ITM saat ini** | Sedang |
| 14 | `production_plants` tidak punya CRUD sama sekali | [X] | Buka/tutup pabrik baru wajib lewat migrasi SQL manual — sistem tidak bisa mengikuti tanpa keterlibatan developer | Sedang |
| 15 | `shifts` sepenuhnya tak terlihat, tanpa UI | [X] | Jadwal shift kerja hanya bisa diubah lewat database — HR tidak bisa menyesuaikan jam shift produksi sendiri | Sedang |
| 16 | `work_centers` tidak bisa dibuat/diubah identitasnya (hanya kapasitas) | [X] | Menambah lini produksi baru atau mengubah namanya wajib lewat script developer | Sedang |
| 17 | `attendance_devices` tidak ada alur approve/revoke | [X] | Kalau karyawan ganti HP, perangkat baru macet permanen di status "menunggu persetujuan" tanpa cara HRD menyetujuinya | Sedang |
| 18 | `attendance_corrections`/`leave_requests` tidak ada form pengajuan | [X] | Karyawan tidak bisa mengajukan koreksi absen atau cuti lewat aplikasi sama sekali — hanya sisi persetujuan HRD yang ada | Kecil-Sedang |
| 19 | `suppliers`/`customers` tidak bisa diedit | [X] | Kontak/lead time supplier atau data pelanggan yang berubah tidak bisa diperbarui — datanya jadi basi permanen | Kecil |
| 20 | `purchase_orders` tidak bisa dikoreksi/dibatalkan | [X] | PO salah ketik jumlah/harga tidak bisa diperbaiki lewat aplikasi, satu-satunya jalan adalah menerima barangnya dulu lalu menghitung selisih di luar sistem | Sedang |
| 21 | `production_batches` hanya bisa reschedule tanggal, field lain tidak bisa diedit | [X] | Kesalahan input rencana batch tidak bisa dikoreksi kecuali tanggalnya | Sedang |
| 22 | Laporan traceability/riwayat stok tidak ada (`stock_movements`, `goods_receipts`) | [I] | Investigasi selisih stok atau "siapa menerima barang ini kapan" tidak punya layar, harus ditelusuri manual lewat lot | Kecil |
| 23 | `work_orders.status` tidak pernah diperbarui kode manapun | [I] (perlu klarifikasi) | Kalau ada laporan yang bergantung ke kolom ini (bukan status batch di dalamnya), datanya akan selalu terbaca "planned" — perlu dikonfirmasi apakah field ini memang sudah digantikan status batch atau ini lubang nyata |
| 24 | `production_standards` tidak bisa di-pin/override manual | [I][X] | Kalau PPIC tahu standar hasil belajar otomatis sudah usang, tidak ada cara mengunci angka manual — harus menunggu batch baru terkumpul | Sedang |
| 25 | Fungsi kode sudah ada tapi tidak tersambung ke layar manapun (`ai_capability_overrides`, `ai_answer_feedback`, `setAiProjectTaskManualPercent`) | [I] | Kemampuan override manual sudah dikodekan tapi tidak bisa dipakai siapa pun — prioritas rendah karena jalur otomatisnya tetap jalan | Kecil (tinggal sambung) |

**Jumlah [P]: 12** (di bawah ambang 15 — tidak memicu kondisi STOP).

---

## Koreksi 7.1 (Sesi 7, 21 Agu 2026) — SUPERSEDED, lihat bagian paling atas dokumen ini

Koreksi awal 7.1 (5 tabel + 3 baris [P] yang seharusnya [X]) sudah ditulis ulang jadi audit lengkap 80-tabel berbasis introspection skema sungguhan — lihat "Audit Lengkap Tabel — Sesi 7" di paling atas dokumen ini untuk penjelasan mekanisme lengkap (kenapa 5 tabel ini lolos) dan daftar definitif seluruh tabel yang masih kurang jalan keluar. Bagian ini sengaja dibiarkan sebagai jejak sejarah (koreksi pertama, sebelum audit ulang penuh), bukan dihapus.

**Tabel dorman tanpa dampak aktif** (dicatat, bukan diklasifikasi P/I/X karena tidak ada kode lain yang bergantung padanya hari ini): `formula_templates`, `status_transition_rules`, `kamus_routing_rules`. **Sesuai rencana roadmap, bukan gap aktif**: `subscription_plans`, `invoices` (fase billing belum dimulai per CLAUDE.md).
