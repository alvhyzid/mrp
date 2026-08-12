-- Migration: production_plants (Kelompok 2) — 1 company bisa punya beberapa lokasi
-- pabrik fisik. Untuk saat ini 1 plant = 1 gudang (lihat docs).

create table if not exists production_plants (
  production_plant_id serial primary key,
  company_id integer not null references companies(company_id),
  name text not null,
  address text,
  product_focus text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists production_plants_company_id_idx on production_plants (company_id);

alter table if exists production_plants enable row level security;

drop policy if exists production_plants_select_for_company on production_plants;
create policy production_plants_select_for_company on production_plants
  for select using (company_id = public.jwt_company_id());

-- Menambah/mengubah lokasi pabrik adalah keputusan level pimpinan perusahaan
-- (company_admin/general_manager), bukan operasional harian.
drop policy if exists production_plants_insert_leadership on production_plants;
create policy production_plants_insert_leadership on production_plants
  for insert with check (company_id = public.jwt_company_id() and public.jwt_is_company_leadership());

drop policy if exists production_plants_update_leadership on production_plants;
create policy production_plants_update_leadership on production_plants
  for update using (company_id = public.jwt_company_id() and public.jwt_is_company_leadership())
  with check (company_id = public.jwt_company_id() and public.jwt_is_company_leadership());
