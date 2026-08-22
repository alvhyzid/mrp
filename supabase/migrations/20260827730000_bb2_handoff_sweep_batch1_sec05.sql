-- BB.2 (bertahap, putaran 1) -- sapu HANDOFF.md menyeluruh dari BAWAH
-- (paling lama, Sesi 2A 16 Agu, baris 2660) ke ATAS sampai baris 1863
-- ("ATURAN BAKU MIGRASI", 19 Agu). Hasil: 1 temuan konkret belum jadi
-- task (SEC-05), sisanya sudah selesai/kedaluwarsa (lihat laporan chat
-- untuk rincian lengkap per entri).
insert into public.build_tasks
  (company_id, task_code, name, module_code, module_name, description, effect_description, urgency, tags, pic, status, origin, detail_pekerjaan, notes)
values (
  1, 'SEC-05', 'Perketat is_super_admin_user()/user_has_no_company() dari Parameter UID Bebas', 'SEC', 'Keamanan',
  'Kedua fungsi menerima UID SEMBARANG sebagai parameter (bukan membaca auth.uid() sendiri) -- bisa dipakai menebak status super-admin/company user LAIN kalau UID-nya diketahui. Grant-nya SENGAJA tidak dicabut saat audit keamanan 19 Agu 2026 karena keduanya dipakai di ekspresi RLS policy nyata (is_super_admin_user di 3 policy subscription_plans_*, user_has_no_company di companies_insert_admin) yang berjalan di bawah role authenticated -- mencabut grant akan mematikan pendaftaran company baru & pengelolaan subscription plan untuk SEMUA user.',
  'Risiko rendah tapi nyata: siapa pun yang tahu UID pengguna lain (auth_uid, bukan rahasia besar) bisa menebak status super-admin/company mereka lewat RPC langsung.',
  'penting', array['Keamanan'], 'Claude Code', 'menunggu', 'pemilik_produk',
  'RENCANA PERBAIKAN SUDAH DISETUJUI pemilik produk 19 Agu 2026, sengaja DIJADWALKAN SETELAH pilot SAS001+SAS005 selesai (bukan alasan teknis -- 2 order nyata sedang berjalan saat itu, salah langkah berisiko mematikan RLS untuk SEMUA user). Studi kasus SAS001/SAS005 SUDAH DIHAPUS/digantikan MLVT sejak itu -- PERLU DIKONFIRMASI ke pemilik produk apakah gerbang waktu ini dianggap sudah lewat (pilot lama sudah berakhir, walau lewat pembatalan bukan penyelesaian) sebelum dikerjakan. Langkah rencana (dari HANDOFF, tidak berubah): ubah signature jadi tanpa parameter (baca auth.uid() langsung di dalam fungsi), lalu update SETIAP RLS policy yang memanggilnya dengan signature baru dalam migrasi yang sama, lalu re-test SELURUH suite (terutama alur registrasi & subscription plan) sebelum dianggap aman.',
  'Ditemukan lewat BB.2 (22 Agu 2026, sapu tuntas HANDOFF.md) -- entri tanggal 19 Agu 2026 ("Audit Keamanan Menyeluruh"). Perlu dikonfirmasi arsitek soal gerbang waktunya (lihat detail_pekerjaan), JANGAN diputuskan sendiri.'
);
