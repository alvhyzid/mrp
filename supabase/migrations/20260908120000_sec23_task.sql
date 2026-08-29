-- SEC-23 + INF-28 -> Daftar Tugas Pembangunan (29 Agu 2026).

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
      raise notice 'Basis data masih kosong -- migrasi SEC-23 dilewati (no-op yang sah).';
      return;
    end if;
    raise exception 'Migrasi SEC-23 tidak menemukan perusahaan pemilik registri task, padahal companies berisi % baris.', v_jumlah_company;
  end if;

  perform pastikan_kode_task_kosong('SEC-23');

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes, started_at, completed_at
  ) values (
    v_company_id, 'SEC-23', 'Peran NULL masih lolos gerbang wewenang', 'SEC', 'Keamanan',
    concat_ws(chr(10),
      'SEC-21 dilaporkan menutup lubangnya. VERIFIKASI INDEPENDEN MEMBANTAH LAPORAN ITU.',
      '',
      'Sesi yang klaimnya MEMBAWA company_id tetapi TIDAK membawa app_role berhasil membuat',
      'Sales Order. Dibuktikan dengan menjalankan, bukan membaca:',
      '  set_config(request.jwt.claims, {sub:..., company_id:<id>}, true)',
      '  select process_customer_purchase_order(<po>, <plant>)  -> TIDAK DITOLAK',
      '',
      'Sebabnya KELAS YANG SAMA dengan SEC-21, di GERBANG YANG BERBEDA:',
      'wajib_identitas_tenant() memeriksa identitas dan perusahaan -- BUKAN peran.',
      'Sementara jwt_is_company_leadership() -> NULL in (...) = NULL -> not NULL = NULL',
      '-> if NULL tidak dieksekusi -> gerbang peran DILEWATI.'),
    'Sesi yang klaim perannya hilang -- misalnya karena hook token gagal sebagian -- memperoleh wewenang pimpinan tanpa memilikinya.',
    'super_urgent', array['Keamanan'], 'Claude Code', 'selesai', '/sales-orders', 'temuan_claude',
    concat_ws(chr(10),
      'Setiap if not public.jwt_xxx() menjadi if not coalesce(public.jwt_xxx(), false),',
      'sehingga peran yang tidak diketahui diperlakukan TIDAK BERWENANG. Disensus ke',
      'seluruh 53 fungsi non-trigger: hanya TIGA yang memakai pola itu.',
      '',
      'PENGAWAS KELASNYA dibangun, bukan hanya kasusnya: tampilan pg_proc_risiko_null',
      'menyisir SELURUH fungsi dan harus selalu kosong. prokind=f wajib di tampilan itu --',
      'pg_get_functiondef() melempar galat untuk fungsi agregat, dan galat itu sempat',
      'terlihat seperti kegagalan migrasi padahal kegagalan pemeriksaannya sendiri.'),
    concat_ws(chr(10),
      'BUKTI SESUDAH -- tiga skenario diuji berurutan pada fixture yang sama:',
      '  app_role TIDAK ADA -> 0 Sales Order (ditolak)',
      '  app_role SALAH     -> 0 Sales Order (ditolak)',
      '  app_role BENAR     -> 1 Sales Order (berhasil)',
      'Skenario ketiga WAJIB ada: tanpa itu, pengaman yang menolak SEMUA ORANG akan',
      'terlihat seperti pengaman yang sempurna.',
      '',
      'Mutasi diuji: mengembalikan pola lama ke satu fungsi -> penjaga (11) berbunyi;',
      'melumpuhkan isolasi baca -> penjaga (12) dan (13) berbunyi.',
      '',
      'PELAJARAN YANG LEBIH BERHARGA DARIPADA PERBAIKANNYA: menambal satu gerbang TIDAK',
      'menutup kelasnya. Lubang kedua ini lahir dari pola yang sama persis dengan yang',
      'pertama, dan ia tetap ada SETELAH yang pertama dilaporkan tertutup.',
      '',
      'KOREKSI ANGKA di laporan sebelumnya: "11 -> 5 fungsi terbuka anon" benar HANYA',
      'untuk fungsi SECURITY DEFINER. Tanpa penyaring itu: dari 53 fungsi non-trigger,',
      '14 dapat dipanggil anon -- lima SECURITY DEFINER, plus sembilan yang BUKAN',
      'SECURITY DEFINER sehingga RLS tetap berlaku bagi pemanggilnya.'),
    now(), now()
  );
end $$;
