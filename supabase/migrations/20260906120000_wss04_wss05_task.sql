-- WS-S04 + WS-S05 selesai, dan temuan barunya -> Daftar Tugas Pembangunan (29 Agu 2026).
--
-- Dokumen sumber:
--   docs/sales-crm/SALES_CRM_AUDIT_TRAIL_RECONCILIATION.md
--   docs/sales-crm/SALES_CRM_LIFECYCLE_RECONCILIATION.md

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
      raise notice 'Basis data masih kosong -- migrasi WS-S04/WS-S05 dilewati (no-op yang sah).';
      return;
    end if;
    raise exception 'Migrasi WS-S04/WS-S05 tidak menemukan perusahaan pemilik registri task, padahal companies berisi % baris.', v_jumlah_company;
  end if;

  perform pastikan_kode_task_kosong('PJL-10');
  perform pastikan_kode_task_kosong('AUD-50');

  -- AUD-49 SELESAI: jejak keputusan punya pelaku dan alasan.
  update build_tasks
  set status = 'selesai',
      started_at = coalesce(started_at, now()),
      completed_at = now(),
      notes = concat_ws(chr(10),
        'SELESAI 29 Agu 2026 sebagai WS-S04, BERSAMA penulis pertamanya (PJL-08/WS-S05).',
        '',
        'status_transition_log DIPERLUAS lima kolom: actor_name_snapshot, actor_role_snapshot,',
        'actor_department_snapshot, reason_category, approval_reference_id. Kolom reason yang',
        'sudah ada dipakai sebagai catatan tambahan. NOL tabel audit baru dibuat.',
        '',
        'Katalog kategori alasan lahir sebagai decision_reason_categories -- bentuknya MENYALIN',
        'status_transition_rules: master berlaku seluruh tenant, TANPA company_id. 26 kategori',
        'terpasang di tiga proyek. Dibaca lewat API, bukan ditulis di kode layar: daftar yang',
        'hidup di kode UI tidak bisa dipakai menyaring riwayat di sisi server.',
        '',
        'CARA KONTEKS SAMPAI KE JEJAK, dan ini yang wajib diketahui sesi berikutnya: trigger',
        'tidak menerima parameter dan PostgREST tidak mengizinkan dua pernyataan dalam satu',
        'transaksi. Jadi RPC memasang konteks lewat set_config(..., true), lalu trigger',
        'membacanya lewat current_setting(..., true).',
        'KONSEKUENSINYA: memindahkan status lewat update biasa TETAP berhasil dan TETAP',
        'tercatat -- hanya TANPA pelaku dan TANPA alasan. Jejaknya terlihat ada, isinya kosong.',
        'Karena itu aksi berdampak WAJIB lewat RPC, dan penjaganya butir (n) di',
        'tests/aksi_po_klien_jejak_keputusan.test.ts.',
        '',
        'BUKTI: 14 pemeriksaan lulus, LIMA mutasi diuji dan kelimanya menggigit.')
  where task_code = 'AUD-49' and company_id = v_company_id;

  -- PJL-08 SELESAI: aksi terkendali PO klien hidup.
  update build_tasks
  set status = 'selesai',
      started_at = coalesce(started_at, now()),
      completed_at = now(),
      notes = concat_ws(chr(10),
        'SELESAI 29 Agu 2026 sebagai WS-S05, bersama AUD-49.',
        '',
        'Tiga fungsi basis data: tahan_po_klien, lepas_po_klien, batalkan_po_klien. Masing-masing',
        'memvalidasi wewenang, memvalidasi kategori alasan terhadap katalog, memasang konteks',
        'keputusan, lalu memindahkan status. NOL aturan transisi baru ditambahkan -- keempat',
        'bentuknya SUDAH ada di status_transition_rules dan hanya belum pernah punya pemicu.',
        '',
        'BD-06 ditegakkan: penghalang satu departemen TIDAK bisa dilepas departemen lain --',
        'departemen penahan dibaca dari actor_department_snapshot di jejak terakhir.',
        'Pembatalan hanya oleh Manager/GM.',
        '',
        'Layar: tombol di panel detail (aksi merusak DIJAUHKAN ke tepi kanan sesuai aturan',
        'modal #9), satu modal untuk ketiga keputusan -- varian danger untuk Batalkan --',
        'dengan kategori alasan dari katalog + catatan tambahan, dan panel Riwayat keputusan.',
        '',
        'TIGA HAL YANG BELUM ADA, dilaporkan bukan ditambal: (1) departemen `sales` di BD-06',
        'TIDAK punya peran di sistem -- 16 peran, tak satu pun sales, jadi sengaja tidak',
        'diimplementasikan; (2) aksi OVERRIDE bila pemegang peran departemen penahan tidak',
        'tersedia; (3) alur "Sales mengajukan permintaan pembatalan" -- yang dibangun adalah',
        'wewenang AKHIR-nya, bukan jalur pengajuannya.')
  where task_code = 'PJL-08' and company_id = v_company_id;

  -- BARU: konflik registry state machine.
  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes
  ) values (
    v_company_id, 'PJL-10', 'Nama status Sales Order: registry vs implementasi', 'PJL', 'Penjualan',
    concat_ws(chr(10),
      'FABRIX_STATE_MACHINE_REGISTRY mencantumkan SEBELAS state untuk Sales Order',
      '(DRAFT, SUBMITTED, VALIDATING, PENDING_APPROVAL, CONFIRMED, IN_FULFILLMENT,',
      'PARTIALLY_FULFILLED, FULFILLED, CLOSED, plus terminal CANCELLED dan REJECTED).',
      'Basis data mencantumkan EMPAT (confirmed, in_production, completed, cancelled),',
      'dan tiga di antaranya tidak pernah tercapai.',
      '',
      'Registry itu sendiri melarang penyalinan buta: "Do not copy these blindly into code.',
      'Reconcile with current implementation and approved domain architecture."'),
    'Tidak ada satu sumber yang bisa dipakai tanpa melanggar sesuatu: menyalin registry menambah tujuh state tanpa pemicu, mengabaikannya membuat registry berbohong.',
    'penting', array['Arsitektur'], 'Claude Code', 'menunggu', '/sales-orders', 'temuan_claude',
    concat_ws(chr(10),
      'MENUNGGU KEPUTUSAN AD-03. Rekomendasi: perbarui registry mengikuti model yang lahir',
      'dari AD-01 + BD-01, lalu kode mengikuti registry.',
      'Menyalin registry apa adanya DITOLAK dengan alasan yang bisa diuji: tiga state-nya',
      '(IN_FULFILLMENT, PARTIALLY_FULFILLED, FULFILLED) mencerminkan EKSEKUSI, yang menurut',
      'AD-01 bukan milik Sales Order.',
      '',
      'Konsekuensi yang sudah terlihat: karena eksekusi DIHITUNG, in_production sebagai status',
      'TERSIMPAN tidak lagi punya alasan untuk ada, dan dua baris status_transition_rules yang',
      'menyangkutnya menjadi aturan hantu yang wajib dicabut.'),
    concat_ws(chr(10),
      'Pembatalan terkendali TIDAK terhalang ini -- cancelled ada di kedua sumber.',
      'Rincian: docs/sales-crm/SALES_CRM_LIFECYCLE_RECONCILIATION.md bagian 1 dan 2.')
  );

  -- BARU: lima tabel ber-trigger lain belum punya pengisi jejak.
  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes
  ) values (
    v_company_id, 'AUD-50', 'Lima tabel ber-jejak yang pelakunya belum pernah terisi', 'AUD', 'Audit',
    concat_ws(chr(10),
      'Kolom pelaku dan alasan kini ADA di status_transition_log, dan trigger yang mengisinya',
      'menempel pada ENAM tabel. Baru SATU yang punya pengisi: customer_purchase_orders.',
      'Lima lainnya -- sales_orders, work_orders, production_batches, shipments,',
      'customer_po_approvals -- perpindahan statusnya masih lewat update biasa, jadi',
      'jejaknya tercatat TANPA pelaku dan TANPA alasan.'),
    'Keputusan di lima domain itu tercatat tanpa bisa menjawab siapa dan kenapa.',
    'penting', array['Audit'], 'Claude Code', 'menunggu', null, 'temuan_claude',
    concat_ws(chr(10),
      'JANGAN dikerjakan sebagai satu sapuan audit. Tiap tabel dikerjakan BERSAMA fitur yang',
      'memindahkan statusnya, karena setiap aksi butuh katalog alasan dan wewenangnya sendiri --',
      'dan katalog yang dibuat tanpa aksinya akan jadi daftar yang tidak pernah dipakai.',
      '',
      'Yang sudah tersedia dan tinggal dipakai: pola RPC + pasang_konteks_keputusan() +',
      'decision_reason_categories. Menambahkan kategori untuk entitas baru cukup satu insert.'),
    concat_ws(chr(10),
      'Ditemukan saat mengerjakan AUD-49, 29 Agu 2026. Baris tanpa pelaku TIDAK berbohong --',
      'layar menandainya "Pelaku tidak tercatat" dan servernya menggolongkannya',
      'tidak_diketahui. Yang hilang adalah kelengkapannya, bukan kejujurannya.')
  );
end $$;
