-- Sisa fixture di project uji + pelajaran menghentikan vitest di tengah jalan (25 Agu 2026).
do $mig$
declare v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then return; end if;

  perform pastikan_kode_task_kosong('AUD-44');

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description,
    effect_description, urgency, status, origin, pic, detail_pekerjaan, notes)
  values (v_company_id, 'AUD-44',
    'Sisa Fixture Menumpuk di Project Uji Saat Vitest Dihentikan di Tengah Jalan',
    'AUD', 'Audit & Kepatuhan',
    'Company fixture tertinggal karena afterAll tidak pernah berjalan, dan run berikutnya gagal seperti regresi kode.',
    'Menentukan apakah test suite yang merah bisa dipercaya menunjuk kode, atau menunjuk sampah run sebelumnya.',
    'penting', 'menunggu', 'temuan_claude', 'Claude Code',
    concat_ws(chr(10),
      'KEJADIAN NYATA 25 Agu 2026: dua run vitest dihentikan di tengah jalan (karena berkas',
      'sudah berubah dan hasilnya jadi usang). afterAll tiap berkas test TIDAK PERNAH BERJALAN,',
      'jadi company fixture-nya tertinggal.',
      '',
      'Run berikutnya gagal EMPAT test di production_batch_routing_bom_snapshot dengan galat',
      'yang terlihat persis seperti REGRESI KODE: status 404 lalu 401 dari fungsi server.',
      'Waktu terbuang menelusuri perubahan view kesiapan Work Order yang ternyata tidak',
      'bersalah sama sekali. Setelah baris fixture-nya dihapus, keempatnya lulus tanpa satu pun',
      'baris kode diubah.',
      '',
      'YANG PERLU DIKERJAKAN:',
      '  a. skrip pembersih sisa fixture yang bisa dijalankan kapan saja: hapus seluruh company',
      '     ber-nama *TestCorp beserta anaknya. Percobaan 25 Agu 2026 gagal separuh karena',
      '     sebagian tabel anak TIDAK punya company_id, jadi tidak bisa disapu lewat kolom itu',
      '     -- pembersih yang benar harus menelusuri kunci asing, bukan menebak nama kolom;',
      '  b. pertimbangkan pengawas: bila ada company *TestCorp tersisa SEBELUM suite mulai,',
      '     berbunyi -- supaya kegagalan berikutnya tidak menyamar jadi regresi.',
      '',
      'SISA SAAT DICATAT: 3 company (RoutingBomSnapshotTestCorp, StageAwareFeasibilityTestCorp,',
      'OperatingProfitPeriodTestCorp) di project uji. Tidak menghalangi: tiap test membuat',
      'company sendiri, jadi suite tetap lulus.'),
    concat_ws(chr(10),
      'Ditemukan saat mengerjakan penerapan Carbon, 25 Agu 2026.',
      '',
      'PELAJARAN YANG LEBIH PENTING DARIPADA SISANYA SENDIRI:',
      'menghentikan vitest di tengah jalan MENINGGALKAN JEJAK yang membuat run berikutnya',
      'berbohong. Bentuk kegagalannya menunjuk ke kode aplikasi, bukan ke sampah data -- dan',
      'itu membuat orang mencari di tempat yang salah.',
      '',
      'ATURAN PRAKTIS sampai (a) ada: setelah menghentikan run vitest, PERIKSA sisa company',
      'ber-pola *TestCorp sebelum mempercayai hasil run berikutnya.'));
end $mig$;
