-- Tindak lanjut Bagian II: pertanyaan terbuka (0.15) dan pola yang layak diulang (0.16).

-- ============================================================================
-- 0.15 — PERTANYAAN TERBUKA, jangan diasumsikan selesai.
-- ============================================================================
insert into build_tasks (
  company_id, task_code, name, module_code, module_name, description, effect_description,
  urgency, tags, pic, status, origin, detail_pekerjaan, notes
)
select 1, 'RDM-07',
  'PERTANYAAN TERBUKA: Daftar Tugas — Tabel Berkelompok atau Tabel Rata?',
  'RDM', 'Roadmap Jangka Panjang',
  'Daftar Tugas sudah berubah dari kartu jadi TABEL, tetapi pengelompokan per modul (bisa dibuka-tutup) DIPERTAHANKAN. Belum diketahui apakah pemilik produk lebih suka begitu atau tabel RATA tanpa kelompok.',
  'Menentukan bentuk akhir halaman yang paling sering dibuka pemilik produk. Perubahannya kecil; yang mahal adalah menebak dan salah.',
  'bisa_menunggu',
  array['Visual']::text[],
  'Pemilik Produk',
  'menunggu',
  'temuan_claude',
  E'PERTANYAAN: setelah melihat sendiri hasilnya, lebih enak yang mana — tabel BERKELOMPOK per modul ' ||
  E'(seperti sekarang), atau tabel RATA tanpa kelompok?\n\n' ||
  E'LATAR YANG PERLU DIKETAHUI SEBELUM MENJAWAB: bentuk kartu yang lama lahir dari permintaan pemilik ' ||
  E'produk sendiri — dikelompokkan per modul, bisa dibuka-tutup, supaya tidak jadi gulungan panjang. ' ||
  E'Jadi yang mengganggu kemungkinan BUKAN pengelompokannya, melainkan TINGGI tiap baris karena ' ||
  E'penjelasan ikut tampil. Itu yang sudah diperbaiki: penjelasan sekarang pindah ke baris yang ' ||
  E'dimekarkan.\n\n' ||
  E'JANGAN DIUBAH SEBELUM ADA JAWABAN. Mengubahnya lagi tanpa jawaban berarti menebak dua kali.',
  'Dicatat 24 Agu 2026 saat Daftar Tugas berubah jadi tabel. Sengaja dicatat sebagai task, bukan dianggap selesai begitu pertanyaannya disampaikan di laporan — pertanyaan yang hanya hidup di percakapan terbukti berulang kali hilang di proyek ini.'
where not exists (select 1 from build_tasks where task_code = 'RDM-07' and company_id = 1);

-- ============================================================================
-- 0.16 — POLA YANG BERHASIL: aturan makna dikeluarkan dari komponen supaya bisa diuji.
-- ============================================================================
insert into build_tasks (
  company_id, task_code, name, module_code, module_name, description, effect_description,
  urgency, tags, pic, status, origin, detail_pekerjaan, notes
)
select 1, 'AUD-22',
  'Keluarkan Aturan Makna dari Komponen Tampilan Supaya Bisa Diuji Tanpa Merender',
  'AUD', 'Audit & Proses',
  'Beberapa aturan yang menentukan ARTI (bukan sekadar rupa) masih hidup di dalam berkas komponen, sehingga hanya bisa diuji lewat tampilan — atau tidak diuji sama sekali.',
  'Aturan semacam ini rusak diam-diam saat komponen diutak-atik, dan kerusakannya TIDAK muncul sebagai error — cuma sebagai tampilan yang terasa aneh, yang biasanya tidak ada yang mengadukannya.',
  'bisa_menunggu',
  array['test','ui']::text[],
  'Claude Code',
  'menunggu',
  'temuan_claude',
  E'POLA YANG SUDAH TERBUKTI DAN LAYAK DIULANG (24 Agu 2026): aturan urutan Daftar Tugas dikeluarkan ' ||
  E'ke src/features/mrp/buildTaskSorting.ts, lalu diuji oleh tests/build_task_sorting.test.ts (10 test) ' ||
  E'TANPA merender halaman sama sekali. Test itu juga sudah DIBUKTIKAN BISA MERAH.\n\n' ||
  E'HASIL PEMERIKSAAN — yang masih terikat ke komponen:\n' ||
  E'1. Warna & penanda status Daftar Tugas (STATUS_BADGE, STATUS_EXTRA_CLASS) di BuildTasksPage.tsx.\n' ||
  E'2. Garis tepi urgensi (URGENCY_BORDER) di BuildTasksPage.tsx.\n' ||
  E'3. Warna status PO (poStatusVariant) di PurchasingPage.tsx — peta warna KEDUA di berkas berbeda; ' ||
  E'periksa apakah keduanya perlu disatukan atau memang beda arti.\n' ||
  E'4. Perhitungan persentase kemajuan per modul — masih inline di dalam JSX, belum diuji.\n\n' ||
  E'YANG TERNYATA SUDAH AMAN, jadi JANGAN dipindahkan: penanda aman-paralel BUKAN aturan komponen — ' ||
  E'dihitung di server (getBuildTasks.ts) dan SUDAH diuji di tests/build_tasks.test.ts.\n\n' ||
  E'BATAS: JANGAN pindahkan semua sekaligus. Tiap pemindahan adalah kesempatan memperkenalkan bug ke ' ||
  E'layar yang sedang baik-baik saja. Kerjakan satu per satu, masing-masing dengan test yang dibuktikan ' ||
  E'bisa merah lebih dulu.',
  'Dicatat 24 Agu 2026. Nomor 3 (dua peta warna status di dua berkas) berpotensi jadi temuan tersendiri bila ternyata artinya sama — dua sumber kebenaran untuk satu hal adalah kelas masalah yang sudah berulang di proyek ini.'
where not exists (select 1 from build_tasks where task_code = 'AUD-22' and company_id = 1);
