-- Migration FIXUP -- migration 20260821120000 (format_rupiah_id) tidak eksplisit
-- revoke dari public/anon/authenticated saat membuat fungsi baru, kena default
-- Postgres/Supabase (EXECUTE ke PUBLIC otomatis untuk fungsi baru) -- ketahuan
-- lewat tests/function_grant_security_audit.test.ts (instrumen pencegahan yang
-- SENGAJA dibuat gagal untuk kasus persis ini, bukan bug pada test-nya).
--
-- format_rupiah_id() TIDAK PERNAH perlu dipanggil langsung oleh user/anon --
-- cuma dipakai DI DALAM fungsi SECURITY DEFINER lain (mis.
-- upsert_margin_threshold_alert) untuk menyusun kalimat pesan alert. Least
-- privilege: cabut dari public/anon/authenticated, sisakan service_role saja
-- (sama seperti compute_production_batch_labor_cost, fungsi internal murni).
revoke execute on function public.format_rupiah_id(numeric) from public, anon, authenticated;
grant execute on function public.format_rupiah_id(numeric) to service_role;
