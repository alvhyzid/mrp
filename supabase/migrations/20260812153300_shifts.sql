-- Migration: shifts (Kelompok 2) — per lokasi pabrik, dibutuhkan sebelum tabel
-- work_order_outputs/consumption/assignments/step_progress yang merujuk shift_id.

create table if not exists shifts (
  shift_id serial primary key,
  company_id integer not null references companies(company_id),
  production_plant_id integer not null references production_plants(production_plant_id),
  name text not null,
  start_time time not null,
  end_time time not null,
  is_active boolean not null default true
);

create index if not exists shifts_company_id_idx on shifts (company_id);

alter table if exists shifts enable row level security;

drop policy if exists shifts_select_for_company on shifts;
create policy shifts_select_for_company on shifts
  for select using (company_id = public.jwt_company_id());

drop policy if exists shifts_write_production on shifts;
create policy shifts_write_production on shifts
  for all using (
    company_id = public.jwt_company_id()
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('production_manager', 'ppic_manager'))
  )
  with check (
    company_id = public.jwt_company_id()
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('production_manager', 'ppic_manager'))
  );
