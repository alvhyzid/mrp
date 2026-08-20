# Saldo Awal Stok — Gudang KL BIZ (Plant Karanglo), per 18 Agustus 2026

**Sumber:** `GUDANGKL180826.pdf` (stok opname pabrik) — plant Karanglo = produksi MINUMAN SERBUK. Data plant Ruko Dieng (gummy) menyusul.
**Aturan nilai:** `unit_cost` lot = Total Biaya ÷ Kuantitas (presisi penuh, TANPA pembulatan saat simpan). Satuan bahan = gram; kemasan = pcs/roll. **Expiry date TIDAK tersedia di laporan** → lot saldo awal dibuat tanpa expiry (FEFO buta untuk lot-lot ini; bisa dilengkapi menyusul lewat edit lot).
**Rekonsiliasi:** total 2.823.468 unit / ~~Rp237.374.438~~ **Rp233.686.422** — cocok
dengan laporan sumber.

> **KOREKSI (27 Agu 2026):** Rp237.374.438 adalah salah tulis pada header laporan
> sumber sendiri — tidak cocok dengan penjumlahan baris-barisnya sendiri (selisih
> ~Rp3,69 juta). Angka Rp233.686.422 adalah hasil penjumlahan ulang seluruh baris di
> tabel bagian 1 di bawah, dan sudah dikonfirmasi rekonsiliasi PENUH (sampai ke rupiah)
> terhadap total nilai persediaan sistem sebelum reset (Rp270.766.422,02 = Rp233.686.422
> gudang Karanglo + Rp35.880.000 Sachet Drinkme + Rp1.200.000 Plastic Wrap Box, dua item
> terakhir di luar cakupan dokumen ini). Baris-baris tabel di bawah TIDAK diubah — ini
> koreksi angka header saja.
>
> **ARSIP, TIDAK LAGI DIMUAT DI SISTEM:** seluruh data di dokumen ini (termasuk lot yang
> pernah dibuat darinya) DIHAPUS dari database saat reset total studi kasus 26 Agu 2026
> (migrasi `20260826210000_total_reset_case_study.sql`, Bagian B) — studi kasus baru
> (MLVT ETAWAFIT) mulai dari nol, bahan diinput manual oleh pemilik produk. Dokumen ini
> DIPERTAHANKAN sebagai arsip referensi kalau saldo gudang Karanglo perlu dimuat ulang ke
> sistem di masa depan — isinya TIDAK dihapus atau diubah selain koreksi header di atas.

## 1. Daftar Muat (lot saldo awal, plant Karanglo)

| Nama di PDF | Item di sistem | Qty | Satuan | Total Nilai | unit_cost | Kategori | Catatan |
|---|---|---|---|---|---|---|---|
| ASCORBIC ACID | Ascorbic Acid | 8,243.50 | g | 766,645.50 | 93.0000 | MAP |  |
| BROMALIN | Bromalin | 1,440.00 | g | 0.00 | 0.0000 | SKIP | ❌ KEPUTUSAN 18 Agu: stok sebenarnya HABIS — JANGAN dimuat; Bromalin masuk daftar beli SAS005 |
| CITRIC ACID | Citric Acid | 15,993.50 | g | 550,822.37 | 34.4404 | MAP |  |
| COLLAGEN | Kolagen | 2,920.00 | g | 550,808.57 | 188.6331 | MAP | harga lot 188,63/g ≠ harga list 210/g — biaya lot yang dipakai (jujur per stok) |
| DERASI ORANGE JUICE WSP | Derasi Orange | 1,065.00 | g | 1,126,991.52 | 1,058.2080 | MAP | nama PDF beda ('Juice WSP') — dipetakan ke item formula PMFL |
| GARAM | Garam | 350.00 | g | 4,550.00 | 13.0000 | MAP |  |
| GLUTHATIONE | Glutathione | 1,196.00 | g | 2,332,200.00 | 1,950.0000 | MAP | bahan gummy, tersimpan di KL |
| INULIN | Inulin | 28,800.00 | g | 2,304,000.00 | 80.0000 | MAP |  |
| MALIC ACID | Malic Acid | 9,591.00 | g | 1,138,435.39 | 118.6983 | MAP |  |
| MALTODEXTRINE | Maltodextrin | 139,630.68 | g | 2,330,198.70 | 16.6883 | MAP |  |
| PAPAIN | Papain | 2,440.00 | g | 0.00 | 0.0000 | SKIP | ❌ KEPUTUSAN 18 Agu: stok sebenarnya HABIS — JANGAN dimuat; Papain masuk daftar beli SAS005 |
| POLYDEXTROSE | Polydextrose | 47,600.00 | g | 2,380,000.00 | 50.0000 | MAP |  |
| PSYLIUM HUSK | Psylium Husk | 31,076.00 | g | 4,848,044.16 | 156.0061 | MAP |  |
| SEREH POWDER | Sereh Powder | 725.00 | g | 327,047.50 | 451.1000 | MAP |  |
| STEVIA POWDER | Stevia Powder | 5,199.96 | g | 4,529,525.78 | 871.0694 | MAP |  |
| SUCRALOSE | Sucralose | 14,089.96 | g | 5,635,984.00 | 400.0000 | MAP |  |
| ZEOFREE | Zoefree | 9,079.00 | g | 390,397.00 | 43.0000 | MAP | ejaan PDF 'ZEOFREE' |
| ALCO MERAH | Alco Merah | 1,522.10 | g | 128,182.13 | 84.2140 | BARU-BAHAN |  |
| DERASI PEACH | Derasi Peach | 2,536.40 | g | 0.00 | 0.0000 | SKIP | ❌ KEPUTUSAN 18 Agu: stok sebenarnya HABIS — JANGAN dimuat (item tidak perlu dibuat dulu) |
| DERASI STRAWBERRY | Derasi Strawberry | 1,746.30 | g | 2,621,597.95 | 1,501.2300 | BARU-BAHAN |  |
| DEXTROSE | Dextrose | 17,250.00 | g | 301,875.00 | 17.5000 | BARU-BAHAN |  |
| GRAPE SEED EXT | Grape Seed Extract | 1,278.40 | g | 767,040.00 | 600.0000 | BARU-BAHAN |  |
| GULA CASTOR | Gula Castor | 7,500.00 | g | 146,250.00 | 19.5000 | BARU-BAHAN |  |
| HYALURONIC ACID | Hyaluronic Acid | 639.20 | g | 1,598,000.00 | 2,500.0000 | BARU-BAHAN |  |
| MAGNESIUM SULFATE | Magnesium Sulfate | 4,640.00 | g | 76,936.65 | 16.5812 | BARU-BAHAN |  |
| SODIUM ASCORBATE | Sodium Ascorbate | 6,100.00 | g | 500,200.00 | 82.0000 | BARU-BAHAN |  |
| PREMIX POWDER | Sorbitol Powder | 2,291,440.00 | g | 132,903,520.00 | 58.0000 | MAP | ✅ KLARIFIKASI TERJAWAB: label internal gudang untuk SORBITOL POWDER (produk minuman serbuk low sugar). Harga 58/g = persis daftar harga resmi 58.000/kg. Catat alias "PREMIX POWDER" di item supaya stok opname berikutnya otomatis cocok |
| RAW FIXLIM 1 | RAW Fixlim 1 | 120,000.00 | g | 5,084,725.98 | 42.3727 | BARU-WIP | tampak WIP produk klien lain — dimuat demi traceability |
| RAW QS COLLAGEN 1 | RAW QS Collagen 1 | 40,000.00 | g | 2,697,693.16 | 67.4423 | BARU-WIP | sama seperti di atas |
| BOX ETAWA FIT | Box Etawa Fit | 3,500.00 | pcs | 8,750,000.00 | 2,500.0000 | BARU-KEMASAN |  |
| BOX FIXNUTRI FIXLIM | Box Fixnutri Fixlim | 1,392.00 | pcs | 3,828,000.00 | 2,750.0000 | BARU-KEMASAN |  |
| BOX QUEENSI COLLAGEN | Box Queensi Collagen | 1,200.00 | pcs | 3,135,454.55 | 2,612.8788 | BARU-KEMASAN |  |
| BOX QUEENSI LEMON SAMPLE BG | Box Queensi Lemon Sample BG | 50.00 | pcs | 135,000.00 | 2,700.0000 | BARU-KEMASAN |  |
| KARDUS ITM CUSTOM | Kardus ITM Custom | 489.00 | pcs | 5,525,700.00 | 11,300.0000 | BARU-KEMASAN |  |
| SACHET ROLL ETAWA FIT | Sachet Roll Etawa Fit | 14.00 | roll | 21,924,000.00 | 1,566,000.0000 | BARU-KEMASAN | satuan ROLL; konversi roll→sachet belum diketahui, isi nanti saat dipakai |
| SACHET ROLL FIXNUTRI | Sachet Roll Fixnutri | 9.00 | roll | 14,094,000.00 | 1,566,000.0000 | BARU-KEMASAN | sama |
| SILICA GEL 2 GRM | Silica Gel 2g | 1,403.00 | pcs | 129,447.21 | 92.2646 | BARU-KEMASAN |  |
| STIKER SAMPLE 01 | Stiker Sample 01 | 1,297.00 | pcs | 123,215.00 | 95.0000 | BARU-KEMASAN |  |
| CARTRIDGE JS12 BLACK | Cartridge JS12 Black | 1.00 | pcs | 1,500,000.00 | 1,500,000.0000 | ALAT | rekomendasi: JANGAN dimuat sebagai lot (alat, bukan bahan BOM) |
| CORONG 3 SIDE UK 80MM | Corong 3 Side 80mm | 1.00 | pcs | 750,000.00 | 750,000.0000 | ALAT | sama |
| PITA LC1 CODING 30x100m | Pita LC1 Coding | 19.00 | pcs | 570,000.00 | 30,000.0000 | ALAT | sama (habis pakai mesin coding) |
| PLASTIK ROLL SHRINK | Plastik Roll Shrink | 1.00 | roll | 867,950.00 | 867,950.0000 | ALAT | sama (wrap tunnel) |

Baris qty 0 di laporan (Bubble Wrap, Lakban, produk sample jadi, dst) DILEWATI — tidak ada stok untuk dimuat.

## 2. Klasifikasi & Perlakuan

- **MAP** (17 item): sudah ada di item master seed real case — langsung buat lot saldo awal.
- **BARU-BAHAN / BARU-WIP / BARU-KEMASAN**: buat item master baru dulu (tipe sesuai kategori; WIP klien lain tetap dimuat demi traceability & nilai gudang), lalu lot saldo awal.
- **ALAT** (4 item): ✅ DIKONFIRMASI pemilik produk (18 Agu) — di-EXCLUDE dari lot inventory.
- ~~KLARIFIKASI~~ **TERJAWAB (18 Agu):** 'PREMIX POWDER' = Sorbitol Powder (label internal gudang) — dipindah ke MAP, ikut dimuat.

## 3. Temuan Penting untuk Pemilik Produk

1. ~~3 item bernilai NOL~~ **DIPUTUSKAN (18 Agu): stok ketiganya sebenarnya HABIS** — tidak dimuat sama sekali. Konsekuensi: Bromalin (±13,7 kg) & Papain (±27,5 kg) masuk daftar belanja SAS005 bersama Garcinia.
2. **Bahan Drinkme yang TIDAK ADA di stok:** ~~Sorbitol Powder~~ (TERJAWAB: ada 2.291 kg dengan label 'Premix Powder' — kebutuhan SAS005 ±961 kg TERCUKUPI) — tinggal **Garcinia Cambogia** (±13,7 kg untuk 45 batch) yang harus dibeli (lead 2–5 hari).
3. **Kemasan Drinkme TIDAK ADA:** sachet roll Drinkme Lemon & box Drinkme = 0. Lead cetak 2 minggu → kalau belum dipesan, ini JALUR KRITIS deadline 12 Sep (pesan hari ini pun baru datang ±1 Sep).
4. ~~PREMIX POWDER~~ **TERJAWAB** — lihat §1 & §2.
5. **Tanpa expiry date** — FEFO tidak berfungsi untuk lot saldo awal sampai tanggal kadaluarsa dilengkapi manual.