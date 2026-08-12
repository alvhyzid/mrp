-- Migration: suppliers + purchase_orders/purchase_order_lines (PO KITA ke supplier),
-- dengan production_plant_id sebagai alamat kirim, dan masking unit_price.

create table if not exists suppliers (
  supplier_id serial primary key,
  company_id integer not null references companies(company_id),
  name text not null,
  contact_info text,
  lead_time_days integer,
  supplier_type text not null default 'material_supplier'
    check (supplier_type in ('material_supplier', 'subcontractor', 'both')),
  created_at timestamptz not null default now()
);

create index if not exists suppliers_company_id_idx on suppliers (company_id);

alter table if exists suppliers enable row level security;

drop policy if exists suppliers_select_for_company on suppliers;
create policy suppliers_select_for_company on suppliers
  for select using (company_id = public.jwt_company_id());

drop policy if exists suppliers_write_purchasing on suppliers;
create policy suppliers_write_purchasing on suppliers
  for all using (
    company_id = public.jwt_company_id()
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('purchasing_manager', 'purchasing_staff'))
  )
  with check (
    company_id = public.jwt_company_id()
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('purchasing_manager', 'purchasing_staff'))
  );

create table if not exists purchase_orders (
  purchase_order_id serial primary key,
  company_id integer not null references companies(company_id),
  supplier_id integer not null references suppliers(supplier_id),
  production_plant_id integer not null references production_plants(production_plant_id),
  status text not null default 'draft'
    check (status in ('draft', 'ordered', 'partially_received', 'received', 'cancelled')),
  order_date date not null default current_date,
  expected_date date,
  created_at timestamptz not null default now()
);

create index if not exists purchase_orders_company_id_idx on purchase_orders (company_id);

alter table if exists purchase_orders enable row level security;

drop policy if exists purchase_orders_select_for_company on purchase_orders;
create policy purchase_orders_select_for_company on purchase_orders
  for select using (company_id = public.jwt_company_id());

drop policy if exists purchase_orders_write_purchasing on purchase_orders;
create policy purchase_orders_write_purchasing on purchase_orders
  for all using (
    company_id = public.jwt_company_id()
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('purchasing_manager', 'purchasing_staff'))
  )
  with check (
    company_id = public.jwt_company_id()
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('purchasing_manager', 'purchasing_staff'))
  );

create table if not exists purchase_order_lines (
  purchase_order_line_id serial primary key,
  purchase_order_id integer not null references purchase_orders(purchase_order_id),
  item_id integer not null references items(item_id),
  qty_ordered numeric(14,4) not null,
  qty_received numeric(14,4) not null default 0,
  unit_price numeric(14,4)
);

create index if not exists purchase_order_lines_po_id_idx on purchase_order_lines (purchase_order_id);

alter table if exists purchase_order_lines enable row level security;

-- unit_price sensitif (lihat Kontrol Akses Data Finansial): boleh dilihat Purchasing
-- (mereka yang input) + role finansial/leadership. Tidak ada policy select di tabel
-- dasar — akses baca aman lewat view purchase_order_lines_secure.
drop policy if exists purchase_order_lines_write_purchasing on purchase_order_lines;
create policy purchase_order_lines_write_purchasing on purchase_order_lines
  for all using (
    exists (
      select 1 from purchase_orders po
      where po.purchase_order_id = purchase_order_lines.purchase_order_id
        and po.company_id = public.jwt_company_id()
    )
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('purchasing_manager', 'purchasing_staff'))
  )
  with check (
    exists (
      select 1 from purchase_orders po
      where po.purchase_order_id = purchase_order_lines.purchase_order_id
        and po.company_id = public.jwt_company_id()
    )
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('purchasing_manager', 'purchasing_staff'))
  );

drop view if exists purchase_order_lines_secure;
create view purchase_order_lines_secure
with (security_invoker = false)
as
select
  pol.purchase_order_line_id,
  pol.purchase_order_id,
  pol.item_id,
  pol.qty_ordered,
  pol.qty_received,
  case
    when public.jwt_can_view_financial_data() or public.jwt_app_role() in ('purchasing_manager', 'purchasing_staff')
      then pol.unit_price
    else null
  end as unit_price
from purchase_order_lines pol
join purchase_orders po on po.purchase_order_id = pol.purchase_order_id
where po.company_id = public.jwt_company_id();

grant select on purchase_order_lines_secure to authenticated;
