-- Migration: backlog Kamus utk kolom baru Sesi 7 (migrasi 20260827270000) --
-- kolom baru wajib masuk antrean Kamus sesuai aturan proyek.
do $$
declare
  v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then
    raise notice 'Perusahaan PT ITM tidak ditemukan -- backlog Kamus dilewati (no-op).';
    return;
  end if;

  insert into kamus_terms (company_id, scope, entity, field, term_key, priority, domain, suggested_role, status, ai_draft)
  values
    (v_company_id, 'FIELD', 'routings', 'archived_at', 'routings.archived_at', 3, 'standar', 'ppic', 'DRAF_AI', 'Waktu versi routing ini diarsipkan (Sesi 7, 21 Agu 2026) -- NULL berarti versi ini masih aktif dan boleh dipilih untuk Work Order baru. Versi yang sedang dipakai batch berjalan TIDAK BISA diarsipkan.'),
    (v_company_id, 'FIELD', 'routings', 'archived_by', 'routings.archived_by', 3, 'standar', 'ppic', 'DRAF_AI', 'Siapa yang mengarsipkan versi routing ini.')
  on conflict (company_id, term_key) do nothing;
end $$;
