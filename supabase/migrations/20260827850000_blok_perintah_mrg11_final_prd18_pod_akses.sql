-- BLOK PERINTAH (23 Agu 2026) -- keputusan final penggolongan biaya SDM (3
-- golongan, bukan 2), penetapan 30 karyawan, wewenang Finance langsung, dasar
-- pembagian jumlah batch; PRD-18 pertanyaan terbuka ditutup; PLT-05 naik jadi
-- prasyarat keras; temuan arkeologi POD (F.3, sungguhan dicoba lewat Playwright
-- di localhost:3000, 360px, fixture Company B dibersihkan total); task baru
-- "HP siapa" (G) dan akses sistem data nyata (H.4, SUPER URGENT).
--
-- Bagian A-G: MURNI PENCATATAN (tidak ada kode/fitur dibangun di migrasi ini).
do $$
declare
  v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then
    raise notice 'Perusahaan PT ITM tidak ditemukan -- migrasi dilewati (no-op).';
    return;
  end if;

  -- A/B/C. MRG-11 -- keputusan FINAL, 3 golongan, penetapan 30 karyawan,
  -- wewenang & dasar pembagian sudah dijawab. TIDAK ADA pertanyaan terbuka
  -- tersisa (menggantikan draf "usulan" sebelumnya secara penuh).
  update build_tasks
  set detail_pekerjaan = E'KEPUTUSAN FINAL (23 Agu 2026) -- LENGKAP, tidak ada pertanyaan terbuka tersisa. Menggantikan draf sebelumnya (2 golongan) secara penuh.\n\n' ||
    E'TIGA GOLONGAN (bukan dua): DIRECT COST (menempel ke batch) / MANUFACTURING OVERHEAD (menempel ke produksi, MASUK HPP, dibagi ke batch bersama biaya direct) / GENERAL & ADMINISTRATIVE (TIDAK masuk HPP sama sekali, langsung jadi beban periode). Alasan: bila seluruh non-direct digabung jadi satu "indirect", gaji Direktur & General Manager ikut membebani HPP MLVT -- keliru menurut standar akuntansi biaya, membuat produk terlihat lebih mahal dari kenyataan; beban administrasi tidak pernah masuk biaya produk. Panduan pemisahan: overhead pabrik mendukung PRODUKSI langsung; beban administrasi mendukung PERUSAHAAN, bukan produksi. Overhead pabrik dibagi ke batch dengan dasar SAMA seperti biaya direct (jumlah batch); beban administrasi TIDAK dibagi sama sekali.\n\n' ||
    E'PENETAPAN FINAL 30 KARYAWAN AKTIF PT ITM (ditetapkan, bukan lagi usulan):\n' ||
    E'DIRECT (19): Aziz Maulana, Diana Ayu Agustin, Ezra Ariya Septiano, Maylani Suhesti, Mi''asih, Muhammad Alif Alhamad, Rumanik (Operator Produksi, bulanan); Bilal, Diah, Lely, Mayang, Mina, Nanda, Nindi, Yunita, Zidan, Rohmat (Operator Produksi, harian/PHL); Angga Ade Mahendra, Sutipa Handayani (Team Leader -- ikut produksi penuh, namanya muncul di "siapa mengerjakan"; CATATAN: bila kelak bergeser ke mengatur/mengawasi, golongan ditinjau ulang -- bertanggal berlaku, tidak mengubah biaya batch lama).\n' ||
    E'MANUFACTURING OVERHEAD (5): Dina Melinda Cahya Purnama (Spv Produksi), Dimas Suryo Anantyo (Manager PPIC), Sandra Wedi Pradika (PPIC Jr. Spv), Syaifulloh Alamsyah (Helper Gudang -- menimbang kebutuhan TOTAL beberapa batch sekaligus, jamnya tidak bisa ditelusuri ke batch mana pun; penimbangan PER BATCH dilakukan tim produksi yang sudah direct), Darmini (Janitor -- bekerja di pabrik DAN kantor satu lokasi, shared cost yang untuk 1 orang tidak sepadan dipisah proporsional; arah konservatif, HPP sedikit lebih tinggi dari sebenarnya bukan lebih rendah; PEMICU PENINJAUAN: bila jumlah petugas kebersihan/lokasi bertambah, pembagian proporsional ditinjau ulang).\n' ||
    E'GENERAL & ADMINISTRATIVE (6): Alvan Handyka Yudha (Direktur), Bayu Oktavian Wibowo (General Manager), Ruud Ayu Dewanti (HR Generalist), Mega Asmarani (Staf Purchasing), Asni Damayati (FAT Spv -- FAT = Finance, Accounting, Tax, dikonfirmasi pemilik produk, dicatat di Kamus), Adhiskaprillia Nur Anissa (RnD Staff -- tidak terlibat langsung di batch MLVT).\n\n' ||
    E'QC (kondisi sekarang): BELUM ADA petugas QC tersendiri -- tahap QC di routing dikerjakan SPV Produksi yang merangkap. Karena SPV sudah Manufacturing Overhead, biayanya sudah tertangkap, tidak ada yang perlu diubah. Lihat QMS-01 (task terpisah) untuk keterbatasan pemeriksa=pelapor yang perlu dicatat untuk audit BPOM/halal.\n\n' ||
    E'KONSEKUENSI PHL (WAJIB dijelaskan di layar): 11 dari 19 karyawan direct dibayar harian -- biaya direct NAIK-TURUN mengikuti jumlah hari produksi sementara karyawan bulanan tetap. Rumus tetap benar, angkanya lebih berfluktuasi antar bulan -- wajar, bukan kesalahan hitung, tapi WAJIB dijelaskan supaya tidak salah dibaca.\n\n' ||
    E'WEWENANG PENETAPAN (final): FINANCE MENETAPKAN LANGSUNG, tidak ada alur usulan HRD. Alasan: penggolongan direct/overhead/administrasi adalah KEBIJAKAN AKUNTANSI (wilayah Finance yang bertanggung jawab atas laporan keuangan), bukan fakta kepegawaian (wilayah HRD) -- HRD menyediakan FAKTA (Dina adalah Spv Produksi), Finance MENERJEMAHKANNYA jadi kebijakan biaya; alur "HRD mengusulkan" ditolak karena menciptakan kesan HRD punya suara dalam keputusan akuntansi padahal tidak, dan alur yang dipakai 2-3x setahun akan berkarat karena tidak pernah teruji. Pengganti persetujuan adalah JEJAK (WAJIB): setiap perubahan golongan tercatat siapa menetapkan/kapan/dari-apa-ke-apa/alasan, riwayat APPEND-ONLY tidak boleh ditimpa, bertanggal berlaku -- dengan itu, salah golongan tetap ketahuan siapa & kapan tanpa perlu alur persetujuan. HRD tetap bisa MELIHAT golongan di halaman Karyawan, TIDAK BISA MENGUBAH. ARKEOLOGI DULU sebelum membangun: apakah pemisahan tampilan (golongan vs gaji) sudah mungkin dengan employees_secure yang ada, atau butuh tampilan baru -- laporkan sebelum membangun. Tempat: halaman TERSENDIRI "Penggolongan Biaya Tenaga Kerja" (modul Biaya, bukan HR) -- nama/jabatan/golongan/berlaku sejak kapan, TANPA gaji/data pribadi. Hak akses SERVER/RLS: Finance baca nama+jabatan+golongan+ubah golongan+lihat TOTAL biaya overhead+administrasi bulanan (angka gabungan, bukan per orang); HRD baca golongan saja.\n\n' ||
    E'DASAR PEMBAGIAN (final): JUMLAH BATCH, dikonfirmasi pemilik produk -- berlaku untuk biaya DIRECT maupun MANUFACTURING OVERHEAD. Data pendukung untuk dasar lain (kuantitas hasil, jam mesin) TETAP dikumpulkan sejak awal lewat PRD-18 (kuantitas & durasi tahap sudah masuk formulir) -- bila kelak dasar perlu diubah, datanya sudah ada, permintaan eksplisit pemilik produk.\n\n' ||
    E'ATURAN KERAS C.3 (tetap berlaku): karyawan DIRECT wajib jamnya tercatat di batch (lewat PRD-18) -- bila tidak sanggup dicatat, JANGAN digolongkan direct. Pemeriksaan: karyawan direct yang tidak muncul di labor log sebulan -> PERINGATAN, bukan blokir.\n\n' ||
    E'RUMUS FINAL (per golongan): biaya DIRECT per batch = total biaya karyawan direct sebulan (gaji+tunjangan+BPJS pemberi kerja) ÷ jumlah batch sebulan. Biaya MANUFACTURING OVERHEAD per batch = total biaya karyawan overhead pabrik sebulan ÷ jumlah batch sebulan, MASUK HPP bersama direct. Biaya GENERAL & ADMINISTRATIVE = TIDAK dibagi ke batch sama sekali, beban periode murni.\n\n' ||
    E'DUA ANGKA TERPISAH (tetap berlaku, C.8 lama): (A) Biaya per batch HARIAN = pemantauan produktivitas, TIDAK PERNAH masuk HPP/Margin Watch, wajib berlabel "Produktivitas Harian -- bukan biaya batch". (B) Biaya per batch BULANAN = yang masuk HPP/Margin Watch, ditandai "perkiraan" selama bulan berjalan. (C) Akumulasi berjalan, ditandai "sementara, final saat bulan ditutup". (D) Sandingkan dengan target batch/hari (BELUM tersimpan sebagai data -- periksa & laporkan bila belum ada).\n\n' ||
    E'BIAYA BATCH BERJALAN vs FINAL (tetap berlaku, C.9 lama): berjalan (bahan dari lot yang benar-benar dikonsumsi + SDM dari akumulasi berjalan, ditandai SEMENTARA) TIDAK DITIMPA oleh perhitungan ulang akhir bulan -- simpan KETIGANYA (berjalan, final, selisih); selisih besar = masalah KAPASITAS bukan biaya, tampilkan sebagai temuan. Margin diakui saat TERKIRIM (K2). Pengiriman lintas bulan ikut BULAN PRODUKSI.\n\n' ||
    E'KONSEKUENSI WAJIB DI LAYAR (C.10 lama, tetap berlaku): biaya SDM per batch adalah RATA-RATA per golongan, bukan biaya batch itu sendiri -- batch yang dikerjakan lebih lambat TIDAK terlihat lebih mahal. Panel Asal-Usul WAJIB menyebut metode & golongan yang membentuknya. Efisiensi antar batch dilihat lewat YIELD dan DURASI TAHAP, bukan biaya.\n\n' ||
    E'Prasyarat pengerjaan: MRG-10 sebaiknya beres lebih dulu. MRG-11 SEKARANG SIAP DIKERJAKAN sepenuhnya -- tidak ada lagi pertanyaan terbuka.',
    notes = coalesce(notes || E'\n\n', '') || 'Ditetapkan FINAL 23 Agu 2026 (BLOK PERINTAH) -- menggantikan draf "usulan" 23 Agu sebelumnya. 3 golongan (bukan 2), 30 karyawan sudah ditetapkan (bukan usulan lagi), wewenang & dasar pembagian sudah dijawab. TIDAK ADA pertanyaan terbuka tersisa.'
  where task_code = 'MRG-11' and company_id = v_company_id;

  -- B.6 -- QMS-01, task baru: pemisahan pemeriksa & pelapor QC
  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes
  ) values (
    v_company_id, 'QMS-01', 'Pemisahan Pemeriksa dan Pelapor pada Tahap QC', 'QMS', 'Kepatuhan Mutu',
    'Tahap QC di routing hari ini dikerjakan orang yang SAMA dengan yang mengisi formulir catatan produksi (SPV sebagai petugas pelapor, PRD-18) -- pemeriksa dan pelapor adalah orang yang sama.',
    'Untuk audit BPOM/halal ini perlu diketahui apa adanya -- bukan pelanggaran, tapi keterbatasan yang harus tercatat sebelum ditemukan auditor lebih dulu.',
    'penting', array['Dokumentasi','Fungsi'], 'Claude Code', 'menunggu', null, 'pemilik_produk',
    'Pemicu peninjauan ulang: saat ada petugas QC tersendiri direkrut -- saat itu golongan biayanya ditetapkan ulang, kemungkinan Manufacturing Overhead mengikuti alasan regulasi (QC ada karena kewajiban NIE BPOM & halal, biayanya tetap ada meski produksi berhenti). Sampai saat itu: dokumentasikan keterbatasan ini apa adanya (di mana, bagaimana caranya) -- bukan tombol/kode baru.',
    'Ditemukan lewat BLOK PERINTAH (23 Agu 2026), instruksi eksplisit pemilik produk (Bagian B.6).'
  )
  on conflict (company_id, task_code) do nothing;

  -- D. PRD-18 -- tutup 3 pertanyaan terbuka, PLT-05 jadi prasyarat keras
  update build_tasks
  set detail_pekerjaan = detail_pekerjaan || E'\n\n---\n\nPERTANYAAN TERBUKA DITUTUP (23 Agu 2026, BLOK PERINTAH):\n' ||
    E'(a) Kategori reject -> TIDAK di-hardcode, disimpan di database & diisi pengguna lewat PLT-05 (Daftar Pilihan Milik Tenant) -- PLT-05 SEKARANG PRASYARAT KERAS untuk PRD-18 (bukan lagi "boleh sementara di satu tempat"), naik urgensi ke Mendesak. Yang tetap berlaku: pantau bila "Lainnya" >15% total reject, tanda daftar kategori kurang lengkap.\n' ||
    E'(b) Foto reject -> WAJIB tiap kejadian. Keterangan pemilik produk: reject dilaporkan tiap akhir shift atau per batch, jadi jumlah KEJADIANnya terbatas (bukan tiap sachet afkir difoto). WAJIB laporkan perkiraan kebutuhan penyimpanan sebelum dibangun (paket Supabase gratis terbatas).\n' ||
    E'(c) Waktu pelaporan -> idealnya langsung, bila tidak cukup diberi PENGINGAT, TIDAK diblokir. Mekanisme: (i) sistem MENGHITUNG SENDIRI selisih jam tahap selesai vs jam formulir diisi (kedua angka sudah dimiliki sistem, tidak perlu bertanya/menebak); (ii) selisih menentukan KUALITAS data waktu -- diisi dekat waktu kejadian = layak jadi sampel standar K8, diisi jauh setelahnya = tetap tersimpan & dipakai untuk yield/biaya TAPI TIDAK membentuk standar durasi; ambang "dekat" BELUM DITETAPKAN, jangan ditebak -- biarkan sistem mencatat selisih nyata beberapa bulan, tetapkan dari sebaran sungguhan (pola K8 yang sama dengan yield); (iii) pengingat bila tahap selesai tapi formulir belum diisi setelah jangka waktu tertentu, bukan blokir; (iv) tampilkan % formulir yang diisi dekat waktu kejadian -- ukuran disiplin pelaporan, sekaligus penjelasan kenapa sebagian standar durasi belum naik status DIPELAJARI.\n\n' ||
    E'CAKUPAN AKSES HP (F, 23 Agu 2026): pertanyaan "layar tersendiri atau responsive" SUDAH DIJAWAB -- responsive, satu kode (lihat CLAUDE.md "Aturan Responsive"), dirancang responsive SEJAK AWAL karena belum dibangun sama sekali (tidak ada beban penyesuaian). Cakupan akses-HP yang dikerjakan sekarang HANYA formulir ini (+POD, sudah ada, lihat KRM-05) -- absensi/bacaan wajib/dashboard/halaman meja lain MENYUSUL BERTAHAP, bukan bagian task ini.\n\n' ||
    E'Seluruh pertanyaan terbuka kini TERTUTUP. Siap dikerjakan. Prasyarat: PLT-05 jalan lebih dulu.'
  where task_code = 'PRD-18' and company_id = v_company_id;

  insert into build_task_urgency_history (build_task_id, old_urgency, new_urgency, requested_by)
  select build_task_id, 'penting', 'mendesak',
    'Pemilik Produk (23 Agu 2026) -- PLT-05 sekarang PRASYARAT KERAS untuk PRD-18 (kategori reject tidak di-hardcode, harus dari PLT-05), bukan lagi pelengkap opsional.'
  from build_tasks where company_id = v_company_id and task_code = 'PLT-05';
  update build_tasks set urgency = 'mendesak' where company_id = v_company_id and task_code = 'PLT-05';

  -- F.3. KRM-05 -- temuan arkeologi POD (SUNGGUHAN dicoba, bukan disimpulkan dari kode)
  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes
  ) values (
    v_company_id, 'KRM-05', 'Perbesar Target Sentuh Halaman POD (Ukuran Tombol di Bawah Standar)', 'KRM', 'Pengiriman',
    'Halaman POD (`/pod/[token]`, bukti terima pengiriman yang dibuka klien lewat QR di surat jalan) DICOBA SUNGGUHAN lewat Playwright di lebar 360px (fixture Company B, dibersihkan total setelahnya) -- TIDAK ADA gulir menyamping, teks terbaca, hierarki jelas (LAYAK jadi contoh pola untuk layar lapangan lain soal tata letak & tanpa-overflow). TAPI seluruh elemen interaktif (tombol "Barang Sudah Diterima", input file "Choose File", input teks nama, label checkbox) tingginya HANYA 32px atau kurang -- di bawah standar 44x44px yang baru ditetapkan (CLAUDE.md "Aturan Responsive").',
    'Klien di lapangan (sering terburu-buru, kadang pakai sarung tangan) bisa salah tekan atau kesulitan menekan tombol konfirmasi/checkbox di layar HP -- ini halaman yang dilihat PIHAK LUAR (kesan pertama sistem bagi klien), bukan halaman internal.',
    'penting', array['Visual'], 'Claude Code', 'menunggu', '/pod', 'temuan_claude',
    'Naikkan tinggi tombol "Barang Sudah Diterima", area checkbox+label "Barang sudah sesuai jenis dan jumlahnya", input file, dan input nama ke minimal 44px (pola CSS yang sama dipakai nanti sebagai contoh utk PRD-18 & layar lapangan lain). Pola tata letak (kartu tunggal, tabel item sederhana, tanpa gulir menyamping) SUDAH LAYAK dijadikan contoh -- TIDAK perlu dibangun ulang, cukup diperbesar target sentuhnya. Kontrak eksternal WAJIB dijaga: URL POD di QR surat jalan yang sudah tercetak harus tetap hidup, jangan ubah alamat/struktur URL.',
    'Ditemukan lewat arkeologi F.3 (23 Agu 2026, BLOK PERINTAH) -- dicoba sungguhan lewat Playwright (localhost:3000, viewport 360x740), screenshot diambil, fixture Company B (plant/item/CPO/SO/lot/shipment sementara) dibersihkan total, dikonfirmasi 0 sisa lewat query ulang.'
  )
  on conflict (company_id, task_code) do nothing;

  -- G. SEC-06 -- HP pribadi untuk formulir produksi, pastikan akses bisa dicabut
  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes
  ) values (
    v_company_id, 'SEC-06', 'Pastikan Akses Bisa Dicabut Saat Formulir Diisi Lewat HP Pribadi', 'SEC', 'Keamanan',
    'Formulir catatan produksi (PRD-18) kemungkinan diisi SPV lewat HP pribadi -- data produksi perusahaan jadi ada di perangkat pribadi.',
    'Untuk sekarang tidak masalah karena akses dikendalikan lewat LOGIN, bukan lewat perangkat -- tapi bila ada pergantian orang (SPV resign/dipindah), akses harus benar-benar bisa dicabut, bukan cuma diasumsikan.',
    'bisa_menunggu', array['Keamanan'], 'Claude Code', 'menunggu', null, 'pemilik_produk',
    'Pastikan (arkeologi, bukan membangun fitur baru): saat akun user dinonaktifkan (mis. lewat halaman Tim), sesi yang sedang login di HP pribadi orang itu benar-benar berhenti bisa mengakses data (bukan cuma tidak bisa login ulang). Bukan task besar -- cukup dipastikan mekanismenya benar, catat hasilnya.',
    'Ditemukan lewat BLOK PERINTAH (23 Agu 2026), instruksi eksplisit pemilik produk (Bagian G).'
  )
  on conflict (company_id, task_code) do nothing;

  -- H.4 -- INF-11, SUPER URGENT: data nyata tidak punya alamat yang bisa dibuka pemilik produk sendiri
  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes
  ) values (
    v_company_id, 'INF-11', 'Data Nyata PT ITM Tidak Punya Alamat yang Bisa Dibuka Pemilik Produk Sendiri', 'INF', 'Infrastruktur & Environment',
    'Dikonfirmasi 23 Agu 2026 lewat pemeriksaan LANGSUNG (bukan dugaan): situs yang di-deploy (mrp-staging-zeta.vercel.app) tersambung ke project Supabase KOSONG (nclkepwlsgmfbslgsajq, staging rebuild-test) -- BUKAN ke data nyata PT ITM (kfvtrwuuqcjfkkuqizxt). Satu-satunya jalur yang tersambung ke data nyata hari ini adalah server pengembangan lokal (localhost:3000) di komputer kerja sesi Claude Code.',
    'Cara kerja "pemilik produk mencoba lalu memberi koreksi UX" yang sudah disepakati sejak Alur 1/Sesi 7 TIDAK PERNAH BISA DIJALANKAN sungguhan -- pemilik produk tidak bisa mencoba fitur, tidak bisa memberi koreksi UX, dan seluruh layar yang menunggu cetakan UX (Alur 1, PRD-18 nanti, dst) ikut tertahan tanpa jalan keluar. Ini menahan lebih banyak pekerjaan daripada yang terlihat di permukaan.',
    'super_urgent', array['Fungsi','Data'], 'Pemilik Produk', 'menunggu', null, 'temuan_claude',
    'Terkait INF-02 (perapian environment dev/staging/production) dan kebutuhan menaikkan paket Supabase -- dengan batas 2 project di paket gratis, memisahkan dev/staging/production secara teknis TIDAK MUNGKIN dilakukan sekarang. Perlu keputusan pemilik produk (bukan teknis semata): naikkan paket Supabase (biaya), atau terima sementara akses hanya lewat localhost (panduan langkah-demi-langkah sudah disampaikan di laporan chat 23 Agu 2026), atau siapkan jalur sementara (terowongan/tunnel) dengan risiko yang perlu dipahami dulu. JANGAN menyentuh DNS/domain/project/paket berlangganan/Vercel tanpa keputusan eksplisit.',
    'Ditemukan lewat BLOK PERINTAH Bagian H (23 Agu 2026) -- dikonfirmasi ulang lewat pemeriksaan bundle JS situs yang di-deploy (URL Supabase yang tertanam di kode client, tanpa kredensial), bukan dugaan.'
  )
  on conflict (company_id, task_code) do nothing;

end $$;
