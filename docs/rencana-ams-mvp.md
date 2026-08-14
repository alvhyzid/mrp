# AMS-MVP.01 (Advanced Manufacturing System) — Peta Fitur & Rencana Kerja

Dokumen ini memetakan fitur Advanced Planning & Scheduling (APS) versi LENGKAP (seperti PlanetTogether, sudah dikembangkan puluhan tahun oleh tim khusus), membandingkannya dengan yang sudah kita bangun, dan menyusun rencana kerja realistis untuk lapisan penjadwalan MVP kita — bagian dari **AMS-MVP.01**, sistem yang cakupannya sudah lebih luas dari MRP sempit (lihat Bagian 0).

---

## Bagian 0: Kita Sebenarnya Sudah Membangun Gabungan ERP + MRP + MES

Sebelum masuk ke perbandingan APS, penting dipahami dulu: proyek ini **bukan cuma MRP**. Berikut pemetaan tabel resmi (ERP/MRP/MES/Excel/APS, masing-masing "menyelesaikan bagian berbeda dari masalah perencanaan manufaktur") terhadap yang sudah kita bangun:

| Kategori Sistem | Peran Utama | Yang Sudah Kita Bangun |
|---|---|---|
| **ERP** (data bisnis: order, purchasing, finansial) | Kelola order, inventory, purchasing, finansial, catatan bisnis | `customer_purchase_orders`, `purchase_orders`, `invoices`, `customers`, `suppliers`, `sales_orders`, `shipments`, approval 3 department, kalkulasi margin, multi-tenant + role 16 level |
| **MRP** (kebutuhan material) | Hitung kebutuhan material & supply/demand | `items`, `boms`, `bom_lines`, `lots`, `reorder_point`/`reorder_qty`, `stock_depletion_forecast`, `goods_receipts` |
| **MES** (eksekusi shop-floor) | Lacak eksekusi shop-floor, status produksi, performa aktual | `work_orders`, `production_batches`, `work_order_step_progress`, `work_order_consumption`, `work_order_outputs`, `work_order_assignments`, `production_disruptions`, laporan real-time per-shift |
| **Excel** (fleksibilitas manual) | Kontrol manual perencana atas perubahan jadwal | Override manual (status `paused`, `priority`, reschedule), catatan/`notes` di banyak tabel |
| **APS** (lapisan penjadwalan constraint-aware) | Tunjukkan apa yang REALISTIS bisa dikerjakan, kapan, dan constraint apa yang menghalangi | **Sebagian**: mekanisme "Ready to Start/Blocked" (Bagian 2 di bawah) — sisanya jadi fokus rencana kerja MVP ini |

**Kesimpulannya:** AMS-MVP.01 sudah punya fondasi ERP+MRP+MES yang solid — bagian yang masih tipis & jadi fokus pengembangan berikutnya adalah lapisan **APS** (penjadwalan constraint-aware, visibilitas kapasitas). Sisa dokumen ini fokus ke situ.

---

## Bagian 1: Fitur APS Lengkap (Versi Sempurna/Kompleks)

### A. Perencanaan Kapasitas & Sumber Daya
- Penjadwalan kapasitas FINITE (menghormati batas nyata mesin/tenaga kerja/alat, bukan asumsi kapasitas tak terbatas)
- Pemodelan constraint multi-sumber daya sekaligus (mesin, kru, alat, cetakan/molding, fixture)
- Kalender per sumber daya (pola shift, jadwal maintenance, hari libur per mesin/orang)
- Pencocokan tenaga kerja berbasis skill (pekerja yang tepat untuk tugas yang tepat, berdasar sertifikasi/keahlian)

### B. Penjadwalan & Pengurutan
- Algoritma optimasi/pengurutan otomatis (minimalkan changeover, maksimalkan throughput)
- Matriks waktu changeover/setup (berapa lama mesin butuh "ganti setelan" dari Produk A ke B)
- Optimasi multi-tujuan (menyeimbangkan ketepatan waktu vs biaya vs utilisasi mesin)
- Drag-and-drop manual dengan kalkulasi ulang otomatis ke seluruh jadwal terkait
- Penjadwalan maju & mundur (dari tanggal mulai ke depan, ATAU dari tenggat mundur ke belakang)
- Saran rute/mesin alternatif otomatis (kalau Mesin A sibuk, sarankan Mesin B)

### C. Manajemen Constraint & Bottleneck
- Identifikasi otomatis sumber daya penghambat (bottleneck) di seluruh pabrik
- Propagasi constraint real-time (ubah 1 hal, lihat efek berantai ke seluruh jadwal)
- Pengecekan gabungan bahan + kapasitas + tenaga kerja sekaligus

### D. Simulasi What-If
- Kloning skenario/sandbox (uji perubahan jadwal tanpa benar-benar diterapkan)
- Perbandingan skenario berdampingan (bandingkan KPI antar skenario)
- Simulasi dampak order mendesak
- Simulasi dampak gangguan (misal: bagaimana kalau mesin ini mati 2 hari?)

### E. Visibilitas & Analitik
- Gantt chart/timeline visual lintas semua sumber daya
- Dashboard real-time (kepatuhan jadwal, metrik ala OEE)
- Dashboard eksekutif
- Laporan akar masalah/pengecualian

### F. Integrasi
- Integrasi ERP (data order, inventory, routing masuk otomatis)
- Integrasi shop-floor/MES (status produksi real-time memicu penjadwalan ulang)
- Integrasi platform supply chain

### G. Fitur AI/Lanjutan (APS modern)
- Peramalan permintaan berbasis AI/ML yang memengaruhi jadwal
- Integrasi predictive maintenance (hindari jadwalkan produksi di mesin yang berisiko rusak)
- Auto-replanning otomatis dipicu kejadian shop-floor real-time

---

## Bagian 2: Perbandingan dengan yang Sudah Kita Punya

| Kategori | Fitur APS Lengkap | Status Kita | Keterangan |
|---|---|---|---|
| **A. Kapasitas** | Penjadwalan kapasitas finite | ❌ Belum | Belum ada pengecekan "mesin ini sudah penuh terjadwal" |
| | Constraint multi-sumber daya | ⚠️ Sebagian | `work_centers` ada, tapi belum ada deteksi konflik otomatis |
| | Kalender per sumber daya | ⚠️ Sebagian | `shifts` ada, belum ada jadwal maintenance/libur per mesin |
| | Skill-based labor matching | ❌ Belum | `employees.position` ada, belum ada pencocokan skill ke tugas |
| **B. Penjadwalan** | Algoritma optimasi otomatis | ❌ Belum | Kompleksitas tinggi, di luar skala MVP |
| | Matriks changeover time | ❌ Belum | Data waktu ganti setelan belum pernah dicatat |
| | Optimasi multi-tujuan | ❌ Belum | Butuh algoritma di atas |
| | Drag-drop + kalkulasi ulang otomatis | ❌ Belum | Reschedule sekarang manual, tanpa efek berantai otomatis |
| | Penjadwalan maju & mundur | ⚠️ Sebagian | Ada `scheduled_start/end`, belum ada kalkulasi mundur dari tenggat |
| | Saran rute/mesin alternatif | ❌ Belum | |
| **C. Constraint & Bottleneck** | Identifikasi bottleneck otomatis | ❌ Belum | |
| | Propagasi constraint real-time | ✅ **Sudah, versi sederhana** | Mekanisme "Ready to Start/Blocked" kita PERSIS ini — otomatis deteksi bahan/SDM/mesin bermasalah |
| | Cek gabungan bahan+kapasitas+SDM | ✅ **Sudah** | `system_alerts` mencakup ketiganya sekaligus |
| **D. What-If** | Simulasi skenario | ❌ Belum sama sekali | Konsep sandbox/skenario belum ada |
| **E. Visibilitas** | Gantt chart visual | ❌ Belum | Kita masih tampilan tabel/list, bukan timeline |
| | Dashboard real-time | ✅ **Sudah, cukup lengkap** | Dashboard per-department + alert sudah jalan |
| | Dashboard eksekutif | ✅ **Sudah** | Dashboard ringkasan company_admin/general_manager |
| | Laporan pengecualian | ✅ **Sudah** | `system_alerts` mencakup ini |
| **G. AI/Lanjutan** | Peramalan permintaan AI | ❌ Belum | |
| | Proyeksi stok otomatis | ✅ **Sudah, versi sederhana** | `stock_depletion_forecast`/`expiry_risk_low_usage` — bentuk ringan dari "prediktif" |

**Kesimpulan jujur:** kita sudah punya fondasi **Constraint-awareness** dan **Visibilitas** yang cukup solid (bagian C & E) — ini justru dua area yang biasanya paling susah dibangun. Yang benar-benar kosong: **Penjadwalan otomatis/optimasi (B)** dan **Simulasi What-If (D)** — dua-duanya butuh algoritma matematis kompleks, di luar skala realistis MVP.

---

## Bagian 3: Rencana Kerja Lapisan APS untuk AMS-MVP.01

Prinsip: ambil **manfaat** APS (visibilitas kapasitas, kemudahan reschedule) tanpa **kompleksitas** APS (algoritma optimasi otomatis). Manusia (PPIC) tetap yang memutuskan, sistem cuma kasih informasi & alat yang lebih baik.

### Dikerjakan di MVP 0.1 (urutan prioritas)

**1. Dashboard Kapasitas per Work Center**
Tampilan sederhana: mesin ini terjadwal berapa jam minggu ini, dari total jam tersedia berapa. Murni laporan dari data yang sudah ada (`production_batches` + `work_centers`), bukan algoritma baru.
- *Perlu tambahan skema:* `work_centers` butuh kolom kapasitas (mis. `capacity_hours_per_day`) supaya persentase utilisasi bisa dihitung.

**2. Tampilan Gantt/Timeline Visual**
Work Order & Batch ditampilkan sebagai balok waktu, dikelompokkan per Work Center — PPIC bisa LIHAT langsung siapa/apa yang terjadwal kapan, tanpa harus buka banyak tabel.

**3. Drag-and-Drop Reschedule Manual**
Di atas Gantt yang sama — PPIC geser balok untuk ubah jadwal (`scheduled_start`/`scheduled_end` batch/WO ter-update). Manusia yang "mengoptimasi" dibantu visual jelas, bukan mesin.

**4. Alert Kapasitas Berlebih (perluasan `system_alerts`)**
Jenis alert baru: `work_center_overbooked` — otomatis muncul kalau total jam terjadwal di 1 Work Center melebihi kapasitasnya di periode yang sama.

**5. Bantuan Penjadwalan Mundur (sederhana)**
Diberi tenggat kirim (dari SO), sistem hitung mundur pakai total durasi routing (termasuk waktu tunggu seperti curing/bloom) untuk SARANKAN kapan harus mulai — murni matematika tanggal, bukan algoritma optimasi.

**6. Laporan Bottleneck Sederhana**
Laporan mingguan: Work Center mana dengan utilisasi tertinggi minggu ini — dihitung dari data yang sudah ada di poin 1, disajikan sebagai insight, bukan rekomendasi otomatis.

### SENGAJA Ditunda (di luar MVP 0.1)

| Fitur | Alasan Ditunda |
|---|---|
| Algoritma optimasi/pengurutan otomatis | Masalah computer science kompleks (constraint programming/heuristik) — butuh keahlian & waktu di luar skala solo-project |
| Matriks changeover time & optimasinya | Butuh data waktu ganti setelan per pasangan produk, belum pernah dicatat — kumpulkan datanya dulu lewat `production_disruptions`/observasi lapangan sebelum bisa dioptimasi |
| Simulasi What-If/sandbox | Butuh fondasi Gantt & data historis dulu, baru bisa dibangun bermakna |
| Skill-based labor matching | Butuh data skill/sertifikasi per karyawan yang belum kita rancang |
| Peramalan permintaan AI/ML | Butuh riwayat data penjualan yang cukup panjang dulu (sama seperti alasan kita tunda prediksi keterlambatan berbasis ML jauh sebelumnya) |

---

## Catatan Penamaan Proyek

Project ini sekarang bernama **AMS-MVP.01** (Advanced Manufacturing System) — nama ini dipilih karena lebih akurat mewakili cakupan sebenarnya (gabungan ERP+MRP+MES, dengan lapisan APS yang terus dikembangkan), bukan cuma "MRP" atau "APS" saja. Perlu diperbarui di `CLAUDE.md` (judul/deskripsi proyek).
