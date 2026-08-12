-- Migration: employees.department + tabel employee_attendance (absensi harian umum),
-- sesuai docs/rancangan-skema-database-mrp.md bagian employees & employee_attendance,
-- dan Prinsip Desain #8 (dashboard per-department, data tetap satu sumber).

alter table if exists employees
  add column if not exists department text;

alter table if exists employees
  add constraint employees_department_check
  check (department in ('production', 'ppic', 'finance', 'purchasing', 'warehouse', 'hr', 'management'));

-- department non-sensitif (bukan data finansial) — ikut ditambahkan ke view
-- employees_secure yang sudah ada supaya bisa dipakai filter dashboard per-department.
drop view if exists employees_secure;
create view employees_secure
with (security_invoker = false)
as
select
  e.employee_id,
  e.company_id,
  e.production_plant_id,
  e.department,
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

-- Pemetaan role manager department -> department yang mereka kelola (dipakai untuk
-- scoping absensi: "Manager tiap department bisa lihat absensi staf DI department
-- mereka sendiri"). hr_manager/hr_staff sengaja TIDAK di sini karena mereka sudah
-- dapat akses penuh lewat jwt_can_view_wages()-style check langsung di policy.
drop function if exists public.jwt_managed_department();
create function public.jwt_managed_department()
returns text
language sql
stable
as $$
  select case public.jwt_app_role()
    when 'production_manager' then 'production'
    when 'ppic_manager' then 'ppic'
    when 'finance_manager' then 'finance'
    when 'purchasing_manager' then 'purchasing'
    when 'warehouse_manager' then 'warehouse'
    else null
  end;
$$;

grant execute on function public.jwt_managed_department() to authenticated;

create table if not exists employee_attendance (
  employee_attendance_id serial primary key,
  company_id integer not null references companies(company_id),
  employee_id integer not null references employees(employee_id),
  attendance_date date not null,
  check_in_at timestamptz,
  check_out_at timestamptz,
  status text not null default 'present' check (status in ('present', 'late', 'absent', 'on_leave', 'sick')),
  notes text,
  created_at timestamptz not null default now(),
  unique (employee_id, attendance_date)
);

create index if not exists employee_attendance_company_id_idx on employee_attendance (company_id);
create index if not exists employee_attendance_employee_id_idx on employee_attendance (employee_id);

alter table if exists employee_attendance enable row level security;

-- Akses (lihat docs): company_admin & hr_manager/hr_staff -> semua karyawan.
-- Manager tiap department -> staf DI department mereka sendiri saja.
-- Karyawan sendiri (linked_user_id) -> cuma baris miliknya sendiri.
drop policy if exists employee_attendance_select on employee_attendance;
create policy employee_attendance_select on employee_attendance
  for select using (
    company_id = public.jwt_company_id()
    and (
      public.jwt_app_role() in ('company_admin', 'hr_manager', 'hr_staff')
      or exists (
        select 1 from employees e
        where e.employee_id = employee_attendance.employee_id
          and e.department = public.jwt_managed_department()
      )
      or exists (
        select 1 from employees e
        join users u on u.user_id = e.linked_user_id
        where e.employee_id = employee_attendance.employee_id
          and u.auth_uid = auth.uid()::text
      )
    )
  );

-- Tulis (insert/update): company_admin & hr_manager/hr_staff kelola semua baris;
-- karyawan boleh submit/ubah absensinya sendiri (self check-in/check-out).
-- Manager department SENGAJA tidak diberi akses tulis di sini — docs hanya
-- menyebutkan mereka "bisa lihat", bukan mengelola absensi staf lain.
drop policy if exists employee_attendance_write_hr on employee_attendance;
create policy employee_attendance_write_hr on employee_attendance
  for all using (
    company_id = public.jwt_company_id()
    and public.jwt_app_role() in ('company_admin', 'hr_manager', 'hr_staff')
  )
  with check (
    company_id = public.jwt_company_id()
    and public.jwt_app_role() in ('company_admin', 'hr_manager', 'hr_staff')
  );

drop policy if exists employee_attendance_self_submit on employee_attendance;
create policy employee_attendance_self_submit on employee_attendance
  for all using (
    company_id = public.jwt_company_id()
    and exists (
      select 1 from employees e
      join users u on u.user_id = e.linked_user_id
      where e.employee_id = employee_attendance.employee_id
        and u.auth_uid = auth.uid()::text
    )
  )
  with check (
    company_id = public.jwt_company_id()
    and exists (
      select 1 from employees e
      join users u on u.user_id = e.linked_user_id
      where e.employee_id = employee_attendance.employee_id
        and u.auth_uid = auth.uid()::text
    )
  );
