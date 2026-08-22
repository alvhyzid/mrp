-- BLOK PENCATATAN (23 Agu 2026) -- keputusan biaya SDM, formulir produksi,
-- daftar pilihan. MURNI PENCATATAN, tidak ada task yang dikerjakan di sini.
--
-- B. Naikkan urgensi MRG-10 ke Mendesak (batch MLVT pertama akan jadi yang
--    pertama menghasilkan biaya SDM aktual -- kalau rekonsiliasi belum
--    beres, angka Margin Watch pertama yang dilihat pemilik produk sudah
--    salah sejak awal, dan itu angka yang dipakai memutuskan kelayakan
--    harga Rp23.000/box).
-- C. Lengkapi MRG-11 penuh dengan keputusan final C.1-C.10 (2 hal masih
--    menunggu pemilik produk: C.4 wewenang, C.7 dasar pembagian).
-- D. Task baru PRD-18: Formulir Catatan Produksi per Tahap (Mendesak).
-- E. Task baru PRD-19: Pemusnahan Bahan & Limbah Produksi (Penting).
-- F. Task baru PLT-05: Daftar Pilihan Milik Tenant (Penting).
-- Tambahan: catatan di INF-06 soal prasyarat verifikasi backup yang
--    terhalang rate-limit GitHub API + task baru INF-10 (cari cara
--    verifikasi tanpa bergantung API itu).
do $$
declare
  v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then
    raise notice 'Perusahaan PT ITM tidak ditemukan -- migrasi dilewati (no-op).';
    return;
  end if;

  -- B. MRG-10 -> Mendesak
  insert into build_task_urgency_history (build_task_id, old_urgency, new_urgency, requested_by)
  select build_task_id, 'penting', 'mendesak',
    'Pemilik Produk (23 Agu 2026) -- batch MLVT pertama akan jadi yang pertama menghasilkan biaya SDM aktual; bila rekonsiliasi belum beres saat itu, angka Margin Watch pertama yang dilihat pemilik produk sudah salah sejak awal -- dan itu angka yang dipakai memutuskan kelayakan harga Rp23.000/box.'
  from build_tasks where company_id = v_company_id and task_code = 'MRG-10';
  update build_tasks set urgency = 'mendesak' where company_id = v_company_id and task_code = 'MRG-10';

  -- C. MRG-11 -- lengkapi penuh
  update build_tasks
  set detail_pekerjaan = E'KEPUTUSAN FINAL (23 Agu 2026, C.1-C.10) -- menggantikan draf sebelumnya, yang sebagian disusun dari kesimpulan arsitek, BUKAN keterangan pemilik produk (dikoreksi eksplisit).\n\n' ||
    E'YANG BENAR-BENAR BERASAL DARI PEMILIK PRODUK (bukan kesimpulan arsitek): PT ITM produsen ber-NIE BPOM & bersertifikat halal; PHL diliburkan bila tidak ada produksi; supervisor kadang ikut turun ke lantai produksi; perpindahan kerja antar proses sering terjadi dan TIDAK tercatat; SPV akan jadi petugas pelapor khusus (lihat PRD-18).\n\n' ||
    E'C.2 ISTILAH & DASAR PENGGOLONGAN (final): DIRECT COST vs INDIRECT COST (bukan "management/production" -- istilah baku, dipahami akuntan tanpa penjelasan, dan golongan "management" membingungkan untuk QC/gudang yang bukan manajemen tapi juga bukan direct). Penggolongan menempel pada KARYAWAN (bukan dihitung per jam dari labor log) -- supervisor yang sesekali ikut turun TETAP indirect, sesuai praktik standar costing. WAJIB bertanggal berlaku (terkait HR-05): promosi operator jadi supervisor bulan depan TIDAK mengubah biaya batch bulan lalu.\n\n' ||
    E'C.3 ATURAN KERAS: bila seseorang digolongkan DIRECT, jamnya WAJIB tercatat di batch (lewat PRD-18) -- bila tidak sanggup dicatat, JANGAN digolongkan direct. Alasan: orang direct yang jamnya tidak pernah tercatat membuat biayanya HILANG dari mana-mana (tidak masuk batch karena tidak ada catatan jam, tidak masuk overhead karena digolongkan direct) -- margin terlihat lebih bagus dari kenyataan tanpa satu pun error muncul. Pasang pemeriksaan: karyawan direct yang tidak muncul sama sekali di labor log selama sebulan -> tampilkan PERINGATAN, bukan blokir.\n\n' ||
    E'C.4 WEWENANG & TEMPAT PENETAPAN -- BELUM DIPUTUSKAN, jangan ditebak. Prinsip: melihat PENGGOLONGAN tidak sama dengan melihat GAJI (Finance cukup nama+jabatan, tidak perlu gaji/NIK/alamat -- pola sama employees_secure). Usulan wewenang PERLU KONFIRMASI: HRD MENGUSULKAN (isi jabatan, sistem mengusulkan golongan) + Finance MENETAPKAN (setuju/ubah) -- ATAU alternatif sederhana bila HRD & Finance dipegang orang sama: Finance menetapkan langsung, titik. ARKEOLOGI DULU sebelum membangun: apakah pemisahan tampilan (golongan vs gaji) sudah mungkin dengan employees_secure yang ada, atau butuh tampilan baru -- laporkan sebelum membangun. Tempat: halaman TERSENDIRI "Penggolongan Biaya Tenaga Kerja" (modul Biaya, bukan modul HR) -- nama/jabatan/golongan/berlaku sejak kapan, TANPA gaji/data pribadi; halaman Karyawan (HRD) tampilkan golongan TAPI TIDAK BISA DIUBAH. Hak akses ditegakkan SERVER/RLS: Finance baca nama+jabatan+golongan+ubah golongan+lihat TOTAL biaya indirect bulanan (bukan per orang); HRD baca golongan saja, tidak boleh ubah. Setiap perubahan golongan tercatat siapa/kapan/dari-ke/alasan, bertanggal berlaku.\n\n' ||
    E'C.5 CARA PEMBEBANAN -- CARA A (final): seluruh biaya karyawan Direct sebulan dibagi ke SELURUH batch bulan itu. CARA B (hanya jam tercatat masuk batch, sisanya overhead) DITOLAK bukan ditunda -- alasan wajib dicatat: perpindahan kerja antar proses tidak tercatat (operator mixing hanya 2 jam tercatat untuk 3 batch, sisa 6 jam membantu proses lain yang tidak tercatat) -- Cara B akan membuat operator yang bekerja produksi sepanjang hari terbaca sebagai orang overhead, batch terlihat jauh lebih murah dari kenyataan. PEMICU PENINJAUAN ULANG: bila suatu saat seluruh perpindahan kerja benar-benar tercatat di labor log.\n\n' ||
    E'C.6 RUMUS FINAL: biaya SDM per batch = total biaya karyawan DIRECT sebulan (gaji + tunjangan + iuran BPJS pemberi kerja ~8,89%) ÷ jumlah batch SEBULAN (bukan per hari -- supaya hari sepi 2 batch tidak membuat biaya per batch jauh lebih tinggi padahal orang & gajinya sama). Hanya karyawan DIRECT masuk perhitungan; gaji BERSIH saja (tanpa tunjangan+BPJS) membuat biaya batch ~10% lebih murah dari kenyataan.\n\n' ||
    E'C.7 DASAR PEMBAGIAN -- BELUM DIPUTUSKAN, jangan ditebak. Pilihan sah: (i) jumlah batch [REKOMENDASI arsitek -- untuk lini serbuk tiap batch 60kg butuh usaha mirip, datanya paling pasti, tidak abu-abu], (ii) kuantitas hasil per kg/box [bergantung yield yang belum diukur], (iii) jam mesin [bergantung pencatatan yang belum rapi]. Boleh dipisah per lini nanti kalau lini gummy usahanya jauh beda -- jangan dibuat rumit sebelum masalahnya muncul.\n\n' ||
    E'C.8 DUA ANGKA TERPISAH, jangan digabung: (A) Biaya SDM per batch HARIAN = PEMANTAUAN produktivitas, BUKAN biaya -- TIDAK PERNAH menyentuh HPP/Margin Watch, wajib berlabel "Produktivitas Harian -- bukan biaya batch". (B) Biaya SDM per batch BULANAN = yang masuk HPP/Margin Watch, ditandai "perkiraan" selama bulan berjalan. (C) Akumulasi berjalan = total direct sejauh ini ÷ total batch sejauh ini, ditandai "sementara, final saat bulan ditutup". (D) Sandingkan dengan target batch/hari (BELUM tersimpan sebagai data -- periksa & laporkan, catat sebagai kebutuhan bila belum ada), tampilkan gap dari target + penyebab (gabung dgn formulir gangguan PRD-18).\n\n' ||
    E'C.9 BIAYA BATCH BERJALAN vs FINAL: (E) Berjalan (saat batch dilihat/hover) = bahan dari lot yang benar-benar dikonsumsi (K5) + SDM dari akumulasi berjalan, ditandai SEMENTARA. (F) Perhitungan ulang akhir bulan = SDM final+overhead+beban lain -- ATURAN KERAS: angka berjalan TIDAK DITIMPA, simpan KETIGANYA (berjalan, final, selisih) -- selisih besar = masalah KAPASITAS (jumlah batch meleset dari perkiraan), bukan masalah biaya, tampilkan sebagai temuan bukan diserap diam-diam. (G) Margin diakui saat TERKIRIM (K2, sudah berlaku). (H) Pengiriman lintas bulan ikut BULAN PRODUKSI (bukan bulan kirim) -- biaya menempel ke barang sejak jadi, supaya 2 box dari batch sama selalu HPP sama meski dikirim beda bulan.\n\n' ||
    E'C.10 KONSEKUENSI WAJIB DITULIS DI LAYAR: biaya SDM per batch adalah RATA-RATA, bukan biaya batch itu sendiri -- batch yang dikerjakan lebih lambat TIDAK terlihat lebih mahal (cara kerja standard costing yang lazim, tapi pengguna harus tahu). Panel Asal-Usul WAJIB menyebut metodenya. Satu-satunya cara melihat efisiensi antar batch: YIELD dan DURASI TAHAP, bukan biaya.\n\n' ||
    E'C.1 USULAN PENGGOLONGAN 30 KARYAWAN AKTIF PT ITM (PROPOSAL, BELUM DITETAPKAN -- lihat notes untuk daftar lengkap nama+jabatan+usulan+alasan. JANGAN menetapkan siapa pun sampai pemilik produk mengonfirmasi):\n' ||
    E'- DIRECT (usulan, 17 orang): seluruh "Operator Produksi" (7 bulanan + 10 harian/PHL) -- hands-on lantai produksi, jamnya bisa dicatat lewat PRD-18/labor log, sesuai C.3.\n' ||
    E'- INDIRECT (usulan, 9 orang): Direktur, General Manager, HR Generalist, Spv Produksi, Manager PPIC, PPIC Jr. Spv, Staf Purchasing, Janitor, FAT Spv -- manajemen/supervisi/admin/pendukung, bukan hands-on transformasi produk.\n' ||
    E'- BELUM BISA DIPUTUSKAN (4 orang, 3 jenis jabatan) -- MENUNGGU keterangan pemilik produk: "Team Leader" (2 orang) -- apakah mayoritas waktu hands-on produksi (seperti operator) atau mengoordinasi/mengawasi (seperti supervisor)? "RnD Staff" (1 orang) -- biayanya pernah menempel ke batch produksi tertentu, atau selalu biaya periode (indirect)? "Helper Gudang" (1 orang) -- ikut menangani bahan MASUK ke produksi (bisa direct) atau murni pekerjaan gudang/logistik (indirect)? Juga: FAT Spv diusulkan indirect mengikuti aturan supervisor (C.2), TAPI arti "FAT" (nama departemen) belum dikonfirmasi -- mohon pemilik produk jelaskan singkatannya supaya usulan ini benar-benar tepat, bukan cuma menebak dari kata "Spv".\n\n' ||
    E'Setelah C.1-C.10 dicatat, MRG-11 dinyatakan LENGKAP kecuali C.4 (wewenang) dan C.7 (dasar pembagian) yang masih menunggu pemilik produk. Prasyarat pengerjaan: MRG-10 sebaiknya beres lebih dulu.',
    notes = coalesce(notes || E'\n\n', '') || 'Diperbarui 23 Agu 2026 (BLOK PENCATATAN) -- draf sebelumnya DIKOREKSI: sebagian penggolongan sempat disusun dari kesimpulan arsitek, bukan keterangan pemilik produk. Status sekarang: USULAN yang perlu dikonfirmasi (lihat detail_pekerjaan C.1), bukan penetapan. Daftar lengkap 30 karyawan aktif (nama, jabatan, usulan golongan) dicetak di laporan chat 23 Agu 2026 -- lihat riwayat sesi untuk salinan lengkapnya.'
  where task_code = 'MRG-11' and company_id = v_company_id;

  -- D. PRD-18 -- Formulir Catatan Produksi per Tahap
  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes
  ) values (
    v_company_id, 'PRD-18', 'Formulir Catatan Produksi per Tahap', 'PRD', 'Produksi',
    'Satu formulir per tahap per batch, diisi petugas pelapor (sementara SPV) -- SATU-SATUNYA pintu masuk untuk seluruh rancangan yang sudah dibuat: yield per tahap, durasi nyata, reject, jeda bubuk menunggu, kehadiran kru.',
    'Bila bentuk formulir ini salah, seluruh rancangan yang bergantung padanya (K8, yield per tahap, standar kru, akumulasi reject) ikut salah -- ini fondasi pencatatan lantai produksi yang menentukan akurasi banyak fitur lain.',
    'mendesak', array['Database','Fungsi','Visual'], 'Claude Code', 'menunggu', null, 'pemilik_produk',
    E'ISI FORMULIR: (1) Identitas -- tahap apa, nomor batch (otomatis, tidak diketik). (2) Waktu -- jam mulai, jam selesai. (3) Kuantitas -- menyesuaikan yield_reporting_mode yang sudah dirancang: WEIGHT (berat masuk/keluar), WEIGHT+COUNT/filling (berat bubuk masuk, jumlah baik, jumlah reject, sampel berat isi), COUNT (jumlah baik/reject), NONE (tanpa kuantitas, cukup waktu). (4) Orang -- centang siapa ikut, default jam = SELURUH DURASI TAHAP, isian manual HANYA bila sebagian; CATATAN WAJIB: jam per orang TIDAK menentukan biaya batch (MRG-11 final -- biaya SDM dibagi rata per batch), gunanya mempelajari durasi standar (K8) & kapasitas -- JANGAN sampai ada yang mengira jam ini membentuk rupiah di Margin Watch. (5) Reject -- lihat bagian tersendiri di bawah. (6) Gangguan -- ada/tidak, berapa lama, kategori (mekanisme downtime yang sudah ada). (7) Catatan bebas. (8) Dilaporkan oleh -- otomatis dari akun pengisi, WAJIB TERPISAH dari "dikerjakan oleh" (untuk masalah mutu, yang dibutuhkan adalah siapa MENGERJAKAN, bukan siapa mencatat).\n\n' ||
    E'REJECT (bagian tersendiri): (R1) jumlah reject PER TAHAP bukan satu angka gabungan -- nilai reject beda per tahap (bubuk tumpah di mixing = kehilangan bahan saja; sachet afkir di filling = bahan + kemasan Rp469,85; box rusak di akhir = semuanya + box Rp2.500). (R2) alasan dari DAFTAR TETAP bukan diketik bebas (perlu bisa dijumlahkan per kategori di akhir proyek) -- sediakan "Lainnya"+keterangan, pantau bila >15% total reject berarti daftar kategori kurang lengkap; daftar kategori BELUM DITETAPKAN, menunggu pemilik produk (lihat PLT-05 untuk tempat pengelolaannya). (R3) foto dokumentasi per kejadian (pakai pemeriksaan magic-byte yang sudah ada) -- wajib/opsional menunggu keputusan; CATATAN KAPASITAS: perkirakan kebutuhan penyimpanan dulu (paket Supabase gratis terbatas) sebelum dibangun, laporkan perkiraannya. (R4) reject terakumulasi per Work Order: total per kategori, per tahap, NILAI RUPIAHNYA (bahan+kemasan terbuang, per tahap). (R5) reject punya 2 konsekuensi biaya: bahan hilang DAN biaya pemusnahan (PRD-19) -- yang kedua sering lupa dihitung.\n\n' ||
    E'KEPUTUSAN FINAL: pengisi formulir = PETUGAS PELAPOR KHUSUS (sementara SPV), BUKAN operator produksi -- alasan pemilik produk: operator lebih sering lupa, sekaligus melatih SPV fokus ke pengawasan/maintenance daripada ikut produksi (konsekuensi ini MENGUATKAN keputusan MRG-11 C.2 bahwa supervisor = indirect, bukan cuma ikut standar akuntansi tapi memang cara kerja PT ITM). Jam kerja per orang diisi PERKIRAAN dulu (ESTIMASI_MANUAL), dikoreksi dari data aktual & naik status DIPELAJARI setelah cukup sampel -- pola K8 yang sudah ada, JANGAN merancang mekanisme baru.\n\n' ||
    E'PERTANYAAN TERBUKA -- JANGAN DITEBAK: (a) daftar kategori alasan reject apa yang benar-benar terjadi di lini serbuk (sebaiknya dari supervisor produksi, bukan tebakan). (b) foto reject wajib tiap kejadian atau hanya bila melewati ambang? (c) jam mulai/selesai diisi dari catatan kertas lantai produksi atau ingatan SPV -- menentukan apakah durasinya layak jadi sampel standar K8 atau harus ditandai perkiraan.',
    'Ditemukan lewat BLOK PENCATATAN (23 Agu 2026), instruksi eksplisit pemilik produk (Bagian D). Bergantung PLT-05 untuk sumber kategori reject/gangguan (boleh dibuat sementara di satu tempat mudah dipindah kalau PLT-05 belum jadi saat formulir ini dibangun).'
  )
  on conflict (company_id, task_code) do nothing;

  -- E. PRD-19 -- Pemusnahan Bahan & Limbah Produksi
  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes
  ) values (
    v_company_id, 'PRD-19', 'Pemusnahan Bahan & Limbah Produksi', 'PRD', 'Produksi',
    'Reject yang terakumulasi (dari PRD-18) harus berujung pada peristiwa pemusnahan yang tercatat -- kapan, berapa, disaksikan siapa, dokumennya apa.',
    'Untuk produsen ber-NIE BPOM ini kewajiban kepatuhan, bukan pilihan -- reject yang menumpuk tanpa jejak pemusnahan resmi adalah celah audit.',
    'penting', array['Database','Fungsi'], 'Claude Code', 'menunggu', null, 'pemilik_produk',
    'Prasyarat: pencatatan reject per tahap (PRD-18) harus jalan dulu -- pemusnahan mencatat peristiwa terhadap akumulasi reject yang sudah tercatat, bukan mekanisme berdiri sendiri. Bentuk konkret (skema, alur persetujuan, dokumen yang dihasilkan) belum dirancang -- menunggu PRD-18 selesai.',
    'Ditemukan lewat BLOK PENCATATAN (23 Agu 2026), instruksi eksplisit pemilik produk (Bagian E).'
  )
  on conflict (company_id, task_code) do nothing;

  -- F. PLT-05 -- Daftar Pilihan Milik Tenant
  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes
  ) values (
    v_company_id, 'PLT-05', 'Daftar Pilihan Milik Tenant', 'PLT', 'Platform',
    'Beberapa daftar pilihan (kategori reject, kategori gangguan produksi, alasan penyesuaian stok, alasan pembukaan kembali Work Order, jenis dokumen, dst) seharusnya milik tiap pabrik/tenant, bukan tertanam di kode -- isinya berbeda tiap pabrik.',
    'Bila dibuat satu per satu per kategori, lahir banyak layar mirip yang tidak seragam -- satu tempat pengelolaan menutup semuanya sekaligus dan daftar berikutnya tinggal menumpang.',
    'penting', array['Database','Fungsi','Visual'], 'Claude Code', 'menunggu', null, 'pemilik_produk',
    E'LINGKUP: (1) ARKEOLOGI DULU -- daftar pilihan apa saja yang hari ini tertanam di kode atau enum database padahal isinya milik tenant, laporkan seluruhnya sebelum membangun, JANGAN asumsikan hanya yang disebut di deskripsi. (2) Satu tempat pengelolaan, dikelompokkan per konteks (Produksi, Gudang, Dokumen, dst). (3) Tiap pilihan: kode, nama tampilan, aktif/arsip, urutan tampil. (4) Pola hapus/arsip yang sudah ada: pilihan yang SUDAH DIPAKAI transaksi tidak boleh dihapus permanen, hanya diarsipkan -- diarsipkan hilang dari pilihan baru, catatan lama tetap punya arti. (5) Bertanggal berlaku bila memungkinkan -- mengubah nama pilihan TIDAK boleh mengubah arti catatan lama. (6) Sediakan daftar awal yang masuk akal saat tenant baru mendaftar, TAPI tenant harus bisa mengubahnya -- daftar awal BUKAN daftar kunci.\n\n' ||
    E'KAITAN: PRD-18 (formulir produksi) bergantung ini untuk kategori reject-nya -- bila PLT-05 belum jadi saat PRD-18 dibangun, kategori boleh dibuat sementara di SATU tempat yang mudah dipindahkan kemudian, jangan disebar di komponen.\n\n' ||
    E'PERTANYAAN TERBUKA -- JANGAN DITEBAK: hak akses siapa boleh menambah/mengubah tiap daftar -- kemungkinan berbeda per konteks (kategori reject mungkin milik supervisor produksi; jenis dokumen milik admin), menunggu keputusan pemilik produk.',
    'Ditemukan lewat BLOK PENCATATAN (23 Agu 2026), instruksi eksplisit pemilik produk (Bagian F).'
  )
  on conflict (company_id, task_code) do nothing;

  -- INF-06: catatan prasyarat backup terhalang rate-limit
  update build_tasks
  set notes = coalesce(notes || E'\n\n', '') || 'CATATAN 23 Agu 2026: percobaan verifikasi prasyarat (backup harian otomatis benar-benar berjalan sesuai jadwal, bukan cuma terpasang) TERHALANG rate-limit GitHub API (60 req/jam tanpa token -- proyek ini TIDAK BOLEH memakai token/kredensial lewat percakapan). Isi backup terakhir SUDAH diverifikasi berisi data nyata (companies=8, employees=31, ~22 Agu). Pemilik produk memutuskan menunda INF-06 ke giliran terpisah SETELAH prasyarat backup benar-benar terverifikasi (bukan mendesak, 7 company bekas test tidak mengganggu apa pun). Lihat INF-10 (task baru) untuk perbaikan struktural masalah ini.'
  where task_code = 'INF-06' and company_id = v_company_id;

  -- INF-10 -- verifikasi backup tanpa bergantung GitHub API
  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes
  ) values (
    v_company_id, 'INF-10', 'Verifikasi Keberhasilan Backup Harian Tanpa Bergantung GitHub API', 'INF', 'Infrastruktur & Environment',
    'Satu-satunya cara memverifikasi backup harian (`backup-db.yml`) benar-benar berjalan sesuai jadwal saat ini adalah lewat GitHub Actions API -- yang TERBUKTI bisa kena rate-limit (60 request/jam tanpa token) dan memblokir pengecekan syarat pengaman paling penting di proyek ini (backup sebelum tindakan destruktif).',
    'Pemeriksaan syarat pengaman yang paling kritis (apakah backup benar-benar jalan sebelum menghapus data) bisa terhalang hal di luar kendali (rate-limit API pihak ketiga) -- bukan gagal karena backup-nya sendiri bermasalah, tapi karena JALUR VERIFIKASINYA rapuh.',
    'penting', array['Fungsi','Data'], 'Claude Code', 'menunggu', null, 'temuan_claude',
    'Cari cara verifikasi yang tidak bergantung GitHub Actions API -- mis. workflow backup menulis catatan hasil (timestamp, jumlah tabel, ukuran, status sukses/gagal) ke tempat yang bisa dibaca LANGSUNG tanpa API call (mis. baris di tabel database, atau file receipt yang di-commit/di-push ke repo sendiri setiap run sukses) -- supaya verifikasi prasyarat sebelum tindakan destruktif (seperti INF-06) tidak bergantung kuota API pihak ketiga.',
    'Ditemukan lewat percobaan verifikasi prasyarat INF-06 (23 Agu 2026) -- rate-limit GitHub API memblokir pengecekan, pemilik produk eksplisit meminta ini dicatat sebagai perbaikan struktural terpisah.'
  )
  on conflict (company_id, task_code) do nothing;

end $$;
