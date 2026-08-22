-- Halaman Daftar Tugas Pembangunan -- 22 Agu 2026: modul baru HR (Sumber
-- Daya Manusia) dan PLT (Platform), dicatat dari docs/benchmark-hcm-talenta.md
-- (benchmark fungsional Mekari Talenta, diunggah pemilik produk). HANYA
-- MENCATAT -- tidak satu task pun dikerjakan di migrasi ini.
do $$
declare
  v_company_id integer;
  v_catatan_strategis text := 'KEPUTUSAN STRATEGIS (dicatat 22 Agu 2026, supaya tidak dibuka ulang tanpa sadar): FABRIX tidak bersaing sebagai HRIS umum. Modul HR dibangun untuk memperkuat akurasi biaya tenaga kerja produksi dan kepatuhan BPOM/halal. Kemampuan HCM penuh (payroll, pajak, ATS, LMS, talent) berstatus Ditunda Sadar dengan pemicu tercatat -- bukan dibatalkan, tapi juga bukan antrean aktif. Catatan tambahan: audit trail (AUD-07) dan Absensi W2-W5 sudah tercatat sebelumnya sebagai task terpisah -- HR-01 s.d. HR-12 TIDAK menduplikasinya, hanya terkait.';
  v_pemicu_umum text := 'Dibuka hanya setelah FABRIX punya tenant kedua yang membayar, DAN ada keputusan pemilik produk bahwa HCM dijadikan produk tersendiri dengan tim serta anggaran sendiri.';
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then
    raise notice 'Perusahaan PT ITM tidak ditemukan -- migrasi dilewati (no-op).';
    return;
  end if;

  -- ================= TINGKAT A — dibutuhkan pabrik =================

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description, effect_description, urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes) values
  (v_company_id, 'HR-01', 'Bacaan Wajib & Onboarding Terlacak', 'HR', 'Sumber Daya Manusia',
   'Karyawan baru wajib membaca materi tertentu lalu menjawab beberapa pertanyaan; HRD melihat satu layar berisi siapa sudah, siapa belum, siapa terlambat.',
   'Hari ini tidak ada bukti apa pun bahwa karyawan sudah menerima informasi onboarding. Untuk audit ketenagakerjaan dan tanggung jawab hukum, yang dibutuhkan adalah bukti materi tersampaikan dan diterima.',
   'penting', array['Database','Fungsi','Visual']::text[], 'Claude Code', 'menunggu', null, 'pemilik_produk',
   $d$Materi: judul, isi, boleh lampiran (PDF/video). Beberapa pertanyaan di akhir. Nilai lulus ditentukan per materi.
Rekaman per karyawan: kapan dibuka, berapa lama, kapan dijawab, nilai, lulus atau ulang.
MATERI BERVERSI (wajib): bila materi direvisi, karyawan yang sudah lulus versi lama HARUS membaca ulang, DAN rekaman lama TETAP tersimpan sebagai bukti kelulusan versi itu. Pola sama dengan snapshot routing/BOM per batch. Tanpa ini, setahun lagi daftar "semua lulus" berisi orang yang lulus versi yang sudah tidak berlaku.
Penugasan menempel ke PERAN/lini, bukan diketik per orang. Operator lini serbuk otomatis dapat materi higiene; staf kantor tidak. Bila ditugaskan satu per satu, dalam tiga bulan HRD berhenti melakukannya.
Batas kejujuran yang WAJIB ditulis di layar: menjawab benar tidak sama dengan memahami. Nilai ujian ini TIDAK boleh dipakai sebagai dasar penilaian kinerja.
PERTANYAAN TERBUKA (jangan ditebak, tanya pemilik produk sebelum dibangun): karyawan mengakses lewat HP masing-masing atau tablet bersama di pabrik? Bila HP, butuh tampilan mobile -- dan sistem ini belum punya satu pun layar yang dirancang untuk HP. Terkait pertanyaan Absensi W2-W5 yang juga belum terjawab: berapa karyawan tanpa smartphone.$d$,
   v_catatan_strategis);

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description, effect_description, urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes) values
  (v_company_id, 'HR-02', 'Pusat Bantuan Karyawan', 'HR', 'Sumber Daya Manusia',
   'Kumpulan artikel "masalah apa, penyelesaiannya bagaimana", dicari lewat kotak pencarian, dikelompokkan per topik.',
   'Mengurangi pertanyaan berulang ke HRD dan supervisor.',
   'bisa_menunggu', array['Database','Fungsi','Visual']::text[], 'Claude Code', 'menunggu', null, 'pemilik_produk',
   $d$WAJIB: catat setiap pencarian yang TIDAK menemukan hasil. Itu daftar artikel berikutnya yang harus ditulis. Tanpa fitur ini, isi pusat bantuan hanya tebakan HRD tentang apa yang orang butuhkan -- dan modul semacam ini biasanya mati dalam tiga bulan karena itu.
Tiap artikel punya PEMILIK dan TANGGAL TINJAU ULANG. Artikel yang belum ditinjau setahun ditandai, supaya tidak ada yang mengikuti prosedur yang sudah berubah.
Catatan urutan: dikerjakan SETELAH HR-01. HR-01 punya pemilik jelas dan pemakainya dipaksa hadir; HR-02 bergantung pada ada yang rajin menulis artikel, dan itu belum terbukti. Materi onboarding dari HR-01 bisa langsung jadi artikel pertama HR-02.$d$,
   null);

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description, effect_description, urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes) values
  (v_company_id, 'HR-03', 'Rekaman Pelatihan & Sertifikat Karyawan', 'HR', 'Sumber Daya Manusia',
   'Siapa dilatih apa, kapan, oleh siapa, buktinya apa, berlaku sampai kapan.',
   'Auditor BPOM/halal menanyakan bukti pelatihan operator. Hari ini jawabannya ada di kepala orang atau map kertas.',
   'penting', array['Database','Fungsi']::text[], 'Claude Code', 'menunggu', null, 'pemilik_produk',
   'Sebagian besar TINGGAL MENYAMBUNG, bukan membangun dari nol -- Master Dokumen MD-1 sudah punya kategori dokumen, tanggal kedaluwarsa, pengingat 90/60/30 hari, tingkat kerahasiaan, dan log akses. Yang ditambahkan: dokumen menempel ke KARYAWAN dan ke JENIS PELATIHAN.',
   null);

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description, effect_description, urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes) values
  (v_company_id, 'HR-04', 'Checklist Onboarding Karyawan Baru', 'HR', 'Sumber Daya Manusia',
   'Langkah tetap tiap karyawan baru -- dokumen, kontrak, BPJS, rekening, APD, akses, pelatihan wajib, target masa percobaan. Sistem menandai mana yang belum dan siapa penanggung jawabnya.',
   'Bergantung frekuensi karyawan baru. 10 PHL di KL Bizhub yang sering berganti membuat ini gesekan mingguan.',
   'bisa_menunggu', array['Database','Fungsi']::text[], 'Claude Code', 'menunggu', null, 'pemilik_produk',
   'Langkah checklist per karyawan baru, tiap langkah punya penanggung jawab dan status selesai/belum. Detail lebih lanjut (daftar langkah persis) menunggu konfirmasi pemilik produk saat dikerjakan -- BUKAN ditebak sekarang.',
   null);

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description, effect_description, urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes) values
  (v_company_id, 'HR-05', 'Effective Dating Gaji & Struktur Organisasi', 'HR', 'Sumber Daya Manusia',
   'Perubahan gaji dan struktur organisasi disimpan bertanggal berlaku, bukan menimpa nilai lama.',
   'KALAU GAJI NAIK HARI INI, BIAYA BATCH BULAN LALU TIDAK BOLEH IKUT BERUBAH. Ini persoalan yang sama persis dengan snapshot routing/BOM yang sudah dibereskan, hanya belum diterapkan ke gaji dan organisasi. Selama belum ada, seluruh riwayat margin bisa berubah surut tanpa ada yang tahu.',
   'mendesak', array['Database','Formula','Keamanan']::text[], 'Claude Code', 'menunggu', null, 'pemilik_produk',
   'Catatan: arkeologi dulu -- periksa apakah labor log sudah membekukan tarif per jam saat batch berjalan, atau menghitung dari gaji yang hidup, SEBELUM membangun.',
   null);

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description, effect_description, urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes) values
  (v_company_id, 'HR-06', 'Master Shift', 'HR', 'Sumber Daya Manusia',
   'Shift sebagai data (jam mulai, selesai, istirahat, lintas hari), bukan asumsi di kode.',
   'Shift 2 (16.00-22.00) sekarang hanya konsep. Upah PHL shift 2 dihitung manual. Shift lintas tengah malam WAJIB memakai timestamp, bukan tanggal saja.',
   'penting', array['Database','Fungsi']::text[], 'Claude Code', 'menunggu', null, 'pemilik_produk',
   'Tabel shift sebagai data: jam mulai/selesai/istirahat, dukung lintas hari (timestamp, bukan tanggal saja). Detail skema menunggu dikerjakan.',
   null);

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description, effect_description, urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes) values
  (v_company_id, 'HR-07', 'Cuti: Saldo, Akrual, Kalender Libur', 'HR', 'Sumber Daya Manusia',
   'Saldo cuti, akrual, dan kalender hari libur sebagai data.',
   'Cuti memotong hari kerja, dan hari kerja adalah penyebut tarif SDM (K4). Tanpa ini tarif per jam meleset.',
   'bisa_menunggu', array['Database','Fungsi']::text[], 'Claude Code', 'menunggu', null, 'pemilik_produk',
   'Saldo cuti per karyawan, akrual berkala, kalender hari libur perusahaan. Detail aturan akrual menunggu konfirmasi pemilik produk saat dikerjakan.',
   null);

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description, effect_description, urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes) values
  (v_company_id, 'HR-08', 'Pemisahan Karyawan vs Hubungan Kerja + Siklus Hidup', 'HR', 'Sumber Daya Manusia',
   'Satu orang bisa punya beberapa periode kerja (kontrak berakhir lalu masuk lagi). Status: Draf, Onboarding, Aktif, Cuti Panjang, Berhenti, Diarsipkan -- tiap perpindahan tercatat.',
   'Tanpa ini, riwayat kerja karyawan yang keluar-masuk beberapa kali tidak bisa dibedakan dari karyawan baru.',
   'bisa_menunggu', array['Database']::text[], 'Claude Code', 'menunggu', null, 'pemilik_produk',
   'Pisahkan entitas Karyawan (orang) dari Hubungan Kerja (periode kontrak), status siklus hidup dengan riwayat perpindahan tercatat.',
   null);

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description, effect_description, urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes) values
  (v_company_id, 'HR-09', 'Alur Pengajuan & Persetujuan Lembur', 'HR', 'Sumber Daya Manusia',
   'Alur pengajuan, persetujuan, dan batas maksimum lembur.',
   'Rumus lembur (1/173 x gaji pokok x 1,5) SUDAH ada. Yang belum alur pengajuan, persetujuan, dan batas maksimum.',
   'bisa_menunggu', array['Fungsi']::text[], 'Claude Code', 'menunggu', null, 'pemilik_produk',
   'Bangun alur pengajuan-persetujuan lembur di atas rumus yang sudah ada, dengan batas maksimum jam. Detail alur persetujuan (siapa menyetujui) menunggu konfirmasi pemilik produk.',
   null);

  -- ================= TINGKAT B — pembeda manufaktur =================

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description, effect_description, urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes) values
  (v_company_id, 'HR-10', 'Sertifikasi Operator -> Izin Mengerjakan Tahap', 'HR', 'Sumber Daya Manusia',
   'Bukan cuma "tahap mixing butuh 3 orang", tapi "3 orang BERSERTIFIKAT mixing dan masih berlaku".',
   'Inti nilai HR untuk pabrik. Menjawab pertanyaan auditor "siapa boleh mengerjakan tahap ini" dengan data, bukan ingatan.',
   'penting', array['Database','Fungsi']::text[], 'Claude Code', 'menunggu', null, 'pemilik_produk',
   $d$Menempel langsung ke task standar kru per tahap yang sedang menunggu PPIC -- sekali layar itu dibangun, kolom sertifikasi ikut di situ, BUKAN layar terpisah. Sumber data sertifikatnya dari HR-03.
KEPUTUSAN PEMILIK PRODUK (sudah diputuskan, catat): bila operator tanpa sertifikat berlaku ditugaskan ke tahap yang mensyaratkannya, sistem MEMPERINGATKAN dan MENCATAT KERAS -- bukan memblokir. Supervisor tetap bisa menugaskan (kenyataan lapangan kadang memaksa), tapi kejadiannya tercatat lengkap dengan siapa yang menugaskan dan alasannya. Alasan: yang dibutuhkan auditor adalah jejaknya; blokir keras di masa awal hanya membuat orang mengakalinya, dan sekali diakali datanya bohong.$d$,
   null);

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description, effect_description, urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes) values
  (v_company_id, 'HR-11', 'Insentif Produksi', 'HR', 'Sumber Daya Manusia',
   'Upah terkait output nyata per batch/tahap.',
   'Menghubungkan insentif SDM langsung ke hasil produksi nyata, bukan kehadiran saja.',
   'bisa_menunggu', array['Formula','Database']::text[], 'Claude Code', 'menunggu', null, 'pemilik_produk',
   'Prasyarat: pencatatan yield per tahap harus jalan lebih dulu.',
   null);

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description, effect_description, urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes) values
  (v_company_id, 'HR-12', 'Intelijen Biaya Tenaga Kerja per Work Order & Tahap', 'HR', 'Sumber Daya Manusia',
   'Karyawan -> Work Order -> Tahap -> Jam -> Biaya Tenaga Kerja -> Biaya Produksi.',
   'INI YANG TIDAK BISA DILAKUKAN HRIS MANA PUN, karena HRIS tidak tahu apa itu work order. Bahannya sudah ada (labor log per tahap batch, K1-K8, margin dua tingkat). Yang kurang tinggal penyajiannya.',
   'bisa_menunggu', array['Formula','Data']::text[], 'Claude Code', 'menunggu', null, 'pemilik_produk',
   'Sajikan rantai Karyawan->Work Order->Tahap->Jam->Biaya dari data yang sudah ada (labor log, K1-K8, margin dua tingkat) -- tidak perlu bangun sumber data baru, hanya penyajian.',
   null);

  -- ================= TINGKAT C — HCM penuh, SEMUA Ditunda Sadar =================

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description, effect_description, urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes, ditunda_pemicu) values
  (v_company_id, 'HR-20', 'Mesin Payroll (Komponen, Periode, Kalkulasi, State Machine)', 'HR', 'Sumber Daya Manusia',
   'Komponen gaji, periode, kalkulasi, state machine DRAF->TERKUNCI->DIHITUNG->DISETUJUI->FINAL->DIBAYAR.',
   'Fondasi seluruh kemampuan payroll penuh -- belum dikerjakan, status Ditunda Sadar.',
   'ditunda_sadar', array['Database','Formula','Keamanan']::text[], 'Claude Code', 'ditunda_sadar', null, 'pemilik_produk',
   'CATATAN WAJIB: bila suatu hari dibangun, arsitekturnya HARUS berversi dan bertanggal-berlaku SEJAK BARIS PERTAMA. Membangunnya "sederhana dulu" adalah kesalahan yang tidak bisa diperbaiki murah. Payroll final tidak pernah boleh diubah diam-diam -- koreksi membuat baris penyesuaian.',
   v_catatan_strategis, v_pemicu_umum);

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description, effect_description, urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes, ditunda_pemicu) values
  (v_company_id, 'HR-21', 'PPh21 / e-Bupot / Coretax', 'HR', 'Sumber Daya Manusia',
   'Perhitungan dan pelaporan pajak penghasilan karyawan.',
   'Salah hitung = masalah pajak klien, bukan sekadar bug.',
   'ditunda_sadar', array['Database','Formula','Keamanan']::text[], 'Claude Code', 'ditunda_sadar', null, 'pemilik_produk',
   'Perlu integrasi/kepatuhan e-Bupot/Coretax sesuai aturan pajak berlaku saat dikerjakan.',
   null, v_pemicu_umum || ' Pemicu tambahan: butuh tim kepatuhan yang mengikuti perubahan aturan pajak.');

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description, effect_description, urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes, ditunda_pemicu) values
  (v_company_id, 'HR-22', 'Slip Gaji (Tidak Bisa Diubah Setelah Payroll Final)', 'HR', 'Sumber Daya Manusia',
   'Slip gaji karyawan, terkunci setelah payroll berstatus final.',
   'Bagian dari mesin payroll (HR-20).',
   'ditunda_sadar', array['Database','Visual']::text[], 'Claude Code', 'ditunda_sadar', null, 'pemilik_produk',
   'Prasyarat: HR-20 (mesin payroll).', null, v_pemicu_umum);

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description, effect_description, urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes, ditunda_pemicu) values
  (v_company_id, 'HR-23', 'Pembayaran Gaji / Disbursement', 'HR', 'Sumber Daya Manusia',
   'Penyaluran pembayaran gaji ke rekening karyawan.',
   'Menyentuh uang sungguhan, butuh audit keamanan tersendiri.',
   'ditunda_sadar', array['Database','Keamanan','Integrasi']::text[], 'Claude Code', 'ditunda_sadar', null, 'pemilik_produk',
   'Prasyarat: HR-20. Butuh audit keamanan tersendiri sebelum dibangun -- menyentuh uang sungguhan.', null, v_pemicu_umum || ' Pemicu tambahan: butuh audit keamanan tersendiri sebelum dibangun.');

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description, effect_description, urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes, ditunda_pemicu) values
  (v_company_id, 'HR-24', 'Reimbursement & Expense (termasuk OCR Struk)', 'HR', 'Sumber Daya Manusia',
   'Klaim reimbursement karyawan, termasuk pembacaan otomatis struk (OCR).',
   'Kemampuan HCM penuh, belum jadi kebutuhan pabrik saat ini.',
   'ditunda_sadar', array['Database','Fungsi','Integrasi']::text[], 'Claude Code', 'ditunda_sadar', null, 'pemilik_produk',
   'Termasuk OCR struk otomatis.', null, v_pemicu_umum);

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description, effect_description, urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes, ditunda_pemicu) values
  (v_company_id, 'HR-25', 'Benefit & Kelayakan per Grade', 'HR', 'Sumber Daya Manusia',
   'Manfaat karyawan (benefit) berdasarkan grade/jenjang.',
   'Kemampuan HCM penuh, belum jadi kebutuhan pabrik saat ini.',
   'ditunda_sadar', array['Database','Fungsi']::text[], 'Claude Code', 'ditunda_sadar', null, 'pemilik_produk',
   'Menunggu struktur grade/jenjang karyawan (belum ada di sistem).', null, v_pemicu_umum);

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description, effect_description, urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes, ditunda_pemicu) values
  (v_company_id, 'HR-26', 'ESS Mobile (Karyawan Mengurus Sendiri Absen, Cuti, Slip)', 'HR', 'Sumber Daya Manusia',
   'Employee Self-Service versi mobile -- karyawan mengurus absen/cuti/slip gaji sendiri lewat HP.',
   'Butuh tampilan mobile -- sistem ini belum punya satu pun layar yang dirancang untuk HP (terkait pertanyaan terbuka HR-01/Absensi W2-W5).',
   'ditunda_sadar', array['Fungsi','Visual']::text[], 'Claude Code', 'ditunda_sadar', null, 'pemilik_produk',
   'Prasyarat: layar mobile belum ada satu pun di sistem ini -- keputusan arah mobile perlu diambil dulu.', null, v_pemicu_umum);

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description, effect_description, urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes, ditunda_pemicu) values
  (v_company_id, 'HR-27', 'Rekrutmen / ATS + AI CV Screening', 'HR', 'Sumber Daya Manusia',
   'Applicant Tracking System dengan penyaringan CV berbantuan AI.',
   'Kemampuan HCM penuh, belum jadi kebutuhan pabrik saat ini.',
   'ditunda_sadar', array['Database','Fungsi','Integrasi']::text[], 'Claude Code', 'ditunda_sadar', null, 'pemilik_produk',
   'Termasuk AI CV screening.', null, v_pemicu_umum);

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description, effect_description, urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes, ditunda_pemicu) values
  (v_company_id, 'HR-28', 'Manpower Planning', 'HR', 'Sumber Daya Manusia',
   'Perencanaan kebutuhan tenaga kerja ke depan.',
   'Kemampuan HCM penuh, belum jadi kebutuhan pabrik saat ini.',
   'ditunda_sadar', array['Database','Formula']::text[], 'Claude Code', 'ditunda_sadar', null, 'pemilik_produk',
   'Belum ada rincian tambahan di luar deskripsi -- dicatat sesuai spesifikasi benchmark Talenta, detail dirumuskan saat giliran tiba (Ditunda Sadar).', null, v_pemicu_umum);

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description, effect_description, urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes, ditunda_pemicu) values
  (v_company_id, 'HR-29', 'Offboarding', 'HR', 'Sumber Daya Manusia',
   'Proses keluar karyawan secara formal (checklist kebalikan onboarding).',
   'Kemampuan HCM penuh, belum jadi kebutuhan pabrik saat ini.',
   'ditunda_sadar', array['Database','Fungsi']::text[], 'Claude Code', 'ditunda_sadar', null, 'pemilik_produk',
   'Belum ada rincian tambahan di luar deskripsi -- dicatat sesuai spesifikasi benchmark Talenta, detail dirumuskan saat giliran tiba (Ditunda Sadar).', null, v_pemicu_umum);

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description, effect_description, urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes, ditunda_pemicu) values
  (v_company_id, 'HR-30', 'Performance Management (Goal, KPI/OKR Karyawan, Review 360, Kalibrasi)', 'HR', 'Sumber Daya Manusia',
   'Penilaian kinerja karyawan: goal, KPI/OKR individu, review 360 derajat, kalibrasi lintas tim.',
   'Kemampuan HCM penuh, belum jadi kebutuhan pabrik saat ini.',
   'ditunda_sadar', array['Database','Fungsi']::text[], 'Claude Code', 'ditunda_sadar', null, 'pemilik_produk',
   'CATATAN PENTING: modul KPI yang sudah ada di sistem ini adalah KPI OPERASIONAL pabrik, BUKAN penilaian kinerja karyawan. JANGAN dicampur -- dua konsep berbeda meski nama miripnya.',
   null, v_pemicu_umum);

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description, effect_description, urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes, ditunda_pemicu) values
  (v_company_id, 'HR-31', 'Competency Management & Skill Gap', 'HR', 'Sumber Daya Manusia',
   'Pemetaan kompetensi karyawan dan kesenjangan keterampilan.',
   'Kemampuan HCM penuh, belum jadi kebutuhan pabrik saat ini.',
   'ditunda_sadar', array['Database','Fungsi']::text[], 'Claude Code', 'ditunda_sadar', null, 'pemilik_produk',
   'Belum ada rincian tambahan di luar deskripsi -- dicatat sesuai spesifikasi benchmark Talenta, detail dirumuskan saat giliran tiba (Ditunda Sadar).', null, v_pemicu_umum);

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description, effect_description, urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes, ditunda_pemicu) values
  (v_company_id, 'HR-32', '9-Box, Talent Pool, Succession, IDP', 'HR', 'Sumber Daya Manusia',
   'Pemetaan talenta 9-box, kolam talenta, perencanaan suksesi, rencana pengembangan individu.',
   'Kemampuan HCM penuh, belum jadi kebutuhan pabrik saat ini.',
   'ditunda_sadar', array['Database','Fungsi']::text[], 'Claude Code', 'ditunda_sadar', null, 'pemilik_produk',
   'Belum ada rincian tambahan di luar deskripsi -- dicatat sesuai spesifikasi benchmark Talenta, detail dirumuskan saat giliran tiba (Ditunda Sadar).', null, v_pemicu_umum);

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description, effect_description, urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes, ditunda_pemicu) values
  (v_company_id, 'HR-33', 'LMS Penuh (Kursus, Learning Path, Sertifikat Otomatis, Progres)', 'HR', 'Sumber Daya Manusia',
   'Learning Management System penuh -- kursus, jalur belajar, sertifikat otomatis, progres.',
   'Kemampuan HCM penuh, belum jadi kebutuhan pabrik saat ini.',
   'ditunda_sadar', array['Database','Fungsi','Visual']::text[], 'Claude Code', 'ditunda_sadar', null, 'pemilik_produk',
   'PEMICU TAMBAHAN WAJIB DICATAT: dibuka hanya setelah materi pelatihan benar-benar ada dalam bentuk apa pun -- bahkan bila cuma PDF dan video HP. Yang mahal dari LMS bukan sistemnya, tapi materinya, dan itu pekerjaan pemilik produk & supervisor produksi, bukan Claude Code. Banyak pabrik membangun LMS lalu isinya tiga PDF yang tidak pernah dibuka.',
   null, v_pemicu_umum || ' Pemicu tambahan: dibuka hanya setelah materi pelatihan benar-benar ada dalam bentuk apa pun (minimal PDF/video).');

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description, effect_description, urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes, ditunda_pemicu) values
  (v_company_id, 'HR-34', 'Face Recognition & Liveness', 'HR', 'Sumber Daya Manusia',
   'Pengenalan wajah dan deteksi liveness untuk absensi/keamanan.',
   'Data biometrik adalah data pribadi sensitif menurut UU PDP.',
   'ditunda_sadar', array['Keamanan','Data','Integrasi']::text[], 'Claude Code', 'ditunda_sadar', null, 'pemilik_produk',
   'PEMICU TAMBAHAN: data biometrik adalah data pribadi sensitif menurut UU PDP. Butuh dasar hukum, consent, kebijakan retensi, enkripsi template, dan tinjauan hukum. JANGAN dibangun tanpa itu.',
   null, v_pemicu_umum || ' Pemicu tambahan: butuh dasar hukum, consent, kebijakan retensi, enkripsi template, dan tinjauan hukum (UU PDP) -- jangan dibangun tanpa itu.');

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description, effect_description, urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes, ditunda_pemicu) values
  (v_company_id, 'HR-35', 'Live Tracking Karyawan Lapangan', 'HR', 'Sumber Daya Manusia',
   'Pelacakan lokasi karyawan lapangan secara langsung.',
   'Wilayah privasi berat, sama seperti HR-34.',
   'ditunda_sadar', array['Keamanan','Data','Integrasi']::text[], 'Claude Code', 'ditunda_sadar', null, 'pemilik_produk',
   'Wilayah privasi berat -- butuh dasar hukum & consent yang sama ketatnya dengan HR-34.', null, v_pemicu_umum || ' Pemicu tambahan: wilayah privasi berat, butuh tinjauan hukum sama seperti HR-34.');

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description, effect_description, urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes, ditunda_pemicu) values
  (v_company_id, 'HR-36', 'Integrasi Perangkat Biometrik/Fingerprint (Pola Adapter)', 'HR', 'Sumber Daya Manusia',
   'Sambungan ke perangkat fingerprint/biometrik fisik yang sudah ada.',
   'Kemampuan HCM penuh, belum jadi kebutuhan pabrik saat ini.',
   'ditunda_sadar', array['Integrasi','Keamanan']::text[], 'Claude Code', 'ditunda_sadar', null, 'pemilik_produk',
   'Pola adapter -- 1 antarmuka generik, bukan hardcode per merek perangkat.', null, v_pemicu_umum);

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description, effect_description, urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes, ditunda_pemicu) values
  (v_company_id, 'HR-37', 'Earned Wage Access', 'HR', 'Sumber Daya Manusia',
   'Akses gaji yang sudah diperoleh (belum jatuh tempo) lebih awal oleh karyawan.',
   'Butuh tinjauan hukum & keuangan.',
   'ditunda_sadar', array['Keamanan','Formula','Integrasi']::text[], 'Claude Code', 'ditunda_sadar', null, 'pemilik_produk',
   'Butuh tinjauan hukum & keuangan sebelum dibangun.', null, v_pemicu_umum || ' Pemicu tambahan: butuh tinjauan hukum & keuangan.');

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description, effect_description, urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes, ditunda_pemicu) values
  (v_company_id, 'HR-38', 'HR Analytics (Dashboard Headcount, Payroll, Absensi, Kinerja)', 'HR', 'Sumber Daya Manusia',
   'Dashboard analitik SDM: headcount, payroll, absensi, kinerja.',
   'Kemampuan HCM penuh, belum jadi kebutuhan pabrik saat ini.',
   'ditunda_sadar', array['Data','Visual']::text[], 'Claude Code', 'ditunda_sadar', null, 'pemilik_produk',
   'Prasyarat: sebagian besar modul HR-20 s.d. HR-32 perlu ada dulu supaya ada data yang dianalisis.', null, v_pemicu_umum);

  -- ================= PLATFORM =================

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description, effect_description, urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes) values
  (v_company_id, 'PLT-01', 'MFA & SSO', 'PLT', 'Platform',
   'Multi-factor authentication dan single sign-on.',
   'Keamanan akses tingkat platform, belum mendesak untuk 1 tenant nyata saat ini.',
   'bisa_menunggu', array['Keamanan','Integrasi']::text[], 'Claude Code', 'menunggu', null, 'pemilik_produk',
   'Belum ada rincian lebih lanjut -- dicatat sesuai spesifikasi benchmark, dikerjakan menunggu giliran.',
   null);

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description, effect_description, urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes) values
  (v_company_id, 'PLT-02', 'Workflow Engine Generik yang Bisa Dikonfigurasi Tenant', 'PLT', 'Platform',
   'Mesin alur kerja/approval generik, bisa dikonfigurasi per tenant.',
   'Rantai approval 3 departemen yang ada sekarang KAKU. Tenant lain punya rantai berbeda. Ini prasyarat multi-tenant nyata.',
   'bisa_menunggu', array['Fungsi','Database']::text[], 'Claude Code', 'menunggu', null, 'pemilik_produk',
   'Prasyarat multi-tenant nyata -- rantai approval PO Client 3 departemen saat ini hardcode, perlu digeneralisasi jadi konfigurasi per tenant.',
   null);

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description, effect_description, urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes, ditunda_pemicu) values
  (v_company_id, 'PLT-03', 'Custom Report Builder + Semantic Layer', 'PLT', 'Platform',
   'Pembuat laporan kustom dengan lapisan semantik (semantic layer).',
   'Kamus + panel asal-usul yang sudah ada ADALAH cikal-bakal semantic layer ini. Jangan dibangun dari nol.',
   'ditunda_sadar', array['Data','Fungsi']::text[], 'Claude Code', 'ditunda_sadar', null, 'pemilik_produk',
   'Kamus (kamus_terms) dan panel asal-usul (provenance) yang sudah ada ADALAH cikal-bakal semantic layer ini -- jangan dibangun dari nol saat giliran tiba.',
   null, v_pemicu_umum);

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description, effect_description, urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes, ditunda_pemicu) values
  (v_company_id, 'PLT-04', 'Public API + Webhook + Event Subscription', 'PLT', 'Platform',
   'API publik, webhook, dan langganan event untuk integrasi pihak ketiga.',
   'Kemampuan platform penuh, belum jadi kebutuhan tenant tunggal saat ini.',
   'ditunda_sadar', array['Integrasi','Dokumentasi']::text[], 'Claude Code', 'ditunda_sadar', null, 'pemilik_produk',
   'Belum ada rincian tambahan di luar deskripsi -- dicatat sesuai spesifikasi benchmark Talenta, detail dirumuskan saat giliran tiba (Ditunda Sadar).', null, v_pemicu_umum);

end $$;
