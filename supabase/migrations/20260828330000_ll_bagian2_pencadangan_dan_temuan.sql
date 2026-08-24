-- LL / BAGIAN 2 (24 Agu 2026) — JARING PENGAMAN SEBELUM PEMBERSIHAN DATA,
-- beserta temuan yang lahir saat menyiapkannya.

do $$
declare
  v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then
    raise notice 'Perusahaan PT ITM tidak ditemukan -- pencatatan task di migrasi ini dilewati (no-op).';
    return;
  end if;

-- ============================================================================
-- AUD-07 — NAIK URGENSI, dengan alasan yang DIKOREKSI setelah diperiksa langsung.
--
-- Kalimat pemilik produk (LL.5) dicatat apa adanya, lalu dilengkapi dengan apa yang
-- ternyata benar. Perbedaannya penting: bukan mekanismenya yang tidak ada.
-- ============================================================================
update build_tasks set
  urgency = 'mendesak',
  notes = coalesce(notes || E'\n\n', '') ||
    E'DINAIKKAN 24 Agu 2026 (LL.5). Kalimat pemilik produk: "jejak perubahan data PT ITM berisi ' ||
    E'TEPAT SATU BARIS, sehingga tidak ada cara membuktikan apa saja yang pernah tertimpa. Ini bukan ' ||
    E'kekurangan penyelidikan -- ini ketiadaan bahan untuk diselidiki."\n\n' ||
    E'ANGKANYA BENAR, TAPI SEBABNYA BUKAN YANG SEMULA DILAPORKAN. Diperiksa langsung sesudahnya: ' ||
    E'data_change_audit_log berisi 544 baris dan pemicunya MEMANG BEKERJA -- terpasang di 9 tabel ' ||
    E'(employees, shipments, customer_purchase_orders, purchase_orders, suppliers, sales_orders, ' ||
    E'customers, attendance_events, attendance_corrections). Yang benar untuk PT ITM hanya 1 baris, ' ||
    E'karena DUA sebab yang keduanya masih berlaku hari ini:\n\n' ||
    E'1. PEMICUNYA BARU DIPASANG 22-23 Agu 2026. Jejak paling awal 22 Agu 20:22. Seluruh data PT ITM ' ||
    E'   dibuat 19-20 Agu -- SEBELUM ada yang mencatat. Insiden 17 Agu jauh lebih awal lagi.\n' ||
    E'2. HANYA 9 DARI 90 TABEL YANG TERPANTAU, dan tabel `users` BUKAN salah satunya. Padahal justru ' ||
    E'   `users` yang tertimpa pada 17 Agu (avatar_url & signature_url). Artinya kejadian yang sama ' ||
    E'   PERSIS, bila terulang hari ini, TETAP tidak meninggalkan jejak apa pun.\n\n' ||
    E'Jadi pekerjaan AUD-07 bukan "bangun jejak audit" melainkan "PERLUAS cakupannya" -- dimulai dari ' ||
    E'tabel yang menyimpan identitas dan berkas pengguna.'
where task_code = 'AUD-07';

-- ============================================================================
-- INF-23 — NAIK JADI PRASYARAT BAGIAN 3 (LL.2), bukan task sejajar.
-- ============================================================================
update build_tasks set
  urgency = 'mendesak',
  notes = coalesce(notes || E'\n\n', '') ||
    E'DIJADIKAN PRASYARAT PEMBERSIHAN DATA oleh pemilik produk, 24 Agu 2026 (LL.2). Alasannya: bila ' ||
    E'migrasi tidak bisa membersihkan berkas, pembersihan data akan melahirkan angkatan berkas yatim ' ||
    E'baru -- persis masalah yang baru saja dibereskan.\n\n' ||
    E'DUA PILIHAN CARA PENDAMPING, beserta yang lebih aman:\n\n' ||
    E'PILIHAN A -- APLIKASI MENGHAPUS BERKAS DULU, MIGRASI MENYUSUL. Skrip memanggil ' ||
    E'src/lib/storageCleanup.ts untuk mengumpulkan lalu menghapus berkas SELAGI baris induknya masih ' ||
    E'ada, baru migrasi menghapus barisnya.\n' ||
    E'PILIHAN B -- MIGRASI DULU, SKRIP MENYUSUL. Migrasi menghapus baris, lalu skrip menyapu berkas ' ||
    E'yang tidak lagi dirujuk siapa pun.\n\n' ||
    E'YANG LEBIH AMAN: PILIHAN A, dan ini bukan selera. Begitu barisnya hilang, JEJAK MENUJU BERKASNYA ' ||
    E'IKUT HILANG -- tidak ada lagi cara mengetahui berkas itu milik siapa. Pilihan B hanya bisa ' ||
    E'menebak lewat "tidak dirujuk siapa pun", dan tebakan itu SALAH untuk berkas yang memang belum ' ||
    E'pernah dirujuk (unggahan yang gagal di tengah jalan) -- ia akan menghapus berkas yang masih ' ||
    E'ditunggu. Urutan yang sama sudah TERBUKTI menentukan sekali hari ini: pembersihan Storage yang ' ||
    E'diletakkan sesudah penghapusan baris membuat test langsung merah, karena berkasnya justru selamat ' ||
    E'lalu jadi yatim.\n\n' ||
    E'RISIKO PILIHAN A yang harus disadari: bila skrip berhasil menghapus berkas lalu migrasinya gagal, ' ||
    E'barisnya tetap ada sementara berkasnya sudah hilang -- layar menampilkan gambar rusak. Karena itu ' ||
    E'skrip dijalankan SETELAH pencadangan (Bagian 2) terbukti berisi berkasnya, sehingga keadaan itu ' ||
    E'bisa dipulihkan.'
where task_code = 'INF-23';

-- ============================================================================
-- TEMUAN BARU — 562 BARIS YATIM DI DATA NYATA, DITINGGALKAN PEMBERSIHAN LAMA.
--
-- Ditemukan saat mencetak angka pembanding sebelum pembersihan (LL / Bagian 2.3).
-- Ini bukan kecurigaan: diverifikasi dua cara berbeda (NOT IN dan LEFT JOIN).
-- ============================================================================
insert into build_tasks (
  company_id, task_code, name, module_code, module_name, description, effect_description,
  urgency, tags, pic, status, origin, detail_pekerjaan
) values (
  v_company_id, 'AUD-31', 'Pembersihan Ber-replica Meninggalkan Baris Yatim di Tabel Tanpa company_id', 'AUD', 'Audit Kualitas',
  'Project data nyata memuat 562 baris yang menunjuk induk yang sudah tidak ada: 561 di customer_po_approvals dan 1 di work_order_outputs. Kunci asingnya ADA dan SAH -- keadaan ini hanya mungkin karena penghapusan dilakukan dengan penegakan kunci asing DIMATIKAN.',
  'Angka di layar dan di laporan ikut menghitung baris yang seharusnya tidak ada lagi. Lebih penting: pola yang melahirkannya akan mengulanginya setiap kali ada pembersihan data berikutnya.',
  'penting', array['audit','integritas','pembersihan'], 'Claude Code', 'menunggu', 'temuan_claude',
  E'AKARNYA DITEMUKAN, bukan diduga: migrasi 20260826100000_cleanup_orphaned_test_companies.sql ' ||
  E'menyalakan `session_replication_role = replica` (mematikan penegakan kunci asing), lalu menghapus ' ||
  E'baris HANYA dari tabel yang PUNYA kolom company_id. Tabel anak yang TIDAK punya kolom itu -- ' ||
  E'customer_po_approvals dan work_order_outputs termasuk -- tidak pernah tersentuh, sementara induknya ' ||
  E'terhapus tanpa perlawanan.\n\n' ||
  E'Komentar di migrasi itu menyatakan "aman karena yang dihapus adalah seluruh subtree data uji". ' ||
  E'Justru anggapan itulah yang keliru: perulangannya TIDAK BISA MELIHAT tabel tanpa company_id, jadi ' ||
  E'yang terhapus bukan seluruh subtree.\n\n' ||
  E'BENTUK SISANYA khas fixture: 561 baris untuk 188 PO berbeda, tepat 3 baris per PO, ber-id berurutan. ' ||
  E'Bukan data bisnis PT ITM.\n\n' ||
  E'YANG HARUS DILAKUKAN, dan urutannya penting:\n' ||
  E'1. Hapus 562 baris yatim itu (aman: induknya sudah tidak ada, tidak ada yang merujuknya).\n' ||
  E'2. LEBIH PENTING -- setiap pembersihan berikutnya yang memakai replica WAJIB menghapus tabel anak ' ||
  E'   tanpa company_id secara EKSPLISIT lewat join ke induknya, SEBELUM induknya dihapus. Tanpa ini, ' ||
  E'   Bagian 3 akan melahirkan angkatan yatim baru dengan cara yang sama persis.\n\n' ||
  E'KELAS YANG SAMA SUDAH DIKENAL: kebutaan "mencari lewat keberadaan kolom company_id" sudah tercatat ' ||
  E'sebagai batas jangkauan di tests/testCompanyCleanup.ts. Yang baru di sini adalah bukti bahwa kebutaan ' ||
  E'itu SUDAH menghasilkan sisa nyata di project data sungguhan, bukan cuma risiko di atas kertas.'
) on conflict (company_id, task_code) do nothing;

-- ============================================================================
-- TEMUAN BARU — JEJAK WAJIB PENGGOLONGAN BIAYA KARYAWAN BELUM PERNAH TERISI.
-- ============================================================================
insert into build_tasks (
  company_id, task_code, name, module_code, module_name, description, effect_description,
  urgency, tags, pic, status, origin, detail_pekerjaan
) values (
  v_company_id, 'AUD-32', 'Jejak Penggolongan Biaya Karyawan Kosong Sama Sekali', 'AUD', 'Audit Kualitas',
  'Tabel employee_cost_category_history berisi NOL baris, dan tidak ada satu pun kode di src/ atau app/ yang menulisnya. Yang menyebutnya hanya berkas migrasi.',
  'CLAUDE.md menetapkan bahwa Finance boleh menetapkan penggolongan biaya karyawan LANGSUNG tanpa alur persetujuan, dan penggantinya adalah JEJAK WAJIB: siapa menetapkan, kapan, dari apa ke apa, alasannya. Bila jejak itu tidak pernah terisi, yang tersisa adalah kewenangan tanpa penggantinya.',
  'penting', array['audit','biaya-sdm','terdaftar-tapi-mati'], 'Claude Code + Pemilik Produk', 'menunggu', 'temuan_claude',
  E'CARA MENEMUKANNYA: memeriksa isi cadangan tabel demi tabel (LL / Bagian 2.1). Tabel ini ikut ' ||
  E'tercadangkan tapi isinya nol, lalu penyisiran src/ dan app/ tidak menemukan satu pun penulis.\n\n' ||
  E'BATAS PENYISIRAN INI: ia membuktikan tidak ada penulis DI KODE HARI INI. Ia tidak membuktikan ' ||
  E'penggolongan 30 karyawan tidak pernah ditetapkan -- penetapannya memang ada (tercatat di CLAUDE.md ' ||
  E'dan MRG-11), yang tidak ada adalah jejaknya di dalam sistem.\n\n' ||
  E'KAITAN DENGAN AUD-07: keduanya kelas yang sama -- keputusan yang menentukan arti angka terjadi di ' ||
  E'luar sistem, sehingga tidak bisa ditelusuri dari dalam sistem.'
) on conflict (company_id, task_code) do nothing;

-- ============================================================================
-- SEC-13 — TINJAU KREDENSIAL BACA-SAJA sebagai pengganti flag pelolos (LL.3).
-- ============================================================================
insert into build_tasks (
  company_id, task_code, name, module_code, module_name, description, effect_description,
  urgency, tags, pic, status, origin, detail_pekerjaan
) values (
  v_company_id, 'SEC-13', 'Ganti Flag Pelolos dengan Kredensial Baca-Saja', 'SEC', 'Keamanan',
  'Pengawas integritas AUD-13 dijalankan terhadap data nyata dengan menyalakan ALLOW_TESTS_AGAINST_REAL_PROJECT. Flag itu tidak bisa membedakan test yang membaca dari test yang menulis -- ia bergantung pada disiplin orang yang menyalakannya.',
  'Selama pengaman berbentuk flag, satu kekeliruan manusia cukup untuk menjalankan test yang menulis terhadap data sungguhan. Kredensial baca-saja membuat kekeliruan itu berhenti jadi kemungkinan.',
  'penting', array['keamanan','test','data-nyata'], 'Claude Code + Pemilik Produk', 'menunggu', 'pemilik_produk',
  E'ARAHAN PEMILIK PRODUK (24 Agu 2026, LL.3): alasan mempertahankan flag DITERIMA, batasnya sudah ' ||
  E'dicatat di berkasnya sendiri ("HANYA untuk proses yang MEMBACA; setiap pemakaian untuk menulis ' ||
  E'adalah pelanggaran"). Yang diminta: PERIKSA apakah pengawas integritas bisa dijalankan dengan hak ' ||
  E'baca-saja, sehingga flag ini tidak perlu ada sama sekali.\n\n' ||
  E'YANG SUDAH DIPERIKSA sejauh ini: kedua pengawas (kpi_kamus_integrity_guard, mlvt_case_study_skeleton) ' ||
  E'murni SELECT. Jadi secara kebutuhan, hak baca-saja SUDAH CUKUP.\n\n' ||
  E'YANG BELUM DIPERIKSA, dan itu bagian yang menentukan: apakah peran baca-saja bisa dibuat di Postgres ' ||
  E'Supabase lalu dipakai lewat pustaka klien yang ada. Kuncinya bukan sekadar peran database -- klien ' ||
  E'Supabase memakai kunci API yang terikat peran bawaan (anon/authenticated/service_role). Kemungkinan ' ||
  E'besar perlu peran baru + kunci tersendiri, dan itu menyentuh setelan project. JANGAN dikerjakan ' ||
  E'sebelum diputuskan pemilik produk.\n\n' ||
  E'JANGAN mencabut flag sebelum penggantinya benar-benar bekerja -- kalau tidak, pengawas integritas ' ||
  E'mati diam-diam dan tidak ada yang memberi tahu.'
) on conflict (company_id, task_code) do nothing;

-- ============================================================================
-- SEC-12 — LANGKAH BILA KELAK ADA KEBOCORAN NYATA (LL.4).
-- ============================================================================
update build_tasks set
  notes = coalesce(notes || E'\n\n', '') ||
    E'PELAJARAN UMUM (LL.4, ditetapkan pemilik produk 24 Agu 2026): "Menutup akses tidak menghapus ' ||
    E'salinan yang sudah tersebar. Untuk kebocoran sungguhan, berkasnya HARUS DIHAPUS, bukan hanya ' ||
    E'ditutup aksesnya. Kali ini tidak berbahaya karena yang tersinggah hanya unduhan penyelidikan ' ||
    E'sendiri."\n\n' ||
    E'DAFTAR LANGKAH BILA KELAK ADA KEBOCORAN NYATA, urut:\n' ||
    E'1. HAPUS berkasnya lewat Storage API. Menutup bucket saja menyisakan salinan singgahan sampai ' ||
    E'   satu jam. Menghapus berkas menutup jalur asalnya seketika.\n' ||
    E'2. Baru sesudah itu tutup/periksa bucket-nya, supaya berkas berikutnya tidak lahir terbuka.\n' ||
    E'3. Anggap salinan yang sudah TERUNDUH orang sebagai HILANG PERMANEN. Tidak ada tindakan teknis ' ||
    E'   yang bisa menariknya kembali; yang tersisa adalah keputusan bisnis (mis. tanda tangan diganti).\n' ||
    E'4. Catat berkas mana, sejak kapan terbuka, dan alamat mana saja yang diketahui pernah diambil.'
where task_code = 'SEC-12';

-- ============================================================================
-- AUD-30 — KEPUTUSAN PEMILIK PRODUK: TAMPILKAN.
-- ============================================================================
update build_tasks set
  urgency = 'penting',
  notes = coalesce(notes || E'\n\n', '') ||
    E'KEPUTUSAN PEMILIK PRODUK 24 Agu 2026: TAMPILKAN, di halaman detail pengiriman.\n\n' ||
    E'Alasan yang dicatat apa adanya: "fotonya sudah diambil, tinggal ditampilkan. Yang tidak boleh ' ||
    E'adalah membiarkannya seperti sekarang -- meminta penerima barang memotret sesuatu yang hasilnya ' ||
    E'tidak pernah dipakai adalah gesekan tanpa manfaat, kelas yang sama dengan Reorder Point."\n\n' ||
    E'LINGKUP YANG DITETAPKAN:\n' ||
    E'1. Tampilkan foto konfirmasi penerimaan, foto keberangkatan, dan tanda tangan penerima. Laporkan ' ||
    E'   lebih dulu mana dari ketiganya yang ternyata memang belum pernah tampil.\n' ||
    E'2. Aksesnya lewat signed URL, BUKAN alamat langsung -- ketiganya baru dipindahkan ke bucket privat, ' ||
    E'   dan menampilkannya dengan alamat langsung membatalkan pekerjaan itu.\n' ||
    E'3. Hak akses mengikuti halaman pengiriman yang sudah ada. JANGAN membuat gerbang baru. Laporkan ' ||
    E'   peran apa saja yang bisa membukanya; bila terlalu luas untuk foto dan tanda tangan orang, ' ||
    E'   sodorkan sebagai pertanyaan, jangan diputuskan sendiri.\n' ||
    E'4. Tampilkan KETERANGANNYA juga: siapa mengunggah, kapan, dari perangkat apa bila tercatat. Saat ' ||
    E'   sengketa yang dibutuhkan bukan "ada fotonya" melainkan "foto ini diambil siapa dan kapan".\n' ||
    E'5. Bila fotonya tidak ada: keterangan jelas ("penerima tidak mengunggah foto"), BUKAN ruang kosong. ' ||
    E'   Ruang kosong terbaca seperti gambar yang gagal dimuat.\n' ||
    E'6. Responsive, diuji di 360/768/1280/1920 -- halaman ini kemungkinan dibuka dari HP saat ada ' ||
    E'   sengketa di lapangan.\n' ||
    E'7. Bukti visual: pengiriman uji berfoto & bertanda tangan menampilkan ketiganya; alamat gambar ' ||
    E'   dibuka tanpa login setelah masa berlaku habis -> ditolak; pengiriman tanpa foto -> keterangan ' ||
    E'   jelas; 360 px -> gambar tidak meluber. Bersihkan fixture dan laporkan pembersihannya.\n' ||
    E'8. URUTAN: dikerjakan SETELAH Bagian 2 dan INF-23. Periksa dulu apakah halaman ini juga masuk ' ||
    E'   daftar RSP-02 (8 halaman yang masih memotong kolom); bila ya, kerjakan bersama supaya halaman ' ||
    E'   itu tidak disentuh dua kali.'
where task_code = 'AUD-30';

-- ============================================================================
-- INF-16 — pencadangan Storage: SUDAH DIKERJAKAN untuk jalur ekspor manual.
-- ============================================================================
update build_tasks set
  notes = coalesce(notes || E'\n\n', '') ||
    E'SEBAGIAN DIKERJAKAN 24 Agu 2026 (LL / Bagian 2.1): scripts/backup-export-json.js sekarang ikut ' ||
    E'MENYALIN ISI berkas Storage, bukan cuma daftar namanya. Dibuktikan pada cadangan hari ini: 4 dari ' ||
    E'4 berkas tersalin, dan tanda tangan tulisan tangan asli terverifikasi utuh (818x198 piksel, ' ||
    E'11.928 byte -- sama persis dengan aslinya).\n\n' ||
    E'YANG MASIH TERBUKA, jadi task ini JANGAN ditutup: pencadangan otomatis harian Supabase TETAP tidak ' ||
    E'mencakup Storage. Yang baru ada adalah ekspor MANUAL yang harus diingat untuk dijalankan. Itu lebih ' ||
    E'baik daripada tidak ada, tapi ia pengaman yang bergantung pada ingatan -- kelas yang sama dengan ' ||
    E'daftar tabel yang ditulis tangan.'
where task_code = 'INF-16';

end $$;
