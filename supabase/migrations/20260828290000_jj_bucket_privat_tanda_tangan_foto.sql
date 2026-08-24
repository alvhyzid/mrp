-- JJ.1 / 1.1 + 1.2 — TIGA BUCKET BERPINDAH DARI PUBLIK KE PRIVAT.
--
-- SEBABNYA BUKAN DUGAAN, MELAINKAN PERCOBAAN LANGSUNG (24 Agu 2026): berkas tanda tangan
-- tulisan tangan asli milik pemilik produk berhasil diunduh UTUH (11.928 byte, HTTP 200)
-- dari internet TANPA login sama sekali, hanya bermodal URL-nya. Menelusuri daftar isi
-- bucket memang ditolak, jadi URL-nya tidak bisa dikarang — tapi siapa pun yang pernah
-- memegang URL itu bisa mengunduhnya selamanya, tanpa akun.
--
-- YANG BERUBAH:
--   user-signatures              publik -> PRIVAT  (tanda tangan = data pribadi)
--   delivery-confirmation-photos publik -> PRIVAT  (foto penerimaan di lokasi pelanggan)
--   shipment-dispatch-photos     publik -> PRIVAT  (foto muatan keluar gudang)
--
-- YANG SENGAJA TETAP PUBLIK:
--   company-logos  — logo perusahaan memang untuk ditampilkan
--   user-avatars   — foto profil, sama seperti aplikasi kerja pada umumnya
--
-- HALAMAN POD TIDAK TERGANGGU. Diperiksa sebelum mengubah: getShipmentByPodToken
-- mengembalikan HANYA nomor pengiriman, tanggal, alamat, dan baris barang — NOL foto,
-- NOL tanda tangan. Penerima barang MENGUNGGAH ke bucket ini, tidak pernah MEMBACA
-- darinya. Jadi menutup akses baca publik tidak memutus satu pun jalur penerima barang.
--
-- CARA BACA SESUDAH INI: signed URL berumur pendek lewat admin client, pola yang sudah
-- terbukti di Master Dokumen (src/features/documents/server/getDocumentSignedUrl.ts).
-- Tidak ada mekanisme baru yang dibangun.

-- ============================================================================
-- 1) BUCKET: public = false
-- ============================================================================
update storage.buckets set public = false
where id in ('user-signatures', 'delivery-confirmation-photos', 'shipment-dispatch-photos');

-- ============================================================================
-- 2) POLICY BACA PUBLIK DICABUT.
--
-- Mencabut ini WAJIB, bukan pelengkap. Mengubah `public=false` saja hanya menutup
-- jalur /object/public/...; policy SELECT ber-role `public` masih mengizinkan
-- pembacaan lewat jalur lain. Dua-duanya harus ditutup bersamaan.
--
-- Tidak ada policy SELECT pengganti untuk `authenticated`: pembacaan di aplikasi
-- SELURUHNYA lewat admin client (service_role) yang memang melewati RLS, lalu
-- hasilnya dibagikan sebagai signed URL berumur pendek. Memberi `authenticated`
-- hak baca langsung justru membuka kembali celah yang sedang ditutup — pengguna
-- perusahaan lain ikut `authenticated`.
-- ============================================================================
drop policy if exists user_signatures_public_read on storage.objects;
drop policy if exists delivery_confirmation_photos_public_read on storage.objects;
drop policy if exists shipment_dispatch_photos_public_read on storage.objects;

-- ============================================================================
-- 3) CATATAN UNTUK SESI BERIKUTNYA — DITULIS DI BERKAS INI, BUKAN DI DATABASE.
--
-- Percobaan pertama menaruh catatan ini sebagai `comment on table storage.objects`
-- dan Postgres MENOLAK: "must be owner of table objects (SQLSTATE 42501)". Tabel
-- storage.objects milik peran internal Supabase; migrasi proyek boleh membuat/mencabut
-- POLICY di atasnya, tapi tidak boleh mengubah tabelnya sendiri. Seluruh migrasi ini
-- ikut batal karena satu pernyataan itu — jadi catatannya dipindahkan ke sini.
--
-- YANG PERLU DIKETAHUI SESI BERIKUTNYA: ketiga bucket di atas SENGAJA privat sejak
-- 24 Agu 2026. Isinya data pribadi & bukti pengiriman, dibaca lewat signed URL berumur
-- pendek (src/lib/storageSignedUrl.ts), bukan URL permanen. company-logos dan
-- user-avatars sengaja TETAP publik. JANGAN mengembalikan ketiganya jadi publik.
-- ============================================================================

-- ============================================================================
-- 4) YANG TIDAK LANGSUNG TERTUTUP: SINGGAHAN TEPI JARINGAN (CDN).
--
-- Diukur langsung setelah migrasi ini dijalankan, bukan diperkirakan. Berkas publik
-- Supabase disajikan lewat Cloudflare dengan `cache-control: public, max-age=3600`.
-- Sesudah bucket jadi privat:
--   - URL yang BELUM PERNAH diambil    -> HTTP 400 (asalnya menolak). Tertutup seketika.
--   - URL yang SUDAH tersinggah        -> HTTP 200 dengan `cf-cache-status: HIT`, masih
--                                         mengirim isi berkas sampai singgahannya kedaluwarsa.
--
-- Artinya menutup bucket TIDAK seketika menutup URL yang jam terakhir ini sempat diambil
-- orang; jendelanya paling lama 1 jam. Ini keterbatasan yang perlu diketahui, bukan
-- kegagalan migrasi: tidak ada tombol pembersih singgahan yang tersedia dari sisi kita.
--
-- KONSEKUENSINYA UNTUK KELAK: bila suatu saat sebuah berkas benar-benar HARUS tidak bisa
-- diambil DETIK ITU JUGA, menutup bucket saja tidak cukup — berkasnya harus DIHAPUS, dan
-- itu pun hanya menutup jalur asalnya.
-- ============================================================================
