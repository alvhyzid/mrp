-- DEC-S05 -> Daftar Tugas Pembangunan (29 Agu 2026).

do $$
declare
  v_company_id integer;
  v_jumlah_company integer;
begin
  select company_id into v_company_id from build_tasks group by company_id order by count(*) desc limit 1;
  if v_company_id is null then
    select company_id into v_company_id from companies
    where name in ('PT ITM', 'PT Indo Taste Manufacture') order by company_id limit 1;
  end if;
  if v_company_id is null then
    select count(*) into v_jumlah_company from companies;
    if v_jumlah_company = 0 then
      raise notice 'Basis data masih kosong -- migrasi DEC-S05 dilewati (no-op yang sah).';
      return;
    end if;
    raise exception 'Migrasi DEC-S05 tidak menemukan perusahaan pemilik registri task, padahal companies berisi % baris.', v_jumlah_company;
  end if;

  perform pastikan_kode_task_kosong('PJL-12');
  perform pastikan_kode_task_kosong('FIN-02');

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes, started_at, completed_at
  ) values (
    v_company_id, 'PJL-12', 'Termin pembayaran & jadwal kewajiban', 'PJL', 'Penjualan',
    concat_ws(chr(10),
      'DEC-S05: termin pembayaran di PT Indo Taste sangat custom -- contoh nyata',
      '60% uang muka + 40% sebelum kirim -- dan piutang sering terjadi.',
      'Sebelumnya termin hanya satu kolom teks berisi full/tempo, tanpa jadwal,',
      'tanpa nilai, tanpa pemicu.'),
    'Komitmen pembayaran tidak bisa ditagihkan bertahap karena sistem tidak tahu berapa dan kapan.',
    'penting', array['Fungsi','Data'], 'Claude Code', 'selesai', '/sales-orders', 'pemilik_produk',
    concat_ws(chr(10),
      'DIBANGUN: payment_terms (aturan bisa dipakai ulang) + payment_term_steps (tahap,',
      'persentase ATAU nominal tetap, dengan pemicu) + sales_order_payment_obligations',
      '(komitmen BEKU milik satu Sales Order).',
      '',
      'TIGA HAL YANG TIDAK DITEBAK, jawabannya dari pengukuran skema:',
      '  MATA UANG -- nol kolom currency di seluruh skema, jadi sistem ini satu mata uang.',
      '  PAJAK -- nol kolom tax/diskon, jadi persentase hanya bisa atas total baris SO.',
      '  PRESISI -- uang di sistem ini numeric(14,4); kewajiban memakai yang sama.',
      '  PEMICU "sebelum kirim" -- dibaca dari mesin status shipments (draft -> shipped),',
      '  bukan dikarang.',
      '',
      'PEMBULATAN: tidak ada mekanisme kanonik untuk dipakai ulang. Kriteria terimanya',
      'sendiri menuntut jumlah kewajiban SAMA PERSIS dengan nilai transaksi, dan saat',
      'persentase tidak habis dibagi satu-satunya cara memenuhinya adalah TAHAP TERAKHIR',
      'MENYERAP SISA. Itu ATURAN YANG DIPILIH, bukan perilaku yang ditemukan.'),
    concat_ws(chr(10),
      'YANG SENGAJA TIDAK DIBUAT, dan inilah keputusan terpentingnya: nol tabel pembayaran,',
      'nol tabel piutang, dan tabel kewajiban SENGAJA tidak punya kolom paid_amount,',
      'payment_date, maupun status. Menambahkannya berarti membangun sumber kebenaran',
      'pembayaran KEDUA -- dan hari ini tidak ada satu pun catatan pembayaran untuk',
      'menurunkannya, sehingga statusnya tidak akan pernah bisa dicapai.',
      '',
      'BUKTI: tests/payment_terms_obligation.test.ts, 15 pemeriksaan. Tiga mutasi diuji.',
      'Mencabut penyerapan sisa -> fungsi MENOLAK dengan P0001, bukan menulis angka yang',
      'meleset; itu membuktikan penjaga jumlah akhir benar-benar berbunyi. Mencabut',
      'pemeriksaan termin nonaktif -> 1 gagal.',
      '',
      'Mutasi mencabut penjaga jumlah akhir SAJA tidak menggigit -- dan itu bukan cacat:',
      'penyerapan sisa membuat ketidakseimbangan mustahil terjadi, sehingga penjaganya',
      'memang lapis kedua yang hanya berbunyi bila lapis pertama rusak. Disebut apa adanya.',
      '',
      'Integritas sejarah terbukti: master diubah 60/40 -> 50/50 SETELAH SO lama memakainya,',
      'dan SO lama tetap 60/40 sementara SO baru memakai 50/50.')
  ,now(), now());

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes
  ) values (
    v_company_id, 'FIN-02', 'Domain Finance untuk piutang pelanggan belum ada', 'FIN', 'Keuangan',
    concat_ws(chr(10),
      'ARCHITECTURE GAP, disensus terhadap seluruh 101 tabel pada 29 Agu 2026:',
      '  tabel payments      -> NIHIL',
      '  tabel receivables   -> NIHIL',
      '  tabel ledger/journal-> NIHIL',
      '  tabel jatuh tempo   -> NIHIL',
      '',
      'Satu tabel bernama invoices MEMANG ADA dan BUKAN yang dicari: FK-nya ke',
      'subscription_plans, kolomnya period_start/period_end/payment_gateway_ref, dan nol',
      'kolom customer_id. Itu FABRIX MENAGIH TENANT-nya, bukan tenant menagih pelanggan.'),
    'Berapa yang sudah dibayar dan berapa yang tertunggak TIDAK BISA ditampilkan -- bukan karena belum dikerjakan, melainkan karena tidak ada sumbernya.',
    'penting', array['Keuangan','Arsitektur'], 'Claude Code', 'menunggu', null, 'temuan_claude',
    concat_ws(chr(10),
      'JANGAN dibangun dari Sales. Perintah eksekusi melarangnya tegas: dilarang membuat',
      'sistem Finance paralel, dilarang membuat sales_payment atau sales_receivable',
      'sebagai sumber kebenaran kedua.',
      '',
      'Yang dibutuhkan Finance minimal: pencatatan penerimaan pembayaran, verifikasi,',
      'dan piutang -- dengan kepemilikan di domain Finance. Sales hanya MEMBACA hasilnya.',
      '',
      'Begitu itu ada, status kewajiban (Upcoming/Due/Partially Paid/Paid/Overdue) dapat',
      'DITURUNKAN dari nilai kewajiban vs pembayaran terverifikasi -- tanpa satu pun',
      'kolom status disimpan di sisi Sales.'),
    concat_ws(chr(10),
      'INI YANG MEMBLOKIR BD-10, dan karena itu memblokir penyelesaian Sales Order:',
      'BD-01 mensyaratkan konfirmasi Finance bahwa kewajiban pembayaran sesuai terms sudah',
      'terpenuhi. Tanpa domain Finance, konfirmasi itu tidak punya tempat.',
      '',
      'PJL-12 sudah menyiapkan separuh jalannya: kewajiban pembayaran sudah ada, bernilai,',
      'dan berpemicu. Yang kurang tinggal sisi penerimaannya.')
  );
end $$;
