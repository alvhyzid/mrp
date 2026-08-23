-- NN.4 (23 Agu 2026) -- prasyarat MST-17 diperiksa & TERBUKTI AMAN.
do $$
declare v_company_id integer;
begin
  select company_id into v_company_id from companies where name='PT ITM' limit 1;
  if v_company_id is null then raise notice 'PT ITM tidak ditemukan -- dilewati.'; return; end if;

  update build_tasks
  set detail_pekerjaan = detail_pekerjaan || E'\n\n---\n\nPRASYARAT DIPERIKSA & AMAN (23 Agu 2026, NN.4) -- tidak perlu menunggu jawaban siapa pun untuk yang satu ini.\n\n' ||
      E'FABRIX-APP punya 6 bucket (`documents`, `company-logos`, `user-avatars`, `user-signatures`, `shipment-dispatch-photos`, `delivery-confirmation-photos`) + 15 policy RLS di `storage.objects`. Bucket `documents` BUKAN publik (public=false) -- benar untuk dokumen kepatuhan.\n\n' ||
      E'YANG PALING PENTING: bucket & policy TERBUKTI IKUT saat skema dibangun dari migrasi. Dibuktikan dengan membandingkan ke `fabrix-ci-test` yang dibangun MURNI dari migrasi (tanpa satu pun langkah dashboard): hasilnya **6 bucket + 15 policy yang SAMA PERSIS**. Sumbernya migrasi 20260814160000, 20260817160000, 20260817190000, 20260817210000, 20260826110000.\n\n' ||
      E'ARTINYA: Storage TIDAK termasuk kelas masalah INF-20 ("hidup di luar migrasi") -- berbeda dari Auth Hook yang memang tidak ikut. MST-17 bisa dikerjakan tanpa membangun infrastruktur unggah baru; cukup pakai Master Dokumen MD-1 + `uploadFileWithMetadata` yang sudah ada, sesuai rencana semula.\n\n' ||
      E'YANG TETAP BERLAKU: kaitan ke INF-16 -- backup database TIDAK mencakup ISI berkas Storage (hanya metadata). Begitu dokumen sungguhan mulai diunggah lewat fitur ini, INF-16 berubah dari "belum berdampak" jadi berdampak nyata.'
  where task_code='MST-17' and company_id=v_company_id;

  update build_tasks
  set detail_pekerjaan = detail_pekerjaan || E'\n\n---\n\nSATU BUTIR DICORET DARI DAFTAR (23 Agu 2026, NN.4): **Storage bucket + policy TERBUKTI IKUT dari migrasi** -- 6 bucket + 15 policy identik antara FABRIX-APP dan project yang dibangun murni dari migrasi. Jadi Storage BUKAN bagian dari masalah ini, dan tidak perlu diperiksa ulang. Sisa yang BELUM diperiksa: setelan Auth lain (template email, redirect URL, provider), Edge Function lain selain custom-access-token, cron/scheduled job, extension yang dinyalakan manual.'
  where task_code='INF-20' and company_id=v_company_id;
end $$;
