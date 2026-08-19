-- Fixup migration 20260823090000: trigger attendance_events_no_update/
-- attendance_events_no_delete memblokir UPDATE/DELETE TANPA KECUALIAN, termasuk
-- dari service_role -- ini LEBIH KETAT daripada pola "ledger" yang sudah
-- berlaku di seluruh proyek ini (status_transition_log TIDAK punya trigger
-- semacam ini; sifat append-only-nya murni disiplin aplikasi: tidak ada
-- fungsi server yang pernah memanggil .update()/.delete() padanya, dan RLS
-- default-deny utk authenticated). Trigger keras ini bahkan membuat
-- pembersihan data test company sendiri via service role gagal (FK
-- companies<-attendance_events tidak bisa dilepas). Diperbaiki dgn pola yang
-- SAMA seperti status_transition_log: hapus trigger, andalkan RLS
-- default-deny + disiplin "tidak ada server function yang menulis ulang
-- event" (dibuktikan tests/attendance_geo_qr_w1.test.ts).

drop trigger if exists attendance_events_no_update on attendance_events;
drop trigger if exists attendance_events_no_delete on attendance_events;
drop function if exists public.attendance_events_prevent_mutation();
