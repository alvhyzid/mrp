-- Halaman Daftar Tugas Pembangunan -- task baru untuk inisiatif rebrand ke
-- FABRIX + persiapan infrastruktur (transfer kepemilikan repo/Vercel/Supabase
-- dari akun pribadi ke organisasi baru). Spesifikasi disampaikan pemilik
-- produk 22 Agu 2026, sebagian merujuk rencana R0-R5 yang sebelumnya HANYA
-- disebut sekilas di HANDOFF.md ("Sesi 1-4: rebrand inventaris, dst", baris
-- 382) tanpa pernah tercatat sebagai baris build_tasks -- migrasi ini adalah
-- PERTAMA KALI task-task ini tercatat di tracker, bukan pembaruan atas baris
-- yang sudah ada (dikonfirmasi lewat query: 0 baris RBD-*/INF-* sebelum ini).
--
-- INF-01 sengaja dibuat MINIMAL (isi belum dijelaskan pemilik produk selain
-- perannya sebagai gerbang) -- ditandai catatan "PERLU KONFIRMASI" alih-alih
-- dikarang, sesuai G.1 (jangan pernah mengarang isi task tanpa jejak).
do $$
declare
  v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then
    raise notice 'Perusahaan PT ITM tidak ditemukan -- migrasi build_tasks rebrand/infra dilewati (no-op).';
    return;
  end if;

  -- RBD-01 (R0) -- Inventaris Rebrand
  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes
  ) values (
    v_company_id, 'RBD-01', 'R0 -- Inventaris Rebrand (audit seluruh kemunculan nama/identitas lama)',
    'RBD', 'Rebrand FABRIX',
    'Menyisir seluruh kode, dokumen, dan tampilan untuk mendata SETIAP tempat nama/identitas brand lama muncul (nama aplikasi, judul tab, PWA manifest, template email, dokumen cetak/surat jalan, dll) -- daftar lengkap ini jadi dasar R1 (RBD-02) supaya tidak ada yang terlewat.',
    'Tanpa inventaris ini, penggantian nama (R1) berisiko meninggalkan sisa nama lama di tempat yang tidak diperiksa (mis. metadata PWA, footer email, header dokumen cetak) -- baru ketahuan belakangan setelah beredar ke pihak luar.',
    'penting', ARRAY['Data','Dokumentasi']::text[], 'Claude Code', 'menunggu', null, 'pemilik_produk',
    'Baca-saja (read-only), TIDAK menyentuh infrastruktur -- aman dikerjakan paralel dengan pekerjaan lain. Boleh dimulai SEGERA SETELAH INF-01 selesai (urutan ditetapkan pemilik produk 22 Agu 2026). Cakupan: cari string nama brand lama di seluruh src/, app/, docs/, template email, PWA manifest, dan dokumen cetak (surat jalan/invoice/dsb) -- hasilkan daftar lokasi+jenis kemunculan sebagai input langsung untuk RBD-02a.',
    'Urgensi "Penting" adalah DEFAULT SEMENTARA dari Claude Code (belum ditentukan eksplisit pemilik produk saat task ini dibuat) -- mohon dikoreksi kalau tidak sesuai.'
  )
  on conflict (company_id, task_code) do nothing;

  -- RBD-02a (R1a) -- Penggantian Teks & Identitas
  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes
  ) values (
    v_company_id, 'RBD-02a', 'R1a -- Penggantian Teks & Identitas ke FABRIX',
    'RBD', 'Rebrand FABRIX',
    'Mengganti nama aplikasi, judul tab browser, PWA manifest, template email, dan dokumen cetak dari identitas lama ke FABRIX -- berdasarkan daftar lokasi dari RBD-01.',
    'Tanpa ini, identitas yang tercetak/terkirim ke pihak luar (email, dokumen, tab browser) masih memakai nama lama meski rebrand sudah diumumkan.',
    'penting', ARRAY['Teks/Bahasa']::text[], 'Claude Code', 'menunggu', null, 'pemilik_produk',
    'PECAH dari task R1 asal (dipecah 22 Agu 2026 atas instruksi pemilik produk) -- bagian ini KHUSUS penggantian teks/identitas, TIDAK bergantung cetakan UX (beda dari RBD-02b). Boleh dikerjakan setelah RBD-01 (perlu daftar lokasi lengkap dulu). Cakupan: nama aplikasi di UI, <title>/metadata, manifest.json PWA, template email (undangan/notifikasi), header/footer dokumen cetak (surat jalan, dll). TIDAK termasuk restrukturisasi navigasi -- itu RBD-02b.',
    'Urgensi "Penting" adalah DEFAULT SEMENTARA dari Claude Code -- belum ditentukan eksplisit pemilik produk, mohon dikoreksi kalau tidak sesuai.'
  )
  on conflict (company_id, task_code) do nothing;

  -- RBD-02b (R1b) -- Pengelompokan Navigasi per Lini FABRIX
  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes
  ) values (
    v_company_id, 'RBD-02b', 'R1b -- Pengelompokan Navigasi per Lini FABRIX',
    'RBD', 'Rebrand FABRIX',
    'Menata ulang struktur menu navigasi (sidebar) supaya dikelompokkan per lini bisnis FABRIX, bukan cuma per modul teknis seperti sekarang.',
    'Tanpa ini, navigasi tetap terasa seperti sistem MRP generik walau nama brand sudah berganti -- lini bisnis FABRIX tidak tercermin di struktur menu.',
    'bisa_menunggu', ARRAY['Visual']::text[], 'Claude Code', 'menunggu', null, 'pemilik_produk',
    'PECAH dari task R1 asal (dipecah 22 Agu 2026) -- bagian ini KHUSUS restrukturisasi navigasi, MENUNGGU cetakan UX (pola tata letak/navigasi yang sudah disepakati) dari koreksi pemilik produk di Alur 1 (Supplier & Pelanggan) -- JANGAN dikerjakan sebelum cetakan UX itu final, supaya tidak dikerjakan dua kali dengan pola berbeda.',
    'Urgensi "Bisa Menunggu" masuk akal karena task ini secara eksplisit MENUNGGU prasyarat lain (cetakan UX) -- bukan keputusan final pemilik produk, boleh dikoreksi.'
  )
  on conflict (company_id, task_code) do nothing;

  -- RBD-03 (R2) -- Pembuatan Akun/Organisasi Baru -- SUPER URGENT ditetapkan
  -- LANGSUNG oleh pemilik produk (bukan Claude Code), sesuai D.1.
  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes, super_urgent_since
  ) values (
    v_company_id, 'RBD-03', 'R2 -- Pembuatan Vercel Team, GitHub Organization, Supabase Organization Baru',
    'RBD', 'Rebrand FABRIX',
    'Membuat 3 organisasi/tim BARU (Vercel Team, GitHub Organization, Supabase Organization) sebagai wadah tujuan transfer kepemilikan infrastruktur (RBD-04) -- ketiganya BELUM ADA sama sekali.',
    'Tanpa ini, RBD-04 (transfer kepemilikan) tidak bisa dimulai sama sekali -- ini prasyarat mutlak, belum ada satu pun dari 3 organisasi ini yang dibuat.',
    'super_urgent', ARRAY['Integrasi','Keamanan']::text[], 'Pemilik Produk', 'menunggu', null, 'pemilik_produk',
    'PENTING -- KESALAHPAHAMAN YANG HARUS DIHINDARI: mengganti email utama akun Vercel BUKAN transfer kepemilikan -- akun tetap milik pribadi. Yang benar-benar dibutuhkan adalah membuat Vercel Team, GitHub Organization, dan Supabase Organization yang BARU (3 entitas terpisah, bukan mengubah akun personal yang ada). SYARAT KESELAMATAN WAJIB: akun pribadi pemilik produk HARUS tetap menjadi owner di setiap organisasi baru ini, supaya tidak ada risiko kehilangan akses sendiri di tengah proses transfer (RBD-04). Task ini prasyarat mutlak RBD-04 dan belum dimulai sama sekali per 22 Agu 2026.',
    null, now()
  )
  on conflict (company_id, task_code) do nothing;

  -- RBD-04 (R3) -- Transfer Kepemilikan -- gerbang "setelah 12 September"
  -- DICABUT 22 Agu 2026 (PO SAS001/SAS005 sudah tidak jadi pertimbangan).
  -- Dibuat LANGSUNG di status akhir (menunggu/mendesak), riwayat perubahan
  -- urgensi dicatat terpisah di bawah (bukan menimpa alasan, sesuai instruksi).
  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes
  ) values (
    v_company_id, 'RBD-04', 'R3 -- Transfer Kepemilikan Infrastruktur ke Organisasi Baru',
    'RBD', 'Rebrand FABRIX',
    'Memindahkan kepemilikan 1 repo GitHub, 1 project Vercel, dan 2 project Supabase dari akun pribadi ke Vercel Team/GitHub Organization/Supabase Organization baru (RBD-03).',
    'Tanpa ini, seluruh infrastruktur produksi tetap terikat ke 1 akun pribadi -- risiko bisnis kalau akses personal itu hilang, berpindah, atau perlu dibagi ke tim.',
    'mendesak', ARRAY['Integrasi']::text[], 'Pemilik Produk', 'menunggu', null, 'pemilik_produk',
    'GERBANG "setelah 12 September" (menunggu PO SAS001 & SAS005 terkirim) DICABUT 22 Agu 2026 -- pemilik produk menyatakan kedua PO itu sudah tidak menjadi pertimbangan apa pun untuk task ini. PRASYARAT: HARUS menunggu RBD-03 selesai (organisasi tujuan transfer belum ada). URUTAN KERJA vs INF-02: task ini (RBD-04) WAJIB dikerjakan SEBELUM INF-02 (perapian environment) -- alasan: saat ini hanya 1 repo + 1 project Vercel + 2 project Supabase yang perlu dipindah; kalau environment dirapikan lebih dulu, jumlah project Supabase bertambah jadi 3, menambah 1 transfer tambahan yang bisa meleset. PENGINGAT EKSEKUSI: domain fabrix.id SUDAH AKTIF dan bisa dipakai, TAPI JANGAN disambungkan ke project mana pun sebelum INF-01 selesai DAN arsitektur environment disetujui pemilik produk.',
    null
  )
  on conflict (company_id, task_code) do nothing;

  insert into build_task_urgency_history (build_task_id, old_urgency, new_urgency, requested_by)
  select build_task_id, 'ditunda_sadar', 'mendesak',
    'Pemilik Produk (22 Agu 2026) -- gerbang "setelah 12 September" dicabut karena PO SAS001 & SAS005 sudah tidak jadi pertimbangan apa pun'
  from build_tasks where company_id = v_company_id and task_code = 'RBD-04'
  on conflict do nothing;

  -- RBD-07 -- Cek Merek FABRIX di PDKI
  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes
  ) values (
    v_company_id, 'RBD-07', 'Cek Merek FABRIX di PDKI',
    'RBD', 'Rebrand FABRIX',
    'Memeriksa status merek "FABRIX" di PDKI (Pangkalan Data Kekayaan Intelektual) untuk kelas software/aplikasi, sebelum nama ini dipakai lebih luas.',
    'Domain fabrix.id sudah dibeli, TAPI domain terbeli tidak berarti merek aman -- konflik merek di kelas software harus diketahui SEBELUM nama tercetak di surat jalan, email, dan QR yang beredar ke pihak luar (kalau ada konflik, jauh lebih murah diketahui sekarang daripada setelah nama beredar).',
    'mendesak', ARRAY['Dokumentasi']::text[], 'Pemilik Produk', 'menunggu', null, 'pemilik_produk',
    'Cek pendaftaran merek "FABRIX" (dan variasi dekat) di PDKI khusus kelas yang relevan untuk software/aplikasi/SaaS. Lakukan SEBELUM nama FABRIX dicetak lebih luas di dokumen eksternal (surat jalan, email, QR code) -- kalau ditemukan konflik, keputusan lanjutan (ganti nama/negosiasi/dsb) adalah keputusan bisnis pemilik produk, bukan sesuatu yang diputuskan Claude Code.',
    null
  )
  on conflict (company_id, task_code) do nothing;

  -- INF-01 -- SENGAJA MINIMAL: isi belum dijelaskan pemilik produk selain
  -- perannya sebagai gerbang sebelum RBD-01 dan sebelum domain disambungkan.
  -- JANGAN dianggap lengkap -- lihat catatan di kolom notes.
  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes
  ) values (
    v_company_id, 'INF-01', 'Persiapan & Persetujuan Arsitektur Environment (prasyarat rebrand)',
    'INF', 'Infrastruktur & Environment',
    'PERLU KONFIRMASI PEMILIK PRODUK -- isi lengkap task ini belum dijelaskan. Yang sudah diketahui: task ini adalah gerbang yang harus SELESAI sebelum RBD-01 (Inventaris) boleh dimulai, dan sebelum domain fabrix.id boleh disambungkan ke project mana pun.',
    'Belum diketahui -- menunggu penjelasan lengkap.',
    'penting', ARRAY['Integrasi']::text[], 'Pemilik Produk', 'menunggu', null, 'pemilik_produk',
    'CATATAN JUJUR: task ini dibuat 22 Agu 2026 HANYA berdasarkan perannya sebagai gerbang (disebutkan di instruksi RBD-01 dan RBD-04) -- BUKAN dari penjelasan lengkap soal apa saja yang termasuk "arsitektur environment" di sini. Claude Code SENGAJA TIDAK MENGARANG isi lengkapnya (sesuai aturan "jangan pernah mengarang task tanpa jejak"). Sebelum task ini dikerjakan, WAJIB diminta penjelasan lengkap dari pemilik produk/arsitek: apa saja cakupan "arsitektur environment" yang perlu disetujui, dan apa syarat "selesai" untuk task ini.',
    'PERLU KONFIRMASI -- lihat detail_pekerjaan. Jangan kerjakan sebelum isi lengkapnya dikonfirmasi.'
  )
  on conflict (company_id, task_code) do nothing;

  -- INF-02 -- Perapian Environment -- hanya urutan kerja yang diberikan
  -- eksplisit (setelah RBD-04); isi lengkap juga belum sepenuhnya dijelaskan,
  -- ditandai sama seperti INF-01.
  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes
  ) values (
    v_company_id, 'INF-02', 'Perapian Environment (Dev/Staging/Production)',
    'INF', 'Infrastruktur & Environment',
    'Merapikan struktur environment Vercel/Supabase (dev/staging/production) setelah kepemilikan infrastruktur berpindah ke organisasi baru.',
    'Tanpa perapian ini, environment tetap dalam struktur sementara/tambal-sulam pasca-transfer kepemilikan.',
    'penting', ARRAY['Integrasi']::text[], 'Pemilik Produk', 'menunggu', null, 'pemilik_produk',
    'URUTAN KERJA WAJIB: task ini (INF-02) dikerjakan SETELAH RBD-04 (transfer kepemilikan) selesai, BUKAN sebelumnya -- ditetapkan eksplisit pemilik produk 22 Agu 2026. Alasan: saat ini yang perlu dipindahkan hanya 1 repo, 1 project Vercel, 2 project Supabase; kalau environment dirapikan LEBIH DULU, jumlahnya bertambah jadi 3 project Supabase -- setiap project tambahan adalah 1 transfer tambahan yang bisa meleset. CATATAN JUJUR: isi lengkap "perapian" apa saja yang dimaksud belum sepenuhnya dijelaskan pemilik produk selain urutan kerja ini -- perlu dikonfirmasi lebih lanjut sebelum dikerjakan.',
    'PERLU KONFIRMASI cakupan lengkap "perapian environment" -- baru urutan kerjanya yang pasti.'
  )
  on conflict (company_id, task_code) do nothing;

end $$;
