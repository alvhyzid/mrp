-- MM (24 Agu 2026) — DUA BATAS PENCADANGAN JADI TASK, PELAJARAN JADI ATURAN,
-- dan pola "suite tumpang tindih" diakui sebagai pola setelah kejadian kedua.

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
-- MM.1 — SEC-13: peringatan "jangan cabut sebelum penggantinya bekerja".
-- ============================================================================
update build_tasks set
  notes = coalesce(notes || E'\n\n', '') ||
    E'PERINGATAN YANG DITERIMA PEMILIK PRODUK, 24 Agu 2026 (MM.1): "JANGAN cabut flag pelolos ' ||
    E'sebelum penggantinya bekerja, atau pemeriksa integritas mati tanpa ada yang memberi tahu."\n\n' ||
    E'Ini kelas bahaya tersendiri, bukan sekadar kehati-hatian: pengaman yang dicabut lebih dulu ' ||
    E'daripada penggantinya siap menghasilkan LUBANG YANG TIDAK BERBUNYI. Tidak ada yang gagal, ' ||
    E'tidak ada yang merah, tidak ada sinyal apa pun bahwa perlindungannya sudah hilang -- ia baru ' ||
    E'ketahuan saat hal yang dijaganya benar-benar terjadi.\n\n' ||
    E'Dinaikkan jadi aturan umum di CLAUDE.md ("Pengaman Lama Dicabut HANYA Setelah Penggantinya ' ||
    E'Terbukti Bekerja"), berlaku untuk aturan lama, pengawas lama, kolom lama, dan jalur lama -- ' ||
    E'bukan hanya untuk flag ini.'
where task_code = 'SEC-13';

-- ============================================================================
-- MM.2a — PITR: keputusan biaya milik pemilik produk, bukan keputusan teknis.
-- ============================================================================
insert into build_tasks (
  company_id, task_code, name, module_code, module_name, description, effect_description,
  urgency, tags, pic, status, origin, detail_pekerjaan,
  approval_review_steps, approval_location, approval_example_case, approval_options,
  approval_if_approved, approval_if_rejected
) values (
  v_company_id, 'INF-24', 'Pemulihan Titik-Waktu (PITR) Belum Aktif — Bisa Kehilangan Setengah Hari Kerja', 'INF', 'Infrastruktur & Environment',
  'Pencadangan Supabase yang aktif hanya potret HARIAN, dibuat sekitar pukul 04:00 WIB. Pemulihan titik-waktu (PITR) tidak menyala.',
  'Bila data terhapus keliru pada siang hari, titik pemulihan terdekat adalah pagi hari itu. Seluruh pekerjaan sejak pagi -- input produksi, penerimaan barang, absensi -- ikut hilang dan harus dimasukkan ulang dari ingatan.',
  'penting', array['infrastruktur','pencadangan','biaya'], 'Pemilik Produk', 'menunggu_persetujuan', 'temuan_claude',
  E'KEADAAN HARI INI, diperiksa langsung 24 Agu 2026 lewat Management API:\n' ||
  E'  pitr_enabled = false, 8 cadangan harian tersimpan, terlama 17 Agu, terbaru 24 Agu 04:03 WIB.\n\n' ||
  E'YANG WAJIB DIKETAHUI SEBELUM MEMUTUSKAN -- keduanya SALING MENIADAKAN, bukan saling melengkapi. ' ||
  E'Dokumentasi resmi Supabase: "If you enable PITR, we will no longer take Daily Backups." Jadi ' ||
  E'menyalakan PITR MENGHENTIKAN pencadangan harian yang sekarang berjalan. Ini temuan lama (DD.1) ' ||
  E'yang sengaja diulang di sini supaya tidak perlu ditemukan dua kali.\n\n' ||
  E'BIAYA: PITR adalah tambahan berbayar di paket Pro. Angkanya TIDAK dicantumkan di sini karena ' ||
  E'tidak bisa diperiksa dari sisi Claude Code -- halaman penagihan sengaja tidak dibuka lewat token ' ||
  E'tersimpan, sesuai aturan tetap proyek. Pemilik produk bisa melihatnya di Supabase Dashboard > ' ||
  E'Project Settings > Add-ons.\n\n' ||
  E'PERTIMBANGAN JUJUR: selama sistem belum dipakai sepanjang hari oleh banyak orang, kehilangan ' ||
  E'setengah hari kerja masih bisa dimasukkan ulang. Begitu produksi harian benar-benar dicatat di ' ||
  E'sistem, biaya kehilangan itu naik jauh lebih cepat daripada biaya langganannya.',
  'Buka Supabase Dashboard > Project Settings > Add-ons untuk melihat biaya PITR. Timbang terhadap: berapa banyak pekerjaan yang akan hilang bila data rusak siang hari, dan seberapa sanggup memasukkannya ulang.',
  'Supabase Dashboard > project FABRIX-APP > Project Settings > Add-ons (biaya), dan Database > Backups (keadaan cadangan sekarang).',
  E'Contoh nyata yang membuat pilihan ini terasa: seorang staf gudang salah menghapus penerimaan barang pukul 14.00. Dengan keadaan sekarang, titik pemulihan terdekat adalah pukul 04.03 pagi itu -- seluruh penerimaan, pemakaian produksi, dan absensi sejak pagi ikut hilang bila cadangan itu dipulihkan. Dengan PITR, sistem bisa dikembalikan ke pukul 13.59, satu menit sebelum kekeliruannya.',
  'a. Nyalakan PITR (cadangan harian berhenti, diganti pemulihan ke titik waktu mana pun). b. Tetap dengan cadangan harian saja (gratis, risiko kehilangan sampai satu hari kerja). c. Tunda sampai produksi harian benar-benar dicatat di sistem.',
  'Claude Code menyiapkan langkahnya dan memverifikasi PITR benar-benar aktif setelahnya, serta memastikan pemilik produk tahu cadangan harian sudah berhenti.',
  'Keadaan tetap seperti sekarang. Task ditandai ditunda dengan pemicu: ditinjau ulang begitu input produksi harian mulai rutin masuk sistem.'
) on conflict (company_id, task_code) do nothing;

-- ============================================================================
-- MM.2b — INF-16: ekspor berkas jangan bergantung pada ingatan.
-- ============================================================================
update build_tasks set
  notes = coalesce(notes || E'\n\n', '') ||
    E'ARAHAN PEMILIK PRODUK 24 Agu 2026 (MM.2b): "Ekspor yang bergantung pada ingatan akan gagal ' ||
    E'suatu saat." Ekspor berkas Storage yang baru dibuat memang menutup lubangnya, TAPI ia manual.\n\n' ||
    E'YANG DIMINTA: jadwalkan otomatis dengan MENUMPANG jadwal yang SUDAH ADA -- JANGAN membangun ' ||
    E'penjadwal ketiga.\n\n' ||
    E'JADWAL YANG SUDAH ADA DAN COCOK: .github/workflows/backup-db.yml, berjalan harian lewat cron ' ||
    E'18:00 UTC (01:00 WIB). Diperiksa 24 Agu 2026: 6 kali dijalankan, dua terakhir (22 & 23 Agu) ' ||
    E'lewat jadwal dan keduanya berhasil. Workflow itu sudah punya langkah "Verifikasi dump tidak ' ||
    E'kosong & berisi data" -- pola yang sama dipakai untuk berkas: hitung berkas tersalin, gagalkan ' ||
    E'bila nol padahal Storage tidak kosong.\n\n' ||
    E'YANG TIDAK BISA DIPASTIKAN DARI SINI, dan pemilik produk yang harus memeriksanya: workflow itu ' ||
    E'memakai rahasia SUPABASE_PROJECT_REF, yang BERBEDA dari rahasia yang dipakai CI. Nilainya tidak ' ||
    E'bisa dibaca dari sisi Claude Code, jadi TIDAK BISA DIPASTIKAN apakah ia masih menunjuk FABRIX-APP ' ||
    E'atau ikut teralih ke project CI saat rahasia CI diubah. Bila ia ikut teralih, pencadangan harian ' ||
    E'selama ini mencadangkan project yang SALAH dan itu mendesak. Periksa di GitHub > Settings > ' ||
    E'Secrets and variables > Actions, bandingkan SUPABASE_PROJECT_REF dengan ref FABRIX-APP ' ||
    E'(kfvtrwuuqcjfkkuqizxt).'
where task_code = 'INF-16';

-- ============================================================================
-- MM.5 — SUITE TUMPANG TINDIH: kejadian kedua, akibatnya nyata.
-- ============================================================================
insert into build_tasks (
  company_id, task_code, name, module_code, module_name, description, effect_description,
  urgency, tags, pic, status, origin, detail_pekerjaan
) values (
  v_company_id, 'QA-03', 'Pastikan Suite Sebelumnya Benar-Benar Mati Sebelum Menjalankan yang Baru', 'AUD', 'Audit & Proses',
  'Dua kali terjadi dua jalankan suite penuh berjalan bersamaan di atas satu database dan satu berkas .env.local. Keduanya berawal dari kesimpulan manual "yang pertama sudah selesai" yang ternyata salah.',
  'Fixture dua jalankan bertabrakan: pembersihan salah satu gagal dan meninggalkan sisa. Lebih buruk, penyebab kegagalan jadi sulit dibaca karena dua jalankan menulis ke database yang sama.',
  'penting', array['proses','test','fixture'], 'Claude Code', 'menunggu', 'temuan_claude',
  E'DUA KALI SUDAH CUKUP UNTUK MENYEBUTNYA POLA:\n' ||
  E'  1. 23 Agu 2026 -- dua jalankan bersamaan membuat dua company bernama kembar dibuat berjarak 7 detik; CI merah beruntun.\n' ||
  E'  2. 24 Agu 2026 -- berkas keluaran dibaca terlalu dini (baru terisi 3 baris dari jalankan yang butuh 15 menit), disimpulkan "mati", lalu .env.local yang sedang DIPINJAMNYA dipulihkan dan jalankan kedua dinyalakan. Akibat nyata: MarginWatchTestCorp tertinggal karena pembersihannya bertabrakan.\n\n' ||
  E'AKAR YANG SAMA DI KEDUANYA: keputusan "sudah selesai atau belum" diambil dari MENAFSIRKAN keluaran, ' ||
  E'bukan dari tanda yang tidak bisa salah baca. Keluaran yang belum selesai ditulis terlihat persis ' ||
  E'seperti keluaran yang berhenti.\n\n' ||
  E'DUA PILIHAN, keduanya tidak bergantung pada tafsiran manusia:\n' ||
  E'  A. BERKAS KUNCI: suite membuat berkas kunci saat mulai dan menghapusnya saat selesai (termasuk ' ||
  E'     saat gagal). Jalankan baru menolak start bila kuncinya masih ada, dan menyebutkan sejak kapan.\n' ||
  E'  B. PEMERIKSAAN PROSES: sebelum start, periksa apakah masih ada proses vitest berjalan.\n\n' ||
  E'YANG LEBIH BAIK: A. Pemeriksaan proses gagal mengenali jalankan yang dijalankan dari sesi/terminal ' ||
  E'lain dengan nama proses berbeda, sedangkan berkas kunci berlaku untuk siapa pun yang memulainya. ' ||
  E'Berkas kunci juga bisa MENYEBUTKAN sejak kapan dan oleh apa -- pesan yang bisa ditindaklanjuti, ' ||
  E'bukan sekadar penolakan.\n\n' ||
  E'CATATAN: kunci HARUS terhapus juga saat suite gagal/dihentikan, atau ia berubah jadi penghalang ' ||
  E'permanen yang orang akan belajar mengabaikannya -- dan pengaman yang biasa diabaikan lebih buruk ' ||
  E'daripada tidak ada.'
) on conflict (company_id, task_code) do nothing;

end $$;
