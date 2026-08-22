-- AA.4 -- catat task, JANGAN dikerjakan (instruksi eksplisit).
insert into public.build_tasks
  (company_id, task_code, name, module_code, module_name, description, effect_description, urgency, tags, pic, status, link_url, origin, detail_pekerjaan)
values (
  1, 'PMB-10', 'Halaman Cetak Dokumen PO Supplier', 'PMB', 'Pembelian',
  'PO Supplier belum punya halaman cetak/dokumen sama sekali -- berbeda dari Surat Jalan yang sudah punya cetakan lengkap (ditemukan saat menutup PMB-07c, 22 Agu 2026).',
  'PO Supplier dikirim ke pihak LUAR (supplier) -- tanpa dokumen cetak, tidak ada yang bisa dikirim/ditunjukkan ke supplier secara formal. Snapshot identitas supplier (PMB-07a, sudah selesai) baru benar-benar berguna setelah ada dokumen yang benar-benar mencetaknya -- saat ini snapshot itu tersimpan tapi tidak pernah ditampilkan di mana pun sebagai dokumen resmi.',
  'penting', array['Visual','Fungsi'], 'Claude Code', 'menunggu', '/purchasing', 'pemilik_produk',
  'Bangun halaman cetak PO Supplier (pola serupa halaman cetak Surat Jalan yang sudah ada) -- menampilkan snapshot identitas supplier (PMB-07a), lokasi/pabrik penerima (PMB-07c), baris item+qty+harga, tanggal PO, dan nomor PO.'
);
