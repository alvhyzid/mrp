-- BAGIAN 3 (22 Agu 2026) -- arkeologi PO Supplier/goods receipt menemukan
-- alur INTI sudah lengkap sejak PMB-01 (konversi UOM, harga lot dari
-- transaksi PO bukan harga acuan, sisa PO per baris -- semua sudah bekerja,
-- dibuktikan ulang di tests/bagian3_po_supplier_goods_receipt.test.ts).
-- 1 celah nyata ditemukan+ditambal: createPurchaseOrder.ts tidak menolak
-- supplier yang sudah diarsipkan (pola sama seperti PMB-07c untuk plant
-- nonaktif) -- sekarang ditolak dengan pesan jelas.
update public.build_tasks
set notes = coalesce(notes || E'\n\n', '') || 'BAGIAN 3 (22 Agu 2026): dikonfirmasi ulang alur ini masih bekerja penuh + 1 celah ditambal (supplier diarsipkan sekarang ditolak di createPurchaseOrder.ts, dulu tidak dicek sama sekali). 1 pertanyaan terbuka BELUM dijawab (BUKAN diputuskan sepihak): perilaku penerimaan barang MELEBIHI qty yang dipesan pada 1 baris PO -- saat ini tidak ada validasi/penolakan sama sekali (beda dari over-shipment Sales Order yang sudah eksplisit ditolak sejak Sesi 3A). Ditanyakan ke pemilik produk terpisah.'
where task_code = 'PMB-01';
