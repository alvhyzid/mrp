-- Migration: customers, customer_purchase_orders/lines, customer_po_approvals
-- (Kelompok 4) — PO dari client, terpisah dari sales_orders/purchase_orders.
-- 3 baris customer_po_approvals dibuat OTOMATIS lewat trigger begitu PO baru masuk.

create table if not exists customers (
  customer_id serial primary key,
  company_id integer not null references companies(company_id),
  name text not null,
  contact_info text,
  created_at timestamptz not null default now()
);

create index if not exists customers_company_id_idx on customers (company_id);

alter table if exists customers enable row level security;

drop policy if exists customers_select_for_company on customers;
create policy customers_select_for_company on customers
  for select using (company_id = public.jwt_company_id());

drop policy if exists customers_write_ppic on customers;
create policy customers_write_ppic on customers
  for all using (
    company_id = public.jwt_company_id()
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('ppic_manager', 'ppic_staff'))
  )
  with check (
    company_id = public.jwt_company_id()
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('ppic_manager', 'ppic_staff'))
  );

create table if not exists customer_purchase_orders (
  customer_purchase_order_id serial primary key,
  company_id integer not null references companies(company_id),
  customer_id integer not null references customers(customer_id),
  po_number text not null,
  po_date date not null default current_date,
  requested_ship_date date,
  status text not null default 'new' check (status in ('new', 'on_hold', 'cancelled', 'processed')),
  payment_terms text check (payment_terms in ('full', 'tempo')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'partial', 'confirmed')),
  processed_by integer references users(user_id),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (company_id, po_number)
);

create index if not exists customer_purchase_orders_company_id_idx on customer_purchase_orders (company_id);

alter table if exists customer_purchase_orders enable row level security;

drop policy if exists customer_purchase_orders_select_for_company on customer_purchase_orders;
create policy customer_purchase_orders_select_for_company on customer_purchase_orders
  for select using (company_id = public.jwt_company_id());

drop policy if exists customer_purchase_orders_insert_ppic on customer_purchase_orders;
create policy customer_purchase_orders_insert_ppic on customer_purchase_orders
  for insert with check (
    company_id = public.jwt_company_id()
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('ppic_manager', 'ppic_staff'))
    and status = 'new'
  );

-- Transisi ke 'processed' HANYA lewat fungsi process_customer_purchase_order()
-- (security definer, cek 3 approval dulu) — policy update biasa sengaja menolak
-- status 'processed' supaya tidak bisa dilewati lewat PATCH langsung ke REST API.
drop policy if exists customer_purchase_orders_update_ppic on customer_purchase_orders;
create policy customer_purchase_orders_update_ppic on customer_purchase_orders
  for update using (
    company_id = public.jwt_company_id()
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('ppic_manager', 'ppic_staff'))
  )
  with check (
    company_id = public.jwt_company_id()
    and status in ('new', 'on_hold', 'cancelled')
  );

create table if not exists customer_purchase_order_lines (
  customer_purchase_order_line_id serial primary key,
  customer_purchase_order_id integer not null references customer_purchase_orders(customer_purchase_order_id),
  item_id integer not null references items(item_id),
  qty_ordered numeric(14,4) not null,
  unit_price numeric(14,4) not null
);

create index if not exists customer_po_lines_po_id_idx on customer_purchase_order_lines (customer_purchase_order_id);

alter table if exists customer_purchase_order_lines enable row level security;

-- unit_price = harga jual, sensitif — tidak ada policy select di tabel dasar, akses
-- baca aman lewat view customer_purchase_order_lines_secure.
drop policy if exists customer_po_lines_write_ppic on customer_purchase_order_lines;
create policy customer_po_lines_write_ppic on customer_purchase_order_lines
  for all using (
    exists (
      select 1 from customer_purchase_orders cpo
      where cpo.customer_purchase_order_id = customer_purchase_order_lines.customer_purchase_order_id
        and cpo.company_id = public.jwt_company_id()
    )
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('ppic_manager', 'ppic_staff'))
  )
  with check (
    exists (
      select 1 from customer_purchase_orders cpo
      where cpo.customer_purchase_order_id = customer_purchase_order_lines.customer_purchase_order_id
        and cpo.company_id = public.jwt_company_id()
    )
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('ppic_manager', 'ppic_staff'))
  );

drop view if exists customer_purchase_order_lines_secure;
create view customer_purchase_order_lines_secure
with (security_invoker = false)
as
select
  cpol.customer_purchase_order_line_id,
  cpol.customer_purchase_order_id,
  cpol.item_id,
  cpol.qty_ordered,
  case when public.jwt_can_view_financial_data() then cpol.unit_price else null end as unit_price
from customer_purchase_order_lines cpol
join customer_purchase_orders cpo on cpo.customer_purchase_order_id = cpol.customer_purchase_order_id
where cpo.company_id = public.jwt_company_id();

grant select on customer_purchase_order_lines_secure to authenticated;

create table if not exists customer_po_approvals (
  customer_po_approval_id serial primary key,
  customer_purchase_order_id integer not null references customer_purchase_orders(customer_purchase_order_id),
  department text not null check (department in ('finance', 'ppic', 'manager')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  approved_by integer references users(user_id),
  approved_at timestamptz,
  notes text,
  unique (customer_purchase_order_id, department)
);

create index if not exists customer_po_approvals_po_id_idx on customer_po_approvals (customer_purchase_order_id);

alter table if exists customer_po_approvals enable row level security;

drop policy if exists customer_po_approvals_select_for_company on customer_po_approvals;
create policy customer_po_approvals_select_for_company on customer_po_approvals
  for select using (
    exists (
      select 1 from customer_purchase_orders cpo
      where cpo.customer_purchase_order_id = customer_po_approvals.customer_purchase_order_id
        and cpo.company_id = public.jwt_company_id()
    )
  );

-- Tidak ada policy insert: 3 baris approval HANYA dibuat lewat trigger (security
-- definer) di bawah, tidak boleh dibuat manual oleh user mana pun.
-- Approve/reject hanya oleh role yang dipetakan ke department masing-masing
-- (lihat catatan pemetaan department->role di docs).
drop policy if exists customer_po_approvals_update_by_department on customer_po_approvals;
create policy customer_po_approvals_update_by_department on customer_po_approvals
  for update using (
    exists (
      select 1 from customer_purchase_orders cpo
      where cpo.customer_purchase_order_id = customer_po_approvals.customer_purchase_order_id
        and cpo.company_id = public.jwt_company_id()
    )
    and (
      (department = 'finance' and public.jwt_app_role() = 'finance_manager')
      or (department = 'ppic' and public.jwt_app_role() = 'ppic_manager')
      or (department = 'manager' and public.jwt_is_company_leadership())
    )
  )
  with check (status in ('approved', 'rejected'));

drop function if exists public.create_customer_po_approvals();
create function public.create_customer_po_approvals()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  insert into customer_po_approvals (customer_purchase_order_id, department, status)
  values
    (new.customer_purchase_order_id, 'finance', 'pending'),
    (new.customer_purchase_order_id, 'ppic', 'pending'),
    (new.customer_purchase_order_id, 'manager', 'pending');
  return new;
end;
$$;

drop trigger if exists customer_purchase_orders_create_approvals on customer_purchase_orders;
create trigger customer_purchase_orders_create_approvals
  after insert on customer_purchase_orders
  for each row
  execute function public.create_customer_po_approvals();
