-- Migration: sales_orders/sales_order_lines (Kelompok 4) — tercipta OTOMATIS lewat
-- fungsi process_customer_purchase_order() saat PO client diproses (data lines
-- disalin, bukan dirujuk). unit_price di sales_order_lines sensitif, dimasking.

create table if not exists sales_orders (
  sales_order_id serial primary key,
  company_id integer not null references companies(company_id),
  customer_purchase_order_id integer not null unique references customer_purchase_orders(customer_purchase_order_id),
  customer_id integer not null references customers(customer_id),
  production_plant_id integer not null references production_plants(production_plant_id),
  status text not null default 'confirmed' check (status in ('confirmed', 'in_production', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists sales_orders_company_id_idx on sales_orders (company_id);

alter table if exists sales_orders enable row level security;

drop policy if exists sales_orders_select_for_company on sales_orders;
create policy sales_orders_select_for_company on sales_orders
  for select using (company_id = public.jwt_company_id());

-- Tidak ada policy insert: sales_orders HANYA dibuat lewat fungsi
-- process_customer_purchase_order() (security definer) di bawah.
drop policy if exists sales_orders_update_ppic on sales_orders;
create policy sales_orders_update_ppic on sales_orders
  for update using (
    company_id = public.jwt_company_id()
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('ppic_manager', 'ppic_staff', 'production_manager'))
  )
  with check (company_id = public.jwt_company_id());

create table if not exists sales_order_lines (
  sales_order_line_id serial primary key,
  sales_order_id integer not null references sales_orders(sales_order_id),
  item_id integer not null references items(item_id),
  qty_ordered numeric(14,4) not null,
  unit_price numeric(14,4) not null
);

create index if not exists sales_order_lines_so_id_idx on sales_order_lines (sales_order_id);

alter table if exists sales_order_lines enable row level security;

-- Tidak ada policy select/insert di tabel dasar untuk sales_order_lines — baris
-- dibuat lewat fungsi process_customer_purchase_order(), dan unit_price (harga jual)
-- sensitif sehingga akses baca lewat view sales_order_lines_secure saja.
drop view if exists sales_order_lines_secure;
create view sales_order_lines_secure
with (security_invoker = false)
as
select
  sol.sales_order_line_id,
  sol.sales_order_id,
  sol.item_id,
  sol.qty_ordered,
  case when public.jwt_can_view_financial_data() then sol.unit_price else null end as unit_price
from sales_order_lines sol
join sales_orders so on so.sales_order_id = sol.sales_order_id
where so.company_id = public.jwt_company_id();

grant select on sales_order_lines_secure to authenticated;

-- "Process" PO client -> SO: hanya boleh kalau ketiga customer_po_approvals approved,
-- status PO masih 'new', dan pemroses memilih production_plant_id (menentukan SDM/
-- lokasi produksi yang dipakai). Data customer_purchase_order_lines DISALIN ke
-- sales_order_lines, bukan dirujuk (lihat docs).
drop function if exists public.process_customer_purchase_order(integer, integer);
create function public.process_customer_purchase_order(
  p_customer_purchase_order_id integer,
  p_production_plant_id integer
)
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_po customer_purchase_orders%rowtype;
  v_plant_company_id integer;
  v_approved_count integer;
  v_processed_by integer;
  v_sales_order_id integer;
begin
  select * into v_po from customer_purchase_orders where customer_purchase_order_id = p_customer_purchase_order_id;

  if v_po.customer_purchase_order_id is null or v_po.company_id <> public.jwt_company_id() then
    raise exception 'PO client tidak ditemukan di perusahaan Anda.';
  end if;

  if not (public.jwt_is_company_leadership() or public.jwt_app_role() = 'ppic_manager') then
    raise exception 'Hanya company_admin, general_manager, atau ppic_manager yang boleh memproses PO client.';
  end if;

  if v_po.status <> 'new' then
    raise exception 'PO client hanya bisa diproses dari status new (status saat ini: %).', v_po.status;
  end if;

  select count(*) into v_approved_count
  from customer_po_approvals
  where customer_purchase_order_id = p_customer_purchase_order_id and status = 'approved';

  if v_approved_count < 3 then
    raise exception 'PO client belum disetujui oleh ketiga department (baru % dari 3).', v_approved_count;
  end if;

  select company_id into v_plant_company_id from production_plants where production_plant_id = p_production_plant_id;
  if v_plant_company_id is null or v_plant_company_id <> v_po.company_id then
    raise exception 'Lokasi pabrik tidak valid untuk perusahaan Anda.';
  end if;

  select user_id into v_processed_by from users where auth_uid = auth.uid()::text;

  insert into sales_orders (company_id, customer_purchase_order_id, customer_id, production_plant_id, status)
  values (v_po.company_id, v_po.customer_purchase_order_id, v_po.customer_id, p_production_plant_id, 'confirmed')
  returning sales_order_id into v_sales_order_id;

  insert into sales_order_lines (sales_order_id, item_id, qty_ordered, unit_price)
  select v_sales_order_id, cpol.item_id, cpol.qty_ordered, cpol.unit_price
  from customer_purchase_order_lines cpol
  where cpol.customer_purchase_order_id = v_po.customer_purchase_order_id;

  update customer_purchase_orders
  set status = 'processed', processed_by = v_processed_by, processed_at = now()
  where customer_purchase_order_id = v_po.customer_purchase_order_id;

  return v_sales_order_id;
end;
$$;

grant execute on function public.process_customer_purchase_order(integer, integer) to authenticated;
