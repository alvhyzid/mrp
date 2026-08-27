-- REKONSILIASI ADMINISTRATIF AUD-47 (27 Agu 2026).
--
-- BUKAN pekerjaan implementasi. Nol baris kode aplikasi disentuh oleh migrasi ini, dan
-- nol status pekerjaan berubah selain AUD-47 itu sendiri.
--
-- SEBABNYA: AUD-47 memuat DUA temuan yang tidak berhubungan, dan keduanya sudah punya
-- pemilik kanonik di tempat lain. Task yang isinya milik task lain akan dikerjakan dua kali
-- atau tidak sama sekali — keduanya sama buruknya.
--
--   1. RoutingsPage.tsx:332 window.confirm  -> milik DS-06
--      DS-06 sudah menyebutnya eksplisit: "Routing (1), Sales Order (2), Pelanggan (1),
--      Purchasing (2)". Jadi ini BUKAN pemindahan lingkup baru, melainkan menghapus
--      salinan kedua dari sesuatu yang sudah tercatat di sana.
--
--   2. tests/kpi_module.test.ts kecocokan persis -> milik AUD-42
--      Satu keluarga dengan "bentuk pengawasnya yang bermasalah".
--
-- CATATAN KEJUJURAN, supaya pembaca berikutnya tidak salah mengira: pokok AUD-42 yang
-- tertulis adalah pengawas yang SALAH TUDUH karena mencocokkan teks. "Pengawas yang
-- MENGHUKUM PERTUMBUHAN" adalah kerabatnya, bukan kembarannya — AUD-47 sendiri menyebutnya
-- sapuan tersendiri (perintah RR.2). Penggabungan ke AUD-42 adalah keputusan arsitek,
-- dicatat di sini beserta nuansanya, bukan disamarkan sebagai hal yang sudah jelas sama.
do $mig$
declare v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then return; end if;

  -- ===== 1. Lingkup konfirmasi merusak -> DS-06 (status TIDAK diubah) =================
  update build_tasks
     set detail_pekerjaan = detail_pekerjaan || chr(10) || concat_ws(chr(10),
       '',
       '=== DISERAP DARI AUD-47, 27 Agu 2026 (rekonsiliasi administratif) ===',
       '',
       'src/features/mrp/pages/RoutingsPage.tsx baris 332 masih memakai window.confirm()',
       'untuk konfirmasi hapus routing. Diverifikasi masih benar pada commit 81a1958.',
       '',
       'Ini SALAH SATU dari enam titik yang sudah didaftar task ini, bukan tambahan. AUD-47',
       'mencatatnya terpisah karena ditemukan lewat jalan lain: skrip pembersih MENGGANTUNG',
       'pada dialog peramban yang tidak bisa ditekan dari kode. Itu sendiri keterangan yang',
       'berguna — kotak dialog bawaan peramban bukan bagian dari aplikasi, dan karena itu',
       'tidak bisa diuji, tidak bisa diberi gaya, dan tidak bisa memuat penjelasan apa pun.',
       '',
       'PENJADWALANNYA TIDAK BERUBAH. Task ini tetap menunggu resolusi CONFLICT-1: catatan',
       'task ini menyatakan penggantian dilakukan SAAT halaman masing-masing dimigrasikan,',
       'sementara audit AS-IS meminta sapuan segera. Rekonsiliasi ini TIDAK memutuskan itu.'
     )
   where company_id = v_company_id and task_code = 'DS-06';

  -- ===== 2. Lingkup ambang cocok-persis -> AUD-42 (status TIDAK diubah) ===============
  update build_tasks
     set detail_pekerjaan = detail_pekerjaan || chr(10) || concat_ws(chr(10),
       '',
       '=== DISERAP DARI AUD-47, 27 Agu 2026 (rekonsiliasi administratif) ===',
       '',
       'tests/kpi_module.test.ts memakai KECOCOKAN PERSIS terhadap angka yang wajar bertumbuh:',
       '  expect((res1.body.registry as any).registryInserted).toBe(6)   (baris 192)',
       '  expect(registryRows?.length).toBe(6)                           (baris 199)',
       '  expect(cards.length).toBe(6)                                   (baris 216)',
       'Diverifikasi masih ada pada commit 81a1958.',
       '',
       'Menambah KPI ketujuh akan membuat ketiganya MERAH untuk alasan yang bukan kemunduran.',
       'Pasangannya, scripts/check-test-threshold.js, SUDAH diperbaiki jadi LANTAI (MIN_FILES)',
       'dan itu bentuk perbaikan yang dituju di sini juga.',
       '',
       'NUANSA YANG SENGAJA TIDAK DIRATAKAN: pokok task ini yang tertulis adalah pengawas yang',
       'SALAH TUDUH karena mencocokkan teks. Yang ini pengawas yang MENGHUKUM PERTUMBUHAN —',
       'kerabat, bukan kembaran. Keduanya berbagi akar yang sama (bentuk pengawasnya, bukan',
       'kasusnya), dan penggabungan ini keputusan arsitek 27 Agu 2026.',
       '',
       'B-01 TIDAK mengerjakan lingkup ini. B-01 memindahkan empat penjaga ke pembuang komentar',
       'bersama; ambang cocok-persis kpi_module belum disentuh sama sekali.'
     )
   where company_id = v_company_id and task_code = 'AUD-42';

  -- ===== 3. AUD-47 ditutup: nol lingkup tersisa ======================================
  -- 'dibatalkan', BUKAN 'selesai'. Tidak ada pekerjaan yang diselesaikan di sini —
  -- lingkupnya pindah. Menandainya selesai akan membuat daftar tugas mengklaim dua cacat
  -- sudah beres padahal keduanya masih hidup di DS-06 dan AUD-42.
  update build_tasks
     set status = 'dibatalkan',
         notes = concat_ws(chr(10),
           'DITUTUP 27 Agu 2026 lewat rekonsiliasi administratif, bukan karena dikerjakan.',
           'Alasan resmi yang dicatat arsitek:',
           '"AUD-47 contained two unrelated findings. The RoutingsPage destructive-confirmation',
           'finding is owned by DS-06, while the growable exact-match guard finding belongs to',
           'AUD-42. Both scopes were reconciled without loss or duplication; AUD-47 therefore',
           'has no remaining independent scope."'),
         detail_pekerjaan = detail_pekerjaan || chr(10) || concat_ws(chr(10),
           '',
           '=== DITUTUP 27 Agu 2026 — LINGKUPNYA KOSONG, BUKAN SELESAI ===',
           '',
           'Butir 1 (RoutingsPage:332 window.confirm) -> diserap DS-06.',
           'Butir 2 (kpi_module.test.ts kecocokan persis) -> diserap AUD-42.',
           'Butir 2a (check-test-threshold.js) -> memang sudah diperbaiki sebelumnya.',
           '',
           'KEDUA CACATNYA MASIH HIDUP. Yang berubah hanya SIAPA YANG MEMILIKINYA. Bila kelak',
           'ada yang membaca task ini dan mengira dua cacat itu sudah beres, bacalah kembali',
           'kalimat di atas: status "dibatalkan" di sini berarti LINGKUPNYA PINDAH.',
           '',
           'Nol ID baru dibuat. Nol status DS-06 atau AUD-42 diubah. Nol kode aplikasi disentuh.'
         )
   where company_id = v_company_id and task_code = 'AUD-47';
end
$mig$;
