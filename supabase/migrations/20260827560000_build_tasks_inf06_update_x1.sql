-- Halaman Daftar Tugas Pembangunan -- X.1 (22 Agu 2026): update INF-06 dgn
-- temuan tepat -- 4 dari 7 baris asli sudah hilang lewat pekerjaan sesi ini
-- (bukan lewat INF-06 sendiri, yang belum dikerjakan), sisa 4 dikonfirmasi
-- SISA LAMA (bukan akumulasi baru dari QA-01) -- akar penyebab bagian (1)
-- INF-06 sudah terjawab lewat investigasi QA-01.
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
    name = 'Bersihkan 4 Perusahaan Bekas Test di Tempat Data Nyata',
    detail_pekerjaan = detail_pekerjaan || E'\n\n--- UPDATE 22 Agu 2026 (X.1) ---\nDari 7 baris asli yang ditemukan INF-01, 3 SUDAH HILANG dengan sendirinya (MarginWatchTestCorp, BuildTasksTestCorp, AttendanceW1TestCorp) sebagai efek samping pekerjaan sesi ini (bukan lewat task INF-06 ini sendiri, yang belum dikerjakan) -- AttendanceW1TestCorp secara eksplisit dibersihkan manual saat investigasi Bagian 2. SISA 4: PlantConsolidationTestCorp (company_id 3197, dibuat 20 Agu), Sesi0BRoleTestCorp (3666, 21 Agu -- CATATAN: nama file test yang membuatnya TIDAK DITEMUKAN lagi di tests/*.test.ts sekarang, kemungkinan file test itu sudah dihapus/diganti nama sejak baris ini dibuat), BaselineLockSeparationTestCorp (3801, 21 Agu), RoutingBomSnapshotTestCorp (4157, 21 Agu).\n\nAKAR PENYEBAB bagian (1) SUDAH TERJAWAB lewat investigasi QA-01 (22 Agu): baris-baris ini SEMUANYA dibuat 20-21 Agustus -- SEBELUM QA-01 (22 Agu) memperbaiki cleanupCompanyCascade. Dikonfirmasi lewat pengujian nyata (3x full-suite run + beberapa run individual file hari ini, termasuk 2 dari 3 file test yang PERNAH membuat baris dengan nama sama seperti 3 di atas) bahwa TIDAK ADA baris BARU dengan nama-nama ini tercipta hari ini -- baris yang ada sekarang adalah SISA LAMA yang statis, BUKAN akumulasi berkelanjutan dari mekanisme yang masih rusak. Ini mengkonfirmasi: (a) QA-01 sudah benar menyelesaikan tujuannya sendiri (mencegah akumulasi BARU) -- TIDAK perlu dibuka kembali; (b) 4 baris ini murni sisa historis dari SEBELUM perbaikan ada, persis lingkup task INF-06 ini (bukan gejala QA-01 belum tuntas).'
  where company_id = v_company_id and task_code = 'INF-06';

end $$;
