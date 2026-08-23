-- INF-19 lanjutan (23 Agu 2026) -- konsekuensi memindahkan CI ke project
-- terpisah: 2 test yang SENGAJA menjaga data nyata company_id=1 tidak bisa
-- berjalan di sana. Dilewati dengan sadar, TAPI jaminannya harus tetap ada.
do $$
declare v_company_id integer;
begin
  select company_id into v_company_id from companies where name='PT ITM' limit 1;
  if v_company_id is null then raise notice 'PT ITM tidak ditemukan -- dilewati.'; return; end if;

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description, effect_description, urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes) values
  (v_company_id,'AUD-13','Jalankan Pengawas Data Nyata Secara Terpisah (Tidak Lagi Ikut CI)','AUD','Audit Kualitas',
   'Dua file test adalah PENGAWAS DATA NYATA, bukan test logika: `kpi_kamus_integrity_guard.test.ts` (menjaga 6 baris kpi_registry + 11 kamus_terms company_id=1 -- lahir dari anomali Sesi 0 yang penyebabnya TIDAK PERNAH ditemukan) dan blok pertama `mlvt_case_study_skeleton.test.ts` (memeriksa data MLVT nyata). Sejak CI dipindah ke project kosong (INF-19), keduanya DILEWATI di sana karena baris yang dijaganya memang tidak ada.',
   'Jaminan yang dulu berjalan otomatis tiap push SEKARANG TIDAK BERJALAN SAMA SEKALI. Kalau baris kpi_registry/kamus_terms hilang lagi seperti dulu, tidak ada lagi yang memberi tahu -- persis keadaan sebelum pengawas itu dibuat. Ini kehilangan nyata yang ditukar demi isolasi CI, bukan sekadar detail teknis.',
   'penting', array['Data','Fungsi'],'Claude Code','menunggu',null,'temuan_claude',
   E'DILEWATI DENGAN SADAR, BUKAN DIMATIKAN: kedua blok dibungkus `describe.skipIf(!isRealDataProject())` yang membaca daftar project data nyata dari `scripts/guard-real-project.js` -- jadi begitu dijalankan terhadap FABRIX-APP, keduanya HIDUP LAGI otomatis tanpa mengubah kode.\n\nCARA MENJALANKANNYA SEKARANG (sudah bisa, tinggal dijadwalkan): jalankan dengan env menunjuk FABRIX-APP, mis.\n  ALLOW_TESTS_AGAINST_REAL_PROJECT=true npx vitest run tests/kpi_kamus_integrity_guard.test.ts tests/mlvt_case_study_skeleton.test.ts\nKeduanya MURNI MEMBACA (select) company_id=1 -- tidak pernah insert/update/delete di sana, jadi aman dan tidak melanggar Invarian 9.\n\nYANG PERLU DIPUTUSKAN (pertanyaan untuk pemilik produk): seberapa sering pengawas ini dijalankan? Pilihan: (a) manual tiap kali ada yang mencurigakan -- paling murah tapi paling gampang lupa; (b) dijadwalkan harian lewat GitHub Actions terpisah (bukan CI push) yang memang menunjuk data nyata -- perlu 3 secret tersendiri; (c) dijadikan bagian dari pemeriksaan rutin bersama Supabase Advisor (AUD-12).\n\nREKOMENDASI ARSITEK: (b) -- anomali yang dijaganya dulu muncul tanpa pemicu yang bisa diprediksi, jadi pemeriksaan yang bergantung ingatan manusia tidak cukup.',
   'Ditemukan lewat INF-19 (23 Agu 2026) saat memindahkan CI ke project terpisah. Ini harga yang dibayar untuk isolasi -- dicatat supaya tidak hilang diam-diam.')
  on conflict (company_id, task_code) do nothing;
end $$;
