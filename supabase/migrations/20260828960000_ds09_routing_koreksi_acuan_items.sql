-- KOREKSI PEMILIK PRODUK (26 Agu 2026): halaman Routing dibangun dengan menyalin cetakan
-- halaman PELANGGAN, padahal acuan yang sudah DISETUJUI adalah halaman MASTER ITEM.
do $mig$
declare v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then return; end if;

  update build_tasks
     set detail_pekerjaan = detail_pekerjaan || chr(10) || concat_ws(chr(10),
       '',
       '--- 26 Agu 2026 — KOREKSI PEMILIK PRODUK atas halaman Routing ---',
       'Laporan pertama menyebut Routing "selesai". Pemilik produk melihat layarnya dan',
       'menyebutnya masih berantakan, dengan tiga pertanyaan yang semuanya benar:',
       '  - apakah judul halamannya sudah mengikuti aturan?',
       '  - kenapa pencariannya tidak seperti yang sudah disetujui?',
       '  - kenapa tidak ada toolbar tabel seperti sebelumnya?',
       '',
       'SEBAB AKARNYA, dan ini yang perlu diingat untuk 12 halaman sisanya:',
       'cetakan yang dipakai diambil dari halaman PELANGGAN, bukan dari halaman MASTER ITEM.',
       'Master Item adalah layar yang sudah ditinjau dan disetujui pemilik produk; Pelanggan',
       'kebetulan sudah dimigrasikan lebih dulu. Menyalin dari halaman terdekat menyebarkan',
       'apa pun yang salah di halaman itu.',
       '',
       'YANG DIPERBAIKI di Routing supaya sama dengan Master Item:',
       '  1. REMAH ROTI ditambahkan: Dashboard / Product & Engineering / Routing, dengan',
       '     tingkat tengah SENGAJA tidak bisa diklik (ia kelompok menu, bukan halaman).',
       '  2. JUDUL jadi "Daftar routing", dan pengantarnya jadi baris JUMLAH ("2 routing',
       '     tercatat"), bukan paragraf penjelasan.',
       '  3. PENCARIAN kembali MELIPAT. Diukur sesudahnya: lebar kotaknya 48px (ikon kaca',
       '     pembesar), bukan memenuhi toolbar.',
       '  4. KOTAK CENTANG "Tampilkan yang diarsipkan" DIGANTI SARINGAN Dropdown',
       '     Aktif / Diarsipkan / Semua status — bentuknya sama dengan saringan Master Item,',
       '     dan sekarang bisa menjawab "khusus yang diarsipkan" yang dulu mustahil.',
       '  5. TABEL size="lg" (baris kepala terukur 49px) dan KOLOMNYA BISA DIURUT — 5 kolom.',
       '     Sebelumnya seluruh kolom isSortable={false}.',
       '  6. DETAIL TAHAP pindah ke BARIS YANG BISA DIMEKARKAN (TableExpandRow), bukan tombol',
       '     "Detail" yang membuka kartu terpisah di bawah tabel. Aturan C.3: jangan menambal',
       '     sendiri kemampuan yang sudah dibawa DataTable.',
       '  7. PEMBAGIAN HALAMAN diterjemahkan ("Baris per halaman", "1-2 dari 2 routing").',
       '',
       'CATATAN PAKET: "Total durasi aktif" TIDAK bisa diurut, dan itu disengaja — judulnya',
       'memuat tombol Asal-Usul, sedangkan TableHeader yang bisa diurut adalah <button>.',
       'Tombol di dalam tombol adalah HTML tidak sah. Pelajaran ini sudah dibayar sekali di',
       'Master Item lewat galat hydration.',
       '',
       'HALAMAN KAMUS ikut dikoreksi di giliran yang sama, dua hal:',
       '  a. kelas `.halaman__saring` dipakai sebagai PEMBUNGKUS, padahal ia kelas untuk',
       '     KONTROLNYA (membatasi lebar 14rem). Akibatnya kedua saringan tertumpuk selebar',
       '     14rem dan tidak terbaca sebagai satu baris saringan.',
       '  b. remah roti ditambahkan (Dashboard / Administration / Glossary Queue) dan judulnya',
       '     dipendekkan jadi "Antrean istilah" dengan baris jumlah. Alasan yang dipakai untuk',
       '     melewatkannya semula — "Kamus item tingkat atas" — keliru: ia anak workspace',
       '     Administration, persis seperti Items anak Product & Engineering.'
     )
   where company_id = v_company_id and task_code = 'DS-09';

  -- ------------------------------------------------------------------
  -- Temuan yang DICATAT dan TIDAK DIKERJAKAN
  -- ------------------------------------------------------------------
  perform pastikan_kode_task_kosong('DS-12');
  insert into build_tasks (company_id, task_code, name, module_code, module_name, description,
    effect_description, urgency, status, origin, pic, detail_pekerjaan, notes)
  values (v_company_id, 'DS-12',
    'Halaman Bertabel yang Sudah Dimigrasikan Belum Mengikuti Cetakan Master Item',
    'DS', 'Design System',
    'Pelanggan dan Master Dokumen sudah memakai komponen Carbon, tetapi belum mengikuti anatomi yang disetujui di Master Item.',
    'Menentukan apakah layar bertabel terasa satu sistem atau kumpulan halaman yang mirip-mirip.',
    'penting', 'menunggu', 'temuan_claude', 'Claude Code',
    concat_ws(chr(10),
      'DITEMUKAN 26 Agu 2026 saat memperbaiki halaman Routing atas koreksi pemilik produk.',
      'Diperiksa di kode, bukan diduga:',
      '  - CustomersPage: seluruh kolom isSortable={false}; saringan arsip masih KOTAK CENTANG',
      '    di toolbar, bukan Dropdown; Pagination tanpa teks Bahasa Indonesia.',
      '  - DocumentsPage: seluruh kolom isSortable={false}; Pagination tanpa teks Bahasa',
      '    Indonesia.',
      '',
      'Kolom yang punya tombol urut TAPI tidak mengurut apa pun lebih buruk daripada tidak',
      'punya tombol sama sekali — itu kelas "terlihat berfungsi padahal tidak pernah hidup"',
      'yang sudah tiga kali terjadi di proyek ini.',
      '',
      'CATATAN: memperbaikinya berarti membangun baris tabel dari NILAI ASLI, bukan hanya id.',
      'Carbon mengurutkan berdasarkan nilai di baris; baris yang cuma berisi id menghasilkan',
      'tabel yang tombolnya ada dan tidak melakukan apa-apa. Pola yang benar sudah ada di',
      'RoutingsPage sejak 26 Agu 2026.'
    ),
    'Lahir dari koreksi pemilik produk atas halaman Routing.'
  );

  perform pastikan_kode_task_kosong('PRD-21');
  insert into build_tasks (company_id, task_code, name, module_code, module_name, description,
    effect_description, urgency, status, origin, pic, detail_pekerjaan, notes)
  values (v_company_id, 'PRD-21',
    'Kolom "Total Durasi Aktif" Menampilkan 0 Menit untuk Routing yang Memakai Laju',
    'PRD', 'Produksi',
    'Kolom total durasi aktif hanya menjumlahkan active_duration_minutes, sehingga tahap yang durasinya dihitung per unit tampil sebagai nol.',
    'Menentukan apakah angka durasi di daftar Routing bisa dipercaya untuk membandingkan alur produksi.',
    'penting', 'menunggu', 'temuan_claude', 'Claude Code',
    concat_ws(chr(10),
      'DITEMUKAN 26 Agu 2026 saat memverifikasi tampilan daftar Routing dengan data contoh.',
      '',
      'Sebuah routing yang seluruh tahapnya memakai LAJU (duration_per_unit_minutes) menampilkan',
      '"0 mnt" di kolom Total durasi aktif, karena rumusnya hanya menjumlahkan',
      'active_duration_minutes. Angkanya tidak salah hitung — ia menjawab pertanyaan yang',
      'berbeda dari yang dikira pembacanya.',
      '',
      'BUKAN cacat yang dibawa migrasi Carbon: rumusnya sama persis dengan sebelum migrasi.',
      'Dicatat sekarang karena baru terlihat saat halamannya diisi data contoh.',
      '',
      'YANG PERLU DIPUTUSKAN PEMILIK PRODUK, karena ini soal ARTI ANGKA dan bukan soal teknis:',
      '  - apakah kolom ini menampilkan durasi untuk SATU UNIT, untuk satu batch standar, atau',
      '  - apakah routing berbasis laju sebaiknya menampilkan "tergantung jumlah" alih-alih',
      '    sebuah angka yang terlihat pasti.',
      'Jangan memilih sendiri: rumus durasi ini dipakai Gantt produksi dan dashboard kapasitas.'
    ),
    'Lahir dari verifikasi tampilan Routing (DS-09).'
  );
end
$mig$;
