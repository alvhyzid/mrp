-- Migration: perluas employees untuk menampung data payroll pabrik NYATA
-- (Perintah Gabungan A-F, Bagian C, 21 Agu 2026) -- sebelumnya employees cuma
-- punya position/department/wage_type/wage_rate generik dari data simulasi.
-- Kolom baru di bawah SEMUANYA nullable -- diisi bertahap sesuai data nyata
-- yang tersedia, TIDAK dipaksa lengkap semua baris sekaligus (mis. PTKP/TER
-- cuma diketahui untuk 5 dari 20 karyawan nyata pertama).

alter table employees add column if not exists factory_employee_code text;
alter table employees add column if not exists employment_status text check (employment_status in ('kontrak', 'phl', 'freelance'));
alter table employees add column if not exists ptkp_status text;
alter table employees add column if not exists ter_category text;
alter table employees add column if not exists ter_rate_percent numeric(5,2);
alter table employees add column if not exists daily_meal_allowance numeric(12,2);
alter table employees add column if not exists daily_transport_allowance numeric(12,2);
alter table employees add column if not exists bpjs_kesehatan_enrolled boolean;

comment on column employees.factory_employee_code is 'Kode karyawan pabrik dari data payroll nyata (mis. "2508001") -- nullable, karyawan freelance/tanpa kode resmi (mis. Darmini) tidak punya nilai ini.';
comment on column employees.employment_status is 'Status kepegawaian: kontrak/phl/freelance -- BEDA dari wage_type (skema pembayaran). PHL biasanya wage_type=daily, tapi keduanya independen (kontrak/freelance bisa juga wage_type apa saja).';
comment on column employees.ptkp_status is 'Status PTKP pajak (mis. "K/2", "TK/0") -- nullable, belum tentu diketahui untuk semua karyawan.';
comment on column employees.ter_category is 'Kategori golongan TER PPh21 (mis. "TER A", "TER B") -- nullable.';
comment on column employees.ter_rate_percent is 'Tarif TER PPh21 dalam persen (mis. 8.00 untuk 8%) -- nullable.';
comment on column employees.daily_meal_allowance is 'Tunjangan makan per hari HADIR, Rupiah -- disimpan PER KARYAWAN (bukan hardcode per jabatan di kode), nullable sampai dikonfirmasi.';
comment on column employees.daily_transport_allowance is 'Tunjangan transport per hari HADIR, Rupiah -- disimpan PER KARYAWAN, nullable sampai dikonfirmasi.';
comment on column employees.bpjs_kesehatan_enrolled is 'Keikutsertaan BPJS Kesehatan -- TIDAK didefault true/false, NULL berarti belum dikonfirmasi (bukan berarti tidak ikut).';
