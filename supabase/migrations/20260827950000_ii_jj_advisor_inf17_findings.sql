-- II.1-II.4 / JJ.1-JJ.2 (23 Agu 2026) -- hasil pemeriksaan 6 view _secure,
-- Supabase Advisor LENGKAP (428 temuan di FABRIX-APP, seluruh kategori --
-- bukan cuma Severity 2), bukti JJ.1 untuk fabrix-ci-test, dan penegasan
-- INF-17 bahwa celah CI BELUM tertutup.
do $$
declare
  v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then
    raise notice 'Perusahaan PT ITM tidak ditemukan -- migrasi dilewati (no-op).';
    return;
  end if;

  -- II.3 -- INF-17 dipertegas: celah BELUM tertutup, dan koreksi JJ.2
  update build_tasks
  set urgency = 'super_urgent',
      description = 'Project Supabase terpisah untuk CI/test SUDAH DIBUAT & diisi skema penuh dari migrasi (fabrix-ci-test, ref gzxrgbwhmjwiakcyjipd) -- TAPI CI MASIH MENUNJUK FABRIX-APP (data nyata) karena 3 GitHub Secrets belum diperbarui. CELAH YANG SEHARUSNYA DITUTUP BELUM BENAR-BENAR TERTUTUP.',
      detail_pekerjaan = detail_pekerjaan || E'\n\n---\n\nPENEGASAN 23 Agu 2026 (II.3): JANGAN dianggap selesai hanya karena project-nya sudah ada. Sampai 3 GitHub Secrets diperbarui, SETIAP push ke repo ini masih menjalankan test suite (275 test, membuat+menghapus fixture) terhadap database berisi payroll 31 orang. Satu-satunya yang menahan kerusakan adalah tiga lapis kebetulan yang sudah didokumentasikan (Invariant 9 menjaga baris company_id=1, fixture selalu pakai company buatan sendiri, cleanup mandiri bekerja untuk test yang selesai normal) -- BUKAN pengaman yang dirancang.\n\n' ||
        E'KOREKSI JJ.2 (23 Agu 2026): item "2 setelan project fabrix-ci-test" (Automatically expose new tables / Enable automatic RLS) DIHAPUS dari daftar pekerjaan pemilik produk -- kedua setelan itu HANYA muncul di layar PEMBUATAN project, tidak ada sebagai saklar setelah project jadi, jadi tidak bisa DAN tidak perlu diubah. Penggantinya adalah BUKTI KONDISI NYATA (JJ.1, diverifikasi langsung di database fabrix-ci-test, bukan dari setelan): (a) 0 tabel tanpa RLS aktif; (b) 0 fungsi dengan grant luas di luar allowlist (dicek memakai debug_list_function_grants + allowlist yang dibaca PERSIS dari tests/function_grant_security_audit.test.ts, bukan diketik ulang); (c) profil Supabase Advisor fabrix-ci-test IDENTIK dengan FABRIX-APP untuk seluruh kategori keamanan (6 security_definer_view, 10 rls_enabled_no_policy, 12 function_search_path_mutable, 24/25 security definer executable) -- perbedaan hanya di unused_index (67 vs 7, wajar karena database baru belum punya lalu lintas query) dan auth_leaked_password_protection (setelan Auth per-project, bukan skema). KESIMPULAN TERBUKTI: perilaku bawaan saat pembuatan project TIDAK menentukan apa pun -- skema yang dibangun dari migrasi yang menetapkan RLS & hak akses secara eksplisit menghasilkan postur keamanan yang sama persis.\n\n' ||
        E'II.4 -- BUKTI YANG AKAN MEMBUKTIKAN CI TIDAK LAGI MENYENTUH FABRIX-APP (disiapkan sekarang, tinggal dijalankan nanti): (1) Catat jumlah baris tabel kunci FABRIX-APP + daftar company selain PT ITM/Company B SEBELUM push percobaan. (2) Push satu commit sepele ke main, tunggu CI selesai HIJAU. (3) Ulangi hitungan yang sama -- bila CI benar-benar pindah, angkanya IDENTIK dan TIDAK ADA company fixture baru muncul (nama seperti *TestCorp) di FABRIX-APP; sebelum pemindahan, hitungan ini SELALU berubah selama CI berjalan (terbukti berulang kali sesi ini). (4) Bukti pendukung kedua: di project fabrix-ci-test, jumlah company/baris JUSTRU bertambah-lalu-bersih selama CI berjalan -- membuktikan test benar-benar pindah ke sana, bukan cuma berhenti jalan. (5) Setelah keduanya terbukti, BARU cabut ALLOW_TESTS_AGAINST_REAL_PROJECT dari ci.yml (jangan dicabut sebelum terbukti, atau CI merah tanpa alasan yang jelas).'
  where task_code = 'INF-17' and company_id = v_company_id;

  -- II.1 -- temuan Advisor yang genuinely perlu tindakan (dipisah dari yang aman)
  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes
  ) values (
    v_company_id, 'SEC-07', 'Kunci search_path 12 Fungsi Database (Temuan Supabase Advisor)', 'SEC', 'Keamanan',
    'Supabase Advisor (dijalankan LENGKAP pertama kalinya 23 Agu 2026 lewat `supabase db advisors --type all --level info`) menemukan 12 fungsi tanpa `set search_path` tetap: jwt_company_id, jwt_app_role, jwt_is_company_leadership, jwt_can_view_financial_data, jwt_can_view_wages, jwt_managed_department, jwt_document_department, work_order_is_blocked, bom_component_creates_cycle, guard_customer_supplied_lot, suggest_fefo_lots, format_rupiah_id.',
    'Fungsi tanpa search_path tetap berisiko "search_path injection" -- pemanggil bisa membuat objek bernama sama di schema lain yang lebih dulu di jalur pencarian, membuat fungsi memanggil sesuatu yang bukan dimaksud. Risiko NYATA-nya di sini terbatas (mayoritas 12 fungsi ini adalah helper JWT yang hanya membaca klaim token dan tidak menyentuh tabel), TAPI 7 di antaranya dipakai di ekspresi RLS policy -- kelas fungsi yang paling tidak boleh berperilaku tak terduga.',
    'penting', array['Keamanan'], 'Claude Code', 'menunggu', null, 'temuan_claude',
    'Tambahkan `set search_path = public, pg_catalog` ke definisi 12 fungsi ini lewat migrasi baru (pola sama seperti fungsi lain yang sudah benar). HATI-HATI: jangan mengubah SIGNATURE-nya sama sekali -- 7 dari 12 dipakai di ekspresi RLS policy, dan mengubah signature akan membuat Postgres membuat OVERLOAD BARU dengan ACL default (persis insiden create_shipment_with_signature, lihat HANDOFF.md). Setelah migrasi, WAJIB jalankan ulang tests/function_grant_security_audit.test.ts DAN full suite (RLS yang memakainya harus tetap bekerja).',
    'Ditemukan lewat II.1 (23 Agu 2026) -- pemeriksaan Supabase Advisor LENGKAP pertama kali di proyek ini (seluruh tab, bukan cuma Severity 2). Alat ini sudah tersedia sejak awal tapi belum pernah dibuka.'
  )
  on conflict (company_id, task_code) do nothing;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes
  ) values (
    v_company_id, 'SEC-08', 'Aktifkan Perlindungan Kata Sandi Bocor (HaveIBeenPwned) di Supabase Auth', 'SEC', 'Keamanan',
    'Supabase Auth punya fitur bawaan menolak kata sandi yang sudah pernah bocor di kebocoran data publik (dicek ke HaveIBeenPwned.org). Fitur ini BELUM aktif di FABRIX-APP -- temuan Supabase Advisor 23 Agu 2026.',
    'Tanpa ini, pengguna (termasuk akun berperan tinggi) bisa memakai kata sandi yang sudah beredar di internet -- jalur masuk paling umum ke sistem apa pun, dan tidak tertahan oleh RLS/peran mana pun karena penyerang masuk sebagai pengguna sah.',
    'penting', array['Keamanan'], 'Pemilik Produk', 'menunggu', null, 'temuan_claude',
    'Satu saklar di dashboard Supabase (Authentication -> Policies/Password, cari "Leaked password protection" / HaveIBeenPwned). Tidak bisa diatur lewat CLI/migrasi -- butuh akses dashboard pemilik produk. Tidak ada perubahan kode sama sekali. Setelah aktif, pengguna yang mencoba memakai kata sandi bocor akan ditolak saat daftar/ganti sandi.',
    'Ditemukan lewat II.1 (23 Agu 2026) -- pemeriksaan Supabase Advisor lengkap.'
  )
  on conflict (company_id, task_code) do nothing;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes
  ) values (
    v_company_id, 'PRF-01', 'Tinjau 124 Foreign Key Tanpa Indeks & 199 Policy Bertumpuk (Temuan Performa Advisor)', 'PRF', 'Performa',
    'Supabase Advisor menemukan 124 foreign key tanpa indeks pendamping, 199 kasus "multiple permissive policies" (beberapa RLS policy permissive di tabel+aksi yang sama, dievaluasi semuanya tiap query), dan 19 kasus "auth_rls_initplan" (pemanggilan auth.uid()/fungsi jwt di policy yang dievaluasi ulang PER BARIS, bukan sekali per query).',
    'Belum terasa hari ini karena data masih kecil (tabel terbesar 188 baris) -- TAPI ketiganya adalah kelas masalah yang efeknya tumbuh seiring data bertambah, dan auth_rls_initplan khususnya bisa membuat query melambat drastis begitu tabel mencapai puluhan ribu baris (produksi nyata MLVT akan ke sana).',
    'bisa_menunggu', array['Formula','Database'], 'Claude Code', 'menunggu', null, 'temuan_claude',
    E'JANGAN dikerjakan borongan sekarang -- 342 temuan, mayoritas belum berdampak, dan menambah indeks sembarangan justru memperlambat tulis. Cara yang benar: (1) tunggu sampai ada data produksi nyata (batch MLVT pertama) supaya bisa diukur query mana yang benar-benar lambat, bukan ditebak; (2) prioritaskan auth_rls_initplan dulu (perbaikannya murah & aman: bungkus pemanggilan jadi `(select auth.uid())` supaya dievaluasi sekali per query, bukan per baris -- pola yang sudah dipakai di fungsi log_data_change AUD-07); (3) indeks FK ditambahkan HANYA untuk yang terbukti dipakai di query lambat.\n\nCatatan: 7 "unused_index" juga dilaporkan di FABRIX-APP -- JANGAN langsung dihapus, database ini belum melayani lalu lintas produksi sungguhan, jadi "tidak terpakai" belum tentu berarti tidak dibutuhkan.',
    'Ditemukan lewat II.1 (23 Agu 2026) -- pemeriksaan Supabase Advisor lengkap: total 428 temuan di FABRIX-APP (6 ERROR, 280 WARN, 142 INFO).'
  )
  on conflict (company_id, task_code) do nothing;

end $$;
