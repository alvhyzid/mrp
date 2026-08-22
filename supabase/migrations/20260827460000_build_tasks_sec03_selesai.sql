-- Halaman Daftar Tugas Pembangunan -- SEC-03 (Sapu Ulang Revoke) selesai
-- 22 Agu 2026, Bagian 2 blok kerja paralel. 0 pelanggaran ditemukan lewat
-- enumerasi live database (bukan cuma baca berkas migrasi); pengawas
-- dibuktikan bisa gagal keras lewat probe (migrasi 20260827440000/450000).
do $$
declare
  v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then
    raise notice 'Perusahaan PT ITM tidak ditemukan -- migrasi dilewati (no-op).';
    return;
  end if;

  update build_tasks set
    status = 'selesai',
    started_at = coalesce(started_at, now()),
    completed_at = now(),
    approved_at = now(),
    detail_pekerjaan = detail_pekerjaan || E'\n\n--- HASIL 22 Agu 2026 ---\nDisapu 68 migrasi sejak audit 19 Agu 2026. Pembacaan teks migrasi SENDIRIAN menyesatkan (3 migrasi compute_production_batch_labor_cost tanpa baris revoke terlihat seperti gap terbuka) -- kondisi NYATA di database (debug_list_function_grants(), 53 fungsi) membuktikan 0 pelanggaran: signature fungsi tidak pernah berubah di ke-4 definisi ulangnya, jadi CREATE OR REPLACE Postgres MEMPERTAHANKAN ACL lama (revoke dari migrasi paling awal tetap berlaku) -- BEDA dari insiden create_shipment_with_signature (Alur 1) yang signature-nya BERUBAH (parameter baru) sehingga jadi overload baru dengan ACL default. Pengawas (function_grant_security_audit.test.ts) DIBUKTIKAN bisa gagal keras: fungsi probe tanpa revoke ditanam, test merah persis menyebut nama fungsi + grant berbahaya, fungsi dihapus, test hijau lagi. Migrasi idempoten (dijalankan 2x, run kedua 0 perubahan).'
  where company_id = v_company_id and task_code = 'SEC-03';

end $$;
