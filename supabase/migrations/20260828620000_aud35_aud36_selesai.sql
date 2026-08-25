-- AUD-35 & AUD-36 (25 Agu 2026) — keduanya selesai, dengan penjaga.

do $$
declare v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then return; end if;

  update build_tasks set status = 'selesai', completed_at = now(),
    notes = coalesce(notes || E'\n\n','') ||
      E'=== SELESAI 25 Agu 2026 ===\n\n' ||
      E'KOREKSI ATAS DUGAAN AWAL: sempat diduga cacat ini akibat pemasangan kerangka Carbon\n' ||
      E'(DS-04). TIDAK BENAR. Halaman ini sudah tidak bisa dibuka SEJAK LAHIR -- terbukti\n' ||
      E'karena ia sudah dialihkan ke /login saat audit navigasi, yang dijalankan SEBELUM\n' ||
      E'kerangka Carbon dipasang.\n\n' ||
      E'AKAR SEBENARNYA: halaman memanggil fetch(''/api/company/settings'') TANPA header\n' ||
      E'Authorization. Server proyek ini HANYA menerima Bearer -- parseBearerToken melempar\n' ||
      E'galat bila header tidak ada, dan tidak ada jalur cookie. Server menjawab 401, lalu\n' ||
      E'halaman itu SENDIRI mengalihkan penggunanya ke layar masuk.\n' ||
      E'Dari luar, ia tampak "butuh login" padahal penggunanya SUDAH login.\n\n' ||
      E'PERBAIKAN YANG DIPILIH, dan kenapa bukan sekadar menambahkan header di satu tempat:\n' ||
      E'diukur, 36 halaman menulis pengambilan tokennya MASING-MASING. 35 kebetulan benar;\n' ||
      E'yang ke-36 tidak, dan tidak ada satu tempat pun yang bisa diperiksa untuk mengetahuinya.\n' ||
      E'Dibuat src/lib/authedFetch.ts sebagai satu pintu, dan halaman ini memakainya.\n\n' ||
      E'BUKTI (bukan sekadar HTTP 200):\n' ||
      E'  Halaman dibuka dalam keadaan sudah masuk -> judul "Setelan perhitungan" tampil,\n' ||
      E'  17 field terbaca, peringatan "17 setelan belum pernah diisi" muncul.\n' ||
      E'  Diisi "26" pada Tanggal mulai periode gajian -> tombol simpan muncul -> ditekan ->\n' ||
      E'  "Tersimpan — 1 setelan tersimpan, berlaku sejak 2026-08-25."\n\n' ||
      E'PERIKSA KELASNYA (butir 1.4): SELURUH 39 halaman dibuka satu per satu di peramban\n' ||
      E'dengan akun sungguhan. 39 dari 39 UTUH, nol rusak oleh pemasangan kerangka.\n' ||
      E'Catatan kecil: pendeteksi galat sempat menandai /whats-new sebagai rusak -- POSITIF\n' ||
      E'PALSU, kata "500" tercocok di dalam "Rp1.500.000".\n\n' ||
      E'PENYISIRAN KODE: dari 6 pemanggilan fetch(/api/...) tanpa Authorization, HANYA halaman\n' ||
      E'ini yang cacat. Lima sisanya endpoint publik yang memang tanpa login (register, login,\n' ||
      E'konfirmasi penerimaan barang).\n\n' ||
      E'PENJAGA: tests/membaca_tidak_menulis.test.ts butir kedua gagal bila ada halaman\n' ||
      E'memanggil /api tanpa kredensial.'
  where task_code = 'AUD-35';

  update build_tasks set status = 'selesai', completed_at = now(),
    notes = coalesce(notes || E'\n\n','') ||
      E'=== SELESAI 25 Agu 2026 — DAN TERNYATA DUA TEMPAT, BUKAN SATU ===\n\n' ||
      E'Butir 2.2 benar: kpi_snapshots kelas yang SAMA. listKpiCards meng-upsert di dalam jalur\n' ||
      E'GET, jadi MEMBUKA HALAMAN KPI menulis data.\n\n' ||
      E'AKIBAT SAMPINGAN YANG LEBIH HALUS DAN LEBIH BURUK daripada sekadar menulis diam-diam:\n' ||
      E'riwayat KPI hanya bertambah BILA ADA YANG KEBETULAN MEMBUKA HALAMANNYA. Artinya grafik\n' ||
      E'tren yang terlihat rapi sebenarnya merekam "KAPAN ORANG MEMBUKA HALAMAN", bukan\n' ||
      E'"bagaimana angkanya bergerak". Dua hal yang sangat berbeda, dan tidak ada apa pun di\n' ||
      E'layar yang memberi tahu bedanya.\n\n' ||
      E'TEMUAN KETIGA, di tempat yang tidak dicari: isCapabilityUnlocked -- gerbang yang\n' ||
      E'menentukan boleh-tidaknya sebuah kemampuan AI dipakai -- MEMBACA ai_capability_status,\n' ||
      E'tabel yang hanya terisi bila ada yang membuka dashboard. Jadi gerbang keamanan sebuah\n' ||
      E'fitur bergantung pada apakah seseorang kebetulan membuka sebuah halaman. Bila tidak\n' ||
      E'pernah dibuka, gerbangnya menjawab "terkunci" untuk segalanya; bila dibuka berbulan\n' ||
      E'lalu, ia menjawab dari keadaan basi. Sekarang menghitung LIVE.\n\n' ||
      E'YANG DILAKUKAN:\n' ||
      E'  recomputeAiReadiness dipecah -> hitungKesiapanAi (murni) + simpanKesiapanAi (sengaja)\n' ||
      E'  listKpiCards berhenti menulis; penyimpanan pindah ke POST /api/kpi/snapshot\n' ||
      E'  Tombol "Rekam angka periode ini" ditambahkan di halaman KPI -- PEMICUNYA lahir\n' ||
      E'  bersama akibatnya, sesuai aturan proyek. Tanpa pemicu itu, riwayat KPI tidak akan\n' ||
      E'  pernah bertambah lagi.\n' ||
      E'  Pola yang dicontoh: takeAiProjectSnapshot, yang sudah lebih dulu benar.\n\n' ||
      E'BUKTI NEGATIF (butir 2.3):\n' ||
      E'  Baseline dinolkan, lalu /ai-readiness, /kpi, dan /ai-project masing-masing dibuka\n' ||
      E'  LIMA KALI (15 pemuatan halaman).\n' ||
      E'  ai_capability_status: 0 -> 0.  kpi_snapshots: 0 -> 0.\n' ||
      E'  Tombol rekam ditekan -> "0 KPI direkam untuk periode ini" (tenant fixture memang\n' ||
      E'  belum punya satu pun KPI di registry -- jalurnya terbukti jalan, angkanya jujur nol).\n\n' ||
      E'PENJAGA: tests/membaca_tidak_menulis.test.ts. Dibuktikan MERAH lalu HIJAU.\n' ||
      E'Versi pertama penjaga ini MENUDUH TIGA berkas yang bersih -- ketiganya memanggil\n' ||
      E'visiting.delete(itemId), Set JavaScript biasa di penelusuran BOM rekursif. Polanya\n' ||
      E'diperketat: wajib ada rantai .from(''tabel'') mendahuluinya.\n\n' ||
      E'SATU PENGECUALIAN YANG DISENGAJA: getDocumentSignedUrl mencatat siapa membuka dokumen\n' ||
      E'TERBATAS ke document_access_log. Di sini "membaca yang menulis" bukan cacat melainkan\n' ||
      E'seluruh gunanya -- ia menulis CATATAN TENTANG PEMBACAAN ITU SENDIRI, bukan menulis\n' ||
      E'ulang data yang sedang dibaca.'
  where task_code = 'AUD-36';

  if not exists (select 1 from build_tasks where task_code = 'AUD-37') then
    insert into build_tasks (company_id, task_code, name, module_code, module_name, description,
      effect_description, urgency, status, origin, pic, detail_pekerjaan, notes)
    values (v_company_id, 'AUD-37',
      'Tiga Puluh Enam Halaman Mengambil Token Sendiri-Sendiri',
      'AUD', 'Audit & Governance',
      'Diukur 25 Agu 2026: 36 halaman menulis pengambilan access token dan pemanggilan API-nya masing-masing.',
      'Satu halaman yang keliru tidak gagal berisik -- ia mengalihkan penggunanya ke layar masuk, dan tampak seperti "butuh login".',
      'penting', 'menunggu', 'temuan_claude', 'Claude Code',
      E'Pindahkan halaman lama ke src/lib/authedFetch.ts SECARA BERTAHAP, sambil layarnya\n' ||
      E'dimigrasikan ke Carbon -- bukan sebagai penyisiran tersendiri.\n' ||
      E'Alasannya: menyentuh 36 halaman sekaligus untuk perubahan yang tidak terlihat di layar\n' ||
      E'adalah perubahan besar tanpa cara memeriksanya.',
      E'Lahir dari AUD-35. Ke-35 halaman lain KEBETULAN benar hari ini -- dan itu justru\n' ||
      E'masalahnya: tidak ada satu tempat pun yang bisa diperiksa untuk memastikannya.\n' ||
      E'Penjaganya sudah ada (tests/membaca_tidak_menulis.test.ts butir kedua), jadi halaman\n' ||
      E'BARU tidak bisa lagi lahir dengan cacat yang sama. Task ini soal yang LAMA.');
  end if;
end $$;
