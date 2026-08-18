# Spesifikasi Aturan Biaya v1 — AMS-MVP.01 (rev. 4 — FINAL; batch gummy 10kg)

**Status:** seluruh angka pasti terisi; siap jadi acceptance test implementasi
**Basis:** Keputusan Aturan Biaya v1 (Claude Fable) + jawaban celah data G1–G6 + koreksi pemilik produk 18 Agu 2026 + `DATA_PRODUKSI_PT_ITM.pdf`
**PENTING:** kedua PO di dokumen ini adalah **pesanan NYATA yang sedang berjalan di pabrik** (bukan simulasi) — SAS001 masuk 10 Agu, SAS005 masuk 12 Agu, keduanya deadline pertengahan September 2026
**Sifat:** aturan GENERIK per-tenant (konfigurasi, bukan hardcode) — angka Indo Taste hanyalah nilai konfigurasi tenant pertama & bahan contoh hitungan

---

## 1. Aturan Final (ringkasan keputusan K1–K8)

1. **SDM langsung = labor log batch** (jam tercatat per orang × tarif per jam orang itu). Tidak ada daftar jabatan yang di-hardcode; siapa pun yang tercatat di penugasan batch, terhitung. Direktur/GM/PPIC/Finance/HRD/Purchasing tidak pernah tercatat di batch → otomatis overhead. **Klarifikasi pemilik produk (18 Agu):** angka orang per tahap (mis. cetak 8 org) adalah POOL BERGILIR — total tim produksi ±15 orang yang berpindah-pindah tahap sepanjang hari (orang yang sama boleh tercatat di banyak tahap/batch di hari yang sama; demolding batch kemarin berjalan paralel dengan cooking batch hari ini). Angka per tahap = estimasi USAHA (orang-jam per batch) untuk cold-start, BUKAN kebutuhan kepala terpisah. Sistem TIDAK BOLEH punya constraint yang melarang 1 orang tercatat di >1 tahap/batch per hari.
2. **Margin dua tingkat:** Tingkat 1 = Margin Kontribusi per order/batch (harga jual − bahan − kemasan − SDM langsung). Tingkat 2 = Laba Operasional per bulan (Σ margin kontribusi − total overhead bulan). TIDAK ada alokasi overhead ke batch di v1. Kedua angka selalu tampil berdampingan.
3. **Overhead mesin/listrik ditunda** dari v1 (rumus v1.1 disiapkan: tarif = total overhead bulanan ÷ jam kerja langsung normal/bulan; konfigurasi per tenant).
4. **Tarif per jam gaji bulanan** = gaji ÷ jam kerja standar bulan (dari kalender kerja tenant). **Pekerja harian** = tarif harian ÷ jam terjadwal HARI ITU.
5. **Premix/WIP dibiayai dari batch asalnya:** biaya per gram lot premix = (bahan + SDM langsung batch premix) ÷ output aktual batch itu. Pemakaian = qty diambil × biaya per gram LOT yang dipakai (bukan rata-rata global) — konsisten lot genealogy.
6. **Kemasan masuk margin**, dibebankan dari pemakaian AKTUAL di tahap Filling/Pengemasan lewat mekanisme konsumsi stok yang sama seperti bahan baku.
7. **Sisa reprocessable bernilai NOL di v1.** Seluruh biaya ke produk utama; sisa tercatat qty + lot (genealogy). Saat dipakai ulang, masuk dengan biaya 0 — distorsi kecil diterima sadar. Berlaku hanya gummy (gelatin); serbuk tidak punya sisa reprocessable.
8. **Bahan milik client:** qty tercatat penuh (traceability), biaya = 0.
9. **Standar ber-asal-usul (pola K8):** setiap angka yang bisa dipelajari (yield %, pcs/batch, durasi aktif per tahap) menyimpan `{value, source: ESTIMASI_MANUAL | DIPELAJARI, sample_count, last_calculated_at}`. Estimasi manual wajib saat master data dibuat; job pembelajaran = rata-rata bergulir 10 batch selesai terakhir, buang outlier ±2σ, pindah ke DIPELAJARI setelah ≥5 sampel; planner bisa pin nilai + alasan; UI selalu tampilkan asal-usul angka.
10. **Presisi:** semua numeric/Decimal; pembulatan HANYA di tampilan akhir; tidak pernah di tengah perhitungan.

### Aturan tampilan (kontrol akses)
Rincian biaya SDM per-orang dapat membocorkan gaji individual → `general_manager` dan `finance_manager` melihat biaya SDM batch **sebagai TOTAL saja**; rincian per orang hanya `company_admin`. (Konsisten aturan gaji yang sudah berlaku.)

---

## 2. Konfigurasi per Tenant (bukan konstanta kode)

| Kunci konfigurasi | Nilai Indo Taste | Opsi generik |
|---|---|---|
| `labor_costing_method` | `labor_log` | `labor_log` / `role_flag_default` |
| `scrap_valuation` | `zero` | `zero` / `net_realizable_value` |
| `overhead_allocation` | `off` (Tingkat 2 saja) | `off` / `per_direct_labor_hour` / `per_machine_hour` |
| `work_calendar` | Sen–Jum 08.00–16.00, istirahat 12.00–13.00 (efektif 7 jam); Sabtu 08.00–13.00 tanpa istirahat (efektif 5 jam) | kalender bebas per tenant |
| `monthly_overhead_baseline` | Rp60.500.000 (gaji peran non-produksi) | per tenant, bisa ditambah listrik/sewa nanti |

**Turunan kalender:** 40 jam/minggu → jam kerja standar bulan = 40 × 52 ÷ 12 = **173,3333 jam/bulan**.

| Peran | Gaji | Tarif per jam |
|---|---|---|
| SPV Produksi (Dina/Angga) | Rp3.500.000/bln | **Rp20.192,31/jam** |
| Pegawai kontrak | Rp2.000.000/bln | **Rp11.538,46/jam** |
| PHL (harian Rp50.000) | — | **Rp7.142,86/jam** (hari biasa ÷7) · **Rp10.000/jam** (Sabtu ÷5) |

---

## 3. Rumus v1 (konsolidasi)

```
Biaya bahan batch    = Σ (qty bahan aktual terpakai × harga per unit LOT yang dipakai)
                       + Σ (qty premix aktual × biaya per unit LOT premix)
                       (bahan milik client: qty tercatat, biaya = 0)
Biaya SDM batch      = Σ (jam tercatat per orang × tarif per jam orang itu)
Biaya kemasan order  = Σ (qty kemasan aktual terpakai × harga per unit LOT)
Sisa reprocessable   = biaya 0, qty & lot tetap tercatat

Biaya produksi order = Σ biaya batch yang mengerjakan order + biaya kemasan
Margin kontribusi    = (harga jual × qty terkirim) − biaya produksi order
Laba operasional bln = Σ margin kontribusi bulan itu − total overhead bulan itu
```

---

## 4. Data Master yang Dikunci dari G1–G6 + Koreksi Rev. 2

- **G1 (dikoreksi 18 Agu sore):** batch gummy **10 kg** = berat **adonan MASUK** (total masuk mixer, TERMASUK premix gelatin beserta airnya). Titik susut: Mixing (nempel panci) → Cetak (nempel cetakan) → Demolding (gelembung/reject) → Curing (kotor).
- **Premix gelatin (koreksi rev. 2):** air premix (100ml per 60g gelatin) adalah **air premix sendiri** — TIDAK mengurangi jatah "air 100ml" di formula gummy (air formula ditambahkan penuh secara terpisah). Baris "gelatin bloom 28g" di formula dipenuhi lewat lot premix (28g gelatin kering ≈ 75,13g premix).
- **G2:** gummy Zala = **2,5 g/pcs** → botol isi 60 = 150 g isi bersih.
- **G3:** batch serbuk mixer utama **minimal 60 kg**; premix serbuk batch kecil **500 g – 5 kg**. **Serbuk JUGA punya susut** (filling tumpah, kemasan bocor) — bukan 100%.
- **G4:** kalender kerja §2.
- **G5 + koreksi rev. 2 (kemasan gummy per botol):** botol PET **N200** 5.500 + label stiker 1.100 + inner box 800 + **outer box 1.100 (PER BOTOL, bukan dibagi)** + stiker segel 200 = Rp8.700 + **karton isi 27 botol = Rp3.500 (Rp129,63/botol)** → **total Rp8.829,63/botol**. Item child lock/alumunium seal/plastic seal/silica gel tidak dipakai untuk Zala.
- **Kemasan serbuk (rev. 2):** 14 sachet × 138 + box 1.500 + plastic wrap 200 + **karton isi 42 = Rp15.000 (Rp357,14/box)** = **Rp3.989,14/box**.
- **PO = REAL CASE berjalan (revisi 18 Agu):** kedua PO ini adalah pesanan NYATA yang sedang berlangsung di pabrik sekarang, bukan simulasi. **SAS001 (Gummy Zala, 20.000 botol):** tanggal PO **10 Agustus 2026**, target kirim **10 September 2026**. **SAS005 (Drinkme, 10.000 box):** tanggal PO **12 Agustus 2026**, target kirim **12 September 2026**. (Tanggal-tanggal September di PDF tidak berlaku lagi.) "Derasi Orange" = nama flavor vendor, produk tetap Drinkme Lemon (bukan typo).
- **Botol (revisi 18 Agu):** stok gudang **0**; **30.500 botol datang 22 Agustus 2026** dari China — cukup untuk kebutuhan 20.000, TAPI tahap Filling mustahil dimulai sebelum 22 Agu.
- **Stok bahan baku (revisi 18 Agu):** saat kedua PO di-inject ke sistem, **SELURUH stok bahan baku = 0 (kosong)** — data stok riil sedang diminta ke pabrik dan akan diinput menyusul. Konsekuensi yang diharapkan: sistem otomatis menampilkan alert kekurangan bahan untuk semua item begitu WO direncanakan — ini perilaku BENAR, bukan bug.
- **Kapasitas nyata (info rev. 2):** pola kerja **pipeline** — standar perencanaan **4 batch gummy/hari** (maksimal bisa 5) (batch 2 mulai cooking saat batch 1 sedang dicetak; tim cetak tidak menunggu). Ini memvalidasi desain Gantt kita (durasi aktif membebani kapasitas, waktu tunggu hanya menggeser posisi). **Setting (dikoreksi 18 Agu sore): realitas lapangan SEMALAMAN (±16 jam / 960 menit) supaya gummy lebih stabil — bukan 1 jam seperti tertulis di SOP PDF.**

---

## 5. Tiga Contoh Hitungan Manual (= acceptance test literal)

> Tanda **[EST]** = `ESTIMASI_MANUAL` cold-start (pemilik produk mengonfirmasi belum bisa memberi angka pasti — akan digantikan nilai DIPELAJARI dari labor log & yield nyata). Angka lain = data pasti. Implementasi HARUS mereproduksi angka-angka ini persis (sebelum pembulatan tampilan).

### Contoh 1 — Batch Gummy Zala 10 kg (premix gelatin 2 level, air premix terpisah)

**Skala batch:** basis adonan riil = (280,85 − 28) + 75,1333 premix = **327,9833 g** → skala 10.000 ÷ 327,9833 = **30,489354**.

**Langkah A — batch Premix Gelatin (H-1):** gelatin kering 28 × 30,489354 = **853,70 g** → skala resep premix 14,2283×.

| Komponen premix | Qty | Harga | Biaya |
|---|---|---|---|
| Gelatin Nitta Bloom250 | 853,70 g | Rp210/g | Rp179.277,40 |
| Citric acid | 14,23 g | Rp25/g | Rp355,71 |
| Air (milik premix sendiri) | 1.422,84 ml | Rp0,50/ml | Rp711,42 |
| SDM: kontrak 20 menit **[EST]** | 0,3333 jam | Rp11.538,46/jam | Rp3.846,15 |
| **Total batch premix** | | | **Rp184.190,68** |

Output premix (teoretis **[EST]**) = 2.290,77 g → **Rp80,4057/g**.

**Langkah B — batch Gummy** (semua bahan × 30,489354; air formula 3.048,94 ml ditambahkan PENUH):

| Bahan | Biaya |
|---|---|
| Maltitol 1.219,57 g × 315 | 384.165,86 |
| Polysorb 1.524,47 ml × 268 | 408.557,35 |
| Sorbitol liquid 762,23 ml × 18 | 13.720,21 |
| Perfecta Gel 928 — 365,87 g × 95 | 34.757,86 |
| Perfecta MB 121,96 g × 60 | 7.317,44 |
| Gellan 7,62 g × 400 | 3.048,94 |
| Glyserin 30,49 ml × 30 | 914,68 |
| Polydextrose 457,34 g × 60 | 27.440,42 |
| Malic 36,59 g × 44 | 1.609,84 |
| Citric 6,10 g × 25 | 152,45 |
| Kolagen 121,96 g × 210 | 25.611,06 |
| Glutathione 6,10 g × 2.500 | 15.244,68 |
| Air formula (penuh) 3.048,94 ml × 0,50 | 1.524,47 |
| Premix Gelatin 2.290,77 g × 80,4057 (lot Langkah A) | 184.190,68 |
| **Total bahan batch** | **Rp1.108.255,93** |

SDM batch **[EST]**: SPV 1 jam + 2 kontrak × 4 jam + 2 PHL × 4 jam (hari biasa) = **Rp169.642,86**.

Yield total **[EST 85%]** → 8.500 g → 3.400 pcs → **56,6667 botol/batch**.

- Biaya produksi per botol = (1.108.255,93 + 169.642,86) ÷ 56,6667 = **Rp22.551,16**
- Kemasan per botol = 8.700 + karton 3.500÷27 (129,63) = **Rp8.829,63**
- **Margin kontribusi per botol = 108.000 − 22.551,16 − 8.829,63 = Rp76.619,22 (70,9%)**
- Kebutuhan PO **20.000 botol** ≈ **353 batch** ÷ 4 batch/hari (standar perencanaan) ≈ **88 hari kerja dibutuhkan** — vs hari kerja tersedia: **28** (10 Agu→10 Sep), tersisa **21** per hari ini (18 Agu), dan Filling baru bisa jalan **17 hari kerja terakhir** (botol datang 22 Agu, stok sekarang 0) → **mustahil selesai 100% tepat waktu; kirim parsial adalah satu-satunya jalur realistis** — sistem HARUS mendeteksi & menyajikan ini, bukan diam-diam menjadwalkan yang tidak mungkin

### Contoh 2 — Batch Serbuk Drinkme 60 kg (premix berjenjang, yield 95% [EST])

**Biaya per gram lot premix serbuk** (bahan resep per 100 g + SDM [EST: kontrak 30 menit per batch premix 5 kg = Rp1,1538/g]):

| Premix | Bahan/g | +SDM/g | Biaya/g lot |
|---|---|---|---|
| PMSW (malto 50 + stevia 20 + sucralose 30) | 202,0000 | 1,1538 | **203,1538** |
| PMAC (malto 85 + malic 15) | 23,6000 | 1,1538 | **24,7538** |
| PMFL (malto 87,98 + derasi orange 12,02) | 185,8760 | 1,1538 | **187,0298** |
| PMVITC (malto 90 + ascorbic 10) | 25,0000 | 1,1538 | **26,1538** |
| PMSRH (malto 80 + sereh 20) | 76,0000 | 1,1538 | **77,1538** |

**Batch 60 kg** (basis 19,655 g → skala 3.052,6558×): total bahan = **Rp4.965.906,16** (terbesar: PMFL Rp1.370.251,73; sorbitol powder Rp1.239.379,29; psylium Rp854.744,34).

SDM batch **[EST]**: SPV 1 jam + 3 kontrak × 5 jam + 4 PHL × 5 jam = **Rp336.126,37**.

Output dengan susut **[EST 95%]**: 57.000 g ÷ 18 = 3.166,67 sachet ÷ 14 = **226,19 box/batch**.

- Biaya produksi per box = (4.965.906,16 + 336.126,37) ÷ 226,19 = **Rp23.440,56**
- Kemasan per box = 14×138 + 1.500 + 200 + 15.000÷42 = **Rp3.989,14**
- **Margin kontribusi per box = 33.000 − 23.440,56 − 3.989,14 = Rp5.570,29 (16,9%)**
- Kebutuhan PO 10.000 box ≈ **±45 batch** (memperhitungkan susut)

### Contoh 3 — Agregasi Order → Margin Kontribusi → Laba Bulanan

| | SAS001 (**20.000 botol** — revisi pemilik produk 18 Agu) | SAS005 (10.000 box) |
|---|---|---|
| Revenue | Rp2.160.000.000 | Rp330.000.000 |
| Margin kontribusi | **Rp1.532.384.305,79** | **Rp55.702.922,66** |

- Σ margin kontribusi = **Rp1.588.087.228,45**
- Overhead bulanan (gaji non-langsung) = **Rp60.500.000**
- **Laba operasional (ilustrasi jika semua dalam 1 bulan) = Rp1.527.587.228,45**

> Catatan: produksi 353 batch gummy ≈ 88 hari kerja — melewati 3+ bulan kalender. Di sistem nyata, margin diakui per pengiriman dan laba bulanan mengikuti bulan berjalan. Baris ini menguji RUMUS, bukan jadwal.

---

## 6. Status Data (LENGKAP per 18 Agu 2026)

Seluruh angka pasti sudah terisi — tidak ada lagi yang kosong. Satu-satunya nilai berlabel **[EST]** adalah SDM per batch & yield (pemilik produk mengonfirmasi "data masih random" — sengaja dibiarkan sebagai placeholder cold-start berlabel, akan digantikan nilai DIPELAJARI dari labor log & yield nyata sesuai pola K8). **Ini BUKAN blocker.**

## 7. Setelah Validasi (urutan Fable I4–I5)

1. **I4** — seed data dari PDF + revisi real case sebagai script berulang (item+harga, BOM ratio + premix 2 level, routing + estimasi K8, karyawan+tarif [tunduk privasi gaji], customer + 2 PO REAL: SAS001 = 10 Agu kirim 10 Sep 20.000 botol, SAS005 = 12 Agu kirim 12 Sep 10.000 box, kemasan sesuai §4, botol: stok 0 + PO supplier China 30.500 pcs ETA 22 Agu) + script pembersihan data demo lama, diuji di staging dulu. CATATAN: karena ini pesanan NYATA yang sedang berjalan, hasil seed ini = awal data produksi sungguhan sistem, bukan sekadar dataset uji.
2. **I5** — implementasi margin; acceptance = ketiga contoh §5 lulus persis + sistem mendeteksi DUA konflik nyata yang sedang terjadi sekarang: (a) material-vs-jadwal — Filling tidak mungkin sebelum 22 Agu (stok botol 0, GR 30.500 baru masuk 22 Agu), (b) kapasitas-vs-deadline — 353 batch butuh ±88 hari kerja (4 batch/hari) vs 28 tersedia (21 tersisa per 18 Agu) → sistem menyajikan opsi kirim parsial yang bisa dihitung, bukan menjadwalkan yang mustahil.
