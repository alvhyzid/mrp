-- Migration: work_order_assignments.actual_hours diperlebar dari numeric(6,2) ke
-- numeric(9,4) — ditemukan lewat acceptance test margin v1 (spesifikasi-aturan-biaya-
-- v1.md K10 "pembulatan HANYA di tampilan akhir"): kolom numeric(6,2) MEMBULATKAN
-- jam kerja saat DISIMPAN (mis. "20 menit" = 0,3333... jam TERSIMPAN sebagai 0,33 —
-- selisih ~Rp38 pada kasus nyata batch premix gelatin), bukan cuma saat ditampilkan.
-- Ini pelanggaran K10 yang nyata, bukan kosmetik. scheduled_hours diperlebar sama
-- (kolom sejenis, sama tabel) untuk konsistensi.
alter table if exists work_order_assignments alter column actual_hours type numeric(9,4);
alter table if exists work_order_assignments alter column scheduled_hours type numeric(9,4);
