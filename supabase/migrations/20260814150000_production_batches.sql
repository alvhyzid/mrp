-- Migration: production_batches (Kelompok 5) — level eksekusi NYATA di bawah
-- work_orders. 1 WO biasanya dikerjakan lewat beberapa batch fisik terpisah (3-5 per
-- shift), masing-masing dengan bahan/hasil/jejak lot sendiri (isolasi traceability
-- BPOM/halal). PPIC bebas menentukan planned_qty tiap batch, TIDAK terpaku ke
-- standard_yield_qty di BOM — makanya kebutuhan bahan dihitung ULANG per batch
-- (lihat boms.buffer_percentage di bawah), bukan cuma diwariskan dari WO.
--
-- work_order_outputs/consumption/assignments/step_progress SEMUA dapat kolom
-- production_batch_id BARU (production_batch_id nullable, work_order_id yang sudah
-- ada TETAP dipertahankan sesuai skema — bukan diganti). Nullable karena data lama
-- (pencatatan langsung di level WO dari sebelum production_batches ada) tetap harus
-- valid; pencatatan BARU ke depannya seharusnya selalu diisi lewat batch.

create table if not exists production_batches (
  production_batch_id serial primary key,
  company_id integer not null references companies(company_id),
  work_order_id integer not null references work_orders(work_order_id),
  batch_number text not null,
  shift_id integer references shifts(shift_id),
  planned_qty numeric(14,4) not null,
  uom text not null,
  status text not null default 'planned' check (status in ('planned', 'in_progress', 'completed', 'cancelled')),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (work_order_id, batch_number)
);

create index if not exists production_batches_company_id_idx on production_batches (company_id);
create index if not exists production_batches_wo_id_idx on production_batches (work_order_id);

alter table if exists production_batches enable row level security;

drop policy if exists production_batches_select_for_company on production_batches;
create policy production_batches_select_for_company on production_batches
  for select using (company_id = public.jwt_company_id());

-- Sama persis role-nya dengan work_orders_write_production — "PPIC (atau siapa pun
-- yang berwenang)" per docs berarti disamakan dengan siapa yang boleh kelola WO,
-- bukan set baru.
drop policy if exists production_batches_write_production on production_batches;
create policy production_batches_write_production on production_batches
  for all using (
    company_id = public.jwt_company_id()
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('ppic_manager', 'ppic_staff', 'production_manager', 'production_staff'))
  )
  with check (
    company_id = public.jwt_company_id()
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('ppic_manager', 'ppic_staff', 'production_manager', 'production_staff'))
  );

-- boms.buffer_percentage — kompensasi kehilangan produksi (mesin, dst), dipakai untuk
-- hitung kebutuhan bahan SEBENARNYA saat batch dibuat: qty_dibutuhkan = (rasio BOM x
-- qty target batch) x (1 + buffer_percentage/100).
alter table if exists boms add column if not exists buffer_percentage numeric(5,2);

alter table if exists work_order_outputs add column if not exists production_batch_id integer references production_batches(production_batch_id);
create index if not exists work_order_outputs_batch_id_idx on work_order_outputs (production_batch_id);

alter table if exists work_order_consumption add column if not exists production_batch_id integer references production_batches(production_batch_id);
create index if not exists work_order_consumption_batch_id_idx on work_order_consumption (production_batch_id);

alter table if exists work_order_assignments add column if not exists production_batch_id integer references production_batches(production_batch_id);
create index if not exists work_order_assignments_batch_id_idx on work_order_assignments (production_batch_id);

alter table if exists work_order_step_progress add column if not exists production_batch_id integer references production_batches(production_batch_id);
create index if not exists work_order_step_progress_batch_id_idx on work_order_step_progress (production_batch_id);
