-- QA-01 (22 Agu 2026) -- fungsi pendukung TEST SAJA (dipanggil dari
-- tests/testCompanyCleanup.ts), bukan dipakai aplikasi produksi. Menyapu
-- SEMUA tabel yang punya kolom company_id (ditemukan dinamis lewat
-- information_schema, BUKAN daftar tabel ditulis tangan -- otomatis ikut
-- tabel baru tanpa perlu migrasi lanjutan) dan menghitung sisa baris untuk
-- SATU company_id, dalam SATU round-trip (bukan puluhan panggilan REST
-- terpisah yang di percobaan pertama terbukti tetap lambat walau dijalankan
-- bersamaan -- overhead jaringan per-request tetap menumpuk).
create or replace function public.debug_company_residual_scan(p_company_id integer)
returns table(table_name text, row_count bigint)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_table record;
  v_count bigint;
begin
  for v_table in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables t on t.table_name = c.table_name and t.table_schema = 'public' and t.table_type = 'BASE TABLE'
    where c.table_schema = 'public' and c.column_name = 'company_id'
  loop
    execute format('select count(*) from %I where company_id = $1', v_table.table_name) into v_count using p_company_id;
    if v_count > 0 then
      table_name := v_table.table_name;
      row_count := v_count;
      return next;
    end if;
  end loop;
end;
$$;

revoke execute on function public.debug_company_residual_scan(integer) from public, anon, authenticated;
grant execute on function public.debug_company_residual_scan(integer) to service_role;
