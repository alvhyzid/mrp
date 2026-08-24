-- GG.3 / GG.4 / GG.6 — log CI tak terbaca, kegoyahan test, dan urgensi INF-18.

insert into build_tasks (
  company_id, task_code, name, module_code, module_name, description, effect_description,
  urgency, tags, pic, status, origin, detail_pekerjaan, notes
)
select 1, 'INF-21',
  'Log Kegagalan CI Tidak Bisa Dibaca (HTTP 403) — Tulis Ringkasannya, Jangan Tambah Hak Akses',
  'INF', 'Infrastruktur & Environment',
  'Mengunduh log run GitHub Actions selalu ditolak HTTP 403 karena butuh hak admin repo. Saat CI merah, tidak ada cara mengetahui test mana yang gagal.',
  'Setiap kali CI merah, diagnosis dimulai dari nol dan berlangsung berjam-jam. Ini sudah beberapa kali jadi penghambat, termasuk hari ini pada commit d7cba8e yang gagal tanpa bisa diketahui sebabnya.',
  'penting',
  array['ci','proses']::text[],
  'Claude Code',
  'menunggu',
  'temuan_claude',
  E'DUA JALAN, dan yang KEDUA lebih baik:\n' ||
  E'  (a) Pemilik produk memberi hak yang cukup untuk membaca log Actions.\n' ||
  E'  (b) Workflow CI MENULISKAN SENDIRI ringkasan kegagalan ke tempat yang bisa dibaca tanpa hak admin.\n\n' ||
  E'KENAPA (b) LEBIH BAIK: tidak menambah hak akses sama sekali, dan hasilnya JAUH LEBIH RINGKAS ' ||
  E'daripada log penuh — yang dibutuhkan cuma "berkas apa yang gagal dan pesannya apa", bukan ribuan ' ||
  E'baris keluaran.\n\n' ||
  E'BENTUK YANG DIUSULKAN: langkah CI `if: always()` yang membaca test-results.json (SUDAH dihasilkan ' ||
  E'`npm run test:ci`) lalu menuliskan daftar berkas gagal + pesan pertama tiap kegagalan ke ' ||
  E'$GITHUB_STEP_SUMMARY. Ringkasan step terbaca oleh siapa pun yang bisa melihat halaman run, TANPA ' ||
  E'hak admin dan TANPA mengunduh apa pun.\n' ||
  E'Tambahan murah: unggah test-results.json sebagai artifact, supaya angkanya bisa diperiksa ulang.\n\n' ||
  E'JANGAN DIKERJAKAN SEBELUM CI BERES — memperbaiki alat diagnosis saat sedang butuh diagnosis akan ' ||
  E'mencampur dua sebab kegagalan.',
  'Dicatat 24 Agu 2026 setelah CI d7cba8e gagal dan log-nya tidak bisa diunduh (403), sehingga penyebabnya tidak bisa dipastikan.'
where not exists (select 1 from build_tasks where task_code = 'INF-21' and company_id = 1);

-- GG.4 — AUD-21 diperbarui dengan RINCIAN kedua kejadian.
update build_tasks
set detail_pekerjaan = detail_pekerjaan || E'\n\n' ||
      E'RINCIAN DUA KEJADIAN DALAM SATU HARI (24 Agu 2026) — dicatat karena kegoyahan itu SENDIRI ' ||
      E'temuannya, bukan latar belakang:\n\n' ||
      E'  KEJADIAN 1 — tests/ai_project_dashboard.test.ts\n' ||
      E'    Gejala: 4 test gagal. HTTP 404 pada endpoint yang seharusnya menemukan tugas hasil seed, ' ||
      E'dan snapshot terhitung 0 padahal seharusnya 2.\n' ||
      E'    Arah gejala: baris hasil seed TIDAK ADA saat berkas itu berjalan.\n\n' ||
      E'  KEJADIAN 2 — tests/baseline_lock_separation.test.ts\n' ||
      E'    Gejala: mati di beforeAll, "TypeError: Cannot read properties of null (reading id)".\n' ||
      E'    Arah gejala: objek yang seharusnya ada (pengguna auth hasil createUser/listUsers) ternyata null.\n\n' ||
      E'  KEDUANYA: lulus penuh saat dijalankan SENDIRI, dan suite berikutnya hijau TANPA perubahan kode.\n\n' ||
      E'APAKAH SEBABNYA SAMA? Belum terbukti, tapi ARAHNYA sama: sesuatu yang seharusnya sudah ada ' ||
      E'ternyata tidak ada saat berkas itu berjalan DI DALAM suite. Itu ciri masalah ISOLASI, bukan ' ||
      E'bug di salah satu berkas.\n\n' ||
      E'DUGAAN YANG SUDAH GUGUR (jangan diulang): pengguna auth menumpuk melewati batas 100 pada pola ' ||
      E'listUsers({perPage:100, page:1}) yang dipakai 23 berkas test. Diperiksa langsung: hanya 8 ' ||
      E'pengguna auth di project CI. GUGUR — tapi polanya tetap rapuh dan layak diperbaiki terpisah.\n\n' ||
      E'KENAPA INI MENDESAK: test goyah LEBIH BERBAHAYA daripada test gagal, karena orang belajar ' ||
      E'mengabaikan merahnya — dan suatu saat merah yang SUNGGUHAN ikut diabaikan.'
where task_code = 'AUD-21' and company_id = 1;

-- GG.6 — INF-18 naik urgensi.
update build_tasks
set urgency = 'super_urgent',
    super_urgent_since = now(),
    notes = coalesce(notes,'') || E'\n\n' ||
      '24 Agu 2026 — urgensi dinaikkan ke SUPER URGENT. ALASANNYA sebuah kejadian nyata hari ini: ' ||
      'suite lokal HIJAU, di-push sesuai prosedur, lalu CI MERAH — dan pekerjaan itu SUDAH TAYANG ke ' ||
      'situs berisi data nyata sebelum siapa pun tahu ada yang gagal. Prosedurnya diikuti dengan benar; ' ||
      'PROSEDURNYA SENDIRI yang punya celah selama `main` berarti rilis langsung. Selama production ' ||
      'menerbitkan dari main, setiap push adalah rilis, dan "lokal hijau" bukan jaminan apa pun. ' ||
      'Yang menyelamatkan hari ini cuma kebetulan: PT ITM belum punya satu pun lot, jadi perubahan ' ||
      'stok tidak menyentuh angka siapa pun.'
where task_code = 'INF-18' and company_id = 1;
