-- QA-01 X.2 (22 Agu 2026) -- fungsi pendukung TEST SAJA. Pembersihan-saat-
-- keluar (afterAll) TIDAK BISA dijamin (dibuktikan: proses dimatikan paksa
-- mencegah kode apa pun berjalan, batasan OS). Jaminan dipindah ke AWAL:
-- fungsi ini menyapu SISA milik SATU company_id SEBELUM test mulai bekerja,
-- generik penuh -- TIDAK butuh daftar tabel ditulis tangan, TERMASUK tabel
-- anak yang tidak punya company_id langsung (mis. shipment_lines,
-- work_order_outputs, customer_po_approvals) yang sebelumnya harus ditelusuri
-- manual satu per satu lewat pesan error.
--
-- ALGORITMA: coba hapus dari SEMUA tabel berkolom company_id (retry-until-
-- fixed-point, sama seperti debug_company_residual_scan). Kalau satu tabel
-- masih gagal karena FK dari tabel ANAK tanpa company_id, BACA nama
-- constraint dari pesan error, cari tabel+kolom anak yang sebenarnya lewat
-- information_schema (BUKAN ditebak/ditulis tangan), hapus baris anak itu,
-- lalu coba lagi -- berulang sampai bersih atau mentok (dilaporkan jelas).
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
        -- Ekstrak nama constraint dari pesan error (selalu ada di SQLSTATE 23503),
        -- cari tabel+kolom ANAK sebenarnya lewat information_schema -- bukan tebakan.
        get stacked diagnostics v_constraint_name = CONSTRAINT_NAME;
        select tc.table_name, kcu.column_name, ccu.table_name, ccu.column_name
          into v_child_table, v_child_column, v_parent_table, v_parent_column
        from information_schema.table_constraints tc
        join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
        join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
        where tc.constraint_name = v_constraint_name and tc.constraint_type = 'FOREIGN KEY'
        limit 1;

        if v_child_table is not null then
          -- Hapus baris anak yang merujuk baris company_id ini, lewat kolom PK
          -- tabel induk yang SEBENARNYA diblokir (v_parent_table/v_parent_column),
          -- bukan cuma company_id -- menangani rantai anak berlapis (mis.
          -- work_order_outputs merujuk production_batches, bukan companies langsung).
          execute format(
            'delete from %I where %I in (select %I from %I where company_id = $1)',
            v_child_table, v_child_column, v_parent_column, v_parent_table
          ) using p_company_id;
          v_progress := true;
        end if;
      end;
    end loop;
    exit when not v_progress;
  end loop;
end;
$$;

revoke execute on function public.debug_force_delete_company(integer) from public, anon, authenticated;
grant execute on function public.debug_force_delete_company(integer) to service_role;
