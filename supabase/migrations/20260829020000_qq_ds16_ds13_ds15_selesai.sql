-- Blok QQ (26 Agu 2026): DS-16 dibangun lebih dulu, lalu DS-14 (tiga sebab), DS-13, DS-15.
do $mig$
declare v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then return; end if;

  -- ===== DS-16 — pengawas dibangun, dibuktikan DUA ARAH =====
  update build_tasks
     set status = 'selesai', completed_at = now(),
         detail_pekerjaan = detail_pekerjaan || chr(10) || concat_ws(chr(10),
       '',
       '--- DITUTUP 26 Agu 2026 ---',
       'tests/elemen_mentah_halaman_internal.test.ts. Menolak DUA hal sekaligus di berkas',
       'halaman: elemen mentah (<button> <input> <table> <select> <textarea>) DAN <Table>',
       'Carbon yang tidak memakai kelas responsif.',
       '',
       'DIBUKTIKAN DUA ARAH, bukan sekadar hijau:',
       '  - <button> mentah disisipkan sungguhan ke CustomersPage -> tertangkap di baris 352.',
       '  - kelas .tabel-responsif dicabut sungguhan -> tertangkap di baris 414.',
       '  - keduanya dikembalikan, dan test hijau lagi.',
       '  - kata <table> di dalam KALIMAT PENJELASAN tidak dihitung (diuji tersendiri).',
       '',
       'PENGECUALIAN memakai penanda komentar pola DS-11, bukan nomor baris, dan hanya berlaku',
       'di berkas yang terdaftar: papan Gantt PPIC (6 tabel + 2 tombol) dan tiga',
       '<input type="hidden"> di Master Dokumen yang menjembatani FormData.',
       '',
       'KENAPA IA DIDAHULUKAN, dan ini yang paling penting: EMPAT dari tujuh tabel yang',
       'melewatkan kelas responsif berada DI DALAM BARIS YANG DIMEKARKAN. Tidak ada sapuan',
       'VISUAL jenis apa pun yang bisa melihatnya — hanya pembacaan berkas. Alasannya ditulis',
       'di kepala berkas pengawasnya sendiri, bukan hanya di sini.'
     )
   where company_id = v_company_id and task_code = 'DS-16';

  -- ===== DS-14 — TIGA sebab dikerjakan, TAPI BELUM DITUTUP =====
  update build_tasks
     set detail_pekerjaan = detail_pekerjaan || chr(10) || concat_ws(chr(10),
       '',
       '=== KETIGA SEBAB DIKERJAKAN 26 Agu 2026, MENURUT CAKUPANNYA ===',
       '',
       'SEBAB KETIGA DULU (paling luas), dan hasil pengukurannya MENGUBAH rencana:',
       '  Diukur lebar ALAMI 24 tabel yang terlihat pada 672px:',
       '    TIGA butuh lebih dari 672px : /documents 811px (8 kolom), /hr absensi 820px',
       '                                  (8 kolom), /items 776px (9 kolom).',
       '    NOL butuh lebih dari 1056px : yang terlebar 820px.',
       '    21 sisanya MUAT di 672px.',
       '  KARENA ITU ambang bawaannya TIDAK diubah. Menaikkan seluruhnya ke 1056px akan',
       '  mengubah 21 tabel yang hari ini benar jadi kartu di 672-1055px — kehilangan',
       '  pembandingan antar baris di tablet, untuk masalah milik tiga tabel.',
       '  Yang dibuat: kelas kedua .tabel-responsif--lebar (ambang 1056px) lewat MIXIN Sass,',
       '  bukan salinan CSS — menyalin 70 baris akan melahirkan persis kelas cacat yang',
       '  sedang diperbaiki. Dipakai di tiga tabel itu saja.',
       '  PENANDA PEMAKAIAN: 8 kolom atau lebih.',
       '',
       'SEBAB KEDUA: tujuh tabel tanpa kelas responsif diberi kelas + data-label pada tiap',
       '  selnya. Sensus sesudahnya: 36 dari 36 tabel Carbon memakai kelas responsif.',
       '',
       'SEBAB PERTAMA: toolbar tabel di bawah 42rem kini boleh MENINGGI dan isinya TURUN',
       '  BARIS, dengan tiap saringan selebar penuh. Tinggi tetap 48px Carbon sengaja dilepas',
       '  di rentang itu — 48px adalah tinggi untuk SATU baris.',
       '',
       'URUTANNYA DISENGAJA (perintah pemilik produk): sebab ketiga dulu, karena memperbaiki',
       'sebab kedua lebih dulu berarti tujuh tabel itu diperiksa dua kali.',
       '',
       '=== BELUM DITUTUP, DAN INI ALASANNYA ===',
       'Angka "11 kombinasi bercacat" adalah BATAS BAWAH. Pengukuran tidak pernah memekarkan',
       'satu baris pun, jadi EMPAT tabel di dalam baris yang dimekarkan belum terukur sama',
       'sekali — dan tenant uji kosong, sehingga barisnya memang tidak ada untuk dibuka.',
       '',
       'YANG DIBUTUHKAN SEBELUM DS-14 BOLEH DITUTUP: ukur keempat tabel itu dalam keadaan',
       'TERBUKA, dengan data yang dibuat lewat layar lebih dulu, lalu laporkan angka',
       'sebenarnya. JANGAN menutup task ini dengan angka batas bawah.'
     )
   where company_id = v_company_id and task_code = 'DS-14';

  -- ===== DS-13 — sebelas halaman dipindahkan ke KepalaHalaman =====
  update build_tasks
     set status = 'selesai', completed_at = now(),
         detail_pekerjaan = detail_pekerjaan || chr(10) || concat_ws(chr(10),
       '',
       '--- DITUTUP 26 Agu 2026 ---',
       'Kesebelas halaman kini memakai KepalaHalaman: Dashboard Proyek AI, Absensi, Debug,',
       'Kesiapan AI, Data Perusahaan, KPI, KPI Saya, Test Tenant, Laba Operasional,',
       'Process Mining, dan Apa yang Baru.',
       'Impor Breadcrumb/BreadcrumbItem ikut dicabut dari berkas yang tidak lagi memakainya.',
       '',
       'DashboardPage SENGAJA tidak diberi remah roti: ia akar navigasi, jadi tidak punya',
       'tingkat di atasnya. Diperiksa, bukan diasumsikan.'
     )
   where company_id = v_company_id and task_code = 'DS-13';

  -- ===== DS-15 — Sales Order dibereskan =====
  update build_tasks
     set status = 'selesai', completed_at = now(),
         detail_pekerjaan = detail_pekerjaan || chr(10) || concat_ws(chr(10),
       '',
       '--- DITUTUP 26 Agu 2026 ---',
       'Ketiga tabel mentah dipindahkan ke Table Carbon ber-.tabel-responsif dengan data-label',
       'di tiap sel: item SO, kekurangan bahan, dan riwayat pengiriman. Ketiganya berada di',
       'dalam baris yang dimekarkan — dan itu sebabnya mereka bertahan begitu lama.',
       '',
       'DITEMUKAN SEKALIAN, dan lebih berat daripada tabelnya: DUA <input> mentah bertinggi',
       '24px (h-6) untuk "alasan kunci ulang". Itu melanggar DUA aturan sekaligus — ukuran',
       'field medium Carbon 40px, dan target sentuh minimal 44px. Diganti TextInput Carbon.',
       '',
       'Sesudahnya: nol elemen mentah di berkas halaman di luar pengecualian tercatat.'
     )
   where company_id = v_company_id and task_code = 'DS-15';

  -- ===== QQ.6 — AUD-42 diperkuat: pembantu bersama, bukan hanya untuk penjaga =====
  update build_tasks
     set detail_pekerjaan = detail_pekerjaan || chr(10) || concat_ws(chr(10),
       '',
       '=== DIPERKUAT 26 Agu 2026 — KEJADIAN KELIMA, DAN KALI INI PADA SENSUS ===',
       'Sensus tabel menghitung 11 tabel mentah; dua di antaranya kata <table> di dalam',
       'KALIMAT PENJELASAN. Yang sebenarnya 9.',
       '',
       'YANG MEMBEDAKANNYA DARI EMPAT KEJADIAN SEBELUMNYA: korbannya bukan PENJAGA melainkan',
       'ALAT UKUR. Penjaga yang salah tuduh berbunyi keras dan langsung diperbaiki; sensus',
       'yang salah menghasilkan angka yang TERLIHAT WAJAR, lalu angka itu dipakai memutuskan',
       'seberapa besar sebuah pekerjaan.',
       '',
       'LINGKUP AUD-42 KARENA ITU DIPERLUAS: pembantu bersama pembuang komentar dipakai oleh',
       'PENJAGA, SENSUS, DAN SAPUAN — setiap penyisiran teks di proyek ini, bukan hanya test.',
       '',
       'SUDAH DIBUAT 26 Agu 2026: tests/util/tanpaKomentar.ts, dipakai pengawas DS-16.',
       'Ia mempertahankan PANJANG teks (isi komentar diganti spasi) supaya nomor baris tetap',
       'menunjuk tempat yang benar — syarat mutlak bagi penyisir yang melaporkan berkas:baris.',
       '',
       'SISA PEKERJAAN AUD-42: memindahkan penjaga-penjaga LAMA yang masih punya penyalin',
       'komentarnya sendiri (layar_publik_carbon.test.ts dan ui_raw_leak_watchdog.test.ts)',
       'ke pembantu bersama itu. HATI-HATI pada yang kedua: ia MEMBACA penanda komentar untuk',
       'pengecualiannya, jadi penandanya wajib dibaca dari teks ASLI sebelum komentar dibuang.'
     )
   where company_id = v_company_id and task_code = 'AUD-42';
end $mig$;
