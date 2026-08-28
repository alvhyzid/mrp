# SALES_CRM_CORRECTION_PLAN

**Nol implementasi dilakukan.** Rencana ini menunggu gerbang keputusan (§33 perintah).

## Yang TIDAK memerlukan keputusan baru — aturannya sudah kanonik

### K-01 — Status Sales Order bisa berubah · P1 · task **PJL-03**
- **Masalah**: SO tampak `confirmed` selamanya; tiga status tidak bisa dicapai.
- **Bukti**: penyisiran repositori — satu-satunya penulis `sales_orders` hanya insert & delete kompensasi.
- **Target**: transisi `confirmed → in_production → completed`, dan `cancelled` dengan alasan.
- **Sudah tersedia**: pemicu `enforce_status_transition` di basis data; jejak audit.
- **Perlu**: aksi server + tombol + izin + penjaga uji transisi.
- **Migrasi**: tidak. **Rollback**: perubahan aplikatif, reversibel.
- **Risiko regresi**: SEDANG — menyentuh halaman SO.

### K-02 — Pembuatan SO jadi satu transaksi · P2
- **Masalah**: tiga tulisan berurutan + kompensasi manual.
- **Target**: fungsi basis data atomik, pola yang sudah dipakai penyesuaian stok.
- **Perlu**: migrasi fungsi + uji jalur galat. **Rollback**: fungsi lama dipertahankan.

### K-03 — Validasi tingkat field di 44 kontrol Sales · P2 · task **DS-25**
- **Sudah tersedia**: `src/lib/kontrakGalatField.ts`, terbukti di dua modul.
- **Perlu**: registri field per modul + pemetaan di halaman + penjaga.
- **Catatan**: kontraknya sudah membuktikan diri untuk dua bentuk formulir berbeda.

### K-04 — Tiga `window.confirm` → modal danger Carbon · P2 · task **DS-06**
- Tertahan **CONFLICT-1/CONFLICT-3** governance (kapan disapu, dan siapa pemiliknya).

### K-05 — `sales_order_lines` diberi kebijakan RLS · P2
- Menyamakan dengan sembilan tabel lain. Gagal-tertutup hari ini, jadi **bukan** perbaikan darurat.

## Yang MEMERLUKAN keputusan lebih dulu

| Koreksi | Keputusan |
|---|---|
| Alamat kirim: dibuatkan layar atau dicabut | **DEC-S09** |
| PO `on_hold`/`cancelled` | usulan — perlu aturan bisnis |
| Kolom baris (UOM, pajak, diskon, mata uang) | perlu kebutuhan nyata |
| Seluruh SALES-1..5 | **DEC-S01** |

## Urutan yang disarankan

1. **K-01** — satu-satunya P1, aturannya kanonik, dan ia memperbaiki hal yang paling terlihat pemilik produk.
2. **K-03** — kontraknya sudah terbukti; Sales tinggal memakainya.
3. **K-02** dan **K-05** — perbaikan ketahanan, tanpa perubahan yang terlihat pengguna.
4. **K-04** — setelah CONFLICT-1/3 diputuskan.

**Tidak satu pun boleh dimulai sebelum gerbang §33 dilewati.**
