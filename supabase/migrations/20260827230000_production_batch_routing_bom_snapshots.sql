-- Migration: snapshot routing & BOM per batch (Sesi 6A, 21 Agu 2026, didahulukan
-- dari Sesi 6/7 karena risiko hidup -- lihat HANDOFF.md).
--
-- ARKEOLOGI (6A.1, dibuktikan lewat kode langsung sebelum menulis satu baris
-- migrasi pun): work_orders.bom_id/routing_id, production_batches,
-- work_order_step_progress.routing_step_id, work_order_assignments.routing_step_id
-- SEMUANYA hanya REFERENSI (FK ke baris yang bisa berubah) -- TIDAK ADA
-- snapshot di mana pun. Dikonfirmasi via updateRouting.ts (baris 68: DELETE
-- semua routing_steps utk routing_id yang SAMA lalu INSERT ulang, TANPA cek
-- apakah routing_id itu sudah dipakai WO manapun) dan updateBom.ts (baris 97:
-- pola identik untuk bom_lines). Angka yang TERBUKTI berubah utk batch yang
-- SUDAH SELESAI kalau routing/BOM diedit hari ini setelahnya:
--   - getGanttBlockDetail.ts baris 45+113: routing_steps.active_duration_minutes/
--     duration_per_unit_minutes dibaca LIVE, ditampilkan sebagai "durasi standar"
--     di detail blok Gantt untuk BATCH APA PUN (tidak difilter status) --
--     dibandingkan dengan work_order_step_progress.started_at/completed_at
--     (fakta aktual, sudah beku) milik batch itu.
--   - WorkOrdersPage.tsx baris 608+841: "Kebutuhan Bahan" (line.qty_per_unit_output
--     × planned_qty × (1+buffer%)) dihitung ULANG dari bom_lines LIVE setiap
--     panel WO/batch dibuka -- komentar kode sendiri di createProductionBatch.ts
--     baris 12-15 mengonfirmasi ini "murni preview, tidak disimpan sebagai
--     baris terpisah".
-- computeStandardCostPerUnit.ts/computeStandardLaborCostPerUnit.ts (dipakai
-- Margin Watch) BEDA CAKUPAN -- itu level ITEM (bukan level WO/batch spesifik),
-- dan SUDAH punya lapisan pelindungnya sendiri lewat lock baseline SO-line
-- (Sesi 0C) -- TIDAK disentuh migrasi ini.
--
-- Dikonfirmasi 0 batch berstatus in_progress/completed di SELURUH sistem saat
-- migrasi ini ditulis (dicek query langsung) -- 6A.6 (tandai batch lama tanpa
-- snapshot) TIDAK PERLU migrasi backfill data, cukup logika baca yang
-- menangani kasusnya (routing_snapshot_taken_at IS NULL + status bukan
-- 'planned' = batch lama sebelum fitur ini ada).

alter table if exists production_batches
  add column if not exists routing_snapshot_taken_at timestamptz,
  add column if not exists snapshotted_bom_id integer references boms(bom_id),
  add column if not exists snapshotted_bom_version integer,
  add column if not exists snapshotted_buffer_percentage numeric,
  add column if not exists snapshotted_routing_id integer references routings(routing_id);

-- Tahap routing beku PER BATCH, diambil SAAT BATCH DIMULAI (bukan dibuat,
-- bukan selesai -- 6A.2). routing_step_id/work_center_id disimpan sebagai
-- REFERENSI HISTORIS SAJA (BUKAN foreign key ditegakkan) -- routing_steps
-- baris aslinya BISA dihapus+diganti ID baru sesudahnya (lihat updateRouting.ts),
-- jadi tidak aman dijadikan FK wajib; work_center_name/code disalin PERSIS
-- supaya tetap benar walau work center itu sendiri berganti nama di masa depan.
create table if not exists production_batch_routing_step_snapshots (
  production_batch_routing_step_snapshot_id serial primary key,
  company_id integer not null references companies(company_id),
  production_batch_id integer not null references production_batches(production_batch_id),
  routing_step_id integer,
  sequence_no integer not null,
  step_name text not null,
  work_center_id integer,
  work_center_name text,
  work_center_code text,
  active_duration_minutes numeric,
  wait_duration_minutes numeric,
  duration_per_unit_minutes numeric,
  snapshot_taken_at timestamptz not null default now()
);
create index if not exists production_batch_routing_step_snapshots_batch_idx
  on production_batch_routing_step_snapshots (production_batch_id);

-- Standar kru beku PER BATCH (6A.2 -- diminta eksplisit walau saat ini belum
-- ada satu pun tampilan level-batch yang membacanya; routing_step_standard_crew
-- juga belum punya UI tulis sama sekali per audit Sesi 5, jadi ini murni
-- kesiapan data ke depan, bukan tambalan bug yang teramati sekarang).
create table if not exists production_batch_standard_crew_snapshots (
  production_batch_standard_crew_snapshot_id serial primary key,
  company_id integer not null references companies(company_id),
  production_batch_id integer not null references production_batches(production_batch_id),
  routing_step_standard_crew_id integer,
  role_label text,
  wage_type text,
  headcount integer,
  hours_per_day numeric,
  is_full_day_dedicated boolean,
  source text,
  notes text,
  snapshot_taken_at timestamptz not null default now()
);
create index if not exists production_batch_standard_crew_snapshots_batch_idx
  on production_batch_standard_crew_snapshots (production_batch_id);

-- Baris BOM beku PER BATCH -- component_item_id AMAN di-FK (items tidak
-- pernah hard-delete, cuma diarsipkan lewat is_active). bom_line_id/
-- routing_step_id (rasio komponen ini mulai dipakai di tahap mana) TETAP
-- referensi historis saja, sama alasannya dengan tabel routing di atas.
create table if not exists production_batch_bom_line_snapshots (
  production_batch_bom_line_snapshot_id serial primary key,
  company_id integer not null references companies(company_id),
  production_batch_id integer not null references production_batches(production_batch_id),
  bom_line_id integer,
  component_item_id integer not null references items(item_id),
  qty_per_unit_output numeric not null,
  uom text not null,
  routing_step_id integer,
  snapshot_taken_at timestamptz not null default now()
);
create index if not exists production_batch_bom_line_snapshots_batch_idx
  on production_batch_bom_line_snapshots (production_batch_id);
