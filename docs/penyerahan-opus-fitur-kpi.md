# Penyerahan ke Opus — Fitur KPI: Rencana Kerja & Mandat Penyusunan Instruksi

**Untuk:** sesi Claude chat (Opus)
**Tugas Opus:** (1) wawancarai pemilik produk untuk §7, (2) susun instruksi Claude Code
format B.0.2 per sesi sesuai §4, (3) jadwalkan tumpangan kecil §5 ke sesi yang sudah ada.
**Rujukan wajib dibaca Opus:** `rencana-kerja-kpi.md` (katalog lengkap, status A/B/C/D,
paket awal 12 KPI, peringatan OEE, aturan visual Zebra BI).
**Gerbang waktu:** sesi KPI-1..KPI-4 berjalan SETELAH SAS001 & SAS005 terkirim.
KPI-0 (definisi) dan tumpangan §5 berjalan sekarang.

---

## 1. Keputusan yang sudah diambil (tidak dibuka ulang)

### 1.1 Dua jalur target — dikodekan di skema, bukan sekadar kebijakan
| Jenis KPI | Contoh | Kebijakan target |
|---|---|---|
| **DISIPLIN** (leading — perilaku pencatatan) | % downtime terklasifikasi, % batch berlog lengkap, selisih rekonsiliasi, NCR ber-akar-masalah ≤48 jam | **Target ideal berlaku HARI PERTAMA** (100% / 0), tanpa baseline, tidak bisa diedit tenant |
| **HASIL** (lagging — outcome) | OTD, yield, margin, downtime %, cycle time | **Baseline dulu (≥2 bln), target diisi kemudian** oleh pemilik KPI; benchmark industri tampil sejak hari pertama sebagai arah |

Prinsip yang melandasi (dari pemilik produk): sistem harus MENGARAHKAN dan MEMAKSA
disiplin supaya perusahaan tidak jalan begitu-begitu saja. Yang dipaksa sistem adalah
disiplin (leading); hasil (lagging) mengikuti dari disiplin yang jujur.

### 1.2 Kartu KPI tiga garis
Setiap kartu KPI HASIL menampilkan tiga nilai: **nilai kini** (data) · **target kita**
(null sampai baseline selesai — tampil "belum ditetapkan, baseline berjalan") ·
**benchmark industri** (seed, berlabel "arah, bukan kontrak", bisa dikonfigurasi).
Plus delta vs periode lalu + sparkline. Komponen ber-provenance (aturan D0).

### 1.3 Prinsip tanpa-hukuman di masa awal (dikodekan sebagai perilaku produk)
- KPI HASIL tidak pernah ditampilkan per individu operator — agregat per lini/proses.
  (KPI DISIPLIN boleh per pencatat, karena yang diukur kelengkapan, bukan kinerja.)
- Tidak ada peringkat antar karyawan, tidak ada gamifikasi.
- Alasan: angka yang dipakai menghukum akan dipalsukan; ledger mati. Kejujuran data >
  kecantikan data.

### 1.4 Setiap KPI merah pulang dengan tindakan tertulis
Tabel `kpi_actions` kecil: KPI, periode, temuan, tindakan, penanggung jawab (role/user),
tenggat, status. Ini mesin "improvement" — pendamping ritual rapat mingguan (sisi manusia,
di luar kode).

### 1.5 Lima pilar sebagai bahasa produk
Efisiensi · Optimasi · Transparansi · Improvement · Record — dipakai sebagai
pengelompokan tampilan dashboard KPI (bukan sekadar slogan): tiap KPI ditandai pilarnya.

---

## 2. Skema inti (Opus sempurnakan di instruksi)

```
kpi_registry
  id, tenant_id, metric_key        -- WAJIB merujuk kamus metrik (formulaId) — rumus
                                   -- TIDAK ditulis ulang di sini
  kind enum(DISIPLIN, HASIL)
  pillar enum(EFISIENSI, OPTIMASI, TRANSPARANSI, IMPROVEMENT, RECORD)
  owner_role_id, frequency enum(HARIAN, MINGGUAN, BULANAN, PER_KEJADIAN)
  target_value numeric NULL        -- DISIPLIN: terkunci ideal; HASIL: null s/d baseline
  target_set_at, target_set_by
  benchmark_value numeric NULL, benchmark_label text, benchmark_source text
  warn_threshold, alert_threshold  -- ambang "mencurigakan" (tautkan jawaban kamus Q3)
  is_active, sort_order

kpi_snapshots                      -- MENYATU dengan snapshot Fase 0.5 & dashboard AI
  tenant_id, metric_key, period_start, period_end, value, computed_at, inputs_hash

kpi_actions
  tenant_id, kpi_registry_id, period, finding, action_text,
  owner_role_id/user_id, due_date, status(TERBUKA, BERJALAN, SELESAI, BATAL),
  created_by, closed_at
```
Aturan keras: nilai KPI SELALU dihitung dari data (AUTO), tidak pernah diketik;
target DISIPLIN tidak bisa diubah tenant; perubahan target HASIL tercatat riwayatnya.

---

## 3. Seed benchmark (arah, bukan kontrak — Opus konfirmasi ke pemilik produk sebelum seed)

| KPI | Benchmark lazim dikutip | Catatan |
|---|---|---|
| OTD | ≥95% (kelas dunia 98%) | per kiriman vs janji SO |
| Inventory accuracy | ≥98% | setelah disiplin opname |
| Downtime tak terencana | <10% jam rencana | per lini |
| First Pass Yield | ≥95% | pangan bervariasi — konfirmasi |
| OEE (kelak, lite) | 85% = kelas dunia; 60% = tipikal | JANGAN tampil sebelum gerbang §5 rencana KPI |
| Rejection/scrap | turunkan vs baseline | benchmark industri terlalu bervariasi — pakai tren |
| Inventory turnover | tergantung industri | isi setelah diskusi Finance |

Semua benchmark: kolom `benchmark_source` diisi ("lazim dikutip industri, kalibrasi
internal"), tampil dengan label arah. Bila pemilik produk tidak yakin pada satu angka,
kosongkan — benchmark kosong lebih baik daripada benchmark karangan.

---

## 4. Sesi yang Opus susun instruksinya (format B.0.2, tiap sesi: kriteria selesai +
≥2 skenario negatif + jalan di staging + review B.12)

### KPI-1 — Registry, snapshot, komponen kartu, KPI kategori A
- Skema §2 + RLS + seed 12 KPI paket awal (5 kategori A langsung hidup: margin
  kontribusi, biaya/unit, laba operasional, yield per tahap, nilai persediaan).
- Komponen `KpiCard` tiga garis + sparkline + provenance; aturan visual ditegakkan di
  komponen (tanpa pie/3D secara desain).
- Job snapshot terjadwal per frekuensi.
- Skenario negatif wajib: (a) set nilai KPI via API langsung → ditolak; (b) tenant
  mengedit target DISIPLIN → ditolak; (c) KPI HASIL tampil per individu → tidak ada
  jalurnya.

### KPI-2 — KPI DISIPLIN hidup + rumus HASIL gelombang 1
- DISIPLIN (target ideal aktif hari pertama): % downtime terklasifikasi, % batch berlog
  lengkap, selisih rekonsiliasi harian, % NCR ber-akar-masalah ≤48 jam, % penyesuaian
  stok beralasan.
- HASIL gelombang 1: OTD, production attainment, downtime %+Pareto, rejection %.
- Pola validasi sesi biaya: tiap rumus HASIL punya contoh hitung manual yang divalidasi
  pemilik KPI → jadi acceptance test literal.

### KPI-3 — Rumus HASIL gelombang 2 + kpi_actions
- Cycle time order→kirim (menumpang keluaran process mining 0.4), stock-out events,
  supplier OTD, inventory turnover+DIO, inventory accuracy, labour productivity.
- `kpi_actions` + tampilan "KPI merah tanpa tindakan" (daftar malu yang sehat —
  per KPI, bukan per orang).

### KPI-4 — Dashboard per peran + target & alert
- Halaman per peran (SPV→produksi, Finance→uang, PPIC→pengiriman, pemilik→semua,
  dikelompokkan per pilar).
- Alur penetapan target HASIL setelah baseline ≥2 bulan: usulan sistem (median baseline
  + arah benchmark) → pemilik KPI menetapkan → riwayat tercatat.
- Alert ambang (warn/alert) ke pemilik KPI; ekspor bulanan untuk rapat.

## 5. Tumpangan kecil SEKARANG (Opus selipkan ke sesi berjalan, BUKAN sesi baru)
1. Kategori downtime `CHANGEOVER` + flag `rework` pada batch (dua field murah —
   membuka SMED & FPY dengan sejarah sejak dini).
2. Definisi 12 KPI mulai dicicil di `docs/kamus-sementara.md` → antrean Kamus scope
   METRIC begitu K1 hidup (routing: uang→Finance, produksi→SPV, kirim→PPIC,
   supplier→Purchasing).

## 6. Pekerjaan pemilik produk (tidak bisa didelegasikan)
- KPI-0: mengesahkan definisi & rumus 12 KPI di kamus (lewat antrean + konfirmasi).
- Menjawab §7 saat diwawancarai Opus.
- Contoh hitung manual untuk acceptance test KPI-2 (bersama pemilik KPI terkait).
- Menetapkan target HASIL setelah baseline (nanti, KPI-4).
- Ritual Senin 30 menit + aturan besi "KPI merah = 1 tindakan tertulis + 1 nama"
  (di luar kode; kpi_actions hanya wadahnya).

## 7. Pertanyaan yang Opus wawancarai sebelum menyusun instruksi
1. Konfirmasi/koreksi angka benchmark §3 (boleh kosongkan yang ragu).
2. Standar DISIPLIN mana yang jadi **gerbang keras** (menghalangi aksi, mis. batch tidak
   bisa ditutup tanpa log lengkap — selaras gerbang K8) vs **tagihan lunak** (muncul di
   daftar & notifikasi)? Usulan: log batch = gerbang keras; sisanya lunak dulu.
3. Pemetaan pemilik per KPI (draf ada di rencana-kerja-kpi §4) — konfirmasi nama role.
4. Frekuensi snapshot nilai persediaan (harian disarankan — dibutuhkan turnover/DIO).

## 8. Definisi selesai fitur KPI keseluruhan
- [ ] 12 KPI paket awal hidup: 5 kategori A + 7 kategori B, semua AUTO dari data.
- [ ] KPI DISIPLIN aktif dengan target ideal terkunci sejak rilis.
- [ ] Kartu tiga garis + provenance + sparkline; dashboard per peran per pilar.
- [ ] Baseline ≥2 bulan terekam → target HASIL ditetapkan lewat alur tercatat.
- [ ] kpi_actions dipakai nyata: setiap KPI merah periode berjalan punya tindakan.
- [ ] Tidak ada satu pun nilai KPI yang bisa diketik manual (dibuktikan skenario negatif).
- [ ] Definisi semua KPI DIKONFIRMASI di kamus; kartu menampilkan tautan definisinya.
