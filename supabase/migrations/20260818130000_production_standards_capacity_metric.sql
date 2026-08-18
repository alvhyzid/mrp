-- Migration: tambah 'batches_per_day' ke metric_key production_standards — dibutuhkan
-- fitur Deteksi Konflik Perencanaan (GELOMBANG 2 poin 5, spesifikasi-aturan-biaya-v1.md
-- §4 "Kapasitas nyata... pola kerja pipeline, sampai 5 batch gummy/hari"). Kapasitas ini
-- levelnya PER ITEM (bukan per routing_step), sama seperti yield_percentage/unit_per_batch.
alter table if exists production_standards drop constraint if exists production_standards_metric_key_check;
alter table if exists production_standards
  add constraint production_standards_metric_key_check
  check (metric_key in ('yield_percentage', 'unit_per_batch', 'active_duration_minutes', 'batches_per_day'));
