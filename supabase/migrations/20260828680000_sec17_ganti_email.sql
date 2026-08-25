-- SEC-17 (25 Agu 2026) — ganti alamat email dengan verifikasi.
-- Kode SEC-16 SUDAH DIPAKAI task lain; diperiksa lebih dulu, bukan sesudah gagal.

do $$
declare v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then return; end if;
  if exists (select 1 from build_tasks where task_code = 'SEC-17') then
    raise exception 'SEC-17 sudah dipakai. Pilih kode lain.';
  end if;

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description,
    effect_description, urgency, status, origin, pic, detail_pekerjaan, notes)
  values (v_company_id, 'SEC-17',
    'Ganti Alamat Email Pengguna dengan Verifikasi',
    'SEC', 'Keamanan & Akses',
    'Pengguna mengubah alamat email; kode dikirim ke alamat BARU; setelah kode dimasukkan, alamat baru berlaku.',
    'Tanpa ini alamat email tidak bisa diperbaiki sama sekali — dan alamat yang salah ketik mengunci pemulihan kata sandi selamanya.',
    'penting', 'menunggu', 'pemilik_produk', 'Claude Code',
    E'ALAMAT LAMA TETAP BERLAKU sampai yang baru terverifikasi. Jangan mengganti sebelum\n' ||
    E'terbukti, atau pengguna bisa terkunci dengan alamat yang salah ketik.\n\n' ||
    E'PERIKSA DULU sebelum membangun alur kode sendiri: Supabase punya\n' ||
    E'mailer_secure_email_change_enabled = true, yang berarti ia SUDAH meminta konfirmasi dari\n' ||
    E'KEDUA alamat. Mungkin cukup memakai itu daripada membangun mekanisme kode kedua --\n' ||
    E'dua jalur untuk hal yang sama adalah kelas cacat yang sudah dicatat.',
    E'=== ARKEOLOGI 25 Agu 2026 (G.1) ===\n' ||
    E'BELUM ADA sama sekali. Field email di halaman Profil berstatus `disabled` -- hanya\n' ||
    E'ditampilkan, tidak bisa diubah.\n\n' ||
    E'=== G.4 — PENGHENTI, DIPERIKSA DAN SEBAGIAN TERJAWAB ===\n' ||
    E'PERTANYAAN pemilik produk: yang ditolak DOMAINNYA, atau pengirimannya secara keseluruhan?\n\n' ||
    E'DIUJI tanpa mengirim apa pun ke orang sungguhan:\n' ||
    E'  Membuat akun dengan @debug.mrp, @example.com, @gmail.com, @fabrix.co.id\n' ||
    E'    -> KEEMPATNYA DITERIMA. Pembuatan akun tidak menolak domain apa pun.\n' ||
    E'  Mengirim tautan pemulihan ke company.a@debug.mrp\n' ||
    E'    -> GAGAL: "Email address is invalid" (kode email_address_invalid).\n\n' ||
    E'KESIMPULAN: yang menolak adalah PENGIRIMAN, dan yang ditolak DOMAINNYA. Delapan akun\n' ||
    E'@debug.mrp tidak bisa menerima email karena domainnya memang tidak ada.\n\n' ||
    E'YANG BELUM TERBUKTI, dan ini yang menentukan apakah G.2 boleh dibangun:\n' ||
    E'bahwa pengiriman ke alamat SUNGGUHAN berhasil. Membuktikannya menuntut alamat email\n' ||
    E'nyata milik pemilik produk, dan Claude Code TIDAK memakainya tanpa diminta.\n\n' ||
    E'KEADAAN SURELNYA, dibaca dari konfigurasi project:\n' ||
    E'  SMTP kustom : TIDAK ADA -> memakai layanan bawaan Supabase, yang berbatas kecepatan\n' ||
    E'                ketat dan memang ditujukan untuk pengembangan, bukan produksi.\n' ||
    E'  site_url    : http://localhost:3000\n' ||
    E'  uri_allow_list : KOSONG\n' ||
    E'  -> tautan di email APA PUN akan menunjuk ke localhost, yaitu ke komputer PENERIMA.\n' ||
    E'     Ini SEC-15, dan ia harus diperbaiki LEBIH DULU: kode verifikasi boleh sampai, tapi\n' ||
    E'     tautannya tidak akan membuka apa pun bagi siapa pun.\n\n' ||
    E'URUTAN YANG BENAR: SEC-15 (alamat situs) -> buktikan pengiriman ke alamat nyata ->\n' ||
    E'baru SEC-17 (alur ganti email). Membangun terbalik menghasilkan fitur yang tidak bisa\n' ||
    E'diselesaikan penggunanya.');
end $$;
