-- Migration: compute_production_batch_labor_cost (biaya SDM AKTUAL per batch,
-- dari labor log) sekarang ikut biaya pemberi kerja (BPJS Kesehatan+JKK+JKM+JHT)
-- utk karyawan wage_type=monthly -- Perintah Gabungan A-F Bagian D (21 Agu 2026).
-- Basis & rate dari company_settings (tenant config, sama seperti sisi
-- STANDAR di computeStandardLaborCostPerUnit.ts/computeEmployerCostUplift.ts)
-- -- kalau company belum punya konfigurasi ini, fungsi diam-diam FALLBACK ke
-- gaji pokok saja (perilaku lama) TANPA error, supaya company lain yang belum
-- diisi konfigurasinya tidak tiba-tiba biaya SDM-nya jadi 0/error.
--
-- PENTING: dibangun di ATAS versi migration 20260820150000 (upah PHL
-- sadar-shift, wage_type='daily' pakai jam shift sendiri bukan jam
-- weekday/Saturday global) -- HANYA case 'monthly' yang diubah di sini, case
-- 'daily'/'hourly'/'piece_rate' disalin PERSIS supaya perbaikan shift-aware
-- sebelumnya TIDAK ikut ter-revert (pernah kejadian sekali, ketahuan dari
-- test rate_capacity_and_shift_wage.test.ts gagal -- lihat komentar migration
-- itu sebelum mengubah fungsi ini lagi di masa depan).
--
-- SENGAJA TIDAK menambahkan tunjangan makan/transport per hari di sini --
-- tunjangan itu per HARI HADIR (bukan per jam), dan 1 batch bukan representasi
-- 1 hari kerja penuh seorang karyawan (bisa kerja di beberapa batch sehari) --
-- atribusi tunjangan ke batch tertentu butuh aturan pembagian yang belum
-- ditentukan pemilik produk. Baru dihitung di sisi biaya bulanan/standar yang
-- basisnya memang harian, BUKAN di sini. Dicatat sebagai gap terbuka di HANDOFF.
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
  v_wage_floor numeric;
  v_wage_ceiling numeric;
  v_bpjs_kesehatan_pct numeric;
  v_jkk_pct numeric;
  v_jkm_pct numeric;
  v_jht_pct numeric;
  v_has_employer_cost_config boolean;
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

  select nullif(cs.setting_value, '')::numeric into v_wage_floor from company_settings cs where cs.company_id = v_company_id and cs.setting_key = 'bpjs_wage_basis_floor';
  select nullif(cs.setting_value, '')::numeric into v_wage_ceiling from company_settings cs where cs.company_id = v_company_id and cs.setting_key = 'bpjs_wage_basis_ceiling';
  select nullif(cs.setting_value, '')::numeric into v_bpjs_kesehatan_pct from company_settings cs where cs.company_id = v_company_id and cs.setting_key = 'bpjs_kesehatan_employer_rate_percent';
  select nullif(cs.setting_value, '')::numeric into v_jkk_pct from company_settings cs where cs.company_id = v_company_id and cs.setting_key = 'bpjs_jkk_employer_rate_percent';
  select nullif(cs.setting_value, '')::numeric into v_jkm_pct from company_settings cs where cs.company_id = v_company_id and cs.setting_key = 'bpjs_jkm_employer_rate_percent';
  select nullif(cs.setting_value, '')::numeric into v_jht_pct from company_settings cs where cs.company_id = v_company_id and cs.setting_key = 'bpjs_jht_employer_rate_percent';

  v_has_employer_cost_config := v_wage_floor is not null and v_wage_ceiling is not null and v_bpjs_kesehatan_pct is not null
    and v_jkk_pct is not null and v_jkm_pct is not null and v_jht_pct is not null;

  select coalesce(sum(
    case e.wage_type
      when 'hourly' then coalesce(a.actual_hours, 0) * e.wage_rate
      when 'daily' then coalesce(a.actual_hours, 0) * (
        e.wage_rate / coalesce(
          (select extract(epoch from (s.end_time - s.start_time)) / 3600.0 from shifts s where s.shift_id = a.shift_id),
          case when extract(dow from a.work_date) = 6 then v_saturday_hours else v_weekday_hours end
        )
      )
      when 'monthly' then coalesce(a.actual_hours, 0) * (
        (
          e.wage_rate
          + case when v_has_employer_cost_config then
              least(greatest(e.wage_rate, v_wage_floor), v_wage_ceiling) * (
                v_jkk_pct + v_jkm_pct + v_jht_pct
                + case when e.bpjs_kesehatan_enrolled is true then v_bpjs_kesehatan_pct else 0 end
              ) / 100
            else 0
            end
        ) / v_hours_per_month
      )
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

grant execute on function public.compute_production_batch_labor_cost(integer) to service_role;
