-- Bersihkan catatan "default sementara, mohon dikoreksi" di RBD-01/RBD-02a
-- yang sudah basi setelah urgensinya dikoreksi eksplisit oleh pemilik produk
-- (migrasi 20260827370000). Diterapkan lewat migrasi (bukan update langsung)
-- supaya tetap reproducible dari rebuild-from-migrations.
update build_tasks
set notes = 'Urgensi dikoreksi pemilik produk 22 Agu 2026 menjadi Bisa Menunggu (lihat riwayat urgensi) -- default sementara sebelumnya sudah tidak berlaku.'
where task_code in ('RBD-01', 'RBD-02a');
