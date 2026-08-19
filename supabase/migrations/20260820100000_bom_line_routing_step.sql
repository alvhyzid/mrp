-- Migration: kaitkan bom_lines ke tahap routing yang memakainya (Fase Produksi
-- Nyata — perbaikan model kelayakan sadar-tahap, 20 Agu 2026).
--
-- Sebelum ini, getPlanningFeasibility menganggap SEMUA komponen BOM dibutuhkan
-- sejak tahap 1 (mulai produksi) -- padahal kemasan/bahan tahap akhir (mis. Box
-- di tahap Filling Box) semestinya cuma memblokir tahap ITU dan sesudahnya, bukan
-- mulainya produksi sama sekali. routing_step_id BOLEH KOSONG dengan sengaja:
-- NULL berarti "belum diklasifikasi", dan kode aplikasi (explodeBomRequirements)
-- memperlakukan NULL sama seperti sebelumnya -- dianggap dibutuhkan sejak tahap
-- pertama routing -- supaya BOM yang belum diisi kolom ini TIDAK berubah
-- perilakunya sama sekali (tidak ada regresi).
alter table bom_lines add column if not exists routing_step_id integer references routing_steps(routing_step_id);

create index if not exists bom_lines_routing_step_id_idx on bom_lines (routing_step_id);
