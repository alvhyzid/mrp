# Referensi Routing Serbuk 10 Tahap (Sachet + Box) — Karanglo

**Sumber**: rekaman langsung dari `routings`/`routing_steps`/`production_standards`
company_id=1 (PT ITM), diambil 26 Agu 2026 SEBELUM baris-baris ini dihapus sebagai
bagian pembersihan total studi kasus Gummy Zala/Drinkme → MLVT (Bagian B, migrasi
`20260826150000_total_reset_case_study.sql`).

## Kenapa dokumen ini ada

`routings.item_id` adalah foreign key **NOT NULL** ke `items` — satu baris routing
tidak bisa hidup tanpa item pemiliknya yang sah. Instruksi pemilik produk (26 Agu
2026) meminta DUA hal yang secara teknis tidak bisa hidup berdampingan: "hapus
SELURUH item master tanpa sisa" DAN "routing serbuk 10 tahap tetap ada". Karena
baris routing/production_standards LAMA (dimiliki `PMSC001ITM`/`PMBX001ITM`, item
yang ikut dihapus) tidak bisa bertahan tanpa item-nya, isinya direkam PERSIS di sini
SEBELUM dihapus — supaya saat MLVT dibangun (Bagian D), routing yang SAMA PERSIS
bisa dibuat ulang untuk item MLVT dalam hitungan menit, bukan ditebak ulang dari nol.
Ini keputusan teknis Claude Code (bukan fakta bisnis yang diimprovisasi) — item &
routing lama TETAP dihapus total sesuai instruksi eksplisit "tanpa sisa".

## Routing Sachet (dulu `routing_id=61`, dimiliki `PMSC001ITM`, versi 1)

| # | Nama Tahap | Durasi Aktif (menit) | Durasi Tunggu (menit) | Work Center | Durasi per Unit |
|---|---|---|---|---|---|
| 1 | Persiapan & penimbangan bahan | 60 | 0 | — | — |
| 2 | Premix Mixing | 30 | 0 | — | — |
| 3 | Batch Mixing | 45 | 0 | — | — |
| 4 | Filling Sachet | 0 | 0 | Mesin Filling Sachet (WC-FILLING-SACHET, Karanglo, 2 unit, 8 jam/hari) | 0,028571 menit/pcs (≈35 pcs/menit per mesin, ≈70 pcs/menit gabungan 2 mesin) |
| 5 | QC Sachet | 30 | 0 | — | — |

## Routing Box (dulu `routing_id=62`, dimiliki `PMBX001ITM`, versi 1)

| # | Nama Tahap | Durasi Aktif (menit) | Durasi Tunggu (menit) | Work Center |
|---|---|---|---|---|
| 1 | Persiapan kemasan sekunder | 30 | 0 | — |
| 2 | Filling Box | 30 | 0 | — |
| 3 | Lem Box | 20 | 0 | — |
| 4 | Wrap & Shrink | 30 | 0 | — |
| 5 | QC final + pengemasan karton | 30 | 0 | — |

## Standar K8 (`production_standards`, sumber = `ESTIMASI_MANUAL`, belum pernah
`DIPELAJARI` — `sample_count=0` semua)

**Level item (Sachet, dulu `item_id=73`)**:
- `unit_per_batch` = 3.166,66 (sachet/batch)
- `batches_per_day` = 3

**Level item (Box, dulu `item_id=75`)**:
- `yield_percentage` = 95%
- `unit_per_batch` = 226,19 (box/batch)
- `batches_per_day` = 3

**Level tahap (`active_duration_minutes`, Sachet)**: tahap 1 = 60, tahap 2 = 30,
tahap 3 = 45, tahap 5 (QC Sachet) = 30 — tahap 4 (Filling Sachet) pakai
`duration_per_unit_minutes` di `routing_steps`, bukan baris `production_standards`
terpisah.

**Level tahap (`active_duration_minutes`, Box)**: tahap 1 = 30, tahap 2 = 30,
tahap 3 = 20, tahap 4 = 30, tahap 5 = 30.

**`routing_step_standard_crew`**: 0 baris — kru standar SDM untuk kesepuluh tahap
ini BELUM PERNAH diisi sejak awal (bukan hilang karena pembersihan), penahan HPP
yang sudah dicatat berulang di HANDOFF — tetap jadi pekerjaan PPIC/produksi
terlepas dari studi kasus apa pun.

## Cara pakai untuk MLVT

Saat item MLVT (WIP Sachet MLVT + FG Box MLVT) dibuat, buat `routings`/
`routing_steps` baru dengan NAMA TAHAP dan DURASI PERSIS seperti tabel di atas
(MLVT juga minuman serbuk, tahapannya sama — alasan eksplisit pemilik produk untuk
"reuse"), lalu isi `production_standards` levelnya dengan nilai yang sama sebagai
titik awal (boleh dikoreksi PPIC kalau kapasitas riil MLVT berbeda dari Drinkme).
