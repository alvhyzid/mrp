-- Halaman Daftar Tugas Pembangunan -- 22 Agu 2026, bagian TAMBAHAN dari INF-07
-- (baca-saja, tanpa pelaku): naikkan urgensi AUD-07 (jejak tulis 6 tempat),
-- catat INF-08 (salinan backup kedua terenkripsi di luar komputer), tambah
-- catatan di INF-02 soal setelan Branch Tracking Vercel gagal disimpan
-- lewat dashboard (dicoba pemilik produk berulang kali).
do $$
declare
  v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then
    raise notice 'Perusahaan PT ITM tidak ditemukan -- migrasi dilewati (no-op).';
    return;
  end if;

  insert into build_task_urgency_history (build_task_id, old_urgency, new_urgency, requested_by)
  select build_task_id, 'penting', 'mendesak',
    'Pemilik Produk (22 Agu 2026) -- tiga anomali data nyata (kpi_registry hilang 26 Agu, baseline dari klik Sesi 0C, fluktuasi jumlah baris INF-05/INF-07) tidak pernah terpecahkan karena tidak ada jejak siapa mengubah apa'
  from build_tasks where company_id = v_company_id and task_code = 'AUD-07';
  update build_tasks set urgency = 'mendesak' where company_id = v_company_id and task_code = 'AUD-07';

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes
  ) values (
    v_company_id, 'INF-08', 'Salinan Backup Kedua di Luar Komputer Pemilik Produk (terenkripsi)',
    'INF', 'Infrastruktur & Environment',
    'Backup data nyata (INF-05) saat ini tersimpan di SATU komputer -- aman dari terhapus otomatis (retensi 7 hari GitHub), TIDAK aman dari hard disk rusak, laptop hilang, atau tercuri. Isinya nama dan gaji 31 orang.',
    'Tanpa salinan kedua di tempat berbeda, satu kejadian fisik pada satu komputer (rusak/hilang/dicuri) bisa menghilangkan SATU-SATUNYA salinan data nyata yang bisa diandalkan.',
    'mendesak', ARRAY['Keamanan','Data']::text[], 'Pemilik Produk', 'menunggu', null, 'temuan_claude',
    E'Butuh salinan kedua backup (hasil INF-05, folder mrp-backups-tidak-di-git/) di TEMPAT BERBEDA dari komputer kerja saat ini, DAN terenkripsi (data berisi nama+gaji 31 orang, bukan boleh tersimpan polos di penyedia pihak ketiga).\n\nREKOMENDASI PILIHAN (untuk diputuskan pemilik produk, bukan keputusan teknis Claude Code):\n- (A) Cloud storage pribadi terenkripsi (mis. akun Google Drive/iCloud pribadi pemilik produk + folder terenkripsi manual sebelum upload) -- murah/gratis sampai kuota tertentu, tapi enkripsi harus disiapkan manual (mis. zip berpassword kuat).\n- (B) Layanan backup terenkripsi khusus (mis. Backblaze B2, harga per GB per bulan sangat murah untuk ukuran data sekecil ini ~beberapa MB) -- enkripsi bawaan, lebih rapi tapi ada langganan bulanan sekecil apa pun.\n- (C) Hard disk eksternal/USB terenkripsi disimpan di lokasi FISIK berbeda (mis. rumah/kantor lain) -- tanpa biaya bulanan, tapi bergantung disiplin menyalin ulang tiap backup baru dibuat.\nClaude Code TIDAK merekomendasikan satu pilihan final -- ini keputusan operasional pemilik produk (anggaran & kenyamanan penggunaan).',
    'Ditemukan sebagai kelanjutan INF-05 (22 Agu 2026) -- backup pertama sudah ada tapi baru 1 salinan.'
  )
  on conflict (company_id, task_code) do nothing;

  update build_tasks set
    detail_pekerjaan = detail_pekerjaan || E'\n\nCATATAN TAMBAHAN (22 Agu 2026): setelan Branch Tracking/Production Branch Vercel BELUM berhasil diubah lewat dashboard -- pemilik produk sudah mencoba mengubahnya BERULANG KALI secara manual, dashboard menunjukkan error saat disimpan (bukan hanya percobaan otomatis Claude Code yang gagal, manual pun gagal). Setelan ini WAJIB SUDAH BENAR sebelum task INF-02 mulai dikerjakan -- kalau error dashboard ini belum teratasi, INF-02 tidak boleh dimulai, dan penyebab error dashboard-nya sendiri mungkin perlu ditelusuri lebih dulu (kemungkinan perlu dihubungi dukungan Vercel bila terus gagal).'
  where company_id = v_company_id and task_code = 'INF-02';

end $$;
