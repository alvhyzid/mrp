-- Migration: system_alerts (Kelompok 5, termasuk 2 alert_type baru), fungsi
-- work_order_is_blocked()/view work_orders_readiness (pengganti dependency manual ala
-- Jira), dan trigger proyeksi stok real-time dari work_order_consumption.

create table if not exists system_alerts (
  system_alert_id serial primary key,
  company_id integer not null references companies(company_id),
  alert_type text not null check (alert_type in (
    'material_shortage', 'po_delayed', 'low_stock', 'production_delay',
    'worker_absence', 'production_disruption', 'so_ready_for_production',
    'po_needs_approval', 'stock_depletion_forecast', 'expiry_risk_low_usage'
  )),
  related_work_order_id integer references work_orders(work_order_id),
  -- Catatan: related_po_id sengaja TANPA foreign key eksplisit — dipakai lintas
  -- purchase_orders (PO ke supplier) MAUPUN customer_purchase_orders tergantung
  -- alert_type (mis. po_delayed -> purchase_orders, po_needs_approval ->
  -- customer_purchase_orders). Skema asli tidak menyediakan kolom terpisah untuk
  -- keduanya, jadi ID mana yang dipakai ditentukan oleh alert_type.
  related_po_id integer,
  related_item_id integer references items(item_id),
  message text not null,
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  created_at timestamptz not null default now(),
  acknowledged_by integer references users(user_id),
  acknowledged_at timestamptz
);

create index if not exists system_alerts_company_id_idx on system_alerts (company_id);
create index if not exists system_alerts_wo_id_idx on system_alerts (related_work_order_id);
create index if not exists system_alerts_item_id_idx on system_alerts (related_item_id);
create index if not exists system_alerts_open_idx on system_alerts (company_id, status) where status = 'open';

alter table if exists system_alerts enable row level security;

drop policy if exists system_alerts_select_for_company on system_alerts;
create policy system_alerts_select_for_company on system_alerts
  for select using (company_id = public.jwt_company_id());

-- Alert biasanya dibuat sistem (trigger/fungsi security definer, melewati RLS ini).
-- Leadership tetap boleh membuat manual kalau perlu.
drop policy if exists system_alerts_insert_leadership on system_alerts;
create policy system_alerts_insert_leadership on system_alerts
  for insert with check (company_id = public.jwt_company_id() and public.jwt_is_company_leadership());

-- Acknowledge/resolve boleh siapa saja di perusahaan yang sama (semua role bisa
-- menyelesaikan alert yang relevan dengan pekerjaannya).
drop policy if exists system_alerts_update_for_company on system_alerts;
create policy system_alerts_update_for_company on system_alerts
  for update using (company_id = public.jwt_company_id())
  with check (company_id = public.jwt_company_id());

-- "Ready to Start" / "Blocked": WO dianggap blocked kalau ada system_alerts terbuka
-- yang terkait work_order_id itu — bukan link manual antar-WO ala Jira.
drop function if exists public.work_order_is_blocked(integer);
create function public.work_order_is_blocked(p_work_order_id integer)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from system_alerts sa
    where sa.related_work_order_id = p_work_order_id and sa.status = 'open'
  );
$$;

grant execute on function public.work_order_is_blocked(integer) to authenticated;

drop view if exists work_orders_readiness;
create view work_orders_readiness
with (security_invoker = true)
as
select
  wo.work_order_id,
  wo.company_id,
  wo.status,
  (select count(*) from system_alerts sa where sa.related_work_order_id = wo.work_order_id and sa.status = 'open') as open_alert_count,
  case
    when wo.status <> 'planned' then wo.status
    when exists (select 1 from system_alerts sa where sa.related_work_order_id = wo.work_order_id and sa.status = 'open') then 'blocked'
    else 'ready'
  end as readiness
from work_orders wo;

grant select on work_orders_readiness to authenticated;

-- production_disruptions (Kelompok 2) — butuh work_orders/work_centers/routing_steps
-- yang sekarang sudah ada, jadi dibuat di sini.
create table if not exists production_disruptions (
  production_disruption_id serial primary key,
  company_id integer not null references companies(company_id),
  disruption_type text not null check (disruption_type in (
    'equipment_breakdown', 'utility_outage', 'external_factor', 'reprioritized', 'other'
  )),
  work_center_id integer references work_centers(work_center_id),
  work_order_id integer references work_orders(work_order_id),
  routing_step_id integer references routing_steps(routing_step_id),
  shift_id integer references shifts(shift_id),
  started_at timestamptz not null,
  resolved_at timestamptz,
  description text
);

create index if not exists production_disruptions_company_id_idx on production_disruptions (company_id);

alter table if exists production_disruptions enable row level security;

drop policy if exists production_disruptions_select_for_company on production_disruptions;
create policy production_disruptions_select_for_company on production_disruptions
  for select using (company_id = public.jwt_company_id());

drop policy if exists production_disruptions_write_production on production_disruptions;
create policy production_disruptions_write_production on production_disruptions
  for all using (
    company_id = public.jwt_company_id()
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('production_manager', 'production_staff', 'ppic_manager'))
  )
  with check (
    company_id = public.jwt_company_id()
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('production_manager', 'production_staff', 'ppic_manager'))
  );

-- Proyeksi stok habis & risiko kadaluarsa (Kelompok 5) — dihitung dari rata-rata
-- pemakaian harian (work_order_consumption), dihitung ULANG tiap ada data baru masuk,
-- bukan cron terjadwal. Asumsi implementasi (didokumentasikan karena skema asli tidak
-- merinci angka pastinya): window rata-rata pemakaian 30 hari terakhir; lead time
-- pembanding diambil dari supplier pemasok terakhir item itu (kalau belum pernah ada
-- pembelian, default 14 hari); risiko kadaluarsa dibandingkan ke expiry_date lot
-- yang paling dekat kadaluarsa.
drop function if exists public.recompute_stock_projection_for_item(integer);
create function public.recompute_stock_projection_for_item(p_item_id integer)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_company_id integer;
  v_avg_daily_usage numeric;
  v_current_stock numeric;
  v_days_to_deplete numeric;
  v_lead_time_days numeric;
  v_earliest_expiry date;
  v_open_depletion_id integer;
  v_open_expiry_id integer;
begin
  select company_id into v_company_id from items where item_id = p_item_id;
  if v_company_id is null then
    return;
  end if;

  select coalesce(sum(woc.qty_consumed), 0) / 30.0
    into v_avg_daily_usage
  from work_order_consumption woc
  join lots l on l.lot_id = woc.component_lot_id
  where l.item_id = p_item_id
    and woc.recorded_at >= now() - interval '30 days';

  select coalesce(sum(l.quantity_on_hand), 0)
    into v_current_stock
  from lots l
  where l.item_id = p_item_id and l.status = 'available';

  select min(l.expiry_date)
    into v_earliest_expiry
  from lots l
  where l.item_id = p_item_id and l.status = 'available' and l.expiry_date is not null;

  select sa.system_alert_id into v_open_depletion_id
  from system_alerts sa
  where sa.company_id = v_company_id and sa.related_item_id = p_item_id
    and sa.alert_type = 'stock_depletion_forecast' and sa.status = 'open'
  limit 1;

  select sa.system_alert_id into v_open_expiry_id
  from system_alerts sa
  where sa.company_id = v_company_id and sa.related_item_id = p_item_id
    and sa.alert_type = 'expiry_risk_low_usage' and sa.status = 'open'
  limit 1;

  if v_avg_daily_usage <= 0 then
    if v_open_depletion_id is not null then
      update system_alerts set status = 'resolved' where system_alert_id = v_open_depletion_id;
    end if;
    if v_open_expiry_id is not null then
      update system_alerts set status = 'resolved' where system_alert_id = v_open_expiry_id;
    end if;
    return;
  end if;

  v_days_to_deplete := v_current_stock / v_avg_daily_usage;

  select coalesce(s.lead_time_days, 14) into v_lead_time_days
  from purchase_order_lines pol
  join purchase_orders po on po.purchase_order_id = pol.purchase_order_id
  join suppliers s on s.supplier_id = po.supplier_id
  where pol.item_id = p_item_id
  order by po.order_date desc
  limit 1;
  v_lead_time_days := coalesce(v_lead_time_days, 14);

  if v_days_to_deplete <= v_lead_time_days then
    if v_open_depletion_id is null then
      insert into system_alerts (company_id, alert_type, related_item_id, message, severity)
      values (
        v_company_id, 'stock_depletion_forecast', p_item_id,
        format('Proyeksi stok habis dalam %s hari (lead time pemasok %s hari).', round(v_days_to_deplete, 1), v_lead_time_days),
        case when v_days_to_deplete <= v_lead_time_days / 2 then 'critical' else 'warning' end
      );
    else
      update system_alerts
      set message = format('Proyeksi stok habis dalam %s hari (lead time pemasok %s hari).', round(v_days_to_deplete, 1), v_lead_time_days),
          severity = case when v_days_to_deplete <= v_lead_time_days / 2 then 'critical' else 'warning' end
      where system_alert_id = v_open_depletion_id;
    end if;
  elsif v_open_depletion_id is not null then
    update system_alerts set status = 'resolved' where system_alert_id = v_open_depletion_id;
  end if;

  if v_earliest_expiry is not null and (current_date + make_interval(days => v_days_to_deplete::integer)) > v_earliest_expiry then
    if v_open_expiry_id is null then
      insert into system_alerts (company_id, alert_type, related_item_id, message, severity)
      values (
        v_company_id, 'expiry_risk_low_usage', p_item_id,
        format('Bahan diproyeksi belum habis terpakai (%s hari) sebelum kadaluarsa pada %s — pemakaian terlalu lambat.', round(v_days_to_deplete, 1), v_earliest_expiry),
        'warning'
      );
    else
      update system_alerts
      set message = format('Bahan diproyeksi belum habis terpakai (%s hari) sebelum kadaluarsa pada %s — pemakaian terlalu lambat.', round(v_days_to_deplete, 1), v_earliest_expiry)
      where system_alert_id = v_open_expiry_id;
    end if;
  elsif v_open_expiry_id is not null then
    update system_alerts set status = 'resolved' where system_alert_id = v_open_expiry_id;
  end if;
end;
$$;

drop function if exists public.trigger_recompute_stock_projection();
create function public.trigger_recompute_stock_projection()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_item_id integer;
begin
  select item_id into v_item_id from lots where lot_id = new.component_lot_id;
  if v_item_id is not null then
    perform public.recompute_stock_projection_for_item(v_item_id);
  end if;
  return new;
end;
$$;

drop trigger if exists work_order_consumption_recompute_projection on work_order_consumption;
create trigger work_order_consumption_recompute_projection
  after insert on work_order_consumption
  for each row
  execute function public.trigger_recompute_stock_projection();
