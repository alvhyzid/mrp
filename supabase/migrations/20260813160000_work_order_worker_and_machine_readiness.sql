-- Migration: sama seperti kasus bahan (20260813150000) — dokumentasi bilang WO
-- "Blocked" kalau ada system_alerts terbuka terkait (kekurangan bahan, SDM belum
-- lengkap, mesin rusak), tapi cuma bagian bahan yang benar-benar dibuatkan alertnya.
-- Migration ini menutup 2 celah yang sama untuk SDM (work_order_assignments) dan
-- mesin (production_disruptions).

-- SDM: WO dianggap kekurangan tenaga kerja kalau TIDAK ADA satu pun penugasan aktif
-- (planned/confirmed/unplanned_addition/completed) — baik karena belum pernah
-- ditugaskan sama sekali, atau semua penugasan yang ada berstatus 'absent'/'replaced'
-- tanpa ada pengganti aktif.
drop function if exists public.recompute_work_order_worker_readiness(integer);
create function public.recompute_work_order_worker_readiness(p_work_order_id integer)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_wo work_orders%rowtype;
  v_active_count integer;
  v_open_alert_id integer;
begin
  select * into v_wo from work_orders where work_order_id = p_work_order_id;
  if v_wo.work_order_id is null or v_wo.status in ('completed', 'cancelled') then
    return;
  end if;

  select count(*) into v_active_count
  from work_order_assignments woa
  where woa.work_order_id = p_work_order_id
    and woa.status in ('planned', 'confirmed', 'unplanned_addition', 'completed');

  select sa.system_alert_id into v_open_alert_id
  from system_alerts sa
  where sa.related_work_order_id = p_work_order_id
    and sa.alert_type = 'worker_absence'
    and sa.status = 'open'
  limit 1;

  if v_active_count = 0 then
    if v_open_alert_id is null then
      insert into system_alerts (company_id, alert_type, related_work_order_id, message, severity)
      values (
        v_wo.company_id, 'worker_absence', p_work_order_id,
        'Menunggu penugasan pekerja — belum ada SDM aktif yang ditugaskan untuk Work Order ini.',
        'critical'
      );
    end if;
  elsif v_open_alert_id is not null then
    update system_alerts set status = 'resolved' where system_alert_id = v_open_alert_id;
  end if;
end;
$$;

grant execute on function public.recompute_work_order_worker_readiness(integer) to authenticated;

drop function if exists public.trigger_recheck_wo_worker_readiness();
create function public.trigger_recheck_wo_worker_readiness()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  perform public.recompute_work_order_worker_readiness(coalesce(new.work_order_id, old.work_order_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists work_order_assignments_recheck_readiness on work_order_assignments;
create trigger work_order_assignments_recheck_readiness
  after insert or update of status or delete on work_order_assignments
  for each row
  execute function public.trigger_recheck_wo_worker_readiness();

-- Mesin: WO dianggap terhambat mesin kalau ada production_disruptions yang BELUM
-- resolved (resolved_at is null) yang terkait ke WO ini, baik lewat work_order_id
-- langsung, routing_step_id, ATAU work_center_id yang dipakai routing WO ini.
drop function if exists public.recompute_work_order_machine_readiness(integer);
create function public.recompute_work_order_machine_readiness(p_work_order_id integer)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_wo work_orders%rowtype;
  v_disruption record;
  v_open_alert_id integer;
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
    )
  order by pd.started_at desc
  limit 1;

  select sa.system_alert_id into v_open_alert_id
  from system_alerts sa
  where sa.related_work_order_id = p_work_order_id
    and sa.alert_type = 'production_disruption'
    and sa.status = 'open'
  limit 1;

  if v_disruption.production_disruption_id is not null then
    if v_open_alert_id is null then
      insert into system_alerts (company_id, alert_type, related_work_order_id, message, severity)
      values (
        v_wo.company_id, 'production_disruption', p_work_order_id,
        format('Terhambat gangguan mesin (%s) di %s.', v_disruption.disruption_type, coalesce(v_disruption.work_center_name, 'lokasi terkait')),
        'critical'
      );
    else
      update system_alerts
      set message = format('Terhambat gangguan mesin (%s) di %s.', v_disruption.disruption_type, coalesce(v_disruption.work_center_name, 'lokasi terkait'))
      where system_alert_id = v_open_alert_id;
    end if;
  elsif v_open_alert_id is not null then
    update system_alerts set status = 'resolved' where system_alert_id = v_open_alert_id;
  end if;
end;
$$;

grant execute on function public.recompute_work_order_machine_readiness(integer) to authenticated;

drop function if exists public.trigger_recheck_wo_machine_readiness();
create function public.trigger_recheck_wo_machine_readiness()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_wo_id integer;
  v_row production_disruptions%rowtype;
begin
  v_row := coalesce(new, old);
  for v_wo_id in
    select distinct wo.work_order_id
    from work_orders wo
    where wo.status in ('planned', 'in_progress', 'paused')
      and (
        wo.work_order_id = v_row.work_order_id
        or (v_row.routing_step_id is not null and exists (
          select 1 from routing_steps rs where rs.routing_id = wo.routing_id and rs.routing_step_id = v_row.routing_step_id
        ))
        or (v_row.work_center_id is not null and exists (
          select 1 from routing_steps rs where rs.routing_id = wo.routing_id and rs.work_center_id = v_row.work_center_id
        ))
      )
  loop
    perform public.recompute_work_order_machine_readiness(v_wo_id);
  end loop;
  return v_row;
end;
$$;

drop trigger if exists production_disruptions_recheck_readiness on production_disruptions;
create trigger production_disruptions_recheck_readiness
  after insert or update of resolved_at, work_center_id, routing_step_id, work_order_id or delete on production_disruptions
  for each row
  execute function public.trigger_recheck_wo_machine_readiness();

-- Konsolidasi: begitu WO baru dibuat, cek SEMUA jenis kesiapan (bahan, SDM, mesin)
-- sekaligus — bukan cuma bahan seperti sebelumnya.
create or replace function public.trigger_check_wo_material_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  perform public.recompute_work_order_material_readiness(new.work_order_id);
  perform public.recompute_work_order_worker_readiness(new.work_order_id);
  perform public.recompute_work_order_machine_readiness(new.work_order_id);
  return new;
end;
$$;
