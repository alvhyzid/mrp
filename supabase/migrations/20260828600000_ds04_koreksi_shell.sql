-- DS-04 (25 Agu 2026) — enam koreksi setelah pemeriksaan pemilik produk.

do $$
begin
update build_tasks set
  notes = coalesce(notes || E'\n\n','') ||
    E'=== ENAM KOREKSI, 25 Agu 2026 (temuan pemilik produk) ===\n\n' ||
    E'1. PENJELASAN STATUS TERPOTONG PANEL. Benar, dan sebabnya struktural: panel kiri harus\n' ||
    E'   ber-overflow supaya 15 kelompok bisa digulir, dan elemen MELAYANG di dalam wadah\n' ||
    E'   ber-overflow SELALU terpotong oleh wadahnya. Itu bukan cacat penempatan yang bisa\n' ||
    E'   ditambal dengan mengatur posisi popover.\n' ||
    E'   PERBAIKANNYA membuang popovernya sama sekali:\n' ||
    E'     a. keterangan per item ditulis LANGSUNG di bawah labelnya sebagai teks kecil;\n' ||
    E'     b. arti tiap penanda dijelaskan SEKALI di kaki panel, bukan 75 kali.\n' ||
    E'   Penjelasan yang sama diulang 75 kali bukan cuma boros -- ia membuat orang berhenti\n' ||
    E'   membaca. Teks yang menetap juga tidak perlu diklik dulu untuk terbaca.\n\n' ||
    E'2. TOMBOL LIPAT TIDAK BERFUNGSI. Benar. Sebabnya SideNav dipasang isPersistent, sehingga\n' ||
    E'   saklar dari HeaderContainer tidak berpengaruh di layar lebar. Keadaan buka-tutup\n' ||
    E'   sekarang diurus sendiri. DIUKUR sesudah perbaikan: sebelum diklik panel 256px & isi\n' ||
    E'   bergeser 256px; sesudah diklik panel 0px & isi bergeser 0px -- area kerja benar-benar\n' ||
    E'   MELEBAR, bukan sekadar menunya disembunyikan.\n\n' ||
    E'3. URUTAN MENU. Pertanyaan "Sales bukannya harus di awal?" benar, dan alasannya lebih\n' ||
    E'   kuat daripada frekuensi: menu yang mengikuti ALUR KERJA bisa dibaca sebagai urutan\n' ||
    E'   proses, sehingga orang baru belajar sistemnya dari menunya sendiri. Urutan berdasarkan\n' ||
    E'   frekuensi (keputusan D-5) hanya menghemat gulir bagi yang SUDAH tahu.\n' ||
    E'   URUTAN BARU: Overview > Sales & CRM > Product & Engineering > Planning & APS >\n' ||
    E'   Manufacturing > Supply Chain > Quality > Traceability > People > Finance & Costing >\n' ||
    E'   Data & Analytics > AI > Maintenance > Control Tower > Internal.\n' ||
    E'   D-5 tetap terhormat lewat dua hal: Dashboard berdiri sendiri paling atas, dan\n' ||
    E'   workspace yang isinya hampir kosong tetap di bawah.\n\n' ||
    E'4. MENU TERLALU RAPAT. Benar. Bawaan Carbon 2rem dirancang untuk menu pendek; menu ini\n' ||
    E'   15 kelompok bersarang. Tinggi kelompok jadi 2,5rem dan item 2,25rem, dengan napas\n' ||
    E'   tambahan antar kelompok supaya batasnya terbaca tanpa perlu garis.\n\n' ||
    E'5. AVATAR + MENU AKUN. Avatar berinisial, nama, peran, dan panah dijadikan SATU tombol --\n' ||
    E'   seluruh areanya bisa ditekan. Versi sebelumnya menaruh nama sebagai teks mati yang\n' ||
    E'   terlihat bisa diklik padahal tidak.\n' ||
    E'   Panelnya memakai HeaderPanel + Switcher Carbon, bukan menu buatan sendiri. Isinya dua\n' ||
    E'   kelompok: Administration dan Settings (memuat profil, setelan perhitungan, dan seluruh\n' ||
    E'   integrasi). Keduanya DIKELUARKAN dari navigasi kiri.\n' ||
    E'   Alasan pemisahannya: navigasi kiri menjawab "apa yang saya KERJAKAN"; menu akun\n' ||
    E'   menjawab "bagaimana sistem dan akun saya DIATUR". Pengaturan disentuh beberapa kali\n' ||
    E'   setahun, pekerjaan setiap hari.\n\n' ||
    E'6. WARNA. Carbon menetapkan warna header lewat TEMA yang diterapkan ke "shell zone":\n' ||
    E'   "The UI Shell can be customized to use any of the four IBM themes by applying an\n' ||
    E'   inline theme to the shell zone." Zona shell sekarang g100, area isi tetap g10.\n' ||
    E'   DIUKUR: header rgb(22,22,22), panel kiri rgb(22,22,22), isi rgb(244,244,244).\n' ||
    E'   Ini sekaligus menyelesaikan keluhan panel kiri "terlalu menyatu dengan area isi" --\n' ||
    E'   yang memisahkan keduanya sekarang perbedaan TEMA, bukan garis tipis yang mudah hilang.\n\n' ||
    E'=== SATU CACAT TAMBAHAN YANG KETEMU SAMBIL MEMPERBAIKI ===\n' ||
    E'Menu akun versi pertama menghasilkan <li> DI DALAM <li> -- HTML tidak sah, dilaporkan\n' ||
    E'React sebagai galat hydration di konsol. TIDAK TERLIHAT di layar, tapi nyata: peramban\n' ||
    E'boleh "memperbaiki" struktur semacam itu sesuka hatinya, dan hasilnya berbeda antar\n' ||
    E'peramban. Sebabnya SwitcherDivider Carbon sendiri sudah berupa <li>.\n' ||
    E'Ditemukan karena overlay pengembangan menampilkan "3 Issues" -- lalu diperiksa, bukan\n' ||
    E'diabaikan. Sesudah diperbaiki: nol li>li, konsol bersih.\n\n' ||
    E'=== BUKTI ULANG ===\n' ||
    E'  28 dari 28 halaman terbuka utuh.\n' ||
    E'  5 lebar (360/768/1280/1440/1920): panel berperilaku benar, NOL gulir menyamping.\n' ||
    E'  Konsol peramban BERSIH (nol galat, nol peringatan).\n' ||
    E'  SkipToContent: Enter memindahkan fokus ke <main id=main-content>.\n' ||
    E'  Fokus keyboard terlihat: outline 2px putih (token $focus di g100).\n' ||
    E'  Build produksi berhasil. 13 test lulus.\n' ||
    E'  Penjaga diperluas ke MENU_AKUN, dan dibuktikan MASIH menggigit: href palsu\n' ||
    E'  /audit-log disisipkan -> merah menyebut item dan alamatnya; dicabut -> hijau.'
where task_code = 'DS-04';
end $$;
