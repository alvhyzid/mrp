-- Migration: system_alerts.target_department — dasar Bell Icon Notifikasi
-- Terpusat. Mapping alert_type -> department didokumentasikan di
-- docs/rancangan-skema-database-mrp.md (bagian system_alerts): kalau 1 alert
-- relevan untuk >1 department, dibuat >1 baris (1 per department) daripada 1
-- baris multi-value, sesuai catatan di dokumen itu.
--
-- Konsekuensi dari duplikasi baris: work_orders_readiness.open_alert_count
-- (yang sebelumnya count(*) mentah) akan DOBEL untuk alert_type yang kena
-- duplikasi 2-department (material_shortage/worker_absence/
-- production_disruption, ketiganya set related_work_order_id). Diperbaiki di
-- sini dengan count(distinct (alert_type, related_item_id)) supaya 2 baris
-- department untuk 1 "kejadian" yang sama tetap dihitung 1.

alter table if exists system_alerts
  add column if not exists target_department text
  check (target_department in ('production', 'ppic', 'finance', 'purchasing', 'warehouse', 'hr', 'management'));

create index if not exists system_alerts_target_department_idx on system_alerts (company_id, target_department, status);

-- Helper bersama dipakai semua fungsi pembuat alert di bawah — cari alert
-- TERBUKA yang sama persis (company+type+department+wo+item), update pesannya
-- kalau sudah ada, insert baru kalau belum. Dipakai di dalam loop per-department
-- supaya 1 kejadian bisa menghasilkan >1 baris (1 per department relevan).
drop function if exists public.upsert_department_alert(integer, text, text, integer, integer, text, text);
create function public.upsert_department_alert(
  p_company_id integer,
  p_alert_type text,
  p_target_department text,
  p_related_work_order_id integer,
  p_related_item_id integer,
  p_message text,
  p_severity text
) returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_existing_id integer;
begin
  select system_alert_id into v_existing_id
  from system_alerts
  where company_id = p_company_id
    and alert_type = p_alert_type
    and target_department = p_target_department
    and related_work_order_id is not distinct from p_related_work_order_id
    and related_item_id is not distinct from p_related_item_id
    and status = 'open'
  limit 1;

  if v_existing_id is null then
    insert into system_alerts (company_id, alert_type, target_department, related_work_order_id, related_item_id, message, severity)
    values (p_company_id, p_alert_type, p_target_department, p_related_work_order_id, p_related_item_id, p_message, p_severity);
  else
    update system_alerts
    set message = p_message, severity = p_severity
    where system_alert_id = v_existing_id;
  end if;
end;
$$;

grant execute on function public.upsert_department_alert(integer, text, text, integer, integer, text, text) to authenticated;

-- Kebalikannya: tutup SEMUA baris terbuka (lintas department) untuk 1 kejadian
-- yang kondisinya sudah tidak terjadi lagi.
drop function if exists public.resolve_department_alerts(text, integer, integer);
create function public.resolve_department_alerts(
  p_alert_type text,
  p_related_work_order_id integer,
  p_related_item_id integer
) returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  update system_alerts
  set status = 'resolved'
  where alert_type = p_alert_type
    and related_work_order_id is not distinct from p_related_work_order_id
    and related_item_id is not distinct from p_related_item_id
    and status = 'open';
end;
$$;

grant execute on function public.resolve_department_alerts(text, integer, integer) to authenticated;

-- material_shortage -> purchasing + warehouse (migration 20260813150000)
create or replace function public.recompute_work_order_material_readiness(p_work_order_id integer)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_wo work_orders%rowtype;
  v_line record;
  v_available numeric;
  v_required numeric;
  v_dept text;
begin
  select * into v_wo from work_orders where work_order_id = p_work_order_id;
  if v_wo.work_order_id is null or v_wo.status in ('completed', 'cancelled') then
    return;
  end if;

  for v_line in
    select bl.component_item_id, bl.qty_per_unit_output, i.name as item_name, i.base_uom
    from bom_lines bl
    join items i on i.item_id = bl.component_item_id
    where bl.bom_id = v_wo.bom_id
  loop
    v_required := v_line.qty_per_unit_output * v_wo.planned_qty;

    select coalesce(sum(l.quantity_on_hand), 0)
      into v_available
    from lots l
    where l.item_id = v_line.component_item_id
      and l.production_plant_id = v_wo.production_plant_id
      and l.status = 'available';

    if v_available < v_required then
      foreach v_dept in array array['purchasing', 'warehouse']
      loop
        perform public.upsert_department_alert(
          v_wo.company_id, 'material_shortage', v_dept, p_work_order_id, v_line.component_item_id,
          format('Menunggu bahan %s — butuh %s %s, stok tersedia cuma %s %s.', v_line.item_name, v_required, v_line.base_uom, v_available, v_line.base_uom),
          'critical'
        );
      end loop;
    else
      perform public.resolve_department_alerts('material_shortage', p_work_order_id, v_line.component_item_id);
    end if;
  end loop;
end;
$$;

grant execute on function public.recompute_work_order_material_readiness(integer) to authenticated;

-- worker_absence -> production + hr (migration 20260813160000)
create or replace function public.recompute_work_order_worker_readiness(p_work_order_id integer)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_wo work_orders%rowtype;
  v_active_count integer;
  v_dept text;
begin
  select * into v_wo from work_orders where work_order_id = p_work_order_id;
  if v_wo.work_order_id is null or v_wo.status in ('completed', 'cancelled') then
    return;
  end if;

  select count(*) into v_active_count
  from work_order_assignments woa
  where woa.work_order_id = p_work_order_id
    and woa.status in ('planned', 'confirmed', 'unplanned_addition', 'completed');

  if v_active_count = 0 then
    foreach v_dept in array array['production', 'hr']
    loop
      perform public.upsert_department_alert(
        v_wo.company_id, 'worker_absence', v_dept, p_work_order_id, null,
        'Menunggu penugasan pekerja — belum ada SDM aktif yang ditugaskan untuk Work Order ini.',
        'critical'
      );
    end loop;
  else
    perform public.resolve_department_alerts('worker_absence', p_work_order_id, null);
  end if;
end;
$$;

grant execute on function public.recompute_work_order_worker_readiness(integer) to authenticated;

-- production_disruption -> production + ppic. Menggantikan versi terbaru
-- (migration 20260815110000, sudah termasuk cabang gangguan menyeluruh 1
-- plant) — query pencarian gangguan TIDAK diubah, cuma bagian insert/resolve
-- alert-nya yang sekarang loop per department.
create or replace function public.recompute_work_order_machine_readiness(p_work_order_id integer)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_wo work_orders%rowtype;
  v_disruption record;
  v_dept text;
begin
  select * into v_wo from work_orders where work_order_id = p_work_order_id;
  if v_wo.work_order_id is null or v_wo.status in ('completed', 'cancelled') then
    return;
  end if;

  select pd.production_disruption_id, pd.disruption_type, pd.description, wc.name as work_center_name
    into v_disruption
  from production_disruptions pd
  left join work_centers wc on wc.work_center_id = pd.work_center_id
  where pd.resolved_at is null
    and (
      pd.work_order_id = p_work_order_id
      or (pd.routing_step_id is not null and pd.routing_step_id in (
        select rs.routing_step_id from routing_steps rs where rs.routing_id = v_wo.routing_id
      ))
      or (pd.work_center_id is not null and v_wo.routing_id is not null and pd.work_center_id in (
        select rs.work_center_id from routing_steps rs where rs.routing_id = v_wo.routing_id
      ))
      or (pd.work_center_id is null and pd.production_plant_id = v_wo.production_plant_id)
    )
  order by pd.started_at desc
  limit 1;

  if v_disruption.production_disruption_id is not null then
    foreach v_dept in array array['production', 'ppic']
    loop
      perform public.upsert_department_alert(
        v_wo.company_id, 'production_disruption', v_dept, p_work_order_id, null,
        format('Terhambat gangguan mesin (%s) di %s.', v_disruption.disruption_type, coalesce(v_disruption.work_center_name, 'lokasi terkait')),
        'critical'
      );
    end loop;
  else
    perform public.resolve_department_alerts('production_disruption', p_work_order_id, null);
  end if;
end;
$$;

grant execute on function public.recompute_work_order_machine_readiness(integer) to authenticated;

-- stock_depletion_forecast & expiry_risk_low_usage -> purchasing + warehouse
-- (migration 20260812154000) — logika perhitungan (rata-rata pemakaian, lead
-- time, expiry terdekat) TIDAK diubah, cuma bagian insert/update/resolve
-- alert-nya yang sekarang loop per department.
create or replace function public.recompute_stock_projection_for_item(p_item_id integer)
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
  v_dept text;
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

  if v_avg_daily_usage <= 0 then
    perform public.resolve_department_alerts('stock_depletion_forecast', null, p_item_id);
    perform public.resolve_department_alerts('expiry_risk_low_usage', null, p_item_id);
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
    foreach v_dept in array array['purchasing', 'warehouse']
    loop
      perform public.upsert_department_alert(
        v_company_id, 'stock_depletion_forecast', v_dept, null, p_item_id,
        format('Proyeksi stok habis dalam %s hari (lead time pemasok %s hari).', round(v_days_to_deplete, 1), v_lead_time_days),
        case when v_days_to_deplete <= v_lead_time_days / 2 then 'critical' else 'warning' end
      );
    end loop;
  else
    perform public.resolve_department_alerts('stock_depletion_forecast', null, p_item_id);
  end if;

  if v_earliest_expiry is not null and (current_date + make_interval(days => v_days_to_deplete::integer)) > v_earliest_expiry then
    foreach v_dept in array array['purchasing', 'warehouse']
    loop
      perform public.upsert_department_alert(
        v_company_id, 'expiry_risk_low_usage', v_dept, null, p_item_id,
        format('Bahan diproyeksi belum habis terpakai (%s hari) sebelum kadaluarsa pada %s — pemakaian terlalu lambat.', round(v_days_to_deplete, 1), v_earliest_expiry),
        'warning'
      );
    end loop;
  else
    perform public.resolve_department_alerts('expiry_risk_low_usage', null, p_item_id);
  end if;
end;
$$;

grant execute on function public.recompute_stock_projection_for_item(integer) to authenticated;

-- Backfill baris lama (dibuat sebelum kolom ini ada) — cuma 4 alert_type yang
-- benar-benar punya baris saat migrasi ini ditulis (dicek lewat query live,
-- bukan tebakan): material_shortage, worker_absence, production_disruption,
-- stock_depletion_forecast. Tipe lain (po_delayed, low_stock,
-- production_delay, so_ready_for_production, po_needs_approval, dan
-- expiry_risk_low_usage) belum pernah punya baris sungguhan, jadi tidak
-- di-backfill di sini.
update system_alerts set target_department = 'purchasing'
where alert_type in ('material_shortage', 'stock_depletion_forecast') and target_department is null;

insert into system_alerts (company_id, alert_type, target_department, related_work_order_id, related_po_id, related_item_id, message, severity, status, created_at, acknowledged_by, acknowledged_at)
select company_id, alert_type, 'warehouse', related_work_order_id, related_po_id, related_item_id, message, severity, status, created_at, acknowledged_by, acknowledged_at
from system_alerts
where alert_type in ('material_shortage', 'stock_depletion_forecast') and target_department = 'purchasing';

update system_alerts set target_department = 'production'
where alert_type = 'worker_absence' and target_department is null;

insert into system_alerts (company_id, alert_type, target_department, related_work_order_id, related_po_id, related_item_id, message, severity, status, created_at, acknowledged_by, acknowledged_at)
select company_id, alert_type, 'hr', related_work_order_id, related_po_id, related_item_id, message, severity, status, created_at, acknowledged_by, acknowledged_at
from system_alerts
where alert_type = 'worker_absence' and target_department = 'production';

update system_alerts set target_department = 'production'
where alert_type = 'production_disruption' and target_department is null;

insert into system_alerts (company_id, alert_type, target_department, related_work_order_id, related_po_id, related_item_id, message, severity, status, created_at, acknowledged_by, acknowledged_at)
select company_id, alert_type, 'ppic', related_work_order_id, related_po_id, related_item_id, message, severity, status, created_at, acknowledged_by, acknowledged_at
from system_alerts
where alert_type = 'production_disruption' and target_department = 'production';

-- work_orders_readiness: open_alert_count sekarang count(distinct
-- (alert_type, related_item_id)) supaya 2 baris department untuk 1 kejadian
-- yang sama tetap dihitung 1 — bukan count(*) mentah seperti sebelumnya.
-- Sisanya (readiness case/when) identik dengan versi terbaru (20260815110000).
drop view if exists work_orders_readiness;
create view work_orders_readiness
with (security_invoker = true)
as
select
  wo.work_order_id,
  wo.company_id,
  wo.status,
  (select count(distinct (sa.alert_type, sa.related_item_id)) from system_alerts sa where sa.related_work_order_id = wo.work_order_id and sa.status = 'open') as open_alert_count,
  case
    when wo.status not in ('planned', 'in_progress') then wo.status
    when exists (select 1 from system_alerts sa where sa.related_work_order_id = wo.work_order_id and sa.status = 'open') then 'blocked'
    when wo.status = 'planned' then 'ready'
    else wo.status
  end as readiness
from work_orders wo;

grant select on work_orders_readiness to authenticated;

-- Realtime: bell icon subscribe ke INSERT baru di system_alerts (RLS
-- system_alerts_select_for_company yang sudah ada otomatis membatasi event
-- yang diterima tiap client cuma untuk company_id mereka sendiri).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'system_alerts'
  ) then
    alter publication supabase_realtime add table system_alerts;
  end if;
end $$;
