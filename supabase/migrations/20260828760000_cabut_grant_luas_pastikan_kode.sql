-- Menutup temuan audit grant fungsi (25 Agu 2026).
--
-- `pastikan_kode_task_kosong` dibuat bersama penjaga kode task dan LUPA dicabut grant
-- luasnya, jadi PUBLIC/anon/authenticated bisa memanggilnya. Terlihat oleh
-- tests/function_grant_security_audit.test.ts begitu project uji menerima migrasi yang
-- tertinggal -- bukan temuan baru, melainkan temuan lama yang selama ini tidak terlihat
-- karena test-nya berjalan di atas database yang belum punya fungsinya.
--
-- DAMPAK NYATANYA KECIL, dan disebut apa adanya supaya tidak dikira lebih besar: fungsinya
-- BUKAN SECURITY DEFINER, jadi pemanggil anonim tetap tunduk RLS build_tasks dan tidak bisa
-- melihat apa pun. Yang dicabut di sini adalah kelasnya, bukan kebocoran yang sedang terjadi.
--
-- Yang memanggilnya hanya migrasi, yang berjalan sebagai pemilik database.
revoke all on function public.pastikan_kode_task_kosong(text) from public, anon, authenticated;
grant execute on function public.pastikan_kode_task_kosong(text) to service_role;
