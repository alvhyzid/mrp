-- Migration: tambah 'fat' (Finance/Accounting/Tax) dan 'rnd' ke constraint
-- employees_department_check -- ditemukan lewat data payroll nyata (Bagian C,
-- 21 Agu 2026): "Asni Damayati - FAT Spv" dan "Adhiskaprillia Nur Anissa - RnD
-- Staff" tidak cocok ke 7 department lama (constraint asli migration
-- 20260813120000). Constraint lama DIHAPUS lalu dibuat ulang dgn daftar
-- lengkap -- Postgres tidak punya ALTER CONSTRAINT untuk ganti definisi CHECK.
alter table employees drop constraint if exists employees_department_check;
alter table employees
  add constraint employees_department_check
  check (department in ('production', 'ppic', 'finance', 'purchasing', 'warehouse', 'hr', 'management', 'fat', 'rnd'));
