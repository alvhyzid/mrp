-- SEC-21 + usulan keputusan -> Daftar Tugas Pembangunan (29 Agu 2026).
--
-- Dokumen sumber:
--   docs/sales-crm/SALES_CRM_SECURITY_RECONCILIATION.md
--   docs/sales-crm/SALES_CRM_DECISION_PROPOSALS.md

do $$
declare
  v_company_id integer;
  v_jumlah_company integer;
begin
  select company_id into v_company_id
  from build_tasks group by company_id order by count(*) desc limit 1;

  if v_company_id is null then
    select company_id into v_company_id from companies
    where name in ('PT ITM', 'PT Indo Taste Manufacture')
    order by company_id limit 1;
  end if;

  if v_company_id is null then
    select count(*) into v_jumlah_company from companies;
    if v_jumlah_company = 0 then
      raise notice 'Basis data masih kosong -- migrasi SEC-21 dilewati (no-op yang sah).';
      return;
    end if;
    raise exception 'Migrasi SEC-21 tidak menemukan perusahaan pemilik registri task, padahal companies berisi % baris.', v_jumlah_company;
  end if;

  perform pastikan_kode_task_kosong('SEC-21');
  perform pastikan_kode_task_kosong('SEC-22');
  perform pastikan_kode_task_kosong('INF-28');

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes, started_at, completed_at
  ) values (
    v_company_id, 'SEC-21', 'Fungsi basis data gagal TERBUKA untuk pemanggil tanpa login', 'SEC', 'Keamanan',
    concat_ws(chr(10),
      'DIBUKTIKAN, bukan diduga. Dijalankan terhadap tenant uji di staging dengan kunci',
      'anon saja, tanpa login sama sekali:',
      '  anon.rpc(process_customer_purchase_order, ...) -> berhasil, mengembalikan 901',
      '  dan SATU Sales Order benar-benar tercipta di perusahaan yang bukan miliknya.',
      '',
      'DUA SEBAB. (1) Postgres memberi EXECUTE kepada PUBLIC secara BAWAAN pada setiap',
      'fungsi baru -- sensus menemukan 11 fungsi SECURITY DEFINER bisa dipanggil anon.',
      '(2) Gerbang di dalam fungsinya GAGAL TERBUKA: tanpa JWT, jwt_company_id() dan',
      'jwt_is_company_leadership() bernilai NULL, sehingga v_company_id <> NULL bernilai',
      'NULL dan not NULL juga NULL -- dan if NULL TIDAK PERNAH dieksekusi. Kedua gerbang',
      'DILEWATI, bukan menolak.'),
    'Pemanggil tanpa login dapat membuat dokumen komersial untuk perusahaan mana pun yang PO klien-nya sudah punya tiga persetujuan.',
    'super_urgent', array['Keamanan','Data'], 'Claude Code', 'selesai', '/sales-orders', 'temuan_claude',
    concat_ws(chr(10),
      'Ditutup dua lapis. (a) Fungsi wajib_identitas_tenant() menolak pemanggil tanpa',
      'identitas ATAU tanpa konteks perusahaan -- DUA hal diperiksa, karena auth.uid()',
      'saja tidak cukup: pengguna yang login tetapi klaim company_id-nya kosong akan',
      'lolos lalu membuka lubang NULL yang sama. (b) Hak anon dicabut dari enam fungsi,',
      'setelah diperiksa terhadap SELURUH 145 kebijakan RLS: nol yang memakainya.',
      '',
      'Badan keenam fungsi DIAMBIL APA ADANYA dari basis data lalu diberi SATU pernyataan',
      'di awal -- logika bisnisnya tidak disentuh. Perbandingan <> terhadap jwt_company_id()',
      'sekaligus diubah jadi is distinct from sebagai lapis kedua.',
      '',
      'SENGAJA TIDAK DISENTUH: confirm_delivery (jalur POD publik yang memang tanpa login)',
      'dan empat penolong RLS -- mencabut haknya akan MEMADAMKAN kebijakan yang berjalan.',
      'Hasil: 11 -> 5 fungsi terbuka anon, kelimanya beralasan tertulis.'),
    concat_ws(chr(10),
      'BUKTI TERTUTUP: percobaan yang sama diulang -> 42501 permission denied, nol Sales',
      'Order tercipta. Jalur yang sah tetap bekerja (30 pemeriksaan lulus).',
      'MATRIKS 9 SKENARIO: tests/matriks_keamanan_sales.test.ts, 8 pemeriksaan, tiap',
      'penolakan diperiksa KODE-nya bukan sekadar adanya galat. Dua mutasi menggigit:',
      'melumpuhkan gerbang -> skenario 8 gagal; mengembalikan hak anon -> skenario 1+7',
      'dan 10 gagal.',
      '',
      'CATATAN JUJUR: lubang ini SUDAH ADA sebelum batch ini -- fungsinya memang selalu',
      'terbuka. WS-S03 menjadikannya jalur kanonik, sehingga menaikkan kegentingannya',
      'dari laten menjadi nyata. Yang menemukannya penjaga proyek ini sendiri',
      '(function_grant_security_audit), bukan pembacaan kode.'),
    now(), now()
  );

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes
  ) values (
    v_company_id, 'SEC-22', 'Empat penolong RLS yang menerima identitas sebagai parameter', 'SEC', 'Keamanan',
    concat_ws(chr(10),
      'Empat fungsi SECURITY DEFINER masih terbuka untuk anon dan SENGAJA tidak disentuh',
      'SEC-21: is_super_admin_user (dipakai 6 kebijakan RLS), user_has_no_company (1),',
      'employee_belongs_to_current_user (2), employee_matches_managed_department (1).',
      '',
      'Mencabut haknya akan MEMADAMKAN kebijakan RLS yang sedang berjalan -- risiko lebih',
      'besar daripada yang ditutup. Dua di antaranya menerima auth_uid sebagai PARAMETER,',
      'yang berarti pemanggil menentukan sendiri identitas yang diklaimnya.'),
    'Selama bentuknya begini, gerbangnya bergantung pada pemanggil yang jujur menyebut identitasnya sendiri.',
    'penting', array['Keamanan'], 'Claude Code', 'menunggu', null, 'temuan_claude',
    concat_ws(chr(10),
      'Perancangan ulang tanda tangan (buang parameter, pakai auth.uid() internal) sudah',
      'tercatat menunggu persetujuan eksplisit -- lihat catatan di',
      'tests/function_grant_security_audit.test.ts. WAJIB disertai pengujian ulang SELURUH',
      'kebijakan RLS yang memakainya, karena mengubahnya dapat memadamkan RLS untuk semua',
      'pengguna sekaligus.',
      '',
      'Dua sisanya milik domain HR, bukan Sales.'),
    concat_ws(chr(10),
      'Ditemukan saat mengerjakan SEC-21, 29 Agu 2026, lewat sensus seluruh fungsi',
      'SECURITY DEFINER. Dicatat dan SENGAJA tidak dikerjakan bersamaan.')
  );

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes
  ) values (
    v_company_id, 'INF-28', 'Pencadangan terbukti bisa DIEKSPOR, belum terbukti bisa DIPULIHKAN', 'INF', 'Infrastruktur',
    concat_ws(chr(10),
      'Ekspor sungguhan dijalankan untuk seluruh 92 tabel di backup-table-list.txt:',
      'nol yang gagal. Tetapi yang terbukti hanyalah EKSPOR.',
      '',
      'Tidak ada jalur pemulihan otomatis. scripts/backup-export-json.js hanya menulis',
      'JSON per tabel; tidak ada skrip yang membacanya kembali, dan tidak ada test yang',
      'membuktikan hasil ekspor itu cukup untuk memulihkan basis data.'),
    'Klaim "data aman karena sudah dicadangkan" belum bisa dipertanggungjawabkan -- yang terbukti baru separuh perjalanannya.',
    'penting', array['Infrastruktur','Data'], 'Claude Code', 'menunggu', null, 'temuan_claude',
    concat_ws(chr(10),
      'Bangun jalur pemulihan dan buktikan lewat MENJALANKAN: pulihkan hasil ekspor ke',
      'project kosong, lalu bandingkan jumlah baris dan kekangannya dengan sumbernya.',
      'Membaca skrip tidak cukup -- di proyek ini urutan pembersihan Storage yang salah',
      'juga hanya terlihat setelah dijalankan.'),
    concat_ws(chr(10),
      'Ditemukan saat memverifikasi cakupan pencadangan untuk SEC-21, 29 Agu 2026.',
      'Perintah eksekusi menyebutnya tegas: jangan hanya mengandalkan "backup succeeded".')
  );
end $$;
