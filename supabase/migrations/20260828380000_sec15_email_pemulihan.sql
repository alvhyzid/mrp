-- SEC-15 (25 Agu 2026) — hasil pengujian pemulihan kata sandi.

do $$
declare v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then return; end if;

update build_tasks set
  urgency = 'mendesak',
  notes = coalesce(notes || E'\n\n', '') ||
    E'DIUJI 25 Agu 2026, dan hasilnya MENGGESER temuannya ke sebab yang lebih mendasar.\n\n' ||
    E'YANG TERBUKTI (bukan dugaan): Supabase MENOLAK mengirim email pemulihan ke alamat berdomain ' ||
    E'`@debug.mrp` -- jawabannya HTTP 400, error_code "email_address_invalid". Dan SELURUH 8 akun di ' ||
    E'sistem hari ini berdomain `@debug.mrp`. Artinya PEMULIHAN KATA SANDI TIDAK BERFUNGSI UNTUK SATU ' ||
    E'PUN AKUN yang ada sekarang -- bukan karena site_url, melainkan karena alamat emailnya bukan ' ||
    E'alamat yang bisa dikirimi.\n\n' ||
    E'Ini penting justru karena TIDAK terasa sekarang: selama yang memakai sistem hanya pemilik produk ' ||
    E'dengan kata sandi yang diingat, tidak ada yang menabraknya. Ia akan terasa persis pada hari ' ||
    E'karyawan sungguhan pertama lupa kata sandinya.\n\n' ||
    E'YANG MASIH BELUM TERUJI, dan sengaja tidak diklaim: apakah site_url localhost + daftar izin ' ||
    E'kosong membuat tautan pemulihan menunjuk localhost. Diprobe dari dua arah -- alamat tujuan situs ' ||
    E'tayang DAN alamat asing (evil.example.com) -- dan Supabase menjawab HTTP 200 untuk KEDUANYA. ' ||
    E'Jadi penolakan alamat tujuan TIDAK terjadi saat permintaan; ia terjadi saat tautannya dibuat, ' ||
    E'diam-diam. Cara request tidak bisa membedakannya.\n\n' ||
    E'SATU-SATUNYA CARA MEMASTIKAN: satu alamat email SUNGGUHAN yang bisa dibuka. Klik "lupa kata ' ||
    E'sandi" dengan alamat itu, lalu lihat tautannya menunjuk ke mana. Itu perlu alamat milik pemilik ' ||
    E'produk, jadi tidak bisa dikerjakan sendiri dari sini.\n\n' ||
    E'AKIBATNYA UNTUK URUTAN KERJA: memperbaiki site_url saja TIDAK cukup. Selama akun-akunnya ' ||
    E'berdomain @debug.mrp, pemulihan tetap mati. Keduanya harus beres sebelum karyawan sungguhan ' ||
    E'diberi akun -- dan itu menjadikan task ini prasyarat pemberian akun, bukan perapian belakangan.'
where task_code = 'SEC-15';

end $$;
