-- Migration: Create items (Item Master) table with company_id RLS

create table if not exists items (
  item_id serial primary key,
  company_id integer not null references companies(company_id),
  item_code text not null,
  name text not null,
  type text not null check (type in ('raw_material', 'wip', 'finished_good', 'packaging')),
  uom text not null,
  shelf_life_days integer,
  min_stock_level numeric(14,4) not null default 0,
  reorder_point numeric(14,4),
  reorder_qty numeric(14,4),
  is_active boolean not null default true,
  standard_cost numeric(14,4),
  created_at timestamptz not null default now(),
  unique (company_id, item_code)
);

create index if not exists items_company_id_idx on items (company_id);

alter table if exists items enable row level security;

drop policy if exists items_select_for_company on items;
create policy items_select_for_company on items
  for select using (company_id = (auth.jwt() ->> 'company_id')::integer);

drop policy if exists items_insert_for_company on items;
create policy items_insert_for_company on items
  for insert with check (company_id = (auth.jwt() ->> 'company_id')::integer);

drop policy if exists items_update_for_company on items;
create policy items_update_for_company on items
  for update using (company_id = (auth.jwt() ->> 'company_id')::integer)
  with check (company_id = (auth.jwt() ->> 'company_id')::integer);
