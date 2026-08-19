-- Migration: 2 kemampuan generik yang dibutuhkan tahap "Filling Sachet" (routing
-- serbuk nyata, 20 Agu 2026) + perbaikan kalkulasi upah PHL supaya sadar-shift.
--
-- (a) routing_steps.duration_per_unit_minutes -- durasi BERBASIS LAJU (bukan menit
-- tetap): kalau terisi, durasi aktif tahap itu = qty batch x nilai ini. NULL =
-- perilaku lama (pakai active_duration_minutes tetap) -- tidak ada regresi untuk
-- routing yang sudah ada. SATU logika ini WAJIB dipakai konsisten di Gantt,
-- Dashboard Kapasitas, dan mana pun yang membaca durasi tahap (lihat helper
-- src/features/mrp/server/stepDuration.ts).
alter table routing_steps add column if not exists duration_per_unit_minutes numeric;

-- (b) work_centers.unit_count -- jumlah unit mesin identik di satu Work Center
-- (mis. 2 mesin Filling Sachet). Kapasitas efektif = unit_count x kapasitas per
-- unit (capacity_hours_per_day). Default 1 = perilaku lama persis untuk Work
-- Center yang sudah ada.
alter table work_centers add column if not exists unit_count integer not null default 1;
alter table work_centers add constraint work_centers_unit_count_positive check (unit_count > 0);

-- Penandaan LEMBUR di labor log (keputusan pemilik produk, shift 2 20 Agu 2026):
-- kasus jarang "orang yang seharusnya pulang tapi lanjut bekerja". Tarif lembur
-- BELUM ditentukan pemilik produk -- baris ini TETAP dihitung pakai tarif normal
-- (tidak menebak tarif lembur), is_overtime cuma penanda supaya bisa dikoreksi
-- nanti begitu tarifnya diputuskan.
alter table work_order_assignments add column if not exists is_overtime boolean not null default false;

-- Perbaikan upah PHL (wage_type='daily') SADAR-SHIFT: keputusan pemilik produk --
-- shift 2 (16.00-22.00, 6 jam) dihitung sebagai HARI KERJA TERPISAH, bukan
-- ditambahkan ke jam shift 1 lalu dibagi rata jam kerja harian tunggal. Artinya
-- pembagi tarif per-jam PHL sekarang jam SHIFT yang bersangkutan (dari
-- shifts.start_time/end_time), bukan lagi 1 angka weekday/Saturday hours global
-- -- itu TETAP dipakai sebagai fallback kalau assignment tidak punya shift_id
-- (data lama / peran non-shift), supaya tidak ada regresi untuk baris yang sudah
-- ada. wage_type lain (hourly/monthly/piece_rate) TIDAK berubah sama sekali.
create or replace function public.compute_production_batch_labor_cost(p_production_batch_id integer)
returns numeric
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_company_id integer;
  v_weekday_hours numeric;
  v_saturday_hours numeric;
  v_hours_per_month numeric;
  v_total numeric;
begin
  select pb.company_id into v_company_id from production_batches pb where pb.production_batch_id = p_production_batch_id;
  if v_company_id is null then
    return 0;
  end if;

  select coalesce(nullif(cs.setting_value, '')::numeric, 7) into v_weekday_hours
  from company_settings cs where cs.company_id = v_company_id and cs.setting_key = 'work_calendar_weekday_hours';
  v_weekday_hours := coalesce(v_weekday_hours, 7);

  select coalesce(nullif(cs.setting_value, '')::numeric, 5) into v_saturday_hours
  from company_settings cs where cs.company_id = v_company_id and cs.setting_key = 'work_calendar_saturday_hours';
  v_saturday_hours := coalesce(v_saturday_hours, 5);

  select coalesce(nullif(cs.setting_value, '')::numeric, 173.3333) into v_hours_per_month
  from company_settings cs where cs.company_id = v_company_id and cs.setting_key = 'standard_hours_per_month';
  v_hours_per_month := coalesce(v_hours_per_month, 173.3333);

  select coalesce(sum(
    case e.wage_type
      when 'hourly' then coalesce(a.actual_hours, 0) * e.wage_rate
      when 'daily' then coalesce(a.actual_hours, 0) * (
        e.wage_rate / coalesce(
          -- Jam shift SENDIRI (end_time - start_time) kalau assignment ini punya
          -- shift_id -- ini yang membuat shift 2 (6 jam) dihitung sebagai "hari
          -- kerja terpisah" senilai penuh wage_rate, bukan dipecah rata dengan
          -- jam shift 1.
          (select extract(epoch from (s.end_time - s.start_time)) / 3600.0 from shifts s where s.shift_id = a.shift_id),
          case when extract(dow from a.work_date) = 6 then v_saturday_hours else v_weekday_hours end
        )
      )
      when 'monthly' then coalesce(a.actual_hours, 0) * (e.wage_rate / v_hours_per_month)
      when 'piece_rate' then coalesce(a.qty_produced, 0) * e.wage_rate
      else 0
    end
  ), 0) into v_total
  from work_order_assignments a
  join employees e on e.employee_id = a.employee_id
  where a.production_batch_id = p_production_batch_id
    and a.status not in ('absent', 'replaced');

  return v_total;
end;
$$;
