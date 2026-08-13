-- Migration: menutup celah nyata yang ditemukan lewat pengujian manual — Work Order
-- baru SELALU muncul "ready" walau stok bahan BOM-nya nol, karena tidak ada apa pun
-- yang benar-benar MEMBUAT system_alerts material_shortage. Mekanisme
-- work_orders_readiness/work_order_is_blocked() (migration 20260812154000) cuma
-- membaca alert yang SUDAH ada — sebelumnya cuma pernah diuji dengan alert yang
-- disisipkan manual, bukan dibuat otomatis oleh sistem seperti yang didokumentasikan.
--
-- recompute_work_order_material_readiness(): untuk satu WO, bandingkan kebutuhan
-- tiap komponen BOM-nya (qty_per_unit_output * planned_qty) terhadap stok available
-- saat ini (di plant yang sama), lalu buka/tutup alert material_shortage per
-- (work_order, item) sesuai hasilnya. Dipanggil dari 2 arah:
--  1) trigger AFTER INSERT work_orders -> cek begitu WO baru dibuat.
--  2) trigger AFTER INSERT/UPDATE lots (quantity_on_hand berubah) -> cek ulang semua
--     WO aktif yang butuh item itu, cara apa pun stoknya berubah (goods receipt,
--     konsumsi, atau update manual/seed).

drop function if exists public.recompute_work_order_material_readiness(integer);
create function public.recompute_work_order_material_readiness(p_work_order_id integer)
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
  v_open_alert_id integer;
  v_item_name text;
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

    select sa.system_alert_id into v_open_alert_id
    from system_alerts sa
    where sa.related_work_order_id = p_work_order_id
      and sa.related_item_id = v_line.component_item_id
      and sa.alert_type = 'material_shortage'
      and sa.status = 'open'
    limit 1;

    if v_available < v_required then
      if v_open_alert_id is null then
        insert into system_alerts (company_id, alert_type, related_work_order_id, related_item_id, message, severity)
        values (
          v_wo.company_id, 'material_shortage', p_work_order_id, v_line.component_item_id,
          format('Menunggu bahan %s — butuh %s %s, stok tersedia cuma %s %s.', v_line.item_name, v_required, v_line.base_uom, v_available, v_line.base_uom),
          'critical'
        );
      else
        update system_alerts
        set message = format('Menunggu bahan %s — butuh %s %s, stok tersedia cuma %s %s.', v_line.item_name, v_required, v_line.base_uom, v_available, v_line.base_uom)
        where system_alert_id = v_open_alert_id;
      end if;
    elsif v_open_alert_id is not null then
      update system_alerts set status = 'resolved' where system_alert_id = v_open_alert_id;
    end if;
  end loop;
end;
$$;

grant execute on function public.recompute_work_order_material_readiness(integer) to authenticated;

drop function if exists public.trigger_check_wo_material_on_insert();
create function public.trigger_check_wo_material_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  perform public.recompute_work_order_material_readiness(new.work_order_id);
  return new;
end;
$$;

drop trigger if exists work_orders_check_material_readiness on work_orders;
create trigger work_orders_check_material_readiness
  after insert on work_orders
  for each row
  execute function public.trigger_check_wo_material_on_insert();

-- Stok berubah (goods receipt bikin lot baru, konsumsi/adjustment ubah
-- quantity_on_hand, atau update manual/seed apa pun) -> cek ulang semua WO aktif
-- (planned/in_progress/paused) yang BOM-nya butuh item itu DI PLANT YANG SAMA.
drop function if exists public.trigger_recheck_wo_readiness_on_lot_change();
create function public.trigger_recheck_wo_readiness_on_lot_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_wo_id integer;
begin
  for v_wo_id in
    select distinct wo.work_order_id
    from work_orders wo
    join bom_lines bl on bl.bom_id = wo.bom_id
    where bl.component_item_id = new.item_id
      and wo.production_plant_id = new.production_plant_id
      and wo.status in ('planned', 'in_progress', 'paused')
  loop
    perform public.recompute_work_order_material_readiness(v_wo_id);
  end loop;
  return new;
end;
$$;

drop trigger if exists lots_recheck_wo_readiness on lots;
create trigger lots_recheck_wo_readiness
  after insert or update of quantity_on_hand, status on lots
  for each row
  execute function public.trigger_recheck_wo_readiness_on_lot_change();
