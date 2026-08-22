-- Hapus fungsi probe sementara (20260827580000) setelah selesai dipakai
-- mendiagnosis debug_force_delete_company().
drop function if exists public._probe_constraint_lookup(text);
