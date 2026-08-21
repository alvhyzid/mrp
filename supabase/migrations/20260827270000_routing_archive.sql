-- Sesi 7 (21 Agu 2026, 7.2/7.3) -- routing bisa dibuat & diedit tapi TIDAK PERNAH
-- bisa dihapus/diarsipkan (keluhan nyata pemilik produk). Pola arsip di sini
-- MENIRU PERSIS boms.status / sales_order_line_margin_snapshots.archived_at
-- (bukan pola baru): archived_at NULL = aktif, terisi = diarsipkan. archived_by
-- ditambahkan supaya 7.4 ("tercatat siapa mengarsipkan, kapan") terpenuhi --
-- boms/items/employees TIDAK punya kolom actor ini (utang lama, tidak dibayar
-- di sini, tapi kolom baru wajib punya sejak awal).
alter table if exists routings
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by integer references users(user_id);

create index if not exists routings_archived_at_idx on routings (company_id, archived_at);
