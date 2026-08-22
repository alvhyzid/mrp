-- BAGIAN 3 -- keputusan pemilik produk soal over-receipt SUDAH DIJAWAB
-- (izinkan + peringatan + catat, BUKAN gerbang keras) dan SUDAH
-- diimplementasikan (goods_receipt_overage_log + warnings di response
-- createGoodsReceipt.ts). Perbarui catatan PMB-01 dari "pertanyaan
-- terbuka" jadi "sudah dijawab & dibangun".
update public.build_tasks
set notes = notes || E'\n\nDIJAWAB & DIBANGUN 22 Agu 2026: over-receipt DIIZINKAN + peringatan angka persis + tercatat di goods_receipt_overage_log (siapa/kapan/qty dipesan/qty diterima total/qty lebih) -- alasan: barang sudah ada fisik di gudang, menolak cuma bikin tidak tercatat; kelebihan menyangkut uang (tagihan supplier), Finance perlu tahu. Layar daftar kelebihan BELUM dibangun (menunggu cetakan UX). Dibuktikan tests/bagian3_po_supplier_goods_receipt.test.ts (6/6 lulus, termasuk kasus tanpa kelebihan -> tanpa warning/baris log).'
where task_code = 'PMB-01';
