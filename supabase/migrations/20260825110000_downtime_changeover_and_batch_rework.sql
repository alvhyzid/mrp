-- Tumpangan kecil §5 (rencana-kerja-kpi.md / penyerahan-opus-fitur-kpi.md) — dua field
-- murah yang membuka SMED (changeover time) & FPY (rework) dengan sejarah sejak dini,
-- dikerjakan SEKARANG (tidak menunggu sesi KPI-2/3 yang masih digerbang SAS001/SAS005)
-- karena eksplisit diizinkan "menumpang sesi berjalan, tanpa sesi khusus".

alter table production_disruptions drop constraint if exists production_disruptions_disruption_type_check;
alter table production_disruptions add constraint production_disruptions_disruption_type_check
  check (disruption_type in (
    'equipment_breakdown', 'utility_outage', 'external_factor', 'reprioritized', 'changeover', 'other'
  ));

alter table production_batches add column if not exists rework boolean not null default false;
