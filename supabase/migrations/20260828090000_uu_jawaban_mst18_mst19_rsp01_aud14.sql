-- Blok UU — jawaban pemilik produk atas MST-18 & MST-19, urgensi RSP-01, dan satu
-- temuan proses (AUD-14).

-- ============================================================================
-- MST-18 — SHELF LIFE: angka + dropdown satuan. KATEGORI DITOLAK.
--
-- Keputusan pemilik produk (24 Agu 2026): usulan arsitek DITERIMA. Isian berupa
-- angka + dropdown satuan (hari/minggu/bulan/tahun), tersimpan dalam HARI.
--
-- ALASAN PENOLAKAN KATEGORI, dan ini yang paling penting untuk diingat:
-- kategori (Pendek/Menengah/Panjang) AKAN MEMATIKAN FEFO. FEFO (First Expired,
-- First Out) mengurutkan lot berdasarkan tanggal kedaluwarsa yang sesungguhnya.
-- Kalau shelf life hanya "Menengah", tanggal kedaluwarsa tidak bisa dihitung, dan
-- urutan pengeluaran stok kehilangan dasarnya. Ini bukan soal selera tampilan —
-- kategori menghapus angka yang jadi dasar sebuah aturan gudang yang sudah jalan.
-- ============================================================================
update build_tasks
set detail_pekerjaan =
      'KEPUTUSAN PEMILIK PRODUK (24 Agu 2026) — usulan arsitek DITERIMA, kategori DITOLAK. ' ||
      'Isian: angka + dropdown satuan (hari / minggu / bulan / tahun). Disimpan dalam HARI di ' ||
      'kolom shelf_life_days yang sudah ada (tidak berubah), jadi FEFO tetap hidup. Contoh: ' ||
      'pengguna mengetik "6" lalu memilih "bulan" -> tersimpan 180 hari. ' ||
      'ALASAN KATEGORI DITOLAK: kategori (Pendek/Menengah/Panjang) MEMATIKAN FEFO, karena tanggal ' ||
      'kedaluwarsa tidak bisa lagi dihitung dari sebuah rentang. ' ||
      'Saat menampilkan kembali nilai yang tersimpan, pilih satuan terbesar yang membagi habis ' ||
      'angkanya supaya tidak menampilkan "180 hari" untuk sesuatu yang diisi sebagai "6 bulan". ' ||
      'SIAP DIKERJAKAN — tidak ada lagi yang ditunggu.',
    notes = coalesce(notes, '') ||
      E'\n\n24 Agu 2026 — DIJAWAB pemilik produk lewat arsitek. Status "MENUNGGU KEPUTUSAN" dicabut. ' ||
      'Catatan: jawabannya sempat TIDAK sampai ke Daftar Tugas ini (lihat AUD-14).',
    urgency = 'penting'
where task_code = 'MST-18' and company_id = 1;

-- ============================================================================
-- MST-19 — MIN STOCK LEVEL sebagai PERSEN DARI JUMLAH YANG PERNAH MASUK.
--
-- Keputusan pemilik produk (24 Agu 2026): persen dihitung dari JUMLAH YANG PERNAH
-- MASUK, BUKAN dari stok saat ini. Alasannya masuk akal: persen dari stok saat ini
-- bergerak setiap kali stok bergerak, sehingga ambangnya ikut turun justru ketika
-- stok menipis — ambang yang menghilang tepat saat paling dibutuhkan.
--
-- Sekaligus: HIDUPKAN pemicu low_stock. Ini temuan tersendiri — pemicunya selama ini
-- TERDAFTAR dan DITAMPILKAN, tapi tidak pernah dipicu oleh kode mana pun.
-- ============================================================================
update build_tasks
set name = 'Min Stock Level Berbasis Persen + Hidupkan Pemicu low_stock yang Tidak Pernah Berbunyi',
    detail_pekerjaan =
      'KEPUTUSAN PEMILIK PRODUK (24 Agu 2026) — pertanyaan "persen dari apa" SUDAH DIJAWAB: ' ||
      'persen dari JUMLAH YANG PERNAH MASUK, BUKAN dari stok saat ini. ' ||
      'ALASAN: ambang berbasis stok saat ini ikut turun setiap kali stok turun, jadi ambangnya ' ||
      'menghilang justru ketika stok menipis. ' ||
      E'\n\nYANG DIKERJAKAN:\n' ||
      E'1. Isian min stock level berupa PERSEN, dihitung terhadap total yang pernah masuk untuk item itu.\n' ||
      E'2. HIDUPKAN pemicu low_stock. Sekarang pemicu ini terdaftar dan ditampilkan di layar, TAPI ' ||
      E'tidak pernah dipicu oleh kode mana pun — jadi peringatan stok menipis tidak pernah benar-benar berbunyi.\n' ||
      E'3. BEDAKAN DUA KEADAAN yang selama ini tampak sama: "belum ada pembelian sama sekali" ' ||
      E'(belum pernah masuk, jadi persennya memang belum punya dasar) vs "stok habis" (pernah masuk, ' ||
      E'sekarang nol). Keduanya menampilkan angka nol tapi artinya berbeda jauh, dan tindakannya berbeda.\n' ||
      E'4. NOTIFIKASI ditujukan ke PURCHASING. TAMPIL di gudang, purchasing, dan produksi.\n' ||
      E'\nSIAP DIKERJAKAN — tidak ada lagi yang ditunggu.',
    notes = coalesce(notes, '') ||
      E'\n\n24 Agu 2026 — DIJAWAB pemilik produk lewat arsitek. Status "MENUNGGU JAWABAN" dicabut. ' ||
      'Catatan: jawabannya sempat TIDAK sampai ke Daftar Tugas ini (lihat AUD-14).',
    urgency = 'penting'
where task_code = 'MST-19' and company_id = 1;

-- ============================================================================
-- RSP-01 — naik ke MENDESAK.
--
-- Alasan pemilik produk: MST-16 dan MST-17 akan MENAMBAH isi ke halaman yang SUDAH
-- meluber. Menambah muatan ke halaman yang sudah rusak membuat perbaikannya lebih
-- mahal, dan besar kemungkinan halaman itu harus disentuh dua kali. Karena itu
-- RSP-01 dikerjakan SEBELUM MST-16, bukan sesudah.
-- ============================================================================
update build_tasks
set urgency = 'mendesak',
    notes = coalesce(notes, '') ||
      E'\n\n24 Agu 2026 — urgensi dinaikkan ke MENDESAK oleh pemilik produk. Alasan: MST-16 & MST-17 ' ||
      'akan menambah isi ke halaman yang sudah meluber; memperbaikinya belakangan berarti menyentuh ' ||
      'halaman yang sama dua kali. Urutan kerja: RSP-01 -> MST-16 -> MST-17 -> MST-18 -> MST-19.'
where task_code = 'RSP-01' and company_id = 1;

-- ============================================================================
-- AUD-14 — TEMUAN PROSES: keputusan pemilik produk tidak sampai ke Daftar Tugas.
-- ============================================================================
insert into build_tasks (
  company_id, task_code, name, module_code, module_name, description, effect_description,
  urgency, tags, pic, status, origin, detail_pekerjaan, notes
)
select 1, 'AUD-14',
  'Keputusan Pemilik Produk Tidak Sampai ke Daftar Tugas (MST-18 & MST-19)',
  'AUD', 'Audit & Proses',
  'Pemilik produk sudah memutuskan MST-18 (shelf life) dan menjawab MST-19 (persen dari apa), ' ||
  'tetapi kedua task tetap tertulis "MENUNGGU KEPUTUSAN" / "MENUNGGU JAWABAN" di Daftar Tugas. ' ||
  'Jawabannya berhenti di percakapan dan tidak pernah dipindahkan ke task-nya.',
  'Pekerjaan yang SEBENARNYA sudah boleh jalan tampak masih terkunci, sehingga tertunda tanpa ' ||
  'alasan. Ini kebalikan dari masalah yang sudah dikenal (temuan tidak jadi task): di sini ' ||
  'task-nya ada, tapi JAWABAN yang membuka kuncinya tidak pernah masuk.',
  'penting',
  array['proses', 'daftar-tugas'],
  'Claude Code',
  'menunggu',
  'temuan_claude',
  'Setiap kali pemilik produk memutuskan sesuatu yang sedang mengunci sebuah task, keputusan itu ' ||
  'WAJIB dituliskan ke task-nya di giliran kerja yang SAMA, dan penanda "menunggu keputusan" ' ||
  'dicabut saat itu juga. Tinjau apakah masih ada task lain yang berpenanda menunggu padahal ' ||
  'jawabannya sudah pernah disampaikan.',
  'Ditemukan 24 Agu 2026, dan bukan oleh sistem melainkan karena pemilik produk sendiri yang ' ||
  'menanyakan apakah jawabannya sudah masuk. Itu bagian yang paling perlu diperbaiki: celah ini ' ||
  'tidak punya alarm sendiri. Sepupu dari aturan yang sudah ada di CLAUDE.md ("dokumen yang ' ||
  'temuannya tidak jadi task sama dengan dokumen yang tidak pernah ditulis") — arahnya saja yang berbeda.'
where not exists (select 1 from build_tasks where task_code = 'AUD-14' and company_id = 1);
