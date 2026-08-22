-- Hapus total fungsi probe (20260827440000) setelah dibuktikan
-- tests/function_grant_security_audit.test.ts benar-benar gagal keras
-- terhadap fungsi tanpa revoke -- probe ini TIDAK PERNAH dimaksudkan permanen.
drop function if exists public._probe_inf07_no_revoke_test();
