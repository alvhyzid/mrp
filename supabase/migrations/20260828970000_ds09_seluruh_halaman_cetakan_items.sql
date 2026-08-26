-- DS-09 SELESAI untuk SELURUH halaman: cetakan Master Item diterapkan ke semua layar
-- (26 Agu 2026, atas perintah pemilik produk "terapkan ini ke semua halaman").
do $mig$
declare v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then return; end if;

  update build_tasks
     set status = 'menunggu_persetujuan',
         approval_review_steps = concat_ws(chr(10),
           'Buka layar-layar berikut dan bandingkan BERDAMPINGAN dengan katalog Carbon:',
           '  /items (acuan yang sudah Anda setujui) — lalu /routing, /boms, /work-orders,',
           '  /purchasing, /sales-orders, /customer-purchase-orders, /shipments, /production,',
           '  /warehouse, /hr, /ppic, /customers, /documents, /team, /kamus, /profile,',
           '  /build-tasks, /company/setelan.',
           'Yang diperiksa: apakah keempatnya SAMA di semua layar — remah roti, judul + baris',
           'jumlah, pencarian yang MELIPAT, dan toolbar tabel.',
           'Katalog pembanding: carbondesignsystem.com/patterns/data-table-pattern,',
           '/components/data-table/usage, /components/modal/usage, /components/dropdown/usage.'),
         approval_location = 'Seluruh halaman aplikasi, dimulai dari /items sebagai pembanding.',
         approval_example_case = concat_ws(chr(10),
           'Buka /routing lalu /items berdampingan. Keduanya harus punya bentuk kepala halaman',
           'yang sama persis, kotak pencarian yang sama-sama melipat jadi ikon, dan saringan',
           'yang sama bentuknya. Kalau ada yang terasa berbeda, itu yang perlu disebutkan.'),
         approval_if_approved = 'DS-09 ditutup, dan pekerjaan lanjut ke REBRAND FABRIX.',
         approval_if_rejected = concat_ws(chr(10),
           'Sebutkan layar mana dan bagian mana yang masih berbeda. Perbaikannya masuk ke',
           'komponen bersama (KepalaHalaman / .tabel-responsif), bukan ke halaman satu per',
           'satu — supaya perbaikannya berlaku di semua layar sekaligus.'),
         detail_pekerjaan = detail_pekerjaan || chr(10) || concat_ws(chr(10),
       '',
       '=== 26 Agu 2026 — SELURUH HALAMAN MENGIKUTI CETAKAN MASTER ITEM ===',
       '',
       'SATU PINTU BERSAMA DIBUAT LEBIH DULU, bukan aturan tertulis:',
       '  1. `KepalaHalaman` (src/components/ui/kepala-halaman.tsx) — remah roti + judul +',
       '     baris jumlah. Sebelumnya tiap halaman menyalin cetakannya sendiri, dan itulah',
       '     sebabnya halaman Routing bisa lahir tanpa remah roti tanpa ada yang menyadarinya.',
       '  2. `.tabel-responsif` DIPINDAHKAN dari items.scss ke src/styles/carbon.scss.',
       '     Blok "baris tabel jadi kartu di layar sempit" itu SUDAH ADA sejak Master Item,',
       '     tapi namanya `.item-tabel` — jadi HANYA Master Item yang mendapatkannya, dan',
       '     tujuh halaman bertabel lain tetap terpotong di HP. Kelas "dua jalur hidup" lagi:',
       '     aturan yang benar, diterapkan di satu tempat saja.',
       '',
       'DUA BELAS HALAMAN yang sebelumnya belum tersentuh Carbon, semuanya selesai:',
       '  HRD, PO klien, BOM, Gudang, Build Tasks, Pengiriman, Produksi, Work Order,',
       '  Pembelian, Sales Order, PPIC, dan halaman cetak Surat Jalan.',
       'EMPAT halaman yang sudah Carbon tapi menyimpang dari cetakan ikut dibereskan:',
       '  Pelanggan, Master Dokumen, Kelola Tim, Setelan Perhitungan, dan Profil Saya.',
       '',
       'YANG SERAGAM SEKARANG DI SEMUA LAYAR:',
       '  - remah roti Dashboard / workspace (TIDAK bisa diklik) / halaman ini;',
       '  - judul pendek + satu baris JUMLAH, bukan paragraf penjelasan;',
       '  - pencarian MELIPAT di toolbar (`persistent` tidak dipakai di mana pun);',
       '  - saringan berupa Dropdown ber-titleText+hideLabel, BUKAN kotak centang;',
       '  - tabel size="lg" dengan kolom yang BENAR-BENAR bisa diurut — barisnya memuat',
       '    NILAI YANG DITAMPILKAN, bukan sekadar id (baris ber-id saja menghasilkan tombol',
       '    urut yang tidak mengurut apa pun);',
       '  - baris yang bisa dimekarkan untuk rincian, bukan kartu terpisah di bawah tabel;',
       '  - pembagian halaman berbahasa Indonesia;',
       '  - aksi merusak (Hapus/Arsipkan/Tolak) DIPISAH jarak dari aksi sehari-hari.',
       '',
       'CACAT YANG DITEMUKAN LEWAT PENGUKURAN, bukan dugaan:',
       '  a. GULIR MENYAMPING di 360px pada DELAPAN halaman. Ditelusuri: penyebabnya SATU —',
       '     DataTableSkeleton Carbon berlebar TETAP (terukur 864px di layar 360px).',
       '     Yang penting dari temuan ini: gulirnya HANYA ada SELAMA MEMUAT, jadi ia lolos',
       '     dari pemeriksaan yang dilakukan setelah halaman selesai. Diperbaiki sekali di',
       '     kelas bersama.',
       '  b. Ambang pemakaian kapasitas PPIC sempat tergeser dari 80% ke 85% saat mengganti',
       '     warna Tag. Dikembalikan ke 80%: itu ambang BISNIS, bukan pilihan gaya.',
       '  c. Pengecualian penjaga kebocoran istilah yang dikunci NOMOR BARIS menggigit TIGA',
       '     KALI dalam satu giliran. Karena ia sudah MENGHALANGI pekerjaan, DS-11 dilunasi',
       '     sekalian: pengecualiannya kini dikunci ke PENANDA KOMENTAR di dalam berkasnya',
       '     (penjaga-kebocoran:mulai / :selesai), jadi ia ikut berpindah bersama kodenya.',
       '',
       'PENGECUALIAN YANG DISEBUT TERBUKA, bukan kelalaian:',
       '  - Papan Gantt PPIC tetap memakai <table> biasa: ia kisi waktu ber-`table-fixed`',
       '    dengan sel yang bisa dijatuhi (drag & drop). Carbon tidak punya komponen Gantt,',
       '    dan Table Carbon membawa aturan tinggi baris yang merusak kisinya.',
       '  - Build Tasks tidak punya toolbar tabel: saringannya satu untuk SEMUA modul, dan',
       '    tiap modul punya tabelnya sendiri. Toolbar per tabel akan mengulang saringan',
       '    yang sama sebanyak jumlah modul.',
       '  - Halaman CETAK surat jalan tidak memakai remah roti dan baris jumlah: cetakan itu',
       '    untuk LAYAR. Di atas kertas, remah roti tidak berarti apa-apa. Yang diambil dari',
       '    Carbon di sana hanya komponennya. Dokumen yang tercetak sendiri TIDAK disentuh.',
       '  - Halaman publik (masuk, daftar, lupa sandi, POD) tidak berkerangka aplikasi, jadi',
       '    tidak berremah roti.',
       '',
       'MENUNGGU PERSETUJUAN PEMILIK PRODUK: layar-layarnya perlu dilihat berdampingan',
       'dengan katalog Carbon sebelum ditutup — itu pemeriksaan yang hanya bisa dilakukan',
       'mata manusia, dan sudah dua kali menangkap hal yang pengukuran tidak bisa.'
     )
   where company_id = v_company_id and task_code = 'DS-09';

  -- DS-11 (pengecualian penjaga dikunci nomor baris) LUNAS.
  update build_tasks
     set status = 'selesai',
         detail_pekerjaan = detail_pekerjaan || chr(10) || concat_ws(chr(10),
       '',
       '--- DITUTUP 26 Agu 2026 ---',
       'Dikerjakan lebih cepat dari rencana karena ia MENGHALANGI pekerjaan berjalan:',
       'jebakannya menggigit TIGA KALI dalam satu giliran kerja, tiap kali memakan satu',
       'putaran test yang gagal.',
       '',
       'Pengecualian kini dikunci ke PENANDA KOMENTAR di dalam berkasnya sendiri:',
       '  // penjaga-kebocoran:mulai <alasan>   ...   // penjaga-kebocoran:selesai',
       'Penandanya ikut berpindah bersama kodenya, jadi menyunting berkas tidak lagi bisa',
       'menggeser pengecualian ke baris yang salah.',
       '',
       'PENGAMANNYA: penanda hanya berlaku di berkas yang TERDAFTAR di test itu. Tanpa itu,',
       'siapa pun bisa membungkam pengawas ini dengan menempelkan satu komentar.'
     )
   where company_id = v_company_id and task_code = 'DS-11';

  -- DS-12 (halaman bertabel belum mengikuti cetakan) LUNAS — dikerjakan bersama DS-09.
  update build_tasks
     set status = 'selesai',
         detail_pekerjaan = detail_pekerjaan || chr(10) || concat_ws(chr(10),
       '',
       '--- DITUTUP 26 Agu 2026 ---',
       'Dikerjakan bersama perintah "terapkan ke semua halaman". Pelanggan, Master Dokumen,',
       'dan Kelola Tim kini punya kolom yang benar-benar bisa diurut, pencarian melipat,',
       'saringan Dropdown (bukan kotak centang), dan pembagian halaman berbahasa Indonesia.'
     )
   where company_id = v_company_id and task_code = 'DS-12';
end
$mig$;
