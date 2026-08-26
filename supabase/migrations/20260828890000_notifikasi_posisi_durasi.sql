-- Notifikasi: posisi kanan atas + durasi hilang sendiri (25 Agu 2026).
do $mig$
begin
  update build_tasks set
    notes = concat_ws(chr(10), coalesce(notes, ''), '',
      '=== POSISI & DURASI NOTIFIKASI, permintaan pemilik produk ===',
      'Pesan pindah dari notifikasi sebaris jadi TOAST melayang di KANAN ATAS, tepat di bawah',
      'header. Komponen bersama: src/components/ui/notifikasi.tsx (AreaNotifikasi).',
      '',
      'YANG CARBON TETAPKAN vs TIDAK -- diukur dari paket terpasang, bukan dari ingatan:',
      '  DITETAPKAN : lebar toast 288px (352px di breakpoint max), anatomi, warna, ikon.',
      '  TIDAK      : POSISI -- _toast-notification.scss punya NOL aturan position;',
      '               DURASI -- timeout bawaan 0, artinya TIDAK PERNAH hilang sendiri.',
      'Jadi keduanya KEPUTUSAN KITA, bukan angka Carbon. Disebut terbuka supaya sesi',
      'berikutnya tidak mengira ini bawaan Carbon dan takut mengubahnya.',
      '',
      'DURASI YANG DIPILIH: 5 detik untuk pesan BERHASIL. Alasannya dua, dan keduanya bisa',
      'diperiksa: cukup membaca satu kalimat konfirmasi pendek, dan isinya TIDAK PENTING untuk',
      'disimpan karena perubahannya sudah terlihat di layar.',
      '',
      'PESAN GAGAL TIDAK PERNAH HILANG SENDIRI. Panduan Carbon: "jangan pakai toast untuk',
      'informasi yang harus diingat pengguna sambil bekerja". Yang gagal memuat hal yang harus',
      'DITINDAKLANJUTI; pesan yang menghilang sebelum dibaca sama dengan pesan yang tidak',
      'pernah muncul. Ia juga memakai role="alert" supaya pembaca layar menyela, sementara',
      'yang berhasil memakai role="status" yang mengumumkan dengan sopan.',
      '',
      '=== DIUKUR DI PERAMBAN, bukan disimpulkan dari angka di kode ===',
      '  area notifikasi: position fixed, 48px dari atas (persis tinggi header), 0 dari kanan;',
      '  toast: lebar 288px (angka Carbon sendiri), 16px dari tepi kanan jendela;',
      '  BERHASIL -> hilang sendiri pada ~5.150 ms (pengukuran per 500 ms, target 5.000);',
      '  GAGAL    -> masih ada setelah 9.077 ms, role="alert", dan baru hilang saat ditutup',
      '              dengan sengaja. Diuji dengan berkas 5,61 MB terhadap batas 2 MB, jadi',
      '              galatnya datang dari server sungguhan: "Ukuran file maksimal 2MB."',
      '',
      'BATAS YANG DISEBUT TERBUKA: jarak dari atas mengikuti tinggi header kerangka aplikasi',
      'lewat variabel --fabrix-offset-notifikasi. Layar PUBLIK tidak punya header itu; bila',
      'kelak memakai area ini, variabelnya WAJIB disetel ulang ke 0.')
  where task_code = 'FND-04';
end $mig$;
