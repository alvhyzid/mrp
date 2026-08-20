# KPI Perusahaan Manufaktur — Katalog, Analisis Kesenjangan & Rencana Kerja

**Sumber kajian:** 3 cheat sheet KPI manufaktur + Zebra BI KPIs Cheat Sheet (unggahan
pemilik produk, Agu 2026), dipetakan terhadap kondisi nyata sistem per laporan 18 Agu.
**Prinsip pemetaan:** hanya KPI yang relevan untuk contract manufacturer pangan/suplemen
skala AMS. KPI korporasi besar (ROE, EBITDA, inovasi, media) sengaja dilewati.

---

## 1. Empat komponen yang membuat angka menjadi KPI (bukan sekadar metrik)

Dari anatomi KPI di cheat sheet #1 — sebuah KPI wajib punya:
**target terukur + rentang waktu + sumber data + frekuensi lapor + PEMILIK.**

Konsekuensi desain untuk AMS:
1. **Definisi & rumus KPI hidup di kamus metrik** (scope METRIC di modul Kamus) — satu
   sumber kebenaran yang sama untuk UI, laporan, dan AI. Tidak ada rumus kedua di kode UI.
2. **Registry KPI** menyimpan sisanya: target, ambang, frekuensi, pemilik (role), dan
   status aktif per tenant.
3. **Kartu KPI adalah komponen ber-provenance** (aturan D0) — setiap angka KPI bisa
   diklik sampai ke baris sumbernya, dan kelak bisa dijatuhi pin Drop-AI.
4. Nilai historis disimpan sebagai **snapshot** (menyatu dengan kebiasaan KPI-baseline
   Fase 0.5 — satu tabel, dua kegunaan).

## 2. Aturan visual (diadopsi dari panduan Zebra BI, berlaku untuk semua kartu/grafik KPI)

**Pakai:** bar chart, line chart, bullet chart (nilai vs target), sparkline pada kartu,
small multiples untuk membandingkan produk/lini, waterfall untuk penguraian biaya.
**Dilarang:** pie chart, grafik 3D, latar gelap dekoratif, sumbu yang tidak mulai dari
nol (menyesatkan tren), grafik penuh sesak, gridline berlebihan.
Bentuk kartu KPI standar: **nilai kini + target + delta vs periode lalu + sparkline.**

---

## 3. Katalog & status — KPI manufaktur yang relevan

Kategori status:
- **A = SIAP** — data & perhitungan sudah ada; tinggal kartu/visual
- **B = SUMBER ADA** — data tercatat, rumus/agregasi KPI belum dibuat
- **C = BUTUH PENCATATAN BARU** — sumber datanya belum ada di sistem
- **D = LEWATI/TUNDA SADAR** — tidak relevan untuk model bisnis/skala sekarang

### 3.1 Finansial & biaya

| KPI | Arti & manfaat | Status | Sumber |
|---|---|---|---|
| **Margin kontribusi per order/produk** | Harga jual − biaya variabel (bahan+kemasan+SDM langsung). Menjawab "order ini layak?" — dasar nego harga | **A** | Mesin margin (lulus 4/4 test) |
| **Biaya produksi per unit** | Total biaya ÷ unit jadi. Dasar quotation & deteksi kenaikan biaya diam-diam | **A** | Mesin margin + biaya lot |
| **Laba operasional bulanan** | Σ kontribusi − overhead bulanan. Kesehatan perusahaan sesungguhnya (aturan K2 dua tingkat) | **A** | Mesin margin + overhead |
| **Nilai persediaan** | Total nilai lot berjalan. Uang yang "tidur" di gudang | **A** | Valuasi lot (Rp233jt tercatat) |
| Inventory turnover & DIO | COGS ÷ rata-rata persediaan; berapa hari stok mengendap. Deteksi modal terjebak & bahan mati | **B** | COGS dari margin + nilai lot harian (butuh snapshot harian) |
| Cash-to-cash, ROA/ROE/EBITDA | Butuh pembukuan penuh (AR/AP/aset) di luar lingkup sistem | **D** | — (wilayah software akuntansi) |

### 3.2 Produksi & produktivitas

| KPI | Arti & manfaat | Status | Sumber |
|---|---|---|---|
| **Yield per tahap & per produk** | Output baik ÷ input. Deteksi tahap boros; dasar standar K8 | **A** | Batch records + K8 |
| Production attainment / schedule adherence | Aktual ÷ rencana produksi. "Janji internal kita tepati tidak?" — pendamping alami deteksi feasibility yang sudah ada | **B** | Jadwal batch + realisasi |
| Capacity utilization | Output aktual ÷ kapasitas standar. Kapan perlu shift/mesin tambahan | **B** | Realisasi + standar K8 (4 batch/hari → DIPELAJARI) |
| Labour productivity | Output ÷ jam kerja tercatat. Menilai dampak perbaikan proses | **B** | Labor log (fitur baru) |
| Cycle time order→kirim | Hari nyata dari PO masuk sampai kirim. Janji lead time berbasis bukti | **B** | `status_transition_log` (= process mining 0.4) |
| Throughput per lini | Unit ÷ waktu produksi berjalan | **B** | Batch records |
| Downtime % + Pareto penyebab | Jam henti ÷ jam rencana, terurai per penyebab. Perbaikan paling berdampak per rupiah | **B** | Log downtime (disiplin klasifikasi = prasyarat) |
| Changeover time (SMED) | Waktu ganti produk antar batch. Relevan saat produk makin beragam | **C→murah**: tambahkan `CHANGEOVER` sebagai kategori downtime saat pilot — KPI-nya jadi gratis nanti | — |
| **OEE** | Availability × Performance × Quality per mesin. KPI paling terkenal — dan paling sering dihitung bohong-bohongan | **C (OEE-lite di B)** | Lihat §5 — peringatan khusus |
| Takt time | Irama produksi mengikuti permintaan — relevan untuk lini rakit kontinu, kurang bermakna untuk batch contract-manufacturing | **D** | — |

### 3.3 Kualitas

| KPI | Arti & manfaat | Status | Sumber |
|---|---|---|---|
| Rejection/scrap % | Qty ditolak/terbuang ÷ produksi. Biaya kualitas yang terlihat | **B** | NCR + batch output + sisa (K7) |
| First Pass Yield | Unit baik TANPA rework ÷ total. Lebih jujur dari yield biasa — rework menyembunyikan masalah | **B** | Batch + flag rework (perlu ditambah di pencatatan) |
| Customer reject/return rate | Penolakan oleh pelanggan ÷ terkirim. KPI reputasi | **B** | NCR tipe klaim + shipments |
| Supplier defect rate | Bahan bermasalah ÷ kedatangan per supplier. Dasar seleksi supplier | **B** | NCR incoming + goods receipt |
| Cost of Quality penuh (COQ) | Pencegahan+penilaian+kegagalan. Berguna, tapi butuh pembukuan biaya QC terpisah | **D (v2)** | — |

### 3.4 Pengiriman & persediaan

| KPI | Arti & manfaat | Status | Sumber |
|---|---|---|---|
| **On-Time Delivery (OTD)** | Kiriman tepat waktu ÷ total. KPI yang PALING dilihat pelanggan contract manufacturer | **B** | Shipments + tanggal janji SO |
| OTIF / Perfect Order | Tepat waktu × lengkap × tanpa cacat × dokumen benar. Versi ketat OTD | **B (v2)** | Shipments + POD + NCR |
| Fill rate / order fulfilment | Order terpenuhi penuh ÷ total | **B** | SO vs shipments |
| Stock-out events | Kejadian bahan habis saat dibutuhkan. Sudah setengah jadi: mesin kekurangan bahan SAS001/005 sudah menghitungnya — tinggal dicatat sebagai event | **B** | Shortage engine |
| Inventory accuracy | Hasil opname cocok ÷ total dihitung. Kejujuran angka stok | **B** | Fitur opname (saldo awal sudah ada) |
| Supplier OTD | Kedatangan sesuai janji ÷ total PO. Data untuk nego & seleksi | **B** | PO promised vs receipt date |

### 3.5 Pemeliharaan, SDM & keselamatan

| KPI | Arti & manfaat | Status | Sumber |
|---|---|---|---|
| MTBF / MTTR / PM compliance | Keandalan mesin & kecepatan perbaikan | **C** | Butuh modul maintenance (belum ada — sadar) |
| Absenteeism rate | Ketidakhadiran ÷ total. Input kapasitas harian | **C→B setelah modul absensi** | Rancangan absensi sudah dibuat |
| Employee turnover, training hours | Kesehatan SDM | **C (v2)** | — |
| TRIR / LTIFR / near-miss | Keselamatan kerja — wajib secara moral & audit klien besar | **C** | Butuh pencatatan insiden K3 (modul kecil, layak v1.1) |
| Energy per unit | Efisiensi energi | **D** (butuh meteran) | — |

---

## 4. Paket awal — 12 KPI pertama (jangan bangun 60)

Dipilih karena: terhubung ke keputusan nyata, datanya ada/tinggal rumus, dan mewakili
empat sudut pandang (uang, produksi, kualitas, pengiriman).

| # | KPI | Pemilik | Frekuensi | Kategori |
|---|---|---|---|---|
| 1 | Margin kontribusi per order | Finance | per order + bulanan | A |
| 2 | Biaya per unit per produk | Finance | bulanan | A |
| 3 | Laba operasional bulanan | Pemilik | bulanan | A |
| 4 | Yield per tahap per produk | SPV Produksi | per batch + mingguan | A |
| 5 | Nilai persediaan | Gudang/Finance | harian | A |
| 6 | OTD | PPIC/Sales | per kiriman + bulanan | B |
| 7 | Production attainment | PPIC | harian | B |
| 8 | Downtime % + Pareto | SPV Produksi | mingguan | B |
| 9 | Rejection/scrap % | QC | mingguan | B |
| 10 | Cycle time order→kirim | PPIC | bulanan | B |
| 11 | Stock-out events | Gudang/Purchasing | kejadian + bulanan | B |
| 12 | Supplier OTD | Purchasing | bulanan | B |

Target awal tiap KPI: **baseline dulu, target kemudian.** Dua bulan pertama nilai target
dikosongkan — sistem hanya merekam. Menetapkan target sebelum tahu baseline menghasilkan
angka karangan yang merusak kepercayaan pada dashboard.

---

## 5. Peringatan khusus: OEE

Semua orang akan meminta OEE (KPI manufaktur paling terkenal). Kenyataannya untuk AMS:
- **Availability** butuh jam henti per MESIN vs jam rencana per mesin — log downtime ada,
  tapi granularitas & disiplin per mesin harus dibuktikan dulu.
- **Performance** butuh ideal cycle time — inilah standar K8; baru sah setelah DIPELAJARI.
- **Quality** = unit baik ÷ total — sudah ada di batch records.

Keputusan: **OEE-lite per lini** (bukan per mesin) boleh dihitung setelah (a) ≥90 hari
disiplin downtime dan (b) standar K8 terkait sudah DIPELAJARI. OEE penuh per mesin masuk
roadmap bersama modul maintenance. JANGAN menampilkan OEE sebelum itu — OEE dari data
setengah disiplin adalah angka yang terlihat ilmiah tapi bohong, dan sekali manajemen
terbiasa pada angka bohong, memperbaikinya jauh lebih sulit daripada tidak pernah punya.

---

## 6. Rencana kerja

### KPI-0 — MULAI SEKARANG (tanpa kode; pekerjaan Anda & tim, paralel)
Masukkan definisi 12 KPI paket awal ke **kamus metrik** lewat antrean Kamus (begitu K1
hidup; sebelum itu di `docs/kamus-sementara.md`): rumus, satuan, apa yang sengaja
dikecualikan, nilai wajar/mencurigakan, pemilik, frekuensi. Distribusi lewat routing yang
sudah ada: uang → Finance, produksi → SPV, pengiriman → PPIC, supplier → Purchasing.
**Inilah pekerjaan KPI yang sesungguhnya — kesepakatan definisi.** Kode hanya menghitung
apa yang disepakati.

### KPI-1 — Registry + komponen kartu (sesi pertama pasca-September)
- Tabel `kpi_registry` (metric_key → kamus, target, ambang, pemilik role, frekuensi,
  aktif per tenant) + `kpi_snapshots` (menyatu dengan snapshot Fase 0.5 & dashboard AI).
- Komponen `KpiCard` ber-provenance (D0): nilai + target + delta + sparkline; klik →
  panel asal-usul.
- Hitung & tampilkan kategori **A** (KPI #1–5) — datanya sudah ada, sesi ini pendek.
- Aturan visual §2 ditegakkan di komponen (tidak ada pie/3D secara desain).

### KPI-2 — Rumus kategori B gelombang 1
OTD, production attainment, downtime %+Pareto, rejection % (KPI #6–9).
Tiap rumus: contoh perhitungan manual tervalidasi pemilik/pemilik-KPI dijadikan
acceptance test literal (pola sesi biaya yang sudah terbukti).

### KPI-3 — Rumus kategori B gelombang 2
Cycle time (menumpang process mining 0.4), stock-out events, supplier OTD, inventory
turnover+DIO, inventory accuracy, labour productivity (#10–12 + cadangan).

### KPI-4 — Dashboard per peran + target & alert
- Halaman KPI per peran (SPV melihat produksi; Finance melihat uang; pemilik melihat semua)
  — bukan satu dashboard raksasa untuk semua orang.
- Setelah ≥2 bulan baseline: isi target bersama pemilik KPI; alert saat menembus ambang
  (ambang "mencurigakan" dari kamus = alert otomatis pertama).
- Ekspor bulanan (PDF/Excel) untuk rapat manajemen.

### Prasyarat & gerbang
- KPI-1 sampai KPI-4: setelah SAS001 & SAS005 terkirim (aturan fase yang berlaku).
- KPI-0: sekarang — justru memanfaatkan masa tunggu.
- Tambahan kecil yang boleh menumpang pilot September TANPA sesi khusus: kategori
  downtime `CHANGEOVER` + flag `rework` pada batch (dua field murah yang membuka SMED
  & FPY nanti — mencatat sejak sekarang = punya sejarah sejak awal).

---

## 7. Hubungan dengan pekerjaan lain (supaya tidak dobel)

| Sudah direncanakan | Perannya untuk KPI |
|---|---|
| Kamus metrik (K1) | Rumah definisi & rumus resmi — KPI registry hanya merujuk |
| Process mining (0.4) | Menghasilkan cycle-time & antrean = KPI #10 gratis |
| KPI baseline (0.5) | Tabel snapshot yang sama; kebiasaan pencatatannya sudah jalan |
| Kesiapan AI | % downtime terklasifikasi & kelengkapan log = prasyarat OEE-lite |
| D0 provenance | Kartu KPI lahir bisa-diklik & siap Drop-AI |
| Standar K8 | Penyebut banyak KPI (kapasitas, performance, attainment) |
| Modul absensi (dirancang) | Membuka absenteeism & memperbaiki labour productivity |

Satu kalimat untuk memegang seluruh dokumen ini: **dashboard tidak menciptakan kinerja —
ia hanya memantulkannya.** KPI yang baik lahir dari definisi yang disepakati (KPI-0),
data yang disiplin (pilot September), dan pemilik yang menindaklanjuti; visualnya adalah
bagian yang paling mudah.
