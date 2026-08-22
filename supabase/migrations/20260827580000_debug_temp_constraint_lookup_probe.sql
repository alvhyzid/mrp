-- PROBE SEMENTARA (dihapus migrasi berikutnya) -- diagnosa kenapa
-- debug_force_delete_company gagal menemukan tabel anak lewat nama
-- constraint.
create or replace function public._probe_constraint_lookup(p_constraint_name text)
returns table(child_table text, child_column text, parent_table text, parent_column text)
language sql
security definer
set search_path = public, pg_catalog
as $$
  select tc.table_name, kcu.column_name, ccu.table_name, ccu.column_name
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
  join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
  where tc.constraint_name = p_constraint_name and tc.constraint_type = 'FOREIGN KEY';
$$;
revoke execute on function public._probe_constraint_lookup(text) from public, anon, authenticated;
grant execute on function public._probe_constraint_lookup(text) to service_role;
