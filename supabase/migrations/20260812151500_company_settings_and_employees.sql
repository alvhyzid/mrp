-- Migration: company_settings + employees (Kelompok 2), dengan masking gaji lewat
-- view employees_secure (Kontrol Akses Data Finansial: wage_rate/wage_type HANYA
-- company_admin, hr_manager/hr_staff, dan karyawan itu sendiri untuk data dirinya).

create table if not exists company_settings (
  company_setting_id serial primary key,
  company_id integer not null references companies(company_id),
  setting_key text not null,
  setting_value text,
  unique (company_id, setting_key)
);

alter table if exists company_settings enable row level security;

drop policy if exists company_settings_select_for_company on company_settings;
create policy company_settings_select_for_company on company_settings
  for select using (company_id = public.jwt_company_id());

drop policy if exists company_settings_write_leadership on company_settings;
create policy company_settings_write_leadership on company_settings
  for all using (company_id = public.jwt_company_id() and public.jwt_is_company_leadership())
  with check (company_id = public.jwt_company_id() and public.jwt_is_company_leadership());

create table if not exists employees (
  employee_id serial primary key,
  company_id integer not null references companies(company_id),
  production_plant_id integer references production_plants(production_plant_id),
  name text not null,
  position text,
  wage_type text not null check (wage_type in ('hourly', 'daily', 'monthly', 'piece_rate')),
  wage_rate numeric(14,2) not null,
  linked_user_id integer references users(user_id),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists employees_company_id_idx on employees (company_id);

alter table if exists employees enable row level security;

-- Tidak ada policy select di tabel dasar (default deny untuk authenticated/anon) —
-- akses baca yang aman lewat view employees_secure di bawah, supaya wage_rate/
-- wage_type tidak pernah ikut terbawa ke role yang tidak berhak walau lewat query
-- langsung ke REST API pakai anon key.
drop policy if exists employees_write_hr on employees;
create policy employees_write_hr on employees
  for insert with check (
    company_id = public.jwt_company_id()
    and public.jwt_app_role() in ('company_admin', 'hr_manager', 'hr_staff')
  );

drop policy if exists employees_update_hr on employees;
create policy employees_update_hr on employees
  for update using (
    company_id = public.jwt_company_id()
    and public.jwt_app_role() in ('company_admin', 'hr_manager', 'hr_staff')
  )
  with check (
    company_id = public.jwt_company_id()
    and public.jwt_app_role() in ('company_admin', 'hr_manager', 'hr_staff')
  );

drop view if exists employees_secure;
create view employees_secure
with (security_invoker = false)
as
select
  e.employee_id,
  e.company_id,
  e.production_plant_id,
  e.name,
  e.position,
  case
    when public.jwt_can_view_wages() or exists (
      select 1 from users u
      where u.user_id = e.linked_user_id
        and u.auth_uid = auth.uid()::text
    ) then e.wage_type
    else null
  end as wage_type,
  case
    when public.jwt_can_view_wages() or exists (
      select 1 from users u
      where u.user_id = e.linked_user_id
        and u.auth_uid = auth.uid()::text
    ) then e.wage_rate
    else null
  end as wage_rate,
  e.linked_user_id,
  e.is_active,
  e.created_at
from employees e
where e.company_id = public.jwt_company_id();

grant select on employees_secure to authenticated;

-- Catatan: fungsi agregat get_work_order_labor_cost_total() didefinisikan di migration
-- work_orders (20260812153500), karena butuh tabel work_orders/work_order_assignments
-- yang belum ada di titik migration ini.
