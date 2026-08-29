-- Rekonsiliasi temuan SC-01..SC-05 (29 Agu 2026) -> Daftar Tugas Pembangunan.
--
-- Aturan yang dipatuhi: setiap dokumen temuan WAJIB langsung diikuti pencatatan task
-- di giliran kerja yang sama. Dokumennya:
--   docs/sales-crm/SALES_CRM_FINDING_RECONCILIATION.md
--   docs/sales-crm/SALES_CRM_NEXT_WORK_ORDERS.md
--
-- KENAPA SELURUHNYA DI DALAM SATU BLOK do $$ DAN BUKAN insert BIASA.
-- Versi pertama migrasi ini menulis `company_id` sebagai angka 1 langsung di klausa
-- values. Itu lolos di ketiga proyek yang sudah berisi perusahaan itu, dan akan GAGAL
-- KERAS saat basis data dibangun dari nol -- tabel companies masih kosong pada titik
-- migrasi ini jalan. Kesalahan yang sama pernah membuat CI merah sepuluh commit
-- berturut-turut, dan pengawasnya dibangun persis untuk menutup kelasnya:
-- tests/migration_hardcoded_tenant_id_watchdog.test.ts -- yang menangkap versi pertama
-- migrasi ini. Pola aman di bawah menyalin 20260903100000_ds25_validasi_field.sql.
--
-- Teks panjang ditulis lewat concat_ws(chr(10), ...) -- bukan rangkaian E'..' || E'..' --
-- karena kutip di dalam string pernah menutup pernyataan lebih awal dan merusak migrasi
-- dengan galat yang menunjuk baris terakhir berkas.

do $$
declare
  v_company_id integer;
  v_jumlah_company integer;
begin
  select company_id into v_company_id
  from build_tasks group by company_id order by count(*) desc limit 1;

  if v_company_id is null then
    select company_id into v_company_id from companies
    where name in ('PT ITM', 'PT Indo Taste Manufacture')
    order by company_id limit 1;
  end if;

  if v_company_id is null then
    select count(*) into v_jumlah_company from companies;
    if v_jumlah_company = 0 then
      raise notice 'Basis data masih kosong -- migrasi rekonsiliasi SC dilewati (no-op yang sah).';
      return;
    end if;
    raise exception 'Migrasi rekonsiliasi SC tidak menemukan perusahaan pemilik registri task, padahal companies berisi % baris. Migrasi DIHENTIKAN supaya tidak berhasil tanpa berlaku.', v_jumlah_company;
  end if;

  perform pastikan_kode_task_kosong('SEC-19');
  perform pastikan_kode_task_kosong('SEC-20');
  perform pastikan_kode_task_kosong('KRM-06');
  perform pastikan_kode_task_kosong('PJL-07');
  perform pastikan_kode_task_kosong('PJL-08');
  perform pastikan_kode_task_kosong('DS-26');

  -- 1) SELESAI di giliran ini ----------------------------------------------

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes, started_at, completed_at
  ) values (
    v_company_id, 'SEC-19', 'Penjaga baris Sales Order Line', 'SEC', 'Keamanan',
    concat_ws(chr(10),
      'sales_order_lines adalah SATU-SATUNYA dari sembilan tabel Penjualan yang RLS-nya',
      'menyala dengan NOL kebijakan. Ini gagal-tertutup (klien ber-RLS mendapat nol baris),',
      'bukan bocor -- aplikasi tetap jalan karena memakai service role yang melewati RLS.',
      'Yang hilang adalah LAPIS KEDUA yang dijanjikan Prinsip Arsitektur nomor 1.'),
    'Isolasi antar perusahaan untuk baris isi Sales Order hanya dijaga kode aplikasi, bukan basis data.',
    'penting', array['Keamanan'], 'Claude Code', 'selesai', '/sales-orders', 'temuan_claude',
    concat_ws(chr(10),
      'Kebijakan SELECT + tulis ditambahkan dengan MENYALIN pola tabel baris sebelahnya',
      'customer_po_lines_write_ppic: kepemilikan ditegakkan lewat induk sales_orders dengan',
      'EXISTS, peran diselaraskan dengan sales_orders_update_ppic. Nol peran mendapat akses baru.'),
    concat_ws(chr(10),
      'Migrasi 20260904100000, diterapkan ke tiga proyek (staging, CI, nyata).',
      'Bukti: tests/akses_baris_sales_order_lines.test.ts, 7 pemeriksaan lewat sesi login',
      'sungguhan -- bukan service role, yang akan lulus baik kebijakannya ada maupun tidak.',
      'Dua mutasi diuji dan KEDUANYA tertangkap: kebijakan dicabut -> 2 test gagal;',
      'kebijakan dipasang terlalu longgar dengan using true -> 5 test gagal.'),
    now(), now()
  );

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes, started_at, completed_at
  ) values (
    v_company_id, 'KRM-06', 'Pemilih alamat tersimpan di formulir pengiriman', 'KRM', 'Pengiriman',
    concat_ws(chr(10),
      'Server sudah menerima dan memvalidasi delivery_address_id sejak PMB-07b, tetapi',
      'halaman Pengiriman tidak pernah mengirimnya dan tidak pernah memuat daftarnya.',
      'Kemampuan server yang tidak punya pintu -- bukan kemampuan yang belum ada.'),
    'Petugas gudang mengetik ulang alamat yang sudah terdaftar, sumber salah ketik yang justru ingin dihindari daftar alamat itu.',
    'penting', array['Fungsi','UI/UX'], 'Claude Code', 'selesai', '/shipments', 'temuan_claude',
    concat_ws(chr(10),
      'Kontrol pilih ditambahkan di modal pembuatan pengiriman. Alamat yang dipilih mengisi',
      'kotak teks dan menguncinya baca-saja supaya yang tercetak tidak pernah berbeda dari',
      'yang terbaca. Alamat sekali pakai tetap bisa diketik. Alamat terarsip tidak ditawarkan.',
      'Keadaan memuat, kosong, dan gagal-muat dibedakan satu sama lain.'),
    concat_ws(chr(10),
      'NOL perubahan skema, NOL perubahan sumber kebenaran: yang tercetak tetap',
      'shipments.delivery_address teks beku, delivery_address_id tetap jejak referensi.',
      'Bukti: tests/wos05_pemilih_alamat_pengiriman.test.ts, 10 penjaga, 5 mutasi diuji dan',
      'semuanya tertangkap, plus bukti peramban di enam lebar wajib dengan tiga pemeriksaan tepi.'),
    now(), now()
  );

  -- 2) TEMUAN BARU yang BELUM dikerjakan ------------------------------------

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes
  ) values (
    v_company_id, 'PJL-07', 'Satu jalur kanonik pembuatan Sales Order', 'PJL', 'Penjualan',
    concat_ws(chr(10),
      'Pembuatan Sales Order punya DUA implementasi lengkap.',
      'Fungsi basis data process_customer_purchase_order: ATOMIK dalam satu transaksi,',
      'menegakkan wewenang lewat JWT, dan MENYALIN tiga kolom snapshot identitas -- tetapi',
      'NOL pemanggil di kode aplikasi, hanya dua berkas test.',
      'processCustomerPurchaseOrder.ts: dipakai route produksi, memakai kompensasi delete',
      'manual, dan TIDAK menyalin satu pun kolom snapshot identitas.'),
    concat_ws(chr(10),
      'Dua akibat. Pertama: bila insert baris gagal DAN delete kompensasinya juga gagal,',
      'tertinggal Sales Order tanpa baris yang nomornya sudah terpakai -- dan karena nomor',
      'dihitung dari jumlah baris tahun berjalan, ia menggeser penomoran seluruh SO berikutnya.',
      'Kedua: Sales Order yang dibuat lewat layar tidak membekukan identitas pelanggan, lalu',
      'ditandai layar sebagai terbit sebelum fitur snapshot ada -- padahal dibuat hari itu.'),
    'mendesak', array['Fungsi','Data'], 'Claude Code', 'menunggu', '/sales-orders', 'temuan_claude',
    concat_ws(chr(10),
      'MENUNGGU KEPUTUSAN AD-02: jalur mana yang kanonik. Rekomendasi berbukti: fungsi basis',
      'data, diperluas dengan idempotency_key, dan TypeScript menyusut jadi pemanggil RPC yang',
      'menerjemahkan raise exception jadi pesan Bahasa Indonesia. WAJIB disertai PENGAWAS yang',
      'gagal keras bila ada jalur kedua menulis sales_orders -- tanpa itu jalur kedua lahir lagi.',
      'Sudah diukur dan menurunkan risikonya: KEDUA jalur memakai gerbang wewenang yang sama',
      'persis, jadi berpindah tidak mengubah siapa boleh memproses PO Klien.',
      'Test wajib: satu test yang benar-benar MENGGAGALKAN insert baris dan membuktikan nol sisa.',
      'Test yang hanya memanggil jalur berhasil TIDAK diterima.'),
    concat_ws(chr(10),
      'Ditemukan saat memverifikasi ulang SC-04, 29 Agu 2026. NOL baris terdampak hari ini',
      'karena nol Sales Order di data nyata -- itulah jendela memperbaikinya sebelum baris',
      'pertama lahir. Menyerap SC-01b. Jangan menambal snapshot di jalur TypeScript saja:',
      'itu melanggengkan dua jalur, dan cacat berikutnya lahir dengan cara yang sama persis.')
  );

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes
  ) values (
    v_company_id, 'PJL-08', 'PO klien bisa ditahan, dilepas, dan dibatalkan', 'PJL', 'Penjualan',
    concat_ws(chr(10),
      'customer_purchase_orders punya status on_hold dan cancelled, dan status_transition_rules',
      'SUDAH memuat aturan perpindahannya. Tetapi di UI keduanya hanya LABEL dan warna Tag:',
      'sensus seluruh src dan app menemukan kata on_hold hanya di dua berkas -- halaman PO',
      'klien dan glossary. Nol endpoint, nol tombol, nol fungsi server yang menghasilkannya.'),
    'Pengguna melihat status yang sistem tidak pernah bisa capai -- kejadian KEENAM dari kelas status tanpa pemicu.',
    'penting', array['Fungsi','UI/UX'], 'Claude Code', 'menunggu', '/customer-purchase-orders', 'temuan_claude',
    concat_ws(chr(10),
      'MENUNGGU KEPUTUSAN BD-05 arti Ditunda sehari-hari, BD-06 siapa boleh menahan/melepas/',
      'membatalkan, BD-07 apakah alasan wajib.',
      'JANGAN membuat tombol sebelum ketiganya dijawab. Mesin statusnya sudah kanonik --',
      'yang dibangun hanya pemicu, wewenang, dan alasan.'),
    concat_ws(chr(10),
      'Sudah terjawab bukti, jadi TIDAK perlu ditanyakan lagi: PO yang ditahan TIDAK BISA',
      'diproses jadi Sales Order karena on_hold ke processed tidak ada di aturan; pembatalan',
      'bersifat FINAL karena cancelled tidak punya transisi keluar; riwayatnya terjaga di',
      'status_transition_log. Catatan: kolom reason di tabel itu ADA tetapi trigger selalu',
      'menulisnya null.')
  );

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes
  ) values (
    v_company_id, 'SEC-20', 'Sembilan tabel non-Penjualan dengan penjaga tanpa aturan', 'SEC', 'Keamanan',
    concat_ws(chr(10),
      'Disensus saat mengerjakan SEC-19: sembilan tabel LAIN punya pola yang sama --',
      'RLS menyala dengan nol kebijakan. Seluruhnya di luar domain Penjualan:',
      'ai_project_checklist_items, ai_project_phases, ai_project_progress_snapshots,',
      'ai_project_tasks, kpi_registry_history, production_batch_bom_line_snapshots,',
      'production_batch_routing_step_snapshots, production_batch_standard_crew_snapshots,',
      'status_transition_rules.'),
    'Sama seperti SEC-19: gagal-tertutup, bukan bocor -- tetapi lapis kedua tidak ada, dan ketiadaannya tidak berbunyi.',
    'bisa_menunggu', array['Keamanan'], 'Claude Code', 'menunggu', null, 'temuan_claude',
    concat_ws(chr(10),
      'Periksa satu per satu SEBELUM menyalin pola SEC-19: sebagian mungkin memang tidak layak',
      'diakses klien sama sekali, mis. status_transition_rules adalah master aturan dan bukan',
      'data tenant. Untuk yang begitu, jawaban yang benar adalah membiarkannya tertutup DENGAN',
      'ALASAN TERTULIS -- bukan menambahkan kebijakan supaya angkanya nol.'),
    concat_ws(chr(10),
      'Ditemukan saat mengerjakan SEC-19, 29 Agu 2026, mengikuti aturan: saat memperbaiki satu',
      'contoh dari sebuah kelas cacat, periksa tetangganya dan LAPORKAN temuannya.',
      'SENGAJA TIDAK dikerjakan bersamaan -- seluruhnya di luar domain task yang berjalan.')
  );

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes
  ) values (
    v_company_id, 'DS-26', 'Penolakan yang sama tampil di dua tempat berbeda', 'DS', 'Design System',
    concat_ws(chr(10),
      'Di formulir Pelanggan, nama kosong ditolak DUA KALI oleh dua pihak dengan tampilan',
      'yang berbeda. Validasi lokal di handleSave menampilkan pesan di DASAR MODAL;',
      'server menolak hal yang sama dengan pesan MENEMPEL DI KOLOMNYA.'),
    'Kesalahan yang sama terlihat seperti dua masalah berbeda tergantung siapa yang lebih dulu menolak.',
    'bisa_menunggu', array['UI/UX'], 'Claude Code', 'menunggu', '/customers', 'temuan_claude',
    concat_ws(chr(10),
      'Samakan: validasi lokal menandai KOLOMnya lewat jalur yang sama dengan galat server',
      'yaitu setPelangganFieldError, bukan lewat pesan tingkat formulir.',
      'Periksa juga formulir lain yang sudah memakai kontrak galat field -- pola yang sama',
      'kemungkinan ada di sana, dan itulah bentuk kelasnya.'),
    concat_ws(chr(10),
      'Ditemukan 29 Agu 2026 saat memverifikasi WS-B di peramban: probe pertama mengosongkan',
      'nama dan melaporkan galat tidak menempel di kolom. Probe itu SALAH -- formulir berhenti',
      'lokal tanpa pernah bertanya ke server. Diulang dengan nama terisi: galat server MEMANG',
      'menempel di kolomnya. Yang tersisa adalah ketidakseragaman antara kedua penolak itu.')
  );

  -- 3) PJL-03 diperbarui: temuannya BERUBAH, bukan bertambah ----------------

  update build_tasks
  set notes = concat_ws(chr(10),
    'DIPERIKSA ULANG 29 Agu 2026 dan temuannya BERUBAH secara material.',
    'Mesin statusnya TIDAK kosong: status_transition_rules SUDAH memuat aturan kanonik untuk',
    'sales_orders, ditegakkan trigger enforce_status_transition dan dicatat ke',
    'status_transition_log. Yang nihil adalah KODE YANG MENJALANKANNYA: nol .update pada',
    'sales_orders di seluruh src. Terukur: status_transition_log berisi NOL baris untuk',
    'SELURUH tabel -- belum pernah ada satu perpindahan status pun di sistem ini.',
    '',
    'KETEGANGAN YANG WAJIB DIPUTUSKAN LEBIH DULU (AD-01): aturan basis data memperlakukan',
    'in_production dan completed sebagai status TERSIMPAN milik baris Sales Order, sedangkan',
    'DEC-S11 memberikan kepemilikan keduanya kepada Manufacturing dan Logistics.',
    'Opsi A: status tersimpan, ditulis domain pemilik. Opsi B: status komersial saja, eksekusi',
    'diturunkan -- dan bila B dipilih, DUA baris status_transition_rules WAJIB dicabut supaya',
    'tidak jadi aturan hantu.',
    '',
    'Visibilitas eksekusi TURUNAN sudah dibangun dan SENGAJA netral terhadap pilihan itu:',
    'src/features/mrp/server/eksekusiSalesOrder.ts, ditampilkan sebagai Tag terpisah di panel',
    'detail Sales Order. Nol perubahan skema, nol penulisan status, nol pencabutan aturan.',
    '',
    'Keputusan bisnis yang juga wajib dijawab: BD-01 kapan order SELESAI, BD-02 siapa boleh',
    'membatalkan, BD-03 boleh batal setelah Work Order dibuat atau produksi mulai, BD-04 apa',
    'yang terjadi bila satu departemen menolak.',
    '',
    'Rincian lengkap: docs/sales-crm/SALES_CRM_FINDING_RECONCILIATION.md bagian SC-01 dan',
    'docs/sales-crm/SALES_CRM_NEXT_WORK_ORDERS.md bagian WO-S01.')
  where task_code = 'PJL-03' and company_id = v_company_id;
end $$;
