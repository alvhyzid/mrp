-- AA.6 (23 Agu 2026) -- transfer project data nyata KE organisasi FABRIX
-- SELESAI & TERVERIFIKASI PENUH (Project ID tetap, 19 tabel kunci identik,
-- anon key & service role key masih valid, login+query sungguhan berhasil).
do $$
declare
  v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then
    raise notice 'Perusahaan PT ITM tidak ditemukan -- migrasi dilewati (no-op).';
    return;
  end if;

  update build_tasks
  set detail_pekerjaan = detail_pekerjaan || E'\n\n---\n\nSTATUS 23 Agu 2026 -- Project DATA NYATA (kfvtrwuuqcjfkkuqizxt) SUDAH DITRANSFER ke organisasi FABRIX, TERVERIFIKASI PENUH (AA.1-AA.3): Project ID tetap sama, 19 tabel kunci identik persis sebelum/sesudah (0 baris berubah), anon key & service role key (tidak diubah sama sekali) TERBUKTI masih valid lewat login+query sungguhan. Lihat HANDOFF.md "FAKTA TERVERIFIKASI" untuk detail lengkap. SISA: transfer project staging (nclkepwlsgmfbslgsajq) dengan prosedur sama (belum dikerjakan), lalu ganti nama alvhyz-MRP -> fabrix-app (SESUDAH staging juga selesai, sesuai urutan yang sudah disepakati).',
      notes = coalesce(notes || E'\n\n', '') || 'Diperbarui 23 Agu 2026 -- transfer project data nyata SELESAI & terverifikasi. Backup harian GitHub Actions & fitur backup bawaan Supabase Pro BELUM sempat diverifikasi ulang di organisasi baru (GitHub API rate-limited saat pengecekan; backup bawaan Supabase perlu dicek langsung di dashboard, tidak bisa lewat API/CLI dari sini) -- perlu 1 pengecekan lagi.'
  where task_code = 'RBD-04' and company_id = v_company_id;

end $$;
