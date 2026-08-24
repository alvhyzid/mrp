-- DS-01 (25 Agu 2026) — FONDASI DESAIN CARBON, disahkan pemilik produk (D-1), plus hasil DS-0.

do $$
declare v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then return; end if;

insert into build_tasks (
  company_id, task_code, name, module_code, module_name, description, effect_description,
  urgency, tags, pic, status, origin, detail_pekerjaan, super_urgent_since
) values (
  v_company_id, 'DS-01', 'Fondasi Desain Carbon sebagai Standar UI Seluruh Sistem', 'DS', 'Desain Sistem',
  'Adopsi PENUH Carbon Design System — pustaka @carbon/react, font IBM Plex, dan konsekuensi tampilannya (estetika IBM enterprise fungsional-datar, bukan gaya SaaS membulat). Menjadi fondasi UI/UX untuk seluruh halaman yang sudah dibangun DAN yang akan dibangun.',
  'Menjawab keluhan berulang pemilik produk bahwa layar terasa "dibuat orang berbeda". Setiap sesi ber-UI sesudahnya wajib Carbon-first; komponen kustom wajib didokumentasikan sebagai domain pattern, bukan improvisasi per halaman.',
  'super_urgent', array['desain','carbon','fondasi','ui'], 'Claude Code + Pemilik Produk', 'menunggu', 'pemilik_produk',
  E'DISAHKAN PEMILIK PRODUK 25 Agu 2026 (D-1). Alasannya dicatat apa adanya karena INI yang mengikat:\n' ||
  E'  "Apa yang membuat punya kita lebih baik, kalau konsistensi saja tidak bisa kita terapkan."\n' ||
  E'Alternatif "governance + token di atas stack sekarang" DITOLAK.\n\n' ||
  E'D-5 juga disahkan: jendela waktu TERBUKA. Pengisian MLVT ditunda, tidak ada bentrok jadwal.\n\n' ||
  E'URUTAN DITETAPKAN PEMILIK PRODUK: fondasi Carbon DIDAHULUKAN, baru empat layar penyiapan awal\n' ||
  E'(MST-26 setelan perusahaan, MST-22 pabrik, MST-23 work center, shift). Alasannya: keempatnya\n' ||
  E'lahir langsung Carbon-first sehingga tidak ditulis dua kali. PLT-05 ikut menunggu, alasan sama.\n\n' ||
  E'=== HASIL DS-0 NOMOR 2 (KELAYAKAN TEKNIS) — DIUJI, BUKAN DIBACA ===\n\n' ||
  E'KESIMPULAN: BERJALAN. Stop condition DS-0 TIDAK terpicu.\n\n' ||
  E'Diuji dengan membangun aplikasi Next.js 16.3.0 + React 19.2.8 terpisah di luar repo, memasang\n' ||
  E'@carbon/react 1.114.0, merender Button/TextInput/DataTable/Modal, lalu menjalankan build\n' ||
  E'produksi sungguhan. BUILD LULUS.\n\n' ||
  E'BUKTI DUKUNGAN VERSI (dari registry npm resmi, bukan ingatan):\n' ||
  E'  @carbon/react 1.114.0, terbit 12 Agu 2026 (13 hari lalu -- aktif dirawat)\n' ||
  E'  peerDependencies: react ^16.8.6 || ^17.0.1 || ^18.2.0 || ^19.0.0  -> React 19 DIDUKUNG RESMI\n' ||
  E'  peer wajib lain: sass ^1.33.0\n' ||
  E'  @carbon/charts-react 1.27.18 juga mendukung React 19.\n\n' ||
  E'HAMBATAN YANG DITEMUKAN, DAN JALAN RESMINYA:\n' ||
  E'  Build PERTAMA GAGAL dengan 90 error "Module not found: Can t resolve\n' ||
  E'  ~@ibm/plex/IBM-Plex-Mono/fonts/...". Sebabnya: Carbon memancarkan url(~@ibm/plex/...), dan\n' ||
  E'  awalan ~ adalah sintaks WEBPACK. Next.js 16 memakai Turbopack, yang tidak mengenalnya.\n\n' ||
  E'  JALAN RESMINYA ADA dan terbukti: @carbon/styles menyediakan saklar $css--font-face\n' ||
  E'  (didokumentasikan di scss/_config.scss). Dengan\n' ||
  E'      @use "@carbon/react" with ($css--font-face: false);\n' ||
  E'  build LULUS, dan IBM Plex dimuat lewat next/font/google (IBM_Plex_Sans + IBM_Plex_Mono).\n' ||
  E'  Terbukti: 11 berkas font disajikan sendiri (188 KB), 19 aturan @font-face dari next/font,\n' ||
  E'  NOL @font-face dari Carbon.\n\n' ||
  E'RESEP YANG SUDAH TERUJI, tinggal dipakai:\n' ||
  E'  1. npm i @carbon/react sass\n' ||
  E'  2. app/carbon.scss  ->  @use "@carbon/react" with ($css--font-face: false);\n' ||
  E'  3. next.config: sassOptions.includePaths = ["node_modules"]\n' ||
  E'  4. IBM Plex lewat next/font/google di layout\n' ||
  E'  5. komponen Carbon butuh "use client"\n\n' ||
  E'UKURAN, dilaporkan apa adanya: CSS Carbon penuh = 816 KB sebelum kompresi. Itu SELURUH\n' ||
  E'stylesheet karena @use "@carbon/react" menarik semuanya. Perlu diputuskan apakah memakai impor\n' ||
  E'selektif per komponen -- keputusan itu BELUM diambil dan jangan diputuskan sendiri.\n\n' ||
  E'=== DS-0 NOMOR 4 (TABRAKAN DENGAN ATURAN YANG SUDAH KITA TULIS) ===\n\n' ||
  E'Diukur dari paket Carbon, bukan dari ingatan:\n\n' ||
  E'  UKURAN KONTROL RESMI CARBON: xs 24px, sm 32px, MD 40px, lg 48px, xl 64px, 2xl 80px.\n' ||
  E'  -> Aturan kita "MEDIUM Carbon = 40px" COCOK PERSIS. Tidak ada tabrakan.\n' ||
  E'  -> Ketegangan 44px yang sudah kita catat TERKONFIRMASI NYATA, dan Carbon menyediakan\n' ||
  E'     jalan keluarnya: ukuran lg = 48px, di atas 44px. Keputusan memakai lg di lantai\n' ||
  E'     produksi jadi pilihan yang sah di dalam Carbon, bukan penyimpangan darinya.\n\n' ||
  E'  BREAKPOINT RESMI CARBON: sm 320px (4 kolom), md 672px (8), lg 1056px (16),\n' ||
  E'  xlg 1312px (16), max 1584px (16).\n' ||
  E'  -> Empat lebar uji kita (360/768/1280/1920) masing-masing jatuh di pita BERBEDA:\n' ||
  E'     sm / md / lg / max. Cocok, tidak bertabrakan.\n' ||
  E'  -> TAPI ADA CELAH: pita xlg (1312-1583px) TIDAK PERNAH DIUJI sama sekali. Itu lebar\n' ||
  E'     laptop besar yang lazim. Perlu diputuskan apakah 1440px ditambahkan ke daftar uji.\n\n' ||
  E'  ANATOMI MODAL: aturan kita sudah menyalin anatomi Carbon (Header/Body/Footer, tombol\n' ||
  E'  lebar penuh). Tidak ada tabrakan yang ditemukan.\n\n' ||
  E'=== YANG BELUM DIKERJAKAN DARI DS-0 ===\n' ||
  E'  Nomor 1 (inventaris stack UI aktual), 3 (audit inkonsistensi -> Design Debt Register),\n' ||
  E'  4 (tabel pemetaan kanonik), 5 (estimasi 2 layar pilot). Nomor 2 dan pemeriksaan tabrakan\n' ||
  E'  didahulukan atas permintaan eksplisit pemilik produk.',
  now()
) on conflict (company_id, task_code) do nothing;

end $$;
