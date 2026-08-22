-- CC.1-CC.2 -- sapu 4 dokumen yang baru disalin ke docs/ (rencana-routing-
-- nonlinear.md, antrean-koreksi-fitur-ada.md, instruksi-rebrand-fabrix.md,
-- checklist-fase-spec-vs-fabrix.md), memakai metodologi sama seperti AA.1,
-- DENGAN kehati-hatian kedaluwarsa (CC.2) -- dicek dulu tiap temuan apakah
-- sudah dibatalkan/diubah sebelum dicatat jadi task baru.

-- 1) rencana-routing-nonlinear.md -- SUDAH ada tugasnya (RDM-02 "Routing
-- Paralel", urgency bisa_menunggu -- sudah mencerminkan turunnya prioritas
-- yang disebutkan pemilik produk). Detail lama terlalu generik ("Perlu
-- keputusan arsitektur besar, belum dibahas") -- dilengkapi dengan rencana
-- konkret dari dokumen, MINUS bagian yang sudah dibatalkan (ambang overlap
-- qty/persen -- acuannya batch produksi, bukan ambang kuantitas).
update public.build_tasks
set detail_pekerjaan = 'Rencana lengkap (22 Agu 2026, dari rencana-routing-nonlinear.md, BAGIAN OVERLAP THRESHOLD SUDAH DIBATALKAN -- lihat catatan): model dependency SETELAH_SELESAI + jeda tunggu (lag menit) antar tahap (skema routing_step_dependencies: routing_version_id/step_id/predecessor_step_id/dependency_kind/lag_minutes), builder 2-field berbahasa manusia ("mulai setelah" + "jeda tunggu" -- field "cara mulai: boleh menyusul sebagian" DIHAPUS dari rencana karena mekanisme ambang overlap qty/persen sudah dibatalkan), paralel lahir otomatis dari graf (bukan dikelola manual), validasi DAG (siklus ditolak) + peringatan (bukan blokir) kalau 2 tahap paralel pakai mesin/kru sama, penegakan urutan di MES (tombol "mulai tahap" hanya aktif bila semua pendahulu selesai / jeda terlewati), Gantt berlajur paralel (penjadwalan tetap manual), estimasi selesai dari jalur terpanjang graf (critical path sederhana). R-B (penjadwalan otomatis) TETAP tidak dibangun. Pertanyaan tersisa untuk pemilik produk (belum terjawab): jeda tunggu nyata di titik mana pun rute serbuk (kalibrasi lag); siapa peran yang boleh override darurat penegakan urutan (dan wajib tercatat+alasan).',
    notes = 'CATATAN KEDALUWARSA (CC.2, 22 Agu 2026): mekanisme ambang overlap kuantitas/persen (dependency_kind=MENYUSUL_SEBAGIAN, overlap_threshold_qty, overlap_threshold_pct) DIBATALKAN pemilik produk -- acuannya batch produksi, bukan ambang kuantitas. Gerbang waktu asli ("R-A dibangun setelah batch MLVT pertama") juga sudah diganti -- turun ke Bisa Menunggu karena kasus lapangan ternyata batch tumpang tindih (bukan routing paralel sungguhan), dan satu-satunya cabang nyata dikerjakan orang yang sama (tidak perlu penjadwalan paralel).'
where task_code = 'RDM-02';

-- 2) antrean-koreksi-fitur-ada.md -- S1(a) "Duplikat sebagai order baru"
-- BUKAN task yang sama dengan PJL-05 (PJL-05 = MENCEGAH duplikat entri,
-- bukan MEMBUAT SALINAN order lama sebagai draf baru -- dua fitur yang
-- berlawanan makna, sempat nyaris tertukar). Task baru:
insert into public.build_tasks
  (company_id, task_code, name, module_code, module_name, description, effect_description, urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes)
values (
  1, 'PJL-06', 'Duplikat sebagai Order Baru (Repeat Order)', 'PJL', 'Penjualan',
  'Setiap repeat PO dari klien yang sama untuk produk yang sama, produk harus diketik ulang manual -- keluhan harian pemilik produk, gesekan di fitur inti yang sudah ada.',
  'Repeat order adalah norma bisnis contract manufacturer (klien sama, produk sama, berulang) -- tanpa jalan pintas, biaya pengetikan ulang ditanggung tiap hari.',
  'penting', array['Fungsi'], 'Claude Code', 'menunggu', '/customer-purchase-orders', 'pemilik_produk',
  'Audit alur PO klien->approval->SO dulu (read-only, temuan menentukan bentuk final -- jangan asumsikan). Tombol "Duplikat sebagai order baru" dari riwayat order klien: salin INPUT (produk, spesifikasi, catatan, harga terakhir sebagai draf berlabel "harga order sebelumnya -- periksa"), JANGAN salin HASIL (feasibility/kekurangan bahan/jadwal/biaya/margin dihitung baru dari kondisi hari ini). Rantai approval 3 departemen tetap penuh, tanpa jalan pintas. PINTU MASUK: halaman profil produk (PRD-11) atau riwayat order pelanggan (PMB-09) -- BUKAN PJL-05 (PJL-05 soal mencegah duplikat entri, arah berlawanan dari fitur ini). Bukti minimum: duplikat order lama saat harga bahan sudah berubah -> margin baru BERBEDA dari margin lama; duplikat tidak melompati approval; user tanpa akses klien itu tidak bisa menduplikat ordernya.',
  'Ditemukan lewat sinkronisasi CC.1 (22 Agu 2026, dari antrean-koreksi-fitur-ada.md Sesi S1) -- sempat berisiko dianggap sudah tercakup PJL-05 karena nama mirip, TERNYATA fitur berlawanan arah (PJL-05 mencegah, ini menyalin).'
);

-- S1(b) "halaman profil produk" -- SUDAH ada (PRD-11), dilengkapi rujukan.
update public.build_tasks
set notes = coalesce(notes || E'\n\n', '') || 'Dirujuk dari antrean-koreksi-fitur-ada.md (S1) sebagai pintu masuk PJL-06 (Duplikat sebagai Order Baru) -- ringkasan wajib memuat: BOM aktif, routing aktif, riwayat order & harga, margin terakhir.'
where task_code = 'PRD-11';

-- S2(a) konversi UOM sachet/roll -- SUDAH SELESAI menurut pemilik produk
-- (faktor 3.333) -- TIDAK dicatat sebagai task baru, sudah moot. MST-13
-- (audit generik pemakaian uom_conversion_factor lintas modul) tetap
-- berdiri sendiri sebagai task PREVENTIF terpisah, bukan duplikat.

-- S2(b) standar kru per tahap: PRD-06 sudah ada tapi belum menyebut 2 syarat
-- konkret dari S2 -- dilengkapi.
update public.build_tasks
set detail_pekerjaan = detail_pekerjaan || E'\n\nDilengkapi dari antrean-koreksi-fitur-ada.md (S2, 22 Agu 2026): begitu data lapangan PPIC tersedia, tambahkan (1) validasi gerbang lunak -- batch TIDAK BISA dinyatakan selesai biayanya bila standar kru tahapnya masih kosong, tampil peringatan jelas "biaya SDM = 0, standar belum diisi" (bukan blokir keras, sekadar peringatan); (2) seed data standar kru routing serbuk 10 tahap BERSAMA pemilik produk/PPIC -- angka dari mereka, JANGAN dikarang.'
where task_code = 'PRD-06';

-- 3) instruksi-rebrand-fabrix.md -- R0/R1/R2/R3/cek merek SUDAH tercatat
-- (RBD-01/02a/02b/03/04/07), RBD-04 malah SUDAH mencerminkan pencabutan
-- gerbang "12 September" persis seperti diberitahu pemilik produk (tidak
-- kedaluwarsa, sudah sinkron). Yang belum: R4 (domain/email cutover) dan
-- R5 (bersih-bersih identifier) -- 2 task baru.
insert into public.build_tasks
  (company_id, task_code, name, module_code, module_name, description, effect_description, urgency, tags, pic, status, link_url, origin, detail_pekerjaan)
values
(
  1, 'RBD-05', 'R4 -- Domain & Email Cutover', 'RBD', 'Rebrand FABRIX',
  'Setelah R3 (transfer kepemilikan) stabil >=3 hari: sambungkan domain fabrix, migrasi email pengirim, jaga kontrak eksternal (token POD lama) tetap hidup.',
  'Tanpa cutover terencana, token POD lama di QR surat jalan yang sudah dicetak bisa mati, dan email dari domain baru bisa masuk spam tanpa SPF/DKIM/DMARC diuji dulu.',
  'bisa_menunggu', array['Integrasi'], 'Claude Code', 'menunggu', null, 'pemilik_produk',
  'PRASYARAT KERAS: RBD-04 (R3) selesai DAN stabil minimal 3 hari sebelum mulai. Langkah: (1) tambah domain fabrix ke Vercel berdampingan dengan URL lama; (2) Supabase Auth site URL & redirect URLs memuat domain baru DAN lama; (3) SMTP pengirim -> no-reply@fabrix.<tld>, SPF/DKIM/DMARC dipasang & diuji ke Gmail/Yahoo/Outlook; (4) URL POD lama di QR surat jalan yang sudah dicetak WAJIB tetap hidup -- domain lama jadi redirect permanen minimal 12 bulan, token POD lama tetap tervalidasi; (5) setelah 2 minggu stabil, domain baru jadi kanonik.'
),
(
  1, 'RBD-06', 'R5 -- Bersih-Bersih Identifier Kode', 'RBD', 'Rebrand FABRIX',
  'Nama package, nama repo internal di docs, komentar kode, nama workflow CI -- masih menyebut nama lama (AMS) di lapisan internal (bukan tampilan pengguna, sudah selesai di R1).',
  'Kerapian internal murni -- tidak ada dampak pengguna, dikerjakan santai kapan saja setelah fase lain stabil.',
  'bisa_menunggu', array['Dokumentasi'], 'Claude Code', 'menunggu', null, 'pemilik_produk',
  'JANGAN rename schema/tabel database hanya demi branding -- nama internal DB bukan merek, migrasi rename massal adalah risiko tanpa nilai pengguna (instruksi eksplisit). Cukup nama package, nama repo internal di dokumen, komentar kode, nama workflow CI.'
);

-- 4) checklist-fase-spec-vs-fabrix.md -- 43 baris status assessment (bukan
-- daftar temuan mentah). 2 prioritas "perlu tindakan dekat" yang disebut
-- dokumen ini sendiri (alur repeat-PO/duplikat SO; standar kru per tahap)
-- SUDAH tercakup di atas (PJL-06, PRD-06) -- TIDAK duplikat. 43 baris
-- lainnya adalah keputusan "ditunda sadar dengan pemicu tercatat" (Product
-- Configurator, Maintenance module, dst) menurut framing dokumen itu
-- sendiri -- TIDAK disapu baris-per-baris jadi task terpisah sesi ini
-- (skala besar, sebagian sudah kedaluwarsa per 20->22 Agu, perlu audit
-- ulang keseluruhan tersendiri, bukan pencocokan cepat).
