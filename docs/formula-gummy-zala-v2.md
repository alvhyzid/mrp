# Formula Resmi — Gummy Zala V2

**Sumber**: lembar formula resmi PT Indo Taste Manufacture, ditandatangani formulator
Dhiska, 14 Agustus 2026, status **Production**. Menggantikan formula simulasi lama
(rev.4 lama dan seluruh angka yang berasal darinya KADALUARSA per 26 Agu 2026).

Dokumen ini adalah kutipan tertulis dari lembar formula resmi ke repo, dipakai sebagai
rujukan saat memperbarui `bom_lines`/`items` di database (lihat migrasi 26 Agu 2026 dan
`docs/rancangan-skema-database-mrp.md` Kelompok 2 untuk skema terkait).

## Basis resep — 296,65 g, batch 10 kg

| Bahan | Jumlah (per basis) |
|---|---|
| Premix Gummy (Maltitol) | 40 |
| Polydextrose | 15 |
| Polysorb maltitol syrup | 50 |
| Modified Starch 928 | 12 |
| Modified Starch MB | 4 |
| Gellan Gum High Acyl | 0,25 |
| Sorbitol Liquid | 25 |
| Gliserin | 1 |
| Premix Gelatin | 28 |
| Citric acid | 0,20 |
| Malic acid | 1,50 |
| Air | 100 |
| Kolagen | 4 |
| Glutation | 0,20 |
| Pewarna merah (Derasi) | 0,50 |
| Konsentrat Stroberi (Delifru) | 15 |

**Total basis**: 296,65 g (cocok dengan jumlah baris di atas).

**Output**: 2,5 g/pcs gummy, 60 pcs/botol, yield 85% → **56,6667 botol/batch** (basis
batch 10 kg). Angka "400 pcs" yang sempat muncul di sumber lain dikonfirmasi KELIRU oleh
pemilik produk — diabaikan.

### Premix Gelatin — batch 160,60 g

| Bahan | Jumlah |
|---|---|
| Citric acid | 0,50 |
| Potassium Sorbate | 0,05 |
| Sodium Benzoate | 0,05 |
| Gelatin | 60 |
| Air | 100 |

Output = input (proses campur, tanpa susut).

---

## Catatan Kaki — Koreksi Penamaan Premix (WAJIB dibaca sebelum memakai dokumen ini)

> **Kutipan asli lembar formula menulis "Premix Powder" untuk baris Maltitol di atas.
> Ini SALAH TULIS pada lembar aslinya** — dikonfirmasi pemilik produk 26 Agu 2026.
> Kutipan tabel basis resep di atas SUDAH ditulis dengan label yang benar
> ("Premix Gummy"); catatan kaki ini menjelaskan MENGAPA, bukan mengubah isi kutipan.
>
> Dua kode premix ini rawan tertukar — harganya berbeda 5,4× lipat:
> - **PMGM = "Premix Gummy"** = **Maltitol Powder** (item `RM-MALTITOL`, Rp315.000/kg,
>   lini Gummy) — bahan tunggal, bukan campuran.
> - **PMPW = "Premix Powder"** = **Sorbitol Powder** (item `RM-SORBITOL-POWDER`,
>   Rp58.000/kg, lini Serbuk/Drinkme) — bahan tunggal, bukan campuran, TIDAK dipakai
>   di formula Gummy Zala sama sekali.
>
> Kedua kode ini juga tercatat sebagai baris prioritas 1 di Kamus
> (`rule.kode_pmgm_premix_gummy` / `rule.kode_pmpw_premix_powder`).

## Item baru dari formula ini

| Item | Kode | Harga | Status |
|---|---|---|---|
| Potassium Sorbate | `PTS-01` | belum ada | harga belum terverifikasi |
| Sodium Benzoate | `SOD-01` | belum ada | harga belum terverifikasi |
| Pewarna Merah (Derasi) | `RM-DERASI-STRAWBERRY` (item lama, digabung — lihat catatan) | Rp1.470.000/kg | terverifikasi |
| Konsentrat Stroberi (Delifru) | `FLA-DELIFRU-STRAWFRU-01` | Rp99.900/kg | terverifikasi |

> **Pewarna Merah (Derasi) DIGABUNG ke item lama `RM-DERASI-STRAWBERRY`** (bukan item
> baru `FLA-DERASI-STRAW-01` seperti kode yang diusulkan) — item itu sudah ada di
> database dengan harga lama Rp1.501.230/kg (dari saldo awal gudang Karanglo, belum
> pernah dipakai di BOM manapun). Harga diperbarui ke Rp1.470.000/kg sesuai formula
> resmi ini; lot gudang yang sudah ada TIDAK diubah (unit_cost lot = fakta historis
> pembelian, beda konsep dari `items.standard_cost` = acuan perencanaan).

## Harga masih asumsi (ditandai `cost_unverified` di sistem, peringatan tampil di Margin Watch)

- Polysorb maltitol syrup — Rp268.000/kg (kontributor bahan terbesar, ~Rp451.710/batch 10kg)
- Modified Starch 928 — Rp95.000/kg
- Modified Starch MB — Rp60.000/kg
- Gellan Gum High Acyl — Rp400.000/kg
- Potassium Sorbate — belum ada harga sama sekali
- Sodium Benzoate — belum ada harga sama sekali

---

# Formula Resmi — Drinkme V1

## Basis resep — 20,13 g/sachet (netto label 20 g)

| Bahan | Jumlah (g/sachet) |
|---|---|
| PMSW (Premix Pemanis) | 0,04 |
| PMFLV (Premix Flavor) | 2,40 |
| PMAC (Premix Acid) | 0,80 |
| PMVITC (Premix Vitamin C) | 0,60 |
| PMSRH (Premix Sereh) | 0,05 |
| Maltodextrin | 5,00 |
| Inulin | 2,00 |
| Polydextrose | 1,00 |
| Psylium Husk | 1,00 |
| Sorbitol Powder | 7,00 |
| Garam | 0,06 |
| Garcinia | 0,10 |
| Zoefree | 0,08 |

**Total basis**: 20,13 g (netto label dibulatkan 20 g).

**Papain (0,2) dan Bromalin (0,1) DIHAPUS** dari BOM — dikonfirmasi pemilik produk
TIDAK dipakai di Drinkme, tertinggal dari formula produk lain. Ini mengubah margin
Drinkme secara signifikan (menurunkan biaya bahan).

Resep 5 premix di atas (per 100 g masing-masing) **tidak berubah** dari yang sudah ada
di sistem.

---

## Angka acceptance resmi (26 Agu 2026, menggantikan rev.4 lama)

| | Gummy Zala V2 (per botol) | Drinkme V1 (per box) |
|---|---|---|
| Bahan produksi | Rp25.477,62* | Rp21.403,14* |
| Kemasan | Rp8.829,63 | Rp5.414,14* |
| Margin | Rp73.692,77 (68,2%) | Rp6.182,71 (18,7%) |
| Total order | SAS001 Rp1.473.855.356 (20.000 botol) | SAS005 Rp61.827.147 (10.000 box) |

\* **Angka ini BELUM sepenuhnya bisa direkonsiliasi otomatis oleh sistem** — lihat
laporan rekonsiliasi di HANDOFF.md untuk rincian gap dan penyebabnya (kru standar
Premix Gelatin/5 premix Drinkme belum diisi; kemasan Drinkme kemungkinan belum
menghitung silica gel yang belum ditambahkan ke BOM box).
