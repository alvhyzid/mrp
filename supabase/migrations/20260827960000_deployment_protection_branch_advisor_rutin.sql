-- BLOK PERINTAH (23 Agu 2026) -- Bagian 1 (fakta Deployment Protection),
-- Bagian 2 (arkeologi branch tracking), Bagian 5 (panduan secret INF-17),
-- Bagian 6 (task keamanan dari Advisor).
do $$
declare
  v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then
    raise notice 'Perusahaan PT ITM tidak ditemukan -- migrasi dilewati (no-op).';
    return;
  end if;

  -- BAGIAN 1 + 2 -- INF-11 diperbarui dengan fakta Deployment Protection & hasil arkeologi branch tracking
  update build_tasks
  set detail_pekerjaan = detail_pekerjaan || E'\n\n---\n\nFAKTA DEPLOYMENT PROTECTION (23 Agu 2026, menutup ketidakjelasan II.2b) -- DIKONFIRMASI DUA ARAH: pemilik produk melihatnya di dashboard, DAN Claude Code memverifikasi lewat Vercel API (read-only): project mrp-staging punya `ssoProtection: {deploymentType: "all_except_custom_domains"}` -- persis "Standard Protection". Vercel Authentication SUDAH MENYALA dan GRATIS di paket Pro, TAPI cakupannya "Protect all except production Custom Domains" -- artinya PRODUCTION TETAP TERBUKA; yang terlindungi hanya preview & branch lain. Cakupan "All Deployments (Protect all domains)" adalah bagian Advanced Deployment Protection, BERBAYAR $150/bulan (satu paket dengan Password Protection & Deployment Protection Exceptions).\n\n' ||
      E'KESIMPULAN: Vercel Authentication BUKAN jalan keluar untuk melindungi production. JALAN B (nyalakan Deployment Protection lalu sambungkan) DIBATALKAN -- dicatat supaya tidak dibuka ulang: yang gratis tidak melindungi production, dan yang melindungi production berbiaya $150/bulan untuk masalah yang ternyata bukan kebocoran data (lihat penilaian risiko di bawah).\n\n' ||
      E'PERINGATAN KERAS -- JANGAN PERNAH MENYALAKAN "ALL DEPLOYMENTS": halaman POD (bukti terima pengiriman) dibuka PELANGGAN lewat QR di surat jalan yang SUDAH TERCETAK DAN BEREDAR. Pelanggan TIDAK punya akun Vercel. Dengan Standard Protection sekarang, POD tetap bisa dibuka pelanggan -- itu justru yang dibutuhkan. Menyalakan "All Deployments" akan MENGUNCI PELANGGAN dari halaman POD dan mereka tidak bisa menandatangani bukti terima -- memutus kontrak eksternal yang tidak bisa ditarik kembali (kertas sudah beredar). Ini masuk daftar kontrak eksternal yang wajib dijaga, sejajar dengan "URL POD di QR harus tetap hidup".\n\n' ||
      E'PENILAIAN RISIKO DILURUSKAN (23 Agu 2026, Bagian 3): penyambungan data nyata selama ini ditahan karena dikira risikonya KEBOCORAN DATA -- itu KELIRU. Pengaman utama data nyata BUKAN Vercel, melainkan login aplikasi (16 peran) + RLS ber-company_id, yang SUDAH DIBUKTIKAN bekerja lewat uji login sungguhan (Company B hanya melihat datanya sendiri; 6 view _secure semuanya menyaring company_id). Alamat production terbuka, tapi yang bisa dibuka tanpa akun HANYALAH HALAMAN LOGIN. Yang TETAP jadi masalah: setiap push ke `main` langsung terbit ke production -- itu masalah KUALITAS RILIS, bukan kebocoran data, dan untuk sekarang penggunanya hanya pemilik produk sendiri.\n\n' ||
      E'ARKEOLOGI BRANCH TRACKING (Bagian 2, 23 Agu 2026 -- kenapa main->staging selalu gagal disimpan): (a) TIDAK ADA vercel.json di repo sama sekali -- hipotesis "setelan dashboard kalah dari berkas konfigurasi" TIDAK TERBUKTI, bukan itu penyebabnya. (b) Branch `staging` TERBUKTI ADA di remote GitHub (dc1f7b8, tidak protected, terlihat publik) -- bukan kasus "branch tidak ditemukan". (c) gitForkProtection=true, tapi itu tidak terkait pemilihan production branch. (d) PERCOBAAN LEWAT API (diizinkan eksplisit, hanya production branch, tidak menyentuh hal lain): `PATCH /v9/projects/mrp-staging` dengan body {"link":{"productionBranch":"staging"}} DITOLAK dengan galat `bad_request: Invalid request: should NOT have additional property "link"` -- artinya productionBranch memang TIDAK DIEKSPOS di endpoint update project versi publik; ia hidup di dalam objek `link` yang read-only lewat jalur itu. Sambungan Git DIVERIFIKASI MASIH UTUH setelah percobaan (type=github, org=alvhyzid, repo=mrp, productionBranch=main -- tidak berubah, tidak rusak). (e) Vercel CLI v59 terpasang & terautentikasi, TAPI `vercel project` TIDAK punya subperintah untuk mengubah production branch sama sekali.\n\n' ||
      E'KESIMPULAN BAGIAN 2: kegagalan ini TIDAK disebabkan paket berlangganan (Pro sudah aktif), TIDAK disebabkan berkas konfigurasi di repo (tidak ada), dan TIDAK disebabkan branch yang hilang (ada). Jalur API publik & CLI sama-sama tidak menyediakan cara mengubahnya. Karena dashboard pun konsisten menolak menyimpan (Request ID terakhir: sin1:sin1:sin1:sfo1::5gtlc-1787464249778-25b139a9ae5b) sementara setelan Vercel LAIN (nama tim, slug) berhasil disimpan, temuan ini LAYAK DILAPORKAN KE DUKUNGAN VERCEL sebagai dugaan bug sisi Vercel, dengan Request ID di atas sebagai bukti. Claude Code BERHENTI di sini sesuai batas -- tidak mencoba jalur re-link Git (berisiko memutus sambungan, dilarang eksplisit).'
  where task_code = 'INF-11' and company_id = v_company_id;

  -- BAGIAN 5 -- INF-17: panduan nama secret persis
  update build_tasks
  set detail_pekerjaan = detail_pekerjaan || E'\n\n---\n\nPANDUAN SECRET (Bagian 5.2, 23 Agu 2026) -- 3 nama PERSIS yang perlu diperbarui di GitHub (Settings -> Secrets and variables -> Actions -> pilih secret -> Update):\n' ||
      E'  1. NEXT_PUBLIC_SUPABASE_URL\n  2. NEXT_PUBLIC_SUPABASE_ANON_KEY\n  3. SUPABASE_SERVICE_ROLE_KEY\n\n' ||
      E'Nilainya diambil SENDIRI oleh pemilik produk dari: Supabase Dashboard -> pilih project **fabrix-ci-test** -> Settings -> API. Di sana: "Project URL" untuk nomor 1, kunci "anon / public" untuk nomor 2, kunci "service_role" (perlu diklik "Reveal") untuk nomor 3. JANGAN kirimkan nilai kunci lewat percakapan ke Claude Code -- tidak dibutuhkan dan melanggar aturan tetap proyek ini.\n\n' ||
      E'CATATAN PENTING soal urutan (Bagian 4.2): 3 GitHub Secrets (untuk CI) dan 3 variabel Production di Vercel (untuk situs) adalah DUA TEMPAT PENYIMPANAN YANG BERBEDA DAN TERPISAH PENUH -- GitHub Secrets hanya dibaca GitHub Actions saat CI berjalan; variabel Vercel hanya dibaca saat build/runtime situs. Keduanya kebetulan bernama sama karena membaca variabel lingkungan yang sama di kode, TAPI mengubah salah satu TIDAK memengaruhi yang lain sama sekali. Jadi urutannya BEBAS, tidak saling mengunci: GitHub Secrets -> fabrix-ci-test (supaya CI berhenti menyentuh data nyata), Vercel Production -> FABRIX-APP (supaya situs menampilkan data nyata). Keduanya menunjuk project yang BERBEDA, dan itu memang benar -- bukan kekeliruan.'
  where task_code = 'INF-17' and company_id = v_company_id;

  -- BAGIAN 6.1 -- SEC-07 naik ke Mendesak
  insert into build_task_urgency_history (build_task_id, old_urgency, new_urgency, requested_by)
  select build_task_id, 'penting', 'mendesak',
    'Pemilik Produk (23 Agu 2026) -- kelas kerentanan sungguhan (search_path injection), sekelas dengan REVOKE yang sudah diberantas dua kali, bukan catatan gaya.'
  from build_tasks where company_id = v_company_id and task_code = 'SEC-07';
  update build_tasks
  set urgency = 'mendesak',
      detail_pekerjaan = detail_pekerjaan || E'\n\n---\n\nDIKONFIRMASI 23 Agu 2026 (Bagian 6.1): ke-12 fungsi ini ADA DI KEDUA PROJECT -- Supabase Advisor melaporkan `function_search_path_mutable` sebanyak 12 di FABRIX-APP (data nyata) DAN 12 di fabrix-ci-test, angka identik. Jadi ini BUKAN artefak project CI, melainkan kondisi nyata skema yang dibangun dari migrasi -- perbaikannya lewat migrasi otomatis berlaku di kedua project (dan di project mana pun yang dibangun dari migrasi yang sama nanti).'
  where task_code = 'SEC-07' and company_id = v_company_id;

  -- BAGIAN 6.2 -- SEC-08: dikonfirmasi dashboard-only
  update build_tasks
  set detail_pekerjaan = detail_pekerjaan || E'\n\n---\n\nDIPERIKSA 23 Agu 2026 (Bagian 6.2): TIDAK BISA dinyalakan lewat CLI/migrasi -- `supabase/config.toml` bagian [auth] hanya punya `minimum_password_length`, `password_requirements`, `secure_password_change`; TIDAK ADA kunci untuk leaked-password/HaveIBeenPwned sama sekali. Jadi memang BUTUH DASHBOARD.\n\n' ||
      E'LOKASI PERSIS untuk pemilik produk: Supabase Dashboard -> project **FABRIX-APP** -> menu kiri **Authentication** -> **Policies** (atau **Sign In / Providers**, tergantung versi tampilan) -> cari bagian **Password** / "Leaked password protection" -> nyalakan. Satu saklar, tanpa perubahan kode.\n\n' ||
      E'TEMUAN SAMPINGAN saat memeriksa ini (dicatat, BELUM jadi task tersendiri karena perlu keputusan pemilik produk): `minimum_password_length = 6` di config.toml tergolong LEMAH untuk sistem berisi data payroll (umumnya 8-12 minimum). Perlu dipastikan dulu apakah nilai config.toml itu benar-benar berlaku di project remote (config.toml utamanya mengatur lingkungan LOKAL kecuali `supabase config push` dijalankan) -- kalau ya, menaikkannya adalah keputusan kebijakan akses yang wajib ditanyakan ke pemilik produk lebih dulu, bukan diputuskan sendiri.'
  where task_code = 'SEC-08' and company_id = v_company_id;

  -- BAGIAN 6.3 -- PRF-01: pemicu konkret, jangan dikosongkan
  update build_tasks
  set detail_pekerjaan = detail_pekerjaan || E'\n\n---\n\nPEMICU KONKRET (Bagian 6.3, 23 Agu 2026 -- ditetapkan supaya tidak menggantung tanpa patokan). Kerjakan begitu SALAH SATU terpenuhi:\n' ||
      E'  (a) KELUHAN NYATA: pengguna menyebut ada halaman yang terasa lambat (bukan diukur Claude Code sendiri, tapi dirasakan pengguna sungguhan) -- ini pemicu paling sah, karena mengukur yang benar-benar dipakai.\n' ||
      E'  (b) AMBANG BARIS: tabel transaksi mana pun (stock_movements, work_order_step_progress, attendance_events, data_change_audit_log, lots) melewati **50.000 baris**. Alasan angka ini: di bawah itu Postgres umumnya masih cepat dengan sequential scan sekalipun; di atasnya, FK tanpa indeks & auth_rls_initplan (auth.uid() dievaluasi PER BARIS) mulai terasa berlipat. Tabel terbesar hari ini baru 188 baris -- jauh sekali dari ambang.\n' ||
      E'  (c) AMBANG WAKTU: query mana pun tercatat >1 detik di log Supabase.\n\n' ||
      E'URUTAN PENGERJAAN saat pemicu terpenuhi (jangan borongan): auth_rls_initplan DULU (19 kasus, perbaikan paling murah & aman: bungkus jadi `(select auth.uid())` supaya dievaluasi sekali per query, bukan per baris) -> lalu indeks FK HANYA untuk yang terbukti muncul di query lambat -> multiple_permissive_policies TERAKHIR (199 kasus, perbaikannya menyentuh RLS, paling berisiko, dan paling kecil dampaknya di skala kecil).'
  where task_code = 'PRF-01' and company_id = v_company_id;

  -- BAGIAN 6.4 -- Advisor jadi pemeriksaan rutin
  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes
  ) values (
    v_company_id, 'AUD-12', 'Supabase Advisor Jadi Pemeriksaan Rutin (Kriteria Selesai Tiap Perubahan Skema)', 'AUD', 'Audit Kualitas',
    'Supabase Advisor tersedia sejak awal proyek tapi BARU PERTAMA KALI dibuka lengkap 23 Agu 2026 -- dan langsung menghasilkan 428 temuan, 3 di antaranya jadi task nyata (SEC-07 search_path, SEC-08 leaked password, PRF-01 performa). Alat yang menemukan sebanyak itu dalam sekali jalan tidak boleh bergantung pada kebetulan seseorang membukanya.',
    'Selama Advisor tidak masuk kriteria selesai, temuan keamanan/performa baru dari perubahan skema hanya akan ketahuan kalau ada yang kebetulan ingat membukanya -- persis kelas masalah "audit tanpa gigi" yang sudah tercatat di CLAUDE.md (AUD-04/H.4).',
    'penting', array['Dokumentasi','Keamanan'], 'Claude Code', 'menunggu', null, 'temuan_claude',
    E'CARA MENJALANKAN LEWAT CLI (tidak bergantung dashboard -- ini temuan penting 23 Agu 2026, sebelumnya dikira dashboard-only):\n\n' ||
      E'  npx supabase db advisors --linked --type all --level info\n\n' ||
      E'Flag `--type all` mencakup security DAN performance; `--level info` menampilkan SELURUH tingkat (tanpa flag ini, temuan INFO tersembunyi -- termasuk rls_enabled_no_policy). Ada juga `--fail-on <level>` yang membuat perintah keluar dengan status non-nol -- berguna kalau kelak mau dijadikan langkah CI otomatis.\n\n' ||
      E'YANG PERLU DIKERJAKAN: (1) tambahkan aturan ke CLAUDE.md bahwa setiap sesi yang mengubah skema database WAJIB menjalankan Advisor sebelum melapor selesai, dan melaporkan selisihnya dibanding sebelum perubahan (temuan BARU apa yang muncul akibat perubahan itu) -- bukan cuma total angkanya; (2) pertimbangkan menambahkannya sebagai langkah CI (`--fail-on error`) supaya temuan tingkat ERROR baru langsung memerahkan CI -- TAPI cek dulu: 6 temuan ERROR `security_definer_view` yang ADA SEKARANG sudah terbukti aman & disengaja, jadi butuh mekanisme allowlist lebih dulu supaya CI tidak merah permanen karena hal yang sudah diputuskan aman (pola sama seperti ALLOWED_BROAD_GRANT di tests/function_grant_security_audit.test.ts).',
    'Ditemukan lewat Bagian 6.4 (23 Agu 2026) -- permintaan eksplisit pemilik produk setelah Advisor pertama kali dibuka lengkap.'
  )
  on conflict (company_id, task_code) do nothing;

end $$;
