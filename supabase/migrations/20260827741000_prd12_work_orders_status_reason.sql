-- PRD-12 -- alasan wajib untuk paused/cancelled disimpan di kolom sederhana
-- (bukan tabel riwayat terpisah) -- kebutuhannya cuma "alasan wajib diisi &
-- terlihat", BUKAN jejak tak-boleh-ditimpa seperti riwayat buka-kembali
-- (work_order_reopen_log, migrasi 20260827740000 -- itu beda kelas).
-- Nullable, ditimpa tiap transisi baru.
alter table public.work_orders add column if not exists status_reason text;
