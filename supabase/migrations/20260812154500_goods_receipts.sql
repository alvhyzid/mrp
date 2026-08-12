-- Migration: goods_receipts/goods_receipt_lines (Kelompok 4) — konfirmasi kedatangan
-- barang oleh Warehouse. Trigger pada goods_receipt_lines: konversi qty_received
-- (purchase_uom) ke base_uom pakai items.uom_conversion_factor, buat lot baru,
-- catat stock_movement, update purchase_order_lines.qty_received, dan otomatis
-- resolve system_alerts (material_shortage utk item ini / po_delayed utk PO ini).

create table if not exists goods_receipts (
  goods_receipt_id serial primary key,
  company_id integer not null references companies(company_id),
  purchase_order_id integer not null references purchase_orders(purchase_order_id),
  production_plant_id integer not null references production_plants(production_plant_id),
  received_date date not null default current_date,
  received_by integer references users(user_id),
  status text not null default 'completed' check (status in ('draft', 'completed')),
  created_at timestamptz not null default now()
);

create index if not exists goods_receipts_company_id_idx on goods_receipts (company_id);

alter table if exists goods_receipts enable row level security;

drop policy if exists goods_receipts_select_for_company on goods_receipts;
create policy goods_receipts_select_for_company on goods_receipts
  for select using (company_id = public.jwt_company_id());

drop policy if exists goods_receipts_write_warehouse on goods_receipts;
create policy goods_receipts_write_warehouse on goods_receipts
  for all using (
    company_id = public.jwt_company_id()
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('warehouse_manager', 'warehouse_staff'))
  )
  with check (
    company_id = public.jwt_company_id()
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('warehouse_manager', 'warehouse_staff'))
  );

create table if not exists goods_receipt_lines (
  goods_receipt_line_id serial primary key,
  goods_receipt_id integer not null references goods_receipts(goods_receipt_id),
  purchase_order_line_id integer not null references purchase_order_lines(purchase_order_line_id),
  item_id integer not null references items(item_id),
  qty_received numeric(14,4) not null,
  lot_id integer references lots(lot_id)
);

create index if not exists goods_receipt_lines_gr_id_idx on goods_receipt_lines (goods_receipt_id);

alter table if exists goods_receipt_lines enable row level security;

drop policy if exists goods_receipt_lines_select_for_company on goods_receipt_lines;
create policy goods_receipt_lines_select_for_company on goods_receipt_lines
  for select using (
    exists (select 1 from goods_receipts gr where gr.goods_receipt_id = goods_receipt_lines.goods_receipt_id and gr.company_id = public.jwt_company_id())
  );

drop policy if exists goods_receipt_lines_write_warehouse on goods_receipt_lines;
create policy goods_receipt_lines_write_warehouse on goods_receipt_lines
  for insert with check (
    exists (select 1 from goods_receipts gr where gr.goods_receipt_id = goods_receipt_lines.goods_receipt_id and gr.company_id = public.jwt_company_id())
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('warehouse_manager', 'warehouse_staff'))
  );

drop function if exists public.process_goods_receipt_line();
create function public.process_goods_receipt_line()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_gr goods_receipts%rowtype;
  v_item items%rowtype;
  v_pol purchase_order_lines%rowtype;
  v_base_qty numeric;
  v_unit_cost numeric;
  v_lot_id integer;
  v_lot_number text;
begin
  select * into v_gr from goods_receipts where goods_receipt_id = new.goods_receipt_id;
  select * into v_item from items where item_id = new.item_id;
  select * into v_pol from purchase_order_lines where purchase_order_line_id = new.purchase_order_line_id;

  v_base_qty := new.qty_received * coalesce(v_item.uom_conversion_factor, 1);
  v_unit_cost := case when v_pol.unit_price is not null and coalesce(v_item.uom_conversion_factor, 1) > 0
    then v_pol.unit_price / v_item.uom_conversion_factor
    else null
  end;

  v_lot_number := 'GR-' || new.goods_receipt_id || '-' || new.goods_receipt_line_id;

  insert into lots (
    company_id, production_plant_id, item_id, lot_number,
    produced_or_received_date, quantity_on_hand, source_type, status, unit_cost
  )
  values (
    v_gr.company_id, v_gr.production_plant_id, new.item_id, v_lot_number,
    v_gr.received_date, v_base_qty, 'purchased', 'available', v_unit_cost
  )
  returning lot_id into v_lot_id;

  update goods_receipt_lines set lot_id = v_lot_id where goods_receipt_line_id = new.goods_receipt_line_id;

  insert into stock_movements (company_id, lot_id, movement_type, qty, reference_doc, created_by)
  values (v_gr.company_id, v_lot_id, 'receipt', v_base_qty, 'GR-' || new.goods_receipt_id, v_gr.received_by);

  update purchase_order_lines
  set qty_received = qty_received + new.qty_received
  where purchase_order_line_id = new.purchase_order_line_id;

  -- Otomatis selesaikan alert kekurangan bahan (item ini) & PO telat (PO ini) yang
  -- masih terbuka, karena barangnya sudah datang.
  update system_alerts
  set status = 'resolved'
  where company_id = v_gr.company_id
    and status = 'open'
    and (
      (alert_type = 'material_shortage' and related_item_id = new.item_id)
      or (alert_type = 'po_delayed' and related_po_id = v_gr.purchase_order_id)
    );

  perform public.recompute_stock_projection_for_item(new.item_id);

  return new;
end;
$$;

drop trigger if exists goods_receipt_lines_process on goods_receipt_lines;
create trigger goods_receipt_lines_process
  after insert on goods_receipt_lines
  for each row
  execute function public.process_goods_receipt_line();
