-- SEC-23 — PENGAWAS POLA, supaya kelasnya tidak lahir lagi.
--
-- Dua lubang keamanan di proyek ini berasal dari pola yang sama di gerbang berbeda:
--   if not public.jwt_xxx()   ->  NULL saat klaimnya tidak ada
--   if NULL then ... end if   ->  TIDAK PERNAH dieksekusi, gerbangnya DILEWATI
--
-- Yang pertama ditemukan lewat pemanggil anon. Yang kedua ditemukan SETELAH yang
-- pertama dilaporkan tertutup -- lewat sesi yang membawa company_id tetapi tidak
-- membawa app_role. Menambal fungsi satu per satu jelas tidak menutup kelasnya.
--
-- Tampilan ini menyisir SELURUH fungsi, sehingga fungsi ke-70 yang ditulis bulan
-- depan ikut tertangkap tanpa siapa pun perlu mengingat aturannya.
--
-- prokind='f' WAJIB: pg_get_functiondef() melempar galat untuk fungsi agregat, dan
-- galat itu sempat terlihat seperti kegagalan migrasi padahal kegagalan pemeriksaan.
create or replace view public.pg_proc_risiko_null as
select p.proname as nama_fungsi,
       p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prokind = 'f'
  and pg_get_functiondef(p.oid) ~ 'if not public[.]jwt_';

comment on view public.pg_proc_risiko_null is
  'Fungsi yang gerbangnya GAGAL TERBUKA saat klaim JWT bernilai NULL. Harus selalu KOSONG. Dijaga tests/matriks_keamanan_sales.test.ts butir (11).';

revoke all on public.pg_proc_risiko_null from public;
revoke all on public.pg_proc_risiko_null from anon;
revoke all on public.pg_proc_risiko_null from authenticated;
