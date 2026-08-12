-- Migration: fix — work_order_consumption sebelumnya TIDAK mengurangi
-- lots.quantity_on_hand, sehingga proyeksi stok (recompute_stock_projection_for_item)
-- tidak pernah melihat efek pemakaian nyata. Trigger diperluas: tiap baris
-- work_order_consumption baru sekarang juga mengurangi stok lot terkait dan mencatat
-- stock_movements (movement_type = production_issue, qty negatif = pengurangan),
-- baru lalu menghitung ulang proyeksi.

create or replace function public.trigger_recompute_stock_projection()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_item_id integer;
  v_company_id integer;
begin
  select item_id, company_id into v_item_id, v_company_id from lots where lot_id = new.component_lot_id;

  if v_item_id is not null then
    update lots
    set quantity_on_hand = quantity_on_hand - new.qty_consumed
    where lot_id = new.component_lot_id;

    insert into stock_movements (company_id, lot_id, movement_type, qty, reference_doc, created_by)
    values (v_company_id, new.component_lot_id, 'production_issue', -new.qty_consumed, 'WO-' || new.work_order_id, null);

    perform public.recompute_stock_projection_for_item(v_item_id);
  end if;

  return new;
end;
$$;
