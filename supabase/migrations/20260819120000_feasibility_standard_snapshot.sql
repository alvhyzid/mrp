-- Migration: D.4 (Fase Produksi Nyata) -- snapshot standar per rencana.
--
-- Desain: HANYA unit_per_batch dan batches_per_day yang dipakai sebuah
-- sales_order_line disimpan (bukan seluruh hasil perhitungan) -- begitu snapshot
-- pertama diambil (panggilan pertama getPlanningFeasibility untuk baris itu),
-- angka STANDAR itu dikunci SELAMANYA untuk baris tsb dan dipakai di SETIAP
-- panggilan berikutnya, TIDAK PERNAH ikut berubah diam-diam kalau
-- production_standards yang mendasarinya berubah belakangan (mis. lewat
-- decide_production_standard_proposal). Bagian yang MEMANG seharusnya tetap
-- hidup (hari ini, sisa hari kerja sampai deadline) TETAP dihitung ulang setiap
-- panggilan dari kalender -- yang dikunci murni angka STANDAR-nya, bukan seluruh
-- hasil. Kalau standar live sekarang beda dari yang di-snapshot, endpoint
-- menambahkan field `standard_drift` di response (notifikasi dampak) TANPA
-- mengubah angka rencana yang sudah dihitung.
create table if not exists sales_order_line_feasibility_snapshots (
  sales_order_line_feasibility_snapshot_id serial primary key,
  company_id integer not null references companies(company_id),
  sales_order_line_id integer not null unique references sales_order_lines(sales_order_line_id),
  unit_per_batch numeric(14,4) not null,
  batches_per_day numeric(14,4) not null,
  created_at timestamptz not null default now()
);

create index if not exists sales_order_line_feasibility_snapshots_company_idx
  on sales_order_line_feasibility_snapshots (company_id);

alter table if exists sales_order_line_feasibility_snapshots enable row level security;

drop policy if exists sales_order_line_feasibility_snapshots_select on sales_order_line_feasibility_snapshots;
create policy sales_order_line_feasibility_snapshots_select on sales_order_line_feasibility_snapshots
  for select using (company_id = public.jwt_company_id());

-- Tulis lewat service-role client di getPlanningFeasibility.ts (pola sama dgn
-- endpoint lain di app ini) -- bukan endpoint terpisah, dan sengaja immutable
-- (tidak ada UPDATE sama sekali dari app layer, cuma INSERT sekali per baris).
drop policy if exists sales_order_line_feasibility_snapshots_write on sales_order_line_feasibility_snapshots;
create policy sales_order_line_feasibility_snapshots_write on sales_order_line_feasibility_snapshots
  for insert with check (
    company_id = public.jwt_company_id()
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('ppic_manager', 'ppic_staff', 'production_manager'))
  );
