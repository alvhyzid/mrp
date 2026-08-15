-- Migration: rencana-ams-mvp.md FASE 5 — gangguan menyeluruh 1 plant (mis.
-- listrik padam se-pabrik) harus otomatis "Blocked"-kan SEMUA Work Order aktif
-- di plant itu, bukan cuma yang eksplisit ditaut lewat work_order_id/
-- routing_step_id/work_center_id (mekanisme lama, cuma pas untuk 1 mesin
-- spesifik yang sudah teruji di migrasi 20260813160000).

-- 0 baris existing di production_disruptions saat migrasi ini ditulis, jadi
-- production_plant_id aman langsung di-set NOT NULL tanpa perlu backfill.
alter table if exists production_disruptions
  add column if not exists production_plant_id integer references production_plants(production_plant_id),
  add column if not exists production_batch_id integer references production_batches(production_batch_id);

alter table if exists production_disruptions
  alter column production_plant_id set not null;

create index if not exists production_disruptions_plant_id_idx on production_disruptions (production_plant_id);
create index if not exists production_disruptions_batch_id_idx on production_disruptions (production_batch_id);

-- work_orders_readiness SEBELUMNYA cuma menghitung 'blocked' untuk WO berstatus
-- 'planned' (dokumentasi "Ready to Start" — soal siap MULAI). Begitu WO pindah
-- 'in_progress', readiness ikut jadi 'in_progress' APAPUN status alert-nya —
-- artinya WO yang SEDANG BERJALAN lalu kena gangguan tidak pernah kelihatan
-- "Blocked" di UI manapun. Diperluas: 'in_progress' + ada alert terbuka JUGA
-- dihitung 'blocked' (WO paused/completed/cancelled TETAP apa adanya, alert di
-- sana tidak relevan).
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
    when wo.status not in ('planned', 'in_progress') then wo.status
    when exists (select 1 from system_alerts sa where sa.related_work_order_id = wo.work_order_id and sa.status = 'open') then 'blocked'
    when wo.status = 'planned' then 'ready'
    else wo.status
  end as readiness
from work_orders wo;

grant select on work_orders_readiness to authenticated;

-- Perluas pencocokan gangguan→WO: tambah cabang "menyeluruh" (work_center_id
-- kosong, cocok lewat production_plant_id WO itu sendiri — work_orders sudah
-- punya kolom ini). 3 cabang lama (work_order_id / routing_step_id /
-- work_center_id spesifik) TIDAK diubah.
create or replace function public.recompute_work_order_machine_readiness(p_work_order_id integer)
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
      or (pd.work_center_id is null and pd.production_plant_id = v_wo.production_plant_id)
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

-- Perluas pemicu recheck: saat gangguan MENYELURUH (work_center_id kosong)
-- dibuat/di-resolve, cari SEMUA WO aktif di production_plant_id itu (cabang
-- baru) — bukan cuma yang eksplisit ditaut. 3 cabang lama TIDAK diubah.
create or replace function public.trigger_recheck_wo_machine_readiness()
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
        or (v_row.work_center_id is null and wo.production_plant_id = v_row.production_plant_id)
      )
  loop
    perform public.recompute_work_order_machine_readiness(v_wo_id);
  end loop;
  return v_row;
end;
$$;

drop trigger if exists production_disruptions_recheck_readiness on production_disruptions;
create trigger production_disruptions_recheck_readiness
  after insert or update of resolved_at, work_center_id, routing_step_id, work_order_id, production_plant_id or delete on production_disruptions
  for each row
  execute function public.trigger_recheck_wo_machine_readiness();
