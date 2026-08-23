-- RSP-01 selesai + AUD-15 (bom waktu tanggal UTC di test).

-- ============================================================================
-- RSP-01 — SELESAI. Cakupannya ternyata LEBIH LUAS dari yang tertulis di task.
--
-- Task menyebut penyebabnya "tabel Item Master". Setelah diukur elemen per elemen,
-- penyebabnya berlapis TIGA, dan tabel justru yang paling ringan.
-- ============================================================================
update build_tasks
set status = 'selesai',
    completed_at = now(),
    name = 'Gulir Menyamping di Layar Sempit: Menu Samping, Toolbar Tabel, dan Kolom yang Terpotong Diam-diam',
    notes = coalesce(notes, '') || E'\n\n' ||
      '24 Agu 2026 — SELESAI. Terukur di 360/768/1280/1920 px: NOL elemen meluber, NOL gulir menyamping. ' ||
      E'\n\nPENYEBAB SEBENARNYA ADA TIGA, bukan satu seperti yang tertulis di task:\n' ||
      E'1. MENU SAMPING selebar 256 px tetap terpasang di lebar berapa pun. Di layar 360 px isi halaman ' ||
      E'cuma kebagian ~210 px dan teksnya patah SATU HURUF PER BARIS. Ini penyebab terbesar, dan berlaku ' ||
      E'di SELURUH halaman, bukan cuma Item Master.\n' ||
      E'2. TOOLBAR TABEL: kolom cari + tombol aksi berdampingan butuh lebih dari 360 px, dan tombolnya ' ||
      E'whitespace-nowrap sehingga tidak bisa menyusut.\n' ||
      E'3. KOLOM TABEL DIPOTONG DIAM-DIAM: wadah tabel memakai overflow-hidden, jadi kolom yang tidak muat ' ||
      E'HILANG tanpa ada cara melihatnya. Ini yang paling berbahaya karena tidak tampak sebagai kerusakan — ' ||
      E'di 768 px dengan menu samping terpasang, kolom paling kanan lenyap tanpa jejak.\n' ||
      E'\nPERBAIKAN: menu jadi tombol buka-tutup di layar sempit (menutup sendiri saat pindah halaman); ' ||
      E'toolbar bertumpuk di layar sempit; tabel lebar menggulir DI DALAM wadahnya sendiri (overflow-x-auto); ' ||
      E'baris tabel jadi KARTU BERTUMPUK di bawah breakpoint md.\n' ||
      E'\nDIPASANG DI KOMPONEN BERSAMA (AppShell + DataTable), jadi SELURUH halaman ikut terbantu sekaligus. ' ||
      E'Tampilan layar lebar TIDAK tersentuh. TAPI tiap halaman TETAP butuh bukti visualnya sendiri: judul ' ||
      E'kolom yang masuk akal di kepala tabel belum tentu masuk akal sebagai label kartu.\n' ||
      E'\nTemuan sampingan yang ikut diperbaiki: kolom Biaya Standar muncul sebagai "Rp15.000" TANPA LABEL ' ||
      E'di tampilan kartu, karena judul kolomnya bukan teks biasa melainkan teks + ikon Asal-Usul. Angka ' ||
      E'rupiah tanpa keterangan adalah angka yang tidak bisa dibaca. Label kartu kini mengambil judul kolom ' ||
      E'yang sesungguhnya, apa pun bentuknya.\n' ||
      E'\nData uji: 3 item berpola RSP01-UJI-* dibuat di tenant uji (Company B) lalu DIHAPUS — sisa nol. ' ||
      E'Data PT ITM tidak disentuh.'
where task_code = 'RSP-01' and company_id = 1;

-- ============================================================================
-- AUD-15 — TEMUAN: 19 pemakaian toISOString() di test yang bisa jadi bom waktu.
-- ============================================================================
insert into build_tasks (
  company_id, task_code, name, module_code, module_name, description, effect_description,
  urgency, tags, pic, status, origin, detail_pekerjaan, notes
)
select 1, 'AUD-15',
  'Tanggal UTC di Test Bertabrakan dengan Perhitungan Waktu Lokal (19 Pemakaian Tersisa)',
  'AUD', 'Audit & Proses',
  'Test memakai new Date().toISOString().slice(0, 10) untuk "hari ini", yang memberi tanggal UTC. ' ||
  'Sebagian kode aplikasi menghitung tanggal/minggu dari waktu LOKAL. Di WIB (UTC+7), antara pukul ' ||
  '00:00-07:00 tanggal UTC masih KEMARIN, sehingga keduanya tidak sinkron.',
  'Test bisa gagal tanpa ada kode yang berubah, dan gagalnya terlihat seperti kerusakan mendadak. ' ||
  'Sudah terjadi sekali: production_batch_routing_bom_snapshot gagal dua run berturut-turut hanya ' ||
  'karena suite kebetulan berjalan Senin dini hari — batch terjadwal di minggu sebelumnya.',
  'penting',
  array['test', 'ci', 'waktu'],
  'Claude Code',
  'menunggu',
  'temuan_claude',
  'Tinjau 19 pemakaian toISOString().slice(0,10) di 11 berkas test (attendance_geo_qr_w1, ' ||
  'baseline_lock_separation, employee_crud_and_k8_standards, kpi_module, margin_watch, ' ||
  'operating_profit_payroll_period, planning_feasibility_stage_aware, prd12_work_order_status_lifecycle, ' ||
  'rate_capacity_and_shift_wage, step_progress_date_and_reject, todays_production_schedule). ' ||
  'Yang dibandingkan dengan perhitungan berbasis waktu LOKAL harus diganti ke tanggal lokal. ' ||
  'Yang murni disimpan & dibaca kembali tanpa dibandingkan dengan "minggu ini"/"hari ini" boleh tetap. ' ||
  'Pertimbangkan satu helper tanggal bersama di tests/ supaya tidak terulang di test baru.',
  'Ditemukan 24 Agu 2026 saat memperbaiki kegagalan CI. Yang paling perlu diingat: berkas ' ||
  'src/features/mrp/server/weekRange.ts SUDAH memuat peringatan persis soal ini di komentar ' ||
  'dateToDateString ("bukan toISOString, yang bisa mundur/maju 1 hari"). Peringatannya benar dan ada di ' ||
  'berkas yang tepat, tapi tetap terlewat karena penulis test tidak membuka berkas itu — peringatan ' ||
  'yang hanya hidup di komentar tidak menghentikan siapa pun.'
where not exists (select 1 from build_tasks where task_code = 'AUD-15' and company_id = 1);
