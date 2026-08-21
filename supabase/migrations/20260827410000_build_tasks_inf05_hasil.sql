-- Halaman Daftar Tugas Pembangunan -- INF-05 dikerjakan 22 Agu 2026. 2 dari 3
-- langkah selesai (backup manual + terjadwal), 1 langkah lain (perbaikan
-- Production Branch Vercel) TIDAK bisa diotomasi dengan aman dari environment
-- ini, dan sub-langkah 2b/2c (nyalakan PITR asli) butuh keputusan biaya
-- pemilik produk -- dipindah ke Menunggu Persetujuan, BUKAN Selesai.
do $$
declare
  v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then
    raise notice 'Perusahaan PT ITM tidak ditemukan -- migrasi dilewati (no-op).';
    return;
  end if;

  update build_tasks set
    status = 'menunggu_persetujuan',
    completed_at = now(),
    approval_review_steps = 'Baca ringkasan di laporan sesi ini (bagian INF-05). 2 hal butuh tindakan pemilik produk: (1) konfirmasi paket/biaya Supabase untuk menyalakan PITR asli -- Claude Code TIDAK bisa memastikan tier langganan tanpa membuka dashboard billing sendiri (sengaja tidak diintip lewat token tersimpan); (2) ubah 1 setelan di Vercel Dashboard (Project mrp-staging -> Settings -> Git -> Production Branch, dari "main" ke "staging") -- percobaan otomatis lewat API Vercel GAGAL dengan aman (dikonfirmasi TIDAK ada perubahan tersimpan) karena bentuk body yang benar butuh field git-link lengkap yang berisiko salah kalau ditebak, jadi sengaja dihentikan sebelum mencoba lagi.',
    approval_location = 'Supabase Dashboard -> Organization -> Billing (untuk poin 1). Vercel Dashboard -> project mrp-staging -> Settings -> Git -> Production Branch (untuk poin 2).',
    approval_example_case = 'Contoh: buka https://vercel.com/ams-3670/mrp-staging/settings dan ganti kolom "Production Branch" dari main menjadi staging, klik Save. Untuk billing, buka halaman billing organisasi Supabase dan lihat nama paket saat ini (Free/Pro/dst) beserta harga PITR yang ditawarkan untuk paket itu.',
    approval_if_approved = 'Setelah pemilik produk mengubah Production Branch: Claude Code memverifikasi lewat push percobaan (bukti 3c) bahwa push ke main tidak lagi memicu deployment publik baru. Setelah pemilik produk mengonfirmasi paket/biaya PITR: Claude Code menyalakan PITR (jika pemilik produk setuju) dan membuktikan snapshot pertama terbentuk. Task ditutup Selesai setelah kedua bukti ini ada.',
    approval_if_rejected = 'Bila pemilik produk memilih TIDAK membayar PITR: cadangan tetap mengandalkan backup-db.yml terjadwal (sudah aktif harian) sebagai satu-satunya jalur -- dicatat sebagai keputusan sadar, bukan celah yang terlewat. Bila pemilik produk ingin menangani setelan Vercel sendiri di waktu lain: task ini tetap menunggu sampai dikonfirmasi selesai.',
    approval_options = 'Untuk PITR: (A) tetap pakai backup-db.yml terjadwal saja (gratis, sudah aktif, retensi 30 hari) -- cukup untuk sekarang; (B) tambah PITR asli Supabase (butuh biaya, retensi bisa lebih panjang & granular per-detik). Rekomendasi Claude Code: (A) cukup untuk saat ini mengingat RBD-03/RBD-04 belum berjalan (organisasi baru belum ada) -- pertimbangkan (B) setelah organisasi & billing baru berdiri, supaya tidak mengatur biaya 2 kali (sekali di organisasi lama, sekali lagi setelah pindah).',
    detail_pekerjaan = detail_pekerjaan || E'\n\n--- HASIL EKSEKUSI 22 Agu 2026 ---\n1a-1d SELESAI: backup manual dijalankan (bukan lewat GitHub Actions -- Docker/pg_dump tidak tersedia di environment kerja ini, dan tidak ada token GitHub Actions write-access -- dialihkan ke ekspor data lengkap 92 tabel via Supabase JS client + salinan supabase/migrations/ sebagai sumber skema). Disimpan di /Users/home/Documents/TECHPROJECT/mrp-backups-tidak-di-git/ (DI LUAR repo git, TIDAK ikut ter-commit). Isi diverifikasi (employees=31 baris termasuk nama asli, sales_orders=1 baris nomor "043/6-ITM/2026", companies=8 baris termasuk PT ITM, lots=0 baris -- genuinely kosong, dikonfirmasi berkali-kali bukan kegagalan ekspor). Pemulihan DIUJI SUNGGUHAN ke project staging (nclkepwlsgmfbslgsajq): companies+production_plants+employees+customers+items+customer_purchase_orders+sales_orders+sales_order_lines direstorasi dengan ID dialihkan (+900000) supaya tidak bentrok data staging yang ada, dibuktikan data kembali IDENTIK (nama karyawan, nomor SO), lalu SELURUHNYA dibersihkan lagi (0 sisa dikonfirmasi).\n2a-2d: PITR asli Supabase pitr_enabled=false untuk KEDUA project -- penyebabnya kemungkinan besar paket (Free tier Supabase tidak menyertakan PITR), TAPI Claude Code TIDAK memastikan tier persis (sengaja tidak membuka token tersimpan CLI untuk cek billing) -- BERHENTI sesuai STOP CONDITION, menunggu pemilik produk konfirmasi paket & biaya. backup-db.yml DIPERBAIKI: ditambah trigger schedule (cron harian 18:00 UTC / 01:00 WIB), retensi artifact dinaikkan 7->30 hari, pemeriksaan isi (poin 1b) SUDAH ADA sejak awal di workflow ini, tidak diubah.\n3a-3d: Production Branch Vercel project mrp-staging TERBUKTI "main" (seharusnya "staging"). Percobaan perbaikan otomatis via Vercel Management API GAGAL DENGAN AMAN (2 percobaan, keduanya ditolak API dengan error validasi, DIKONFIRMASI tidak ada perubahan tersimpan) -- dihentikan sebelum mencoba menebak bentuk body yang lebih rumit (field git-link lengkap termasuk gitCredentialId/org/deployHooks) karena risiko salah bisa memutus koneksi Git project sepenuhnya. Perlu 1 klik manual pemilik produk di Vercel Dashboard. Peringatan sudah tercatat di detail INF-02 (lihat task itu).'
  where company_id = v_company_id and task_code = 'INF-05';

  -- Peringatan eksplisit di INF-02 (instruksi 3d, 22 Agu 2026) -- ditambahkan,
  -- bukan menggantikan detail yang sudah ada.
  update build_tasks set
    detail_pekerjaan = detail_pekerjaan || E'\n\nPERINGATAN (ditambahkan 22 Agu 2026, dari INF-05): Production Branch Vercel project mrp-staging saat ini "main" (harusnya "staging") -- KEBETULAN BAIK hari ini karena tampilan publik yang ter-deploy TERSAMBUNG KE SUPABASE KOSONG (staging), jadi belum ada kebocoran data nyata. Tapi kebetulan baik ini akan LANGSUNG BERUBAH JADI KEBOCORAN NYATA begitu sambungan project Vercel diarahkan ke project data nyata (persis yang direncanakan task INF-02 ini). Setelan Production Branch WAJIB SUDAH DIPERBAIKI (jadi "staging", bukan "main") SEBELUM task INF-02 mulai dikerjakan -- jangan lanjut ke INF-02 sebelum ini dikonfirmasi benar.'
  where company_id = v_company_id and task_code = 'INF-02';

end $$;
