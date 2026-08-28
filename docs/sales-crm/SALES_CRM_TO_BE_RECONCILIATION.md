# SALES_CRM_TO_BE_RECONCILIATION

**Pemisahan yang ditegakkan**: *keputusan kanonik* · *keputusan bisnis* · *usulan* ·
*belum diputuskan* · *ketergantungan*. **Usulan TIDAK disajikan sebagai arsitektur disetujui.**

| # | AS-IS | GAP | TO-BE | Jenis | Koreksi |
|---|---|---|---|---|---|
| 1 | SO 4 status, 1 tercapai | G-C01 | status berubah mengikuti produksi & pengiriman | **KANONIK** — state machine sudah ada di DB | PJL-03 |
| 2 | PO tanpa jalur `on_hold`/`cancelled` | G-C02 | dua tombol + alasan tercatat | **USULAN** | — |
| 3 | Insert SO tanpa transaksi | G-C03 | satu transaksi atau fungsi DB | **KANONIK** (praktik yang sudah dipakai `record_manual_stock_adjustment`) | — |
| 4 | Nol `invalidText` di Sales | G-C05 | kontrak validasi field FABRIX | **KANONIK** — `DS-25` sudah ditetapkan | DS-25 |
| 5 | 3 `window.confirm` | G-C06 | modal danger Carbon | **KANONIK** — aturan sudah ada | DS-06 |
| 6 | Alamat kirim tanpa layar | G-P04 | layar, atau kapabilitasnya dicabut | **KEPUTUSAN BISNIS** | DEC-S09 |
| 7 | Baris tanpa UOM/pajak/diskon/mata uang | G-P01 | kolom menyusul saat dibutuhkan nyata | **BELUM DIPUTUSKAN** | — |
| 8 | Nol revisi PO/SO | G-P02 | pola "hapus=arsip, edit=versi" | **KANONIK** (prinsip sudah berlaku) | SALES-4 |
| 9 | Kontak menempel di PO | G-P05 | entitas kontak | **USULAN** | SALES-1 |
| 10 | Nol lapisan pra-order | G-N01..N04 | Lead→Opportunity→Sample→Quotation | **KANONIK urutannya** (SALES-1..3), **tergantung** BL-01 | SLS-01..03 |
| 11 | Komplain belum ada | G-N06 | **NCR tipe baru** + tautan SO/pengiriman | **KANONIK** — tinjauan menolak sistem kedua | SLS-05 |
| 12 | Contract, Commission | G-N07/08 | diparkir | **KANONIK** — pemicu tercatat | SLS-90 |
| 13 | Forecast | — | **tidak dibangun** | **KANONIK — DITOLAK** | SLS-90 |

## Ketergantungan

Butir 10–12 seluruhnya **tergantung DEC-S01**. Butir 1–5 **tidak** — seluruhnya koreksi atas
kapabilitas yang sudah ada, dan aturannya sudah kanonik.
