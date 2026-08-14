-- Migration: production_batches.planned_date — kapan batch ini SEHARUSNYA
-- dikerjakan (diisi PPIC saat bikin batch), beda dari started_at yang baru
-- terisi setelah benar-benar mulai. Jadi acuan UTAMA Dashboard Kapasitas per
-- Work Center (lihat getWorkCenterCapacity.ts), supaya batch yang direncanakan
-- untuk minggu depan tidak salah kehitung sebagai beban minggu ini.
alter table if exists production_batches add column if not exists planned_date date;
