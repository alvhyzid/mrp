-- DS-04 (25 Agu 2026) — UI Shell Carbon terpasang. NAV-01 sebagian terjawab.

do $$
begin
update build_tasks set
  status = 'menunggu_persetujuan',
  approval_location = 'Masuk ke sistem, lalu perhatikan kerangka di sekeliling halaman: batang atas dan menu kiri. Coba juga di HP.',
  approval_review_steps = E'1. Perhatikan MENU KIRI: 17 kelompok yang bisa dibuka-tutup. Buka "Product & Engineering".\n' ||
    E'2. Item yang HURUFNYA ABU-ABU dan ada penanda "Belum ada" TIDAK BISA diklik -- itu memang disengaja.\n' ||
    E'3. Klik ikon (i) di sebelah penanda: muncul penjelasan KENAPA item itu belum bisa dibuka.\n' ||
    E'4. Cari "Sales Forecast" di Planning & APS -- penandanya MERAH bertuliskan "Ditolak", bukan "Belum ada".\n' ||
    E'5. Di HP: menu tertutup, dibuka lewat tombol garis tiga, dan MENUTUP SENDIRI setelah memilih halaman.\n' ||
    E'6. Tekan Tab dua kali dari awal halaman: muncul "Lompat ke isi utama". Tekan Enter.\n' ||
    E'7. YANG AKAN TERLIHAT CAMPUR: kerangka sudah Carbon, ISI halaman sebagian besar belum. Itu disengaja.',
  approval_example_case = 'Buka Items lewat menu kiri (Product & Engineering -> Items). Lalu coba klik "Specifications" di kelompok yang sama -- ia tidak bisa diklik, dan ikon (i) menjelaskan kenapa.',
  approval_if_approved = 'DS-04 ditutup. Lanjut ke migrasi isi halaman, dimulai dari Master Item -- izin sudah diberikan di DS-03.',
  approval_if_rejected = 'Sebutkan bagian kerangka mana yang keliru. Bila yang mengganggu adalah ISI halaman yang belum Carbon, itu bukan penolakan DS-04 -- itu pekerjaan gelombang berikutnya.',
  notes = coalesce(notes || E'\n\n','') ||
    E'=== TERPASANG 25 Agu 2026 ===\n\n' ||
    E'ISI HALAMAN TIDAK DISENTUH. Yang diganti hanya kerangkanya.\n\n' ||
    E'KOMPONEN CARBON YANG DIPAKAI: Header, HeaderContainer, HeaderName, HeaderMenuButton,\n' ||
    E'HeaderGlobalBar, HeaderGlobalAction, SideNav, SideNavItems, SideNavMenu, SideNavMenuItem,\n' ||
    E'SideNavLink, SkipToContent, Tag, Toggletip, Theme.\n' ||
    E'TIDAK DIPAKAI, beserta alasannya:\n' ||
    E'  HeaderNavigation/HeaderMenu -- menu mendatar di header. 17 workspace tidak muat, dan\n' ||
    E'    navigasi kiri sudah memikulnya. Memakai keduanya berarti DUA jalur navigasi.\n' ||
    E'  Switcher/HeaderPanel/SideNavSwitcher -- pemindah produk/tenant. BELUM ADA tenant kedua;\n' ||
    E'    memasangnya berarti menambahkan sesuatu tanpa pemicunya.\n\n' ||
    E'NAVIGASI: 102 item di 17 workspace, konfigurasinya berkas TypeScript bertipe di repo\n' ||
    E'(src/features/navigasi/navConfig.ts), BUKAN tabel database.\n' ||
    E'  aktif 27 | sebagian 15 | belum-ada 51 | diparkir 7 | internal 2 | DITOLAK 1\n\n' ||
    E'PENANDA VISUAL, sesuai permintaan pemilik produk:\n' ||
    E'  - Item tanpa halaman dirender sebagai TEKS ABU-ABU, bukan tautan. Tautan yang diklik\n' ||
    E'    lalu tidak melakukan apa-apa lebih buruk daripada yang tidak bisa diklik: yang pertama\n' ||
    E'    membuat orang mengira sistemnya rusak.\n' ||
    E'  - Tag berwarna menurut ARTI: merah=ditolak, biru=sebagian, abu=belum ada, ungu=ditunda.\n' ||
    E'  - Ikon (i) dibuka dengan KLIK (bukan hover) menjelaskan KENAPA -- penanda tanpa alasan\n' ||
    E'    hanya memindahkan pertanyaannya.\n' ||
    E'  - Sales Forecast ditandai DITOLAK, bukan "belum ada". Perbedaannya bukan tata bahasa:\n' ||
    E'    "belum ada" berarti tunggu, "ditolak" berarti jangan tunggu.\n\n' ||
    E'DUA CACAT YANG DITEMUKAN SAAT MENGERJAKAN, keduanya hanya terlihat dengan MENJALANKAN:\n' ||
    E'  1. SkipToContent memindahkan halaman ke jangkarnya tapi FOKUS keyboard tertinggal di\n' ||
    E'     <body> -- diukur, mendarat di BODY. Akibatnya Tab berikutnya mengulang dari awal\n' ||
    E'     dokumen, dan pengguna keyboard kembali ke 102 item menu yang barusan ia lompati.\n' ||
    E'     Perbaikannya tabIndex={-1} pada <main>. Sesudahnya: fokus mendarat di main-content.\n' ||
    E'  2. Label panjang ("Revisions & Effectivity") membungkus ke baris kedua lalu MENINDIH\n' ||
    E'     baris di bawahnya, karena tingginya dipatok tetap. Ditemukan dari melihat tangkapan\n' ||
    E'     layarnya. Dua nilai yang sama-sama benar -- tinggi baris dan pembungkusan teks --\n' ||
    E'     bertabrakan.\n\n' ||
    E'AppShell LAMA DIHAPUS, bukan disisakan. Kerangka lama yang masih bisa diimpor adalah\n' ||
    E'jalur kedua yang hidup. Dihapus SETELAH penggantinya terbukti: 29 dari 29 halaman utuh.\n\n' ||
    E'=== BUKTI ===\n' ||
    E'  7a. 29 dari 29 halaman terbuka utuh (header + side nav ada, nol galat runtime),\n' ||
    E'      diperiksa satu per satu di peramban dengan akun sungguhan di tenant fixture.\n' ||
    E'      /debug dan /test-tenant memang DI LUAR grup (shell) sejak dulu -- bukan regresi.\n' ||
    E'  7b. Lima lebar: 360 & 768 menu tersembunyi + tombol menu ada; 1280/1440/1920 menu\n' ||
    E'      tampil 256px dan isi mulai di 256px. NOL gulir menyamping di kelima lebar.\n' ||
    E'      Lebar isi mengikuti lebar layar penuh -- deviasi LEBAR PENUH bekerja.\n' ||
    E'  7c. Urutan Tab: Lompat ke isi utama -> tombol menu -> nama aplikasi -> notifikasi ->\n' ||
    E'      buat PO -> keluar. Fokus terlihat (outline 3px) di seluruhnya KECUALI lonceng\n' ||
    E'      notifikasi (1px) -- komponen itu belum Carbon, dicatat untuk gelombang berikutnya.\n' ||
    E'  7d. SkipToContent: sesudah diperbaiki, Enter memindahkan fokus ke <main id=main-content>.\n' ||
    E'  7e. Build produksi berhasil. Penjaga: tests/nav_status_jujur.test.ts (6 pemeriksaan)\n' ||
    E'      + layar_publik_carbon + sudut_tajam_carbon -> 13 lulus.\n\n' ||
    E'KATALOG CARBON UNTUK PERBANDINGAN BERDAMPINGAN:\n' ||
    E'  carbondesignsystem.com/patterns/global-header\n' ||
    E'  carbondesignsystem.com/components/ui-shell-header/usage\n' ||
    E'  carbondesignsystem.com/components/ui-shell-left-panel/usage\n' ||
    E'  carbondesignsystem.com/components/tag/usage\n\n' ||
    E'FIXTURE DIBERSIHKAN. Bukti memakai POLA, bukan jumlah total: 0 company NavAudit,\n' ||
    E'0 company TestCorp, 0 user navaudit.'
where task_code = 'DS-04';

update build_tasks set
  notes = coalesce(notes || E'\n\n','') ||
    E'=== SEBAGIAN TERJAWAB 25 Agu 2026 ===\n' ||
    E'Konfigurasi navigasi sudah dibuat dan terpasang: 102 item di 17 workspace, berkas\n' ||
    E'TypeScript bertipe, status diisi DARI hasil audit.\n' ||
    E'Urutan workspace memakai usulan frekuensi pakai harian (Manufacturing & Supply Chain di\n' ||
    E'atas, workspace kosong di bawah) -- BELUM dikonfirmasi pemilik produk, jadi masih bisa\n' ||
    E'diubah tanpa biaya besar.\n' ||
    E'YANG MASIH MENGGANTUNG: pilihan quick-create (D-6/A.7). Sementara ini header hanya memuat\n' ||
    E'satu pintasan yang sudah ada sebelumnya (Buat PO klien).'
where task_code = 'NAV-01';
end $$;
