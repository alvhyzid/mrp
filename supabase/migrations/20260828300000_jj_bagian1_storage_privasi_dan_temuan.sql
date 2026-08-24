-- JJ / BAGIAN 1 (24 Agu 2026) — PRIVASI BERKAS, PEMBERSIHAN STORAGE, DAN TEMUAN YANG LAHIR
-- SELAMA MENGERJAKANNYA.
--
-- Latar: penyisiran berkas Storage FABRIX-APP menemukan 16 berkas, 12 di antaranya tidak
-- dirujuk baris database mana pun — dan DUA di antaranya berisi tanda tangan TULISAN TANGAN
-- asli yang bisa diunduh utuh dari internet tanpa login sama sekali (dibuktikan: HTTP 200,
-- 11.928 byte).

-- ============================================================================
-- INF-22 — SELESAI.
-- ============================================================================

-- PENGAMAN "PERUSAHAAN BELUM ADA" (II.2). Versi pertama migrasi ini menulis
-- `company_id` sebagai angka literal 1, dan pengawas
-- tests/migration_hardcoded_tenant_id_watchdog.test.ts menangkapnya di suite penuh.
-- Ia benar: `db push` ke database yang sudah berisi PT ITM memang lolos, tapi
-- pembangunan ulang dari nol menjalankan migrasi ini SAAT TABEL companies MASIH KOSONG,
-- dan insert-nya gagal keras. Pola di bawah mencari company lewat NAMA lalu tidak
-- melakukan apa-apa bila belum ada.
do $$
declare
  v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then
    raise notice 'Perusahaan PT ITM tidak ditemukan -- pencatatan task di migrasi ini dilewati (no-op).';
    return;
  end if;

update build_tasks set
  status = 'selesai',
  completed_at = now(),
  notes = coalesce(notes || E'\n\n', '') ||
    E'SELESAI 24 Agu 2026 (JJ Bagian 1).\n\n' ||
    E'JUMLAHNYA DIKOREKSI: judul task menyebut 15 berkas yatim; hitungan yang benar 12 dari 16. ' ||
    E'Selisihnya lahir dari cara mencocokkan yang cacat — URL tersimpan berakhiran "?v=1787119035058", ' ||
    E'sehingga logo perusahaan dan foto profil yang jelas-jelas TERPAKAI ikut terhitung yatim. ' ||
    E'Pelajarannya sama seperti yang sudah berulang di proyek ini: cara sebuah sapuan MENCARI ' ||
    E'menentukan apa yang tidak akan pernah ia temukan.\n\n' ||
    E'ISI 16 BERKAS ITU: 9 gambar 1x1 piksel (68-71 byte, fixture test); 2 gambar teks cetak ' ||
    E'"Tanda Tangan A"/"Tanda Tangan B (v2)" (fixture); 1 tangkapan layar terminal Claude Code ' ||
    E'yang tersalah-unggah sebagai foto pengeluaran barang (144 KB); 1 logo PT ITM yang memang ' ||
    E'dipakai; 3 tanda tangan — 1 fixture dan DUA TULISAN TANGAN ASLI.\n\n' ||
    E'TINDAKAN: 12 berkas fixture dihapus, 4 disisakan (logo, dua tanda tangan tulisan tangan asli, ' ||
    E'satu tanda tangan fixture yang masih berlaku untuk akun gudang).\n\n' ||
    E'AKAR MASALAHNYA JUGA DITUTUP, bukan cuma sampahnya disapu: cleanupCompanyCascade sekarang ' ||
    E'menghapus berkas Storage milik tenant SEBELUM barisnya dihapus, dan penggantian tanda tangan ' ||
    E'menghapus berkas lamanya. Dijaga tests/storage_ikut_terhapus.test.ts (terbukti merah lebih dulu).'
where task_code = 'INF-22';

-- ============================================================================
-- TEMUAN 1 — PEMBERSIHAN DATA LEWAT MIGRASI SQL TIDAK BISA MENYENTUH STORAGE.
--
-- Ini bukan catatan teknis biasa: ia langsung mengenai rencana pembersihan data yang
-- sedang disiapkan. Migrasi idempoten memang cara yang benar untuk barisnya, tapi ia
-- MUSTAHIL ikut menghapus berkasnya, dan tanpa langkah pendamping setiap pembersihan
-- melahirkan angkatan berkas yatim baru.
-- ============================================================================
insert into build_tasks (
  company_id, task_code, name, module_code, module_name, description, effect_description,
  urgency, tags, pic, status, origin, detail_pekerjaan
) values (
  v_company_id, 'INF-23', 'Pembersihan Data Butuh Langkah Pendamping untuk Berkas Storage', 'INF', 'Infrastruktur & Environment',
  'Postgres MENOLAK penghapusan langsung dari storage.objects ("Direct deletion from storage tables is not allowed. Use the Storage API instead."). Akibatnya migrasi SQL — cara yang dipakai proyek ini untuk pembersihan data — tidak bisa ikut menghapus berkas yang menempel pada baris yang dihapusnya.',
  'Tanpa langkah pendamping, setiap pembersihan data melahirkan angkatan berkas yatim baru, persis seperti 12 berkas yang baru dibersihkan hari ini.',
  'penting', array['storage','pembersihan','migrasi'], 'Claude Code', 'menunggu', 'temuan_claude',
  E'DIBUKTIKAN DENGAN PERCOBAAN, bukan dibaca dari dokumentasi (24 Agu 2026, project CI):\n' ||
  E'1. Unggah berkas -> HTTP 200, bisa diambil.\n' ||
  E'2. DELETE baris storage.objects lewat SQL -> DITOLAK: "ERROR 42501: Direct deletion from storage tables is not allowed."\n' ||
  E'3. DELETE lewat Storage API -> berhasil, berkasnya benar-benar hilang (HTTP 400 sesudahnya).\n\n' ||
  E'Sebelum larangan itu terbaca, percobaan yang sama juga menunjukkan berkasnya MASIH BISA DIUNDUH setelah barisnya "dihapus" — jadi walau larangannya kelak dicabut, menghapus baris pun tidak melenyapkan berkas.\n\n' ||
  E'YANG HARUS DILAKUKAN: setiap migrasi pembersihan data yang menyentuh tabel berberkas (users, shipments, delivery_confirmations, documents, companies) WAJIB punya langkah pendamping yang memanggil src/lib/storageCleanup.ts. Migrasi menghapus barisnya; skrip pendamping menghapus berkasnya. Urutannya: KUMPULKAN daftar berkas DULU selagi barisnya masih ada, baru hapus barisnya.'
) on conflict (company_id, task_code) do nothing;

-- ============================================================================
-- TEMUAN 2 — KOLOM YANG DITULIS TAPI TIDAK PERNAH DITAMPILKAN.
--
-- Kode AUD-29 sempat dipakai lebih dulu untuk hal lain (pemantauan pengguna auth di
-- project CI), dan `on conflict do nothing` membuat sisipan ini DIAM-DIAM tidak terjadi
-- pada percobaan pertama -- gagal yang tidak berisik. Dipindahkan ke AUD-30.
--
-- Kelas cacat yang sudah dikenal di proyek ini ("terdaftar tapi tidak pernah hidup"),
-- ditemukan lagi saat menelusuri siapa membaca URL berkas.
-- ============================================================================
insert into build_tasks (
  company_id, task_code, name, module_code, module_name, description, effect_description,
  urgency, tags, pic, status, origin, detail_pekerjaan
) values (
  v_company_id, 'AUD-30', 'Foto Konfirmasi Penerimaan Disimpan tapi Tidak Pernah Ditampilkan', 'AUD', 'Audit Kualitas',
  'delivery_confirmations.photo_url DIISI saat penerima barang mengunggah foto, tapi tidak ada satu pun layar yang menampilkannya kembali. Penyisiran seluruh src/ dan app/ menemukan nol pembaca.',
  'Penerima barang diminta memotret bukti penerimaan, fotonya tersimpan dan memakan ruang, tapi tidak seorang pun di perusahaan bisa melihatnya. Bukti yang tidak bisa dilihat sama saja dengan bukti yang tidak diambil.',
  'penting', array['audit','pengiriman','terdaftar-tapi-mati'], 'Claude Code + Pemilik Produk', 'menunggu', 'temuan_claude',
  E'CARA MENEMUKANNYA: penyisiran seluruh src/ dan app/ untuk kata photo_url / photoUrl. Yang ditemukan hanya penulisnya (confirmDelivery.ts) dan satu baris di kamus istilah. Nol pembaca di layar mana pun.\n\n' ||
  E'BATAS PENYISIRAN INI (wajib disebut): ia membuktikan ADA-nya penulis dan TIDAK ADA-nya pembaca DI KODE HARI INI. Ia tidak membuktikan foto itu tidak pernah berguna — hanya bahwa hari ini tidak ada jalan melihatnya.\n\n' ||
  E'PERTANYAAN UNTUK PEMILIK PRODUK (jangan diputuskan sendiri): foto konfirmasi penerimaan ini perlu ditampilkan di layar Pengiriman, ATAU sebenarnya tidak perlu diminta sama sekali? Keduanya sah; yang tidak sah adalah keadaan sekarang — meminta foto lalu menyembunyikannya.'
) on conflict (company_id, task_code) do nothing;

-- ============================================================================
-- TEMUAN 3 — SINGGAHAN CDN MENUNDA PENUTUPAN AKSES.
-- ============================================================================
insert into build_tasks (
  company_id, task_code, name, module_code, module_name, description, effect_description,
  urgency, tags, pic, status, origin, detail_pekerjaan
) values (
  v_company_id, 'SEC-12', 'Menutup Bucket Tidak Seketika Menutup URL yang Sudah Tersinggah', 'SEC', 'Keamanan',
  'Berkas di bucket publik disajikan lewat Cloudflare dengan cache-control: public, max-age=3600. Setelah bucket diubah jadi privat, URL yang belum pernah diambil langsung ditolak (HTTP 400), tapi URL yang sempat diambil dalam satu jam terakhir MASIH mengirim isi berkasnya dari singgahan tepi jaringan.',
  'Ada jendela sampai satu jam di mana berkas yang sudah "ditutup" masih bisa diunduh oleh siapa pun yang memegang URL-nya.',
  'bisa_menunggu', array['storage','privasi','cdn'], 'Claude Code', 'menunggu', 'temuan_claude',
  E'DIUKUR LANGSUNG 24 Agu 2026, sesudah tiga bucket diubah jadi privat:\n' ||
  E'  - URL tanda tangan yang sempat diambil saat penyelidikan -> HTTP 200, header cf-cache-status: HIT, isi utuh 11.928 byte.\n' ||
  E'  - URL yang sama + pembatal singgahan (?nocache=...)      -> HTTP 400.\n' ||
  E'  - URL tanda tangan LAIN yang belum pernah diambil        -> HTTP 400.\n' ||
  E'Ketiganya bersama membuktikan: asalnya sudah menolak, yang tersisa hanya salinan singgahan.\n\n' ||
  E'TIDAK ADA TOMBOL PEMBERSIH SINGGAHAN yang tersedia dari sisi kita. Yang bisa dilakukan bila suatu berkas benar-benar harus tidak bisa diambil detik itu juga: HAPUS berkasnya, jangan cuma tutup bucketnya.\n\n' ||
  E'KENAPA INI TETAP DICATAT WALAU KECIL: kalau kelak ada kejadian kebocoran sungguhan, orang akan menutup bucket lalu mengira urusannya selesai. Catatan ini yang mencegah kesimpulan itu.'
) on conflict (company_id, task_code) do nothing;

-- ============================================================================
-- INF-16 — dinaikkan: pencadangan Storage sekarang punya bukti kenapa penting.
-- ============================================================================
update build_tasks set
  urgency = 'mendesak',
  notes = coalesce(notes || E'\n\n', '') ||
    E'Catatan 24 Agu 2026 (JJ Bagian 1) — task ini berhenti jadi kehati-hatian teoretis dan jadi kerugian nyata: ' ||
    E'FOTO PROFIL akun admin PT ITM TIDAK BISA DIPULIHKAN. Nama berkasnya tetap (avatar.png) dan diunggah dengan ' ||
    E'upsert, sehingga sebuah run verifikasi 17 Agu 2026 pukul 16:11 MENIMPA isinya dengan gambar 1x1 piksel. ' ||
    E'Versi aslinya tidak tersisa di mana pun.\n\n' ||
    E'Pencadangan bawaan Supabase TIDAK mencakup Storage — jadi tidak ada tempat mengambilnya kembali. ' ||
    E'Tanda tangan tulisan tangan asli SELAMAT hanya karena kebetulan: berkas tanda tangan dinamai unik per unggahan ' ||
    E'(bukan upsert), jadi yang lama tidak tertimpa. Perbedaan nasib keduanya murni soal pola penamaan berkas, ' ||
    E'bukan soal ada tidaknya pencadangan.'
where task_code = 'INF-16';

end $$;
