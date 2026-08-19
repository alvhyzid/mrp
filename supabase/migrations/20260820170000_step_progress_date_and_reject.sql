-- Migration: 2 gap blocker pemakaian harian dari investigasi laporan produksi
-- nyata (20 Agu 2026) — pencatatan progres tahap lintas hari (pola NORMAL di
-- pabrik, bukan pengecualian) dan reject per tahap (terpisah dari susut proses
-- biasa).
--
-- qty_reject: jumlah barang REJECT/cacat di tahap ini -- terpisah dari susut
-- proses biasa (qty_input - qty_recorded yang sudah ada). qty_recorded TETAP
-- berarti "output BAIK/terpakai" (perilaku lama, tidak berubah) -- qty_reject
-- murni field TAMBAHAN yang menjelaskan SEBAGIAN dari total susut itu memang
-- reject, bukan sekadar penguapan/proses. reject_reason opsional (kategori
-- bebas teks, pemilik produk belum punya daftar kategori baku).
alter table work_order_step_progress add column if not exists qty_reject numeric(14,4);
alter table work_order_step_progress add column if not exists reject_reason text;
