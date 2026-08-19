-- Migration: 2 kolom kecil di employees, ongkos rendah (prinsip baru pemilik
-- produk 21 Agu 2026 -- bangun utk kebutuhan nyata PT Indo Taste, bukan
-- abstraksi generik). Ditemukan dari data payroll nyata: basis iuran BPJS
-- TIDAK selalu = clamp(gaji, floor, ceiling) tenant -- Dimas (gaji Rp7.500.000)
-- pakai basis Rp6.500.000, Bayu (gaji Rp14.000.000) pakai basis Rp8.000.000 --
-- keduanya BEDA dari hasil clamp formula. Mayoritas karyawan lain kebetulan
-- PERSIS cocok formula clamp (makanya formula lama tidak salah, cuma tidak
-- lengkap utk 2 kasus ini).
alter table employees add column if not exists bpjs_contribution_basis numeric(14,2);
comment on column employees.bpjs_contribution_basis is 'Basis iuran BPJS (Kesehatan+JKK+JKM+JHT) PER ORANG -- nullable, override manual utk kasus yang beda dari clamp(wage_rate, floor, ceiling) tenant. NULL = pakai formula clamp seperti biasa.';

alter table employees add column if not exists allowance_frequency text not null default 'daily' check (allowance_frequency in ('daily', 'monthly_fixed'));
comment on column employees.allowance_frequency is 'daily = tunjangan makan/transport dikalikan hari hadir (default, mayoritas karyawan). monthly_fixed = nilai tunjangan adalah jumlah TETAP per bulan terlepas kehadiran (ditemukan dari data nyata: GM dapat Rp500rb makan + Rp500rb transport tetap per bulan, bukan per hari).';
