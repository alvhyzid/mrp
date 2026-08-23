-- II.10 — kemungkinan lanjutan Daftar Tugas, SENGAJA BELUM DIBANGUN.
insert into build_tasks (
  company_id, task_code, name, module_code, module_name, description, effect_description,
  urgency, tags, pic, status, origin, detail_pekerjaan, ditunda_pemicu, notes
)
select 1, 'RDM-06',
  'Sembunyikan Task "Ditunda Sadar" secara Default di Daftar Tugas',
  'RDM', 'Roadmap Jangka Panjang',
  'Bila halaman Daftar Tugas masih terasa padat setelah berubah jadi tabel, langkah berikutnya BUKAN mengubah bentuknya lagi.',
  'Menjaga halaman tetap terbaca tanpa mengorbankan kelengkapan — task yang ditunda tetap ada, cuma tidak ikut memenuhi layar sehari-hari.',
  'tidak_mendesak',
  array['Visual']::text[],
  'Claude Code',
  'ditunda_sadar',
  'pemilik_produk',
  E'Sembunyikan task berstatus "Ditunda Sadar" secara default, dengan SATU tombol untuk menampilkannya ' ||
  E'kembali (dan jumlahnya tetap terlihat, supaya tidak terasa ada yang hilang).\n\n' ||
  E'ALASAN KENAPA INI JADI LANGKAH BERIKUTNYA, bukan mengubah bentuk lagi: daftar baru saja bertambah ' ||
  E'7 task SLS berstatus Ditunda Sadar, dan akan bertambah lagi. Yang membuat halaman padat bukan ' ||
  E'BENTUKNYA (sudah jadi tabel), melainkan JUMLAH baris yang memang tidak sedang dikerjakan siapa pun.',
  'Halaman Daftar Tugas terasa padat SETELAH perubahan ke bentuk tabel. Jangan dibangun sebelum itu terbukti.',
  'Dicatat 24 Agu 2026 bersama perubahan Daftar Tugas jadi tabel. Sengaja tidak dibangun sekarang: menambah cara menyembunyikan sebelum ada keluhan padat justru menyembunyikan hal yang mungkin ingin dilihat.'
where not exists (select 1 from build_tasks where task_code = 'RDM-06' and company_id = 1);
