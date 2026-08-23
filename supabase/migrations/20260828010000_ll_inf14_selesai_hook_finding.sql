-- LL.1-LL.8 (23 Agu 2026) -- INF-14 selesai, INF-17 ditutup dengan bukti,
-- ABS-05 ditutup, dan TEMUAN BESAR: klaim JWT berasal dari Edge Function +
-- konfigurasi Auth yang TIDAK ADA di migrasi.
do $$
declare v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then raise notice 'PT ITM tidak ditemukan -- dilewati.'; return; end if;

  -- LL.1 -- INF-14 SELESAI
  update build_tasks
  set status='selesai', completed_at=now(),
      detail_pekerjaan = detail_pekerjaan || E'\n\n---\n\nDIKERJAKAN 23 Agu 2026 (LL.1). `scripts/guard-real-project.js` dibuat sebagai modul pengawas bersama DAN satu-satunya sumber kebenaran daftar project data nyata -- `tests/setup/guardAgainstRealProject.ts` kini membaca daftar dari sana (sebelumnya dua daftar terpisah yang bisa berbeda diam-diam). 13 skrip yang MENULIS data digerbang: gagal keras + pesan menyebut nama project bila diarahkan ke project data nyata, kecuali ALLOW_SCRIPTS_AGAINST_REAL_PROJECT=true. `backup-export-json.js` SENGAJA TIDAK digerbang (baca-saja; backup memang harus bisa membaca data nyata).\n\nDIBUKTIKAN MERAH: `node scripts/seed-debug-tenants.js` diarahkan ke FABRIX-APP -> DITOLAK, exit non-nol, pesan menyebut "kfvtrwuuqcjfkkuqizxt" persis. Pengawas test tetap berfungsi (tanpa flag merah, dengan flag 5/5 lulus), tsc bersih.\n\nJALUR CLI -- keterbatasan jujur: `npx supabase db query/push/reset` TIDAK melewati kode Node sehingga TIDAK BISA dicegat. Yang dibangun: `npm run check:target` (scripts/check-linked-project.js) yang melaporkan project mana yang sedang ter-link dan keluar dengan kode 2 bila itu data nyata -- ALAT KESADARAN, BUKAN PENGHALANG. Penutupan sungguhan jalur CLI hanya mungkin bila project data nyata tidak pernah ter-link di mesin kerja (keputusan operasional, lihat INF-02).'
  where task_code='INF-14' and company_id=v_company_id;

  -- LL.5 -- INF-17 DITUTUP: tujuannya (CI berhenti menyentuh data nyata) TERCAPAI & TERBUKTI
  update build_tasks
  set status='selesai', completed_at=now(),
      detail_pekerjaan = detail_pekerjaan || E'\n\n---\n\nDITUTUP 23 Agu 2026 -- TUJUAN TASK INI TERCAPAI & TERBUKTI: CI TIDAK LAGI MENYENTUH DATA NYATA.\n\nBUKTI UTAMA (push percobaan 86e864b, satu commit, ditunggu selesai penuh): 17 DARI 17 tabel kunci FABRIX-APP IDENTIK sebelum & sesudah run CI (companies 2, users 8, employees 30, items 8, boms 6, bom_lines 7, routings 2, routing_steps 13, work_orders 0, production_batches 0, sales_orders 1, customer_purchase_orders 1, suppliers 2, customers 2, lots 0, build_tasks 198, data_change_audit_log 544) -- dan NOL company `*TestCorp` baru. Padahal SEBELUM ini, SETIAP run CI selalu meninggalkan jejak fixture di sana (terbukti berkali-kali, termasuk tabrakan 2 run paralel yang membuat 2 company bernama kembar).\n\nCATATAN METODOLOGI PENTING untuk sesi berikutnya: sejak situs production tersambung ke data nyata (INF-11) dan pemilik produk mulai MEMAKAI sistem, "jumlah baris identik" TIDAK LAGI jadi alat bukti yang sah -- baris bisa berubah karena pemakaian sah. Terbukti hari ini: item `PMGM-0001/ITM` (PREMIX GUMMY) muncul di company_id=1 pada 09:07:44Z, yaitu 2 MENIT SETELAH run CI selesai (09:05:40Z), dan berupa item bisnis sungguhan bukan fixture. Alat bukti yang benar sekarang: ADA/TIDAKNYA baris berpola fixture (`*TestCorp`, email `@debug.mrp` baru), bukan kesamaan angka total.\n\nSISA PEKERJAAN DIPINDAH ke task baru INF-19 (membuat CI HIJAU di project baru) -- itu masalah BERBEDA dari celah keamanan yang ditutup task ini.'
  where task_code='INF-17' and company_id=v_company_id;

  -- LL.5 -- ABS-05 DITUTUP
  update build_tasks
  set status='selesai', completed_at=now(),
      detail_pekerjaan = detail_pekerjaan || E'\n\n---\n\nDITUTUP 23 Agu 2026 -- PENJELASAN DITEMUKAN, kelas yang sama dengan tabrakan CI. Test ini gagal 401/beruntun BUKAN karena bug produk maupun artefak jam sandbox (dugaan itu sudah dicabut lebih dulu dengan bukti), melainkan karena SISA FIXTURE BERNAMA KEMBAR: CI dan sesi lokal sama-sama menulis ke SATU database nyata, sehingga dua proses bisa membuat company bernama sama (`AttendanceW1TestCorp`) berbarengan lalu saling merusak fixture. Terbukti langsung 23 Agu 2026: ditemukan 2 baris `AttendanceW1TestCorp` dibuat berjarak 7 DETIK (07:28:25 dan 07:28:32) dari dua run CI yang tumpang tindih; setelah keduanya dibersihkan, file test yang sama LULUS 11/11 tanpa satu baris kode pun diubah. Akar strukturalnya sudah ditutup lewat INF-17 (CI kini memakai project database sendiri).'
  where task_code='ABS-05' and company_id=v_company_id;

  -- LL.3 -- task baru: buat CI hijau di project baru (akar penyebab sudah ditemukan)
  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes
  ) values (
    v_company_id, 'INF-19', 'Buat CI HIJAU di Project Test Baru (Auth Hook Belum Ada di Sana)', 'INF', 'Infrastruktur & Environment',
    'CI sudah benar menunjuk project `fabrix-ci-test` dan TERBUKTI tidak lagi menyentuh data nyata (INF-17), TAPI seluruh test yang bergantung RLS masih gagal di sana. AKAR PENYEBAB DITEMUKAN & DIBUKTIKAN: klaim JWT `company_id` dan `app_role` -- yang jadi dasar SELURUH RLS policy lewat `jwt_company_id()`/`jwt_app_role()` -- TIDAK ADA di token yang diterbitkan project baru.',
    'Tanpa klaim itu, setiap RLS policy menolak akses, jadi test gagal berjamaah walau kode & skema sudah benar. CI tidak bisa dipakai sebagai jaring pengaman sampai ini beres.',
    'mendesak', array['Integrasi','Keamanan'], 'Claude Code', 'menunggu', null, 'temuan_claude',
    E'BUKTI (bukan dugaan): login akun sama ke KEDUA project lalu token di-decode -- FABRIX-APP mengembalikan klaim `company_id: 1` + `app_role: company_admin`; `fabrix-ci-test` TIDAK punya keduanya sama sekali. Klaim itu top-level, BUKAN dari `app_metadata` (isi `raw_app_meta_data` identik di kedua project: hanya provider/providers).\n\nASALNYA (terdokumentasi di HANDOFF.md, entri Sesi staging): Supabase **Custom Access Token Hook** berbasis HTTPS yang menunjuk **Edge Function `custom-access-token`** (sumbernya ADA di repo: `supabase/functions/custom-access-token/index.ts`). Yang dibutuhkan project baru, TIDAK SATU PUN datang dari migrasi:\n  1. deploy Edge Function `custom-access-token` ke fabrix-ci-test (WAJIB `--no-verify-jwt`, syarat Auth Hook HTTPS);\n  2. secret `CUSTOM_ACCESS_TOKEN_HOOK_SECRETS` khusus project itu (jangan pakai punya project lain);\n  3. Auth config: `hook_custom_access_token_enabled=true` + uri + secret.\n\nLANGKAH TAMBAHAN yang sudah dikerjakan sebagian (23 Agu 2026): akun uji sudah di-seed ke fabrix-ci-test lewat `scripts/seed-debug-tenants.js` (8 akun, Company A + Company B) -- login dasar SUDAH berhasil di sana, jadi yang tersisa memang murni soal hook/klaim. Diverifikasi lokal: menjalankan `tests/cross_company_isolation.test.ts` terhadap fabrix-ci-test menghasilkan 6/7 lulus, 1 gagal PERSIS di titik "user boleh melihat datanya sendiri" -- gejala khas klaim company_id kosong.',
    'Ditemukan lewat LL.3 (23 Agu 2026). Kelas yang SAMA dengan INF-20 -- konfigurasi/dependensi yang hidup di luar migrasi.'
  ) on conflict (company_id, task_code) do nothing;

  -- LL.8 -- temuan untuk tenant kedua kelak
  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes
  ) values (
    v_company_id, 'INF-20', 'Inventarisasi Apa Saja yang Hanya Hidup Lewat Skrip/Dashboard, Bukan Migrasi', 'INF', 'Infrastruktur & Environment',
    'Membangun sistem dari NOL memakai migrasi saja TERBUKTI menghasilkan sistem yang tidak bisa dipakai: skema lengkap, tapi tanpa akun uji, tanpa tenant Company B, dan -- yang paling menentukan -- tanpa Auth Hook yang menyuntikkan klaim `company_id`/`app_role` yang jadi dasar SELURUH RLS.',
    'Ini kelas masalah yang SAMA dengan temuan lama "company_id=1 dibuat lewat skrip di luar migrasi" (yang dulu membuat CI merah 10 commit). Selama belum diinventarisasi, setiap kali sistem dibangun di tempat baru (project CI, staging, TENANT KEDUA yang membayar) akan ditemukan lagi potongan yang hilang -- satu per satu, lewat kegagalan, bukan lewat daftar.',
    'penting', array['Dokumentasi','Integrasi'], 'Claude Code', 'menunggu', null, 'temuan_claude',
    E'PERTANYAAN YANG DIKEJAR: berapa banyak lagi data/konfigurasi yang hanya hidup lewat skrip atau setelan dashboard, dan TIDAK akan ada bila sistem dibangun dari nol?\n\nYANG SUDAH DIKETAHUI (jangan diulang mencarinya): (1) baris `companies` company_id=1 -- sudah ditambal lewat migrasi bootstrap 20260827605000; (2) akun uji `@debug.mrp` + tenant Company A/B -- lewat `scripts/seed-debug-tenants.js`; (3) **Auth Hook custom access token + Edge Function `custom-access-token` + secret CUSTOM_ACCESS_TOKEN_HOOK_SECRETS + Auth config** (INF-19) -- ini yang paling berbahaya karena TANPA-nya seluruh RLS menolak akses padahal skema terlihat sempurna; (4) setelan Auth lain yang pernah dicatat berbeda antar project (`mailer_autoconfirm`, `site_url`, `uri_allow_list`).\n\nYANG BELUM DIPERIKSA (ini pekerjaannya): Storage bucket + policy-nya, setelan Auth lain (rate limit, password policy, provider), Edge Function lain bila ada, cron/scheduler, dan data seed lain di `scripts/` yang mungkin jadi prasyarat diam-diam.\n\nKELUARAN: satu dokumen daftar lengkap "yang tidak datang dari migrasi", plus keputusan untuk tiap butir -- dipindah ke migrasi, ATAU dicatat sebagai langkah wajib onboarding project baru. JANGAN dikejar sekarang (INF-19 lebih mendesak); ini pekerjaan tersendiri.',
    'Ditemukan lewat LL.8 (23 Agu 2026), permintaan eksplisit pemilik produk setelah Auth Hook ketahuan hilang di project baru.'
  ) on conflict (company_id, task_code) do nothing;
end $$;
