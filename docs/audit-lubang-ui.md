# Audit Lubang UI — Sesi 5 (21 Agu 2026)

Audit read-only, tanpa perubahan kode. Metodologi: untuk setiap tabel di skema (kecuali tabel sistem Supabase & tabel murni teknis/konfigurasi validasi), ditelusuri lewat `grep` langsung ke kode — apakah ada `.insert(`/`.update(`/`.delete(` yang benar-benar terhubung ke sebuah halaman (`app/**/page.tsx` → `src/features/<domain>/pages/*.tsx`), bukan cuma fungsi server yang ada tapi tidak pernah dipanggil dari layar manapun ("mati"). **72 tabel utama diperiksa** (76 kalau 4 tabel baris/`_lines` yang menyatu dengan tabel headernya dihitung terpisah).

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

## Koreksi 7.1 (Sesi 7, 21 Agu 2026) — aturan "buat & ubah tanpa jalan keluar wajib [X]" ditegakkan ulang

Baris #6 di atas (routing bisa diedit tanpa peringatan) LOLOS dari klasifikasi [X] karena membahas masalah BERBEDA (mengedit routing yang sedang dipakai WO aktif — sudah diperbaiki Sesi 6A lewat snapshot) — bukan soal TIDAK ADANYA tombol hapus/arsip sama sekali, yang merupakan keluhan asli pemilik produk yang memicu Sesi 7. Setelah aturan "bisa buat & ubah tapi tidak bisa mengeluarkan data → WAJIB [X]" ditegakkan ulang secara konsisten ke seluruh temuan:

- **5 tabel yang seharusnya [X] tapi tidak pernah masuk daftar sama sekali**: `routings` (kasus yang dilaporkan — **DISELESAIKAN Sesi 7**, lihat HANDOFF.md), `companies`, `invitations`, `shipments`, `work_orders`. 4 yang terakhir BELUM dikerjakan (di luar cakupan master-data Sesi 7 — lihat BATAS sesi itu — atau memerlukan keputusan terpisah).
- **3 baris [P] yang seharusnya JUGA diberi tag [X]** karena isinya persis "bisa buat, tidak bisa keluar": #1 (`sales_orders`), #2 (`customer_purchase_orders`), #3 (`documents`) — belum dikerjakan, di luar cakupan master-data Sesi 7.

**Tabel dorman tanpa dampak aktif** (dicatat, bukan diklasifikasi P/I/X karena tidak ada kode lain yang bergantung padanya hari ini): `formula_templates`, `status_transition_rules`, `kamus_routing_rules`. **Sesuai rencana roadmap, bukan gap aktif**: `subscription_plans`, `invoices` (fase billing belum dimulai per CLAUDE.md).
