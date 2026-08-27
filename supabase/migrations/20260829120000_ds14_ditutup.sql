-- DS-14 DITUTUP (27 Agu 2026). Keputusan arsitek: terima bukti B-08 yang sudah ada.
--
-- HANYA menyentuh satu baris: DS-14. Nol task lain, nol INSERT, nol DELETE, nol ID baru.
do $mig$
declare v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then return; end if;

  update build_tasks
     set status = 'selesai',
         completed_at = now(),
         detail_pekerjaan = detail_pekerjaan || chr(10) || concat_ws(chr(10),
       '',
       '=== DITUTUP 27 Agu 2026 — DASAR: BUKTI B-08, BUKAN CROSS-CHECK UI ===',
       '',
       'BUKTI YANG DITERIMA (dihasilkan B-08 sebelumnya, TIDAK diulang saat penutupan):',
       '  10 target permukaan baris mekar',
       '  120 pengukuran  = 10 target x 6 lebar x 2 keadaan (tertutup + terbuka)',
       '  121 tangkapan layar (120 bukti + 1 diagnosa)',
       '  132 catatan pengukuran tersimpan',
       '  0 pelanggaran ambang',
       '  0 UNABLE TO VERIFY',
       'Lebar kanonik: 360 / 672 / 768 / 1280 / 1440 / 1920. Tiga pemeriksaan tiap lebar:',
       'gulir menyamping, elemen melewati tepi kanan, elemen melewati tepi kiri. Seluruhnya 0.',
       '',
       'CAKUPAN PERMUKAAN:',
       '  Routing     -> tercakup B-08; bukti lama yang sempat basi SUDAH diukur ulang di sana',
       '  BOM         -> idem',
       '  PO Klien    -> tercakup B-08, seluruh pengukuran relevan lulus',
       '  Pengiriman  -> tercakup B-08, seluruh pengukuran relevan lulus',
       '',
       'KENAPA BUKTI ITU TIDAK BASI, dan ini diperiksa bukan diasumsikan:',
       '  git diff --name-only 1caada3..HEAD -- src app  ->  KOSONG',
       'Dua commit sesudah pengukuran hanya menyentuh satu berkas test tata kelola',
       '(81a1958) dan satu berkas migrasi tata kelola (1cb14a6). Nol berkas layar berubah.',
       '',
       '=== CROSS-CHECK UI: NOT RUN — DIKESAMPINGKAN OLEH KEPUTUSAN ARSITEK ===',
       '',
       'BUKAN "lulus". BUKAN "gagal". TIDAK DIJALANKAN. Kalimat ini ditulis tegas karena',
       'laporan yang menyebut sesuatu lulus padahal tidak pernah dijalankan adalah bentuk',
       'ketidakjujuran yang paling sulit ditemukan belakangan.',
       '',
       'Sebab teknisnya, diverifikasi dari kode sebelum satu baris fixture pun dibuat:',
       '  a. PO Klien BISA dibuat lewat layar, tetapi TIDAK BISA DIHAPUS lewat layar.',
       '     app/api/customer-purchase-orders/{route,approve,process} hanya menyediakan',
       '     GET, POST, PATCH, POST -- nol DELETE. "Hapus baris" di layar itu mencabut baris',
       '     dari formulir draf, bukan menghapus PO yang sudah tersimpan.',
       '  b. Pengiriman TIDAK BISA dibuat lewat layar di tenant uji: tombolnya muncul per',
       '     Sales Order, Sales Order menuntut production_plant_id, dan tenant uji punya nol',
       '     pabrik. api/production-plants hanya GET; nol jalur layar membuat pabrik.',
       '  c. Formulir pengiriman juga menuntut LOT, dan lot pun butuh pabrik.',
       '',
       'Menjalankan cross-check itu akan meninggalkan data yang tidak bisa dicabut dengan',
       'cara yang diizinkan, atau memperluas DS-14 jadi pekerjaan lifecycle/MST-09.',
       'Keduanya ditolak. DS-14 tidak boleh jadi kendaraan untuk menyelesaikan CRUD.',
       '',
       'METODE FIXTURE B-08 (SQL) TIDAK DINYATAKAN KELIRU. Ia metode yang dirancang,',
       'ditinjau, dan disetujui di gerbang eksekusi B-08, lengkap dengan potret 91 tabel,',
       'kanari PT ITM, dan pembersihan berbasis pola yang terbukti nol sisa.',
       '',
       'CELAH YANG TETAP TERBUKA, dicatat DI SINI supaya tidak hilang, dan TIDAK dikerjakan:',
       '  MST-09  -> tidak ada layar membuat pabrik/lokasi produksi',
       '  PO Klien dan Pengiriman -> tidak punya penghapusan lewat layar (celah lifecycle)',
       'Ketiganya tetap milik pemilik kanoniknya masing-masing. Nol task baru dibuat.'
     )
   where company_id = v_company_id and task_code = 'DS-14';
end
$mig$;
