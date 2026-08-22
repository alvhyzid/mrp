-- Halaman Daftar Tugas Pembangunan -- QA-01 (22 Agu 2026): pembersihan
-- mandiri test tidak andal -- kejadian KEDUA dengan pola sama (INF-06).
do $$
declare
  v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then
    raise notice 'Perusahaan PT ITM tidak ditemukan -- migrasi dilewati (no-op).';
    return;
  end if;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes
  ) values (
    v_company_id, 'QA-01', 'Pembersihan Mandiri Test Tidak Andal',
    'AUD', 'Audit UI-Hole',
    'Menjalankan seluruh test suite dua kali berturut-turut meninggalkan sisa data yang bentrok (2 baris company_id "AttendanceW1TestCorp" duplikat, auth user tidak konsisten) -- afterAll test tidak selalu berhasil membersihkan diri, terutama saat run sebelumnya gagal di tengah.',
    'Hari ini sisa itu jatuh ke tenant uji dan tidak berbahaya, karena pengaman lain (Invarian 9, cleanupCompanyCascade) sudah mencegah test menyentuh data PT ITM. Tapi sekali pengaman ITU meleset, sisanya jatuh ke tempat yang salah -- dua lapisan yang sama-sama tidak sempurna bukan pengaman berlapis.',
    'mendesak', ARRAY['Keamanan','Data']::text[], 'Claude Code', 'menunggu', null, 'temuan_claude',
    'Kejadian KEDUA dengan pola sama -- yang pertama 7 perusahaan bekas test menumpuk di project data nyata (dicatat INF-06). Lingkup: pastikan SETIAP file test membersihkan dirinya sendiri dengan andal, TERMASUK saat gagal di tengah (pola try/finally atau setara, bukan sequential-await-tanpa-jaring seperti yang pernah jadi akar masalah "ratusan baris companies menumpuk" 26 Agu 2026). BUKTI WAJIB sebelum dianggap selesai: jalankan seluruh test suite 3 KALI BERTURUT-TURUT, tunjukkan jumlah baris di tenant uji (companies/users/employees dsb, SELAIN PT ITM dan Company B) kembali SAMA PERSIS setiap kali -- bukan cuma "test lulus", tapi benar-benar 0 sisa tiap putaran.',
    'JANGAN dikerjakan sekarang -- dicatat saja, sesuai instruksi.'
  )
  on conflict (company_id, task_code) do nothing;

end $$;
