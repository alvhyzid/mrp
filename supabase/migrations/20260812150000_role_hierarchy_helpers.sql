-- Migration: Role hierarchy (16 roles) + reusable JWT claim helper functions
--
-- Semua RLS policy baru dari sini seterusnya membaca claim JWT (company_id, app_role)
-- lewat dua fungsi helper ini, konsisten dengan pola auth.jwt() yang sudah dipakai di
-- migration sebelumnya, supaya tidak berulang di puluhan policy.

drop function if exists public.jwt_company_id();
create function public.jwt_company_id()
returns integer
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'company_id', '')::integer;
$$;

drop function if exists public.jwt_app_role();
create function public.jwt_app_role()
returns text
language sql
stable
as $$
  select auth.jwt() ->> 'app_role';
$$;

grant execute on function public.jwt_company_id() to authenticated;
grant execute on function public.jwt_app_role() to authenticated;

-- Role hierarchy: 1 super_admin (lintas tenant) + company_admin + general_manager
-- + 6 department (production/ppic/finance/purchasing/warehouse/hr) masing-masing
-- manager/staff + viewer. Lihat docs/rancangan-skema-database-mrp.md > catatan role.
alter table if exists users
  drop constraint if exists users_role_check;

alter table if exists users
  add constraint users_role_check check (
    role in (
      'super_admin',
      'company_admin',
      'general_manager',
      'production_manager', 'production_staff',
      'ppic_manager', 'ppic_staff',
      'finance_manager', 'finance_staff',
      'purchasing_manager', 'purchasing_staff',
      'warehouse_manager', 'warehouse_staff',
      'hr_manager', 'hr_staff',
      'viewer'
    )
  );

-- company_admin & general_manager setara di level operasional (lihat catatan role di
-- docs) — dipakai berulang di banyak policy, jadi dijadikan fungsi.
drop function if exists public.jwt_is_company_leadership();
create function public.jwt_is_company_leadership()
returns boolean
language sql
stable
as $$
  select public.jwt_app_role() in ('company_admin', 'general_manager');
$$;

grant execute on function public.jwt_is_company_leadership() to authenticated;

-- Role yang boleh melihat data finansial gabungan (harga jual/margin/biaya) TAPI
-- BUKAN gaji individual — lihat "Kontrol Akses Data Finansial" di docs.
drop function if exists public.jwt_can_view_financial_data();
create function public.jwt_can_view_financial_data()
returns boolean
language sql
stable
as $$
  select public.jwt_app_role() in ('company_admin', 'general_manager', 'finance_manager');
$$;

grant execute on function public.jwt_can_view_financial_data() to authenticated;

-- Role yang boleh melihat gaji individual (employees.wage_rate/wage_type).
-- general_manager & finance_manager SENGAJA tidak termasuk (lihat docs).
drop function if exists public.jwt_can_view_wages();
create function public.jwt_can_view_wages()
returns boolean
language sql
stable
as $$
  select public.jwt_app_role() in ('company_admin', 'hr_manager', 'hr_staff');
$$;

grant execute on function public.jwt_can_view_wages() to authenticated;
