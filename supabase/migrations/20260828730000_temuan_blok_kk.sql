-- Tiga temuan blok KK yang sudah ditutup di giliran kerja yang sama (25 Agu 2026).
-- Dicatat sebagai task supaya jejaknya ada, bukan hanya hidup di laporan sesi.

do $mig$
declare v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then return; end if;

  perform pastikan_kode_task_kosong('AUD-39');

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description,
    effect_description, urgency, status, origin, pic, detail_pekerjaan, notes)
  values (v_company_id, 'AUD-39',
    'Basis Data Uji Lokal Tertinggal 92 Migrasi — Pengawasnya Dipasang',
    'AUD', 'Audit & Kepatuhan',
    'Project Supabase untuk test lokal berhenti di 171 migrasi sementara repo sudah 263.',
    'Menentukan apakah test lokal yang merah berarti kode rusak, atau cuma struktur yang belum ada.',
    'penting', 'selesai', 'temuan_claude', 'Claude Code',
    concat_ws(chr(10),
      'SUDAH DIKERJAKAN:',
      '  1. Ke-92 migrasi diterapkan berurutan ke project uji; nol gagal.',
      '  2. tests/setup/assertMigrationsUpToDate.ts dipasang sebagai globalSetup -- menolak',
      '     menjalankan test bila project uji tertinggal, dan MENYEBUT ANGKANYA.',
      '  3. public.daftar_migrasi_terpasang() dibuat, karena skema supabase_migrations tidak',
      '     diekspos PostgREST sehingga pengawasnya tidak bisa membacanya langsung.'),
    concat_ws(chr(10),
      'SEBELAS test lokal gagal; SEMBILAN di antaranya bukan soal kode sama sekali.',
      'Tabel company_settings_history belum ada di project uji, jadi halaman Setelan menjawab',
      '500; empat test lot kedaluwarsa gagal karena strukturnya memang belum dibuat.',
      '',
      'YANG MEMBUAT INI BERBAHAYA: bentuk kegagalannya PERSIS seperti kemunduran kode --',
      'assertion meleset, status 500, angka tidak cocok. Tidak satu pun menyebut bahwa',
      'tabelnya belum ada.',
      '',
      'VERSI PERTAMA PENGAWASNYA SENDIRI TIDAK BERBUNYI: ia membaca tabel di skema yang tidak',
      'diekspos, gagal diam-diam, lalu memilih lanjut. Ketahuan HANYA karena diuji sengaja',
      'dengan satu berkas migrasi palsu -- dan tetap hijau. Contoh kelima kelas',
      '"berhasil tanpa berlaku" di CLAUDE.md, dan yang pertama menimpa PENGAWAS.'));

  perform pastikan_kode_task_kosong('AUD-40');

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description,
    effect_description, urgency, status, origin, pic, detail_pekerjaan, notes)
  values (v_company_id, 'AUD-40',
    'Dua Test Rusak Sendiri: Penjaga yang Menuduh Salah dan Test yang Menulis user_id 1',
    'AUD', 'Audit & Kepatuhan',
    'Dua cacat di lapisan test yang menghasilkan merah palsu, keduanya sudah ditutup.',
    'Menentukan apakah suite bisa dipercaya saat berwarna merah.',
    'penting', 'selesai', 'temuan_claude', 'Claude Code',
    concat_ws(chr(10),
      'SATU: tests/ui_raw_leak_watchdog.test.ts menuduh value={docForm.doc_type} sebagai',
      'kebocoran enum. Bukan: itu nilai kontrol <CarbonSelect>, teks tampilnya dari',
      'text={t.label}. Pengecualiannya sudah ada tapi mencari substring "<select" dalam',
      'jendela TIGA baris -- dua-duanya patah oleh migrasi Carbon (nama komponen berubah,',
      'labelText jadi JSX berbaris-baris). Diperbaiki dengan mencari pembuka elemen terdekat',
      'yang LEKUKANNYA LEBIH DANGKAL. Dibuktikan dua arah.',
      '',
      'DUA: tests/ai_project_dashboard.test.ts menulis answered_by:1, confirmed_by:1 --',
      'angka ditulis langsung, menunjuk pengguna milik PERUSAHAAN LAIN, dan galatnya tidak',
      'diperiksa. Di database yang punya user_id 1 lolos; di yang tidak, ditolak kunci asing',
      'dan terlihat sebagai "progres 0%". Diperbaiki: pakai id milik company fixture-nya,',
      'DAN periksa galatnya.'),
    concat_ws(chr(10),
      'POLA YANG SAMA DI KEDUANYA: test-nya sendiri yang rusak, tapi bentuk kegagalannya',
      'menunjuk ke kode aplikasi. Yang pertama menuduh halaman membocorkan enum; yang kedua',
      'terbaca sebagai cacat perhitungan progres.',
      '',
      'Ini kali KETIGA penjaga di proyek ini menuduh salah lalu diperketat, dan aturannya',
      'sudah tercatat: penjaga yang menuduh salah DIPERKETAT, bukan dilonggarkan atau',
      'diberi pengecualian baris.'));
end $mig$;
