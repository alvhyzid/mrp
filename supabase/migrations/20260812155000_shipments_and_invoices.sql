-- Migration: shipments/shipment_lines (Kelompok 4) & invoices (Kelompok 6) — tabel
-- terakhir dari rancangan skema saat ini. Margin per pengiriman (lihat docs) dihitung
-- dari data yang sudah ada (sales_order_lines.unit_price, work_order_consumption x
-- lots.unit_cost, work_order_assignments) di lapisan aplikasi/fungsi nanti — bukan
-- kolom baru di sini.

create table if not exists shipments (
  shipment_id serial primary key,
  company_id integer not null references companies(company_id),
  sales_order_id integer not null references sales_orders(sales_order_id),
  shipment_date date not null default current_date,
  status text not null default 'draft' check (status in ('draft', 'shipped', 'delivered', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists shipments_company_id_idx on shipments (company_id);

alter table if exists shipments enable row level security;

drop policy if exists shipments_select_for_company on shipments;
create policy shipments_select_for_company on shipments
  for select using (company_id = public.jwt_company_id());

drop policy if exists shipments_write_warehouse on shipments;
create policy shipments_write_warehouse on shipments
  for all using (
    company_id = public.jwt_company_id()
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('warehouse_manager', 'warehouse_staff', 'ppic_manager'))
  )
  with check (
    company_id = public.jwt_company_id()
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('warehouse_manager', 'warehouse_staff', 'ppic_manager'))
  );

create table if not exists shipment_lines (
  shipment_line_id serial primary key,
  shipment_id integer not null references shipments(shipment_id),
  sales_order_line_id integer not null references sales_order_lines(sales_order_line_id),
  item_id integer not null references items(item_id),
  qty_shipped numeric(14,4) not null,
  lot_id integer references lots(lot_id)
);

create index if not exists shipment_lines_shipment_id_idx on shipment_lines (shipment_id);

alter table if exists shipment_lines enable row level security;

drop policy if exists shipment_lines_select_for_company on shipment_lines;
create policy shipment_lines_select_for_company on shipment_lines
  for select using (
    exists (select 1 from shipments s where s.shipment_id = shipment_lines.shipment_id and s.company_id = public.jwt_company_id())
  );

drop policy if exists shipment_lines_write_warehouse on shipment_lines;
create policy shipment_lines_write_warehouse on shipment_lines
  for all using (
    exists (select 1 from shipments s where s.shipment_id = shipment_lines.shipment_id and s.company_id = public.jwt_company_id())
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('warehouse_manager', 'warehouse_staff', 'ppic_manager'))
  )
  with check (
    exists (select 1 from shipments s where s.shipment_id = shipment_lines.shipment_id and s.company_id = public.jwt_company_id())
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('warehouse_manager', 'warehouse_staff', 'ppic_manager'))
  );

create table if not exists invoices (
  invoice_id serial primary key,
  company_id integer not null references companies(company_id),
  subscription_plan_id integer references subscription_plans(subscription_plan_id),
  amount numeric(14,2) not null,
  status text not null default 'unpaid' check (status in ('unpaid', 'paid', 'overdue')),
  payment_gateway_ref text,
  period_start date,
  period_end date,
  created_at timestamptz not null default now()
);

create index if not exists invoices_company_id_idx on invoices (company_id);

alter table if exists invoices enable row level security;

-- Data billing sensitif secara berbeda (bukan margin operasional, tapi tagihan
-- langganan platform) — hanya leadership yang boleh melihat/mengubah.
drop policy if exists invoices_select_leadership on invoices;
create policy invoices_select_leadership on invoices
  for select using (company_id = public.jwt_company_id() and public.jwt_is_company_leadership());
