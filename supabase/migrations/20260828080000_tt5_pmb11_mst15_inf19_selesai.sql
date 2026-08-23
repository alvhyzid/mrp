-- Penutupan INF-19, PMB-11, MST-15 + satu temuan baru jadi task (RSP-01).
--
-- Aturan proyek: setiap temuan yang butuh tindakan WAJIB jadi task tercatat di giliran
-- kerja yang sama. Temuan RSP-01 di bawah lahir saat verifikasi visual MST-15, dan
-- dicatat di sini supaya tidak menguap seperti temuan-temuan audit sebelumnya.

-- INF-19 — CI hijau di project test terpisah.
-- Ditutup dengan bukti, bukan asumsi: run CI commit 8a223b4 HIJAU di kedua job
-- (Typecheck & Test Suite, Rebuild Schema from Migrations), termasuk langkah pengawas
-- ambang. 46 berkas, 275 test lulus, 7 dilewati sadar, 0 gagal.
--
-- Akar penyebab yang sebenarnya ternyata DUA, ditemukan berurutan lewat reproduksi:
--   1. NEXT_PUBLIC_SUPABASE_URL dan kunci menunjuk project yang BERBEDA. Gejalanya
--      menyesatkan: hanya berkas tanpa beforeAll yang gagal, sisanya tampil "dilewati".
--   2. Setelah itu diperbaiki, muncul kegagalan KEDUA yang berbeda sifatnya: Edge
--      Function custom-access-token (Auth Hook) melewati batas 5 detik milik Supabase
--      Auth. Batas itu MILIK SERVER -- tidak bisa dinaikkan dari konfigurasi vitest,
--      dan itulah sebabnya percobaan menaikkan hookTimeout tidak pernah berpengaruh.
update build_tasks
set status = 'selesai',
    completed_at = now(),
    notes = coalesce(notes || E'\n\n', '') ||
      '23-24 Agu 2026 — DITUTUP. CI hijau di fabrix-ci-test (commit 8a223b4, kedua job sukses). ' ||
      'Dua akar penyebab berurutan: (1) URL dan kunci menunjuk project berbeda; (2) Auth Hook ' ||
      'melewati batas 5 detik milik Supabase Auth saat latensi melonjak. Penanganan: pengawas ' ||
      'URL-kunci (tests/setup/assertUrlAndKeysMatch.ts), pemanasan Edge Function, dan pengulangan ' ||
      'login bercakupan sempit (tests/setup/retryAuthHookColdStart.ts). ' ||
      'ALLOW_TESTS_AGAINST_REAL_PROJECT sudah dicabut dari CI dan CI tetap hijau tanpanya.'
where task_code = 'INF-19' and company_id = 1;

-- PMB-11 — modal Supplier sebagai CETAKAN modal.
update build_tasks
set status = 'selesai',
    completed_at = now(),
    notes = coalesce(notes || E'\n\n', '') ||
      '24 Agu 2026 — SELESAI, terverifikasi visual di 360/768/1280/1920 px. Anatomi Carbon ' ||
      '(Header berlabel + Body menggulir + Footer lebar penuh) dipasang sebagai kelas bersama di ' ||
      'src/components/ui/dialog.tsx (carbonModalContent/carbonModalHeader/DialogBody), bukan ' ||
      'kelas yang disalin per layar. Modal jadi layar penuh di HP. Pembuatan data baru lewat ' ||
      'tahap ringkasan draf lebih dulu; kolom kosong ditampilkan "belum diisi" supaya terlihat ' ||
      'juga apa yang TIDAK akan tersimpan. Placeholder tidak lagi memuat contoh/instruksi. ' ||
      'KEPUTUSAN TEKNIS yang perlu dikoreksi bila salah: tahap ringkasan HANYA untuk data baru, ' ||
      'tidak untuk mengubah data lama (saat mengubah, pengguna sudah melihat nilai lama di form). ' ||
      'Padding modal lama SENGAJA tidak dijadikan bawaan komponen -- itu akan membuat semua modal ' ||
      'lama berpadding dobel sekaligus; migrasinya bertahap.'
where task_code = 'PMB-11' and company_id = 1;

-- MST-15 — tiga perbaikan formulir item.
update build_tasks
set status = 'selesai',
    completed_at = now(),
    notes = coalesce(notes || E'\n\n', '') ||
      '24 Agu 2026 — SELESAI, terverifikasi visual di 360/768/1280/1920 px. ' ||
      '(B.1) Faktor konversi kini punya pola siap-pilih (kg->g, ton->kg, liter->ml, dus->pcs, ' ||
      'roll->pcs, satuan sama) plus penjelasan arah konversinya; kolom angkanya tetap bisa diisi ' ||
      'bebas. Daftar polanya sengaja pendek dan berisi satuan yang benar-benar dipakai hari ini, ' ||
      'bukan tabel konversi universal. ' ||
      '(B.2) Ikon tanda tanya per kolom lewat komponen FieldLabel (src/components/ui/field-help.tsx). ' ||
      'Dibuka dengan KLIK, bukan hover -- hover tidak bisa dipakai di layar sentuh, dan aplikasi ini ' ||
      'dipakai lewat HP/tablet di lantai produksi. Terpasang di Satuan Dasar, Satuan Beli, Faktor ' ||
      'Konversi, No. BPOM, dan Kode Halal. ' ||
      '(B.3) Kode Halal ditambahkan di sebelah No. Registrasi BPOM ' ||
      '(kolom items.halal_certificate_number, migrasi 20260828070000, OPSIONAL).'
where task_code = 'MST-15' and company_id = 1;

-- TEMUAN BARU jadi task — RSP-01.
--
-- Ditemukan saat verifikasi visual MST-15, dan SUDAH DIBUKTIKAN BUKAN akibat perubahan
-- MST-15: dengan perubahan itu dikembalikan sementara (git stash), gulir menyamping tetap
-- muncul. Jadi ini utang responsive yang sudah ada sebelumnya, bukan regresi baru.
insert into build_tasks (
  company_id, task_code, name, module_code, module_name, description, effect_description,
  urgency, tags, pic, status, origin, detail_pekerjaan, notes
)
select 1, 'RSP-01',
  'Tabel Item Master Meluber di Layar Sempit (Belum Jadi Kartu Bertumpuk)',
  'MST', 'Master Data',
  'Di lebar 360 px, halaman Item Master menghasilkan gulir menyamping: lebar isi terukur 461 px ' ||
  'terhadap layar 360 px. Penyebabnya tabel banyak kolom yang belum berubah bentuk jadi kartu ' ||
  'bertumpuk saat layar menyempit, sebagaimana diwajibkan aturan responsive proyek.',
  'Pengguna di HP harus menggeser layar ke samping untuk membaca daftar item, dan aturan proyek ' ||
  'menyatakan gulir menyamping tidak boleh ada di lebar mana pun.',
  'penting',
  array['responsive', 'ui'],
  'Claude Code',
  'menunggu',
  'temuan_claude',
  'Ubah tabel Item Master jadi kartu bertumpuk di layar sempit (satu baris = satu kartu, kolom ' ||
  'tersusun ke bawah), sesuai pola yang sudah ditetapkan di CLAUDE.md. Kolom yang tidak penting ' ||
  'boleh disembunyikan di layar sempit TAPI harus tetap ada jalan untuk melihatnya. Verifikasi ' ||
  'dengan bukti visual di 360/768/1280/1920 px.',
  'Ditemukan 24 Agu 2026 saat verifikasi visual MST-15. TERBUKTI BUKAN regresi dari MST-15: ' ||
  'dengan perubahan MST-15 dikembalikan sementara, gulir menyamping tetap terukur 461 px. ' ||
  'Catatan pengukuran: gejalanya tidak muncul di setiap kali pemuatan -- diduga bergantung pada ' ||
  'apakah data tabel sudah termuat saat diukur, jadi ukur beberapa kali sebelum menyatakan sembuh.'
where not exists (select 1 from build_tasks where task_code = 'RSP-01' and company_id = 1);
