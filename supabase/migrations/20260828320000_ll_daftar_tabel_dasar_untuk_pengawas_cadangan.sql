-- LL / BAGIAN 2 (24 Agu 2026) — FUNGSI PENDAFTAR TABEL DASAR, untuk pengawas
-- kelengkapan daftar pencadangan.
--
-- KENAPA INI PERLU. Daftar tabel yang dicadangkan (`backup-table-list.txt`) DITULIS
-- TANGAN. Diperiksa hari ini: database punya 90 tabel dasar, daftarnya memuat 87 —
-- TIGA tabel tidak pernah ikut tercadangkan, dan dua di antaranya justru yang paling
-- tidak boleh hilang:
--   - `data_change_audit_log`              jejak siapa mengubah apa
--   - `employee_cost_category_history`     riwayat penggolongan biaya karyawan, yang
--                                          menurut CLAUDE.md adalah JEJAK WAJIB
--                                          pengganti alur persetujuan Finance
--   - `tenant_picklists`
--
-- Tidak ada yang salah pada orang yang menulis daftar itu. Yang salah adalah bentuk
-- pengamannya: daftar tangan yang harus diingat untuk diperbarui setiap kali ada tabel
-- baru. Kelas yang sama sudah menggigit di tempat lain proyek ini, dan obatnya sama —
-- ganti disiplin dengan struktur yang memeriksa sendiri.
--
-- KENAPA TIDAK MENEMUKAN TABEL LEWAT PostgREST SAJA (sudah dicoba, ditolak): daftar
-- PostgREST memuat 97 entri karena VIEW ikut terbawa (`items_secure`, `lots_secure`,
-- `work_orders_readiness`, dst). View adalah turunan, bukan data — mencadangkannya
-- berarti menyimpan salinan yang sama dua kali dan membuat pemulihan membingungkan.
-- Fungsi di bawah menyaring tepat pada `BASE TABLE`.
--
-- DI LUAR JANGKAUAN FUNGSI INI (aturan II.2):
--   - Hanya melihat schema `public`. Tabel di `auth`, `storage`, atau schema lain
--     tidak terlihat sama sekali — dan memang bukan wilayah pencadangan aplikasi.
--   - Menyebut NAMA tabel, bukan isinya. Tabel yang terdaftar tapi gagal diekspor
--     tetap di luar jangkauan; itu tugas ringkasan hasil ekspor, bukan fungsi ini.

create or replace function debug_list_base_tables()
returns table(table_name text)
language sql
stable
security definer
set search_path = public
as $$
  select t.table_name::text
  from information_schema.tables t
  where t.table_schema = 'public'
    and t.table_type = 'BASE TABLE'
  order by t.table_name;
$$;

-- SECURITY DEFINER dengan gerbang yang KETAT. Fungsi ini membaca information_schema,
-- jadi ia tidak boleh terbuka untuk `anon`/`authenticated` — ia akan membeberkan
-- seluruh peta tabel ke siapa pun yang login, termasuk penyewa lain. Hanya service_role
-- (dipakai pengawas test dan skrip pencadangan) yang boleh memanggilnya.
revoke execute on function debug_list_base_tables() from public, anon, authenticated;
grant execute on function debug_list_base_tables() to service_role;

comment on function debug_list_base_tables() is
  'Menyebut seluruh tabel DASAR di schema public (view sengaja dikecualikan). Dipakai '
  'pengawas kelengkapan backup-table-list.txt supaya daftar itu berhenti bergantung pada '
  'ingatan manusia. Hanya service_role.';
