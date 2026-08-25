-- AUDIT NAVIGASI (AR-0 + NAV), 25 Agu 2026 — temuan dijadikan task di giliran yang sama.

do $$
declare v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then return; end if;

  update build_tasks set
    urgency = 'super_urgent', super_urgent_since = now(),
    notes = coalesce(notes || E'\n\n','') ||
      E'=== PEMICU MENUNGGU DICABUT, 25 Agu 2026 (keputusan pemilik produk) ===\n' ||
      E'Alasannya lebih kuat daripada sekadar tidak menunggu:\n' ||
      E'  "Bila UI Shell dikerjakan sekarang, setiap layar yang dimigrasikan sesudahnya lahir\n' ||
      E'   DI DALAM kerangka yang sudah benar. Bila ditunda, dua belas layar pertama\n' ||
      E'   dimigrasikan di kerangka lama lalu kerangkanya berganti -- dan sebagian perlu\n' ||
      E'   disesuaikan lagi. Kekhawatiran tampilan campur selama peralihan tetap nyata, tapi ia\n' ||
      E'   HILANG SENDIRI seiring migrasi berjalan. Pekerjaan ganda tidak."\n\n' ||
      E'DEVIASI RESMI YANG BERLAKU: LEBAR PENUH. Isi tidak dibatasi lebar grid Carbon.\n' ||
      E'Alasan: ERP padat data; membuang ruang kiri-kanan membuat kolom terpotong lebih cepat,\n' ||
      E'dan memotong kolom diam-diam sudah jadi cacat berulang (RSP-01, RSP-02).\n' ||
      E'HANYA menyentuh LEBAR. Tinggi header/side nav, padding bertoken, perilaku menu di layar\n' ||
      E'sempit, SkipToContent, dan fokus keyboard TETAP Carbon.\n\n' ||
      E'ISI HALAMAN TIDAK DISENTUH. Kerangka diganti, isi tetap. Konsekuensi yang WAJIB\n' ||
      E'disampaikan ke pemilik produk setelah selesai: selama peralihan, kerangka Carbon akan\n' ||
      E'membungkus isi yang sebagian besar belum Carbon. Itu akan terlihat campur, dan itu\n' ||
      E'DISENGAJA -- bukan pekerjaan yang belum selesai.'
  where task_code = 'DS-04';

  if not exists (select 1 from build_tasks where task_code = 'AUD-35') then
    insert into build_tasks (company_id, task_code, name, module_code, module_name, description,
      effect_description, urgency, status, origin, pic, detail_pekerjaan, notes)
    values (v_company_id, 'AUD-35',
      'Layar Setelan Perhitungan Tidak Bisa Dibuka Sama Sekali',
      'MST', 'Master Data',
      'Halaman /company/setelan mengalihkan ke /login meskipun pengguna sudah masuk.',
      'Satu-satunya jalur tulis untuk 17 setelan yang menentukan seluruh angka biaya TIDAK BISA DICAPAI.',
      'super_urgent', 'menunggu', 'temuan_claude', 'Claude Code',
      E'SetelanPerhitunganPage memanggil fetch(''/api/company/settings'') TANPA header\n' ||
      E'Authorization. getCurrentUser hanya menerima Bearer token; parseBearerToken melempar\n' ||
      E'galat bila header tidak ada, dan TIDAK ADA jalur cookie. API menjawab 401, lalu halaman\n' ||
      E'itu sendiri memanggil router.replace(''/login'').\n' ||
      E'Perbaikannya mengikuti pola yang sudah dipakai seluruh halaman lain: ambil access_token\n' ||
      E'dari sesi Supabase, kirim sebagai Bearer.',
      E'DITEMUKAN 25 Agu 2026 lewat audit navigasi, dengan MEMBUKA halamannya dalam keadaan\n' ||
      E'sudah masuk memakai tenant fixture.\n\n' ||
      E'KENAPA TIDAK KETAHUAN LEBIH AWAL, dan ini bagian yang paling perlu diingat:\n' ||
      E'seluruh pemeriksaan layar ini dilakukan terhadap CSS HASIL BUILD dan KODE SUMBER --\n' ||
      E'tipografi, jarak, sudut, token, semuanya benar dan semuanya terukur. Yang TIDAK PERNAH\n' ||
      E'dilakukan adalah membuka halamannya dalam keadaan sudah masuk.\n' ||
      E'Pengukuran membuktikan GAYANYA benar. Ia tidak bisa membuktikan halamannya BISA DIBUKA.\n\n' ||
      E'Test MST-26 tetap hijau karena ia menguji lapisan SERVER dan mengirim Bearer token\n' ||
      E'sendiri -- batas itu memang sudah ditulis di kepala berkas testnya, dan ternyata batas\n' ||
      E'itu persis tempat cacatnya bersembunyi.\n\n' ||
      E'Pemilik produk sempat diminta memeriksa layar ini DUA KALI. Keduanya mustahil berhasil.');
  end if;

  if not exists (select 1 from build_tasks where task_code = 'AUD-36') then
    insert into build_tasks (company_id, task_code, name, module_code, module_name, description,
      effect_description, urgency, status, origin, pic, detail_pekerjaan, notes)
    values (v_company_id, 'AUD-36',
      'Membuka Halaman Kesiapan AI MENULIS Baris Tanpa Ditekan Apa Pun',
      'AUD', 'Audit & Governance',
      'Membuka /ai-readiness menulis 6 baris ke ai_capability_status. Nol tombol ditekan.',
      'Kelas cacat "aksi yang terlihat read-only tapi menulis" -- KEJADIAN KETIGA di proyek ini.',
      'mendesak', 'menunggu', 'temuan_claude', 'Claude Code',
      E'1. Pindahkan penulisan snapshot ke aksi yang DISENGAJA, bukan ke pemuatan halaman.\n' ||
      E'2. Periksa halaman sekelasnya: /ai-project, /process-mining, /kpi.\n' ||
      E'3. Perbarui prosedur pembersihan fixture -- ia menghapus users lalu companies, dan tidak\n' ||
      E'   tahu tabel lain bisa terisi sendiri.',
      E'DITEMUKAN 25 Agu 2026 dengan cara yang tidak disengaja, dan itu bagian yang menarik:\n' ||
      E'perusahaan fixture audit TIDAK BISA DIHAPUS karena tertahan kekangan kunci asing dari\n' ||
      E'ai_capability_status. Yang menemukannya bukan pemeriksaan kode, melainkan PEMBERSIHAN\n' ||
      E'YANG GAGAL.\n\n' ||
      E'Dua kejadian sebelumnya di kelas yang sama: getMarginWatch dan getPlanningFeasibility\n' ||
      E'(Sesi 0/0B/0C), keduanya sudah diperbaiki. Ini yang KETIGA, di tempat berbeda.\n' ||
      E'CLAUDE.md sudah memperingatkan bahwa kelas ini "bisa ada di fitur lain yang belum\n' ||
      E'ditemukan". Ternyata benar.');
  end if;

  if not exists (select 1 from build_tasks where task_code = 'NAV-01') then
    insert into build_tasks (company_id, task_code, name, module_code, module_name, description,
      effect_description, urgency, status, origin, pic, detail_pekerjaan, notes)
    values (v_company_id, 'NAV-01',
      'Arsitektur Navigasi Final — Disusun Setelah Audit, Menunggu Keputusan Urutan',
      'DS', 'Design System',
      'Menyusun konfigurasi navigasi 15 workspace berdasarkan hasil audit, bukan berdasarkan dokumen.',
      'Menentukan apa yang terlihat pengguna sebagai peta sistem.',
      'penting', 'menunggu', 'pemilik_produk', 'Claude Code + Pemilik Produk',
      E'Sumber status WAJIB docs/nav-matriks-status-dan-konflik.md, bukan dokumen IA dan bukan\n' ||
      E'ingatan. Konfigurasi berupa berkas TypeScript bertipe di repo, BUKAN tabel database.',
      E'HASIL AUDIT YANG MENENTUKAN BENTUKNYA:\n' ||
      E'  - Sitemap dokumen memuat ~200 item di 15 workspace; yang punya halaman terverifikasi\n' ||
      E'    HANYA 32. Sekitar 84% belum punya apa pun di baliknya.\n' ||
      E'  - Item menu sekarang yang menunjuk halaman tidak ada: NOL. Kondisi sehat ini WAJIB\n' ||
      E'    dipertahankan.\n' ||
      E'  - Dokumen IA MELEWATKAN kepegawaian dan absensi sepenuhnya, padahal modul itu sudah\n' ||
      E'    berjalan dan menopang seluruh perhitungan biaya SDM. Menyalin sitemap apa adanya\n' ||
      E'    akan MENGHILANGKAN modul yang sudah dipakai.\n' ||
      E'  - Ketertelusuran lot sudah berjalan di data (lot_genealogy terisi) dan merupakan\n' ||
      E'    syarat BPOM/halal, tapi TIDAK PUNYA SATU LAYAR PUN.\n' ||
      E'  - 20 dari 29 item menu sekarang memakai visible: () => true.\n\n' ||
      E'MENUNGGU KEPUTUSAN: urutan workspace menurut frekuensi pakai harian (D-5), dan pilihan\n' ||
      E'quick-create dari daftar aksi yang terbukti ada (D-6/A.7).');
  end if;
end $$;
