-- Ditemukan TIDAK SENGAJA saat memverifikasi test suite penuh untuk Bagian
-- 1-3 (22 Agu 2026) -- tidak berhubungan dengan pekerjaan blok ini sama
-- sekali, dicatat supaya tidak hilang (AA.2).
insert into public.build_tasks
  (company_id, task_code, name, module_code, module_name, description, effect_description, urgency, tags, pic, status, origin, detail_pekerjaan)
values (
  1, 'ABS-05', 'tests/attendance_geo_qr_w1.test.ts Gagal Konsisten (401 di Semua Panggilan)', 'ABS', 'Absensi',
  'Seluruh 11 test di tests/attendance_geo_qr_w1.test.ts (Absensi Geo-QR Gelombang 1) gagal KONSISTEN (bukan flaky) -- setiap panggilan ke recordAttendanceEvent/getAttendanceDashboard/dst mengembalikan 401, bahkan untuk pemanggilan pertama yang seharusnya sukses murni.',
  'Modul Absensi Geo-QR Gelombang 1 tidak bisa diverifikasi otomatis sama sekali sampai ini diperbaiki -- risiko regresi diam-diam di modul ini tidak akan tertangkap CI.',
  'penting', array['Fungsi'], 'Claude Code', 'menunggu', 'temuan_claude',
  E'Dikonfirmasi PRE-EXISTING (bukan regresi dari pekerjaan Bagian 1-3 sesi ini) -- direproduksi ulang dengan `git stash` (seluruh perubahan sesi ini disingkirkan sementara), test TETAP gagal persis sama. Diagnosis awal (BELUM tuntas, di luar cakupan blok kerja saat ditemukan): alur auth DASAR (create user, login, verifikasi token via admin.auth.getUser) TERBUKTI bekerja normal saat dicoba manual di luar test ini -- jadi bukan auth infrastruktur mati total, kemungkinan besar spesifik ke cara recordAttendanceEvent.ts atau fixture test ini menyiapkan konteks (geofence plant, employees.linked_user_id, atau semacamnya). 2 baris company residu (AttendanceW1TestCorp x2, sisa dari percobaan reproduksi) sudah dibersihkan. Perlu investigasi kode langsung (bukan tebakan) sebelum diperbaiki.'
);
