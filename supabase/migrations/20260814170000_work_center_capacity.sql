-- Migration: work_centers.capacity_hours_per_day — dasar Dashboard Kapasitas per
-- Work Center (item #1, Bagian 3 docs/rencana-ams-mvp.md). Nullable: banyak
-- work_center yang belum diisi kapasitasnya, dashboard WAJIB tampilkan "Kapasitas
-- belum diatur" untuk kasus ini, bukan dianggap 0/error.
alter table if exists work_centers add column if not exists capacity_hours_per_day numeric(5,2);
