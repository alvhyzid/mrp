# Formula Resmi — MLVT ETAWAFIT V1

**Sumber**: lembar formula resmi PT Indo Taste Manufacture, ditandatangani formulator
Dhiska, 14 Agustus 2026, status **Production**. Studi kasus baru menggantikan Gummy
Zala/Drinkme (lihat `docs/formula-gummy-zala-v2.md`, dipertahankan sebagai arsip histori
saja — tidak lagi dimuat di sistem sejak reset total 26 Agu 2026).

Dokumen ini adalah kutipan tertulis dari lembar formula resmi ke repo, dipakai sebagai
rujukan saat item bahan baku diinput manual oleh pemilik produk lewat UI dan baris
`bom_lines` yang masih kosong (lihat migrasi 27 Agu 2026,
`20260827100000_mlvt_case_study_skeleton.sql`) dilengkapi.

**Kolom yang dipakai**: "Amount to Add" dari lembar formula rev. ini (buffer produksi
1% SUDAH termasuk di angka-angka di bawah) — BUKAN kolom "Amount Added" (log aktual
produksi, tidak relevan untuk BOM master). Karena buffer sudah menyatu di angka
"Amount to Add", `boms.buffer_percentage` untuk seluruh BOM MLVT sengaja dibiarkan
NULL — mengisi angka buffer tambahan di kolom itu akan menghitung buffer DUA KALI.

## Formula Utama — basis 20,23 g/sachet

| Bahan | Jumlah (g/sachet) |
|---|---|
| PMBASE-MLVT (Premix Base) | 13,00 |
| Castor Sugar | 5,00 |
| PMSPC-MLVT (Premix Spice) | 1,50 |
| PMHOT-MLVT (Premix Hot/Rempah) | 0,40 |
| PMSW-MLVT (Premix Sweetener) | 0,25 |
| Zeofree | 0,08 |

**Total basis**: 13,00 + 5,00 + 1,50 + 0,40 + 0,25 + 0,08 = **20,23 g** (cocok dengan
netto label 1 sachet = 20 g, selisih 0,23 g wajar untuk toleransi filling).

**Struktur produk**: 1 sachet = 20 g bubuk → 1 box = 10 sachet → 1 karton isi 30-40 box
(jumlah per karton fleksibel sesuai kapasitas kirim, tidak tetap). Kemasan sachet
finishing shrink.

## Premix PMSW-MLVT/001ITM — basis 100 g

| Bahan | Jumlah |
|---|---|
| Maltodextrin | 70 |
| Stevia Powder | 15 |
| Sucralose | 15 |

**Total**: 100 g.

## Premix PMHOT-MLVT/001ITM — basis 100 g

| Bahan | Jumlah |
|---|---|
| Maltodextrin | 98,61 |
| Capsicum | 0,99 |
| Ginger Oil | 0,30 |
| Zeofree | 0,10 |

**Total**: 100,00 g.

## Premix PMSPC-MLVT/001ITM — basis 100 g

| Bahan | Jumlah |
|---|---|
| Maltodextrin | 61,30 |
| Blackpepper | 4,50 |
| Cinnamon | 11,40 |
| Kunyit Bubuk | 11,40 |
| Color Derasi Curcumin (0310) | 11,40 |

**Total**: 100,00 g.

## Premix PMBASE-MLVT/001ITM — basis 116,75 g (BUKAN 100 g, jangan diseragamkan)

| Bahan | Jumlah |
|---|---|
| Creamer AVI | 60 |
| Xantan Gum | 0,75 |
| Garam | 3 |
| Cloudifier | 3 |
| Etawa Powder | 10 |
| Maltodextrin | 40 |

**Total**: 116,75 g.

## Kemasan

- **Sachet Roll Etawa Fit** — 1 roll = 500 m ÷ 15 cm/sachet = **3.333,33 sachet/roll**.
  Disimpan di `items` sebagai `base_uom='sachet'`, `purchase_uom='roll'`,
  `uom_conversion_factor=3333,333333` — supaya `bom_lines` tingkat sachet konsumsi
  PERSIS 1 (base_uom) per 1 sachet diproduksi, bukan pecahan roll yang membingungkan.
- **Box Etawa Fit** — 1 per box produk (`base_uom='box'`, `purchase_uom='box'`, factor 1).
- **Karton** — isi 30-40 box, jumlah per karton TIDAK tetap (tidak dimodelkan sebagai
  item BOM, hanya kapasitas kirim/pengemasan akhir).

## Angka pembanding untuk verifikasi (SO 043/6-ITM/2026, 2.500 box)

| | Nilai |
|---|---|
| Box | 2.500 |
| Sachet (2.500 × 10) | 25.000 |
| Bubuk (25.000 × 20,23 g) | 505,75 kg |
| Batch mixer 60 kg (tanpa yield) | ≈ 8,43 batch |
| Batch mixer 60 kg (yield 95%) | ≈ 8,87 batch |
| Kebutuhan PMBASE-MLVT (25.000 × 13,00 g) | 325 kg |
| Kebutuhan Castor Sugar (25.000 × 5,00 g) | 125 kg |
| Kebutuhan PMSPC-MLVT (25.000 × 1,50 g) | 37,5 kg |
| Kebutuhan PMHOT-MLVT (25.000 × 0,40 g) | 10 kg |
| Kebutuhan PMSW-MLVT (25.000 × 0,25 g) | 6,25 kg |
| Kebutuhan Zeofree (25.000 × 0,08 g) | 2 kg |

## Biaya kemasan per box (Margin Watch)

| Komponen | Perhitungan | Biaya |
|---|---|---|
| Sachet Roll Etawa Fit | 10 sachet × Rp469,85 | Rp4.698,50 |
| Box Etawa Fit | 1 × Rp2.500 | Rp2.500,00 |
| **Total kemasan/box** | | **Rp7.198,50** |

Rp7.198,50 = **31,3%** dari harga jual Rp23.000/box. Ini fakta biaya, bukan penilaian
terhadap target margin apa pun (target GPM 35% sudah dicabut dari sistem, lihat Bagian A
migrasi 26 Agu 2026).

## Status baris komponen BOM di database (27 Agu 2026)

Sesuai instruksi eksplisit pemilik produk — **item bahan baku TIDAK dibuat** oleh Claude
Code, pemilik produk akan input manual lewat UI (sekaligus jadi uji coba alur input
master data). Akibatnya:

- BOM 4 premix (PMSW/PMHOT/PMSPC/PMBASE-MLVT) tercipta sebagai **header saja**
  (`status='draft'`, `standard_yield_qty` sesuai basis di atas) — **NOL baris
  `bom_lines`**, karena SELURUH komponennya bahan baku yang belum ada `item_id`-nya.
- BOM formula utama (level Sachet) tercipta dengan **4 dari 6 baris terisi** (4
  premix — item-nya sudah ada dari case study ini — + 1 baris kemasan Sachet Roll
  Etawa Fit) — **Castor Sugar & Zeofree BELUM bisa diisi** (bahan baku belum ada).
- BOM level Box terisi PENUH (2 baris: 10× Sachet WIP + 1× Box Etawa Fit) — kedua
  komponennya sudah punya `item_id` dari case study ini.

Begitu pemilik produk membuat item bahan baku (Castor Sugar, Zeofree, Maltodextrin,
Stevia Powder, Sucralose, Capsicum, Ginger Oil, Blackpepper, Cinnamon, Kunyit Bubuk,
Color Derasi Curcumin (0310), Creamer AVI, Xantan Gum, Garam, Cloudifier, Etawa Powder)
lewat UI, tabel di atas jadi acuan langsung untuk mengisi baris `bom_lines` yang masih
kosong — jumlah persis "Amount to Add" per basis masing-masing BOM.
