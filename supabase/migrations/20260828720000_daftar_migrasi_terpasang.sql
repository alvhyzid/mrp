-- Pendaftar migrasi yang bisa dibaca pengawas test (25 Agu 2026).
--
-- KENAPA PERLU FUNGSI, bukan membaca tabelnya langsung: `supabase_migrations.schema_migrations`
-- hidup di skema yang TIDAK diekspos PostgREST, jadi klien Supabase tidak bisa membacanya
-- sama sekali. Pengawas migrasi tertinggal (tests/setup/assertMigrationsUpToDate.ts) sempat
-- ditulis membaca tabel itu langsung, gagal diam-diam, dan LOLOS tanpa memeriksa apa pun --
-- persis kelas "pengaman yang tidak berbunyi" yang sudah dicatat di CLAUDE.md.
--
-- Fungsinya HANYA MEMBACA daftar versi. Tidak mengembalikan isi migrasi, tidak mengubah apa pun.
create or replace function public.daftar_migrasi_terpasang()
returns setof text
language sql
security definer
set search_path = supabase_migrations, public
as $$
  select version from supabase_migrations.schema_migrations order by version
$$;

revoke all on function public.daftar_migrasi_terpasang() from public, anon, authenticated;
grant execute on function public.daftar_migrasi_terpasang() to service_role;
