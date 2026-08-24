-- HH.3 / HH.4 / HH.5 — AUD-21 ditutup sebagian, kejadian pertama jadi task sendiri.

update build_tasks
set status = 'selesai', completed_at = now(),
    name = 'Kegoyahan Suite: Pengguna Auth Yatim Menjatuhkan Run Berikutnya (SEBAB DITEMUKAN & DITUTUP)',
    detail_pekerjaan = detail_pekerjaan || E'\n\n' ||
      E'=== SEBAB DITEMUKAN LEWAT REPRODUKSI, LALU DITUTUP (24 Agu 2026) ===\n\n' ||
      E'10 berkas test memakai `u.data.user!.id` TANPA memeriksa galat createUser. Bila pengguna auth ' ||
      E'dengan email itu masih ada dari run sebelumnya (run terputus / pembersihan gagal sebagian), ' ||
      E'Supabase menjawab "email already registered", `data.user` bernilai null, dan tanda seru ' ||
      E'menutupinya sampai `.id` meledak.\n\n' ||
      E'DIBUKTIKAN, BUKAN DIDUGA: pengguna auth yatim dibuat manual, berkas dijalankan, galat SAMA ' ||
      E'PERSIS muncul. Setelah diperbaiki, kondisi yang sama menghasilkan 8/8 LULUS.\n\n' ||
      E'PERBAIKAN: pola tangguh (yang sudah dipakai 23 berkas lain) dijadikan SATU helper bersama ' ||
      E'tests/ensureAuthUser.ts, menggantikan 15 titik rapuh di 10 berkas. Bukan menyalin pola sepuluh ' ||
      E'kali — supaya berkas ke-34 yang lahir bulan depan tidak perlu mengingatnya.\n\n' ||
      E'DUA KEPUTUSAN DI DALAM HELPER, keduanya disetujui pemilik produk:\n' ||
      E'  (a) Galat SELAIN "sudah terdaftar" TIDAK ditelan. Menelan semuanya berarti mengganti satu ' ||
      E'kegoyahan dengan kegoyahan lain yang LEBIH SULIT DILIHAT.\n' ||
      E'  (b) Batas pencarian 100 -> 200 dengan penelusuran halaman. JUJUR: ini BUKAN penyebab hari ini ' ||
      E'(project CI hanya berisi 8 pengguna auth) — dugaan itu diperiksa dan GUGUR. Tapi batas 100 akan ' ||
      E'terlampaui diam-diam saat jumlah pengguna tumbuh, dan kegagalannya akan terlihat PERSIS seperti ' ||
      E'kegoyahan ini lagi. Contoh penerapan aturan "periksa contoh sekelas": bom yang belum meledak ' ||
      E'tetap dijinakkan.\n\n' ||
      E'CATATAN PENTING: yang ditutup hanya KEJADIAN KEDUA (baseline_lock_separation). Kejadian PERTAMA ' ||
      E'(ai_project_dashboard) TETAP TERBUKA sebagai AUD-26 — gejalanya berbeda dan berkas itu sudah ' ||
      E'memakai pola tangguh, jadi belum tentu sebabnya sama.'
where task_code = 'AUD-21' and company_id = 1;

insert into build_tasks (
  company_id, task_code, name, module_code, module_name, description, effect_description,
  urgency, tags, pic, status, origin, detail_pekerjaan, notes
)
select 1, d.kode, d.nama, 'AUD', 'Audit & Proses', d.deskripsi, d.efek, d.urgensi,
  array['test','ci']::text[], 'Claude Code', 'menunggu', 'temuan_claude', d.detail, d.catatan
from (values
(
  'AUD-26',
  'ai_project_dashboard Goyah dengan Gejala BERBEDA — Sebabnya Belum Diketahui',
  'Berkas ini gagal 4 test dalam satu run suite penuh, lalu lulus 7/7 sendirian. Gejalanya BERBEDA dari kegoyahan yang sudah dipecahkan di AUD-21.',
  'Selama sebabnya belum diketahui, tidak ada dasar menyatakan kegoyahan suite sudah selesai — dan test goyah melatih orang mengabaikan merahnya.',
  'penting',
  E'GEJALA PERSIS (24 Agu 2026): HTTP 404 pada endpoint yang seharusnya menemukan tugas hasil seed, ' ||
  E'dan snapshot terhitung 0 padahal seharusnya 2. Arahnya: baris hasil seed TIDAK ADA saat berkas ' ||
  E'itu berjalan di dalam suite.\n\n' ||
  E'KENAPA BUKAN SEBAB YANG SAMA DENGAN AUD-21: AUD-21 disebabkan `data.user!.id` tanpa pemeriksaan ' ||
  E'galat pada 10 berkas. Berkas INI TIDAK termasuk 10 itu — ia SUDAH memakai pola tangguh ("already ' ||
  E'been registered" + cadangan listUsers). Dan gejalanya bukan null.id, melainkan baris data hilang.\n\n' ||
  E'CARA MEMERIKSA yang disarankan: jalankan suite penuh dengan pencatatan urutan berkas, lalu periksa ' ||
  E'berkas mana yang berjalan TEPAT SEBELUM ai_project_dashboard pada run yang gagal, dan bandingkan ' ||
  E'pembersihannya.\n\n' ||
  E'ATURAN PENUTUPAN: bila setelah sekian waktu tidak pernah muncul lagi, tutup dengan alasan ' ||
  E'"TIDAK BERULANG" — BUKAN "sudah diperbaiki". Keduanya berbeda dan bedanya penting.',
  'Dipisah dari AUD-21 atas keputusan pemilik produk: tidak mengklaim satu penyebab menjelaskan dua kejadian hanya karena keduanya terjadi di hari yang sama.'
),
(
  'AUD-27',
  'Pembersihan Mandiri Test BUTA terhadap Pengguna Auth (Sisa yang Menjatuhkan Run Berikutnya)',
  'tests/testCompanyCleanup.ts menyapu sendiri tabel mana pun yang punya kolom company_id, tetapi TIDAK menyentuh auth.users sama sekali — dan tidak bisa, karena tabel itu tidak punya company_id.',
  'Helper yang dibangun khusus agar tangguh terhadap "lupa satu tabel" secara STRUKTURAL buta terhadap justru sisa yang menyebabkan AUD-21. Pembersihan pengguna auth sepenuhnya bergantung pada afterAll tiap berkas — bila run terputus, sisanya menjatuhkan run berikutnya.',
  'penting',
  E'YANG PERLU DIPERIKSA (jangan langsung bangun): apakah helper bersama sebaiknya ikut menyapu ' ||
  E'pengguna auth berdasarkan pola email fixture (mis. %@debug.mrp yang bukan milik 8 pengguna dasar), ' ||
  E'ATAU cukup mengandalkan helper ensureAuthUser yang kini menjadikan sisa auth TIDAK BERBAHAYA.\n\n' ||
  E'ARGUMEN UNTUK TIDAK MENYAPU: setelah ensureAuthUser dipakai seluruh berkas, pengguna auth yatim ' ||
  E'tidak lagi menjatuhkan siapa pun — ia cuma menumpuk. Menyapu berdasarkan pola email berisiko ' ||
  E'menghapus 8 pengguna dasar bila polanya keliru, dan itu merusak SELURUH suite.\n\n' ||
  E'ARGUMEN UNTUK MENYAPU: sisa yang menumpuk akan melewati batas pencarian halaman suatu saat, dan ' ||
  E'kelas kegagalannya kembali.\n\n' ||
  E'HH.5 juga menanyakan JENIS SISA LAIN dari run terputus (company, plant, item, lot). Hasil ' ||
  E'pemeriksaan 24 Agu 2026: sisa berupa BARIS TABEL memang tertangkap sapuan generik helper (ia ' ||
  E'mencari sendiri seluruh tabel ber-company_id lewat PostgREST, bukan daftar tulis tangan). Yang ' ||
  E'lolos hanya yang TIDAK punya company_id — dan auth.users adalah contoh utamanya.',
  'Ditemukan 24 Agu 2026 saat menelusuri akar AUD-21. Terkait QA-01 yang sudah ditutup — QA-01 memperbaiki sisa BARIS TABEL, bukan sisa pengguna auth.'
)
) as d(kode, nama, deskripsi, efek, urgensi, detail, catatan)
where not exists (select 1 from build_tasks b where b.task_code = d.kode and b.company_id = 1);
