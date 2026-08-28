-- DS-24 — HIERARKI JUDUL / KONSISTENSI JUDUL SEMANTIK LINTAS HALAMAN.
--
-- ==========================================================================================
-- KENAPA DS-24 DAN BUKAN DS-23 -- INI BAGIAN TERPENTING DARI BERKAS INI
-- ==========================================================================================
-- Pekerjaan hierarki judul mula-mula dikerjakan dengan label DS-23. Label itu SALAH, dan
-- tidak pernah menjadi task: `DS-23` sudah DICADANGKAN untuk temuan F-01/F-11 (sistem token
-- paralel, 181 pemakaian di 17 berkas) di dokumen rekonsiliasi
-- docs/ux/FABRIX_TASK_ID_RECONCILIATION_DS21_DS22.md §7 butir 2, berstatus PROPOSED dan
-- menunggu keputusan pemilik produk yang belum pernah dijawab.
--
-- PENCADANGAN ITU TIDAK DISENTUH BERKAS INI. `DS-23` tetap kosong dan tetap menjadi milik
-- F-01/F-11 sampai pemilik produk memutuskan. Nol baris di sini menyebut F-01 atau F-11.
--
-- KENAPA DS-24 AMAN, diperiksa satu per satu dan bukan diambil dari skrip saja:
--   1. tidak ada di build_tasks        -> diperiksa langsung ke registri (DS-01..DS-22 saja)
--   2. tidak dicadangkan di register   -> CANONICAL-ID-REGISTER-2026-08-27.md §2/§3/§4
--                                         mencadangkan TEPAT SATU nomor DS, yaitu `DS-21`
--                                         untuk F-01/F-11 -- bukan DS-24
--   3. tidak dipakai temuan lain       -> sepuluh temuan F-xx lain di §4 menunggu ID, tetapi
--                                         TIDAK ADA nomor yang dicadangkan untuk mereka
--   4. tidak bertentangan dengan register -> §4 menutup dengan "Next free numbers are
--                                         `DS-21` and `AUD-49`"; DS-21/22 sudah terpakai,
--                                         DS-23 dicadangkan, jadi DS-24 adalah yang pertama
--                                         benar-benar bebas
--
-- ==========================================================================================
-- KENAPA LANGSUNG BERSTATUS SELESAI
-- ==========================================================================================
-- Implementasi, penjaga, bukti peramban, dan pemeriksaan aksesibilitasnya SUDAH dikerjakan
-- dan sudah masuk repositori (commit 5857779 sumber, 28b9790 penjaga). Yang tertunda selama
-- ini HANYA kepemilikan nomornya. Menuliskannya sebagai `menunggu` lalu menutupnya di
-- migrasi berikutnya akan menghasilkan dua baris riwayat untuk satu kenyataan.
--
-- Ini BUKAN mengejar angka penyelesaian: Definition of Done diperiksa butir demi butir dan
-- hasilnya dicatat di notes di bawah.
--
-- HANYA SATU BARIS DIBUAT. Nol task lain disentuh, nol urgensi diubah, nol penghapusan,
-- nol company_id literal. Teks panjang lewat concat_ws(chr(10), ...) sesuai aturan proyek.
do $$
declare
  v_company_id integer;
  v_jumlah_company integer;
begin
  -- Perusahaan pemilik registri task diturunkan dari KEPEMILIKAN BARIS, bukan dari nama.
  -- Nama perusahaan bisa berubah lewat layar Setelan dan sudah pernah membuat migrasi
  -- "berhasil tanpa berlaku" di project data nyata.
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
      raise notice 'Basis data masih kosong -- migrasi DS-24 dilewati (no-op yang sah).';
      return;
    end if;
    raise exception 'Migrasi DS-24 tidak menemukan perusahaan pemilik registri task, padahal companies berisi % baris. Migrasi DIHENTIKAN supaya tidak berhasil tanpa berlaku.', v_jumlah_company;
  end if;

  perform pastikan_kode_task_kosong('DS-24');

  insert into build_tasks
    (company_id, task_code, name, module_code, module_name, description,
     effect_description, urgency, tags, pic, status, origin, detail_pekerjaan, notes,
     started_at, completed_at)
  values (
    v_company_id, 'DS-24',
    'Hierarki Judul: Judul yang Melompat Tingkat dan Judul Anak yang Lebih Tinggi dari Induknya',
    'DS', 'Design System',
    concat_ws(chr(10),
      'Judul halaman melompati tingkat -- h1 lalu langsung h3 atau h4 -- di enam halaman,',
      'dan di satu halaman judul di dalam modal KEMBAR dengan h2 bawaan ModalHeader Carbon.',
      '',
      'CACAT INI TIDAK TERLIHAT DI LAYAR, dan itulah sifat pentingnya: ukuran judul diatur',
      'KELAS CSS, bukan tag. Diukur di peramban -- .halaman__subjudul memberi 20px/400 baik',
      'sebagai h2 maupun h3 -- dan ada NOL selector berbasis tag h1-h6 di seluruh SCSS.',
      'Jadi lompatan tingkat tidak mengubah satu piksel pun.'
    ),
    concat_ws(chr(10),
      'Yang membaca tingkat judul adalah pembaca layar, dan bagi penggunanya lompatan berarti',
      '"ada bagian yang terlewat" -- ia mengira ada isi yang tidak sampai kepadanya.',
      '',
      'Karena tidak mengubah tampilan, cacat ini MUSTAHIL ditemukan lewat tangkapan layar',
      'maupun perbandingan berdampingan. Hanya penyisir yang bisa menjaganya.'
    ),
    'penting',
    array['Visual'],
    'Claude Code', 'selesai', 'temuan_claude',
    concat_ws(chr(10),
      'LINGKUP -- empat hal, bukan satu:',
      '  1. h1 ganda yang BENAR-BENAR ganda',
      '  2. lompatan tingkat judul',
      '  3. ketidakcocokan induk/anak: judul bawaan komponen lebih TINGGI dari pembungkusnya',
      '  4. akar bersama + penjaga regresi',
      '',
      'TEMUAN AWAL 11 TITIK, dan aritmetikanya DIKOREKSI di batch ini:',
      '  5 halaman ber-h1 ganda  -> KELIMANYA FALSE POSITIVE',
      '  6 halaman melompat      -> KEENAMNYA CACAT SUNGGUHAN',
      'Jadi 5 false positive dan 6 cacat, BUKAN 7 dan 4. Angka 7/4 lahir dari laporan batch',
      'sebelumnya yang ikut menghitung dua judul modal yang sudah benar (BomsPage:941,',
      'CustomerPurchaseOrdersPage:977) seolah termasuk sebelas titik itu -- padahal keduanya',
      'situs TAMBAHAN di dalam halaman yang cacatnya nyata. Dihitung ulang dari pohon',
      'sebelum perbaikan (commit fbc0c87) dengan metode yang sama: 5 + 6 = 11.',
      '',
      'KENAPA KELIMA h1 GANDA ITU FALSE POSITIVE:',
      'Kelimanya berada di dalam if (accessDenied) { return ... } -- cabang yang SALING',
      'MENIADAKAN dengan cabang normal. Bila cabang penolakan tampil, KepalaHalaman tidak',
      'dirender sama sekali. Kedua h1 TIDAK PERNAH ada di halaman yang sama. Dibuktikan',
      'secara struktural, bukan lewat penalaran: penjaga (d) memetakan blok penolakan,',
      'LULUS untuk kelimanya, lalu GAGAL saat h1 disisipkan di cabang normal.',
      '',
      'AKAR TUNGGAL:',
      'Tingkat judul dipilih SATU PER SATU saat menulis, dan tidak ada satu tempat pun yang',
      'menghubungkan sebuah judul dengan wadahnya. Carbon PUNYA mekanisme itu -- Section +',
      'Heading, dengan HeadingContext bawaan 1 dan Section = induk+1 -- dan repo ini',
      'memakainya NOL kali. Kelas "kebetulan benar": sebagian salinan benar, sebagian meleset,',
      'dan tidak ada yang mengeluh.',
      '',
      'ANGKA CARBON YANG MENENTUKAN, diukur dari paket terpasang @carbon/react 1.114.0:',
      '  ModalHeader  -> label DAN title KEDUANYA <h2>  (ComposedModal/ModalHeader.js:68,73)',
      '  Modal polos  -> as="h2"                        (Modal/Modal.js:319,325)',
      '  FileUploader -> labelTitle as="h3", DIPAKU     (FileUploader/FileUploader.js:202)',
      '  TableContainer adalah Section, tetapi repo tidak memberinya title -> nol judul',
      'Akibatnya judul pertama di dalam badan modal adalah h3, bukan h2.',
      '',
      'PEMBALIKAN TINGKAT YANG IKUT DITEMUKAN, dan tidak ada di sebelas temuan awal:',
      'sebelum perbaikan, /items memuat h4 "Dokumen" yang BERISI h3 "Berkas" milik Carbon --',
      'anak berjudul LEBIH TINGGI daripada induknya. Bentuk ini lebih buruk daripada lompatan',
      'dan sekarang dijaga uji (f).',
      '',
      'TUJUH HALAMAN, TIGA BELAS ELEMEN JUDUL, EMPAT BELAS BARIS:',
      '  BomsPage:575                     h3 -> h2   baris tabel dimekarkan',
      '  CustomerPurchaseOrdersPage:582   h3 -> h2   baris tabel dimekarkan',
      '  ItemsPage:716                    h4 -> h2   panel detail',
      '  ItemsPage:757, 897               h4 -> h3   dua subbagian DI DALAM panel detail',
      '  PurchasingPage:677               h4 -> h3   baris supplier, di bawah h2 Supplier',
      '  PurchasingPage:1367              h4 -> h3   di dalam modal',
      '  WorkOrdersPage:602,714,782,813   h4 -> h2   empat judul sejajar di baris dimekarkan',
      '  ProductionDashboardPage:676      h4 -> h3   di bawah h2 Work Order',
      '  RoutingsPage:772                 h2 -> h3   di dalam modal, TINGKAT KEMBAR',
      '',
      'RoutingsPage TIDAK ADA di sebelas temuan awal. Penjaga (c) yang menemukannya, bukan',
      'manusia -- bentuknya bukan lompatan melainkan tingkat kembar dengan h2 bawaan',
      'ModalHeader, dan itulah sebabnya pembacaan sumber melewatkannya.',
      '',
      'HUBUNGAN ANTAR JUDUL DIPERTAHANKAN. Empat judul Work Order tetap sejajar; dua',
      'subbagian Item tetap di bawah induknya. Yang diperbaiki tingkat MUTLAKNYA, bukan',
      'strukturnya -- itulah batas antara memperbaiki dan mendesain ulang.'
    ),
    concat_ws(chr(10),
      'SELESAI 28 Agu 2026. Commit: 5857779 (sumber) · 28b9790 (penjaga).',
      '',
      'PENJAGA: tests/hierarki_judul_lintas_halaman.test.ts, 6 uji, MERAH lebih dulu lalu',
      'HIJAU, dan TIAP penjaga dibuktikan MENGGIGIT dengan menyisipkan ulang cacatnya:',
      '  (a) KepalaHalaman/LayarPublik masih memancarkan h1  -- TRIPWIRE',
      '  (b) judul di luar modal tidak melompati tingkat',
      '  (c) judul di dalam modal mulai dari h3',
      '  (d) h1 mentah hanya di cabang penolakan akses',
      '  (e) tujuh halaman memakai tingkat yang sudah diverifikasi',
      '  (f) judul bawaan Carbon tidak lebih tinggi daripada pembungkusnya',
      '',
      'UJI (a) SENGAJA ADA SEBAGAI TRIPWIRE: kelima uji lain BERGANTUNG pada asumsi bahwa',
      'h1 datang dari komponen bersama. Bila h1 itu pindah, mereka akan diam-diam salah',
      'tanpa satu pun berubah warna. Jadi penjaganya sendiri dijaga.',
      '',
      'BATAS PENJAGA DISEBUT TERBUKA, karena diam soal ini memberi rasa aman yang keliru:',
      'ia memeriksa HIMPUNAN tingkat, BUKAN urutan kemunculannya. Sebabnya urutan SUMBER',
      'bukan urutan DOM -- renderDetailWo, detailBom, dan renderItemDetail ditulis di ATAS',
      'berkas tetapi tampil di DALAM baris tabel jauh di bawahnya. Bentuk yang lolos:',
      'h2 lalu h4 di halaman yang kebetulan juga memakai h3.',
      '',
      'BUKTI PERAMBAN: 42 pengukuran (7 halaman x 6 lebar 360/672/768/1280/1440/1920) --',
      'nol lompatan, tepat satu h1, nol gulir menyamping, nol elemen melewati tepi kanan',
      'maupun kiri. Ditambah 8 keadaan detail dan modal tempat ketiga belas judul benar-benar',
      'terlihat. Nol baris tertulis ke basis data: seluruh non-GET diblokir, data disuntik',
      'lewat jawaban API, nol fixture dibuat.',
      '',
      'REGRESI: suite 76 -> 77 berkas, 493 -> 499 lulus, 7 dilewati, NOL gagal. Selisihnya',
      'seluruhnya dari berkas penjaga baru. Lint 28 = baseline persis. Typecheck bersih.',
      '',
      'DEFINITION OF DONE diperiksa butir demi butir; 17 dari 17 terpenuhi setelah nomor',
      'kanonik ini ditetapkan. Dua butir yang sebelumnya gagal -- "ID verified" dan "task',
      'status correct" -- keduanya adalah nomor task ini sendiri.',
      '',
      'TEMUAN TERTUNDA, dicatat dan TIDAK dikerjakan (lihat dokumen laporan §17):',
      '  T-D1 lima cabang penolakan akses menulis judul halaman dengan tangan, sementara',
      '       14 dari 19 halaman sudah memakai KepalaHalaman -- kelas dua jalur hidup',
      '  T-D2 FileUploader memaku h3, jadi judul bagian tidak bisa bersarang di bawahnya',
      '  T-D3 Section+Heading Carbon dipakai nol kali; tingkat masih dipilih tangan',
      '  T-D4 penjaga memeriksa himpunan, bukan urutan',
      '  T-D5 SuratJalanPrintPage tidak punya h1 sama sekali (dokumen cetak)'
    ),
    now(), now()
  );

  raise notice 'DS-24 dibuat dan ditutup untuk company_id %.', v_company_id;
end $$;
