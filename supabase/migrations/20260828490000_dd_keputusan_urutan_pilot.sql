-- DD (25 Agu 2026) — urutan pilot ditetapkan, MST-26 ditutup, kaitan CC.7 dicatat.

do $$
declare v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then return; end if;

update build_tasks set
  notes = coalesce(notes || E'\n\n', '') ||
    E'=== URUTAN PILOT DITETAPKAN 25 Agu 2026 (DD.1) ===\n' ||
    E'(b) SETELAN PERUSAHAAN lebih dulu, lalu (a) MASTER ITEM. (c) PO KLIEN MENYUSUL.\n\n' ||
    E'Alasan pemilik produk dicatat apa adanya: "estimasi 6-9 sesi bersandar pada hitungan baris ' ||
    E'dan field, bukan kecepatan nyata — belum ada satu layar pun yang pernah dipindahkan ke ' ||
    E'Carbon. Berkomitmen tiga pilot sekaligus berarti berkomitmen pada angka yang belum teruji."\n\n' ||
    E'PEMICU (c): setelah (a) selesai DAN CustomerProduct beres — supaya PO Klien tidak disentuh ' ||
    E'dua kali.\n\n' ||
    E'DD.2 — SETELAH fondasi + (b) selesai, WAJIB laporkan KECEPATAN NYATA dan revisi estimasi (a) ' ||
    E'dari angka itu, bukan dari hitungan baris. Itu yang membuat sisa rencana bisa dipercaya.\n\n' ||
    E'=== FONDASI + PILOT (b) SELESAI 25 Agu 2026 ===\n' ||
    E'Fondasi terpasang: @carbon/react 1.114.0 + sass, tema Gray 10 terverifikasi dari token yang ' ||
    E'benar-benar dipancarkan (background #f4f4f4, layer-01 #ffffff, text-primary #161616, ' ||
    E'border-subtle-01 #e0e0e0), nol @font-face dari Carbon, IBM Plex lewat next/font.\n\n' ||
    E'TIGA KEGAGALAN BERURUTAN SEBELUM BERHASIL, dicatat supaya tidak diulang:\n' ||
    E'  1. `$theme: ''g10''` -> "$map2: g10 is not a map". $theme menuntut PETA token, bukan nama.\n' ||
    E'  2. memuat themes lalu `@use @carbon/react with (...)` -> "module was already loaded".\n' ||
    E'     `themes` diam-diam memuat `config` lebih dulu.\n' ||
    E'  3. konfigurasi lewat `with ($theme:)` -> build lulus TAPI token :root tetap PUTIH.\n' ||
    E'  YANG BERHASIL: config dikonfigurasi di baris pertama, tema dipancarkan EKSPLISIT lewat\n' ||
    E'  mixin `theme.theme(themes.$g10)` di :root -- supaya hasilnya bisa DIPERIKSA, bukan\n' ||
    E'  diharapkan.\n\n' ||
    E'CSS CARBON TERBUKTI TERBATAS ke rute pilot: bundel terpisah 837 KB, sementara CSS aplikasi ' ||
    E'tetap 41 KB dan nol kelas Carbon. 37 layar lain TIDAK tersentuh. Ini disengaja -- memuat ' ||
    E'Carbon di layout akar akan mengubah 38 halaman sekaligus dalam satu perubahan yang tidak ' ||
    E'bisa diperiksa satu per satu.'
where task_code = 'DS-01';

update build_tasks set
  status = 'selesai',
  completed_at = now(),
  notes = coalesce(notes || E'\n\n', '') ||
    E'DITUTUP 25 Agu 2026 oleh pilot Carbon pertama (DS-1 pilot b). Ketujuh belas setelan kini ' ||
    E'punya jalur tulis lewat layar: /company/setelan.\n\n' ||
    E'YANG DIBANGUN:\n' ||
    E'  - Katalog setelan di satu berkas (companySettingsCatalog.ts): label Bahasa Indonesia yang ' ||
    E'    menjawab "apa yang terjadi kalau saya isi ini", validasi, dan penanda apakah setelan itu ' ||
    E'    memengaruhi perhitungan yang SUDAH LEWAT.\n' ||
    E'  - Daftar setelan datang dari KATALOG, bukan dari isi database. Perusahaan baru melihat ' ||
    E'    ketujuh belasnya bertanda "Belum diisi" -- kalau daftarnya dari database, ia akan melihat ' ||
    E'    halaman kosong tanpa tahu ada 17 hal yang perlu diisi.\n' ||
    E'  - Tabel jejak append-only: siapa, kapan, dari apa ke apa, alasan, dan SEJAK KAPAN BERLAKU.\n' ||
    E'  - Gerbang peran di SERVER (403), bukan sekadar tombol disembunyikan.\n' ||
    E'  - Seluruh perubahan divalidasi DULU sebelum satu pun ditulis -- setengah berubah pada angka ' ||
    E'    yang menentukan HPP lebih buruk daripada gagal seluruhnya.\n\n' ||
    E'DIBUKTIKAN lewat 7 test (tests/company_settings_mst26.test.ts) DAN lewat aplikasi yang ' ||
    E'benar-benar berjalan: perusahaan baru melihat 17 "belum diisi"; nilai di luar batas ditolak ' ||
    E'dengan pesan Indonesia; tanpa tanggal berlaku ditolak; peran tanpa wewenang ditolak 403 dan ' ||
    E'NOL baris tertulis; jejak mencatat lengkap; mengirim nilai sama tidak melahirkan jejak palsu.\n\n' ||
    E'BATAS YANG WAJIB DISEBUT, jangan dibaca melebihi kekuatannya: keenam pembaca setelan MASIH ' ||
    E'memakai nilai SEKARANG, bukan nilai yang berlaku pada tanggal transaksi. Tabel jejak MENYIMPAN ' ||
    E'bahan untuk menjawab "berapa tarifnya bulan Juli", tapi belum ada perhitungan yang ' ||
    E'MENANYAKANNYA. Membuat keenam pembaca sadar-tanggal adalah pekerjaan tersendiri -- dicatat ' ||
    E'sebagai MRG-12, bukan diselundupkan ke sini.\n\n' ||
    E'BELUM DIVERIFIKASI SECARA VISUAL: lingkungan kerja ini tidak punya alat peramban, jadi ' ||
    E'tangkapan layar di 360/768/1280/1440/1920 TIDAK BISA dibuat. Yang sudah dibuktikan: halaman ' ||
    E'merender (HTTP 200, 55 KB), stylesheet Carbon termuat, dan kisi field memakai grid otomatis ' ||
    E'tanpa titik henti tetap sehingga tidak ada media query yang bisa salah di lebar tertentu. ' ||
    E'Pemeriksaan mata di kelima lebar TETAP PERLU dilakukan pemilik produk.'
where task_code = 'MST-26';

insert into build_tasks (
  company_id, task_code, name, module_code, module_name, description, effect_description,
  urgency, tags, pic, status, origin, detail_pekerjaan
) values (
  v_company_id, 'MRG-12', 'Perhitungan Biaya Belum Membaca Setelan Sesuai Tanggal Transaksi', 'MRG', 'Margin & Biaya',
  'Jejak setelan perusahaan sekarang menyimpan tanggal berlaku setiap perubahan (MST-26). Tapi keenam pembaca setelan — margin, biaya tenaga kerja, laba operasional, kelayakan jadwal, kalender absensi, pemrosesan PO — masih membaca nilai YANG BERLAKU SEKARANG.',
  'Menaikkan tarif BPJS hari ini akan mengubah biaya batch BULAN LALU, karena perhitungannya memakai tarif terbaru untuk semua periode. Angka yang sudah dilaporkan berubah sendiri tanpa ada yang menyentuhnya.',
  'penting', array['biaya','tanggal-berlaku','margin'], 'Claude Code + Pemilik Produk', 'menunggu', 'temuan_claude',
  E'BAHANNYA SUDAH ADA, tinggal dipakai: company_settings_history menyimpan setting_key, ' ||
  E'new_value, dan effective_from, dengan indeks (company_id, setting_key, effective_from desc).\n\n' ||
  E'YANG PERLU DIBANGUN: satu fungsi pencari "nilai setelan X yang berlaku pada tanggal T", lalu ' ||
  E'keenam pembaca memakainya dengan tanggal transaksi yang relevan -- bukan hari ini.\n\n' ||
  E'YANG PERLU DIPUTUSKAN PEMILIK PRODUK, jangan ditebak: untuk batch yang biayanya sudah ' ||
  E'DIKUNCI final, apakah perubahan tarif berlaku surut sama sekali? CLAUDE.md sudah menetapkan ' ||
  E'biaya batch berjalan TIDAK DITIMPA perhitungan ulang -- aturan itu mungkin sudah menjawabnya, ' ||
  E'tapi perlu ditegaskan sebelum kode ditulis.\n\n' ||
  E'KAITAN: tanpa ini, tanggal berlaku di MST-26 tercatat rapi tapi tidak mengubah apa pun. ' ||
  E'Itu bentuk "terdaftar tapi tidak pernah hidup" yang sudah berkali-kali jadi cacat di proyek ini.'
) on conflict (company_id, task_code) do nothing;

end $$;
