-- PROBE SEMENTARA (Bagian 2 SAPU ULANG REVOKE, 22 Agu 2026) -- fungsi ini
-- SENGAJA dibuat TANPA revoke dari public/anon/authenticated untuk
-- membuktikan tests/function_grant_security_audit.test.ts benar-benar bisa
-- gagal keras terhadap kasus persis ini (bukan cuma lolos karena kebetulan).
-- DIHAPUS TOTAL oleh migrasi berikutnya (20260827450000) setelah dibuktikan
-- merah -- TIDAK PERNAH dimaksudkan untuk permanen.
create or replace function public._probe_inf07_no_revoke_test()
returns text
language sql
security definer
set search_path = public, pg_catalog
as $$
  select 'probe -- akan dihapus'::text;
$$;
