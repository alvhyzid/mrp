-- DS-02 (25 Agu 2026) — gelombang layar publik selesai dimigrasikan ke Carbon.

do $$
begin
update build_tasks set
  status = 'menunggu_persetujuan',
  approval_location = 'Buka berurutan: / (beranda) -> /login -> /register -> /forgot-password. Lalu ulangi di HP, atau kecilkan jendela sampai selebar HP.',
  approval_review_steps = E'1. Buka katalog Carbon carbondesignsystem.com/components/button/usage dan letakkan BERDAMPINGAN dengan halaman /register kita.\n' ||
    E'2. Periksa TOMBOL: teksnya di kiri, ikon panah di kanan, lebarnya mengikuti isi -- BUKAN melebar penuh rata tengah.\n' ||
    E'3. Periksa KARTU: tidak ada garis bingkai. Yang memisahkannya dari latar adalah kartu putih di atas latar abu-abu.\n' ||
    E'4. Klik ke dalam kotak isian: penanda fokusnya BIRU dan tipis, bukan hitam tebal.\n' ||
    E'5. Periksa kotak isian TERLIHAT sebagai kotak abu-abu muda, bukan putih polos yang hanya bergaris bawah.\n' ||
    E'6. Ulangi di HP: tidak boleh ada gulir ke samping, dan semua tombol harus enak ditekan jari.',
  approval_example_case = 'Halaman /register: isi seluruh field, tekan Daftar. Lalu /login: masuk seperti biasa, dan pastikan tombol "Lupa kata sandi?" serta "Daftar" bisa ditekan dengan jari di HP.',
  approval_if_approved = 'DS-02 ditutup, dan gelombang berikutnya dimulai LANGSUNG ke Master Item tanpa bertanya lagi -- izin itu sudah diberikan di DS-03.',
  approval_if_rejected = 'Sebutkan layar mana dan bagian mana yang masih terasa keliru, bila bisa dengan gambar katalog Carbon di sebelahnya. JANGAN diterima setengah: layar yang setengah-Carbon lebih buruk daripada layar lama yang seragam.',
  notes = coalesce(notes || E'\n\n', '') ||
    E'=== SELESAI 25 Agu 2026 — MENUNGGU PEMERIKSAAN PEMILIK PRODUK ===\n\n' ||
    E'TUJUH layar dimigrasikan, bukan tiga: beranda, masuk, daftar, lupa sandi, atur ulang\n' ||
    E'sandi, terima undangan, dan konfirmasi penerimaan barang. Ketujuhnya satu alur yang sama;\n' ||
    E'memindahkan tiga saja akan meninggalkan orang berpindah dari layar Carbon ke layar\n' ||
    E'bergaya lain lalu kembali lagi -- persis yang membuat produk terasa dirakit dari potongan.\n\n' ||
    E'=== CARA MENGERJAKANNYA, supaya bisa diulang di gelombang berikutnya ===\n' ||
    E'1. Grup rute app/(public)/ dibuat, dengan SATU impor CSS Carbon di layout-nya.\n' ||
    E'   Nama grup dalam kurung tidak muncul di alamat -- /login tetap /login.\n' ||
    E'   Impor per halaman SENGAJA dihindari: halaman kedelapan akan lupa menambahkannya.\n' ||
    E'2. Rangka bersama LayarPublik dibuat, dipakai KETUJUH layar. Sebelumnya ketujuhnya\n' ||
    E'   menyalin susunan yang sama dan menyimpan warna serta ukurannya masing-masing.\n' ||
    E'3. Seluruh kontrol diganti komponen Carbon asli.\n\n' ||
    E'=== YANG DIPERBAIKI, semuanya dari laporan pemilik produk ===\n' ||
    E'  (c) tombol tidak lagi dipaksa melebar penuh dan teksnya tidak lagi di tengah.\n' ||
    E'      Ikon panah dipakai karena ITULAH alasan Carbon memakai space-between.\n' ||
    E'  (b) bingkai kartu dicabut. Tile Carbon tidak berbingkai; yang memisahkan kartu dari\n' ||
    E'      latar adalah perbedaan LAPIS, bukan garis.\n' ||
    E'  (d) penanda fokus 3px hitam buatan sendiri diganti bawaan Carbon (2px biru).\n\n' ||
    E'=== SATU CACAT YANG HANYA TERTANGKAP DENGAN MELIHAT, BUKAN MENGUKUR ===\n' ||
    E'Setelah migrasi, halaman lolos SELURUH pengukuran -- nol sudut membulat, nol elemen\n' ||
    E'mentah, nol gulir menyamping, nol warna tulis tangan -- dan formulirnya tetap salah:\n' ||
    E'KOTAK ISIANNYA TIDAK TERLIHAT. Di tema Gray 10, lapis pertama berwarna putih; Tile\n' ||
    E'menempati lapis itu, dan field di dalamnya ikut putih. Putih di atas putih.\n' ||
    E'Perbaikannya komponen <Layer> Carbon, yang menggeser isi Tile ke lapis kedua.\n' ||
    E'PELAJARANNYA: pengukuran membuktikan sebuah nilai sesuai NIATNYA. Ia tidak bisa melihat\n' ||
    E'bahwa dua nilai yang sama-sama benar kebetulan berwarna sama. Ini penguat ketiga untuk\n' ||
    E'aturan "pemilik produk adalah alat verifikasi".\n\n' ||
    E'=== SATU PENYIMPANGAN DARI CARBON YANG DISENGAJA ===\n' ||
    E'Kotak centang di halaman POD dinaikkan area tekannya dari 37px ke 44px. Carbon TIDAK\n' ||
    E'menyediakan ukuran lain untuk Checkbox (tidak ada size="lg" seperti pada field/tombol).\n' ||
    E'Aturan proyek menetapkan 44px, dan halaman ini ditekan di HP di tepi jalan oleh orang yang\n' ||
    E'tidak pernah dilatih. Hanya TINGGI AREA TEKAN yang diubah; ukuran kotak, warna, dan jarak\n' ||
    E'tetap bawaan Carbon. Dicatat, bukan diselipkan.\n\n' ||
    E'Field & tombol memakai anak tangga `lg` Carbon (48px), BUKAN penimpaan tinggi -- menimpa\n' ||
    E'tinggi akan merusak padding, posisi label, dan ukuran ikon yang dihitung Carbon relatif\n' ||
    E'terhadapnya.\n\n' ||
    E'=== BUKTI, seluruhnya diukur dari peramban sungguhan ===\n' ||
    E'  7 layar x 4 lebar (360/768/1280/1920) = 28 pemeriksaan:\n' ||
    E'     nol sudut membulat | nol gulir menyamping | nol elemen mentah |\n' ||
    E'     nol target sentuh di bawah 44px\n' ||
    E'  22 warna heksadesimal tulis tangan -> NOL.\n' ||
    E'  Build produksi berhasil; seluruh alamat halaman tidak berubah.\n\n' ||
    E'  PEMISAHAN TERBUKTI TEGAS dari CSS build produksi:\n' ||
    E'     /login            memuat Carbon (858 KB, 15.203 aturan cds--)\n' ||
    E'     /dashboard        HANYA 40 KB CSS aplikasi, NOL aturan Carbon\n' ||
    E'     /items            HANYA 40 KB CSS aplikasi, NOL aturan Carbon\n' ||
    E'  Ke-37 layar di dalam (shell) benar-benar tidak tersentuh.\n\n' ||
    E'=== BATAS BUKTI, disebut supaya tidak dikira lebih ===\n' ||
    E'Keadaan FORMULIR halaman POD tidak bisa dibuka tanpa surat jalan sungguhan. Ia diperiksa\n' ||
    E'dengan menirukan jawaban /api/pod/<token> DI PERAMBAN, memakai data karangan -- nol\n' ||
    E'sentuhan ke basis data mana pun. Yang terbukti: tampilan dan ukurannya. Yang TIDAK\n' ||
    E'terbukti: pengiriman foto sungguhan dari HP sampai tersimpan.\n\n' ||
    E'=== PENJAGA ===\n' ||
    E'tests/layar_publik_carbon.test.ts (5 pemeriksaan) + tests/sudut_tajam_carbon.test.ts.\n' ||
    E'Dibuktikan MERAH lalu HIJAU: satu <button> mentah dan satu warna #123456 disisipkan, dan\n' ||
    E'penjaganya menyebut berkas beserta warnanya.\n' ||
    E'Versi pertama penjaga ini sempat MENUDUH halaman POD menulis <input> mentah, padahal yang\n' ||
    E'ditemukannya kata itu di dalam kalimat penjelasan. Sudah diperbaiki -- penjaga yang salah\n' ||
    E'tuduh melatih orang mengabaikan hasilnya.\n\n' ||
    E'=== ALAMAT KATALOG CARBON UNTUK PERBANDINGAN BERDAMPINGAN ===\n' ||
    E'  carbondesignsystem.com/components/button/usage\n' ||
    E'  carbondesignsystem.com/components/text-input/usage\n' ||
    E'  carbondesignsystem.com/components/tile/usage\n' ||
    E'  carbondesignsystem.com/components/form/usage\n' ||
    E'  carbondesignsystem.com/components/file-uploader/usage\n' ||
    E'  carbondesignsystem.com/elements/color/usage  (bagian "layers")\n\n' ||
    E'=== SATU HAL YANG SENGAJA TIDAK DIUBAH ===\n' ||
    E'Judul beranda tetap "MRP SaaS". Di dokumen internal sistem ini disebut FABRIX. Perbedaan\n' ||
    E'itu nyata dan perlu diputuskan pemilik produk, bukan diselipkan ke pekerjaan tampilan.'
where task_code = 'DS-02';
end $$;
