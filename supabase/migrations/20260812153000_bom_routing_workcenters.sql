-- Migration: boms, bom_lines, work_centers, routings, routing_steps, formula_templates
-- (sisa Kelompok 2) — tidak ada kolom finansial sensitif di sini, RLS mengikuti pola
-- company-match standar + tulis dibatasi role produksi/PPIC/leadership.

create table if not exists boms (
  bom_id serial primary key,
  company_id integer not null references companies(company_id),
  parent_item_id integer not null references items(item_id),
  version integer not null default 1,
  standard_yield_qty numeric(14,4) not null,
  standard_yield_uom text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now(),
  unique (parent_item_id, version)
);

create index if not exists boms_company_id_idx on boms (company_id);

alter table if exists boms enable row level security;

drop policy if exists boms_select_for_company on boms;
create policy boms_select_for_company on boms
  for select using (company_id = public.jwt_company_id());

drop policy if exists boms_write_ppic on boms;
create policy boms_write_ppic on boms
  for all using (
    company_id = public.jwt_company_id()
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('ppic_manager', 'ppic_staff', 'production_manager'))
  )
  with check (
    company_id = public.jwt_company_id()
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('ppic_manager', 'ppic_staff', 'production_manager'))
  );

create table if not exists bom_lines (
  bom_line_id serial primary key,
  bom_id integer not null references boms(bom_id),
  component_item_id integer not null references items(item_id),
  qty_per_unit_output numeric(14,6) not null,
  uom text not null
);

create index if not exists bom_lines_bom_id_idx on bom_lines (bom_id);

alter table if exists bom_lines enable row level security;

drop policy if exists bom_lines_select_for_company on bom_lines;
create policy bom_lines_select_for_company on bom_lines
  for select using (
    exists (select 1 from boms b where b.bom_id = bom_lines.bom_id and b.company_id = public.jwt_company_id())
  );

drop policy if exists bom_lines_write_ppic on bom_lines;
create policy bom_lines_write_ppic on bom_lines
  for all using (
    exists (select 1 from boms b where b.bom_id = bom_lines.bom_id and b.company_id = public.jwt_company_id())
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('ppic_manager', 'ppic_staff', 'production_manager'))
  )
  with check (
    exists (select 1 from boms b where b.bom_id = bom_lines.bom_id and b.company_id = public.jwt_company_id())
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('ppic_manager', 'ppic_staff', 'production_manager'))
  );

create table if not exists work_centers (
  work_center_id serial primary key,
  company_id integer not null references companies(company_id),
  production_plant_id integer not null references production_plants(production_plant_id),
  name text not null,
  code text,
  is_active boolean not null default true
);

create index if not exists work_centers_company_id_idx on work_centers (company_id);

alter table if exists work_centers enable row level security;

drop policy if exists work_centers_select_for_company on work_centers;
create policy work_centers_select_for_company on work_centers
  for select using (company_id = public.jwt_company_id());

drop policy if exists work_centers_write_production on work_centers;
create policy work_centers_write_production on work_centers
  for all using (
    company_id = public.jwt_company_id()
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('production_manager', 'ppic_manager'))
  )
  with check (
    company_id = public.jwt_company_id()
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('production_manager', 'ppic_manager'))
  );

create table if not exists routings (
  routing_id serial primary key,
  company_id integer not null references companies(company_id),
  item_id integer not null references items(item_id),
  version integer not null default 1,
  unique (item_id, version)
);

create index if not exists routings_company_id_idx on routings (company_id);

alter table if exists routings enable row level security;

drop policy if exists routings_select_for_company on routings;
create policy routings_select_for_company on routings
  for select using (company_id = public.jwt_company_id());

drop policy if exists routings_write_ppic on routings;
create policy routings_write_ppic on routings
  for all using (
    company_id = public.jwt_company_id()
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('ppic_manager', 'ppic_staff', 'production_manager'))
  )
  with check (
    company_id = public.jwt_company_id()
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('ppic_manager', 'ppic_staff', 'production_manager'))
  );

create table if not exists routing_steps (
  routing_step_id serial primary key,
  routing_id integer not null references routings(routing_id),
  sequence_no integer not null,
  step_name text not null,
  active_duration_minutes integer not null default 0,
  wait_duration_minutes integer not null default 0,
  work_center_id integer references work_centers(work_center_id)
);

create index if not exists routing_steps_routing_id_idx on routing_steps (routing_id);

alter table if exists routing_steps enable row level security;

drop policy if exists routing_steps_select_for_company on routing_steps;
create policy routing_steps_select_for_company on routing_steps
  for select using (
    exists (select 1 from routings r where r.routing_id = routing_steps.routing_id and r.company_id = public.jwt_company_id())
  );

drop policy if exists routing_steps_write_ppic on routing_steps;
create policy routing_steps_write_ppic on routing_steps
  for all using (
    exists (select 1 from routings r where r.routing_id = routing_steps.routing_id and r.company_id = public.jwt_company_id())
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('ppic_manager', 'ppic_staff', 'production_manager'))
  )
  with check (
    exists (select 1 from routings r where r.routing_id = routing_steps.routing_id and r.company_id = public.jwt_company_id())
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('ppic_manager', 'ppic_staff', 'production_manager'))
  );

create table if not exists formula_templates (
  formula_template_id serial primary key,
  company_id integer not null references companies(company_id),
  name text not null,
  notes text,
  reference_composition text,
  created_at timestamptz not null default now()
);

create index if not exists formula_templates_company_id_idx on formula_templates (company_id);

alter table if exists formula_templates enable row level security;

drop policy if exists formula_templates_select_for_company on formula_templates;
create policy formula_templates_select_for_company on formula_templates
  for select using (company_id = public.jwt_company_id());

drop policy if exists formula_templates_write_ppic on formula_templates;
create policy formula_templates_write_ppic on formula_templates
  for all using (
    company_id = public.jwt_company_id()
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('ppic_manager', 'ppic_staff', 'production_manager'))
  )
  with check (
    company_id = public.jwt_company_id()
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('ppic_manager', 'ppic_staff', 'production_manager'))
  );
