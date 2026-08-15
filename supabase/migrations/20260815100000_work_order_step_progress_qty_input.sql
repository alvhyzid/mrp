-- Migration: rancangan qty_input/uom_input di docs/rancangan-skema-database-mrp.md
-- (tracking penyusutan antar-tahap) belum pernah diimplementasikan — tabel
-- work_order_step_progress sejauh ini cuma punya qty_recorded/uom (output).
-- qty_recorded/uom TETAP nama kolomnya (berfungsi sebagai "output"), tidak
-- di-rename — qty_input/uom_input ditambahkan sebagai pasangannya ("input").
alter table if exists work_order_step_progress
  add column if not exists qty_input numeric(14,4),
  add column if not exists uom_input text;
