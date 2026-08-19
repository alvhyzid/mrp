-- Migration FIXUP: kamus_list_columns() SEBELUMNYA scan information_schema.
-- columns tanpa membedakan TABEL ASLI dari VIEW -- menghasilkan baris kamus
-- duplikat utk 6 view "_secure" (mis. items_secure.standard_cost DAN
-- items.standard_cost dianggap 2 istilah beda, padahal sama). Ditemukan lewat
-- smoke test API sebelum antrean dipakai nyata. Diperbaiki: HANYA tabel asli
-- (pg_class.relkind = 'r'), sama seperti debug_schema_snapshot() yang lama
-- sudah benar membedakan ini.
create or replace function public.kamus_list_columns()
returns table (table_name text, column_name text, data_type text, is_nullable boolean)
language sql
security definer
set search_path = public, pg_catalog
as $$
  select col.table_name::text, col.column_name::text, col.data_type::text, (col.is_nullable = 'YES')
  from information_schema.columns col
  join pg_class c on c.relname = col.table_name
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = col.table_schema
  where col.table_schema = 'public' and c.relkind = 'r'
  order by col.table_name, col.ordinal_position;
$$;

grant execute on function public.kamus_list_columns() to service_role;
