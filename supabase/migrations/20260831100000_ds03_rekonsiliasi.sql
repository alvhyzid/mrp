-- DS-03 — REKONSILIASI STATUS, BUKAN KEPUTUSAN BARU.
--
-- HANYA menyentuh baris DS-03.
--
-- Teks panjang lewat concat_ws(chr(10), ...) sesuai aturan proyek.

update build_tasks
set status = 'selesai',
    completed_at = now(),
    notes = notes || concat_ws(chr(10),
      '',
      '=== REKONSILIASI STATUS, 27 Agu 2026 ===',
      '',
      'DS-03 ditutup sebagai SELESAI. Ini BUKAN keputusan baru -- keputusannya sudah ada di',
      'catatan di atas, bertanggal 25 Agu 2026, lengkap dengan alasannya.',
      '',
      'ACCEPTANCE DS-03 menurut detail pekerjaannya sendiri ada tiga langkah:',
      '  1. Sodorkan urutan ke pemilik produk   -> DILAKUKAN (tiga gelombang di atas)',
      '  2. Tunggu keputusannya                 -> DILAKUKAN (disetujui 25 Agu 2026)',
      '  3. Catat keputusan beserta alasannya   -> DILAKUKAN (blok KEPUTUSAN di atas)',
      'Ketiganya tuntas. Yang tertinggal hanya STATUS-nya.',
      '',
      'BUKTI bahwa keputusannya memang sudah dijalankan, bukan sekadar tertulis:',
      '  - Gelombang 1 (layar publik)  -> DS-02 berstatus selesai',
      '  - Master Item tanpa jeda      -> DS-05 berstatus selesai',
      '  - Cetakan halaman data        -> DS-08 berstatus selesai',
      '  - Pelaksanaan seluruh layar   -> DS-09, sedang menunggu persetujuan visual',
      '',
      'AKIBAT PENTING yang perlu diketahui sesi berikutnya: DS-03 SUDAH TIDAK MENGHALANGI',
      'apa pun. Laporan sebelumnya (audit UX-01 dan handoff 3 jam) menyebut DS-03 sebagai',
      'gerbang yang menahan 22 task. Itu KELIRU -- kesimpulan itu diambil dari JUDUL task',
      '("Menunggu Keputusan Pemilik Produk"), bukan dari isinya. Judulnya memang tidak pernah',
      'diperbarui setelah keputusannya masuk.',
      '',
      'Yang benar-benar menunggu pemilik produk sekarang adalah DS-09, dan yang ditunggu',
      'BUKAN keputusan urutan melainkan PERBANDINGAN VISUAL BERDAMPINGAN -- pemeriksaan yang',
      'hanya bisa dilakukan mata manusia. Langkahnya sudah tertulis di kolom persetujuan DS-09.',
      '',
      'DIUKUR 27 Agu 2026 untuk menyiapkan pemeriksaan itu, 19 layar di 1440px:',
      '  remah roti y=72 - judul 28px y=114 - baris pengantar ada - pencarian MELIPAT',
      '  selebar 48px dan tertutup secara bawaan - toolbar setinggi 48px.',
      '  SERAGAM di seluruh 15 layar bertabel.',
      '',
      'Satu ketidakseragaman ditemukan dan diperbaiki di giliran yang sama: /company/setelan',
      'memakai pembungkus sendiri tanpa jarak antar-blok, sehingga remah rotinya 8px dan',
      'judulnya 24px lebih tinggi daripada 18 layar lain. Ikut ditemukan: /items -- LAYAR',
      'ACUAN -- memakai kelas kerangka yang isinya SALINAN PERSIS kerangka bersama; benar',
      'hari ini karena disalin, bukan karena satu sumber. Keduanya kini memakai kerangka',
      'bersama, dan penjaganya lahir bersamanya: tests/kerangka_halaman_bersama.test.ts.'
    )
where task_code = 'DS-03';
