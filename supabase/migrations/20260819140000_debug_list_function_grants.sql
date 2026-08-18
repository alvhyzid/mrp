-- Migration: fungsi diagnostik untuk AUDIT MENYELURUH grant/revoke seluruh
-- fungsi di schema public — dipicu temuan nyata migration 20260819110000/130000
-- (decide_production_standard_proposal bisa dipanggil anon key karena grant ke
-- service_role tidak diikuti revoke dari PUBLIC). Perlu tahu SEMUA fungsi lain
-- yang mungkin punya pola sama.
--
-- CATATAN PENTING (ditemukan lewat audit ini): pola "revoke all ... from public"
-- SEBELUM "grant execute ... to <role>" SUDAH ADA di codebase ini sejak awal
-- (lihat migration 20260812160000_debug_list_policies_function.sql baris 30-31)
-- -- migration K8 (20260819110000) menyimpang dari pola yang sudah benar itu,
-- bukan karena tidak ada contoh untuk diikuti.
drop function if exists public.debug_list_function_grants();
create function public.debug_list_function_grants()
returns table (
  function_signature text,
  function_name text,
  is_security_definer boolean,
  grants text[]
)
language sql
security definer
set search_path = public, pg_catalog
as $$
  select
    p.oid::regprocedure::text as function_signature,
    p.proname::text as function_name,
    p.prosecdef as is_security_definer,
    coalesce(
      (
        select array_agg(
          format('%s=%s', case when a.grantee = 0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end, a.privilege_type)
          order by (case when a.grantee = 0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end)
        )
        from aclexplode(p.proacl) a
      ),
      array['PUBLIC=EXECUTE (default Postgres -- tidak ada ACL eksplisit sama sekali)']
    ) as grants
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace
  order by p.proname;
$$;

revoke all on function public.debug_list_function_grants() from public;
grant execute on function public.debug_list_function_grants() to service_role;
