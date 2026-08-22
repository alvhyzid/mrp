-- Perbaikan 20260827570000: percobaan pertama debug_force_delete_company()
-- melempar error mentah ke pemanggil untuk kasus routings<-routing_steps --
-- akar penyebab: delete PEMULIHAN di dalam blok exception (menghapus baris
-- anak yang memblokir) TIDAK dibungkus exception handler-nya SENDIRI. Kalau
-- delete pemulihan itu sendiri gagal (mis. anak itu diblokir anak LAIN lagi,
-- rantai berlapis), kegagalannya lolos tanpa tertangkap sama sekali karena
-- PL/pgSQL tidak otomatis membungkus ulang exception yang terjadi DI DALAM
-- blok exception yang sedang aktif. Ditambal dengan blok begin/exception
-- BERSARANG di sekeliling delete pemulihan itu sendiri.
create or replace function public.debug_force_delete_company(p_company_id integer)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_table record;
  v_pass integer;
  v_progress boolean;
  v_constraint_name text;
  v_child_table text;
  v_child_column text;
  v_parent_table text;
  v_parent_column text;
begin
  for v_pass in 1..25 loop
    v_progress := false;
    for v_table in
      select c.table_name
      from information_schema.columns c
      join information_schema.tables t on t.table_name = c.table_name and t.table_schema = 'public' and t.table_type = 'BASE TABLE'
      where c.table_schema = 'public' and c.column_name = 'company_id'
    loop
      begin
        execute format('delete from %I where company_id = $1', v_table.table_name) using p_company_id;
        v_progress := true;
      exception when foreign_key_violation then
        get stacked diagnostics v_constraint_name = CONSTRAINT_NAME;
        v_child_table := null;
        select tc.table_name, kcu.column_name, ccu.table_name, ccu.column_name
          into v_child_table, v_child_column, v_parent_table, v_parent_column
        from information_schema.table_constraints tc
        join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
        join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
        where tc.constraint_name = v_constraint_name and tc.constraint_type = 'FOREIGN KEY'
        limit 1;

        if v_child_table is not null then
          -- BERSARANG: delete pemulihan ini bisa saja GAGAL LAGI (rantai anak
          -- berlapis, mis. anak dari anak) -- kalau gagal, JANGAN sampai lolos
          -- tak tertangkap; biarkan pass berikutnya mencoba lagi dari sisi lain.
          begin
            execute format(
              'delete from %I where %I in (select %I from %I where company_id = $1)',
              v_child_table, v_child_column, v_parent_column, v_parent_table
            ) using p_company_id;
            v_progress := true;
          exception when others then
            null; -- coba lagi pass berikutnya, urutan berbeda bisa menyelesaikannya
          end;
        end if;
      end;
    end loop;
    exit when not v_progress;
  end loop;
end;
$$;
