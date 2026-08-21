-- Migration: asal-usul (provenance) standar yang membentuk baseline Kelayakan
-- Jadwal terkunci (Sesi 5, item 3, 21 Agu 2026 -- lihat HANDOFF.md).
--
-- CATATAN PENANGGALAN: `date -u` menunjukkan 2026-08-21, TAPI migrasi terakhir
-- yang applied berlabel 20260827200000 ("27 Agu") akibat drift penanggalan
-- yang sudah didokumentasikan (lihat HANDOFF.md Bagian A migrasi Sachet Roll,
-- 20260827130000). Mengikuti keputusan yang sama: migrasi baru TETAP memakai
-- timestamp yang melebihi urutan drift ini (bukan kembali ke tanggal asli),
-- sampai drift ini diluruskan lewat keputusan eksplisit pemilik produk.
--
-- Konteks: `sales_order_line_feasibility_snapshots.unit_per_batch`/`batches_per_day`
-- dikunci dari `production_standards`, yang SUDAH punya kolom `source`
-- (ESTIMASI_MANUAL/DIPELAJARI) + `sample_count` -- TAPI baseline yang terkunci
-- SEBELUM ini tidak pernah merekam DARI MANA angkanya berasal, jadi orang yang
-- membaca selisih (drift) tidak tahu apakah baseline itu tebakan kasar atau
-- hasil pembelajaran dari puluhan batch nyata. Gerbang kelengkapan TIDAK
-- diubah (ESTIMASI_MANUAL tetap boleh dikunci) -- ini murni kejujuran asal-usul,
-- bukan pengetatan aturan.
alter table if exists sales_order_line_feasibility_snapshots
  add column if not exists unit_per_batch_source text,
  add column if not exists unit_per_batch_sample_count integer,
  add column if not exists batches_per_day_source text,
  add column if not exists batches_per_day_sample_count integer;
