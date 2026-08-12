-- Migration: fungsi diagnostik untuk memeriksa RLS policy yang aktif di satu tabel.
-- PostgREST tidak mengekspos pg_catalog/pg_policies langsung lewat REST API, jadi
-- dibungkus fungsi supaya bisa dipanggil lewat .rpc() dari test (lihat
-- tests/role_hierarchy_financial_access.test.ts). HANYA untuk service_role (verifikasi
-- internal), bukan untuk dipanggil dari aplikasi/anon/authenticated.

drop function if exists public.debug_list_policies(text);
create function public.debug_list_policies(p_table_name text)
returns table (
  policyname text,
  cmd text,
  roles text,
  qual text,
  with_check text
)
language sql
security definer
set search_path = public, pg_catalog
as $$
  select
    p.policyname::text,
    p.cmd::text,
    p.roles::text,
    p.qual::text,
    p.with_check::text
  from pg_policies p
  where p.schemaname = 'public' and p.tablename = p_table_name;
$$;

revoke all on function public.debug_list_policies(text) from public;
grant execute on function public.debug_list_policies(text) to service_role;
