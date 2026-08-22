-- V.1-V.4 (23 Agu 2026) -- lanjutan investigasi "aktivitas bersamaan".
-- Perluasan cakupan INF-06, klarifikasi jujur soal batas pengawas
-- guardAgainstRealProject.ts (BUKAN memblokir CI dari data nyata -- CI
-- tetap sengaja menyentuhnya, cuma sekarang eksplisit/terlihat), dan
-- gap baru: scripts/*.js sama sekali TIDAK terlindungi pengawas ini.
do $$
declare
  v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then
    raise notice 'Perusahaan PT ITM tidak ditemukan -- migrasi dilewati (no-op).';
    return;
  end if;

  -- INF-06 -- perluas cakupan (bukan lagi "7 perusahaan", tapi seluruh sisa
  -- fixture dari sumber mana pun), catat sapuan V.3 (laporan, BELUM dihapus)
  update build_tasks
  set name = 'Bersihkan Seluruh Sisa Fixture Test di Project Data Nyata',
      description = 'Bukan lagi "7 perusahaan bekas test" -- cakupan diperluas jadi SELURUH sisa fixture yang tertinggal di project data nyata (kfvtrwuuqcjfkkuqizxt), dari sumber mana pun: sesi lokal yang terhenti paksa (SIGKILL/interupsi) MAUPUN kegagalan CI di tengah jalan (CI merah 10-11 commit berturut-turut 22 Agu bisa saja berhenti di tengah test dan meninggalkan sisa yang sama sekali belum tercatat).',
      detail_pekerjaan = detail_pekerjaan || E'\n\n---\n\nSAPUAN V.3 (23 Agu 2026, LAPORAN SAJA -- BELUM DIHAPUS SATU PUN sesuai instruksi eksplisit):\n' ||
        E'Backlog STABIL (>1 hari, genuinely stuck) tetap 5 company, TIDAK BERTAMBAH sejak sinkronisasi sebelumnya hari ini: `PlantConsolidationTestCorp` (20 Agu, tertua), `Sesi0BRoleTestCorp` (21 Agu), `BaselineLockSeparationTestCorp` (21 Agu), `RoutingBomSnapshotTestCorp` (21 Agu), `AiProjectDashboardTestCorp` (22 Agu).\n' ||
        E'TERPISAH dari backlog stabil itu: diamati LANGSUNG saat investigasi (23 Agu 2026) 2 company TRANSIEN tercipta lalu hilang lagi dalam hitungan detik-menit -- `AttendanceW1TestCorp` dan `Bagian3PoSupplierTestCorp`, pola nama cocok persis dengan file test yang ada (`tests/attendance_geo_qr_w1.test.ts`, `tests/bagian3_po_supplier_goods_receipt.test.ts`) -- ini BUKAN sisa macet, ini test SEDANG BERJALAN dari sumber di luar sesi kerja ini (kemungkinan besar sesi/jendela lain menjalankan `npx vitest run` terhadap project yang sama, sebelum menarik commit yang berisi pengawas baru INF-12) dan terbukti membersihkan diri sendiri SEMPURNA begitu selesai -- tidak menambah backlog.\n' ||
        E'Belum ada bukti langsung yang mengaitkan kegagalan CI 10-11 commit (22 Agu) dengan salah satu dari 5 company backlog stabil (keduanya sama-sama SIGKILL/interupsi-di-tengah-jalan sebagai mekanisme, tapi tanggal 5 company itu semua SEBELUM rentetan CI merah) -- kemungkinan CI merah itu sendiri TIDAK meninggalkan sisa baru karena job CI yang gagal (build_tasks migration check) terjadi SEBELUM test suite sempat menulis data, bukan di tengah test berjalan; ini KESIMPULAN SEMENTARA berdasar tanggal, bukan pemeriksaan log CI langsung (log CI historis tidak bisa diunduh dari sini, keterbatasan berulang sesi ini).',
      urgency = 'mendesak'
  where task_code = 'INF-06' and company_id = v_company_id;

  -- INF-14 -- gap baru: scripts/*.js sama sekali tidak terlindungi
  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes
  ) values (
    v_company_id, 'INF-14', 'Skrip scripts/*.js Sama Sekali Tidak Terlindungi Pengawas Tingkat Project', 'INF', 'Infrastruktur & Environment',
    'Pengawas baru (INF-12, `tests/setup/guardAgainstRealProject.ts`) HANYA wired ke `vitest.config.ts` -- 12 skrip Node ad-hoc di `scripts/` (`seed-debug-*.js`, `seed-realcase-itm.js`, `cleanup-demo-data.js`, `load-saldo-awal-*.js`, `test-super-admin.js`, `backup-export-json.js`) membaca `.env.local` LANGSUNG lewat `dotenv`/`supabase-js`, TIDAK melewati pengawas apa pun -- menjalankan salah satunya (`node scripts/xyz.js`) terhadap project data nyata akan langsung menulis/menghapus tanpa penghalang sama sekali.',
    'Kelas risiko yang SAMA PERSIS dengan yang baru ditambal untuk test suite (INF-12) -- tapi jalur ini masih terbuka lebar. Sebagian skrip ini (`cleanup-demo-data.js`, `seed-debug-*.js`) namanya sendiri menyiratkan tindakan yang MERUSAK bila salah sasaran project.',
    'penting', array['Fungsi','Keamanan'], 'Claude Code', 'menunggu', null, 'temuan_claude',
    'Buat modul pengawas bersama (ekstrak logic dari `tests/setup/guardAgainstRealProject.ts` jadi fungsi yang bisa dipanggil ulang, mis. `src/lib/guardAgainstRealProject.ts`) dan panggil di baris PALING AWAL tiap skrip di `scripts/` yang menulis/menghapus data (bukan yang murni baca seperti `backup-export-json.js` -- backup MEMANG harus bisa membaca data nyata, itu tujuannya; skrip yang perlu digerbang adalah yang menulis/menghapus: seed-debug-*, cleanup-demo-data, load-saldo-awal-*, test-super-admin). Sama seperti test suite: tolak keras kecuali flag eksplisit diset.',
    'Ditemukan lewat V.2.a (23 Agu 2026, investigasi "aktivitas bersamaan") -- pemilik produk eksplisit meminta seluruh jalur yang menyentuh database disebutkan, bukan cuma test suite.'
  )
  on conflict (company_id, task_code) do nothing;

  -- INF-02 -- catatan: CI test-suite job & local test runs perlu dipindah ke
  -- project dev baru begitu INF-02 selesai, bukan tetap ke real project selamanya
  update build_tasks
  set notes = coalesce(notes || E'\n\n', '') || 'Catatan 23 Agu 2026 (V.2.c, investigasi "aktivitas bersamaan"): setelah project DEV baru (C.2 di atas) berdiri, job CI "Typecheck & Test Suite" (ci.yml) DAN test suite lokal (`npx vitest run`) SEHARUSNYA dipindah menunjuk project DEV baru itu, BUKAN tetap ke Production -- ini menutup gap secara benar (test tidak lagi menyentuh data nyata SAMA SEKALI, bukan cuma diberi tanda "ALLOW_TESTS_AGAINST_REAL_PROJECT=true" yang masih mengizinkannya). Sampai INF-02 selesai, keduanya SENGAJA tetap menyentuh project data nyata (satu-satunya project yang tersedia untuk pengembangan lokal saat ini) -- pengawas INF-12 hanya membuat itu EKSPLISIT/sadar, bukan MENGHENTIKANNYA.'
  where task_code = 'INF-02' and company_id = v_company_id;

end $$;
