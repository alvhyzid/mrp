-- WS-SALES-ROLE + DEC-S02..S09 -> Daftar Tugas Pembangunan (29 Agu 2026).

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
      raise notice 'Basis data masih kosong -- migrasi WS-SALES-ROLE dilewati (no-op yang sah).';
      return;
    end if;
    raise exception 'Migrasi WS-SALES-ROLE tidak menemukan perusahaan pemilik registri task, padahal companies berisi % baris.', v_jumlah_company;
  end if;

  perform pastikan_kode_task_kosong('SEC-24');
  perform pastikan_kode_task_kosong('SLS-08');

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes, started_at, completed_at
  ) values (
    v_company_id, 'SEC-24', 'Peran Sales sebagai peran tersendiri', 'SEC', 'Keamanan',
    concat_ws(chr(10),
      'Keputusan pemilik produk 29 Agu 2026: FABRIX WAJIB punya peran Sales yang nyata',
      'dan TERPISAH. admin_staff BUKAN Sales dan tidak boleh dijadikan penggantinya.',
      '',
      'AS-IS sebelum ini: 16 peran, tak satu pun bernama sales. Aturan BD-06 yang',
      'menyebut Sales boleh menahan PO klien TIDAK BISA ditegakkan karena pelakunya',
      'tidak ada.'),
    'Tanpa peran Sales, wewenang komersial menempel pada peran lain -- dan pemisahan tugas yang diminta perusahaan besar tidak bisa ditegakkan.',
    'penting', array['Keamanan','Fungsi'], 'Claude Code', 'selesai', '/team', 'temuan_claude',
    concat_ws(chr(10),
      'ARSITEKTURNYA DISENSUS LEBIH DULU, dan hasilnya menentukan bentuk pekerjaan:',
      'FABRIX TIDAK punya tabel roles, permissions, role_permissions, maupun departments --',
      'nol, seluruhnya. Yang ada: kolom teks users.role berkekangan CHECK, predikat di',
      'src/lib/roles.ts (diimpor 113 berkas), dan perbandingan jwt_app_role() di kebijakan',
      'RLS. Jadi NAMA PERAN itulah mekanisme kanoniknya; membuat tabel izin baru justru',
      'akan melanggar larangan membangun sistem peran PARALEL.',
      '',
      'YANG DIBERIKAN ke Sales, hak paling minimum: mengelola pelanggan dan PO klien',
      '(CUSTOMER_PO_MANAGE_ROLES + CUSTOMER_PO_QUICK_CREATE_ROLES), dan departemen',
      'keputusan `sales` sehingga bisa MENAHAN PO klien sesuai BD-06.',
      '',
      'YANG TIDAK DIBERIKAN: wewenang pimpinan, persetujuan Finance/PPIC/Manager, data',
      'keuangan, upah, pembelian, BOM, Work Order, pengiriman, penyesuaian stok.',
      '',
      'PEMISAHAN YANG PALING MUDAH RUSAK, dan karena itu dipisah dua fungsi:',
      'decisionDepartment() menjawab DEPARTEMEN MANA, canApproveDepartment() menjawab',
      'BOLEH MENYETUJUI ATAU TIDAK. Menggabungkannya akan membuat penambahan sales ke',
      'salah satunya diam-diam memberi hak persetujuan.'),
    concat_ws(chr(10),
      'admin_staff TIDAK DISENTUH: nol baris, nol predikat, nol kebijakan yang',
      'menyangkutnya diubah, dan wewenangnya tidak dicabut.',
      'NOL PENGGUNA NYATA DIPINDAHKAN. Terukur sebelum & sesudah: 8 baris users di',
      'proyek nyata, admin_staff tetap 1, pengguna berperan sales tetap 0.',
      'Membuat PERAN bukan menugaskan ORANG -- pemisahan itu disengaja.',
      '',
      'BUKTI: tests/peran_sales.test.ts, 16 pemeriksaan. Menguji DUA sisi -- Sales BISA',
      'menahan PO klien perusahaannya (dengan jejak yang mencatat peran & departemennya),',
      'dan Sales TIDAK BISA melepas tahanan departemen lain, membatalkan PO, memproses PO',
      'jadi Sales Order, menyentuh perusahaan lain, maupun mengubah produksi/pengiriman.',
      'Tanpa sisi pertama, seluruh penolakan bisa lulus dengan cara terburuk: peran yang',
      'tidak bisa apa-apa.',
      '',
      'EMPAT MUTASI DIUJI, KEEMPATNYA MENGGIGIT: Sales diberi wewenang pimpinan -> 4 gagal;',
      'diberi wewenang menyetujui -> 2 gagal; diberi hak mutasi pengiriman -> 1 gagal;',
      'pemetaan departemen dicabut di basis data -> 2 gagal.'),
    now(), now()
  );

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes
  ) values (
    v_company_id, 'SLS-08', 'Tujuh keputusan Sales ditutup -- implementasinya belum', 'SLS', 'Sales & CRM',
    concat_ws(chr(10),
      'Pemilik produk menutup DEC-S02 (Quotation), S03 (Sample), S04 (Kode produk',
      'pelanggan), S05 (Payment terms), S07 (Komplain), S08 (Amandemen Sales Order),',
      'dan S09 (Alamat kirim). DEC-S06 tetap OPEN DISCOVERY; DEC-S10 butuh tinjauan',
      'arsitektur.',
      '',
      'KEPUTUSAN = CLOSED, IMPLEMENTASI = OPEN. Ketujuhnya belum dibangun.'),
    'Arah bisnisnya sudah jelas; yang belum ada adalah kapabilitasnya.',
    'penting', array['Fungsi'], 'Claude Code', 'menunggu', '/sales-orders', 'pemilik_produk',
    concat_ws(chr(10),
      'Enam workstream dapat berjalan PARALEL: Quotation, Sample, Referensi Kode Produk',
      'Pelanggan, Integrasi Payment Terms, Komplain, Amandemen Sales Order.',
      '',
      'PRINSIP YANG MENGIKAT SELURUHNYA: Sales & CRM TIDAK BOLEH menjadi ERP mini dengan',
      'salinan Product, Formula, BOM, Routing, Batch, Inventory, Payment, Production,',
      'Shipment, maupun investigasi mutu. Sales adalah sumber kebenaran KOMERSIAL, dan',
      'mengambil sisanya lewat kontrak antar-domain.',
      '',
      'Contoh yang sudah eksplisit di keputusannya: kode produk pelanggan TIDAK boleh',
      'melahirkan Product baru -- ia relasi/rujukan, bukan identitas. Batch pada komplain',
      'TIDAK boleh diduplikasi -- tetap milik Traceability. Formula TIDAK boleh dibuat',
      'atau diubah dari Sales.'),
    concat_ws(chr(10),
      'Payment terms WAJIB di-snapshot saat transaksi dibuat/dikonfirmasi -- Customer',
      'Master hari ini TIDAK bisa dipakai merekonstruksi terms historis. Ini bertemu',
      'dengan BD-10 yang masih terbuka: Finance belum punya tempat menyatakan kewajiban',
      'pembayaran terpenuhi.',
      '',
      'Quotation harus OBJEK TERSTRUKTUR dengan versi dan siklus hidup, bukan unggahan',
      'PDF -- dan itu berarti ia juga butuh kategori alasan serta jejak keputusan yang',
      'fondasinya sudah dibangun di AUD-49.')
  );
end $$;
