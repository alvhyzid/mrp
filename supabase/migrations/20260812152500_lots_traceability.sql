-- Migration: lots, lot_genealogy, stock_movements (Kelompok 3), dengan production_plant_id
-- dan masking unit_cost (data finansial sensitif).

create table if not exists lots (
  lot_id serial primary key,
  company_id integer not null references companies(company_id),
  production_plant_id integer not null references production_plants(production_plant_id),
  item_id integer not null references items(item_id),
  lot_number text not null,
  expiry_date date,
  produced_or_received_date date not null default current_date,
  quantity_on_hand numeric(14,4) not null default 0,
  source_type text not null check (source_type in ('purchased', 'produced')),
  status text not null default 'available'
    check (status in ('available', 'quarantine', 'expired', 'consumed')),
  unit_cost numeric(14,4),
  created_at timestamptz not null default now(),
  unique (company_id, lot_number)
);

create index if not exists lots_company_id_idx on lots (company_id);
create index if not exists lots_item_id_idx on lots (item_id);

alter table if exists lots enable row level security;

-- unit_cost sensitif — tidak ada policy select di tabel dasar, akses baca aman lewat
-- view lots_secure. Insert/update lewat operasional gudang/produksi/leadership;
-- proses otomatis (goods receipt, output produksi) memakai fungsi security definer
-- yang melewati RLS ini.
drop policy if exists lots_write_operations on lots;
create policy lots_write_operations on lots
  for all using (
    company_id = public.jwt_company_id()
    and (
      public.jwt_is_company_leadership()
      or public.jwt_app_role() in ('warehouse_manager', 'warehouse_staff', 'production_manager', 'production_staff', 'ppic_manager', 'ppic_staff')
    )
  )
  with check (
    company_id = public.jwt_company_id()
    and (
      public.jwt_is_company_leadership()
      or public.jwt_app_role() in ('warehouse_manager', 'warehouse_staff', 'production_manager', 'production_staff', 'ppic_manager', 'ppic_staff')
    )
  );

drop view if exists lots_secure;
create view lots_secure
with (security_invoker = false)
as
select
  lot_id,
  company_id,
  production_plant_id,
  item_id,
  lot_number,
  expiry_date,
  produced_or_received_date,
  quantity_on_hand,
  source_type,
  status,
  case when public.jwt_can_view_financial_data() then unit_cost else null end as unit_cost,
  created_at
from lots
where company_id = public.jwt_company_id();

grant select on lots_secure to authenticated;

create table if not exists lot_genealogy (
  lot_genealogy_id serial primary key,
  output_lot_id integer not null references lots(lot_id),
  component_lot_id integer not null references lots(lot_id),
  qty_consumed numeric(14,4) not null
);

alter table if exists lot_genealogy enable row level security;

drop policy if exists lot_genealogy_select_for_company on lot_genealogy;
create policy lot_genealogy_select_for_company on lot_genealogy
  for select using (
    exists (
      select 1 from lots l
      where l.lot_id = lot_genealogy.output_lot_id
        and l.company_id = public.jwt_company_id()
    )
  );

drop policy if exists lot_genealogy_write_operations on lot_genealogy;
create policy lot_genealogy_write_operations on lot_genealogy
  for insert with check (
    exists (
      select 1 from lots l
      where l.lot_id = lot_genealogy.output_lot_id
        and l.company_id = public.jwt_company_id()
    )
    and (
      public.jwt_is_company_leadership()
      or public.jwt_app_role() in ('warehouse_manager', 'warehouse_staff', 'production_manager', 'production_staff', 'ppic_manager', 'ppic_staff')
    )
  );

create table if not exists stock_movements (
  stock_movement_id serial primary key,
  company_id integer not null references companies(company_id),
  lot_id integer not null references lots(lot_id),
  movement_type text not null
    check (movement_type in ('receipt', 'production_issue', 'production_output', 'shipment', 'adjustment')),
  qty numeric(14,4) not null,
  reference_doc text,
  created_at timestamptz not null default now(),
  created_by integer references users(user_id)
);

create index if not exists stock_movements_company_id_idx on stock_movements (company_id);
create index if not exists stock_movements_lot_id_idx on stock_movements (lot_id);

alter table if exists stock_movements enable row level security;

drop policy if exists stock_movements_select_for_company on stock_movements;
create policy stock_movements_select_for_company on stock_movements
  for select using (company_id = public.jwt_company_id());

drop policy if exists stock_movements_write_operations on stock_movements;
create policy stock_movements_write_operations on stock_movements
  for insert with check (
    company_id = public.jwt_company_id()
    and (
      public.jwt_is_company_leadership()
      or public.jwt_app_role() in ('warehouse_manager', 'warehouse_staff', 'production_manager', 'production_staff', 'ppic_manager', 'ppic_staff')
    )
  );
