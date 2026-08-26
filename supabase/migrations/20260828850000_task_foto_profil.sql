-- Foto profil DIBANGUN 25 Agu 2026 (MM.1) -- dicatat sebagai task yang langsung selesai.
do $mig$
declare v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then return; end if;

  perform pastikan_kode_task_kosong('FND-04');

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description,
    effect_description, urgency, status, origin, pic, detail_pekerjaan, notes)
  values (v_company_id, 'FND-04',
    'Foto Profil — Nama Berkas Unik, Ikon Carbon Bawaan, Header Berubah Tanpa Muat Ulang',
    'FND', 'Fondasi SaaS',
    'Foto profil bisa diganti tanpa menghapus yang lama, dan header ikut berubah seketika.',
    'Menentukan apakah foto yang diganti bisa dipulihkan, dan apakah orang melihat hasilnya tanpa memuat ulang.',
    'penting', 'selesai', 'pemilik_produk', 'Claude Code',
    concat_ws(chr(10),
      'YANG DIKERJAKAN:',
      'a. src/lib/profilEvents.ts -- SATU PINTU untuk kabar "profil berubah". Nama kabarnya',
      '   hidup di satu tempat, bukan sebagai teks lepas di dua berkas.',
      'b. uploadAvatar.ts -- nama berkas UNIK (waktu + acak), upsert:false. Foto lama TIDAK',
      '   dihapus; pembersihan menyusul lewat INF-23.',
      'c. AppShellCarbon -- menampilkan FOTO bila ada, ikon Carbon UserAvatar bila belum, dan',
      '   mendengarkan kabar sehingga header berubah tanpa halaman dimuat ulang. Inisial huruf',
      '   DICABUT.',
      'd. ProfilePage -- FileUploader Carbon menggantikan <input type="file"> mentah. Memilih',
      '   foto lewat KLIK; tidak ada bagian yang cuma muncul saat kursor lewat.',
      '',
      'DIUKUR DI PERAMBAN SUNGGUHAN (tenant uji company.b@debug.mrp):',
      '  - unggah -> foto tampil di Profil DAN header dengan URL yang SAMA, header tidak lagi',
      '    menampilkan ikon, TANPA muat ulang;',
      '  - ganti foto -> nama berkasnya berbeda (avatar-1787677061884-ba76c171.png lalu',
      '    avatar-1787677070832-a3780667.png), dan KEDUANYA masih ada di Storage;',
      '  - foto dipaksa rusak -> <img> hilang, ikon bawaan muncul; bukan gambar patah;',
      '  - tombol "Pilih foto" setinggi 48px di 360/768/1280/1920 px, nol gulir menyamping.',
      '',
      'SISA FIXTURE DIBERSIHKAN: tiga berkas avatar di folder tenant uji dihapus lewat Storage',
      'API, dan avatar_url company.b@debug.mrp dikembalikan ke kosong.'),
    concat_ws(chr(10),
      'KEPUTUSAN PEMILIK PRODUK (MM.1): "cara A" -- halaman Profil mengumumkan, header',
      'mendengarkan. "Cara B" (satu sumber data pengguna untuk 36 halaman) DITOLAK untuk task',
      'ini dan dicatat terpisah sebagai PLT-06.',
      '',
      'KENAPA NAMA BERKAS UNIK PENTING, bukan kerapian: versi lama memakai nama TETAP',
      'avatar.<ext> dengan upsert. Mengganti foto PNG dengan PNG lain MENIMPA yang lama tanpa',
      'jejak -- dan begitulah foto pemilik produk hilang permanen. Komentar lama di berkas itu',
      'hanya menyadari kasus PNG -> JPG dan DIAM soal PNG -> PNG.',
      '',
      'YANG TIDAK DIKERJAKAN DI SINI, sengaja: blok Tanda Tangan Digital di halaman yang sama',
      'MASIH memakai <input type="file"> mentah. Itu bagian dari penerapan Carbon ke seluruh',
      'halaman, bukan bagian foto profil -- aturan fokus satu task.'));
end $mig$;
