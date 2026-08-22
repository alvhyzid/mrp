-- Task "Warna Status pada Daftar Tugas Pembangunan" dicatat DAN langsung
-- ditutup sekaligus (diminta "kerjakan sekarang") -- diimplementasikan
-- bersamaan dengan perbaikan bug DD (label status vs urgensi tertukar)
-- karena keduanya menyentuh komponen render yang persis sama.
insert into public.build_tasks
  (company_id, task_code, name, module_code, module_name, description, effect_description, urgency, tags, pic, status, link_url, origin, detail_pekerjaan, completed_at)
values (
  1, 'AUD-09', 'Warna Status pada Daftar Tugas Pembangunan', 'AUD', 'Audit Kualitas',
  'Status tiap task di Daftar Tugas Pembangunan sekarang terbaca sekilas lewat warna badge, tanpa harus membaca teks satu per satu.',
  'Daftar 400+ task sulit dipindai cepat kalau semua kartu berwarna sama.',
  'penting', array['Visual'], 'Claude Code', 'selesai', '/build-tasks', 'pemilik_produk',
  'Selesai bersamaan dengan perbaikan bug DD (label status/urgensi tertukar) di BuildTasksPage.tsx -- status jadi badge warna solid (hijau/biru/kuning/abu-abu/abu-abu dicoret), urgensi jadi garis tepi kiri kartu (merah SUPER URGENT, oranye Mendesak) + badge outline kecil terpisah dari status, modul dengan seluruh task selesai dapat badge hijau "Semua Selesai" (pelengkap penanda SUPER URGENT merah yang sudah ada), teks status tetap selalu terbaca (bukan warna-saja), satu sumber warna terpusat (STATUS_BADGE/URGENCY_BORDER/STATUS_EXTRA_CLASS). Diverifikasi visual di company.b@debug.mrp dengan fixture 5 kombinasi status x urgensi, fixture dibersihkan total.',
  now()
);
