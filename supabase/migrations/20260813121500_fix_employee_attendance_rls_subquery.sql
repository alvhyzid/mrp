-- Migration: perbaiki bug nyata di RLS employee_attendance — policy sebelumnya
-- pakai `exists (select 1 from employees e where ...)` langsung di dalam policy,
-- tapi tabel employees SENDIRI tidak punya policy SELECT sama sekali (sengaja,
-- supaya wage_rate/wage_type cuma bisa diakses lewat view employees_secure).
-- Subquery RLS berjalan sebagai role PEMANGGIL (bukan security definer), jadi
-- exists(...) itu SELALU false untuk siapa pun selain yang punya bypass — akibatnya
-- production_manager dan karyawan sendiri sama-sama tidak bisa lihat/submit apa pun.
-- Ditemukan lewat test otomatis (tests/employee_attendance_access.test.ts).
--
-- Perbaikan: bungkus pengecekan jadi fungsi SECURITY DEFINER supaya bisa membaca
-- tabel employees terlepas dari RLS-nya, tapi cuma mengembalikan boolean (tidak
-- membocorkan data mentah).

drop function if exists public.employee_matches_managed_department(integer);
create function public.employee_matches_managed_department(p_employee_id integer)
returns boolean
language sql
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from employees e
    where e.employee_id = p_employee_id
      and e.company_id = public.jwt_company_id()
      and e.department = public.jwt_managed_department()
  );
$$;

grant execute on function public.employee_matches_managed_department(integer) to authenticated;

drop function if exists public.employee_belongs_to_current_user(integer);
create function public.employee_belongs_to_current_user(p_employee_id integer)
returns boolean
language sql
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from employees e
    join users u on u.user_id = e.linked_user_id
    where e.employee_id = p_employee_id
      and u.auth_uid = auth.uid()::text
  );
$$;

grant execute on function public.employee_belongs_to_current_user(integer) to authenticated;

drop policy if exists employee_attendance_select on employee_attendance;
create policy employee_attendance_select on employee_attendance
  for select using (
    company_id = public.jwt_company_id()
    and (
      public.jwt_app_role() in ('company_admin', 'hr_manager', 'hr_staff')
      or public.employee_matches_managed_department(employee_attendance.employee_id)
      or public.employee_belongs_to_current_user(employee_attendance.employee_id)
    )
  );

drop policy if exists employee_attendance_self_submit on employee_attendance;
create policy employee_attendance_self_submit on employee_attendance
  for all using (
    company_id = public.jwt_company_id()
    and public.employee_belongs_to_current_user(employee_attendance.employee_id)
  )
  with check (
    company_id = public.jwt_company_id()
    and public.employee_belongs_to_current_user(employee_attendance.employee_id)
  );
