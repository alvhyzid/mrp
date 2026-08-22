-- DD.1-DD.4 (23 Agu 2026) -- koreksi audit INF-01 (PITR vs Daily Backups),
-- task baru uji-pulih backup bawaan (INF-15) & pencadangan Storage (INF-16),
-- turunkan urgensi INF-10 (jalur GitHub Actions sekarang cadangan kedua).
do $$
declare
  v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then
    raise notice 'Perusahaan PT ITM tidak ditemukan -- migrasi dilewati (no-op).';
    return;
  end if;

  -- DD.2 -- INF-15, task baru: uji pulih backup bawaan Supabase
  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes
  ) values (
    v_company_id, 'INF-15', 'Uji Pulih Sungguhan Backup Bawaan Supabase (Belum Pernah Dibuktikan)', 'INF', 'Infrastruktur & Environment',
    'Backup bawaan Supabase (7 titik PHYSICAL, 15-21 Agu, DIKONFIRMASI ADA lewat DD.1) BELUM PERNAH diuji restore-nya -- beda dengan backup manual INF-05 yang sudah dibuktikan pulih sungguhan ke project staging. Baru diketahui ADA, belum dibuktikan BISA DIPULIHKAN dengan benar.',
    'Backup yang belum pernah diuji pulih bukan jaring pengaman yang terbukti -- sesuai doktrin proyek sendiri ("backup yang tidak diperiksa isinya sama dengan tidak ada backup", INF-05).',
    'penting', array['Data','Fungsi'], 'Claude Code', 'menunggu', null, 'temuan_claude',
    'Pulihkan SATU titik backup bawaan (mis. yang tertua, 15 Agu) ke tempat KOSONG -- BUKAN ke project data nyata maupun staging yang sedang dipakai. Prasyarat: menunggu project CI/dev terpisah (lihat rencana INF-02) berdiri, supaya ada tempat aman untuk uji tanpa risiko menimpa apa pun. Bukti wajib: data yang dipulihkan cocok dengan snapshot backup manual INF-05 pada tanggal yang sama (silang periksa, bukan cuma "restore selesai tanpa error").',
    'Ditemukan lewat DD.1-DD.2 (23 Agu 2026) -- koreksi audit INF-01 yang menemukan backup bawaan Supabase ternyata sudah berjalan, tapi belum pernah diuji pulih.'
  )
  on conflict (company_id, task_code) do nothing;

  -- DD.3 -- INF-16, task baru: pencadangan berkas Storage
  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes
  ) values (
    v_company_id, 'INF-16', 'Pencadangan Berkas Storage (Belum Tercakup Backup Database)', 'INF', 'Infrastruktur & Environment',
    'Ditemukan lewat peringatan di layar Supabase (23 Agu 2026): backup database TIDAK menyertakan berkas yang diunggah lewat Storage API -- hanya metadata-nya (nama file, path, ukuran tersimpan di tabel database; ISI berkasnya sendiri hidup di Storage, terpisah dari mekanisme backup database).',
    'Untuk sekarang BELUM berdampak (belum ada berkas nyata di Storage). TAPI rencana PRD-18 (foto reject WAJIB per kejadian) akan mengisi Storage dengan foto sungguhan -- foto-foto itu TIDAK akan ikut tercadangkan oleh backup database manapun (baik manual INF-05 maupun bawaan Supabase), berbeda dari data lain yang sudah aman.',
    'penting', array['Data','Keamanan'], 'Claude Code', 'menunggu', null, 'temuan_claude',
    'Cari mekanisme pencadangan Storage terpisah dari backup database (Supabase Storage punya API tersendiri untuk mengunduh/menyalin objek -- perlu skrip/jalur ekspor khusus, bukan bagian dari `pg_dump`/ekspor tabel). Prasyarat: WAJIB selesai SEBELUM PRD-18 dipakai produksi sungguhan (foto reject mulai terunggah) -- bukan sesudahnya. Terkait langsung PRD-18, lihat catatan di task itu.',
    'Ditemukan lewat DD.3 (23 Agu 2026), peringatan langsung di layar Supabase saat verifikasi pasca-transfer.'
  )
  on conflict (company_id, task_code) do nothing;

  -- DD.3 -- kaitkan di PRD-18
  update build_tasks
  set notes = coalesce(notes || E'\n\n', '') || 'Kaitan 23 Agu 2026 (DD.3): backup database TIDAK menyertakan berkas Storage (hanya metadata) -- foto reject wajib per kejadian di formulir ini akan mengisi Storage tanpa tercadangkan sampai INF-16 selesai. INF-16 WAJIB selesai SEBELUM formulir ini dipakai produksi sungguhan (bukan sesudahnya).'
  where task_code = 'PRD-18' and company_id = v_company_id;

  -- DD.4 -- turunkan urgensi INF-10
  insert into build_task_urgency_history (build_task_id, old_urgency, new_urgency, requested_by)
  select build_task_id, 'penting', 'bisa_menunggu',
    'Pemilik Produk (23 Agu 2026) -- backup bawaan Supabase (7 titik PHYSICAL, dikonfirmasi ada lewat DD.1) sekarang jadi jalur backup utama; jalur GitHub Actions (INF-10 soal verifikasinya) turun jadi CADANGAN KEDUA, bukan satu-satunya -- tetap berguna, tapi tidak lagi mendesak.'
  from build_tasks where company_id = v_company_id and task_code = 'INF-10';
  update build_tasks set urgency = 'bisa_menunggu' where company_id = v_company_id and task_code = 'INF-10';

end $$;
