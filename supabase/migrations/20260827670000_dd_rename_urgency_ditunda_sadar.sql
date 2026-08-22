-- DD.1/DD.2 -- bug ditemukan pemilik produk: kartu task menampilkan
-- "Selesai" (status) berdampingan dengan "Ditunda Sadar" (urgensi) --
-- terlihat kontradiktif karena KEDUA skala (status & urgency) punya nilai
-- 'ditunda_sadar' dengan label tampilan yang PERSIS SAMA ("Ditunda Sadar").
-- Dikonfirmasi: 51 task berstatus 'selesai' + urgency 'ditunda_sadar' (jadi
-- terbaca "Selesai" + "Ditunda Sadar" berdampingan, kontradiktif), 21 task
-- lain statusnya JUGA 'ditunda_sadar' (jadi label muncul dobel, sama tapi
-- redundan). Total 72 baris terdampak.
--
-- Keputusan arsitek: "Ditunda Sadar" hanya milik skala STATUS. Skala
-- URGENSI, tingkat paling bawah diganti namanya jadi "Tidak Mendesak"
-- (nilai data 'tidak_mendesak', BUKAN cuma label tampilan).
alter table public.build_tasks drop constraint if exists build_tasks_urgency_check;

update public.build_tasks set urgency = 'tidak_mendesak' where urgency = 'ditunda_sadar';

alter table public.build_tasks add constraint build_tasks_urgency_check
  check (urgency in ('super_urgent', 'mendesak', 'penting', 'bisa_menunggu', 'tidak_mendesak'));

update public.build_task_urgency_history set old_urgency = 'tidak_mendesak' where old_urgency = 'ditunda_sadar';
update public.build_task_urgency_history set new_urgency = 'tidak_mendesak' where new_urgency = 'ditunda_sadar';
