-- PP.2 (26 Agu 2026): hasil sapuan SELURUH halaman dengan ukuran dua tepi.
-- Angka inilah yang menentukan seberapa besar DS-14, dan dilaporkan SEBELUM diperbaiki.
do $mig$
declare v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then return; end if;

  update build_tasks
     set detail_pekerjaan = detail_pekerjaan || chr(10) || concat_ws(chr(10),
       '',
       '=== PP.2 — HASIL SAPUAN SELURUH HALAMAN, 26 Agu 2026 (SEBELUM diperbaiki) ===',
       '',
       'Lima halaman terlalu sedikit untuk menentukan besarnya, jadi disapu SELURUHNYA:',
       '29 rute berkerangka aplikasi x 6 lebar wajib = 174 kombinasi, seluruhnya terukur.',
       '',
       'DUA UKURAN, DUA JAWABAN YANG SANGAT BERBEDA:',
       '  Ukuran LAMA (gulir menyamping) : 0 cacat. SELURUH 29 halaman dinyatakan LULUS.',
       '  Ukuran BARU (dua tepi)         : 11 kombinasi bercacat di 4 halaman.',
       '                                   - meluber ke KANAN tanpa gulir: 8 kombinasi, 4 rute',
       '                                   - terpotong ke KIRI           : 3 kombinasi, 2 rute',
       '',
       'EMPAT HALAMAN yang terkena, dari 29: /documents, /hr, /items, /warehouse.',
       'SELURUHNYA hanya di 360, 672, dan 768 px. Di 1280, 1440, dan 1920 nol cacat.',
       '',
       'YANG HILANG BUKAN CUMA LABEL — INI BAGIAN TERPENTINGNYA:',
       '  /documents 768px : kolom "Aksi" di 782..811 pada layar 768 -> TOMBOL AKSINYA',
       '                     tidak bisa dijangkau sama sekali.',
       '  /hr 672 & 768px  : kolom "Aksi" di 776..836 -> sama, tombolnya hilang.',
       '  /warehouse 360px : kolom "Aksi" di 504..533, dan tab "Saldo awal (lot baru)"',
       '                     terpotong di 199..363.',
       '  /documents 360px : DUA saringan hilang seluruhnya di tepi kiri —',
       '                     "Semua jenis" (-316..-238) dan "Semua departemen" (-174..-48).',
       '  /items 360px     : saringan "Tipe" (-47..-19).',
       '  /items 672 & 768 : kolom "Status" terpotong.',
       '',
       'SEBAB YANG BERBEDA UNTUK TEPI KANAN DI 360px, ditemukan saat menelusuri angkanya:',
       'sebagian tabel TIDAK memakai kelas .tabel-responsif, jadi ia TETAP berbentuk tabel di',
       'layar sempit alih-alih membalik jadi kartu — lalu kolomnya terpotong.',
       'Diukur: /hr punya 2 <Table>, hanya 1 ber-.tabel-responsif; /warehouse punya 3 <Table>,',
       'hanya 1 ber-.tabel-responsif. Ini kelas "dua jalur hidup" lagi, di dalam satu halaman.',
       '',
       'ARTINYA UNTUK LINGKUP DS-14: bukan satu perbaikan melainkan TIGA sebab terpisah —',
       '  1. toolbar yang meratakan isinya ke kanan lalu memotong yang paling kiri;',
       '  2. tabel yang tidak ikut membalik jadi kartu karena kelasnya belum dipasang;',
       '  3. kolom "Aksi" yang jatuh ke luar layar di lebar menengah.',
       'Ketiganya menghasilkan gejala yang sama dan TIDAK bisa diperbaiki dengan satu tambalan.'
     )
   where company_id = v_company_id and task_code = 'DS-14';
end $mig$;
