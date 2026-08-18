-- Migration: PERBAIKAN KEAMANAN — propose_production_standard() dan
-- decide_production_standard_proposal() (migration 20260819110000) ternyata
-- BISA dipanggil langsung oleh anon key TANPA autentikasi sama sekali.
--
-- Akar masalah: Postgres SECARA DEFAULT memberi EXECUTE ke PUBLIC untuk fungsi
-- baru. `grant execute on function ... to service_role;` di migration
-- sebelumnya HANYA MENAMBAH grant untuk service_role -- TIDAK MENCABUT grant
-- PUBLIC yang sudah ada secara default. Dibuktikan lewat percobaan sungguhan
-- (bukan asumsi): panggil decide_production_standard_proposal() pakai ANON KEY
-- murni (tanpa login apa pun) -- fungsi BENAR-BENAR JALAN (exception bisnis
-- normal muncul, bukan permission denied), berarti siapa pun yang tahu
-- proposal_id bisa mengesahkan/menolak usulan standar produksi DAN memalsukan
-- p_user_id (kolom decided_by) jadi user manapun, sama sekali melewati gerbang
-- role canDecideProductionStandardProposal di app layer.
--
-- PERBAIKAN: cabut EXECUTE dari PUBLIC secara eksplisit (plus anon/authenticated
-- untuk jelasnya), sisakan HANYA service_role -- konsisten dengan niat awal
-- migration 20260819110000 ("GRANT EXECUTE fungsi-fungsi itu SENGAJA hanya ke
-- service_role"), yang ternyata tidak benar-benar tercapai tanpa REVOKE ini.
revoke execute on function public.propose_production_standard(integer, integer, integer, text, numeric) from public;
revoke execute on function public.propose_production_standard(integer, integer, integer, text, numeric) from anon;
revoke execute on function public.propose_production_standard(integer, integer, integer, text, numeric) from authenticated;

revoke execute on function public.decide_production_standard_proposal(integer, text, integer) from public;
revoke execute on function public.decide_production_standard_proposal(integer, text, integer) from anon;
revoke execute on function public.decide_production_standard_proposal(integer, text, integer) from authenticated;
