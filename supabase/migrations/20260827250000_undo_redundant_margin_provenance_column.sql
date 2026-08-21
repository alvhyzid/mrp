-- Temporary undo: kolom missing_cost_item_codes_at_lock (migrasi
-- 20260827240000, dihapus lagi sebelum di-commit) ternyata REDUNDAN --
-- sales_order_line_margin_snapshots.missing_cost_item_codes SUDAH menyimpan
-- persis ini sejak Sesi 0C (baris di lockMarginBaseline.ts sudah menulisnya
-- ke situ), dan getMarginWatch.ts/SalesOrdersPage.tsx SUDAH membaca+menampilkannya.
-- File migrasi 20260827240000 dihapus SEBELUM sempat di-commit ke git (belum
-- jadi bagian riwayat permanen), jadi baris ALTER TABLE ini murni membersihkan
-- kolom yang sempat terlanjur dibuat di database dev supaya tetap sinkron
-- dengan daftar file migrasi -- bukan mengedit migrasi yang sudah ter-commit.
alter table if exists sales_order_line_margin_snapshots
  drop column if exists missing_cost_item_codes_at_lock;
