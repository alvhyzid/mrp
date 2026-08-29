-- WS-SALES-CANCEL + WS-PO-HOLD -> Daftar Tugas Pembangunan (29 Agu 2026).

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
      raise notice 'Basis data masih kosong -- migrasi WS-SALES-CANCEL dilewati (no-op yang sah).';
      return;
    end if;
    raise exception 'Migrasi WS-SALES-CANCEL tidak menemukan perusahaan pemilik registri task, padahal companies berisi % baris.', v_jumlah_company;
  end if;

  perform pastikan_kode_task_kosong('PJL-11');

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes, started_at, completed_at
  ) values (
    v_company_id, 'PJL-11', 'Permintaan pembatalan: mengajukan bukan membatalkan', 'PJL', 'Penjualan',
    concat_ws(chr(10),
      'BD-02/BD-03 menetapkan: setelah Sales Order dikonfirmasi, Sales TIDAK boleh',
      'membatalkan langsung. Sales MENGAJUKAN, Manager/GM MEMUTUSKAN.',
      'Sebelum ini, jalur pengajuannya tidak ada sama sekali -- yang ada hanya wewenang',
      'akhir, sehingga aturannya tidak bisa dijalankan.'),
    'Pembatalan yang seharusnya melewati tinjauan bisa terjadi tanpa jejak siapa mengusulkan dan siapa memutuskan.',
    'penting', array['Fungsi','Audit'], 'Claude Code', 'selesai', '/sales-orders', 'temuan_claude',
    concat_ws(chr(10),
      'BENTUKNYA DIAUDIT DULU: FABRIX sudah punya cetakan "usulan -> keputusan" yang',
      'dipakai dua kali (production_standard_proposals, leave_requests). Tabel',
      'cancellation_requests MENYALIN bentuk itu, ditambah yang keduanya belum punya dan',
      'BD-07 mewajibkannya: snapshot pelaku dan kategori alasan.',
      '',
      'SATU tabel untuk DUA entitas (Sales Order + PO klien), berkunci entity+record_id --',
      'menyalin pola decision_reason_categories. Dua tabel untuk alur identik akan jadi',
      'duplikasi yang dilarang.',
      '',
      'KENAPA BUKAN STATUS BARU DI sales_orders, dan ini keputusan yang paling menentukan:',
      'alternatif yang lebih elegan adalah menambah status cancellation_requested sehingga',
      'seluruh alur memakai status_transition_rules. DITOLAK karena AD-03 -- keputusan',
      'tentang kosakata status Sales Order -- masih TERBUKA, dan menambah status akan',
      'mendahuluinya. Bentuk yang dipilih TIDAK menyentuh sales_orders.status selama tahap',
      'permintaan, dan pembatalan akhirnya memakai transisi confirmed->cancelled YANG SUDAH',
      'ADA. Jadi ia tetap benar apa pun hasil AD-03.'),
    concat_ws(chr(10),
      'EMPAT PRINSIP DITEGAKKAN DAN DIUJI:',
      '  PERMINTAAN != PEMBATALAN -- mengajukan tidak mengubah status dokumen',
      '  PEMOHON != PEMUTUS -- berlaku BAHKAN bila pemohonnya pimpinan',
      '  GAGAL TERTUTUP -- tanpa identitas/perusahaan/peran -> tolak',
      '  RIWAYAT EKSEKUSI TIDAK PERNAH DIHAPUS -- hanya satu kolom status berubah, nol DELETE',
      '',
      'Keadaan eksekusi SAAT diajukan disimpan di execution_snapshot (jumlah Work Order,',
      'qty dipesan, qty terkirim, jumlah pengiriman) -- itulah bahan tinjauan dampak,',
      'tanpa membangun alur tinjauan tersendiri yang bentuknya belum diputuskan.',
      '',
      'BUKTI: tests/permintaan_pembatalan.test.ts, 17 pemeriksaan. EMPAT MUTASI DIUJI,',
      'keempatnya menggigit: pemisahan pemohon/pemutus dicabut -> 4 gagal; wewenang',
      'pimpinan dicabut -> 1 gagal; pemeriksaan perusahaan dicabut -> 3 gagal;',
      'mengajukan dibuat langsung membatalkan -> 6 gagal.',
      '',
      'Test (8) adalah yang paling penting: pembatalan disetujui, DAN riwayat pengiriman',
      'beserta qty_shipped terbukti TIDAK berubah.',
      '',
      'CATATAN JUJUR: satu test sempat gagal karena TESTNYA yang keliru -- pimpinan memakai',
      'kategori alasan milik departemen Sales, dan aturan kepemilikan kategori menolaknya.',
      'Perilakunya benar; pilihan kategorinya yang salah.'),
    now(), now()
  );
end $$;
