-- II (25 Agu 2026) — pelajaran KPI, gerbang AI, dan pengawas AUD-37.

do $$
declare v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then return; end if;

  if not exists (select 1 from build_tasks where task_code = 'AUD-38') then
    insert into build_tasks (company_id, task_code, name, module_code, module_name, description,
      effect_description, urgency, status, origin, pic, detail_pekerjaan, notes)
    values (v_company_id, 'AUD-38',
      'Gerbang Izin yang Membaca Data yang Tidak Dijamin Ada',
      'AUD', 'Audit & Governance',
      'isCapabilityUnlocked membaca ai_capability_status — tabel yang hanya terisi bila seseorang membuka dashboard.',
      'Sebuah kemampuan bisa terkunci atau terbuka tergantung siapa yang kebetulan membuka halaman apa hari itu.',
      'penting', 'selesai', 'temuan_claude', 'Claude Code',
      E'Sudah diperbaiki di giliran yang sama: gerbangnya menghitung LIVE, tidak lagi membaca\n' ||
      E'cache. Task ini dicatat TERSENDIRI, tidak ditenggelamkan di dalam AUD-36, karena\n' ||
      E'KELASNYA berbeda: AUD-36 soal data yang tertulis diam-diam; ini soal PENGAMAN YANG\n' ||
      E'TIDAK MENJAGA APA-APA.',
      E'KELAS "pengaman yang tidak menjaga apa-apa" sudah muncul berkali-kali dengan wajah\n' ||
      E'berbeda di proyek ini: tombol yang ada tapi tidak melakukan apa-apa, status yang\n' ||
      E'terdaftar tapi tidak pernah dicapai, alert yang ditampilkan tapi tidak pernah dipicu.\n' ||
      E'Yang ini bentuknya paling halus: gerbangnya BERFUNGSI, hanya sumber datanya yang tidak\n' ||
      E'dijamin ada.\n\n' ||
      E'PENYISIRAN (permintaan II.3): adakah gerbang atau pemeriksaan izin LAIN yang membaca\n' ||
      E'data yang tidak dijamin ada?\n' ||
      E'  JAWABAN: TIDAK ADA. isCapabilityUnlocked satu-satunya gerbang yang membaca tabel.\n' ||
      E'  Seluruh pemeriksaan izin lain hidup di src/lib/roles.ts, yang punya NOL panggilan\n' ||
      E'  basis data -- ia fungsi murni atas nama peran.\n' ||
      E'  Jadi kelas ini ada TEPAT SATU KALI, dan sekarang tertutup.');
  end if;

  if not exists (select 1 from build_tasks where task_code = 'KPI-05') then
    insert into build_tasks (company_id, task_code, name, module_code, module_name, description,
      effect_description, urgency, status, origin, pic, detail_pekerjaan, notes)
    values (v_company_id, 'KPI-05',
      'Tiga Baris Riwayat KPI Lama — Dipertahankan atau Dihapus?',
      'KPI', 'KPI & Analitik',
      'Tiga baris kpi_snapshots yang ada sekarang lahir dari cara lama (ditulis saat halaman dibuka).',
      'Menentukan apakah titik awal riwayat KPI berasal dari pengukuran yang disengaja atau dari satu kunjungan halaman.',
      'bisa_menunggu', 'menunggu', 'pemilik_produk', 'Pemilik Produk',
      E'Sodorkan dua pilihan beserta konsekuensinya, JANGAN putuskan sendiri.',
      E'FAKTA YANG DIPERIKSA, bukan dikira:\n' ||
      E'  Isi kpi_snapshots SELURUHNYA TIGA BARIS, dan ketiganya lahir dalam SATU MOMEN:\n' ||
      E'  24 Agu 2026 pukul 17:40:48 sampai 17:40:52 -- RENTANG EMPAT DETIK.\n' ||
      E'  Itu satu kunjungan halaman, bukan tiga periode pengukuran.\n' ||
      E'    margin_kontribusi        26 Jul-25 Agu 2026   nilai 0\n' ||
      E'    laba_operasional_bulanan 26 Jul-25 Agu 2026   nilai -73.352.547\n' ||
      E'    nilai_persediaan         24 Agu 2026 (1 hari) nilai 0\n\n' ||
      E'KONSEKUENSINYA LEBIH RINGAN DARI YANG DIKHAWATIRKAN: dengan SATU titik per metrik,\n' ||
      E'tidak ada tren sama sekali. Grafiknya tidak bisa menyesatkan tentang arah karena tidak\n' ||
      E'ada arah, dan perbandingan periode sebelumnya kosong.\n\n' ||
      E'YANG PERLU DIPERHATIKAN: "Nilai persediaan" berperiode SATU HARI. Dengan cara lama,\n' ||
      E'kunjungan berikutnya di hari berbeda akan melahirkan titik kedua -- dan sejak titik\n' ||
      E'kedua itulah grafiknya mulai merekam HARI KUNJUNGAN seolah-olah perjalanan angka.\n' ||
      E'Cara lama sudah dicabut sebelum itu terjadi.\n\n' ||
      E'PILIHAN A -- DIPERTAHANKAN: ketiganya pengukuran nyata pada momen nyata. Angkanya\n' ||
      E'  benar; yang keliru cuma alasan ia tercatat. Riwayatnya punya titik awal.\n' ||
      E'PILIHAN B -- DIHAPUS: riwayat KPI dimulai bersih, seluruhnya dari perekaman yang\n' ||
      E'  DISENGAJA lewat tombol "Rekam angka periode ini". Tidak ada campuran dua asal-usul\n' ||
      E'  di dalam satu grafik.\n\n' ||
      E'Claude Code TIDAK memilih. Ini soal arti angka, dan itu wilayah pemilik produk.');
  end if;

  update build_tasks set
    notes = coalesce(notes || E'\n\n','') ||
      E'=== PENGAWAS DITAMBAHKAN 25 Agu 2026 (permintaan II.5) ===\n' ||
      E'Cara bertahapnya disetujui, TAPI "bertahap" tanpa pengawas berarti dua jalur hidup\n' ||
      E'berdampingan selama berbulan-bulan -- kelas yang sudah dicatat.\n\n' ||
      E'tests/membaca_tidak_menulis.test.ts sekarang memuat DAFTAR 36 halaman yang belum\n' ||
      E'dipindah, dan dua pemeriksaan:\n' ||
      E'  1. halaman DI LUAR daftar yang mengambil sesinya sendiri -> MERAH.\n' ||
      E'  2. jumlah halaman yang mengambil sendiri TIDAK BOLEH NAIK dari 36.\n' ||
      E'Pemeriksaan kedua ada supaya seseorang tidak "memperbaiki" yang pertama dengan\n' ||
      E'menambahkan berkasnya ke daftar -- kebalikan dari tujuannya.\n\n' ||
      E'Dibuktikan menggigit: berkas halaman baru dengan cara lama disisipkan -> merah menyebut\n' ||
      E'nama berkasnya; dicabut -> hijau.\n\n' ||
      E'CARA MEMAKAI DAFTARNYA: saat sebuah halaman dimigrasikan ke Carbon, pindahkan sekalian\n' ||
      E'ke authedFetch lalu HAPUS barisnya dari daftar. Daftar itu hanya boleh MENYUSUT.'
  where task_code = 'AUD-37';
end $$;
