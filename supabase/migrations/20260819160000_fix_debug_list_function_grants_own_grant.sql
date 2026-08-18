-- Migration: memperbaiki grant debug_list_function_grants() SENDIRI -- ironisnya
-- membuat kesalahan yang SAMA PERSIS yang sedang ditambal audit ini: migration
-- 20260819140000 dan 150000 menulis "revoke all ... from public" (bukan
-- eksplisit "from public, anon, authenticated"), jadi anon/authenticated TETAP
-- EXECUTE lewat default privileges platform Supabase -- ditemukan otomatis oleh
-- test regresi tests/function_grant_security_audit.test.ts begitu ditulis
-- (bukti nyata kenapa test itu perlu ada).
revoke execute on function public.debug_list_function_grants() from public, anon, authenticated;
grant execute on function public.debug_list_function_grants() to service_role;
