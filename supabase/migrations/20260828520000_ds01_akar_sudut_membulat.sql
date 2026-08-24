-- DS-01 (25 Agu 2026) — AKAR sudut membulat yang sebenarnya, ditemukan setelah pemilik
-- produk melaporkan "masih tetap sama" pada pemeriksaan kedua.

do $$
begin
update build_tasks set
  notes = coalesce(notes || E'\n\n', '') ||
    E'=== 25 Agu 2026, PEMERIKSAAN KEDUA: AKARNYA BARU KETEMU SEKARANG ===\n\n' ||
    E'Pemilik produk melaporkan sudut MASIH membulat setelah perbaikan pertama. Ia benar, dan\n' ||
    E'perbaikan pertama memang belum menyentuh akarnya.\n\n' ||
    E'AKAR YANG SEBENARNYA: skala borderRadius bawaan Tailwind punya SEMBILAN anak tangga.\n' ||
    E'tailwind.config.ts menimpa TIGA (lg/md/sm) jadi 0px. Enam sisanya diam-diam tetap memakai\n' ||
    E'nilai Tailwind, dan kode memakai EMPAT di antaranya di 34 tempat:\n' ||
    E'    rounded-3xl  1.5rem (24px)  -- 16 tempat\n' ||
    E'    rounded-full 9999px         -- 11 tempat\n' ||
    E'    rounded      0.25rem (4px)  --  4 tempat\n' ||
    E'    rounded-2xl  1rem (16px)    --  3 tempat\n' ||
    E'Terbanyak di halaman LOGIN, DAFTAR, LUPA SANDI, dan UNDANGAN -- layar yang paling sering\n' ||
    E'dilihat, dan layar PERTAMA yang dilihat orang baru. Itu sebabnya ia tetap terasa membulat\n' ||
    E'meski halaman pilot sendiri sudah bersih.\n\n' ||
    E'KENAPA PEMERIKSAAN PERTAMA MELESET -- bagian yang paling penting dicatat:\n' ||
    E'Ia MEMBACA tailwind.config.ts, melihat tiga anak tangga bernilai 0px, lalu menyimpulkan\n' ||
    E'SELURUH skalanya nol. Kesimpulannya LEBIH LUAS DARIPADA BUKTINYA -- dan yang salah justru\n' ||
    E'ada di bagian yang TIDAK TERTULIS di config. Membaca berkas tidak bisa menemukan sesuatu\n' ||
    E'yang tidak ada di berkas itu.\n' ||
    E'Ini pengulangan pola yang sama dengan kelas tipografi cds--type-* yang tidak pernah ada:\n' ||
    E'keduanya lolos build, lolos typecheck, dan terlihat bekerja. Keduanya hanya tertangkap\n' ||
    E'dengan MENGUKUR KELUARAN, bukan membaca masukan.\n\n' ||
    E'YANG DILAKUKAN:\n' ||
    E'  1. SELURUH anak tangga ditimpa 0px di tailwind.config.ts, bukan hanya yang dipakai --\n' ||
    E'     supaya anak tangga yang belum dipakai hari ini tidak jadi lubang besok.\n' ||
    E'  2. Sembilan tombol/tautan berbentuk pil (rounded-full) diubah jadi bersudut tajam.\n' ||
    E'     rounded-full DISISAKAN untuk foto profil dan titik hitung lonceng notifikasi --\n' ||
    E'     keduanya memang bulat, bukan kontrol bersudut.\n\n' ||
    E'BUKTINYA, dua lapis, keduanya diukur bukan disimpulkan:\n' ||
    E'  - CSS yang benar-benar dikirim peramban: seluruh .rounded* yang dipakai = 0, hanya\n' ||
    E'    .rounded-full yang tersisa 9999px.\n' ||
    E'  - Diukur DARI PERAMBAN SUNGGUHAN, lima halaman x dua lebar (360px & 1280px):\n' ||
    E'    beranda, masuk, lupa-sandi, tenant-uji, undangan -> NOL elemen bersudut membulat.\n\n' ||
    E'PENJAGANYA: tests/sudut_tajam_carbon.test.ts. Ia MENJALANKAN Tailwind atas seluruh anak\n' ||
    E'tangga dan membaca hasilnya -- sengaja tidak membaca config, karena membaca config persis\n' ||
    E'cara yang sudah gagal sekali. Sudah dibuktikan MERAH lalu HIJAU: dikembalikan ke config\n' ||
    E'lama, ia menyebut keempat kelas yang bocor satu per satu.\n' ||
    E'Test kedua menjaga daftar pemakai rounded-full, supaya tombol pil tidak diam-diam kembali.\n\n' ||
    E'SISA SUDUT MEMBULAT DI LAYAR PILOT, dan ini SESUAI SPESIFIKASI CARBON, bukan cacat:\n' ||
    E'  - panel penjelasan Toggletip: 2px (.cds--popover-content)\n' ||
    E'  - penanda "hari ini" di pemilih tanggal: bulat\n' ||
    E'Keduanya datang dari stylesheet Carbon sendiri. Jangan ditimpa.'
where task_code = 'DS-01';
end $$;
