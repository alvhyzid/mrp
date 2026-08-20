-- Pembersihan data SEKALI JALAN: ratusan baris `companies` sisa test otomatis
-- (company_id BUKAN 1/2) yang tertinggal karena afterAll bisa gagal diam-diam --
-- pola "throw-and-abort" (satu langkah gagal, seluruh urutan cleanup berhenti
-- SEBELUM sempat menghapus companies) atau pola "sequential unchecked-await"
-- (delete companies terakhir gagal tanpa dicek). Perbaikan akar ada di
-- tests/*.test.ts (self-cleaning, lihat HANDOFF.md 26 Agu 2026). Migrasi ini
-- HANYA data cleanup, bukan perubahan skema -- company_id 1 (PT ITM) dan 2
-- (Company B, tenant uji sengaja/permanen) EKSPLISIT dikecualikan.

do $$
declare
  tbl record;
  orphan_ids integer[];
begin
  select array_agg(company_id) into orphan_ids from companies where company_id not in (1, 2);
  if orphan_ids is null then
    return;
  end if;

  -- Nonaktifkan sementara pengecekan FK/trigger HANYA untuk transaksi ini --
  -- aman karena yang dihapus adalah seluruh subtree data uji, bukan mengubah
  -- relasi data yang masih hidup.
  set local session_replication_role = replica;

  for tbl in
    select c.table_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.column_name = 'company_id'
      and c.table_name <> 'companies'
  loop
    execute format('delete from %I where company_id = any($1)', tbl.table_name) using orphan_ids;
  end loop;

  delete from companies where company_id = any(orphan_ids);

  set local session_replication_role = default;
end $$;
