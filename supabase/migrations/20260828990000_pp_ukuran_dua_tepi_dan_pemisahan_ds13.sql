-- Blok PP (26 Agu 2026): ukuran bukti visual diperbaiki (dua tepi, enam lebar),
-- DS-14 naik jadi mendesak, dan DS-13 dipisah jadi tiga menurut bobotnya.
do $mig$
declare v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then return; end if;

  -- ===== PP.1 — DS-14 naik jadi MENDESAK, dan alasannya bukan cacatnya sendiri =====
  update build_tasks
     set urgency = 'mendesak',
         name = 'Ukuran Bukti Visual Hanya Menangkap SATU ARAH — Elemen yang Terpotong ke Kiri Lolos Diam-diam',
         notes = concat_ws(chr(10), coalesce(notes, ''), '',
           '=== DINAIKKAN JADI MENDESAK 26 Agu 2026 — KEPUTUSAN PEMILIK PRODUK ===',
           'Alasannya BUKAN cacatnya sendiri, melainkan ALAT UKURNYA:',
           '',
           '  "Ukuran yang dipakai berbulan-bulan — tidak boleh ada gulir menyamping — hanya',
           '   menangkap SATU ARAH. Yang meluber ke kanan berbunyi; yang terpotong ke kiri',
           '   dipotong diam-diam karena halamannya tidak menggulir.',
           '   Artinya setiap halaman yang pernah dinyatakan lulus lima lebar BELUM diperiksa',
           '   untuk arah ini — termasuk 32 halaman yang baru saja dikerjakan."',
           '',
           'YANG SUDAH DIKERJAKAN 26 Agu 2026 — UKURANNYA, bukan hanya kasusnya:',
           '  1. Aturan responsive CLAUDE.md butir 5 dan 6 ditulis ulang: enam lebar wajib,',
           '     dan bukti visual WAJIB memeriksa KEDUA tepi.',
           '  2. docs/governance/cetakan-halaman-data.md bagian 6c: tiga pemeriksaan terpisah',
           '     (gulir, tepi kanan, tepi kiri) beserta daftar yang TIDAK boleh dihitung cacat.',
           '  3. Judul bagian 6b cetakan dikoreksi dari "di bawah 768px" jadi "di bawah 672px" —',
           '     isinya sejak awal menyebut 42rem. Angka 768 di judul berbahaya justru karena',
           '     768 adalah lebar uji wajib: yang percaya judul itu mengira sudah menguji tepat',
           '     di titik baliknya padahal belum.',
           '',
           'PENGUKURNYA SENDIRI SEMPAT SALAH TUDUH, dan diperketat di giliran yang sama sesuai',
           'aturan proyek: ia melaporkan judul kolom tabel di 360px sebagai lima cacat, padahal',
           '.tabel-responsif thead memakai teknik baku "terbaca pembaca layar saja" (kotak 1x1',
           'px ber-clip-path). Yang menandai sengaja-disembunyikan adalah TEKNIKNYA, bukan',
           'POSISINYA. Dibuktikan dua arah: saringan yang benar-benar hilang tetap tertangkap.')
   where company_id = v_company_id and task_code = 'DS-14';

  -- ===== PP.3 — DS-13 dipisah: yang tersisa di sini HANYA butir (a) =====
  update build_tasks
     set name = 'Sebelas Halaman Menulis Remah Roti Sendiri — Sudah Carbon Lebih Dulu, Jadi Tidak Masuk Sapuan',
         description = concat_ws(chr(10),
           'KepalaHalaman dipakai 19 dari 39 halaman. Delapan sisanya memang dikecualikan.',
           'Sebelas halaman masih menulis <Breadcrumb> sendiri di dalam halamannya.'),
         notes = concat_ws(chr(10), coalesce(notes, ''), '',
           '=== DIPISAH 26 Agu 2026 ATAS KEPUTUSAN PEMILIK PRODUK ===',
           'DS-13 semula memuat TIGA temuan dengan bobot yang berbeda. Dipisah supaya urutannya',
           'bisa ditentukan:',
           '  DS-13 (task ini) — sebelas halaman menulis remah roti sendiri.',
           '  DS-15            — tiga tabel mentah di SalesOrdersPage tanpa tercatat sebagai',
           '                     pengecualian di mana pun.',
           '  DS-16            — TIDAK ADA pengawas elemen mentah untuk halaman internal.',
           '',
           'DS-16 DIKERJAKAN LEBIH DULU di antara ketiganya. Alasannya diucapkan pemilik produk',
           'dan tepat: tanpa pengawasnya, DS-13 dan DS-15 AKAN LAHIR LAGI.',
           '',
           'SEBAB TEMUAN INI LAYAK DIINGAT, dan sudah naik jadi aturan di HANDOFF:',
           'kesebelas halaman itu terlewat justru karena mereka sudah Carbon LEBIH DULU —',
           'daftar sapuan disusun dari "halaman yang BELUM dikerjakan", dan halaman yang sudah',
           'dikerjakan dengan cara lama tidak pernah ada di daftar itu.',
           'ATURAN: sapuan wajib bertolak dari SELURUH halaman, bukan dari daftar yang tersisa.')
   where company_id = v_company_id and task_code = 'DS-13';

  perform pastikan_kode_task_kosong('DS-15');

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description,
    effect_description, urgency, status, origin, pic, detail_pekerjaan, notes)
  values (v_company_id, 'DS-15',
    'Tiga Tabel Mentah di Sales Order Tanpa Tercatat Sebagai Pengecualian',
    'DS', 'Design System',
    concat_ws(chr(10),
      'SalesOrdersPage memuat tiga <table> mentah ber-Tailwind tulis tangan di baris 631,',
      '1130, dan 1171 — tabel rincian di dalam baris yang dimekarkan: item SO, hasil',
      'kelayakan bahan, dan riwayat pengiriman.'),
    concat_ws(chr(10),
      'Ketiganya memakai rounded-md, yang bertentangan dengan sudut tajam Carbon, dan warna',
      'text-muted-foreground tulis tangan. Perbaikan pada komponen tabel bersama tidak akan',
      'sampai ke sana.'),
    'penting', 'menunggu', 'temuan_claude', 'Claude Code',
    concat_ws(chr(10),
      'BEDANYA DENGAN PENGECUALIAN YANG SAH: papan Gantt PPIC juga <table> mentah, tapi ia',
      'TERCATAT sebagai pengecualian beserta alasannya (kisi waktu ber-table-fixed yang bisa',
      'dijatuhi, dan Carbon tidak punya komponen Gantt). Yang ini tidak tercatat di mana pun.',
      '',
      'Jadi yang perlu diputuskan lebih dulu: apakah tabel rincian di dalam baris yang',
      'dimekarkan MEMANG perlu jadi pengecualian, atau memang harus pindah ke komponen',
      'bersama. Salah satu dari keduanya benar; yang tidak boleh adalah tetap tak tercatat.'),
    concat_ws(chr(10),
      'Dipisah dari DS-13 pada 26 Agu 2026 (blok PP.3).',
      'Dikerjakan SESUDAH DS-16 — tanpa pengawasnya, hal yang sama lahir lagi di halaman lain.'));

  perform pastikan_kode_task_kosong('DS-16');

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description,
    effect_description, urgency, status, origin, pic, detail_pekerjaan, notes)
  values (v_company_id, 'DS-16',
    'TIDAK ADA Pengawas Elemen Mentah untuk Halaman INTERNAL — Dikerjakan Lebih Dulu',
    'DS', 'Design System',
    concat_ws(chr(10),
      'Tidak ada satu pun test yang menolak <button>/<input>/<table> mentah di halaman',
      'internal. tests/layar_publik_carbon.test.ts hanya menjaga layar publik, dan',
      'tests/ui_raw_leak_watchdog.test.ts menjaga hal yang berbeda (kebocoran identifier).'),
    concat_ws(chr(10),
      'Inilah sebab DS-13 dan DS-15 bisa ada tanpa ada yang menyadarinya. Tanpa pengawas ini,',
      'keduanya AKAN LAHIR LAGI di halaman berikutnya — dan tidak ada yang mengingatkan.'),
    'mendesak', 'menunggu', 'temuan_claude', 'Claude Code',
    concat_ws(chr(10),
      'DIKERJAKAN LEBIH DULU di antara DS-13, DS-15, dan DS-16. Alasan pemilik produk:',
      '"(c) yang paling menentukan — tanpa itu, (a) dan (b) akan lahir lagi."',
      '',
      'SUDAH TERCATAT SEBAGAI BAGIAN DS-2 di CLAUDE.md, beserta syaratnya: gagal keras bila',
      'ada elemen mentah di berkas halaman, DENGAN daftar pengecualian eksplisit dan beralasan',
      '(mis. papan Gantt PPIC dan tabel cetak surat jalan).',
      '',
      'PELAJARAN YANG WAJIB DIPAKAI, dari lima kali penjaga salah tuduh dalam satu hari:',
      '  - buang KOMENTAR sebelum menyisir; "menyebut <input> di dalam kalimat penjelasan"',
      '    sudah dua kali dituduh sebagai kode;',
      '  - pengecualian dikunci ke PENANDA KOMENTAR di dalam berkasnya (pola DS-11 yang sudah',
      '    lunas), BUKAN ke nomor baris;',
      '  - buktikan DUA ARAH: sisipkan elemen mentah palsu, pastikan tertangkap, lalu cabut.',
      '',
      'PERIKSA JUGA komponen bersama, bukan hanya halaman: tombol info Asal-Usul',
      '(src/components/ui/provenance-info-button.tsx) sendiri memakai <button> mentah',
      'ber-Tailwind tulis tangan — ditemukan 26 Agu 2026 saat mengukur tepi layar.'),
    concat_ws(chr(10),
      'Dipisah dari DS-13 pada 26 Agu 2026 (blok PP.3), dan DINAIKKAN jadi yang pertama.'));

  -- ===== PP.8 — alasan penundaan AUD-46 diterima, temuannya dicatat =====
  update build_tasks
     set notes = concat_ws(chr(10), coalesce(notes, ''), '',
           '=== PP.8 — ALASAN PENUNDAAN DITERIMA PEMILIK PRODUK, 26 Agu 2026 ===',
           'Alasan yang diterima, dikutip supaya bentuknya bisa dipakai lagi:',
           '  "Menyisipkan langkah CI yang belum pernah berjalan ke dalam giliran yang sedang',
           '   memverifikasi 59 berkas berarti menambah satu hal yang bisa gagal pada',
           '   perubahan terluas sejauh ini."',
           '',
           'Temuan backup-db.yml (cron harian + SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF',
           'sudah ada) DICATAT khusus supaya sesi berikutnya tidak menyelidikinya lagi.')
   where company_id = v_company_id and task_code = 'AUD-46';

  -- ===== PP.9 — batas jujur sapuan OO.4 ditegaskan =====
  update build_tasks
     set notes = concat_ws(chr(10), coalesce(notes, ''), '',
           '=== PP.9 — BATAS SAPUAN DITERIMA DAN WAJIB TERCATAT, 26 Agu 2026 ===',
           'Kalimat pemilik produk, dicatat apa adanya:',
           '  "Sapuan mencocokkan kode dan kata penutup di baris yang sama. Yang membuktikan',
           '   kelasnya tertutup hari ini bukan sapuan itu, melainkan kedua project kini',
           '   290 dari 290."',
           '',
           'Bedanya penting: sapuan menjawab "apakah pernah terjadi"; hitungan migrasi menjawab',
           '"apakah sedang terjadi". Hanya yang kedua yang bisa diperiksa ulang kapan saja.')
   where company_id = v_company_id and task_code = 'AUD-45';
end $mig$;
