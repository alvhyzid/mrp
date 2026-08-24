-- FF (25 Agu 2026) — koreksi pilot Carbon + bukti AUD-26.

do $$
declare v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then return; end if;

update build_tasks set
  notes = coalesce(notes || E'\n\n', '') ||
    E'=== FF (25 Agu 2026) — SUDUT MEMBULAT: AKARNYA BUKAN SATU PUN DARI TIGA DUGAAN ===\n\n' ||
    E'Diperiksa ketiganya:\n' ||
    E'  (a) Tailwind menimpa -> TIDAK. --radius: 0rem, dan ketiga token borderRadius = 0px.\n' ||
    E'  (b) CSS global memberi radius -> TIDAK. Carbon JUSTRU punya reset global\n' ||
    E'      "button, select, input, textarea { border-radius: 0 }".\n' ||
    E'  (c) bukan komponen Carbon -> TIDAK. 36 komponen Carbon asli, NOL HTML mentah,\n' ||
    E'      NOL komponen bersama lama.\n\n' ||
    E'JAWABANNYA (d): KOMPONENNYA SALAH DIPILIH. `.cds--tag` disetel border-radius 1rem oleh\n' ||
    E'Carbon sendiri -- Tag MEMANG berbentuk pil menurut spesifikasinya. Dipakai menandai\n' ||
    E'"Belum diisi" di halaman yang ke-17 fieldnya belum diisi, jadi 17 pil.\n' ||
    E'Ini kesalahan pemilihan komponen, BUKAN Carbon yang ditimpa. Tag untuk menggolongkan &\n' ||
    E'menyaring; status field dijawab warn/warnText bawaan kontrolnya. Sudah diganti.\n\n' ||
    E'=== TEMUAN LEBIH BURUK YANG KETEMU SAMBIL MEMERIKSA ===\n' ||
    E'Carbon memancarkan NOL kelas utilitas tipografi. Ketiga kelas yang dipakai halaman ini\n' ||
    E'(cds--type-productive-heading-04, -03, cds--type-body-01) TIDAK ADA di CSS sama sekali --\n' ||
    E'judul jatuh ke ukuran bawaan peramban. Lolos build, lolos typecheck, terlihat bekerja.\n' ||
    E'Ini "berhasil tanpa berlaku" untuk KETIGA kalinya di pilot ini.\n' ||
    E'Diganti mixin Sass type-style di stylesheet sendiri.\n\n' ||
    E'=== FF.2 VERIFIKASI TIPOGRAFI (diukur dari CSS hasil build) ===\n' ||
    E'  Heading halaman   seharusnya 1.75rem -> 1.75rem  COCOK\n' ||
    E'  Heading kelompok  seharusnya 1.25rem -> 1.25rem  COCOK\n' ||
    E'  Label field       seharusnya 0.75rem -> 0.75rem  COCOK\n' ||
    E'  Helper text       seharusnya 0.75rem -> 0.75rem  COCOK\n' ||
    E'  Pesan peringatan  seharusnya 0.75rem -> 0.75rem  COCOK\n' ||
    E'  Seluruhnya bobot 400. NOL angka px ditulis langsung.\n\n' ||
    E'KOREKSI ATAS SPESIFIKASI YANG DIKUTIP: token $heading-03 TIDAK ADA di @carbon/react\n' ||
    E'1.114.0. Yang menghasilkan 28px adalah productive-heading-04. Ukuran benar, nama berubah --\n' ||
    E'bukti hidup kenapa dokumentasi wajib dibuka SAAT sesi, bukan dari ingatan.\n\n' ||
    E'=== FF.3 JARAK (seluruhnya token, nol angka langsung) ===\n' ||
    E'  antar item form $spacing-07 32px | bawah judul $spacing-08 40px |\n' ||
    E'  antar kolom $spacing-07 32px | atas tombol $spacing-09 48px\n' ||
    E'BENTUK YANG DIPILIH: form biasa, BUKAN fluid form. Alasan: 17 setelan berkelompok perlu\n' ||
    E'bernapas, bukan satu blok isian rapat.\n' ||
    E'SATU KOLOM DI PONSEL dijamin struktural: kolom kedua hanya muncul bila muat 20rem, jadi\n' ||
    E'di 360px selalu satu kolom TANPA satu pun media query yang bisa salah.\n\n' ||
    E'=== FF.4 HURUF KAPITAL ===\n' ||
    E'Diperbaiki: "Setelan perhitungan", "Periode & kalender kerja", "BPJS ditanggung\n' ||
    E'perusahaan", "Metode perhitungan biaya". Nama hari (Senin-Jumat, Sabtu) tetap kapital.\n\n' ||
    E'=== FF.6 ===\n' ||
    E'docs/governance/rujukan-carbon.md — ALAMAT halaman rujukan per jenis layar, bukan isinya.'
where task_code = 'DS-01';

update build_tasks set
  urgency = 'penting',
  notes = coalesce(notes || E'\n\n', '') ||
    E'DIRODUKSI DAN DIPERSEMPIT 25 Agu 2026, tapi sebabnya BELUM ketemu.\n\n' ||
    E'YANG GAGAL: "(BUKTI snapshot) mengambil snapshot 2x -> 2 baris tersimpan",\n' ||
    E'AssertionError: expected 1 to be 2.\n\n' ||
    E'YANG SUDAH DIPERIKSA, semuanya menutup satu kemungkinan:\n' ||
    E'  - Berjalan SENDIRIAN: LULUS 3 dari 3.\n' ||
    E'  - Bersama tetangganya (ai_readiness, kamus_module): LULUS 26 dari 26.\n' ||
    E'  - Di suite penuh: GAGAL.\n' ||
    E'  - takeAiProjectSnapshot memakai INSERT biasa -- nol upsert, nol onConflict.\n' ||
    E'  - Tabelnya TIDAK punya kekangan unik dan TIDAK punya pemicu apa pun.\n' ||
    E'  - Pembacanya (getAiProjectDashboard) murni SELECT, nol penghapusan.\n' ||
    E'  - TIDAK ADA berkas test lain yang menyentuh tabel itu.\n' ||
    E'  - Kedua panggilan mengembalikan 200, jadi kedua insert melaporkan berhasil.\n\n' ||
    E'Dua insert berhasil tapi hanya satu baris terbaca -- dan tidak satu pun mekanisme di atas\n' ||
    E'yang bisa menjelaskannya. Menebak sudah dicoba dan gagal.\n\n' ||
    E'YANG DILAKUKAN SEBAGAI GANTINYA: kegagalan BERIKUTNYA dibuat menjelaskan dirinya sendiri.\n' ||
    E'Pesan assertion sekarang mencetak status kedua panggilan DAN seluruh baris yang benar-benar\n' ||
    E'ada beserta waktunya, supaya terlihat apakah insert kedua tidak pernah mendarat atau justru\n' ||
    E'hilang sesudahnya. Ini bukan perbaikan -- ini membuat yang tak terlihat jadi terlihat.\n\n' ||
    E'PENTING UNTUK MEMBACA CI: kegagalan ini SUDAH ADA sebelum pekerjaan Carbon. Ia juga\n' ||
    E'menggagalkan commit da2915f4 yang isinya HANYA dokumen -- nol kode, nol test. Jadi CI merah\n' ||
    E'pada 4821e33 BUKAN akibat fondasi Carbon.'
where task_code = 'AUD-26';

end $$;
