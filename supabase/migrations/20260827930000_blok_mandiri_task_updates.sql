-- BLOK KERJA MANDIRI (23 Agu 2026) -- pembaruan build_tasks untuk seluruh
-- pekerjaan yang diselesaikan: INF-06 (bersih), AUD-07 (lapisan data
-- selesai, keterbatasan identitas service-role dicatat), MRG-11 (lapisan
-- data selesai, layar menunggu UX, golongan karyawan BELUM ditetapkan),
-- PLT-05 (lapisan data selesai), task baru untuk project CI/test terpisah
-- dan sisa langkah manual (secrets GitHub, 2 toggle dashboard Supabase).
do $$
declare
  v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then
    raise notice 'Perusahaan PT ITM tidak ditemukan -- migrasi dilewati (no-op).';
    return;
  end if;

  -- INF-06 -- SELESAI
  update build_tasks
  set status = 'selesai',
      completed_at = now(),
      detail_pekerjaan = detail_pekerjaan || E'\n\n---\n\nDITUTUP 23 Agu 2026 -- 6 company bekas test dihapus lewat migrasi idempoten (20260827920000): PlantConsolidationTestCorp, Sesi0BRoleTestCorp, BaselineLockSeparationTestCorp, RoutingBomSnapshotTestCorp, AiProjectDashboardTestCorp, BatchLifecycleTestCorp. Diverifikasi dulu (debug_company_residual_scan): semua 2-29 baris menggantung, tidak ada yang tidak wajar. Bukti: baris company_id=1 byte-identik sebelum/sesudah (8 tabel sampel); migrasi dijalankan 2x (throwaway copy), run kedua 0 baris berubah; 0 company tersisa selain PT ITM/Company B.'
  where task_code = 'INF-06' and company_id = v_company_id;

  -- AUD-07 -- lapisan data SELESAI, catat keterbatasan jujur
  update build_tasks
  set detail_pekerjaan = detail_pekerjaan || E'\n\n---\n\nDIBANGUN 23 Agu 2026: tabel data_change_audit_log + fungsi trigger generik log_data_change(), dipasang di employees/suppliers/customers/customer_purchase_orders/purchase_orders/sales_orders/shipments/attendance_events/attendance_corrections. DITEGAKKAN DI DATABASE (trigger), bukan aplikasi -- dibuktikan tertangkap lewat INSERT/UPDATE/DELETE langsung via SQL (bukan cuma lewat aplikasi). KETERBATASAN JUJUR: identitas PASTI (auth.uid) hanya tertangkap untuk sesi ber-JWT; mayoritas jalur aplikasi hari ini pakai SERVICE ROLE (server Next.js), jadi "siapa" yang tercatat baru sebatas changed_by_role=service_role, BUKAN user_id manusia yang memicu aksi di aplikasi. Menutup ini penuh butuh SETIAP fungsi server menyertakan user_id pemanggil eksplisit -- BELUM dikerjakan, dicatat sebagai lanjutan (lihat AUD-07b). Migrasi: 20260827900000.',
      notes = coalesce(notes || E'\n\n', '') || 'Lapisan data selesai 23 Agu 2026 -- TIDAK ada layar dibangun (sesuai batas M.2). AUD-07b (task baru) menutup celah identitas service-role.'
  where task_code = 'AUD-07' and company_id = v_company_id;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes
  ) values (
    v_company_id, 'AUD-07B', 'Jejak Tulis: Tangkap Identitas Pengguna Nyata (Bukan Cuma "service_role")', 'AUD', 'Audit Kualitas',
    'data_change_audit_log (AUD-07) mencatat siapa/kapan/apa untuk setiap tulisan ke 9 tabel lingkup -- TAPI mayoritas jalur aplikasi memakai SERVICE ROLE (server Next.js), jadi kolom changed_by_role hanya menunjukkan "service_role", bukan user_id manusia yang sebenarnya memicu aksi tersebut di aplikasi.',
    'Untuk pertanyaan "SIAPA yang mengubah gaji karyawan X bulan lalu", jejak yang ada hari ini hanya menjawab "lewat aplikasi" bukan "oleh siapa" -- separuh nilai audit trail (identitas manusia) belum tercapai.',
    'penting', array['Fungsi','Database'], 'Claude Code', 'menunggu', null, 'temuan_claude',
    'Perlu pola konsisten: SETIAP fungsi server yang menulis ke 9 tabel lingkup (createXxx/updateXxx/deleteXxx) menyertakan user_id pemanggil secara eksplisit ke trigger -- opsi (a) tambah parameter p_actor_user_id ke tiap fungsi + kolom terpisah di log, ATAU (b) set_config(''app.current_user_id'', ...) per-request lalu dibaca trigger. Cakupan besar (menyentuh banyak fungsi server sekaligus) -- perlu direncanakan sebagai pekerjaan tersendiri, bukan tambal satu-satu.',
    'Ditemukan lewat pembangunan AUD-07 (23 Agu 2026) -- keterbatasan dicatat jujur saat itu juga, bukan disembunyikan.'
  )
  on conflict (company_id, task_code) do nothing;

  -- MRG-11 -- lapisan data SELESAI
  update build_tasks
  set detail_pekerjaan = detail_pekerjaan || E'\n\n---\n\nLAPISAN DATA DIBANGUN 23 Agu 2026: tabel employee_cost_category_history (3 golongan, bertanggal berlaku effective_from/effective_to, append-only lewat RLS -- insert baru + tutup periode lama via update effective_to, TIDAK BISA mengubah kolom lain), fungsi get_employee_cost_category(employee_id, as_of_date). RLS: Finance/leadership baca+tulis, HRD baca golongan saja (tabel ini TIDAK memuat gaji/data pribadi apa pun). TIDAK ADA golongan karyawan mana pun ditetapkan (sesuai batas M.2/6.7) -- tabel kosong, menunggu Finance mengisi lewat layar yang belum dibangun (menunggu cetakan UX). Migrasi: 20260827910000.',
    notes = coalesce(notes || E'\n\n', '') || 'Lapisan data selesai 23 Agu 2026. Layar "Penggolongan Biaya Tenaga Kerja" BELUM dibangun (menunggu cetakan UX, sesuai batas M.2).'
  where task_code = 'MRG-11' and company_id = v_company_id;

  -- MRG-10 -- catat arkeologi (BELUM direkonsiliasi, blocking dependency ditemukan)
  update build_tasks
  set detail_pekerjaan = detail_pekerjaan || E'\n\n---\n\nARKEOLOGI 23 Agu 2026 (5.3, BELUM direkonsiliasi -- ditemukan blocker struktural): dua fungsi yang perlu disamakan TERNYATA beda metodologi lebih dalam dari sekadar "basis jam vs basis kru": `compute_production_batch_labor_cost()` (AKTUAL) menjumlahkan `work_order_assignments.actual_hours × tarif per-jam` PER KARYAWAN YANG DITUGASKAN ke batch itu -- TIDAK membedakan golongan Direct/Overhead/Administrasi sama sekali (siapa pun yang tercatat assignment, ikut terhitung). `computeStandardLaborCostPerUnit.ts` (STANDAR) memakai `routing_step_standard_crew` (headcount+jam per PERAN, bukan per orang) dibagi `batches_per_day` -- basis PER UNIT OUTPUT, bukan per bulan. KEDUANYA TIDAK COCOK dengan model MRG-11 yang baru diputuskan (bulan-dipool ÷ jumlah batch sebulan, dipisah Direct/Overhead/Administrasi). REKONSILIASI SUNGGUHAN baru bisa dikerjakan SETELAH ada data golongan biaya nyata (employee_cost_category_history terisi oleh Finance) -- tanpa itu, tidak ada cara membedakan mana assignment yang "Direct" (masuk hitungan) vs "Overhead" (tidak, karena Overhead dipool company-wide bukan per-assignment). DICATAT SEBAGAI PERTANYAAN/BLOKER, bukan dikerjakan setengah jadi: rekonsiliasi menunggu MRG-11 C.4 (Finance menetapkan golongan) benar-benar terisi untuk minimal beberapa karyawan produksi.',
    notes = coalesce(notes || E'\n\n', '') || 'Arkeologi 23 Agu 2026 menemukan dependency terbalik dari urutan semula -- MRG-11 (data golongan terisi) adalah PRASYARAT MRG-10, bukan sebaliknya. Belum direkonsiliasi.'
  where task_code = 'MRG-10' and company_id = v_company_id;

  -- PLT-05 -- lapisan data SELESAI
  update build_tasks
  set detail_pekerjaan = detail_pekerjaan || E'\n\n---\n\nLAPISAN DATA DIBANGUN 23 Agu 2026: tabel generik tenant_picklists (company_id, context, code, display_name, sort_order, archived_at/archived_by -- pola arsip yang sama dengan Supplier/Customer/Routing). RLS: baca oleh siapa pun di company yang sama; tulis SEMENTARA leadership+admin SEMUA konteks (pertanyaan terbuka F soal hak akses per-konteks BELUM dijawab, jadi belum bisa digerbang lebih sempit). TIDAK ADA daftar kategori reject atau pilihan lain diisi (sesuai batas 7.4/M.2) -- tabel kosong, siap diisi user lewat layar yang belum dibangun.',
    notes = coalesce(notes || E'\n\n', '') || 'Lapisan data selesai 23 Agu 2026. Arkeologi 7.1 (daftar pilihan apa saja yang tertanam di kode) BELUM dikerjakan penuh -- lihat laporan chat untuk kandidat yang sudah teridentifikasi sebagian.'
  where task_code = 'PLT-05' and company_id = v_company_id;

  -- Section 3 -- project CI/test terpisah: task baru untuk sisa langkah manual
  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes
  ) values (
    v_company_id, 'INF-17', 'Arahkan CI ke Project Test Terpisah (fabrix-ci-test) — Sisa Langkah Manual', 'INF', 'Infrastruktur & Environment',
    'Project Supabase terpisah untuk CI/test SUDAH DIBUAT (fabrix-ci-test, ref gzxrgbwhmjwiakcyjipd, organisasi FABRIX, region ap-southeast-2) dan SUDAH diisi skema lengkap dari migrasi (172+ migrasi, termasuk audit trail & MRG-11/PLT-05 terbaru) -- TERBUKTI rebuild-from-migrations bekerja bersih. TAPI mengarahkan CI ke sana butuh mengganti NILAI 3 GitHub Secrets (NEXT_PUBLIC_SUPABASE_URL/ANON_KEY, SUPABASE_SERVICE_ROLE_KEY) -- Claude Code tidak punya akses token GitHub untuk mengubah secrets repo.',
    'Selama secrets belum diarahkan, CI ("Typecheck & Test Suite") TETAP menyentuh FABRIX-APP (data nyata) seperti sebelumnya -- flag ALLOW_TESTS_AGAINST_REAL_PROJECT di ci.yml TIDAK BOLEH dicabut sampai ini beres, atau CI akan merah.',
    'mendesak', array['Integrasi','Keamanan'], 'Pemilik Produk', 'menunggu', null, 'temuan_claude',
    E'LANGKAH UNTUK PEMILIK PRODUK:\n1. Buka repo GitHub -> Settings -> Secrets and variables -> Actions.\n2. Update 3 secret dengan nilai project fabrix-ci-test -- ambil dari Supabase Dashboard project fabrix-ci-test > Settings > API (Project URL, anon/public key, service_role key): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.\n3. Setelah secrets diperbarui, beri tahu Claude Code -- langkah lanjutan (cabut ALLOW_TESTS_AGAINST_REAL_PROJECT dari ci.yml, jalankan CI sungguhan untuk membuktikan) dikerjakan begitu dikonfirmasi.\n4. Di dashboard Supabase project fabrix-ci-test, aktifkan 2 setelan yang tidak bisa diatur lewat CLI: "Automatically expose new tables" DIMATIKAN, "Enable automatic RLS" DINYALAKAN (Project Settings -> Data API atau serupa -- nama menu persis bisa beda, cari kata kunci itu).',
    'Ditemukan lewat Section 3 (23 Agu 2026, BLOK KERJA MANDIRI) -- project berhasil dibuat & diisi skema lewat CLI, TAPI pengubahan GitHub Secrets di luar akses Claude Code (butuh token yang tidak boleh diminta/diterima lewat percakapan).'
  )
  on conflict (company_id, task_code) do nothing;

end $$;
