-- Dua temuan lanjutan jadi task (aturan: temuan tanpa task = temuan yang tidak pernah ditulis).

insert into build_tasks (
  company_id, task_code, name, module_code, module_name, description, effect_description,
  urgency, tags, pic, status, origin, detail_pekerjaan, notes
)
select 1, d.kode, d.nama, 'AUD', 'Audit & Proses', d.deskripsi, d.efek, d.urgensi,
  d.tags, 'Claude Code', 'menunggu', 'temuan_claude', d.detail, d.catatan
from (values
(
  'AUD-20',
  'Fitur yang Gagal di Percobaan Pertama karena Data Pendukungnya Kosong di Tenant',
  'Sebuah fitur bisa selesai dibangun, lulus seluruh test, dan tetap gagal saat pertama kali dipakai — bukan karena kodenya salah, melainkan karena daftar/kategori yang jadi tumpuannya belum terisi untuk tenant itu.',
  'Pemilik produk mencoba fitur baru, gagal, dan menyimpulkan fiturnya rusak. Kepercayaan pada sistem turun karena sesuatu yang sebenarnya cuma data pendukung yang belum diisi.',
  'penting',
  array['Data','proses']::text[],
  E'KEJADIAN NYATA yang melahirkan task ini (24 Agu 2026, saat MST-17): ke-9 jenis dokumen yang ' ||
  E'terdaftar semuanya milik Company B (tenant uji), sementara PT ITM — pemilik SELURUH item nyata — ' ||
  E'tidak punya satu pun. Karena unggahan menolak jenis yang tidak terdaftar, fitur dokumen sudah ' ||
  E'terbangun tapi TIDAK BISA DIPAKAI tenant yang benar. Sudah diperbaiki untuk kasus itu.\n\n' ||
  E'SAPUAN AWAL SUDAH DILAKUKAN, hasilnya melegakan: setelah document_types diperbaiki, TIDAK ADA ' ||
  E'lagi tabel yang berpola "kosong untuk PT ITM tapi terisi untuk perusahaan lain". Dua tabel ' ||
  E'katalog kosong untuk SEMUA perusahaan:\n' ||
  E'- routing_step_standard_crew (0 baris) — dipakai computeStandardLaborCostPerUnit. SUDAH tercatat ' ||
  E'sebagai MST-11. Kabar baiknya, kode itu MENURUNKAN DIRI DENGAN JUJUR saat kosong ("belum punya ' ||
  E'routing — SDM level ini tidak dihitung"), bukan diam-diam menghasilkan nol.\n' ||
  E'- formula_templates (0 baris) — hanya dirujuk src/lib/glossary.ts, risiko rendah.\n\n' ||
  E'YANG DIKERJAKAN DI TASK INI: buat daftar periksa "data pendukung minimum per tenant" dan ' ||
  E'jalankan sebelum menyatakan sebuah fitur selesai. Terkait langsung INF-20 (apa saja yang tidak ' ||
  E'ada bila sistem dibangun dari nol) dan PLT-05 (daftar pilihan milik tenant) — pertimbangkan ' ||
  E'menggabungkannya, jangan tiga daftar terpisah yang isinya beririsan.',
  'Ditemukan 24 Agu 2026 saat MST-17. Kelasnya berbeda dari bug biasa: kodenya benar, test-nya hijau, dan tetap gagal dipakai.'
),
(
  'AUD-21',
  'tests/ai_project_dashboard.test.ts Goyah di Suite Penuh, Lulus Saat Sendiri',
  'Berkas ini gagal 4 test di satu run suite penuh (404 = fixture tidak ketemu, snapshot 0 baris), lalu lulus 7/7 saat dijalankan sendiri, lalu hijau lagi di run suite berikutnya tanpa ada perubahan kode.',
  'Test goyah lebih berbahaya daripada test merah: ia melatih orang mengabaikan kegagalan. Sekali kebiasaan "coba jalankan lagi" terbentuk, kegagalan yang SUNGGUHAN ikut terabaikan.',
  'penting',
  array['test','ci']::text[],
  E'GEJALA PERSIS (24 Agu 2026): 404 pada endpoint yang seharusnya menemukan tugas hasil seed, dan ' ||
  E'snapshot terhitung 0 padahal seharusnya 2. Keduanya menunjuk ke arah yang sama: baris hasil seed ' ||
  E'TIDAK ADA saat test berjalan.\n\n' ||
  E'DUGAAN YANG BELUM DIBUKTIKAN, jangan dipercaya sebelum diperiksa: pembersihan fixture dari berkas ' ||
  E'test LAIN ikut menghapus baris milik berkas ini, karena seluruh berkas berjalan berurutan dalam ' ||
  E'SATU proses pekerja terhadap SATU database.\n\n' ||
  E'CARA MEMERIKSA yang disarankan: jalankan suite penuh dengan pencatatan urutan berkas, lalu ' ||
  E'periksa berkas mana yang berjalan TEPAT SEBELUM ai_project_dashboard pada run yang gagal. ' ||
  E'Bandingkan pembersihannya. JANGAN memperbaiki dengan menambah jeda atau mengulang test — itu ' ||
  E'menyembunyikan, bukan menyelesaikan.',
  'Ditemukan 24 Agu 2026. Suite penuh dijalankan 3x hari itu: hijau, MERAH (4 gagal), hijau — tanpa ada perubahan kode di antaranya.'
)
) as d(kode, nama, deskripsi, efek, urgensi, tags, detail, catatan)
where not exists (select 1 from build_tasks b where b.task_code = d.kode and b.company_id = 1);
