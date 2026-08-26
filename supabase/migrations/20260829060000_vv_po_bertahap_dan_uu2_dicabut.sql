-- Blok VV (26 Agu 2026): PO klien jadi modal bertahap (cetakan), dan syarat UU.2 DICABUT.
do $mig$
declare v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then return; end if;

  -- ===== UU.2 DICABUT sebagai syarat, dijadikan task tersendiri =====
  perform pastikan_kode_task_kosong('FND-05');

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description,
    effect_description, urgency, status, origin, pic, detail_pekerjaan, notes, ditunda_pemicu)
  values (v_company_id, 'FND-05',
    'Simpan Sementara Formulir Panjang — Bila Ternyata Tidak Bisa Diselesaikan Satu Duduk',
    'FND', 'Fondasi',
    concat_ws(chr(10),
      'Formulir panjang (PO klien, karyawan, item, BOM) menuntut seluruh isinya diselesaikan',
      'dalam satu kali buka. Bila di lapangan ternyata ada formulir yang datanya baru lengkap',
      'setelah menunggu orang lain, dibutuhkan simpanan sementara.'),
    concat_ws(chr(10),
      'Tanpa itu, pengguna yang kekurangan satu data harus membatalkan seluruh isian dan',
      'mengulang dari nol nanti.'),
    'bisa_menunggu', 'ditunda_sadar', 'pemilik_produk', 'Pemilik Produk',
    concat_ws(chr(10),
      'DICABUT DARI SYARAT PENGERJAAN 26 Agu 2026 atas teguran pemilik produk.',
      '',
      'Pertanyaan "apakah PIC diisi orang yang sama" dan kebutuhan simpan-sementara BUKAN',
      'pekerjaan UI/UX — itu ALUR KERJA. Menjadikannya syarat memecah modal berarti menahan',
      'pekerjaan UI di belakang pertanyaan yang bukan urusannya.',
      '',
      'Modal bertahap DIKERJAKAN TANPA MENUNGGU jawaban ini, dan memang sudah selesai.'),
    concat_ws(chr(10),
      'Dicatat sebagai pengingat, bukan sebagai pekerjaan yang menunggu giliran.',
      'Selama belum ada keluhan nyata, tidak ada yang perlu dibangun.'),
    concat_ws(chr(10),
      'PEMICU: ada formulir yang TERBUKTI tidak bisa diselesaikan satu orang dalam satu duduk.',
      'Bukti yang dimaksud: pengguna melaporkannya, atau terlihat formulir yang berulang kali',
      'dibatalkan di tengah. Dugaan bahwa "mungkin datanya belum lengkap" BUKAN pemicu.'));

  -- ===== DS-18: cetakan PO klien selesai =====
  update build_tasks
     set status = 'menunggu_persetujuan',
         approval_review_steps = concat_ws(chr(10),
           'Buka /customer-purchase-orders lalu tekan "Buat PO klien".',
           'Yang diperiksa:',
           '  1. Empat langkah di atas: Klien / PIC / Tanggal & bayar / Barang.',
           '     Apakah pengelompokannya masuk akal menurut cara orang PT ITM mengisinya?',
           '  2. Tombol bawah: Batal di KIRI, Sebelumnya + Berikutnya berpasangan di KANAN.',
           '  3. Di langkah terakhir, tombol biru berganti jadi "Buat PO klien".',
           '  4. Tidak ada lagi dua kolom di mana pun.',
           'Bandingkan dengan carbondesignsystem.com/components/modal/usage#progress-modal.'),
         approval_location = '/customer-purchase-orders, tombol "Buat PO klien".',
         approval_example_case = concat_ws(chr(10),
           'Coba isi satu PO dari awal sampai akhir. Bila di tengah jalan Anda merasa sebuah',
           'field ada di langkah yang salah, itu yang perlu disebutkan — pengelompokan disusun',
           'dari nama field, bukan dari cara kerja pabrik.'),
         approval_if_approved = 'Tiga modal panjang lainnya mengikuti cetakan ini: karyawan, item, BOM.',
         approval_if_rejected = concat_ws(chr(10),
           'Sebutkan field mana pindah ke langkah mana. Perbaikannya di daftar LANGKAH_PO dan',
           'pengelompokan bagiannya — bukan di gaya, jadi murah diubah.'),
         detail_pekerjaan = detail_pekerjaan || chr(10) || concat_ws(chr(10),
       '',
       '=== CETAKAN SELESAI 26 Agu 2026: PO klien jadi modal bertahap ===',
       '',
       'EMPAT LANGKAH, judul pendek dengan keterangan di baris kedua:',
       '  Klien           - Siapa yang memesan',
       '  PIC             - Orang yang dihubungi',
       '  Tanggal & bayar - Kapan dan bagaimana',
       '  Barang          - Item dan jumlahnya',
       'Judulnya dipendekkan SETELAH DIUKUR: dengan judul panjang keempatnya terpotong jadi',
       '"Orang yang dihub..." di modal 691px. Artinya tetap utuh karena pindah ke baris kedua',
       'yang memang disediakan Carbon (secondaryLabel).',
       '',
       'UKURAN md, BUKAN lg. Diukur di peramban dan cocok persis dengan tabel Carbon:',
       '  360px -> 360px (100%)   768px -> 645px (84%)   1440px -> 691px (48%)',
       '',
       'FOOTER: kelas cds--modal-footer--three-button terpasang, tiap tombol 172px pada modal',
       '691px = TEPAT 25%. Di langkah terakhir tombol birunya berbunyi "Buat PO klien".',
       'Nol gulir menyamping di ketiga lebar.',
       '',
       'DUA HAL YANG HARUS DIPAKAI LAGI DI TIGA MODAL BERIKUTNYA:',
       '  1. Pakai PROP secondaryButtons, BUKAN children. Hanya lewat prop itu Carbon memasang',
       '     kelas --three-button yang memberi lebar 25%. Tiga tombol sebagai children',
       '     menghasilkan tiga tombol selebar 50% yang meluber.',
       '  2. `children` tetap diwajibkan TIPE-nya di @carbon/react 1.114 meski komponennya',
       '     tidak merendernya — isi dengan {null}.',
       '',
       'DUA DEVIASI YANG DISEBUT TERBUKA:',
       '  a. Halaman Usage Carbon menggambar Batal sebagai GHOST; komponen React-nya merender',
       '     kedua tombol sekunder dengan kind="secondary" dan tidak menyediakan pilihan.',
       '     Yang diikuti adalah KOMPONENNYA, bukan gambarnya.',
       '  b. Komponen React meratakan ketiga tombol ke kanan, sehingga Batal berakhir di',
       '     tengah. Didorong ke kiri lewat satu aturan CSS — sesuai gambar spesifikasinya,',
       '     DAN sesuai aturan proyek nomor 9 (aksi yang membuang pekerjaan tidak boleh',
       '     berjarak satu jari dari aksi sehari-hari).',
       '',
       'DUA KOLOM DICABUT: .po-form__kisi dan .po-klien-baru tidak lagi jadi dua kolom di',
       'lebar mana pun.'
     )
   where company_id = v_company_id and task_code = 'DS-18';
end
$mig$;
