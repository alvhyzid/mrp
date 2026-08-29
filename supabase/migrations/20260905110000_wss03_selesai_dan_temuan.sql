-- WS-S03 selesai + temuan gelombang kedua -> Daftar Tugas Pembangunan (29 Agu 2026).
--
-- Dokumen sumber:
--   docs/sales-crm/SALES_CRM_DECISION_AUDIT_ARCHITECTURE.md
--   docs/sales-crm/SALES_CRM_NEXT_WORK_ORDERS.md (gelombang kedua)
--
-- Pola aman company_id (cari dulu, no-op bila basis data kosong) menyalin
-- 20260903100000_ds25_validasi_field.sql. Teks panjang lewat concat_ws(chr(10), ...).

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
      raise notice 'Basis data masih kosong -- migrasi WS-S03 dilewati (no-op yang sah).';
      return;
    end if;
    raise exception 'Migrasi WS-S03 tidak menemukan perusahaan pemilik registri task, padahal companies berisi % baris.', v_jumlah_company;
  end if;

  perform pastikan_kode_task_kosong('AUD-49');
  perform pastikan_kode_task_kosong('PJL-09');

  -- PJL-07 SELESAI: dua jalur pembuatan Sales Order jadi satu.
  update build_tasks
  set status = 'selesai',
      started_at = coalesce(started_at, now()),
      completed_at = now(),
      notes = concat_ws(chr(10),
        'SELESAI 29 Agu 2026 sebagai WS-S03.',
        '',
        'Fungsi kanonik process_customer_purchase_order() diperluas dengan idempotensi,',
        'sehingga ia kini punya SELURUH kemampuan yang tadinya hanya dimiliki jalur',
        'TypeScript. processCustomerPurchaseOrder.ts TIDAK LAGI MENULIS APA PUN -- ia',
        'memanggil fungsi itu lewat klien ber-sesi pengguna dan menerjemahkan pesan galat',
        'jadi kode status HTTP.',
        '',
        'KEPUTUSAN TEKNIS yang perlu diketahui sesi berikutnya: kunci idempotensi',
        'DITURUNKAN di dalam fungsi, BUKAN jadi parameter baru. Grant di Postgres melekat',
        'pada TANDA TANGAN fungsi, dan proyek ini sudah pernah mengalami regresi grant',
        'akibat menambah parameter ke RPC. Diukur sesudah migrasi: tanda tangan tetap',
        '(integer, integer) dan grant IDENTIK di ketiga proyek.',
        '',
        'Urutan pemeriksaan berubah dengan sengaja: pengenalan pengulangan diletakkan',
        'SEBELUM gerbang status harus new, karena pada percobaan kedua PO-nya sudah',
        'processed dan urutan lama akan menolak pengulangan yang sah.',
        '',
        'BUKTI: tests/jalur_kanonik_sales_order.test.ts, 11 pemeriksaan. Empat mutasi',
        'diuji dan KEEMPATNYA menggigit SETELAH satu pengetatan. Mutasi kedua (mencabut',
        'pengenalan pengulangan dari fungsi DB) awalnya membuat NOL test gagal, karena',
        'lapisan aplikasi punya pemeriksaan kosmetik yang menjawab lebih dulu dan tidak',
        'pernah memanggil fungsinya. Ditambahkan test (e2) yang memanggil fungsi kanonik',
        'LANGSUNG, melewati lapisan itu.',
        '',
        'BATAS YANG DISEBUT TERANG-TERANGAN: kegagalan di tahap INSERT BARIS tidak bisa',
        'dipaksa dari permukaan yang bisa dicapai test -- sales_order_lines dan',
        'customer_purchase_order_lines punya kekangan IDENTIK. Yang diuji sebagai gantinya',
        'adalah keatomikan SATUAN KERJANYA lewat tabrakan nomor SO, dengan tiga bukti',
        'terpisah: nol SO, nol baris, dan PO klien TIDAK berpindah status.',
        '',
        'Ini juga menutup SC-01b: snapshot identitas pelanggan kini tersalin.')
  where task_code = 'PJL-07' and company_id = v_company_id;

  -- PJL-08: aturan bisnisnya sudah TERTUTUP, plus satu temuan yang wajib dibaca.
  update build_tasks
  set notes = concat_ws(chr(10),
        'ATURAN BISNISNYA SUDAH TERTUTUP 29 Agu 2026 lewat BD-06.',
        '',
        'HOLD: departemen yang menemukan penghalang boleh menahan. Sales (informasi',
        'pelanggan, spesifikasi, komersial), Finance (kondisi pembayaran), PPIC (kapasitas,',
        'jadwal, kelayakan). PO tetap AKTIF tetapi tidak bisa lanjut ke proses berikutnya.',
        'RELEASE: pemilik yang berwenang melepas setelah penghalangnya selesai. Bila',
        'penghalang datang dari Finance, Finance yang melepas.',
        'CANCEL: Sales boleh MENGUSULKAN; wewenang akhir Manager/GM.',
        '',
        'TEMUAN YANG WAJIB DIBACA SEBELUM MEMBANGUN, sudah terukur: BD-06 menyatakan',
        'Sales tidak boleh sembarang melepas penghalang departemen lain -- sedangkan',
        'status_transition_rules hari ini hanya mengenal bentuk on_hold -> new, TANPA',
        'konsep departemen mana yang menahan. Jadi departemen penahan harus TERSIMPAN dan',
        'DIBACA KEMBALI saat pelepasan. Aturan itu TIDAK tertegakkan sendiri oleh mesin',
        'status yang ada.',
        '',
        'KENDALA TEKNIS: karena trigger tidak menerima parameter dan PostgREST tidak',
        'mengizinkan dua pernyataan dalam satu transaksi, tombol Tahan/Lepas/Batalkan',
        'WAJIB lewat fungsi basis data -- bukan lewat update dari kode aplikasi.',
        '',
        'Task ini melahirkan penulis pertama untuk kolom-kolom AUD-49; keduanya dikerjakan',
        'bersamaan, tidak terpisah.')
  where task_code = 'PJL-08' and company_id = v_company_id;

  -- PJL-03: dua dari empat keputusan bisnisnya sudah tertutup.
  update build_tasks
  set notes = concat_ws(chr(10),
        'DIPERBARUI 29 Agu 2026. Dua keputusan bisnis SUDAH TERTUTUP, dua masih terbuka.',
        '',
        'TERTUTUP -- BD-02 (wewenang membatalkan): sebelum konfirmasi, Sales boleh',
        'membatalkan sesuai wewenangnya, dengan alasan + pelaku + waktu + riwayat terjaga,',
        'dan Sales Order TIDAK dihapus. Setelah konfirmasi: Sales mengajukan permintaan',
        'pembatalan, ditinjau, lalu disetujui Manager/GM.',
        '',
        'TERTUTUP -- BD-03 (setelah Work Order / setelah produksi): pembatalan tetap',
        'dimungkinkan, dengan tingkat kendali yang meningkat mengikuti tahap eksekusi.',
        'Setelah WO dibuat: tinjauan dampak. Setelah produksi mulai: tinjauan dampak +',
        'departemen terdampak. Produksi dan pengiriman yang sudah terjadi tetap historis;',
        'pembatalan hanya berlaku pada komitmen yang BELUM dieksekusi.',
        '',
        'MASIH TERBUKA -- BD-01: sebuah order dianggap SELESAI kapan. Terkirim,',
        'ditandatangani terima, atau lunas? Jangan ditebak.',
        '',
        'MASIH TERBUKA -- AD-01: apakah in_production dan completed status TERSIMPAN',
        'seperti status_transition_rules memperlakukannya, atau DITURUNKAN seperti DEC-S11',
        'menempatkannya. Pembatalan TIDAK bergantung pada jawaban itu, jadi bagian',
        'pembatalan boleh dibangun lebih dulu.',
        '',
        'LARANGAN KERAS saat membangun pembatalan: TIDAK BOLEH menghapus Sales Order,',
        'Work Order, riwayat produksi, pemakaian bahan, riwayat persediaan, ketertelusuran',
        'lot, maupun riwayat pengiriman.')
  where task_code = 'PJL-03' and company_id = v_company_id;

  -- BARU: perluasan jejak keputusan.
  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes
  ) values (
    v_company_id, 'AUD-49', 'Jejak keputusan: siapa, kenapa, dari apa ke apa', 'AUD', 'Audit',
    concat_ws(chr(10),
      'BD-07 menuntut setiap keputusan berdampak bisa menjawab siapa, apa, kapan, kenapa,',
      'dari keadaan apa, ke keadaan apa. Hari ini FABRIX tidak bisa menjawab SIAPA.',
      '',
      'Terukur di data nyata: dari 598 baris data_change_audit_log, kolom changed_by_role',
      'berisi PERAN DATABASE (authenticator 561, postgres 31, cli_login_postgres 6) --',
      'bukan peran FABRIX -- dan hanya 4 dari 598 baris punya auth_uid, karena hampir',
      'seluruh jalur aplikasi memakai service role.',
      '',
      'Dan status_transition_log punya kolom reason yang SELALU null: triggernya menulis',
      'null sebagai literal. Tempat untuk alasan sudah disediakan, lalu tidak pernah diisi.'),
    'Keputusan yang berdampak tidak bisa dipertanggungjawabkan: sistem tahu apa yang berubah, tidak tahu siapa yang memutuskan dan kenapa.',
    'penting', array['Audit','Data'], 'Claude Code', 'menunggu', null, 'temuan_claude',
    concat_ws(chr(10),
      'PERLUAS status_transition_log dengan LIMA kolom: actor_name_snapshot,',
      'actor_role_snapshot, actor_department_snapshot, reason_category,',
      'approval_reference_id. Kolom reason yang sudah ada dipakai sebagai catatan tambahan.',
      '',
      'JANGAN membuat entitas keputusan baru. JANGAN membuat sales_decision_log,',
      'sales_approval_log, atau sales_activity_log. Cetakan snapshot pelaku SUDAH ADA di',
      'company_settings_history (changed_by, changed_by_name, changed_by_role) -- yang',
      'dilakukan adalah meluaskan cetakan yang sudah terbukti, ditambah department.',
      '',
      'KENDALA URUTAN YANG MENGIKAT: kelima kolom itu TIDAK BOLEH lahir sendirian. Kolom',
      'audit yang selalu null adalah bentuk yang sama persis dengan status tanpa pemicu,',
      'dan kolom reason SUDAH membuktikannya. Kolomnya lahir BERSAMA penulis pertamanya,',
      'yaitu PJL-08.'),
    concat_ws(chr(10),
      'Rancangan lengkap: docs/sales-crm/SALES_CRM_DECISION_AUDIT_ARCHITECTURE.md.',
      'Berkas itu juga memuat usulan ADR FABRIX-wide (§14 perintah): setiap keputusan',
      'bisnis berdampak wajib bisa dipertanggungjawabkan. Usulan itu SENGAJA TIDAK',
      'diterapkan ke Finance, PPIC, Manufacturing, Quality, Procurement, dan Logistics --',
      'tiap domain wajib diperiksa dulu satu per satu, karena keputusan yang TIDAK',
      'mengubah status (mis. penetapan golongan biaya karyawan) tidak tertangkap trigger',
      'ini dan butuh jalurnya sendiri.')
  );

  -- BARU: nasib kolom alamat lama.
  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes
  ) values (
    v_company_id, 'PJL-09', 'Kolom alamat pengiriman lama yang tidak dipakai apa pun', 'PJL', 'Penjualan',
    concat_ws(chr(10),
      'customers.shipping_address bisa diisi lewat formulir Pelanggan dan TIDAK PERNAH',
      'dibaca oleh apa pun yang membuat pengiriman.',
      '',
      'Sensus seluruh src, app, tests, dan scripts menemukan LIMA titik sentuh, seluruhnya',
      'di dalam lingkaran CRUD pelanggan: listCustomers memuatnya ke daftar,',
      'customerValidation mengurainya dari formulir, dan CustomersPage menyimpannya di',
      'keadaan formulir plus satu kotak isian. NOL pembaca di pembuatan pengiriman,',
      'layanan pengiriman, surat jalan, POD, Sales Order, maupun API lain.',
      'Nol baris berisi nilai di data nyata.'),
    'Orang bisa mengetik alamat di sana dan alamat itu tidak akan pernah dipakai apa pun, tanpa satu pun tanda di layar.',
    'bisa_menunggu', array['Data','UI/UX'], 'Claude Code', 'menunggu', '/customers', 'temuan_claude',
    concat_ws(chr(10),
      'MENUNGGU KEPUTUSAN Architecture Guardian (BL-04). Rekomendasi bertahap:',
      'sembunyikan isiannya dulu -- reversibel, nol risiko data -- dan cabut kolomnya',
      'HANYA setelah pemilih alamat tersimpan (KRM-06) terbukti dipakai.',
      '',
      'DILARANG di batch mana pun sebelum keputusan itu: drop, migrate, rename, remove,',
      'rewrite.'),
    concat_ws(chr(10),
      'Ini golongan C menurut CLAUDE.md, dengan pembeda penting dari Nomor BPOM dan Kode',
      'Halal: keduanya juga nol perhitungan TETAPI berguna sebagai catatan kepatuhan,',
      'sedangkan kotak ini MENYARU sebagai field operasional dan mengundang orang',
      'mengisinya untuk tujuan yang tidak akan tercapai.',
      '',
      'Analisis sumber kebenaran pengiriman SUDAH TUNTAS dan tidak perlu diulang:',
      'shipments.delivery_address (teks beku) adalah sumber kebenaran,',
      'shipments.delivery_address_id jejak referensi, customer_delivery_addresses daftar',
      'master. Rincian di docs/sales-crm/SALES_CRM_NEXT_WORK_ORDERS.md bagian WS-S07.')
  );
end $$;
