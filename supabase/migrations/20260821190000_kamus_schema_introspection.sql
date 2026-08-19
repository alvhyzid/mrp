-- Migration: fungsi introspeksi SEMPIT khusus generator backlog Kamus (K1).
-- CATATAN PENTING: debug_schema_snapshot() (skema penuh: kolom+constraint+
-- index+trigger+RLS+definisi VIEW/FUNCTION lengkap) SUDAH DIHAPUS TOTAL lewat
-- audit keamanan sebelumnya (migration 20260819150000) karena permukaan
-- kebocorannya terlalu besar untuk kegunaan yang sudah tidak permanen. Fungsi
-- BARU di sini SENGAJA JAUH lebih sempit -- HANYA nama tabel+kolom+tipe data
-- dan HANYA kolom mana yang jadi primary key -- tidak membocorkan body
-- function, definisi RLS policy, atau definisi view. Tetap HANYA service_role
-- (pola sama seperti debug_list_policies yang dipertahankan sesudah audit).
create or replace function public.kamus_list_columns()
returns table (table_name text, column_name text, data_type text, is_nullable boolean)
language sql
security definer
set search_path = public, pg_catalog
as $$
  select col.table_name::text, col.column_name::text, col.data_type::text, (col.is_nullable = 'YES')
  from information_schema.columns col
  where col.table_schema = 'public'
  order by col.table_name, col.ordinal_position;
$$;

create or replace function public.kamus_list_primary_keys()
returns table (table_name text, column_name text)
language sql
security definer
set search_path = public, pg_catalog
as $$
  select rel.relname::text, a.attname::text
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace n on n.oid = rel.relnamespace
  join unnest(con.conkey) as k(attnum) on true
  join pg_attribute a on a.attrelid = rel.oid and a.attnum = k.attnum
  where n.nspname = 'public' and con.contype = 'p';
$$;

revoke all on function public.kamus_list_columns() from public, anon, authenticated;
revoke all on function public.kamus_list_primary_keys() from public, anon, authenticated;
grant execute on function public.kamus_list_columns() to service_role;
grant execute on function public.kamus_list_primary_keys() to service_role;
