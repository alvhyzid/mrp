-- Migration: nomor batch produksi -- pola "rekomendasi + bisa diubah" (keputusan
-- pemilik produk, 20 Agu 2026): staf boleh menimpa nomor batch otomatis dengan
-- format pabrik sendiri (mis. "3TM13082601"), TAPI keunikannya harus dijaga per
-- PERUSAHAAN (bukan cuma per Work Order seperti sekarang) -- begitu nomor bebas
-- diisi manusia, tabrakan lintas Work Order jadi mungkin terjadi sungguhan.
--
-- AMAN diterapkan: dicek dulu (skrip verifikasi terpisah, bukan bagian migration
-- ini) -- 0 dari 7 baris production_batches yang ada sekarang bentrok kalau
-- keunikannya dipersempit ke per-company (semuanya masih pakai format otomatis
-- lama yang sudah menyertakan work_order_id, jadi otomatis unik). Nomor batch
-- LAMA tidak diubah sama sekali oleh migration ini.
alter table production_batches drop constraint if exists production_batches_work_order_id_batch_number_key;
alter table production_batches add constraint production_batches_company_id_batch_number_key unique (company_id, batch_number);
