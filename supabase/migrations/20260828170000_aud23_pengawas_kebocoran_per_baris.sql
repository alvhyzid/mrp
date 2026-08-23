insert into build_tasks (
  company_id, task_code, name, module_code, module_name, description, effect_description,
  urgency, tags, pic, status, origin, detail_pekerjaan, notes
)
select 1, 'AUD-23',
  'Pengawas Kebocoran Identifier Memeriksa PER BARIS — Merapikan Format Bisa Membuatnya Merah',
  'AUD', 'Audit & Proses',
  'tests/ui_raw_leak_watchdog.test.ts memutuskan aman/tidaknya sebuah pemakaian field berdasarkan APA YANG ADA DI BARIS YANG SAMA. Salah satu penanda amannya adalah kata "label". Akibatnya, memecah satu baris JSX jadi beberapa baris bisa membuat pengawas ini MERAH tanpa ada perubahan arti sama sekali.',
  'Positif palsu melatih orang menambahkan pengecualian supaya hijau lagi. Setiap pengecualian yang ditambah tanpa alasan nyata memperkecil daya tangkap pengawas ini terhadap kebocoran yang SUNGGUHAN.',
  'bisa_menunggu',
  array['test','ui']::text[],
  'Claude Code',
  'menunggu',
  'temuan_claude',
  E'KEJADIAN NYATA (24 Agu 2026, saat Daftar Tugas diubah jadi tabel): baris\n' ||
  E'  <Badge variant={STATUS_BADGE[t.status]} className={STATUS_EXTRA_CLASS[t.status]}>{STATUS_LABELS[t.status]}</Badge>\n' ||
  E'dipecah jadi tiga baris agar lebih terbaca. Yang ditampilkan tetap STATUS_LABELS (sudah manusiawi), ' ||
  E'dan t.status cuma jadi kunci pencarian warna — tidak ada yang bocor. Tapi karena STATUS_LABELS ' ||
  E'pindah ke baris lain, baris <Badge> kehilangan penanda "label" dan dilaporkan sebagai KEBOCORAN.\n\n' ||
  E'PENANGANAN SEMENTARA yang dipakai sekarang: dikembalikan ke satu baris, dengan komentar di kodenya ' ||
  E'yang menjelaskan KENAPA formatnya begitu — supaya tidak "dirapikan" lagi oleh sesi berikutnya.\n\n' ||
  E'PILIHAN PERBAIKAN, pilih setelah dipikirkan, jangan langsung yang termudah:\n' ||
  E'a. Perluas jendela pemeriksaan ke seluruh elemen JSX (bukan satu baris) — paling benar, paling mahal.\n' ||
  E'b. Kenali pola indeks `MAP[x.field]` sebagai aman, karena yang dirender adalah nilai peta, bukan fieldnya.\n' ||
  E'c. Biarkan apa adanya dan andalkan komentar di kode.\n\n' ||
  E'CATATAN PENTING bila memilih (b): pastikan tidak sekaligus memaafkan `{x.field}` telanjang. ' ||
  E'Melonggarkan pengawas sampai ia berhenti menangkap apa pun jauh lebih buruk daripada positif palsu ' ||
  E'sesekali.',
  'Ditemukan 24 Agu 2026. Menarik karena pengawasnya BEKERJA SESUAI RANCANGAN — yang kurang adalah rancangannya berbasis baris, bukan berbasis elemen. Ini bukan bug, melainkan batas yang baru kelihatan saat ditabrak.'
where not exists (select 1 from build_tasks where task_code = 'AUD-23' and company_id = 1);
