-- Investigasi "aktivitas bersamaan" (23 Agu 2026) -- ditemukan saat mengambil
-- snapshot pra-transfer Supabase (S.2): jumlah baris berubah antar dua
-- pengambilan berselang detik (users 8->9->10, dst), baris @debug.mrp baru
-- tercipta detik itu juga. INF-07 (kemarin) DIBUKA KEMBALI: bukti "35 menit
-- idle, angka identik" TETAP VALID tapi HANYA membuktikan tidak ada tulisan
-- SAAT TIDAK ADA YANG BEKERJA -- tidak pernah menguji keadaan saat test
-- suite berjalan bersamaan. Root cause SEKARANG DIKONFIRMASI (bukan dugaan):
-- baris transien itu (pola nama "attendancew1test"/"stepprogresstest") masuk
-- ke COMPANY BARU buatan test sendiri (bukan company_id=1) dan SUDAH BERSIH
-- SENDIRI dalam <2 menit -- Invariant 9 (baris company_id=1) tetap terbukti
-- aman, TAPI tidak ada satu pun yang mencegah test suite lokal dijalankan
-- terhadap PROJECT Supabase yang SAMA dengan rumah data nyata -- karena
-- .env.local yang dipakai `npm run dev` (lihat INF-11) adalah .env.local yang
-- SAMA yang dibaca `npx vitest run`. Baris terlindungi; PROJECT-nya tidak.
-- DITAMBAL hari ini: tests/setup/guardAgainstRealProject.ts (wired lewat
-- vitest.config.ts setupFiles) -- menolak KERAS test suite lokal berjalan
-- terhadap project yang terdaftar sebagai rumah data nyata, kecuali flag
-- eksplisit ALLOW_TESTS_AGAINST_REAL_PROJECT=true diset. CI ("Typecheck &
-- Test Suite" job, ci.yml) TERNYATA JUGA memakai project SUNGGUHAN yang sama
-- (secrets.NEXT_PUBLIC_SUPABASE_URL) -- bukan cuma sesi lokal -- flag yang
-- sama ditambahkan eksplisit di ci.yml (bukan pengecualian otomatis
-- tersembunyi) supaya risikonya terlihat di file, bukan diam-diam dilewati.
-- Dibuktikan bisa merah: dijalankan tanpa flag -> gagal keras menyebut nama
-- project; dengan flag -> lulus normal (test file yang sama, tanpa perubahan
-- lain).
do $$
declare
  v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then
    raise notice 'Perusahaan PT ITM tidak ditemukan -- migrasi dilewati (no-op).';
    return;
  end if;

  -- INF-06 -- perbarui: 5 company tersisa (bukan 4/7), + akar penyebab dikoreksi
  update build_tasks
  set name = 'Bersihkan 5 Perusahaan Bekas Test di Tempat Data Nyata',
      description = 'Company selain PT ITM/Company B yang tersisa di project data nyata (kfvtrwuuqcjfkkuqizxt), sisa test yang terhenti (SIGKILL/interupsi) sebelum sempat membersihkan diri sendiri -- BUKAN kegagalan mekanisme cleanup normal.',
      detail_pekerjaan = detail_pekerjaan || E'\n\n---\n\nKOREKSI 23 Agu 2026 (investigasi "aktivitas bersamaan", persiapan transfer S.2): daftar diperbarui jadi 5 company (bukan 4 seperti X.1, bukan 7 seperti hitungan paling awal) -- `PlantConsolidationTestCorp` (20 Agu), `Sesi0BRoleTestCorp` (21 Agu), `BaselineLockSeparationTestCorp` (21 Agu), `RoutingBomSnapshotTestCorp` (21 Agu), `AiProjectDashboardTestCorp` (22 Agu, BARU ditemukan hari ini, belum pernah tercatat di X.1). Dikonfirmasi lewat query langsung `select company_id, name, created_at from companies where name not in (''PT ITM'',''Company B'')`. AKAR PENYEBAB DIKONFIRMASI ULANG (bukan dugaan): kelimanya adalah sisa test yang TERHENTI paksa (SIGKILL/interupsi) sebelum sempat membersihkan diri -- DIBUKTIKAN hari ini dengan mengamati test LAIN (pola nama "attendancew1test"/"stepprogresstest") yang berjalan BERSAMAAN sesi ini: company barunya tercipta lalu BERSIH SENDIRI SEMPURNA dalam <2 menit begitu test itu selesai normal -- mekanisme cleanup mandiri BEKERJA, 5 baris ini murni korban interupsi paksa, bukan gejala cleanup yang rusak.',
      notes = coalesce(notes || E'\n\n', '') || 'Diperbarui 23 Agu 2026 -- lihat juga tests/setup/guardAgainstRealProject.ts (INF-12) yang menutup celah terkait (project-level, bukan row-level) yang ditemukan lewat investigasi yang sama.'
  where task_code = 'INF-06' and company_id = v_company_id;

  -- INF-12 -- task baru, SUDAH SELESAI hari ini (dibangun & dibuktikan)
  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes, completed_at
  ) values (
    v_company_id, 'INF-12', 'Pengawas Tingkat Project untuk Test Suite (Cegah Tertuju ke Data Nyata)', 'INF', 'Infrastruktur & Environment',
    'Invariant 9 (tests/testCompanyCleanup.ts) melindungi BARIS company_id=1 dari cleanup test -- terbukti selalu bekerja. TAPI tidak ada pengawas yang mencegah test suite LOKAL dijalankan terhadap PROJECT Supabase yang sama dengan rumah data nyata sama sekali -- karena .env.local yang dipakai `npm run dev` (untuk melihat data nyata) adalah .env.local yang SAMA dibaca `npx vitest run`.',
    'Ditemukan lewat persiapan transfer Supabase (23 Agu 2026, S.2): jumlah baris tabel kunci berubah dalam hitungan detik antar dua snapshot, ternyata dari test suite yang berjalan bersamaan sesi ini terhadap project SUNGGUHAN. Baris company_id=1 selalu aman (dibuktikan lagi), tapi tanpa pengawas tingkat project, PROJECT itu sendiri bisa ditulis test kapan saja tanpa kesadaran eksplisit.',
    'mendesak', array['Fungsi','Keamanan'], 'Claude Code', 'selesai', null, 'temuan_claude',
    'DIBANGUN: tests/setup/guardAgainstRealProject.ts (wired via vitest.config.ts setupFiles) -- menolak KERAS menjalankan test suite bila NEXT_PUBLIC_SUPABASE_URL cocok KNOWN_REAL_PROJECT_REFS (hardcode, pola sama REAL_TENANT_COMPANY_IDS), kecuali ALLOW_TESTS_AGAINST_REAL_PROJECT=true diset eksplisit. ci.yml job "Typecheck & Test Suite" TERNYATA JUGA memakai project sungguhan (secrets.NEXT_PUBLIC_SUPABASE_URL) -- bukan cuma lokal -- flag yang sama ditambahkan EKSPLISIT di file workflow (bukan pengecualian tersembunyi berdasar `CI=true`), supaya risikonya terlihat langsung di kode, bukan diam-diam dilewati. Job "Rebuild Schema from Migrations" TIDAK terpengaruh (pakai `supabase db start`, instance efemer, project ref-nya tidak pernah cocok daftar).',
    'DIBUKTIKAN bisa merah lalu hijau: dijalankan tanpa flag -> gagal keras, pesan menyebut nama project persis; dijalankan ulang dengan ALLOW_TESTS_AGAINST_REAL_PROJECT=true -> lulus normal (file test sama, tanpa perubahan lain). Ditemukan & dibangun & dibuktikan sekaligus 23 Agu 2026 (BLOK PERINTAH lanjutan, investigasi "aktivitas bersamaan").',
    now()
  )
  on conflict (company_id, task_code) do nothing;

  -- 2.1/2.2 -- RBD-03: koreksi status (Vercel Team & Supabase Org FABRIX sudah ada)
  update build_tasks
  set detail_pekerjaan = detail_pekerjaan || E'\n\n---\n\nSTATUS 23 Agu 2026 -- SEBAGIAN SELESAI (2 dari 3 entitas): (1) Supabase Organization "FABRIX" SUDAH dibuat, paket Pro aktif. (2) Vercel: menaikkan akun ke Pro TERNYATA otomatis mengubah bentuknya jadi Team (dibuktikan lewat Team Settings > Members & Access Groups, yang tidak ada di akun Hobby) -- nama tim sudah diganti dari "AMS" ke "FABRIX". TIDAK PERLU membuat Vercel Team terpisah/memindahkan project seperti rencana semula -- KOREKSI rencana lama, dicatat supaya tidak dikira langkah tambahan masih perlu. (3) GitHub Organization: BELUM dibuat sama sekali -- satu-satunya entitas dari 3 yang masih kosong.\n\nPENTING, belum selesai walau nama sudah FABRIX: Vercel Team masih DIMILIKI akun Google pribadi pemilik produk -- ganti nama BUKAN pemindahan kepemilikan. Kepemilikan baru pindah setelah admin@fabrix.id diundang sebagai OWNER kedua (lihat RBD-04).',
    notes = coalesce(notes || E'\n\n', '') || 'Diperbarui 23 Agu 2026 -- 2/3 entitas ada (Vercel Team otomatis dari upgrade Pro, Supabase Org FABRIX dibuat manual), GitHub Organization masih task tersisa satu-satunya untuk task ini.'
  where task_code = 'RBD-03' and company_id = v_company_id;

  -- 2.2/2.3/2.6 -- RBD-04: koreksi rencana Vercel, tambah sisa langkah, catat status Supabase
  update build_tasks
  set detail_pekerjaan = detail_pekerjaan || E'\n\n---\n\nKOREKSI RENCANA VERCEL (23 Agu 2026): rencana lama "pemindahan project Vercel sebagai langkah terpisah" DIBATALKAN -- Team sudah otomatis terbentuk dari upgrade Pro (lihat RBD-03), TIDAK PERLU membuat Team baru/memindahkan project, TIDAK ADA risiko sambungan GitHub Vercel terputus dari langkah itu. Sisa pekerjaan Vercel (aman, murni administratif, BUKAN transfer project): (a) ganti Team URL/slug `ams-3670` -> `fabrix` (hanya alamat dashboard, TIDAK memengaruhi alamat aplikasi/QR surat jalan); (b) **PALING PENTING** -- Settings Team > Members: undang admin@fabrix.id sebagai OWNER kedua (dua owner akses penuh, akun pribadi bisa dilepas belakangan TANPA memindahkan apa pun -- pola sama seperti Supabase organization membership); (c) Settings Team > Billing: Company Name -> nama badan usaha yang benar (muncul di faktur) + Tax ID/NPWP bila ada; (d) Settings Team > Billing > Configure: turunkan On-Demand Budget dari $200 ke $40-50 sebagai PENGAMAN (bukan penghematan) terhadap proses berulang tak terkendali. JANGAN mengubah nama PROJECT `mrp-staging` itu sendiri -- beda dari nama Team, mengubahnya bisa mengubah alamat deployment yang terkait QR surat jalan tercetak.\n\n' ||
    E'STATUS TRANSFER SUPABASE (S.1-S.7, 23 Agu 2026): DITUNDA -- ditemukan test suite berjalan bersamaan membuat angka pembanding pra-transfer tidak stabil (lihat INF-12). Backup S.1 SUDAH dijalankan & terverifikasi berisi data nyata (lihat mrp-backups-tidak-di-git/). Transfer TIDAK dilanjutkan sampai pemilik produk memutuskan setelah pengawas tingkat project (INF-12) terpasang. Setelah diputuskan lanjut: urutan tetap seperti semula -- backup terverifikasi -> angka pembanding stabil -> transfer project data nyata ke organisasi FABRIX -> verifikasi pasca-transfer -> BARU ganti nama alvhyz-MRP jadi fabrix-app -> transfer project staging dengan urutan sama. Pemilik produk WAJIB memastikan akun pribadinya sudah jadi anggota organisasi FABRIX di Supabase (syarat dari Supabase sendiri) sebelum menekan tombol Transfer.\n\n' ||
    E'SISA KEPEMILIKAN setelah Vercel & Supabase selesai: HANYA GitHub Organization, belum dibuat sama sekali (lihat RBD-03). Transfer repo GitHub memutus sambungan ke Vercel sampai disambung ulang -- dikerjakan TERPISAH, setelah Supabase selesai & stabil, bukan bersamaan.',
    notes = coalesce(notes || E'\n\n', '') || 'Diperbarui 23 Agu 2026 -- rencana pemindahan Vercel project dibatalkan (tidak perlu), transfer Supabase ditunda menunggu keputusan pemilik produk pasca-INF-12.'
  where task_code = 'RBD-04' and company_id = v_company_id;

  -- 2.7 -- task baru: catatan region Sydney (bukan penghalang, murni dicatat)
  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes
  ) values (
    v_company_id, 'INF-13', 'Region Project Supabase (Sydney) vs Lokasi Pengguna (Malang)', 'INF', 'Infrastruktur & Environment',
    'Project data nyata (kfvtrwuuqcjfkkuqizxt) berada di region ap-southeast-2 (Sydney, Australia), bukan Singapura -- untuk pengguna di Malang, tiap permintaan menempuh jarak lebih jauh dari yang perlu.',
    'Latensi tambahan murni karena jarak geografis -- belum tentu terasa sebagai keluhan nyata pengguna pada skala pemakaian saat ini, tapi dicatat sebagai pertimbangan.',
    'tidak_mendesak', array['Data'], 'Claude Code', 'menunggu', null, 'temuan_claude',
    'Region TIDAK BISA diubah tanpa membuat project baru dan memindahkan seluruh data -- bukan pekerjaan ringan. PEMICU peninjauan: bila kecepatan menjadi keluhan nyata pengguna (bukan dikerjakan proaktif sekarang).',
    'Ditemukan lewat persiapan transfer Supabase (23 Agu 2026), instruksi eksplisit pemilik produk (Bagian 2.7) -- dicatat sebagai temuan, bukan penghalang transfer.'
  )
  on conflict (company_id, task_code) do nothing;

end $$;
