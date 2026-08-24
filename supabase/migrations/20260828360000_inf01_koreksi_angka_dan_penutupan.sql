-- INF-01 (24 Agu 2026) — KOREKSI ANGKA & PENUTUPAN.
--
-- Migrasi ini HANYA menulis teks task. Nol perubahan skema, nol perubahan data bisnis,
-- nol sentuhan ke src/. Ia terpisah dari commit dokumen audit supaya diff dokumen itu
-- benar-benar hanya menyentuh docs/, sesuai batas task aslinya.

do $$
declare
  v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then
    raise notice 'Perusahaan PT ITM tidak ditemukan -- pencatatan task di migrasi ini dilewati (no-op).';
    return;
  end if;

-- ============================================================================
-- 1) KOREKSI "63 KARYAWAN" -> 30.
--
-- Angka yang salah di sebuah task akan terus beredar setiap kali orang mengutipnya,
-- jadi ia diperbaiki DI TEMPATNYA, bukan cuma diralat di laporan.
-- ============================================================================
update build_tasks set
  effect_description = replace(
    effect_description,
    '63 karyawan+gaji+basis BPJS',
    '30 karyawan+gaji+basis BPJS'
  )
where task_code = 'INF-01';

-- ============================================================================
-- 2) PENUTUPAN.
-- ============================================================================
update build_tasks set
  status = 'selesai',
  completed_at = now(),
  urgency = 'bisa_menunggu',
  notes = coalesce(notes || E'\n\n', '') ||
    E'DITUTUP 24 Agu 2026 dengan potret terkini di docs/audit-infrastruktur-fabrix.md ' ||
    E'(bagian "PEMBARUAN 24 Agu 2026" ditambahkan DI ATAS isi asli; isi 22 Agu sengaja tidak dihapus).\n\n' ||
    E'JANGAN DIBACA SEOLAH AUDIT INI TIDAK MENEMUKAN APA-APA. Justru sebaliknya: audit inilah yang ' ||
    E'memicu seluruh rangkaian perbaikan infrastruktur seminggu terakhir. Yang sudah tertangani, ' ||
    E'beserta task penutupnya:\n' ||
    E'  - Project data nyata di organisasi pribadi tanpa cadangan -> pindah ke organisasi FABRIX Pro, ' ||
    E'    berganti nama FABRIX-APP, Project ID tidak berubah (RBD-04, INF-02).\n' ||
    E'  - "Cadangan mati total" -> KELIRU SEJAK AWAL; cadangan harian sudah berjalan sejak 15 Agu. ' ||
    E'    Audit memeriksa satu field (pitr_enabled) lalu menyimpulkan seluruh pencadangan mati (DD.1).\n' ||
    E'  - CI menulis ke project data nyata -> project fabrix-ci-test terpisah, nol jejak fixture (INF-19).\n' ||
    E'  - Environment production menunjuk project kosong -> situs tersambung data nyata (INF-11).\n' ||
    E'  - Vercel Hobby akun pribadi -> Pro, Team, nama FABRIX (RBD-03/RBD-04).\n' ||
    E'  - Company fixture menumpuk di data nyata -> nol sisa (INF-06).\n\n' ||
    E'YANG BELUM, dan sengaja tidak disembunyikan di balik status "selesai":\n' ||
    E'  - Branch produksi Vercel masih `main` (INF-18).\n' ||
    E'  - GitHub Organization belum dibuat (RBD-03); repo masih di akun pribadi.\n' ||
    E'  - Kepemilikan Vercel Team masih akun Google pribadi.\n' ||
    E'  - PITR tidak aktif (INF-24); foto & tanda tangan tak tercakup cadangan bawaan (INF-16).\n' ||
    E'  - Flag pelolos test terhadap data nyata masih ada karena penggantinya belum siap (SEC-13).\n\n' ||
    E'KOREKSI ANGKA: kolom effect_description task ini menyebut "63 karyawan". Jumlah sebenarnya 30, ' ||
    E'dan sudah 30 sejak 22 Agu. Sumber angka 63: keterangan dalam kurung di dokumen audit ' ||
    E'("63 baris riwayat gaji & basis BPJS") -- padahal TIDAK ADA tabel riwayat gaji di skema, dan ' ||
    E'TIDAK ADA tabel mana pun berisi 55-70 baris. Sudah diperbaiki di kolomnya.\n\n' ||
    E'TEMUAN BARU YANG LAHIR DARI PEMBARUAN INI (jangan hilang bersama penutupan task):\n' ||
    E'  1. SUPABASE_SERVICE_ROLE_KEY untuk environment Production di Vercel TIDAK ditandai "Sensitive" ' ||
    E'     -- nilainya terbaca dari baris perintah. Dibuat 1 hari lalu; lima variabel lain tetap ' ||
    E'     tersembunyi, jadi ini satu variabel yang kehilangan penandanya saat disetel ulang, bukan ' ||
    E'     kebijakan yang berubah. Kunci itu melewati SELURUH RLS. Dicatat sebagai SEC-14.\n' ||
    E'  2. Auth site_url masih http://localhost:3000 dan uri_allow_list KOSONG, tanpa SMTP sendiri ' ||
    E'     (batas 2 email/jam). Aplikasi mengirim redirectTo sendiri sehingga ini BUKAN otomatis rusak, ' ||
    E'     tapi akibatnya BELUM DIUJI. Dicatat sebagai SEC-15.\n' ||
    E'  3. Bundle JavaScript situs TIDAK memuat alamat Supabase sama sekali (10 berkas disisir) -- ' ||
    E'     seluruh akses database lewat sisi server. Properti keamanan yang baik, sekaligus menutup ' ||
    E'     satu-satunya cara memeriksa sasaran environment tanpa kredensial.'
where task_code = 'INF-01';

-- ============================================================================
-- 3) DUA TEMUAN BARU JADI TASK SENDIRI — supaya tidak ikut tertutup bersama INF-01.
-- ============================================================================
insert into build_tasks (
  company_id, task_code, name, module_code, module_name, description, effect_description,
  urgency, tags, pic, status, origin, detail_pekerjaan
) values (
  v_company_id, 'SEC-14', 'Kunci Layanan Production di Vercel Tidak Lagi Ditandai Rahasia', 'SEC', 'Keamanan',
  'Dari 6 environment variable di Vercel, lima ditandai "Sensitive" (nilainya tersembunyi bahkan dari baris perintah). SUPABASE_SERVICE_ROLE_KEY untuk environment Production ditandai "Non-sensitive", dan nilainya terbaca. Variabel itu dibuat 1 hari lalu.',
  'Kunci ini melewati SELURUH Row-Level Security. Ia tidak terbuka ke pengunjung situs, tapi siapa pun yang punya akses baca ke project Vercel -- atau sesi baris perintah yang bocor -- membacanya dan sejak itu memegang akses penuh ke seluruh data PT ITM.',
  'mendesak', array['keamanan','vercel','kredensial'], 'Pemilik Produk', 'menunggu', 'temuan_claude',
  E'DITEMUKAN 24 Agu 2026 saat memperbarui potret INF-01, lewat `vercel env ls` (nilai TIDAK disalin ke mana pun).\n\n' ||
  E'BUKAN kebijakan yang berubah: lima variabel lain (termasuk kunci yang sama untuk environment Preview) ' ||
  E'tetap "Sensitive". Ini SATU variabel yang kehilangan penandanya saat disetel ulang.\n\n' ||
  E'PERBAIKANNYA MURAH: hapus variabel itu, tambahkan ulang dengan penanda Sensitive dinyalakan. ' ||
  E'Nilainya sendiri tidak perlu diketahui Claude Code dan TIDAK BOLEH dilewatkan lewat percakapan -- ' ||
  E'pemilik produk menyalinnya langsung dari Supabase Dashboard ke Vercel.\n\n' ||
  E'PERTIMBANGKAN SEKALIAN, dan ini keputusan pemilik produk: karena kuncinya sempat terbaca, cara ' ||
  E'paling aman adalah MEMUTAR ULANG kunci itu di Supabase (Project Settings > API > roll service key), ' ||
  E'lalu memasangnya kembali sebagai Sensitive. Bila diputar, SELURUH tempat yang memakainya harus ikut ' ||
  E'diperbarui -- .env.local dan rahasia GitHub Actions -- atau CI dan pekerjaan lokal berhenti bekerja.\n\n' ||
  E'MENUNDANYA TIDAK MENGHASILKAN GEJALA APA PUN sampai terlambat. Tidak ada yang gagal, tidak ada yang merah.'
) on conflict (company_id, task_code) do nothing;

insert into build_tasks (
  company_id, task_code, name, module_code, module_name, description, effect_description,
  urgency, tags, pic, status, origin, detail_pekerjaan
) values (
  v_company_id, 'SEC-15', 'Alamat Situs di Pengaturan Auth Masih localhost, Daftar Izin Kosong', 'SEC', 'Keamanan',
  'Pengaturan autentikasi project data nyata: site_url masih http://localhost:3000, uri_allow_list KOSONG, tidak ada SMTP sendiri (memakai pengirim bawaan Supabase dengan batas 2 email per jam).',
  'Tautan pemulihan kata sandi dan konfirmasi pendaftaran KEMUNGKINAN tidak bisa dibuka penerimanya. Bila benar, karyawan yang lupa kata sandi tidak punya jalan masuk kembali -- dan itu baru ketahuan saat orang pertama benar-benar membutuhkannya.',
  'penting', array['keamanan','auth','email'], 'Claude Code + Pemilik Produk', 'menunggu', 'temuan_claude',
  E'YANG SUDAH DIPASTIKAN (diperiksa 24 Agu 2026 lewat Management API):\n' ||
  E'  - site_url = http://localhost:3000\n' ||
  E'  - uri_allow_list = kosong\n' ||
  E'  - smtp_host / smtp_admin_email = kosong -> pengirim bawaan Supabase, rate_limit_email_sent = 2 per jam\n' ||
  E'  - Aplikasi MENGIRIM alamat tujuannya sendiri: ForgotPasswordPage memakai redirectTo `${origin}/reset-password`, ' ||
  E'    registerCompanyAdmin memakai emailRedirectTo `${origin}/login`.\n\n' ||
  E'YANG BELUM DIPASTIKAN, dan sengaja TIDAK diklaim sebagai kerusakan: Supabase hanya mengizinkan alamat ' ||
  E'tujuan yang cocok dengan site_url atau daftar izin. Karena daftar izinnya kosong dan site_url menunjuk ' ||
  E'localhost, ADA KEMUNGKINAN alamat tujuan dari situs tayang ditolak dan dikembalikan ke localhost. ' ||
  E'Itu BELUM diuji.\n\n' ||
  E'CARA MEMASTIKANNYA, sederhana dan tidak berisiko: klik "lupa kata sandi" di situs tayang memakai akun ' ||
  E'tenant uji, lalu lihat tautan di emailnya menunjuk ke mana. Bila menunjuk localhost, temuan ini ' ||
  E'terbukti; bila menunjuk alamat situs, ia gugur dan task ini ditutup.\n\n' ||
  E'BILA TERBUKTI, perbaikannya: setel site_url ke alamat situs tayang dan tambahkan alamatnya ke daftar ' ||
  E'izin. Keduanya setelan project, jadi keputusan pemilik produk.\n\n' ||
  E'CATATAN TERPISAH yang muncul bersamaan: pendaftaran mandiri terbuka (halaman /register bisa dibuka ' ||
  E'siapa pun, dan pendaftaran tidak dimatikan di tingkat Supabase). Orang asing yang mendaftar mendapat ' ||
  E'perusahaannya sendiri dan TIDAK bisa melihat data PT ITM -- RLS menjamin itu -- tapi ia tetap ' ||
  E'menambah tenant ke project yang sama. Perlu diputuskan apakah itu memang diinginkan sekarang.'
) on conflict (company_id, task_code) do nothing;

end $$;
