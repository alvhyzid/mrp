-- Migration: pisahkan kalkulasi biaya SDM per batch murni (TANPA gate JWT) dari
-- fungsi TAMPILAN (get_production_batch_labor_cost_total/detail, migration
-- 20260818100000) — dibutuhkan karena endpoint pencatatan hasil produksi
-- (recordWorkOrderOutput.ts) jalan lewat service-role client (TIDAK punya konteks
-- JWT user sama sekali, auth.jwt() akan null), jadi tidak bisa lolos gate
-- jwt_company_id()/jwt_can_view_financial_data() yang memang didesain utk endpoint
-- TAMPILAN yang dipanggil atas nama user asli. compute_production_batch_labor_cost()
-- di sini murni kalkulasi (tanpa gate privasi apa pun) — HANYA di-grant ke
-- service_role (bukan authenticated), supaya tidak bisa dipanggil langsung oleh user
-- biasa lewat PostgREST untuk melewati gate privasi gaji. Kedua fungsi tampilan
-- direfaktor supaya manggil fungsi ini SETELAH gate mereka masing-masing lolos —
-- logika kalkulasi sekarang cuma ada di SATU tempat.
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
      when 'daily' then coalesce(a.actual_hours, 0) * (e.wage_rate / (case when extract(dow from a.work_date) = 6 then v_saturday_hours else v_weekday_hours end))
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

-- SENGAJA cuma service_role — endpoint internal, bukan dipanggil langsung user.
grant execute on function public.compute_production_batch_labor_cost(integer) to service_role;

create or replace function public.get_production_batch_labor_cost_total(p_production_batch_id integer)
returns numeric
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_company_id integer;
begin
  select pb.company_id into v_company_id from production_batches pb where pb.production_batch_id = p_production_batch_id;
  if v_company_id is null then
    return 0;
  end if;
  if v_company_id <> public.jwt_company_id() then
    raise exception 'Batch produksi tidak ditemukan di perusahaan Anda.';
  end if;
  if not (public.jwt_can_view_financial_data() or public.jwt_can_view_wages()) then
    raise exception 'Anda tidak punya akses ke biaya SDM.';
  end if;
  return public.compute_production_batch_labor_cost(p_production_batch_id);
end;
$$;

grant execute on function public.get_production_batch_labor_cost_total(integer) to authenticated, service_role;
