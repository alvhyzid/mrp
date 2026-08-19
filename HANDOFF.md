# HANDOFF — Kondisi Terkini Proyek

Dokumen kerja lintas-sesi (pola B.11, lihat `docs/rencana-kerja-playbook-ams.md`). Tiap sesi Claude Code WAJIB baca ini dulu sebelum mulai, dan memperbarui bagian relevan begitu sesi selesai. Klaim di sini harus tetap diverifikasi ulang, bukan otomatis dipercaya — HANDOFF ini rangkuman, bukan pengganti bukti.

---

## Perbaikan tampilan BOM (satuan + keterangan asal angka) — 21 Agu 2026

Pemilik produk bingung membaca "FG-GUMMY-ZALA-N200 — v1 (56.6667 pcs)" — dua masalah nyata, DIPERBAIKI:

**Audit "pcs" hardcoded di kode: NOL ditemukan** — grep menyeluruh ke `src/`/`app/`/migration SQL, tidak ada satu pun `'pcs'` literal atau fallback default `?? 'pcs'`. Akar masalahnya BUKAN kode, MURNI DATA: `items.base_uom` untuk 20 item memang tersimpan generik `"pcs"` (termasuk item Gummy Zala sendiri), dan `boms.standard_yield_uom` (field TERPISAH, bisa diketik manual saat bikin BOM) juga ikut "pcs" — dua sumber yang bisa saling drift.

- **17 dari 20 item "pcs" diganti ke satuan spesifik** (lewat `PATCH /api/items`, bukan update langsung) — HANYA item yang satuannya JELAS dari nama item itu sendiri (mis. "Botol PET N200"→botol, "Karton Gummy (isi 27 botol)"→karton, "Sachet"→sachet, "Box isi 14 Sachet"→box, "Label Stiker..."→lembar) — bukan tebakan. 3 item (Inner Sleeve, Plastic Wrap Box, Silica Gel) SENGAJA dibiarkan "pcs" karena satuan fisiknya tidak cukup jelas dari nama untuk diganti tanpa menebak.
- **`BomsPage.tsx` sekarang SELALU menampilkan `items.base_uom` (field `parent_item_base_uom`)**, bukan `boms.standard_yield_uom` yang bisa drift — perbaikan ini berlaku untuk SEMUA BOM ke depannya, bukan cuma BOM Gummy Zala yang dikeluhkan.
- **Keterangan asal angka**: kolom baru `boms.standard_yield_basis_note` (teks bebas) + `standard_yield_source` (ESTIMASI_MANUAL/DIPELAJARI, pola sama K8) — nullable, diisi manual lewat form edit BOM. **BOM Gummy Zala (bom_id 227) BELUM diisi** — rumus contoh yang diberikan pemilik produk ("10.000 g × yield 85% ÷ 2,5 g ÷ 60") tidak saya masukkan sebagai fakta tersimpan karena saya tidak punya konfirmasi itu angka SEBENARNYA untuk resep ini (bukan cuma contoh ilustrasi) — mekanismenya sudah siap, tinggal diisi lewat form begitu dikonfirmasi.
- **Tampilan angka**: ringkasan sekarang menunjukkan versi dibulatkan ("±57 botol") dengan angka presisi penuh tetap ada di detail (tooltip di tabel, teks eksplisit di panel detail) — perhitungan internal TIDAK berubah, tetap presisi penuh (invarian proyek).

**Test baru**: `tests/bom_yield_display.test.ts` (5 test, termasuk 2 skenario negatif — item satuan gram tampil "g" bukan "pcs" generik; BOM tanpa keterangan tampil `null` apa adanya bukan dikarang; plus sumber tidak valid ditolak).

---

## Data payroll final (tunjangan per orang + basis BPJS per orang + 10 PHL nyata) — 21 Agu 2026

Melanjutkan koreksi di atas — 2 data yang tadinya "menunggu nama/rincian" sekarang lengkap dari dokumen payroll.

### 1. Tunjangan + BPJS Kesehatan per orang — SEMUA 19 karyawan kontrak + Darmini terisi

`daily_meal_allowance`/`daily_transport_allowance`/`bpjs_kesehatan_enrolled` diisi PERSIS sesuai tabel dari pemilik produk (bukan disamaratakan per jabatan). **Bayu (GM) dapat penanganan khusus**: tunjangannya TETAP Rp500.000 makan + Rp500.000 transport per BULAN (bukan per hari hadir) — kolom baru `employees.allowance_frequency` ('daily'/'monthly_fixed') ditambahkan khusus utk kasus ini (migration `20260821160000`, ongkos kecil sesuai prinsip baru — bukan sistem tunjangan generik).

**Temuan basis BPJS TIDAK seragam** (dikonfirmasi pemilik produk): mayoritas karyawan basisnya PERSIS = formula clamp(gaji, floor, ceiling) yang sudah ada — TAPI Dimas (gaji Rp7.500.000) basis sesungguhnya Rp6.500.000, dan Bayu (gaji Rp14.000.000) basis Rp8.000.000, KEDUANYA beda dari hasil clamp. Kolom baru `employees.bpjs_contribution_basis` (nullable, override per orang) ditambahkan — diisi HANYA utk Dimas & Bayu, yang lain dibiarkan `null` (formula clamp lama sudah tepat utk mereka, dibuktikan lewat rekonsiliasi Ruud Ayu/Asni yang basisnya persis = gaji mereka sendiri, sesuai clamp).

**Overhead SDM dihitung ulang**: Rp65.666.907 (lama, sebelum tunjangan+Kesehatan) → **Rp73.352.547** (baru, gaji pokok + BPJS lengkap + tunjangan, basis 21 hari kerja standar). Target pemilik produk Rp74.694.305, selisih Rp1.341.758 (±1,8%) — **BUKAN bug**, murni beda basis: angka pemilik produk adalah ANGKA AKTUAL dari kehadiran nyata yang bervariasi per orang (disebutkan eksplisit "27/26/24 hari hadir"), sedangkan angka sistem adalah proyeksi STANDAR (asumsi 21 hari kerja seragam, `standard_working_days_per_month`) — dua hal yang secara desain TIDAK akan pernah sama persis, sama seperti prinsip "standar vs aktual" yang berlaku di seluruh sistem ini. `company_settings.monthly_overhead_baseline` sudah diupdate ke Rp73.352.547.

### 2. 10 PHL NYATA menggantikan 18 PHL simulasi (SEMUA, bukan cuma sebagian)

Bilal, Yunita, Nanda, Diah, Lely, Nindi, Mayang, Zidan, Mina — Operator Produksi, PHL, plant Karanglo (lini serbuk), `wage_type=daily`, `wage_rate=50.000`, `daily_transport_allowance=2.000` (parkir/hari hadir). Rohmat sama + `daily_transport_allowance=12.000` (parkir 2.000 + bensin 10.000 — keterangan resmi "pindah dari Dieng" dicatat di kolom posisi). **18 PHL simulasi (6 gummy + 12 powder) SEMUA dinonaktifkan** — bukan cuma yang punya padanan, karena lini gummy sekarang dikonfirmasi TIDAK PUNYA PHL sama sekali (Koreksi 2 di bawah), jadi ke-6 PHL gummy simulasi tidak digantikan siapa pun.

**Gap kode ditemukan & ditambal saat verifikasi**: `computeStandardLaborCostPerUnit.ts` SEBELUMNYA hanya menambahkan tunjangan makan/transport ke kru `wage_type=monthly` — kru `wage_type=daily` (PHL) TIDAK ikut tunjangan sama sekali walau datanya sudah ada. Ditambal (PHL sekarang ikut tunjangan per hari hadir juga) SEBELUM data PHL nyata di atas benar-benar termanfaatkan.

**Angka SAS001/SAS005 final** (setelah SEMUA koreksi 21 Agu — kru gummy nyata + tunjangan + BPJS per-orang):
| | SAS001 (Gummy) | SAS005 (Serbuk) |
|---|---|---|
| Biaya SDM standar/unit | Rp8.260,04 | Rp781,05 |
| Margin rencana total | Rp1.428.412.806 | Rp63.245.800 |

`labor_cost_complete` MASIH `false` untuk keduanya — premix (gummy 1, serbuk 5) masih belum ada kru, dan Darmini (satu-satunya karyawan `monthly` yang BPJS Kesehatan-nya masih `null`/belum dikonfirmasi) ikut ke rata-rata company-wide `wage_type=monthly` yang dipakai kru gummy — **catatan imprecision yang SUDAH diketahui sejak Bagian B**: rata-rata tarif kru diambil company-wide per `wage_type`, TIDAK difilter per plant/departemen, jadi Darmini (janitor, bukan produksi) ikut masuk hitungan rata-rata kru gummy. Belum diperbaiki (di luar cakupan sesi ini, dicatat sebagai gap terbuka).

**Semua item "menunggu" dari koreksi sebelumnya SEKARANG TERJAWAB PENUH** — dihapus dari daftar tunggu di bawah.

---

## Koreksi Bagian D/E setelah A→F — 21 Agu 2026 (2 koreksi data + keputusan Bagian E)

Pemilik produk mengoreksi 2 hal nyata setelah laporan Bagian A→F pertama, plus menjawab pertanyaan opsi Bagian E.

### Koreksi 1 — Overhead Rp65.666.907 TERBUKTI belum lengkap (dikonfirmasi lewat rekonsiliasi angka per orang, bukan ditebak)

Pemilik produk memberi 9 angka biaya pemberi kerja NYATA per orang (total Rp74.694.305). Dibandingkan PERSIS ke angka sistem (skrip verifikasi, bukan dugaan) — polanya KONSISTEN untuk SEMUA 9 orang: komponen gaji pokok + JKK + JKM + JHT (basis di-clamp floor/ceiling) **COCOK PERSIS** ke model yang sudah dibangun Bagian D (dibuktikan lewat Mega yang gajinya identik dengan contoh acuan Dina — hasilnya sistem sama persis dengan target). Sisa selisih (Rp9.027.398 total) berasal dari 2 hal yang MEMANG belum dihitung sistem, BUKAN bug rumus:
1. **BPJS Kesehatan** — sistem sengaja tidak mengikutkan karena `bpjs_kesehatan_enrolled` belum dikonfirmasi untuk siapa pun (bukan ditebak ikut).
2. **Tunjangan makan+transport per hari hadir** — kolomnya ADA di database (Bagian C) tapi NILAINYA belum diisi untuk siapa pun.

**Tidak bisa direkonsiliasi PERSIS ke rupiah** tanpa 3 data tambahan: keikutsertaan BPJS Kesehatan per orang, jumlah hari hadir aktual per orang di periode itu, dan kategori tunjangan yang tepat untuk jabatan yang tidak persis cocok ke 3 tingkatan yang pernah diberikan (mis. "General Manager" beda dari "Direktur"; "Manager PPIC"/"RnD Staff"/"PPIC Jr. Spv" tidak jelas SPV/Manager atau tingkatan lain — dicoba dihitung mundur dari angka yang diberikan, hasilnya TIDAK konsisten satu sama lain, jadi sengaja TIDAK dipaksakan/ditebak). **Angka Rp65.666.907 BELUM diubah** sampai data ini tersedia — supaya tidak menebak dua kali.

### Koreksi 2 — Kru lini GUMMY seharusnya kontrak bulanan, BUKAN PHL (DIPERBAIKI)

Data PHL nyata membuktikan: PHL 100% ada di lini SERBUK (Karanglo), lini GUMMY (Ruko Dieng) 100% kontrak bulanan. `routing_step_standard_crew` untuk routing gummy (routing_id 6) — yang sebelumnya berisi estimasi 16 headcount `wage_type='daily'` (ESTIMASI_MANUAL sesi sebelumnya, ternyata SALAH) — **sudah diganti** dengan 3 baris nyata: 1 SPV (Dina Melinda Cahya Purnama), 1 Team Leader (Sutipa Handayani), 7 Operator (Mi'asih, Diana Ayu Agustin, Muhammad Alif Alhamad, Rumanik, Ezra Ariya Septiano, Aziz Maulana, Maylani Suhesti) — total 9 orang NYATA, semua `wage_type='monthly'`, semua sudah ada di `employees` sejak Bagian C.

**Dampak margin SAS001 (dihitung ulang, terverifikasi lewat API sungguhan)**:
| | Sebelum koreksi | Setelah koreksi |
|---|---|---|
| Biaya SDM standar/unit | Rp3.529,41 | **Rp7.316,57** (naik >2×) |
| Margin rencana total | Rp1.523.025.338 | **Rp1.447.282.118** (turun ±Rp75,7 juta) |

`labor_cost_complete` MASIH `false` (premix gummy & BPJS Kesehatan masih belum lengkap) — angka di atas masih akan naik lagi (biaya SDM makin tinggi, margin makin turun) begitu premix + BPJS Kesehatan + tunjangan terisi.

### Jawaban Bagian E — Laba Operasional bulanan SEKARANG ikut periode gajian (26-25), SUDAH DITERAPKAN

`get_monthly_operating_profit()` diubah (migration `20260821140000`): mengelompokkan pengiriman berdasar RENTANG TANGGAL periode gaji (`payroll_period_start_day`), bukan lagi `extract(month from shipment_date)`. Fungsi sekarang MENGEMBALIKAN `period_start`/`period_end` eksplisit (mis. "2026-07-26" s/d "2026-08-25") supaya begitu ada halaman UI yang memakainya, label periode tidak tertukar dengan bulan kalender. Company TANPA `payroll_period_start_day` diisi tetap fallback ke bulan kalender persis seperti sebelumnya (zero regresi). **Belum ada halaman UI yang memanggil endpoint ini** — begitu dibuat, WAJIB memakai `formatCurrency`/menampilkan `period_start`-`period_end`, bukan asumsi label bulan kalender.

**Pertanyaan terbuka yang JUJUR belum dijawab**: apakah `monthly_overhead_baseline` sebaiknya dihitung sebagai SISA (total biaya pemberi kerja SEMUA karyawan − biaya SDM yang tercatat di batch periode itu), sesuai instruksi sebelumnya, ATAU tetap angka statis yang di-update manual? **Status sekarang: MASIH STATIS** (angka manual di `company_settings.monthly_overhead_baseline`, terakhir di-update jadi Rp65.666.907 yang TERBUKTI belum lengkap di atas). Formula SISA belum dibangun karena butuh 3 hal yang belum ada: (1) biaya pemberi kerja PHL per-orang nyata (baru ada STRUKTUR tarifnya, belum data per-orang lengkap — lihat di bawah), (2) cara menentukan batch mana masuk periode gaji mana (`production_batches` sudah punya `started_at`/`completed_at`, belum dipakai untuk ini), (3) tunjangan+BPJS Kesehatan yang sama seperti Koreksi 1 di atas. Membangunnya sekarang dengan data yang belum lengkap akan menghasilkan angka "SISA" yang KELIHATANNYA presisi padahal masih menebak — sengaja ditunda, bukan lupa.

### Item yang SUDAH terjawab, dihapus dari daftar menunggu (lihat bagian di bawah utk yang masih tersisa)
- **Darmini** — sudah ditambahkan sebagai karyawan aktif (janitor, `wage_type=monthly`, Rp1.500.000/bulan, `employment_status=freelance`, tanpa kode karyawan pabrik, plant Ruko Dieng). Tidak pernah masuk labor log batch (sesuai deskripsi perannya).
- **Basis BPJS Rp3.737.000** — dikonfirmasi = UMK berlaku, berubah tiap tahun. Sudah tersimpan sebagai `company_settings.bpjs_wage_basis_floor` (konfigurasi, bukan hardcode) — TINGGAL diperbarui nilainya tiap tahun via config yang sama, tidak perlu ubah kode.
- **Peran "Staff PPIC"** — dikonfirmasi memang tidak ada padanan nyata, bukan data yang belum lengkap. Tidak perlu dicari lagi.
- **Data PHL nyata** — SEBAGIAN terjawab: struktur tarif sudah diketahui (Rp1.100.000/22 hari + parkir Rp44.000/22 hari; 1 orang +bensin Rp220.000/22 hari, berbasis kehadiran mesin absensi). **BELUM bisa menggantikan 10 PHL simulasi** karena nama 10 orang belum diberikan (beda dari Bagian C yang punya nama lengkap 20 orang) — kalau dipaksa cocokkan ke 10 PHL simulasi yang ada sekarang (Ali/Uli/Ardi/Yupi/Bobo/Baki/Moli/Suci/Tono/Tunik) itu akan MENEBAK identitas, persis yang dilarang. Menunggu daftar nama, bukan struktur tarifnya lagi.

---

## Perintah Gabungan A→F, Bagian A (bug data BOM 227) + Bagian B (SDM standar dari kru nyata) — 20 Agu 2026

Pemilik produk sendiri melakukan rekonsiliasi manual angka spesifikasi vs sistem dan membuktikan hipotesis awal saya ("SDM belum termasuk" saja) TIDAK CUKUP menjelaskan selisih SAS001 — kemasan-nya juga jauh salah. Diminta bongkar sampai ketemu akar masalah, bukan menduga.

### Bagian A — Bug data nyata di `bom_lines` (bom_id 227, Gummy Zala/item 371), DIPERBAIKI lewat `PATCH /api/boms`

6 baris kemasan (botol/label/inner sleeve/outer box/seal/karton) tersimpan dengan `qty_per_unit_output` yang KELIRU dibagi ekstra dengan `standard_yield_qty` (51) — mis. botol harusnya `1.0`/unit tapi tersimpan `0.019608` (=1/51). Dibuktikan lewat kecocokan angka persis: `173.1306 × 51 = 8829.66` vs target spesifikasi Rp8.829,63 (selisih Rp0,03, murni pembulatan).

- **Diperbaiki**: botol/label/inner/outer/seal → `qty_per_unit_output = 1.0`; karton → `1/27 = 0.037037...`; `standard_yield_qty` 51 → 56,6667 (basis batch 10kg/rev.4, bukan lagi 9kg/rev.3). Semua lewat form edit BOM resmi, bukan UPDATE langsung ke DB.
- **BAHAN (raw material) TIDAK terdampak bug yang sama** — dicek langsung: total bahan mentah 41,35g/botol cocok dengan komposisi resep nyata, jadi baris bahan TIDAK disentuh (sesuai instruksi "jangan ubah tanpa lapor").
- **Cakupan dampak bug ini** (semua baca `bom_lines.qty_per_unit_output` yang sama): `explodeBomRequirements.ts` (shortage/kelayakan), fungsi SQL `recompute_work_order_material_readiness` (alert `material_shortage`), tampilan `BomsPage.tsx`, dan Margin Watch — SEMUA otomatis ikut benar setelah data BOM diperbaiki, tidak ada kode terpisah yang perlu ditambal.
- **Scan seluruh BOM aktif perusahaan** membuktikan TIDAK ADA BOM lain dengan pola bug yang sama (bom_id 227 kasus terisolasi).
- **Verifikasi setelah perbaikan**: kemasan SAS001 sekarang Rp8.829,63/botol (persis cocok spesifikasi); daftar kekurangan bahan SAS001 berubah dari "kurang 392" (sisa bug lama) ke skala puluhan-ribu wajar; kesimpulan TIDAK FEASIBLE SAS001 tetap sama SETELAH perbaikan (sebab kapasitas produksi, bukan lagi soal kemasan) — dikonfirmasi lewat pengecekan ulang endpoint kelayakan.

### Bagian B — Biaya SDM standar per batch dihitung dari kru NYATA (tabel baru `routing_step_standard_crew`)

Awalnya sempat tanya ke pemilik produk cara memetakan kru ke 10 tahap serbuk (data per-tahap vs angka agregat spesifikasi pakai basis jam-orang yang beda). **Jawaban pemilik produk mengoreksi hal yang lebih mendasar**: angka agregat asli di spesifikasi (Rp169.642,86/batch gummy, Rp336.126,37/batch serbuk, basis 36 jam-orang) adalah ASUMSI KELIRU pemilik produk sendiri — spesifikasi itu menghitung ganda (upah orang yang sama dibebankan penuh ke tiap batch, padahal 1 kru mengerjakan beberapa batch sehari).

**Basis BARU yang benar** (dipakai sekarang): `biaya SDM standar per batch = total biaya harian kru lini produksi ÷ jumlah batch standar per hari (dari production_standards)`. Diimplementasikan di `computeStandardLaborCostPerUnit.ts`, dipanggil dari `getMarginWatch.ts` Lapis 1. Untuk item dengan BOM 2-tingkat (WIP bersarang, mis. Box Drinkme ← WIP Sachet), SETIAP level yang punya routing+kru sendiri dihitung terpisah lalu dijumlah dikali rasio kebutuhannya ke unit teratas — level yang belum punya kru/standar DILEWATI dengan catatan eksplisit (`labor_cost_notes`), TIDAK diam-diam dianggap 0.

- **Tabel baru `routing_step_standard_crew`** (migration `20260820200000`): SATU baris agregat per ROUTING (bukan per tahap — keputusan pemilik produk final), `routing_step_id` nullable untuk presisi per-tahap di masa depan. Diisi dari data lapangan nyata untuk gummy (routing_id 6) dan serbuk (routing_id 61 Sachet, 62 Box finishing) via script admin langsung (belum ada endpoint CRUD, sesuai preseden K8/production_standards).
- **Gap ditemukan & ditambal saat verifikasi**: `production_standards` untuk item 73 (Sachet WIP) TIDAK PERNAH diisi sejak restrukturisasi BOM 2-tingkat sesi sebelumnya — artinya SELURUH biaya SDM Routing A (gudang, mixing, filling, QC — porsi terbesar tenaga kerja nyata) diam-diam TIDAK terhitung sampai ditambal. Nilai diturunkan (bukan ditebak) dari data yang sudah terverifikasi: `unit_per_batch = 226,19 × 14 = 3.166,66` (14 sachet/box), `batches_per_day = 3` (kapasitas mixing fisik tidak berubah). Ditandai `ESTIMASI_MANUAL`.
- **2 bug kode ditemukan sendiri lewat verifikasi angka sebelum lapor** (bukan dari user): (1) rasio unit teratas sempat dobel jadi 2,0 karena pre-set nilai sebelum fungsi rekursif jalan — dihapus, sekarang `explode()` satu-satunya sumber; (2) kalau ADA level yang belum lengkap datanya, kode lama menyembunyikan SELURUH jumlah parsial jadi `null` — sekarang konsisten dengan pola biaya bahan: tetap tampilkan jumlah parsial + flag `labor_cost_complete=false` terpisah.

**Hasil verifikasi nyata (setelah kedua bug & gap di atas ditambal), dibandingkan target spesifikasi rekonsiliasi manual pemilik produk**:

| | Bahan | Kemasan | SDM standar | Margin/unit | Margin total |
|---|---|---|---|---|---|
| SAS001 target spek | Rp19.557,45 | Rp8.829,63 | Rp2.993,70 | Rp76.619,23 | Rp1.532.384.305,79 |
| SAS001 sistem (sekarang) | Rp19.489,69 | Rp8.829,63 ✓ persis | Rp3.529,41 (PARSIAL) | Rp76.151,27 | Rp1.523.025.338 |
| SAS005 target spek | Rp21.954,58 | Rp3.989,14 | Rp1.486,04 | Rp5.570,25 | — |
| SAS005 sistem (sekarang) | (drift harga live, sudah terverifikasi wajar sesi sebelumnya) | | Rp736,84 (PARSIAL) | | Rp63.687.906 |

Kemasan SAS001 sekarang cocok PERSIS. Bahan sedikit beda (drift harga live nyata, bukan bug). SDM standar SAS001/SAS005 **masih PARSIAL** — 5 WIP premix serbuk + 1 WIP premix gummy BELUM punya baris `routing_step_standard_crew` (kru untuk tahap premix belum diberikan datanya), jadi `labor_cost_complete` masih `false` untuk kedua order. Biaya SDM sistem sekarang justru SEDIKIT LEBIH TINGGI dari target Rp2.993,70/Rp1.486,04 meski masih parsial — jadi setelah premix ditambahkan nanti kemungkinan akan lebih tinggi lagi, BUKAN mengikuti perkiraan awal "margin akan naik dari basis lama". **Catatan penting**: perkiraan "margin naik dibanding spec karena spec menghitung ganda" itu merujuk ke angka AGREGAT LAMA (Rp169.642,86/batch dkk, basis 36 jam-orang) yang sudah dibuang — BUKAN ke target rekonsiliasi Rp2.993,70/Rp1.486,04 di atas, yang independen dan justru sudah cukup dekat dengan hasil sistem sekarang.

**Belum selesai / gap yang tersisa (jangan dianggap kelar)**:
1. Kru premix (5 tahap serbuk + 1 gummy) belum diisi — banner "SDM belum termasuk" di UI Margin Watch BELUM bisa dihapus, karena memang belum truly complete.
2. Biaya kru harian sekarang masih pakai `wage_rate` polos (rata-rata karyawan aktif per wage_type) — BELUM memakai model biaya-pemberi-kerja penuh (BPJS, JKK, JKM, JHT) dari Bagian D (belum dikerjakan) — begitu Bagian D selesai, biaya SDM standar ini perlu dihitung ULANG dengan basis yang lebih tinggi.
3. **Konsistensi basis aktual vs standar BELUM diperiksa** — `compute_production_batch_labor_cost` (biaya SDM AKTUAL dari labor log nyata) masih pakai metodologi lama (per jam/per shift), BELUM direkonsiliasi ke basis baru (kru harian ÷ batch/hari). Pemilik produk eksplisit memperingatkan ini penting: kalau basis standar vs aktual beda, Lapis 2 (kategori "SDM") akan selalu menunjukkan selisih PALSU. Perlu dikerjakan sebelum Bagian B benar-benar bisa disebut selesai.
4. Representative `wage_rate` diambil dari rata-rata SEMUA karyawan aktif company-wide dengan `wage_type` sama (tidak difilter per plant/departemen) — imprecision yang sudah diketahui, belum diperbaiki.

**Test baru**: `tests/standard_labor_cost.test.ts` (3 test: perhitungan 2-tingkat + rasio benar, 2 skenario negatif — item tanpa BOM sama sekali, level dengan routing tapi tanpa kru). `tests/margin_watch.test.ts` diperbarui (SDM sekarang SELALU angka, bukan `null`, dengan flag `labor_cost_complete` terpisah).

### Bagian C — Data 20 karyawan payroll NYATA menggantikan simulasi (SELESAI, 19 dari 20 — Darmini menunggu)

Struktur `employees` diperluas (migration `20260821090000` + `20260821091500`): `factory_employee_code`, `employment_status` (kontrak/phl/freelance), `ptkp_status`, `ter_category`, `ter_rate_percent`, `daily_meal_allowance`, `daily_transport_allowance`, `bpjs_kesehatan_enrolled` — semua NULLABLE, diisi bertahap sesuai data yang benar-benar diketahui (bukan dipaksa lengkap). Department diperluas dengan `fat` dan `rnd` (ditemukan dari data nyata Asni Damayati/Adhiskaprillia, tidak cocok ke 7 kategori lama). Field finansial baru (PTKP/TER/tunjangan/BPJS) **ikut aturan privasi wage_rate yang SAMA** — role tanpa akses HR tidak melihatnya sama sekali, dibuktikan test.

**Dikerjakan lewat endpoint resmi `/api/employees` (POST/PATCH), BUKAN insert langsung** — konsisten dengan CRUD karyawan yang sudah ada.

- **15 karyawan simulasi wage_type=monthly (tier "kontrak") DINONAKTIFKAN** (`is_active=false`, riwayat tetap utuh — tidak dihapus): Alvan, Bayu, Dimas, Dika, Mega, Asni, Ayu, Dina, Angga, Miasih, Sutik, Mini, Momo, Joni, Alif (employee_id 642-656).
- **18 PHL simulasi (wage_type=daily, employee_id 657-674) SENGAJA TIDAK disentuh** — masih menunggu data HRD pabrik nyata, tetap berstatus simulasi.
- **19 dari 20 karyawan nyata ditambahkan** sebagai baris BARU (bukan menimpa baris lama) dengan kode karyawan pabrik asli (2508001 dst). Plant "Dieng" dipetakan ke plant yang sudah ada "Ruko Dieng" (nama cocok, satu-satunya "Dieng" di sistem); plant "KL Bizhub" BARU dibuat (belum pernah ada sebelumnya — ada 2 karyawan produksi nyata berbasis di sana: Sandra Wedi Pradika, Angga Ade Mahendra).
- **Darmini (Freelance Helper, Rp1.500.000) SENGAJA BELUM ditambahkan** — cara pembayarannya (per hari? per bulan? per pekerjaan?) eksplisit masih menunggu konfirmasi HRD, dan `wage_type` adalah kolom wajib yang bermakna skema pembayaran — mengisi salah satu nilai sekarang berarti mengarang skema yang belum dikonfirmasi. Tetap di daftar "menunggu" di bawah.
- **Pencocokan nama→orang mengikuti PERSIS peringatan yang diberikan** — 3 jebakan eksplisit (Ayu SPV HRD ≠ Ruud Ayu Dewanti HR Generalist; Angga SPV Produksi Powder ≠ Angga Ade Mahendra Team Leader; Dika Staff PPIC TIDAK ADA padanan nyata) diperlakukan sebagai PENGGANTIAN KATEGORI (seluruh tier simulasi dinonaktifkan, 19 nyata ditambah baru), BUKAN dipetakan 1:1 sebagai "orang yang sama" — jadi tidak ada risiko riwayat kerja orang A tertaut ke orang B yang cuma namanya mirip.
- **Gap nyata yang terekspos, BUKAN ditutup-tutupi**: peran "Staff PPIC" (dulu diisi Dika, simulasi) sekarang TIDAK ADA satu pun karyawan nyata yang mengisi peran itu di data yang diberikan — perlu dikonfirmasi ke pemilik produk apakah peran ini memang sudah tidak ada, atau datanya belum lengkap.
- PTKP/TER cuma diisi untuk 5 dari 19 karyawan (Alvan, Dimas, Bayu, Ruud Ayu Dewanti, Asni) — sisanya `null`, BUKAN ditebak dari pola yang ada.
- Tunjangan makan/transport & kepesertaan BPJS Kesehatan **BELUM diisi untuk siapa pun** — datanya (siapa ikut BPJS, kategori tunjangan per orang untuk jabatan seperti "Team Leader"/"Jr. Spv" yang tidak persis cocok ke 3 tingkatan tunjangan yang diberikan) memerlukan Bagian D + konfirmasi tambahan, sengaja tidak ditebak sekarang.
- UI Dashboard HRD (`HrDashboardPage.tsx`) diperbarui: kolom Kode Karyawan + Status Kepegawaian di tabel; form tambah/edit sekarang punya field kode karyawan, status kepegawaian, PTKP, golongan TER, tarif TER, tunjangan makan/transport, kepesertaan BPJS (field finansial otomatis tersembunyi untuk role tanpa akses HR, sama seperti field gaji).

**Test baru**: `tests/employee_real_payroll_fields.test.ts` (5 test: create dgn field lengkap, 2 skenario negatif — employment_status tidak valid ditolak, tunjangan negatif ditolak — privasi field finansial baru, update mempertahankan data).

### Bagian D — Model biaya pemberi kerja (BPJS Kesehatan+JKK+JKM+JHT di atas gaji pokok)

**Rumus divalidasi PERSIS terhadap contoh nyata Dina** (gaji Rp3.500.000 → target Rp4.357.744 total biaya pemberi kerja): basis iuran BPJS Ketenagakerjaan (JKK/JKM/JHT) **DAN** BPJS Kesehatan **BUKAN gaji individu mentah**, tapi gaji di-clamp ke `[bpjs_wage_basis_floor, bpjs_wage_basis_ceiling]` — terbukti dari Dina/Sutipa/Mi'asih (gaji 3,5jt/2,6jt/1,5jt, SEMUA di bawah floor Rp3.737.000) punya JKK Rp33.260 & JKM Rp11.211 IDENTIK (basis floor yang sama), sedangkan Alvan (gaji 20jt, di atas ceiling Rp9.000.000) pakai basis ceiling. Rate divalidasi: JKK 0,89%, JKM 0,30% (keduanya cocok pas ke angka Dina), JHT 3,7% & BPJS Kesehatan 4% (dari instruksi). **Semua rate & basis floor/ceiling disimpan sebagai `company_settings` (tenant config, TIDAK di-hardcode)** — diisi untuk company_id=1 (7 kunci baru: `bpjs_wage_basis_floor/ceiling`, `bpjs_kesehatan_employer_rate_percent`, `bpjs_jkk/jkm/jht_employer_rate_percent`, `standard_working_days_per_month`).

- **`computeEmployerCostUplift.ts`** (baru) — `getEmployerCostConfig()` baca 6 kunci wajib, kalau ADA yang belum diisi untuk suatu company, kembalikan `null` (bukan default angka karangan) — pemanggil FALLBACK ke gaji pokok saja + catatan eksplisit, tidak error. `computeMonthlyEmployerUplift()` — BPJS Kesehatan HANYA dihitung kalau `bpjs_kesehatan_enrolled === true` eksplisit; `null` (belum dikonfirmasi) TIDAK dibaca sebagai `false` (tapi secara ANGKA sama-sama 0 — bedanya cuma di notes, `null` menghasilkan catatan "belum dikonfirmasi").
- **Diterapkan HANYA untuk `wage_type='monthly'`** — satu-satunya jenis upah yang dicontohkan pemilik produk (Dina dkk semua bulanan). PHL (wage_type='daily') **SENGAJA TIDAK diperluas** ke model ini — data PHL nyata belum ada (masih simulasi, menunggu HRD), dan aturan BPJS untuk pekerja harian informal tidak dikonfirmasi. Perluasan ke wage_type lain HANYA kalau/ketika dikonfirmasi.
- **Sisi STANDAR** (`computeStandardLaborCostPerUnit.ts`): kru `wage_type=monthly` sekarang kena uplift + tunjangan makan/transport harian (rata-rata dari karyawan aktif tipe itu — 0 sampai Bagian C mengisi datanya, bukan angka karangan) sebelum diprorata ke tarif harian.
- **Sisi AKTUAL** (SQL `compute_production_batch_labor_cost`, migration `20260821100000` + fixup `20260821110000` — lihat catatan bug di bawah): case `wage_type='monthly'` kena uplift yang SAMA PERSIS (dibuktikan test `employer_cost_uplift.test.ts` — JS & SQL menghasilkan angka identik). **Tunjangan makan/transport SENGAJA TIDAK ditambahkan di sisi aktual** — tunjangan itu per HARI HADIR, sedangkan 1 batch bukan representasi 1 hari kerja penuh (karyawan bisa kerja di beberapa batch sehari) — atribusi ke batch tertentu butuh aturan pembagian yang belum ditentukan pemilik produk. **Gap terbuka, bukan ditutup-tutupi.**
- **BUG yang ditemukan & diperbaiki SENDIRI sebelum lapor**: migration awal `20260821100000` menulis ulang `compute_production_batch_labor_cost()` dari versi SEBELUM perbaikan upah PHL sadar-shift (migration `20260820150000`) — tanpa sadar ME-REVERT perbaikan shift itu. Ketahuan lewat kegagalan `tests/rate_capacity_and_shift_wage.test.ts` (bukan asumsi lolos karena "logic-nya kecil"). **Pelajaran**: `supabase db push` melacak migration APPLIED berdasar NAMA FILE, bukan isi — mengedit file yang sudah ter-push TIDAK terkirim ulang ke DB remote. Perbaikan ditulis sebagai migration BARU (`20260821110000`), bukan menyunting yang lama.
- **Dampak nyata pada SAS001/SAS005 SAAT INI: NOL** — dicek langsung, kru routing gummy (routing_id 6) & serbuk (routing_id 61/62) di `routing_step_standard_crew` SEMUANYA `wage_type='daily'` (operator lini produksi, masih data PHL simulasi) — bukan `monthly`. Uplift Bagian D baru berdampak kalau/ketika kru lini produksi memakai kru bergaji bulanan, atau begitu data PHL nyata tersedia dan modelnya diperluas ke situ (BELUM dikerjakan, menunggu konfirmasi).
- **Dampak nyata pada overhead bulanan**: `monthly_overhead_baseline` dihitung ulang dari gaji NYATA peran non-produksi (9 karyawan: Direktur, GM, Manager PPIC, Staf Purchasing, HR Generalist, Helper Gudang, FAT Spv, RnD Staff, PPIC Jr. Spv — department ≠ production) + uplift JKK/JKM/JHT (BPJS Kesehatan=0 karena belum ada satu pun yang keikutsertaannya dikonfirmasi) → **Rp60.500.000 (lama, simulasi) → Rp65.666.907 (baru, gaji nyata + BPJS employer), naik ±8,5%**. Sudah diupdate di `company_settings`.
- **Test baru**: `tests/employer_cost_uplift.test.ts` (7 test: rumus clamp floor/ceiling tervalidasi ke angka Dina, 3 skenario negatif — gaji di atas ceiling tetap dipotong bukan dihitung penuh, `bpjs_kesehatan_enrolled=null` tidak dianggap ikut tapi juga tidak dianggap "dikonfirmasi tidak ikut", company tanpa config BPJS fallback aman — plus verifikasi SQL vs JS menghasilkan angka identik).

### Bagian E — Periode penggajian (26 s/d 25), opsi overhead bulanan DILAPORKAN bukan diputuskan

`company_settings.payroll_period_start_day = 26` disimpan untuk company_id=1 (konfigurasi tenant, bisa beda per perusahaan lain). **Belum dipakai di kode mana pun** — sengaja, karena keputusan berikut BUKAN wewenang saya:

**Pertanyaan yang perlu dijawab pemilik produk**: `get_monthly_operating_profit()` (Laba Operasional bulanan, K2 Tingkat 2) saat ini mengelompokkan margin pengiriman berdasar **bulan KALENDER** (1-31/28/30). Sekarang periode gaji pabrik sudah dikonfirmasi 26 s/d 25 (bukan kalender) — 2 opsi:

1. **Tetap bulan kalender** (tidak berubah) — Laba Operasional bulanan terus dihitung 1-31 seperti sekarang. Overhead (termasuk gaji, lihat Bagian D) dikurangkan penuh di bulan kalender itu, TIDAK peduli tanggal gajian sungguhan. Lebih sederhana, tapi "bulan" di laporan tidak 1:1 dengan "bulan gajian" yang dialami HRD/Finance.
2. **Ikut periode gaji (26 s/d 25)** — Laba Operasional "Agustus 2026" berarti 26 Juli s/d 25 Agustus. Lebih match dengan realita arus kas gaji, tapi butuh perubahan query `get_monthly_operating_profit()` (ganti `extract(year/month from shipment_date)` jadi rentang tanggal eksplisit) DAN kemungkinan bikin bingung kalau dibandingkan ke laporan lain yang masih pakai kalender (PPh 21 tahunan, laporan pajak, dst — biasanya tetap kalender).

**Belum saya putuskan salah satu** — perlu jawaban pemilik produk sebelum `get_monthly_operating_profit()` diubah.

### Bagian F — Formatter Rupiah terpusat (SELESAI)

**`src/lib/currency.ts`** — `formatCurrency(value, options?)` SATU-SATUNYA tempat simbol "Rp" boleh ditulis di lapisan tampilan (default `currencyCode='IDR'`, siap kalau nanti ada tenant non-IDR — tapi belum ada UI yang membaca `company_settings.currency_code` per-tenant secara dinamis, itu masih hardcode default di fungsi, DISCLOSED bukan disembunyikan — lihat catatan di bawah). `formatNumberId(value)` — varian tanpa simbol utk kolom angka murni. `null`/`undefined`/`NaN` selalu jadi `"-"` (BUKAN "Rp0" — supaya tidak disalahartikan data kosong sebagai angka nyata nol), nilai 0 sungguhan tetap tampil "Rp0". **STANDING INVARIANT dijaga**: fungsi ini PURE (tidak memutasi input), pembulatan cuma terjadi di STRING HASIL, nilai sumber & seluruh perhitungan tetap presisi penuh — dibuktikan test.

**`format_rupiah_id()` (SQL, migration `20260821120000`)** — padanan untuk kalimat notifikasi yang dibuat DI DALAM Postgres (`system_alerts.message`). Dipakai di `upsert_margin_threshold_alert()` — sebelumnya menulis `Rp1523025` (angka mentah tanpa pemisah ribuan) di kalimat alert, sekarang `Rp1.523.025` konsisten dengan sisi TS.

**Disapu ke `formatCurrency`/`formatNumberId`** (7 file, semua raw `toLocaleString`/nilai mentah tanpa format diganti): `SalesOrdersPage.tsx` (panel Margin Watch — harga jual, biaya standar, margin, tiap kategori selisih, KOLOM Harga Jual di tabel baris SO yang SEBELUMNYA tidak diformat SAMA SEKALI — ditemukan saat sapuan, bukan sekadar ganti yang sudah ada), `PurchasingPage.tsx` & `CustomerPurchaseOrdersPage.tsx` (kolom Harga Satuan PO — SEBELUMNYA tampil angka mentah tanpa "Rp"/pemisah ribuan sama sekali), `ItemsPage.tsx` (kolom Biaya Standar — sama, sebelumnya mentah), `BomsPage.tsx` (kolom biaya komponen per baris BOM — sama), `HrDashboardPage.tsx` (kolom Upah — sebelumnya `{wage_rate} / {wage_type}` tanpa format), `getMarginWatch.ts`/`computeStandardLaborCostPerUnit.ts` (kalimat catatan/detail yang ditampilkan di panel Margin Watch).

**Dicek TAPI TIDAK perlu diubah** (sudah tidak menampilkan uang, atau memang belum ada UI-nya): PDF Surat Jalan (`SuratJalanPreview.tsx`) — sengaja TIDAK PERNAH menampilkan harga/biaya sama sekali (aturan Kontrol Akses Data Finansial, dokumen ini bisa dilihat pihak luar); `WorkOrdersPage.tsx`/`WarehouseDashboardPage.tsx` — `unit_cost` cuma ada di tipe data & input form mentah, tidak pernah dirender sebagai nilai terformat; Laba Operasional bulanan (`get_monthly_operating_profit`) — belum ada halaman UI yang memanggilnya sama sekali, jadi tidak ada tempat untuk disapu (dicatat supaya begitu halaman itu dibuat, WAJIB pakai `formatCurrency` sejak awal, bukan format manual baru).

**Kode mata uang per-tenant** disimpan di `company_settings.currency_code` (diisi `'IDR'` utk company_id=1) TAPI belum ada satu pun titik di kode yang MEMBACA kunci ini secara dinamis dan mengoper ke `formatCurrency({currencyCode: ...})` — semua pemanggilan saat ini pakai default `'IDR'` bawaan fungsi. Ini cukup untuk sekarang (cuma ada tenant IDR), tapi kalau nanti ada tenant currency lain, perlu kerja tambahan mengalirkan `currency_code` dari company_settings ke tiap komponen yang memformat uang — BELUM dikerjakan, dicatat eksplisit supaya tidak dikira sudah otomatis multi-currency.

**Test baru**: `tests/currency_formatter.test.ts` (12 test — format standar cocok contoh acuan "Rp1.108.255,93", angka bulat tidak dipaksa ",00", TIDAK memutasi nilai sumber, dan 5 skenario negatif: null/undefined/NaN/Infinity semua "-" bukan "Rp0" atau "RpNaN", 0 sungguhan tetap "Rp0", mata uang non-IDR belum crash, plus 3 test `format_rupiah_id` SQL termasuk pembulatan desimal & nol).

### Catatan menunggu (Bagian A-F) — JANGAN DITEBAK, tunggu konfirmasi/data

**Sudah terjawab 21 Agu 2026** (lihat "Data payroll final" & "Koreksi Bagian D/E setelah A→F" di atas): cara pembayaran Darmini, konfirmasi basis UMK, peran "Staff PPIC" (memang tidak ada), pilihan periode Laba Operasional (ikut periode gaji, SUDAH diterapkan), nama 10 PHL nyata (SUDAH menggantikan simulasi), tunjangan makan/transport per orang (SUDAH terisi, termasuk kasus khusus Bayu tunjangan bulanan tetap), BPJS Kesehatan per orang (SUDAH terisi utk 19 karyawan kontrak — Darmini masih `null`, lihat item 3 di bawah), basis BPJS per orang (SUDAH — override utk Dimas/Bayu, lainnya pakai formula clamp).

**Masih menunggu:**
1. **Harga stok Plant Ruko Dieng (CSV)** — jalur & klasifikasi sudah siap, pemuatan tertunda sampai data harga datang.
2. **Kategori tunjangan makan/transport untuk jabatan yang tidak persis cocok ke 3 tingkatan awal** — SUDAH TERJAWAB oleh data lengkap 21 Agu (tabel per orang), item ini kadaluarsa/tidak relevan lagi.
3. **Keikutsertaan BPJS Kesehatan Darmini** — belum ada di data yang diberikan (dia peran pendukung/janitor, mungkin memang tidak relevan) — dampaknya kecil tapi tetap ikut ke rata-rata kru `wage_type=monthly` company-wide (lihat gap #6 di bawah).
4. **Apakah model biaya pemberi kerja (Bagian D) perlu diperluas ke PHL selain tunjangan** (BPJS untuk PHL) — saat ini PHL sudah ikut tunjangan (baru ditambal 21 Agu) tapi BELUM ikut BPJS Kesehatan/JKK/JKM/JHT — tidak dikonfirmasi apakah PHL informal ini terdaftar BPJS.
5. **Aturan atribusi tunjangan makan/transport ke batch produksi tertentu** — sisi biaya SDM AKTUAL per batch (`compute_production_batch_labor_cost`) sengaja belum menghitung tunjangan (per hari hadir, bukan per batch).
6. **Rata-rata tarif kru company-wide TIDAK difilter per plant/departemen** — imprecision yang sudah diketahui sejak Bagian B, sekarang nyata dampaknya: Darmini (janitor, bukan produksi) ikut masuk rata-rata kru gummy karena sama-sama `wage_type=monthly`. Belum diperbaiki.
7. **Apakah overhead SDM (`monthly_overhead_baseline`) sebaiknya dihitung sebagai SISA** (total biaya pemberi kerja semua karyawan − biaya SDM tercatat di batch) — MASIH statis manual (Rp73.352.547, direkonsiliasi ke rekonsiliasi 21 Agu, selisih ±1,8% karena beda basis standar-vs-aktual, BUKAN bug). Formula SISA belum dibangun — butuh cara menentukan batch mana masuk periode gaji mana (`production_batches.started_at` sudah ada, belum dipakai untuk ini).
8. **Jawaban tim finance** — dokumen pertanyaan sudah dikirim pemilik produk, belum ada jawaban.

---

## Margin Watch Lapis 1-2 — 20 Agu 2026 (commit `b3938d4`, CI hijau)

Fitur BARU: pengawasan margin BERJALAN per order (bukan cuma margin realized setelah kirim seperti `get_sales_order_margin` yang sudah ada). Detail lengkap desain & kategori ada di komentar `getMarginWatch.ts` dan `docs/rancangan-skema-database-mrp.md` (bagian `sales_order_line_margin_snapshots`). Ringkasan:

- **Lapis 1**: baseline margin rencana dikunci sekali per baris SO (pola sama persis snapshot standar K8/kelayakan). Biaya SDM standar SENGAJA kosong — `routing_steps` belum menyimpan jumlah orang per tahap, genuinely tidak bisa dihitung, bukan lupa.
- **Lapis 2**: 5 kategori selisih dihitung LIVE dari data nyata (harga bahan/kemasan vs harga master, pemakaian vs BOM standar, reject, SDM aktual, lembur/shift tambahan). Kategori tanpa data cukup ditandai eksplisit "belum bisa dihitung", tidak pernah diam-diam 0.
- **Peringatan otomatis**: alert_type baru `margin_threshold_breach` ke department finance+management saat proyeksi menembus ambang yang bisa diatur pemilik order.

**TEMUAN PENTING #1 — bug di infrastruktur alert yang sudah ada, ditemukan lewat percobaan nyata**: `upsert_department_alert()`/`resolve_department_alerts()` (dipakai alert lain: material_shortage dkk) sejak migration `20260819150000` (audit keamanan sesi sebelumnya) mengharuskan `company_id` diturunkan dari `related_work_order_id` ATAU `related_item_id` — kalau KEDUANYA null, fungsi **diam-diam return tanpa melakukan apa pun** (`resolve` tidak benar-benar mengubah status, dibuktikan lewat test langsung ke RPC). Alert margin (terkait `sales_order_line`, bukan WO/item) persis kena kasus ini. **Solusi yang dipakai**: fungsi mandiri baru `upsert_margin_threshold_alert()` (migration `20260820190000`), TIDAK menyentuh 2 fungsi lama itu (risiko efek samping ke pemanggil nyata lain belum diaudit penuh). **Kalau nanti alert_type BARU LAIN muncul yang juga tidak terkait WO/item, kena masalah yang sama** — perlu perbaikan di akar (fungsi lama itu sendiri) atau bikin fungsi mandiri lagi seperti ini.

**TEMUAN PENTING #2 — data PO Box Drinkme di sistem TIDAK cocok dengan skenario yang diberikan sebagai acuan**: pemilik produk memberi contoh "harga master Rp1.500 vs PO sungguhan ke CV Gasper Rp2.925" sebagai kasus nyata yang HARUS terdeteksi sistem. Dicek: PO CV Gasper yang tercatat di sistem (dibuat sesi sebelumnya, `purchase_order_id: 7`) punya `unit_price: 1.500` — SAMA dengan master, BUKAN Rp2.925. Ini karena saat PO itu dibuat, harga sungguhan belum diberikan ke saya, jadi Rp1.500 dipakai sebagai placeholder (mengikuti harga master) — bukan angka nyata. **Belum saya perbaiki sendiri** (mengubah data transaksi finansial nyata butuh konfirmasi eksplisit, bukan tebakan dari deskripsi chat) — mekanismenya SUDAH terbukti benar lewat test dengan fixture terpisah (persis reproduksi kasus Rp14,25 juta), tinggal `purchase_order_lines.unit_price` untuk PO #7 dikoreksi ke Rp2.925 (lewat jalur resmi, bukan UPDATE langsung) begitu dikonfirmasi, baru Margin Watch SAS005 asli akan menampilkan temuan itu.

**Verifikasi nyata terhadap SAS005 (sebelum diperbaiki di atas)**: kategori Selisih Harga SUDAH menemukan Rp28,25 juta selisih POSITIF (bahan lebih murah dari harga master) dari data saldo-awal Karanglo yang nyata (Inulin, Psylium Husk, dll) — membuktikan mekanisme jalan di data produksi asli, bukan cuma fixture uji.

**Belum dikerjakan (di luar cakupan sesi ini)**: Lapis 3 (7 tuas perbaikan margin — diminta eksplisit "kerjakan SETELAH Lapis 1-2 terbukti jalan"), dan reframe tampilan kelayakan SAS001 dari biner FEASIBLE/TIDAK jadi kurva proyeksi pengiriman (diminta "sekalian" di pesan yang sama, TAPI merupakan fitur terpisah yang cukup besar — belum disentuh, perlu sesi/giliran kerja sendiri).

---

## ATURAN BAKU MIGRASI — WAJIB DIBACA SEBELUM MENULIS `CREATE FUNCTION` BARU

Ditulis setelah audit keamanan menyeluruh 19 Agu 2026 menemukan 12+2 fungsi database bisa dipanggil anon key TANPA login sama sekali (lihat bagian "Audit Keamanan Menyeluruh" di bawah untuk kronologi lengkap).

**Setiap `CREATE FUNCTION` baru yang tidak dimaksudkan untuk diakses publik WAJIB diikuti baris ini SEBELUM `grant execute` ke role yang dituju:**

```sql
revoke execute on function public.nama_fungsi(tipe, tipe, ...) from public, anon, authenticated;
grant execute on function public.nama_fungsi(tipe, tipe, ...) to service_role; -- atau role spesifik lain
```

**`revoke ... from public` SAJA TIDAK CUKUP di Supabase.** Postgres memang memberi PUBLIC execute otomatis ke fungsi baru — tapi Supabase JUGA memberi grant TERPISAH ke `anon` dan `authenticated` lewat default privileges platform-nya sendiri, yang TIDAK ikut tercabut oleh revoke dari PUBLIC. Ini dibuktikan dua kali di sesi yang sama: pertama pada fungsi K8 (`decide_production_standard_proposal`, yang bahkan tidak punya revoke sama sekali), lalu pada `debug_list_policies` yang SUDAH punya "revoke all from public" sejak 2 Agustus lalu tapi TERBUKTI tetap bisa dipanggil anon key — dan lucunya, saat menambal itu, `debug_list_function_grants` yang BARU dibuat untuk mengaudit masalah ini juga kena bug yang sama (revoke-nya cuma "from public", ketahuan otomatis oleh test regresi yang baru ditulis pada sesi yang sama). **Selalu tulis ketiganya secara eksplisit: `from public, anon, authenticated`.**

**Test regresi permanen** (`tests/function_grant_security_audit.test.ts`) mengenumerasi SELURUH fungsi di schema public dan GAGAL kalau ada fungsi yang punya EXECUTE untuk PUBLIC/anon/authenticated tanpa masuk allowlist eksplisit di file itu. Kalau fungsi baru Anda genuinely perlu akses luas (jarang — kebanyakan fungsi harusnya HANYA `service_role`), tambahkan ke `ALLOWED_BROAD_GRANT` di test itu DENGAN ALASAN TERTULIS, jangan lewatkan test-nya dengan cara lain.

**Kalau fungsi dipanggil bersarang dari fungsi trigger lain (bukan dari app layer):** tidak perlu grant ke `service_role` sama sekali — fungsi trigger berjalan sebagai OWNER (karena `SECURITY DEFINER`) yang selalu punya hak implisit, jadi panggilan bersarang itu tidak terpengaruh oleh revoke dari public/anon/authenticated.

**Kalau fungsi dipanggil dari dalam ekspresi RLS policy** (`jwt_company_id()`, `is_super_admin_user()`, dst) — role yang mengeksekusi query (`authenticated`/`anon`) WAJIB tetap punya EXECUTE, karena RLS dievaluasi di bawah role pemanggil query itu sendiri. Mencabut grant di sini akan mematikan RLS untuk SEMUA user sungguhan, bukan menutup lubang keamanan. Untuk fungsi kelas ini, keamanan yang benar adalah memastikan fungsinya sendiri tidak menerima parameter yang bisa dipalsukan (lihat catatan `is_super_admin_user`/`user_has_no_company` di bawah) — bukan mencabut grant-nya.

---

## Data Lapangan Nyata Routing Serbuk + BOM 2-Tingkat + Shift 2 + Investigasi Praktik Pabrik — 20 Agu 2026

Ditulis atas instruksi gabungan pemilik produk (data lapangan riil menggantikan asumsi/placeholder sebelumnya). Semua build item: typecheck bersih, `npm run build` sukses, test suite **15 file / 79 test lulus** (11 test baru sesi ini). Commit `34b770c` (kelayakan sadar-tahap) + `871438b` (laju/kapasitas/shift/nomor batch), keduanya dipush ke `main` atas izin eksplisit pemilik produk ("commit & push sekarang, tidak perlu menunggu saya coba dulu").

### 1. Kelayakan jadwal SADAR-TAHAP (commit `34b770c`)
Sebelum ini, SEMUA komponen BOM (termasuk kemasan tahap AKHIR, mis. Box di "Filling Box") dianggap memblokir MULAINYA produksi — ditemukan dari kasus SAS005 nyata. Perbaikan: `bom_lines.routing_step_id` (nullable, default = perilaku lama/tahap pertama, TIDAK ADA REGRESI) menandai tahap routing yang MULAI memakai tiap komponen; `explodeBomRequirements` mewariskan tahap itu lewat rekursi BOM berjenjang; `getPlanningFeasibility` sekarang memisahkan `production_start_blocked_until` (kapan MULAI) dari `order_ship_ready_date` (kapan SELESAI/kirim, mempertimbangkan bahan tahap belakangan). UI Sales Order menampilkan kedua tanggal terpisah + daftar "Bahan Tahap Belakangan". BOM editor (`/boms`) punya dropdown "Tahap SOP (opsional)" per komponen, disembunyikan kalau item induk belum punya routing. 3 test baru (`planning_feasibility_stage_aware.test.ts`) membuktikan: bahan tahap akhir TIDAK memblokir mulai (inti perbaikan), item TANPA routing tetap 100% perilaku lama (regresi-guard).

### 2. Routing serbuk 10-tahap NYATA menggantikan placeholder 12-tahap sesi sebelumnya
Placeholder 12-tahap (dari PDF SOP lama, dibangun sesi sebelum ini) DIHAPUS TOTAL, diganti data lapangan riil dari pemilik produk. **Arsitektur berubah jadi 2 ROUTING TERPISAH** (bukan 1 routing 10 tahap seperti draf awal saya) — mengikuti kenyataan operasional "sachet stock" (sachet diproduksi shift 2 malam, dipakai tim pagi besoknya sebagai stok antara):
- **Routing A — item `PMSC001ITM` (Sachet Minuman Serbuk, WIP)**: 1 Persiapan & penimbangan (60 mnt, tim GUDANG bukan produksi, H-1, per 3 batch) → 2 Premix Mixing (30 mnt) → 3 Batch Mixing (45 mnt, konservatif dari rentang 30-45) → 4 Filling Sachet (BOTTLENECK, laju — lihat poin 3) → 5 QC Sachet (30 mnt, placeholder kontinu).
- **Routing B — item `PMBX001ITM`/75 (Box Minuman Serbuk Isi 14 Sachet)**: 1 Persiapan kemasan sekunder → 2 Filling Box → 3 Lem Box → 4 Wrap & Shrink → 5 QC final + pengemasan karton (semua placeholder 20-30 mnt, belum ada angka pasti dari pemilik produk).
Semua durasi tetap ditandai `ESTIMASI_MANUAL` di `production_standards` (pola K8, `sample_count=0`) — akan otomatis diperbarui begitu K8 belajar dari batch sungguhan. **Kecuali tahap 4 (Filling Sachet)** — TIDAK diseed ke `production_standards` karena tabel itu belum punya slot metric untuk laju (lihat poin 3), dicatat sebagai utang teknis di bawah.

### 3. 2 kemampuan generik baru (diminta eksplisit, bukan solusi khusus SAS005)
- **`routing_steps.duration_per_unit_minutes`** (numeric, nullable) — tahap berbasis LAJU (mis. Filling Sachet: 2 mesin × 15-20 pcs/menit, dipakai midpoint gabungan 35 pcs/menit → 0,02857 mnt/pcs). Kalau terisi, durasi aktif sebenarnya = qty batch × nilai ini, BUKAN `active_duration_minutes` tetap. **Satu sumber logika** (`src/features/mrp/server/stepDuration.ts`, `getEffectiveStepDurationMinutes()`) dipakai KONSISTEN di Gantt Produksi (posisi & lebar blok), Dashboard Kapasitas, dan detail blok Gantt — tidak ada rumus ganda.
- **`work_centers.unit_count`** (integer, default 1) — jumlah unit mesin identik paralel (mis. 2 mesin Filling Sachet, work center baru "Mesin Filling Sachet"/`WC-FILLING-SACHET` di Karanglo, `unit_count=2`, kapasitas 8 jam/hari/unit — **perlu dikonfirmasi jam kerja riilnya ke pemilik produk**, sekarang cuma dugaan). Kapasitas efektif Dashboard Kapasitas = `capacity_hours_per_day × unit_count`. UI `/ppic` sekarang punya kolom kedua "× unit" di editor kapasitas Work Center.
- **Utang teknis dicatat**: job pembelajaran K8 (`learnFromBatchCore.ts`) belum bisa mempelajari tahap berbasis laju (cuma `active_duration_minutes` tetap) — begitu batch Filling Sachet sungguhan selesai, laju 0,02857 mnt/pcs TIDAK otomatis diperbarui dari data aktual. Perlu perluasan K8 terpisah kalau pemilik produk mau ini otomatis.
- 2 test baru (`rate_capacity_and_shift_wage.test.ts`) membuktikan: durasi = qty × laju (bukan `active_duration_minutes`) DAN fallback ke `active_duration_minutes` tetap kalau laju NULL (regresi-guard).

### 4. BOM Drinkme kembali ke 2 TINGKAT — `PMSC001ITM` dipakai ulang (keputusan pemilik produk)
Dikonfirmasi: sachet adalah stok antara yang benar-benar dikelola. BOM lama (bom_id 277, v2, flat — bahan mentah+premix langsung ke Box) **diarsipkan** (`status='archived'`, bukan dihapus). BOM fiktif lama `PMSC001ITM` (bom_id 38, v1, dari `scripts/seed-debug-powder-drink.js`, mereferensikan item duplikat `PMPW0001ITM` "data uji bukan resep asli") juga **diarsipkan**. **2 BOM baru aktif dibangun:**
- `PMSC001ITM` (bom_id 534, v2): bahan mentah + premix (rasio LAMA dibagi 14, karena 14 sachet = 1 box) + 1 pcs `PMPKF001ITM` (kantong sachet kosong, ditandai tahap 4 Filling Sachet). Bahan mentah/premix SENGAJA dibiarkan `routing_step_id` NULL (setara tahap pertama) — "tahap 1-3" yang diminta pemilik produk tidak granular per-bahan, jadi tidak dipaksakan ke tahap spesifik tanpa data itu.
- `PMBX001ITM`/item 75 (bom_id 535, v3): 14× `PMSC001ITM` (NULL/tahap-pertama Routing B — finishing tidak bisa mulai tanpa stok sachet), 1× Box (tahap 2 Filling Box), 1× Plastic Wrap (tahap 4 Wrap & Shrink), 0,02381× Karton (tahap 5 QC final+pengepakan). **Silica Gel BELUM dimasukkan** — lihat poin 6.
**Verifikasi ekivalensi kuantitas** (bukan reproduksi angka spec lama Rp4.965.906,16 — metodologi lebih kuat: membuktikan kuantitas SETIAP bahan sampai ke akar via `explodeBomRequirements`, yang otomatis berarti biaya total juga ekivalen dengan metode costing APA PUN): dihitung kebutuhan 20 bahan/kemasan untuk 10.000 box SEBELUM dan SESUDAH restrukturisasi — **error relatif maksimum 0,0001% (1 per sejuta)**, murni pembulatan kolom `numeric(14,6)` Postgres, jauh di bawah presisi timbangan pabrik manapun. Gudang/PPIC sekarang bisa lihat stok sachet siap-box sebagai persediaan tersendiri lewat `/items` & `/boms` seperti item WIP lain.
**Dampak:** `PMSC001ITM` DIKELUARKAN dari daftar "2 item orphan lama" di bagian "(c) Utang teknis" ringkasan konsultan di bawah — sudah dipakai ulang secara aktif, bukan orphan lagi. `PMPW0001ITM` (item duplikat lama) TETAP orphan, masih perlu keputusan terpisah (hapus atau arsipkan permanen).

### 5. Shift 2 + upah PHL sadar-shift + penanda lembur
Shift 1 (08.00-16.00) dan Shift 2 (16.00-22.00, 6 jam, untuk produksi sachet stock) dibuat di plant Karanglo. **Perbaikan `compute_production_batch_labor_cost()`**: PHL (`wage_type='daily'`) yang kerja shift 1 DAN shift 2 di hari yang sama sekarang dihitung sebagai **2 HARI KERJA TERPISAH** (Rp50.000 + Rp50.000 = Rp100.000), bukan dipecah rata 13 jam ÷ 7 jam seperti sebelumnya — pembagi tarif per jam sekarang jam SHIFT yang bersangkutan (dari `shifts.start_time/end_time` lewat `shift_id` di baris assignment), bukan 1 angka weekday/Saturday global. Baris TANPA `shift_id` (data lama/peran non-shift) tetap pakai fallback lama (regresi-guard, diuji). **Penanda lembur** (`work_order_assignments.is_overtime`, checkbox baru di form Catat Jam Kerja `/work-orders`) — tarif lembur BELUM ditentukan pemilik produk, jadi TIDAK ditebak; baris tetap dihitung tarif normal, cuma ditandai untuk dikoreksi nanti. 3 test baru membuktikan: shift-terpisah = Rp100rb (bukan blended), fallback tanpa shift = perilaku lama persis, is_overtime tidak mengubah tarif.
**Belum dikerjakan (di luar cakupan diminta)**: "kalender kerja tenant mendukung >1 shift per hari, kapasitas harian = jumlah shift aktif" — secara STRUKTURAL sudah didukung (shifts bukan tabel terikat tanggal, WO/batch bebas pilih shift mana pun), TAPI kalkulasi hari-kerja feasibility (`countWorkingDays`/`getWorkingDaysPerWeek`) masih menghitung 1 hari = 1 unit kapasitas, belum melipatgandakan berdasarkan jumlah shift aktif hari itu. Ini perubahan lebih luas (menyentuh banyak fungsi hari-kerja) — belum disentuh, tunggu keputusan eksplisit kalau memang dibutuhkan.

### 6. Silica Gel — item & stok SUDAH ada, BOM line MENUNGGU qty
Dicek: item `PKG-SILICA-GEL-2G` (item_id 1041) dan lot saldo awal 1.403 pcs @ Rp92,2646 SUDAH tercatat (dimuat sesi sebelumnya lewat `scripts/load-saldo-awal-karanglo.js`). **Belum ditambahkan ke BOM Drinkme** — jumlah per box belum diketahui pemilik produk, TIDAK ditebak sesuai instruksi. Begitu qty dikonfirmasi: tambahkan bom_line ke bom_id 535 (`component_item_id`=1041, `routing_step_id`= tahap 2 "Filling Box" direkomendasikan — pemilik produk sebut "tahap 6-7" versi 12-tahap lama, setara "Persiapan kemasan sekunder"/"Filling Box" di Routing B baru).

### 7. Verifikasi ulang feasibility SAS005 dengan routing & kapasitas NYATA
`GET /api/sales-order-lines/201/planning-feasibility` dihitung ulang setelah restrukturisasi — **hasil numerik IDENTIK dengan sebelum restrukturisasi** (realistic_qty=6.107, order_ship_ready_date=2026-09-19, `production_start_blocked_until=null`), membuktikan restrukturisasi BOM 2-tingkat + routing baru tidak mengubah kesimpulan bisnis, cuma memperbaiki BAGAIMANA sistem sampai ke kesimpulan itu (sekarang benar secara model, bukan kebetulan benar). Box (`PMPKB001ITM`) tetap jadi pemicu utama tanggal selesai (ETA PO 3 Sep, tahap 2 Filling Box Routing B). **Dikonfirmasi pemilik produk (bukan gap sistem)**: 11 bahan mentah SAS005 + 5 bahan Gummy SAS001 (Maltitol, Polysorb, Perfecta 928, Perfecta MB, Gellan) memang BELUM DIORDER pabrik — sistem melaporkan kenyataan dengan benar, tidak ada perbaikan kode diperlukan; PO akan diinput menyusul begitu dikeluarkan pabrik.

### 8. Nomor batch — rekomendasi + boleh ditimpa (keputusan pemilik produk)
Format lama: OTOMATIS SAJA, `WO-{id}-B{urutan}`, tidak bisa diisi manual sama sekali, unik cuma per Work Order. Sekarang: staf boleh isi `batch_number` sendiri (mis. format pabrik "3TM13082601") lewat form "Buat Batch Baru" di `/work-orders` — dipakai APA ADANYA, tidak ditolak/dipaksa format lain; kosongkan untuk tetap dapat rekomendasi otomatis. Keunikan diperketat ke **per PERUSAHAAN** (`unique(company_id, batch_number)`, migration `20260820160000`) — dicek dulu sebelum migrasi: 0 dari 7 batch yang ada sekarang bentrok (semua masih format otomatis lama, sudah unik alami), nomor batch LAMA tidak diubah sama sekali. 4 test baru membuktikan rekomendasi otomatis tetap jalan, override dipakai apa adanya, DAN 2 skenario negatif (nomor sama di WO lain DITOLAK, nomor sama di WO sama juga DITOLAK).
**Catatan jujur**: "kode lini/produk" di contoh format pabrik ("3TM") TIDAK ada padanan datanya di sistem (tidak ada konsep "kode lini produksi" tersimpan) — rekomendasi otomatis TETAP format lama (`WO-xxxx-Bxxx`), BUKAN mencoba meniru "3TM13082601" (akan mengarang kode lini kalau dipaksakan). Kalau pemilik produk mau rekomendasi otomatis benar-benar meniru format pabrik, perlu data "kode lini per plant/item" dulu.

### 9. Pemeriksaan a-d (laporan produksi harian nyata, 13 Agu 2026 — CONTOH FORMAT, bukan data SAS005 sungguhan, lihat poin 10)
- **(a) Progres tahap tanggal berbeda dari hari pencatatan — SUDAH DITAMBAL (20 Agu 2026, commit `b13a554`).** `recordWorkOrderStepProgress.ts` sekarang menerima `record_date` opsional (default hari ini, TIDAK dipaksa) — dilekatkan ke `started_at`/`completed_at` yang tersimpan. Batas: ditolak kalau MASA DEPAN atau SEBELUM `production_batches.created_at` batch itu; peringatan lembut (bukan blokir) kalau >7 hari ke belakang. **Penjagaan tambahan yang ditemukan perlu selama pengerjaan**: K8 (`learnFromBatchCore.ts`) sekarang membuang sampel `active_duration_minutes` di atas 480 menit (1 shift) — mencegah start & complete tahap yang sama dicatat backdate di 2 TANGGAL BERBEDA (rentang kalender berhari-hari) mencemari pembelajaran durasi dengan angka salah (mis. "Mixing butuh 2880 menit" karena dicatat mulai tanggal 11, selesai tanggal 13). Form pencatatan di `/ppic` (dialog detail Gantt) dan `/production` (form ringkas) keduanya punya input tanggal ini sekarang. 5 test membuktikan (termasuk 2 negatif: tanggal masa depan ditolak, tanggal sebelum batch dibuat ditolak) + 1 test membuktikan sampel K8 yang tidak masuk akal benar-benar dibuang.
- **(b) Reject per tahap — SUDAH DITAMBAL (20 Agu 2026, commit `b13a554`).** `work_order_step_progress.qty_reject`/`reject_reason` (migration `20260820170000`). **Model yang dipakai (dilaporkan sesuai instruksi sebelum membangun)**: `qty_recorded` TETAP berarti persis seperti sebelumnya — "output BAIK/terpakai" — TIDAK diubah maknanya. `qty_reject` adalah field TAMBAHAN murni yang menjelaskan SEBAGIAN dari total susut (`qty_input − qty_recorded`) itu memang reject, bukan penguapan/proses biasa — divalidasi `qty_reject ≤ qty_input − qty_recorded` (ditolak kalau tidak konsisten, mis. input 100/output 95/reject 20 tidak masuk akal karena 95+20>100), juga ditolak kalau negatif atau lebih besar dari input sendirian. **Konsekuensi ke K8**: TIDAK PERLU ubah rumus `yield_percentage` (`lastStep.qty_recorded ÷ firstStep.qty_input`) sama sekali — karena `qty_recorded` sudah SELALU berarti "output baik" (reject sudah otomatis tidak ikut), yield yang dipelajari K8 sudah otomatis reject-aware begitu field baru ini dipakai staf secara konsisten ke depan. **Catatan jujur soal data historis**: kalau SEBELUM ada field ini staf terpaksa mencampur reject ke dalam `qty_recorded` (karena tidak ada tempat lain), sampel `yield_percentage` LAMA di sistem bisa saja sedikit terlalu optimis — tidak bisa dikoreksi retroaktif tanpa tahu batch mana yang kena, tidak disentuh. Reject tampil di "Ringkasan Yield Batch" (`/ppic`) per tahap + total batch, dengan % dari total susut yang merupakan reject. 4 test membuktikan (3 negatif: reject negatif ditolak, reject > input ditolak, reject tidak konsisten dengan susut ditolak; 1 positif: tampil benar di laporan).
- **(c) Qty aktual bebas (55kg vs standar 60kg) — SUDAH BISA, tidak ada blocker.** `qty_input`/`qty_recorded` menerima angka apa pun yang dikirim, tidak ada validasi yang memaksa cocok dengan `planned_qty`/standar BOM — sudah diverifikasi lewat pembacaan kode langsung.
- **(d) Format nomor batch — lihat poin 8 di atas (sudah ditambal).**

### 10. Konteks "Queensi" (merek lain klien yang sama, PT Sastro Media) — tidak ada gap arsitektur
Dikonfirmasi pemilik produk: laporan produksi 13 Agu adalah varian LAIN (Queensi Drinkme versi Brigit), BUKAN data SAS005 (Drinkme Lemon) — dipakai cuma sebagai contoh FORMAT pencatatan lapangan, TIDAK dijadikan data SAS005 (tidak ada perubahan yang dibuat berdasarkan angka laporan itu). Dicek: sistem SUDAH nyaman menangani banyak VARIAN produk untuk klien yang sama — `items` tidak punya kolom "brand"/"customer" sama sekali, tiap varian (Drinkme Lemon vs versi Brigit, Zala isi 60 vs isi 30, dst) cukup jadi baris `items` terpisah dengan `boms`/`routings` masing-masing, sepenuhnya independen, tidak ada risiko tercampur. Tidak ada yang perlu dibangun.

### 11. Data stok Plant Ruko Dieng (gummy) — jalur & klasifikasi SIAP, pemuatan DITUNDA
File sumber ditemukan (`~/Downloads/STOCK OPNAME.csv`, 242 baris, format CODE/NAME/STOK/UNIT/ROW BASE/PACKAGING — TANPA harga). `scripts/load-saldo-awal-rukodieng.js` dibangun (pola sama dengan `load-saldo-awal-karanglo.js`, lewat API resmi `/api/stock-adjustments/opening-balance`) dengan **penjaga eksplisit: MENOLAK memuat apa pun sampai `--price-file=` diberikan** — tanpa itu, script cuma jalan mode LAPORAN (sudah dijalankan, aman, tidak menyentuh database). Temuan nyata dari laporan itu:
- **132 baris stok > 0** akan jadi lot begitu harga tersedia; **103 baris stok = 0** TIDAK dimuat & item master TIDAK otomatis dibuat (banyak kelihatan sisa/rencana lama, tidak dibanjiri ke master data tanpa perlu jelas).
- **7 baris stok NEGATIF** (persis dugaan pemilik produk): `KP-POUCH-02` −10, `KP-POUCH-01` −15, `BASE-01` (Gummy Premix) −154, `SORBI-02` −164, `BASE-02` (Gummy Premix 2 Sweet Pearl) −210, `BASE-03` (Gummy Premix Order 3) −1.000, `SORBI-01` (Sorbitol) −202.030 gram — TIDAK akan dimuat sebagai negatif (lot qty≤0 memang sudah ditolak `create_opening_balance_lot`, diverifikasi lewat test baru), akan dicatat di laporan pemuatan sebagai selisih untuk diinvestigasi gudang.
- **Klasifikasi khusus sudah terprogram di script**: `BASE-04` "GUMMY PREMIX ORDER 4" (163.265 g) → type `wip` (bukan raw_material); `KP-BOT-ZALAS-GC30` "BOTOL ZALA PUTIH KECIL" (905 pcs) → akan jadi item BARU terpisah (bukan dipetakan ke botol N200 SAS001 — produk beda, isi 30 vs isi 60); 14 baris barang merek lain (Nilaya/Bastian/Queensi) tetap diklasifikasi & akan dimuat demi traceability, tidak di-skip.
- **Menunggu**: file harga terpisah (format `CODE,UNIT_COST`) dari gudang sebelum pemuatan sungguhan bisa jalan. Setelah dimuat, feasibility SAS001 diharapkan menampilkan 8 bahan gummy yang kurang (Maltitol 430,5kg dkk, dikonfirmasi pemilik produk MEMANG belum diorder) — belum bisa diverifikasi sekarang karena pemuatan masih tertunda.

---

## Data Kemasan SAS005 dari Pabrik + Temuan #4/#5 — 19 Agu 2026

### TEMUAN PALING PENTING — SAS005 sekarang TIDAK FEASIBLE untuk qty penuh

Setelah PO box Drinkme (CV Gasper, ETA konservatif 3 Sep) dicatat sungguhan, deteksi kelayakan SAS005 BERUBAH dari "feasible-ketat" jadi **TIDAK FEASIBLE**: produksi baru bisa mulai isi box 3 Sep (nunggu box datang), menyisakan cuma 9 hari kerja sampai deadline 12 Sep — padahal butuh 15 hari kerja (45 batch ÷ 3/hari). **Realistis cuma ±6.107 dari 10.000 pcs yang bisa terkirim tepat waktu.** Ini persis risiko yang disebut Track A2 `docs/rencana-kerja-fase-produksi-nyata.md` ("jalur kritis nyata deadline 12 Sep") — sekarang terbukti dengan angka nyata, bukan perkiraan. **Perlu tindakan bisnis Anda**: negosiasi pengiriman parsial dengan client (Track A1) atau percepat kedatangan box kalau memungkinkan.

### 1. Saldo Awal dimuat (Plant Karanglo, lewat jalur resmi/RPC, bukan insert langsung)
- **Sachet Drinkme**: dicatat **260.000 pcs** (130 roll × 2.000 sachet/roll) — bukan 130 roll. Item `PMPKF001ITM` ber-`base_uom` pcs dan BOM Drinkme memakainya "14 pcs per box", jadi pcs adalah satuan yang konsisten dengan cara BOM menghitung, bukan roll. Harga Rp138/pcs (sudah ada di master item, cocok dengan daftar harga Anda). Lot: `SALDO-AWAL-KARANGLO-SACHET-DRINKME-190826`.
- **Plastic Wrap Box**: dicatat **6.000 pcs** (2 roll × 3.000/roll), alasan satuan sama seperti di atas. Harga Rp200/pcs (sudah ada di master item). Lot: `SALDO-AWAL-KARANGLO-PLASTIC-WRAP-190826`.
- **Terbukti**: setelah dimuat, Sachet HILANG dari daftar kekurangan bahan SAS005 (sebelumnya kurang 140.000); Plastic Wrap Box MUNCUL kurang **4.000** (butuh 10.000, stok 6.000) — persis seperti prediksi Anda.

### 2. PO Supplier dicatat (lewat jalur resmi, belum diterima)
- **Supplier baru dibuat**: CV Gasper (percetakan), lead time 14 hari.
- **PO Box Drinkme (PMPKB001ITM)**: qty **10.000 pcs** (sesuai instruksi — ini kebutuhan minimum, **BUKAN angka pasti dari pemilik produk**). ETA 3 September 2026. **⚠️ PERLU DIKONFIRMASI ULANG: qty pesanan sungguhan ke CV Gasper begitu Anda dapat angkanya dari pemilik produk** — kalau beda dari 10.000, PO ini perlu diedit.
- **Karton isi 42 (PKG-KARTON-SERBUK-42, kebutuhan 239 karton) — BELUM dicatat sebagai PO.** Instruksi eksplisit: tidak mencatat PO tanpa nama supplier (bukan menebak/pakai supplier fiktif). **⚠️ PERLU: nama supplier percetakan karton ini dari pemilik produk**, baru bisa dicatat sebagai PO resmi. Sampai itu didapat, item ini tetap muncul di daftar kekurangan bahan SAS005 sebagai kebutuhan beli murni (kurang 238 karton), belum ada ETA yang bisa dipakai sistem.

### 3. Opname — akses diperluas ke warehouse_staff
Lihat bagian "Extend stock adjustment/opening-balance access" — commit terpisah, sudah diuji & di-push. `STOCK_ADJUSTMENT_ROLES` sekarang termasuk `warehouse_staff`, digerbang juga di level database (bukan cuma UI), role di luar gudang tetap ditolak.

### 4. Kategori downtime yang ADA SEKARANG (dicek query, bukan dari ingatan) — BELUM diubah, menunggu penilaian Anda
5 kategori tersedia di sistem (`production_disruptions.disruption_type`): **Mesin Rusak** (`equipment_breakdown`), **Listrik/Utilitas Padam** (`utility_outage`), **Faktor Eksternal** (`external_factor`), **Dialihkan ke Pekerjaan Lain** (`reprioritized`), **Lainnya** (`other`). Data nyata yang sudah tercatat di dev sejauh ini: 5 kejadian, SEMUANYA `utility_outage`. Silakan nilai dari jalan kaki: apakah 5 kategori ini sudah cukup mewakili kondisi lapangan.

### Daftar kekurangan bahan SAS005 TERBARU (setelah 1 & 2 di atas)
Maltodextrin, Inulin, Psylium Husk, Polydextrose, Derasi Orange, Papain, Bromalin, Garcinia Cambogia, **Box Drinkme (10.000, menunggu PO)**, **Plastic Wrap Box (4.000, BARU muncul)**, Zoefree, Garam, Sereh Powder, Karton Serbuk (238, belum ada PO). Sachet TIDAK lagi muncul.

---

## Fase Produksi Nyata — P1/P2/P3 (3 blocker pra-jalan ditambal) — 19 Agu 2026

Menindaklanjuti 3 dari 5 temuan `docs/checklist-audit-jalan-kaki.md` yang sudah jelas blocker tanpa perlu menunggu hasil jalan kaki pemilik produk (temuan #4 opname & #5 kategori downtime tetap menunggu, keduanya butuh penilaian lapangan bukan keputusan teknis).

- **P1 — "Mulai Batch"/"Selesaikan Batch"**: state machine-nya SUDAH ADA di database sejak migration `20260817100000` (`production_batches` planned→in_progress→completed terdaftar di `status_transition_rules`), cuma belum ada kode aplikasi yang memicunya. 2 endpoint baru (`start`/`complete`) cuma melakukan UPDATE status biasa — trigger `enforce_status_transition` yang menegakkan, tidak di-bypass. Menyelesaikan batch OTOMATIS mengajukannya sebagai sampel K8 (gerbang kelengkapan yang sudah dibangun sesi sebelumnya) — batch dengan log tahap belum lengkap TETAP boleh diselesaikan, cuma dikecualikan dari pembelajaran (bukan diblokir).
- **P2 — Panel Kelayakan/Kekurangan Bahan**: fitur yang dipakai sepanjang analisis SAS001/SAS005 sesi-sesi sebelumnya akhirnya dirender nyata (tombol "Cek Kelayakan" di halaman Sales Order). Sekaligus DIPERBAIKI: deteksi kekurangan bahan sebelumnya cuma 1 level (komponen BOM langsung), melewatkan kasus nyata Maltodextrin dipakai langsung DAN sebagai carrier di 5 premix sekaligus. Sekarang eksplosi BOM berjenjang penuh (`explodeBomRequirements.ts`). Akses juga diperluas — sebelumnya cuma `canViewFinancialData` (tidak termasuk PPIC/Purchasing!), sekarang `canViewPlanningFeasibility` (leadership + PPIC + Purchasing).
- **P3 — "Jadwal Hari Ini"**: role Produksi sebelumnya SAMA SEKALI tidak punya akses ke tampilan berjadwal (Gantt Harian cuma untuk PPIC). Card baru di halaman Produksi, difilter ke plant operator via `employees.linked_user_id` (bukan kolom baru) — user tanpa employee ter-link (leadership/akun uji) melihat semua plant, sesuai peran pengawasan mereka.

Semua 3 diverifikasi: test otomatis (19 test baru total across 4 file test baru) + live browser check terhadap dev (data uji dibuat & dibersihkan lagi setelahnya) + full suite 11 file/61 test hijau di tiap tahap + build sukses + CI hijau tiap commit.

`docs/checklist-audit-jalan-kaki.md` sudah diperbarui — 3 dari 5 baris temuan ditandai "SUDAH DITAMBAL", dengan catatan eksplisit untuk pemilik produk: **verifikasi ulang lewat jalan kaki, jangan asumsikan otomatis benar** cuma karena tertulis "sudah ditambal" di dokumen.

---

## Audit Keamanan Menyeluruh — Grant/Revoke Fungsi Database — 19 Agu 2026

Dipicu temuan `decide_production_standard_proposal()` (K8) bisa dipanggil anon key tanpa login. Enumerasi menyeluruh (fungsi diagnostik baru `debug_list_function_grants()`, migration `20260819140000`) menemukan pola yang sama di **44 dari 48 fungsi** schema public.

**Klasifikasi akhir** (dicek lewat kode + bukti anon-key sungguhan, bukan ditebak):
- **12 KRITIS ditambal** (migration `20260819150000`): `record_manual_stock_adjustment`, `create_opening_balance_lot`, `create_shipment_with_signature`, `compute_production_batch_labor_cost`, `resolve_department_alerts`, `upsert_department_alert`, `recompute_stock_projection_for_item`, `recompute_work_order_machine_readiness`, `recompute_work_order_material_readiness`, `recompute_work_order_worker_readiness`, `debug_list_policies`, `debug_schema_snapshot`. Semua sekarang **hanya** `postgres`/`service_role` — diverifikasi anon key ditolak bersih `42501` untuk 6 di antaranya (sebelumnya berhasil mencapai logika bisnis nyata atau tereksekusi tanpa error sama sekali).
- **4 dari 12 itu JUGA diperbaiki logikanya** (bukan cuma grant), karena percaya parameter mentah tanpa verifikasi:
  - `create_shipment_with_signature` — SEBELUM percaya `p_company_id` buta; SEKARANG wajib cocok dengan company asli pemilik `p_sales_order_id`.
  - `compute_production_batch_labor_cost` — SEBELUM tidak ada pemeriksaan akses sama sekali (siapa pun bisa baca upah batch manapun); SEKARANG sinkron dengan pemeriksaan yang sudah ada di `get_production_batch_labor_cost_total` (company match + `jwt_can_view_wages()`/`jwt_can_view_financial_data()`) — TAPI hanya berlaku kalau ada klaim JWT (supaya jalur service-role aplikasi sendiri, yang memang tidak membawa klaim company_id, tidak ikut mati).
  - `resolve_department_alerts` — SEBELUM tidak punya parameter company_id SAMA SEKALI (bisa "menyembunyikan" alert perusahaan lain kalau tebak work_order_id/item_id-nya); SEKARANG company diturunkan dari data asli yang direferensikan dan ikut jadi filter WHERE.
  - `upsert_department_alert` — SEBELUM `p_company_id` dipercaya mentah; SEKARANG wajib cocok dengan company asli `p_related_work_order_id`/`p_related_item_id` kalau diisi.
  - Terbukti tidak regresi: `margin_v1_acceptance.test.ts` (test permanen yang sudah ada) memanggil 2 dari 4 fungsi ini langsung dan tetap lulus; ditelusuri juga kode pemanggilnya (`createShipmentWithSignature.ts`) — sudah memverifikasi kecocokan company SEBELUM memanggil RPC, jadi pemeriksaan baru ini tidak mungkin salah tolak jalur asli.
- **`debug_schema_snapshot()` DIHAPUS TOTAL** (bukan cuma dicabut) — tidak dipakai test/skrip permanen apa pun, dan permukaan kebocorannya (dump seluruh skema+definisi fungsi) jauh lebih besar daripada `debug_list_policies` (yang DIPERTAHANKAN karena dipakai 2 test permanen, tapi sekarang benar-benar hanya `service_role`).
- **2 SEDANG, GRANT-NYA SENGAJA TIDAK DISENTUH**: `is_super_admin_user(current_auth_uid text)` dan `user_has_no_company(current_auth_uid text)` menerima UID sembarang sebagai parameter (bisa dipakai untuk menebak status super-admin/company user LAIN), TAPI dikonfirmasi lewat `pg_policies` sungguhan bahwa keduanya dipakai di RLS policy nyata (`is_super_admin_user` di 3 policy `subscription_plans_*`, `user_has_no_company` di `companies_insert_admin`) yang berjalan di bawah role `authenticated` — mencabut grant di sini akan MEMATIKAN pendaftaran company baru & pengelolaan subscription plan untuk SEMUA user.

  **Rencana perbaikan: DISETUJUI, TAPI DIJADWALKAN SETELAH pilot SAS001+SAS005 selesai** (bukan alasan teknis — alasan urutan: dua order nyata sedang berjalan, dan salah langkah di sini berisiko mematikan RLS untuk SEMUA user, bukan risiko kecil, jadi tidak dikerjakan bersamaan dengan periode paling sensitif ini). Risiko yang tersisa sementara dinilai kecil (murni baca status, bukan jalur tulis, dan butuh tahu UID pihak lain lebih dulu — bukan bisa ditebak dari luar tanpa informasi apa pun). Langkah rencana (untuk dieksekusi nanti, BUKAN sekarang): ubah signature jadi tanpa parameter (baca `auth.uid()` langsung di dalam fungsi, bukan menerima UID dari luar), lalu update SETIAP RLS policy yang memanggilnya dengan signature baru dalam migrasi yang sama, lalu re-test SELURUH suite (terutama alur registrasi & subscription plan) sebelum dianggap aman.
- **Sisanya (RENDAH/aman)**: 6 helper `jwt_*` + 2 helper RLS lain — dipakai di dalam ekspresi RLS, grant luas WAJIB dipertahankan (lihat aturan baku migrasi di atas); `suggest_fefo_lots`/`work_order_is_blocked`/`bom_component_creates_cycle` — bukan `SECURITY DEFINER`, RLS tabel dasar tetap berlaku; `confirm_delivery` — SENGAJA publik (jalur POD tanpa login, guard-nya token+status bukan role — keamanan sesungguhnya bergantung pada `pod_token` bersifat acak & sekali-pakai, itu **Track C-3 di `docs/rencana-kerja-fase-produksi-nyata.md`, MASIH BELUM diaudit terpisah**); 6 fungsi `get_*`/`process_customer_purchase_order` — `SECURITY DEFINER` tapi terverifikasi punya pemeriksaan `jwt_company_id()`/role internal yang benar; 13 fungsi `RETURNS trigger`/`RETURNS event_trigger` — dibuktikan langsung (anon key DAN service_role, keduanya) TIDAK BISA dipanggil lewat RPC PostgREST sama sekali, jadi grant luasnya tidak relevan.

**Test regresi permanen ditambahkan**: `tests/function_grant_security_audit.test.ts` — enumerasi otomatis + allowlist eksplisit (lihat aturan baku migrasi di atas). Sudah menangkap 2 kesalahan nyata SAAT DITULIS (bukan hipotetis): `bom_component_creates_cycle` belum di-allowlist (ditambahkan, aman by design) dan `debug_list_function_grants()` — fungsi diagnostik BARU yang dibuat untuk audit ini sendiri — ternyata kena bug yang SAMA (revoke cuma "from public", ditambal migration `20260819160000`).

**Verifikasi**: migrasi diuji di staging dulu (smoke test anon-key + full suite), baru ke dev. Full suite: 8 file / 52 test lulus di kedua environment.

---

## Fase Produksi Nyata — PEKERJAAN 1 (Employee CRUD) & PEKERJAAN 2 (K8 Hardening) — 19 Agu 2026

Rencana lengkap: `docs/rencana-kerja-fase-produksi-nyata.md` (dari konsultan). Siklus domain-per-domain DIJEDA — prioritas satu-satunya fase ini: sistem dipakai sungguhan oleh staf pabrik selama SAS001 & SAS005 berjalan.

### PEKERJAAN 1 (B-1) — Fitur create/edit Karyawan lewat UI — SELESAI

HRD sekarang bisa kelola 33+ karyawan lewat UI (`/hr`, tombol "Tambah Karyawan" di toolbar + modal, pola sama persis dengan `ItemsPage.tsx`) — bukan lagi lewat seed script. `POST`/`PATCH /api/employees` digerbang `canManageHr` (company_admin/hr_manager/hr_staff), **sinkron persis** dengan policy RLS `employees_write_hr`/`employees_update_hr` yang sudah ada. Tidak ada hard delete — "nonaktifkan" = `is_active=false` lewat form edit yang sama (karyawan terikat FK ke labor log/absensi).

**Terverifikasi** (11 test otomatis baru di `tests/employee_crud_and_k8_standards.test.ts`, ditambah verifikasi browser sungguhan terhadap dev):
- (a) hr_manager tambah karyawan lewat **browser sungguhan** (`hr.a@debug.mrp`, screenshot diambil) → muncul di Daftar Karyawan, hitung Karyawan Aktif naik 33→34, terpakai lewat UI yang sama yang dibaca labor log (`/api/employees`, filter `is_active`). Data uji sudah dibersihkan dari dev setelah verifikasi.
- (b) NEGATIF — general_manager coba tambah/ubah gaji karyawan → **403** keduanya; `employees_secure` tetap kembalikan `wage_rate: null` untuk GM (general_manager SENGAJA tidak termasuk `jwt_can_view_wages()`).
- (c) NEGATIF — production_staff coba tambah/ubah karyawan → **403** keduanya.
- (d) hr_manager nonaktifkan karyawan yang punya baris `work_order_assignments` → sukses, baris assignment (riwayat labor log) **tetap ada, tidak terhapus**.

### PEKERJAAN 2 (bagian D) — Pengerasan K8 sebelum data nyata masuk — SELESAI

**Temuan penting sebelum mulai kerja:** `recompute_production_standard()` (dibangun gelombang sebelumnya) **ternyata dead code** — tidak ada satu baris kode aplikasi pun yang pernah memanggilnya (dicek lewat grep total). Jadi pekerjaan ini bukan "mengeraskan" mekanisme yang sudah hidup, tapi menggantikannya total dengan versi yang dari awal sudah punya keempat pengaman:

1. **Flip butuh persetujuan** — fungsi baru `propose_production_standard()` (migration `20260819110000`) HANYA menulis ke tabel baru `production_standard_proposals` (status `pending`/`approved`/`rejected`) — `production_standards.value/source` tidak pernah tersentuh langsung. Satu-satunya jalur mengubahnya adalah `decide_production_standard_proposal()`, dipanggil endpoint `POST /api/production-standards/proposals/decide`, digerbang role baru `canDecideProductionStandardProposal` (company_admin/general_manager/**ppic_manager** — SENGAJA lebih sempit dari yang boleh menulis `production_standards` secara umum). UI planner: card "Usulan Standar Produksi Menunggu Keputusan" di `/ppic` (nilai lama vs usulan vs dampak %, tombol Sahkan/Tolak) — sudah dicek render sungguhan di browser (`ppic.a@debug.mrp`), tidak error.
2. **Median untuk sampel kecil** — n<10 pakai `percentile_cont(0.5)` (median) TANPA buang outlier; n≥10 baru mean dengan buang outlier ±2σ (perilaku lama, sekarang hanya aktif di n besar). Diuji: 5 sampel `[98,99,101,102,50]` → usulan = **99** (median), bukan 90 (mean yang tertarik nilai ekstrem 50).
3. **Gerbang kelengkapan** — `learnFromBatch.ts` (endpoint `POST /api/production-batches/learn-standard-sample`) cek SEMUA `routing_steps` item itu punya baris `work_order_step_progress` berstatus `completed` sebelum batch itu boleh jadi sampel. Batch berlubang datanya DIKECUALIKAN dan dicatat di tabel baru `production_standard_exclusions` (dilaporkan, bukan dilewati diam-diam) — diuji nyata.
4. **Snapshot standar per rencana** — `getPlanningFeasibility.ts` sekarang mengunci `unit_per_batch`/`batches_per_day` yang dipakai SEKALI per `sales_order_line` (tabel baru `sales_order_line_feasibility_snapshots`, insert sekali, tidak pernah di-UPDATE). Panggilan berikutnya tetap pakai standar yang terkunci itu; kalau standar live sekarang berbeda, response menambahkan `standard_drift` (nilai lama vs sekarang) — TIDAK PERNAH mengubah angka rencana yang sudah dihitung. Diuji: ubah standar SETELAH rencana dihitung → `batches_needed` tetap sama, `standard_drift` muncul.

**Perbaikan tambahan yang ditemukan perlu saat wiring** (bukan diminta eksplisit, tapi tanpa ini D.2/D.3 tidak benar): `production_standard_samples` tidak punya kolom `routing_step_id` — padahal `active_duration_minutes` levelnya per-tahap. Tanpa kolom ini, sampel durasi dari tahap BERBEDA pada item yang sama akan tercampur jadi satu rolling window yang salah. Ditambahkan di migration yang sama.

**Terverifikasi** (test otomatis + smoke test manual di staging sebelum ke dev): flip tidak otomatis (poin 6a-d instruksi asli) semua lulus — lihat detail di atas. Migrasi dijalankan ke staging dulu, di-smoke-test manual lewat RPC langsung (median 99 vs mean 90 dikonfirmasi), baru ke dev.

**Batasan yang perlu diketahui sesi depan:** tidak ada UI "Selesaikan Batch" di aplikasi ini — `production_batches.status` tidak pernah ditransisikan oleh kode aplikasi manapun (dicek, bukan asumsi). "Batch selesai" untuk keperluan pembelajaran K8 didefinisikan secara pragmatis sebagai "semua tahap routingnya sudah `completed` di `work_order_step_progress`" (data yang memang sudah diisi operator lewat alur yang ada), bukan dari status batch itu sendiri. Tombol "Ajukan sebagai Sampel Standar" ditaruh di dialog "Ringkasan Yield Batch" (`/ppic`) sebagai titik pemicu manual — belum otomatis terpicu saat tahap terakhir selesai.

Build + typecheck + `npm run build` sukses. Test suite: 7 file / 49 test lulus (termasuk 12 test baru).

**LUBANG KEAMANAN NYATA ditemukan & ditambal SEBELUM dilaporkan selesai** (migration `20260819130000`): `grant execute ... to service_role` di migration `20260819110000` HANYA MENAMBAH grant, TIDAK MENCABUT grant PUBLIC yang Postgres beri otomatis ke fungsi baru. Dibuktikan lewat percobaan sungguhan: anon key (tanpa login sama sekali) BISA memanggil `decide_production_standard_proposal()` langsung, melewati gerbang role app layer total, dan bisa memalsukan `decided_by` jadi user manapun. Ditambal dengan `revoke execute ... from public/anon/authenticated` eksplisit di kedua fungsi baru (`propose_production_standard`, `decide_production_standard_proposal`), diverifikasi ulang pakai anon key SUNGGUHAN dan akun `ppic_manager` SUNGGUHAN (keduanya sekarang ditolak bersih `42501 permission denied`), dan dikunci pakai test regresi permanen. **Pelajaran untuk migration berikutnya yang menulis fungsi `security definer` sensitif: `grant ... to service_role` SAJA TIDAK CUKUP — selalu sertakan `revoke ... from public` (dan anon/authenticated) di migration yang sama, jangan berasumsi grant tambahan otomatis mencabut grant default.**

---

## Ringkasan Status Proyek untuk Review Konsultan — 19 Agu 2026

Ditulis atas permintaan eksplisit pemilik produk sebagai bahan laporan kondisi proyek. Detail teknis & bukti lengkap dari tiap poin ada di bagian "Perintah Gabungan A + B" tepat di bawah ringkasan ini.

### (a) Yang sudah jalan penuh dengan data real case (bukan lagi data demo/uji)
- **Fondasi SaaS**: signup, login, invite anggota tim, accept invitation, RLS multi-tenant — semua lewat form/UI sungguhan, terverifikasi di staging dan dev.
- **Master data produksi PT ITM**: 67 item real case (raw material, kemasan, WIP premix, finished goods), BOM Gummy Zala (N200) dan BOM Drinkme Lemon v2 (dibangun ulang dari resep asli sesi ini, biaya batch terverifikasi cocok ke Rp0,48 dari target spec), routing, 33 karyawan real case, 3 plant real (Pabrik Utama, **Karanglo** — minuman serbuk, **Ruko Dieng** — gummy).
- **Stok opname riil Gudang Karanglo**: 35 lot saldo awal dimuat lewat mekanisme resmi (bukan insert SQL langsung), total nilai Rp233.686.488,12, tiap lot tercatat sebagai `stock_movements` dengan alasan "Saldo awal stok opname 18 Agu 2026" — bisa dilacak dan sudah terbukti alur biayanya benar-benar masuk ke perhitungan produksi.
- **2 pesanan pelanggan real case aktif**: SAS001 (Gummy Zala, 20.000 pcs) dan SAS005 (Drinkme, 10.000 pcs) — keduanya berstatus "confirmed", belum ada produksi/pengiriman sungguhan.
- **Deteksi kelayakan jadwal & kekurangan bahan** (endpoint `/api/sales-order-lines/[id]/planning-feasibility`) — sudah dites ulang terhadap data real case pasca-pembersihan: SAS001 butuh 353 batch, TIDAK layak dengan kapasitas sekarang; SAS005 butuh 45 batch, LAYAK (ketat, 15 dari 23 hari kerja tersedia).
- **Backup database**: workflow GitHub Actions manual (`workflow_dispatch`) menghasilkan pg_dump schema+data sungguhan dari project dev, sudah dijalankan & isinya diverifikasi langsung (bukan cuma percaya status hijau) — cocok baris-per-baris dengan isi database untuk 8 tabel yang dicek.
- **Data demo/uji sudah bersih dari database dev** — 4 perusahaan test-fixture orphan, seluruh SO/WO/batch/shipment/lot demo, plant demo lama dihapus lewat `scripts/cleanup-demo-data.js` (diuji dulu di staging, idempotent, seluruh test suite [6 file/37 test] lulus baik di staging maupun dev). Laba operasional bulanan sekarang bersih dari kontaminasi margin demo (Agustus 2026: margin Rp0, overhead Rp60.500.000, operating profit -Rp60.500.000 — negatif karena memang belum ada penjualan real case yang selesai/terkirim, bukan bug).

### (b) Menunggu keputusan/data dari pemilik produk
- **Stok Plant Ruko Dieng (gummy) — KOSONG SAMA SEKALI (0 lot).** Karanglo sudah punya saldo awal lengkap; Ruko Dieng belum pernah diisi data stok opname apa pun. Perlu dokumen stok opname Ruko Dieng (format sama seperti `docs/saldo-awal-gudang-karanglo-180826.md`) sebelum SAS001 (Gummy Zala) bisa dihitung kekurangan bahannya dengan akurat.
- **2 item kemasan Drinkme belum pernah ada stoknya sama sekali**: `PKG-PLASTIC-WRAP-BOX` (Plastic Wrap Box) dan `PKG-KARTON-SERBUK-42` (Karton Serbuk isi 42 box) — 0 stok, tidak tercakup di stok opname Karanglo yang sudah dimuat. Ditemukan saat menghitung ulang kekurangan bahan SAS005 sesi ini.
- **Kekurangan bahan mentah SAS005 (Drinkme, 10.000 unit) ternyata lebih luas dari perkiraan awal** — bukan cuma Garcinia/Bromalin/Papain/sachet/box, tapi juga Maltodextrin, Polydextrose, Inulin, Psylium Husk, Zoefree, Garam, Derasi Orange, Sereh Powder (stok ADA tapi tidak cukup untuk 45 batch — premix ikut memakai sebagian bahan yang sama sebagai carrier, jadi total kebutuhan lebih besar dari perkiraan per-item sederhana). Ini keputusan pembelian yang perlu ditindaklanjuti pemilik produk, bukan masalah teknis.
- **Kapasitas real produksi belum pernah dikonfirmasi ulang** di luar 2 angka yang sudah dipakai (Gummy 4 batch/hari, Serbuk 3 batch/hari — keduanya masih berstatus `ESTIMASI_MANUAL`, belum `DIPELAJARI` dari data produksi sungguhan karena belum ada produksi real case yang jalan).

### (c) Utang teknis yang sengaja ditunda (beserta alasannya)
- ~~2 item orphan lama, `PMSC001ITM` & `PMPW0001ITM`~~ — **`PMSC001ITM` SELESAI, bukan orphan lagi** (20 Agu 2026): dipakai ulang sungguhan sebagai WIP "Sachet Minuman Serbuk" di BOM Drinkme 2-tingkat (lihat bagian "Data Lapangan Nyata Routing Serbuk..." di atas). `PMPW0001ITM` (item duplikat lama "Sorbitol Powder") TETAP orphan — BOM fiktif lama yang mereferensikannya (bom_id 38) sudah diarsipkan, tapi item `PMPW0001ITM` itu sendiri belum diputuskan (hapus atau biarkan sebagai arsip).
- **2 company orphan tersisa di dev**: `Company B` (SENGAJA dibiarkan — akun debug `company.b@debug.mrp` dipakai test suite CI, bukan sampah) dan `E2E RealSMTP Co 1786463644300` (kemungkinan besar sampah tes lama, tapi belum diuji eksplisit di staging bahwa aman dihapus total — sengaja tidak ikut skrip pembersihan sesi ini supaya tidak menyimpang dari yang sudah divalidasi).
- **Sorting kolom di halaman daftar (tabel list)** — belum diimplementasikan di beberapa halaman, ditunda karena bukan blocker untuk alur kerja inti MVP.
- **Pola "Detail expand-baris" belum dipakai konsisten di semua halaman daftar** — sudah ada di sebagian halaman tapi belum dimigrasikan ke halaman-halaman lain yang sebenarnya cocok pakai pola sama, demi konsistensi UI.
- ~~Fitur create Karyawan lewat UI belum pernah dibangun~~ — **SELESAI** (sesi lanjutan hari sama, lihat bagian "Fase Produksi Nyata — PEKERJAAN 1" di paling atas dokumen ini). HRD sekarang bisa tambah/edit/nonaktifkan karyawan lewat `/hr`, tidak perlu lagi seed script.

---

## Perintah Gabungan A (tutup GELOMBANG 1) + B (Saldo Awal Karanglo) — 19 Agu 2026

### A1 — BOM Drinkme Lemon — SELESAI & terverifikasi

Resep top-level lengkap (basis 19,655g) dibangun jadi BOM aktif `PMBX001ITM` (Box Minuman Serbuk Isi 14 Sachet), **versi SUNGGUHAN** (bukan timpa) — BOM lama fiktif (dari `scripts/seed-debug-powder-drink.js`, "data uji bukan resep asli") diarsipkan (`status='archived'`, v1), resep asli jadi v2 aktif, 19 baris (15 bahan/premix + 4 kemasan sachet/box/plastic wrap/karton, mengikuti K6 sama seperti Gummy Zala).

**Temuan penting saat verifikasi:** biaya total tidak cocok di percobaan pertama (selisih ~Rp3,66/basis-unit) — ternyata harus pakai **biaya LOT premix (bahan+SDM, kolom "Biaya/g lot")**, BUKAN "Bahan/g" saja, sesuai K5 ("Premix dibiayai dari batch asalnya... biaya per gram LOT yang dipakai"). Setelah dikoreksi:
- **Biaya bahan per 60kg batch = Rp4.965.905,68** (target spec Rp4.965.906,16 — selisih Rp0,48, rounding tampilan spec sendiri di kolom harga 4 desimal).
- **Kemasan per box = Rp3.989,15** (target Rp3.989,14 — selisih 1 sen).

Typecheck bersih, `scripts/seed-realcase-itm.js` tetap idempotent (dicek: run ulang skip, tidak bikin versi BOM baru lagi).

### A2 — Backup via GitHub Actions — SELESAI & TERVERIFIKASI (lihat update di bawah blocker lama)

`.github/workflows/backup-db.yml` dibuat: trigger `workflow_dispatch` (manual saja), `supabase db dump --linked` (schema+DATA penuh, BUKAN `--data-only` — sesuai instruksi), verifikasi dump berisi data sungguhan (bukan cuma schema kosong), upload artifact retensi 7 hari.

**BLOCKER nyata:** environment kerja Claude Code ini **tidak punya akses tulis ke GitHub API sama sekali** — tidak ada `gh` CLI terpasang, tidak ada `GITHUB_TOKEN`/PAT tersimpan di mana pun yang bisa saya pakai. Ini berarti saya **tidak bisa**:
1. Menambahkan secret `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD` yang dibutuhkan workflow ini ke pengaturan repo GitHub.
2. Memicu (`workflow_dispatch`) workflow ini sendiri.
3. Memverifikasi artifact hasil run benar-benar berisi data.

**Yang perlu Anda lakukan:** (a) buka Settings → Secrets and variables → Actions di repo GitHub, tambahkan 3 secret di atas (`SUPABASE_ACCESS_TOKEN` dari https://app.supabase.com/account/tokens, `SUPABASE_PROJECT_REF` = `kfvtrwuuqcjfkkuqizxt`, `SUPABASE_DB_PASSWORD` = password database project ini); (b) buka tab Actions → "Backup Database (manual)" → Run workflow; (c) unduh artifact `db-backup-full`, pastikan isinya bukan cuma `CREATE TABLE` kosong (ada baris `COPY`/`INSERT` data sungguhan).

**UPDATE (sesi lanjutan, hari sama):** pemilik produk menambahkan ketiga secret & menjalankan workflow. 2 percobaan pertama gagal (regex verifikasi tidak toleran terhadap identifier quoted milik `pg_dump`; lalu ditemukan `supabase db dump` TIDAK punya mode gabungan schema+data dalam 1 command — workflow diperbaiki jadi 2 dump terpisah digabung). Run ke-3 (commit `848d1d8`) **SUKSES**. Pemilik produk sempat memeriksa manual artifact-nya dan menyimpulkan "invalid, isinya schema-only" — ternyata KELIRU: `supabase db dump` tanpa `--use-copy` menulis data pakai format `INSERT INTO` bukan `COPY`, jadi pencarian manual untuk string `COPY public.` memang nol hasil padahal datanya ADA. Diverifikasi ulang dengan baca file langsung: 48 tabel (termasuk `auth`/`storage`) berisi data, dan untuk 8 tabel yang dicek, jumlah barisnya **cocok persis** dengan isi database dev saat itu (companies 7, items 124, employees 44, work_orders 14, lots 64, CPO 11, sales_orders 5, bom_lines 78). Workflow diperbarui (`ee2a2e7`) supaya langkah verifikasinya sekarang mencetak format (INSERT vs COPY) + jumlah tabel berisi data, supaya pemeriksaan manual berikutnya tidak salah baca lagi.

### A3 — Pembersihan Data Demo — SELESAI (dev sudah bersih, lihat detail di bawah)

**UPDATE (sesi lanjutan):** setelah A2 terverifikasi valid, `scripts/cleanup-demo-data.js` ditulis dengan strategi ALLOWLIST (bukan tebak apa yang harus dihapus) dan diuji dulu di staging (`mrp-rebuild-test-2A`, diisi data representatif yang meniru campuran demo+real+trigger-FK-edge-case dev) sebelum disentuhkan ke dev, sesuai syarat ketat yang diminta pemilik produk. 2 kondisi FK baru ditemukan & diperbaiki lewat percobaan sungguhan (bukan tebakan): `employee_attendance` harus dihapus dulu sebelum karyawan demo-nya; item lama `PMPW0001ITM` masih direferensikan BOM aktif `PMSC001ITM` yang sengaja dibiarkan (lihat bagian (c) di ringkasan atas). Skrip final: butuh `--target=staging|dev` eksplisit, baca kredensial dari file `.env.*.local` (tidak lagi inline di command line — insiden kunci bocor sebelumnya jadi alasan), dan target dev wajib konfirmasi ketik ulang.

Dijalankan 2× di staging (idempoten, data wajib-tetap-ada utuh, 6 file/37 test lulus) baru dijalankan ke dev. Di dev: 2 perusahaan orphan (`MarginTestCorp` ×2 — `DebugPremixCorp`/`LaborPoolTestCorp` sudah bersih dari percobaan sebelumnya), 155 system_alerts, 11 work_orders + turunannya, 8 CPO demo + turunannya, 28 lot demo, 24 bom/bom_lines lama, 6 karyawan demo, 10 item demo, 1 plant demo (`Pabrik Cabang Kedua PT ITM`) — semua terhapus. Diverifikasi 2× lagi idempoten (0 baris di run kedua) dan query langsung ke database mengonfirmasi 3 plant real, 35 lot saldo awal Karanglo, 67 item real case, BOM Drinkme v2 aktif, 33 karyawan, CPO SAS001+SAS005 semua utuh. `Company B` dan `E2E RealSMTP Co ...` sengaja tidak disentuh (lihat bagian (c) di ringkasan atas).

**Laba Operasional bulanan sekarang BERSIH** dari kontaminasi demo (lihat ringkasan (a) di atas untuk angkanya) — risiko yang disebutkan di instruksi awal sudah tidak berlaku lagi.

### B — Saldo Awal Stok Gudang KL BIZ / Plant Karanglo — SELESAI & terverifikasi

**Perluasan mekanisme dulu (prasyarat):** fitur Saldo Awal GELOMBANG 0B awalnya TIDAK bisa terima `unit_cost` sama sekali (didesain untuk kasus "belum tahu harganya"). Data stok opname riil PUNYA harga presisi penuh per lot, jadi `create_opening_balance_lot()` diperluas terima `p_unit_cost` opsional (migration `20260819100000`, default NULL — perilaku lama utuh), `recordOpeningBalance.ts` & UI Saldo Awal (`/warehouse`) dapat field baru "Harga per Unit (opsional)".

**`scripts/load-saldo-awal-karanglo.js`** (idempotent, lewat API resmi `/api/stock-adjustments/opening-balance` — BUKAN insert SQL langsung):
- **18 item baru** dibuat (7 BARU-BAHAN + 2 BARU-WIP + 9 BARU-KEMASAN). "Derasi Strawberry" TIDAK dibuat baru — item itu SUDAH ADA dari demo lama (`RM-DERASI-STRAWBERRY`), dipakai ulang + `standard_cost` dikoreksi ke 1.501,23/g (data opname riil, bukan nilai demo lama).
- **35 lot saldo awal** dimuat ke plant Karanglo — 16 MAP + 8 BARU-BAHAN (termasuk Derasi Strawberry reuse) + 2 BARU-WIP + 9 BARU-KEMASAN. Sorbitol Powder (alias "PREMIX POWDER") dimuat 2.291.440g @ Rp58,0000/g, dan nama item diberi catatan `"... (alias gudang: Premix Powder)"` supaya stok opname berikutnya otomatis cocok.
- **SKIP (3, TIDAK dimuat) sesuai keputusan final:** Bromalin, Papain, Derasi Peach — stok sebenarnya habis.
- **ALAT (4, EXCLUDE):** Cartridge JS12 Black, Corong 3 Side 80mm, Pita LC1 Coding, Plastik Roll Shrink — tidak dibuat item maupun lot.

**B4 — Verifikasi:**
- **(a) Total nilai termuat = Rp233.686.487,02** (dihitung presisi penuh dari DB, bukan akumulasi float JS biasa). Target instruksi: Rp233.686.488,12 — **selisih Rp1,10** (0,0000005% relatif). Diperiksa: penyebabnya kolom `unit_cost` di file sumber sendiri sudah dibulatkan 4 desimal secara independen dari kolom "Total Nilai"-nya (mis. STEVIA POWDER: Total Nilai÷Qty presisi penuh = 871,06879.../g, tapi kolom unit_cost yang tertulis 871,0694/g) — pola yang SAMA PERSIS dengan temuan rounding di `spesifikasi-aturan-biaya-v1.md` rev.3/4 sebelumnya. Bukan kesalahan data, murni rounding sumber.
- **(b) Stok tampil di dashboard Warehouse plant Karanglo** — dicek lewat `/api/stock-summary`: 35 baris, semua `production_plant_name: "Karanglo"`, qty & item benar.
- **(c) Alert kekurangan bahan SAS005 — TEMUAN PENTING, BEDA dari ekspektasi instruksi.** `system_alerts` tidak otomatis muncul untuk Drinkme (belum ada Work Order Drinkme yang direncanakan — alert baru tergenerate saat WO dibuat, bukan otomatis dari SO). Dihitung LANGSUNG dari BOM asli × kebutuhan 10.000 box vs stok company-wide: **shortage list yang SEBENARNYA jauh lebih panjang** dari 5 item yang diharapkan (Garcinia+Bromalin+Papain+sachet+box) — MELIPUTI JUGA Maltodextrin, Polydextrose, Inulin, Psylium Husk, Zoefree, Garam (raw material, kurang karena kebutuhan total mencakup produksi ULANG premix, bukan cuma sisa), dan **SEMUA 5 item premix WIP sendiri (PMSW/PMAC/PMFL/PMVITC/PMSRH) muncul kurang** — akar penyebabnya: stok WIP premix yang ada di DB **BUKAN 0, tapi sisa data DEMO FIKTIF** (5000g/3000g/5000g/0/0 dari `seed-debug-powder-drink.js`, GELOMBANG 1 real-case sengaja tidak mengisi stok premix karena real case dimulai dari 0) — jauh di bawah kebutuhan 10.000 box, dan **inilah tepatnya mengapa A3 (pembersihan demo) penting** — sesuai peringatan di A3 di atas. Sorbitol Powder MEMANG sudah tidak kurang (2.291kg tersedia vs ~945kg dibutuhkan) — bagian ini SESUAI ekspektasi. Detail lengkap tabel kebutuhan-vs-stok ada di riwayat sesi kalau diperlukan.
- **(d) Setiap lot punya baris `stock_movements`** — dicek: 35 lot = 35 movement, semua `movement_type='adjustment'`, `reason_code='stock_opname_variance'`, `notes` berisi label sumber PDF per baris.
- **(e) Uji konsumsi 1 lot saldo awal → biaya mengalir ke batch** — diuji nyata: konsumsi 5g dari lot Garam (unit_cost Rp13,00) ke 1 batch uji → biaya bahan batch dihitung `5 × 13 = Rp65,00`, cocok persis. Fixture uji dibersihkan setelahnya.

**Kapasitas serbuk & feasibility SAS005 — SELESAI & terverifikasi, cocok persis ekspektasi:** `production_standards` PMBX001ITM `batches_per_day=3` (ESTIMASI_MANUAL). Endpoint `/api/sales-order-lines/[id]/planning-feasibility` diuji ke SAS005 sungguhan: `batches_needed: 45`, `days_needed: 15`, `total_working_days_to_deadline: 23`, **`feasible: true`** — PERSIS seperti diharapkan ("FEASIBLE-KETAT", 15 hari kebutuhan vs 23 hari tersedia).

Typecheck bersih, `npm run build` sukses, 37/37 test tetap lulus.

### Ringkasan hal yang MENUNGGU Anda (jangan ditebak) — SEMUA POIN DI BAWAH SUDAH SELESAI, lihat update
~~1. A2/A3~~ — selesai, lihat update A2/A3 di atas.
~~2. B4(c)~~ — **UPDATE (sesi lanjutan): dihitung ulang setelah A3 selesai, dan hasilnya TIDAK cocok dengan perkiraan 5-item di atas** — prediksi "kemungkinan besar akan cocok dengan 5-item" di baris ini TERNYATA SALAH, dikonfirmasi eksplisit oleh pemilik produk sendiri ("perkiraan saya sebelumnya yang salah — saya cuma mengecek item mana yang ada/tidak ada di stok, bukan apakah kuantitasnya cukup untuk 45 batch"). Shortage list SAS005 yang benar (dihitung dari eksplosi BOM berjenjang penuh, bukan cuma 1 level): Garcinia+Bromalin+Papain+sachet+box (sesuai dugaan) **DITAMBAH** Maltodextrin, Polydextrose, Inulin, Psylium Husk, Zoefree, Garam, Derasi Orange, Sereh Powder (stok ADA tapi kurang untuk 45 batch — kelima premix WIP memakai sebagian bahan yang sama sebagai carrier, sehingga total kebutuhan lebih besar dari perkiraan per-item sederhana) — lihat bagian (b) di ringkasan konsultan paling atas dokumen ini. Kelima premix WIP sendiri (PMSW/PMAC/PMFL/PMVITC/PMSRH) sudah BENAR muncul sebagai kebutuhan PRODUKSI (bahan penyusunnya cukup), bukan kekurangan beli.
3. Kapasitas lini gummy/serbuk & nilai 3 item SKIP — SUDAH final per keputusan 18 Agu, tidak ada lagi yang menunggu di sini.

---

## Koreksi Labor Log — Pool Bergilir (18 Agu 2026) — SELESAI & terverifikasi

Klarifikasi pemilik produk setelah GELOMBANG 2 (sudah tercatat di `spesifikasi-aturan-biaya-v1.md` K1): tim produksi gummy (±15 orang) BUKAN kepala tetap per tahap — mereka POOL BERGILIR yang berpindah tahap sepanjang hari (mis. pagi masak, siang bantu cetak), dan tim BEDA bisa mengerjakan batch KEMARIN paralel dengan batch HARI INI. Angka "2 orang masak, 8 orang cetak" di routing = estimasi usaha orang-jam per batch (cold-start), BUKAN penugasan kaku 1 orang = 1 tahap.

**Bug ditemukan** di `recordLaborLog.ts` versi pertama: baris disimpan dengan key (batch, karyawan) SAJA — begitu orang yang sama dicatat lagi di TAHAP KEDUA pada batch yang SAMA, baris pertama diam-diam TERTIMPA (bukan ditambah baris baru). Ini persis kebalikan dari yang diminta ("1 orang HARUS bisa punya banyak entri jam... lintas tahap berbeda DAN lintas batch berbeda"). Tidak ada unique constraint level database yang jadi biang keladinya (dicek, tidak ada) — murni logika upsert di kode aplikasi.

**Perbaikan:**
- Key upsert diubah ke (batch, karyawan, **routing_step_id**) — baris baru untuk kombinasi tahap/batch yang beda, update kalau PERSIS kombinasi yang sama dicatat ulang (mis. koreksi jam).
- Endpoint TIDAK PERNAH memblokir berdasar "orang ini sudah ditugaskan di tempat lain hari ini" — tidak ada validasi seperti itu sama sekali, sesuai permintaan.
- Peringatan LEMBUT (bukan blokir) ditambahkan: kalau total jam 1 orang di 1 tanggal (dijumlah lintas SEMUA batch/tahap) melebihi jam kerja efektif hari itu (7 jam biasa/5 Sabtu, K4), respons API menyertakan `warning` — baris tetap tersimpan, tidak pernah ditolak.
- **UI baru**: card "Catat Jam Kerja (Labor Log)" ditambahkan di halaman `/work-orders` (panel detail batch, tepat di bawah "Catat Pemakaian Bahan") — pilih karyawan, pilih tahap (opsional, dari routing WO), isi jam, tanggal. Sebelumnya labor log CUMA endpoint API tanpa form sama sekali.

**Bukti verifikasi (skrip langsung ke API, sesuai skenario diminta persis):** 1 karyawan dicatat di 3 tahap berbeda (Cooking/Molding/Demolding) pada 2 batch berbeda, hari yang sama — hasilnya **3 baris tersimpan** (bukan 1 yang saling menimpa), biaya SDM tiap batch dihitung benar dari porsi jamnya sendiri (Batch A dari 2+1,5=3,5 jam → Rp40.384,62; Batch B dari 2 jam → Rp23.076,93, keduanya cocok dengan tarif kontrak bulanan ÷173,3333 jam). Uji lembur: tambahan jam sampai total 8,5 jam/hari → **tetap tersimpan** (status 201), respons menyertakan pesan peringatan, TIDAK ditolak. UI diverifikasi juga lewat browser sungguhan (login `ppic.a@debug.mrp`, WO Gummy Zala real, form terisi & submit sukses, screenshot ada di riwayat sesi).

Typecheck bersih, `npm run build` sukses, 37/37 test tetap lulus.

### Temuan TAMBAHAN saat mengerjakan ini: `spesifikasi-aturan-biaya-v1.md` ternyata sudah direvisi ke rev. 4 (bukan cuma klarifikasi labor pool)

`git diff` terhadap file spec sebelum menulis ulang menunjukkan perubahan JAUH lebih luas dari sekadar K1 (labor pool) yang diminta secara eksplisit — file itu sendiri sudah di-edit ke **rev. 4** dengan 3 revisi angka nyata:
1. **Batch gummy 9kg → 10kg** (G1) — skala berubah 27,440419 → 30,489354.
2. **Kapasitas gummy: "sampai 5 batch/hari" → standar perencanaan 4 batch/hari** (maksimal tetap bisa 5).
3. **Durasi tunggu tahap Setting: 1 jam (SOP PDF) → ~16 jam/960 menit** (realitas lapangan semalaman).

Ketiganya MENGALIR ke semua angka Contoh 1 & 3 di §5 (premix, gummy, margin per botol, agregasi SAS001, laba operasional). **Disinkronkan semua** (bukan cuma yang diminta eksplisit) karena file ditandai "rev. 4 — FINAL":
- `scripts/seed-realcase-itm.js`: `production_standards` Gummy Zala `unit_per_batch` 51→**56,6667**, `batches_per_day` 5→**4**; routing step "Setting" `wait_duration_minutes` 60→**960**. **BOM per-botol TIDAK perlu diubah** — diverifikasi rasio per-unit-output scale-invariant terhadap ukuran batch (resep sama, cuma di-scale-up linear; mis. Maltitol lama 1.097,62g/51botol=21,5227g/botol, baru 1.219,57g/56,6667botol=21,5229g/botol — identik selain floating-point).
- `tests/margin_v1_acceptance.test.ts`: seluruh angka Contoh 1a/1b/3 ditulis ulang ke rev.4 (premix total Rp184.190,68 & Rp80,4057/g; gummy bahan Rp1.108.255,93, Rp22.551,16/botol produksi, margin Rp76.619,22/botol; agregasi Σ margin Rp1.588.087.228,45, laba Rp1.527.587.228,45) — 4/4 masih lulus.
- Fitur Deteksi Konflik Perencanaan diverifikasi ulang terhadap SAS001 sungguhan dengan standar baru: `batches_needed: 353` (persis rev.4), `days_needed: 89`, `material_blocked_until: "2026-08-22"` (tidak berubah), `total_working_days_to_deadline: 21` (tidak berubah), tetap `feasible: false`.

Typecheck bersih, `npm run build` sukses, 37/37 test tetap lulus (setelah kedua koreksi di atas digabung).

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
