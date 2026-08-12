-- Migration: work_orders + outputs/consumption/assignments/step_progress (Kelompok 5).
-- status dapat 'paused', ada kolom priority. "Ready to Start"/"Blocked" TIDAK disimpan
-- sebagai kolom (data turunan) — dihitung oleh fungsi work_order_is_blocked() di bawah,
-- berdasar ada/tidaknya system_alerts terbuka (system_alerts dibuat di migration
-- berikutnya, fungsi ini di-CREATE OR REPLACE lagi setelah tabel itu ada).

create table if not exists work_orders (
  work_order_id serial primary key,
  company_id integer not null references companies(company_id),
  production_plant_id integer not null references production_plants(production_plant_id),
  item_id integer not null references items(item_id),
  bom_id integer not null references boms(bom_id),
  routing_id integer references routings(routing_id),
  sales_order_line_id integer references sales_order_lines(sales_order_line_id),
  planned_qty numeric(14,4) not null,
  status text not null default 'planned' check (status in ('planned', 'in_progress', 'paused', 'completed', 'cancelled')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  actual_start_at timestamptz,
  actual_completed_at timestamptz,
  subcontractor_id integer references suppliers(supplier_id),
  created_at timestamptz not null default now()
);

create index if not exists work_orders_company_id_idx on work_orders (company_id);

alter table if exists work_orders enable row level security;

drop policy if exists work_orders_select_for_company on work_orders;
create policy work_orders_select_for_company on work_orders
  for select using (company_id = public.jwt_company_id());

drop policy if exists work_orders_write_production on work_orders;
create policy work_orders_write_production on work_orders
  for all using (
    company_id = public.jwt_company_id()
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('ppic_manager', 'ppic_staff', 'production_manager', 'production_staff'))
  )
  with check (
    company_id = public.jwt_company_id()
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('ppic_manager', 'ppic_staff', 'production_manager', 'production_staff'))
  );

create table if not exists work_order_outputs (
  work_order_output_id serial primary key,
  work_order_id integer not null references work_orders(work_order_id),
  item_id integer not null references items(item_id),
  shift_id integer references shifts(shift_id),
  output_type text not null check (output_type in ('main_output', 'reprocessable_waste', 'disposed_waste')),
  qty numeric(14,4) not null,
  lot_id integer references lots(lot_id)
);

create index if not exists work_order_outputs_wo_id_idx on work_order_outputs (work_order_id);

alter table if exists work_order_outputs enable row level security;

drop policy if exists work_order_outputs_select_for_company on work_order_outputs;
create policy work_order_outputs_select_for_company on work_order_outputs
  for select using (
    exists (select 1 from work_orders wo where wo.work_order_id = work_order_outputs.work_order_id and wo.company_id = public.jwt_company_id())
  );

drop policy if exists work_order_outputs_write_production on work_order_outputs;
create policy work_order_outputs_write_production on work_order_outputs
  for all using (
    exists (select 1 from work_orders wo where wo.work_order_id = work_order_outputs.work_order_id and wo.company_id = public.jwt_company_id())
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('production_manager', 'production_staff'))
  )
  with check (
    exists (select 1 from work_orders wo where wo.work_order_id = work_order_outputs.work_order_id and wo.company_id = public.jwt_company_id())
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('production_manager', 'production_staff'))
  );

create table if not exists work_order_consumption (
  work_order_consumption_id serial primary key,
  work_order_id integer not null references work_orders(work_order_id),
  component_lot_id integer not null references lots(lot_id),
  qty_consumed numeric(14,4) not null,
  shift_id integer references shifts(shift_id),
  recorded_at timestamptz not null default now()
);

create index if not exists work_order_consumption_wo_id_idx on work_order_consumption (work_order_id);
create index if not exists work_order_consumption_lot_id_idx on work_order_consumption (component_lot_id);

alter table if exists work_order_consumption enable row level security;

drop policy if exists work_order_consumption_select_for_company on work_order_consumption;
create policy work_order_consumption_select_for_company on work_order_consumption
  for select using (
    exists (select 1 from work_orders wo where wo.work_order_id = work_order_consumption.work_order_id and wo.company_id = public.jwt_company_id())
  );

drop policy if exists work_order_consumption_write_production on work_order_consumption;
create policy work_order_consumption_write_production on work_order_consumption
  for all using (
    exists (select 1 from work_orders wo where wo.work_order_id = work_order_consumption.work_order_id and wo.company_id = public.jwt_company_id())
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('production_manager', 'production_staff'))
  )
  with check (
    exists (select 1 from work_orders wo where wo.work_order_id = work_order_consumption.work_order_id and wo.company_id = public.jwt_company_id())
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('production_manager', 'production_staff'))
  );

create table if not exists work_order_assignments (
  work_order_assignment_id serial primary key,
  work_order_id integer not null references work_orders(work_order_id),
  employee_id integer not null references employees(employee_id),
  routing_step_id integer references routing_steps(routing_step_id),
  shift_id integer references shifts(shift_id),
  status text not null default 'planned'
    check (status in ('planned', 'confirmed', 'absent', 'replaced', 'completed', 'unplanned_addition')),
  replacement_for_assignment_id integer references work_order_assignments(work_order_assignment_id),
  scheduled_hours numeric(6,2),
  actual_hours numeric(6,2),
  qty_produced numeric(14,4)
);

create index if not exists work_order_assignments_wo_id_idx on work_order_assignments (work_order_id);

alter table if exists work_order_assignments enable row level security;

-- Baris ini menyimpan employee_id (bukan wage_rate langsung), jadi TIDAK sensitif
-- seperti employees.wage_rate itu sendiri — dibolehkan company match biasa. Kalkulasi
-- biaya dari sini pakai get_work_order_labor_cost_total() di bawah supaya finance
-- tidak perlu join manual ke employees.wage_rate.
drop policy if exists work_order_assignments_select_for_company on work_order_assignments;
create policy work_order_assignments_select_for_company on work_order_assignments
  for select using (
    exists (select 1 from work_orders wo where wo.work_order_id = work_order_assignments.work_order_id and wo.company_id = public.jwt_company_id())
  );

drop policy if exists work_order_assignments_write_production on work_order_assignments;
create policy work_order_assignments_write_production on work_order_assignments
  for all using (
    exists (select 1 from work_orders wo where wo.work_order_id = work_order_assignments.work_order_id and wo.company_id = public.jwt_company_id())
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('production_manager', 'ppic_manager'))
  )
  with check (
    exists (select 1 from work_orders wo where wo.work_order_id = work_order_assignments.work_order_id and wo.company_id = public.jwt_company_id())
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('production_manager', 'ppic_manager'))
  );

create table if not exists work_order_step_progress (
  work_order_step_progress_id serial primary key,
  work_order_id integer not null references work_orders(work_order_id),
  routing_step_id integer not null references routing_steps(routing_step_id),
  shift_id integer references shifts(shift_id),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed')),
  qty_recorded numeric(14,4),
  uom text,
  started_at timestamptz,
  completed_at timestamptz,
  notes text
);

create index if not exists work_order_step_progress_wo_id_idx on work_order_step_progress (work_order_id);

alter table if exists work_order_step_progress enable row level security;

drop policy if exists work_order_step_progress_select_for_company on work_order_step_progress;
create policy work_order_step_progress_select_for_company on work_order_step_progress
  for select using (
    exists (select 1 from work_orders wo where wo.work_order_id = work_order_step_progress.work_order_id and wo.company_id = public.jwt_company_id())
  );

drop policy if exists work_order_step_progress_write_production on work_order_step_progress;
create policy work_order_step_progress_write_production on work_order_step_progress
  for all using (
    exists (select 1 from work_orders wo where wo.work_order_id = work_order_step_progress.work_order_id and wo.company_id = public.jwt_company_id())
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('production_manager', 'production_staff'))
  )
  with check (
    exists (select 1 from work_orders wo where wo.work_order_id = work_order_step_progress.work_order_id and wo.company_id = public.jwt_company_id())
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('production_manager', 'production_staff'))
  );

-- Fungsi agregat biaya SDM (dijanjikan di migration employees) — sekarang
-- work_orders & work_order_assignments sudah ada.
drop function if exists public.get_work_order_labor_cost_total(integer);
create function public.get_work_order_labor_cost_total(p_work_order_id integer)
returns numeric
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_company_id integer;
  v_hours_per_day numeric;
  v_hours_per_month numeric;
  v_total numeric;
begin
  select wo.company_id into v_company_id
  from work_orders wo
  where wo.work_order_id = p_work_order_id;

  if v_company_id is null then
    return 0;
  end if;

  if v_company_id <> public.jwt_company_id() then
    raise exception 'Work order tidak ditemukan di perusahaan Anda.';
  end if;

  if not (public.jwt_can_view_financial_data() or public.jwt_can_view_wages()) then
    raise exception 'Anda tidak punya akses ke biaya SDM.';
  end if;

  select coalesce(nullif(cs.setting_value, '')::numeric, 8) into v_hours_per_day
  from company_settings cs
  where cs.company_id = v_company_id and cs.setting_key = 'standard_hours_per_day';
  v_hours_per_day := coalesce(v_hours_per_day, 8);

  select coalesce(nullif(cs.setting_value, '')::numeric, 173) into v_hours_per_month
  from company_settings cs
  where cs.company_id = v_company_id and cs.setting_key = 'standard_hours_per_month';
  v_hours_per_month := coalesce(v_hours_per_month, 173);

  select coalesce(sum(
    case e.wage_type
      when 'hourly' then coalesce(a.actual_hours, 0) * e.wage_rate
      when 'daily' then coalesce(a.actual_hours, 0) * (e.wage_rate / v_hours_per_day)
      when 'monthly' then coalesce(a.actual_hours, 0) * (e.wage_rate / v_hours_per_month)
      when 'piece_rate' then coalesce(a.qty_produced, 0) * e.wage_rate
      else 0
    end
  ), 0) into v_total
  from work_order_assignments a
  join employees e on e.employee_id = a.employee_id
  where a.work_order_id = p_work_order_id
    and a.status not in ('absent', 'replaced');

  return v_total;
end;
$$;

grant execute on function public.get_work_order_labor_cost_total(integer) to authenticated;
