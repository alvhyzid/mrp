-- Halaman Daftar Tugas Pembangunan -- 22 Agu 2026: V.2 naikkan urgensi QA-01
-- ke SUPER URGENT (ditetapkan pemilik produk, bukan Claude Code), alasan
-- tercatat: 3 kejadian pola sama dalam beberapa hari.
do $$
declare
  v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then
    raise notice 'Perusahaan PT ITM tidak ditemukan -- migrasi dilewati (no-op).';
    return;
  end if;

  insert into build_task_urgency_history (build_task_id, old_urgency, new_urgency, requested_by)
  select build_task_id, 'mendesak', 'super_urgent',
    'Pemilik Produk (22 Agu 2026) -- tiga kejadian pola sama dalam beberapa hari (7 perusahaan bekas test menumpuk/INF-06, sisa bentrok saat suite dijalankan 2x berturut-turut, fixture bentrok lagi di PMB-07a) -- perbaikan di berkas test masing-masing adalah tambalan lokal, akarnya belum tersentuh'
  from build_tasks where company_id = v_company_id and task_code = 'QA-01';

  update build_tasks set
    urgency = 'super_urgent',
    super_urgent_since = now()
  where company_id = v_company_id and task_code = 'QA-01';

end $$;
