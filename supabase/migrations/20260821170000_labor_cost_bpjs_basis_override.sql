-- Migration: compute_production_batch_labor_cost sekarang pakai
-- employees.bpjs_contribution_basis PER ORANG kalau diisi (fallback ke
-- clamp(wage_rate, floor, ceiling) kalau belum) -- konsisten dengan sisi
-- STANDAR (computeEmployerCostUplift.ts) setelah ditemukan basis TIDAK
-- SELALU sama dengan hasil clamp formula (data nyata 21 Agu 2026: Dimas
-- Rp6.500.000, Bayu Rp8.000.000, keduanya beda dari hasil clamp).
--
-- Dibangun di ATAS migration 20260821110000 (uplift monthly) DAN
-- 20260820150000 (shift-aware daily) -- case 'daily'/'hourly'/'piece_rate'
-- disalin PERSIS, HANYA case 'monthly' yang diubah (tambah basis override).
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
              coalesce(e.bpjs_contribution_basis, least(greatest(e.wage_rate, v_wage_floor), v_wage_ceiling)) * (
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
