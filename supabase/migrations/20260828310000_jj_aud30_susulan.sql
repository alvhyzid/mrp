-- JJ (24 Agu 2026) — SUSULAN untuk AUD-30.
--
-- KENAPA ADA MIGRASI TERPISAH UNTUK SATU BARIS. Task ini semula ditulis di migrasi
-- 20260828300000 dengan kode AUD-29. Kode itu ternyata SUDAH DIPAKAI task lain, dan
-- `on conflict (company_id, task_code) do nothing` membuat sisipannya DIAM-DIAM tidak
-- terjadi — migrasi tetap hijau, task tetap tidak ada. Gagal yang tidak berisik.
--
-- Kodenya lalu diperbaiki jadi AUD-30 di berkas 20260828300000, tapi berkas itu SUDAH
-- diterapkan: `supabase db push` menjawab "Remote database is up to date" dan tidak
-- menjalankan apa pun. Menyunting migrasi yang sudah diterapkan hanya membetulkan
-- pembangunan ulang dari nol, TIDAK membetulkan database yang sudah berjalan.
--
-- Berkas ini yang mempertemukan keduanya. Dua-duanya idempoten, jadi pembangunan ulang
-- dari nol menyisipkan AUD-30 sekali lalu melewatinya di sini.
--
-- PELAJARAN YANG DIBAWA KE DEPAN: `on conflict do nothing` pada penyisipan task sengaja
-- dipertahankan (supaya migrasi bisa dijalankan ulang), tapi ia menukar kegagalan berisik
-- dengan kegagalan diam. Sesudah menambah task lewat migrasi, PERIKSA barisnya benar-benar
-- ada — jangan berhenti di "migrasi berhasil".

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

end $$;
