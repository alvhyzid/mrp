-- Migration: Margin Watch Lapis 1 (baseline margin per order) + persiapan
-- Lapis 2 (peringatan ambang margin). Pola SAMA PERSIS dengan snapshot standar
-- K8/feasibility (sales_order_line_feasibility_snapshots) -- dikunci SEKALI
-- (panggilan pertama getMarginWatch untuk baris itu), tidak pernah ikut
-- berubah diam-diam kalau standard_cost master berubah belakangan.
--
-- Beda dari snapshot feasibility: kolom cost di sini BOLEH null (item BOM
-- belum semuanya punya standard_cost) -- cost_data_complete + missing_cost_item_codes
-- membuat ini eksplisit, BUKAN diam-diam dianggap 0 (prinsip "dilarang mengarang
-- angka" berlaku sejak Lapis 1, bukan cuma Lapis 3 nanti). standard_labor_cost_per_unit
-- SENGAJA selalu null untuk saat ini -- routing belum menyimpan data jumlah
-- orang per tahap, jadi biaya SDM standar per unit genuinely tidak bisa
-- dihitung dari data yang ada (bukan lupa, keputusan sadar, lihat HANDOFF).
--
-- margin_floor_threshold BOLEH diubah (beda dari feasibility snapshot yang
-- full immutable) -- ambang ini murni preferensi pemilik order, wajar diedit
-- kapan saja, tidak menyentuh angka baseline cost/harga yang tetap terkunci.
create table if not exists sales_order_line_margin_snapshots (
  sales_order_line_margin_snapshot_id serial primary key,
  company_id integer not null references companies(company_id),
  sales_order_line_id integer not null unique references sales_order_lines(sales_order_line_id),
  unit_price numeric(14,4) not null,
  standard_material_cost_per_unit numeric(14,4),
  standard_packaging_cost_per_unit numeric(14,4),
  standard_labor_cost_per_unit numeric(14,4),
  cost_data_complete boolean not null default false,
  missing_cost_item_codes text[],
  margin_floor_threshold numeric(14,2),
  created_at timestamptz not null default now()
);

create index if not exists sales_order_line_margin_snapshots_company_idx
  on sales_order_line_margin_snapshots (company_id);

alter table if exists sales_order_line_margin_snapshots enable row level security;

drop policy if exists sales_order_line_margin_snapshots_select on sales_order_line_margin_snapshots;
create policy sales_order_line_margin_snapshots_select on sales_order_line_margin_snapshots
  for select using (
    company_id = public.jwt_company_id()
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('finance_manager'))
  );

-- Tulis lewat service-role client di getMarginWatch.ts (pola sama dgn
-- feasibility) -- INSERT sekali per baris (baseline cost/harga terkunci).
drop policy if exists sales_order_line_margin_snapshots_insert on sales_order_line_margin_snapshots;
create policy sales_order_line_margin_snapshots_insert on sales_order_line_margin_snapshots
  for insert with check (
    company_id = public.jwt_company_id()
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('finance_manager'))
  );

-- UPDATE HANYA boleh menyentuh margin_floor_threshold (ambang preferensi) --
-- baseline cost/harga TIDAK BOLEH diubah lewat jalur ini sama sekali. Dijaga
-- di app layer (updateMarginFloorThreshold.ts hanya kirim 1 kolom itu), RLS
-- di sini cuma jaga siapa yang boleh, bukan kolom mana (Postgres row policy
-- tidak bisa membatasi per-kolom).
drop policy if exists sales_order_line_margin_snapshots_update on sales_order_line_margin_snapshots;
create policy sales_order_line_margin_snapshots_update on sales_order_line_margin_snapshots
  for update using (
    company_id = public.jwt_company_id()
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('finance_manager'))
  )
  with check (
    company_id = public.jwt_company_id()
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('finance_manager'))
  );

-- alert_type baru untuk peringatan ambang margin (Lapis 2) -- target_department
-- 'finance' + 'management' (finance_manager/general_manager/company_admin),
-- pola upsert_department_alert/resolve_department_alerts yang sudah ada
-- (migration 20260816100000) dipakai apa adanya, tidak ada fungsi SQL baru.
alter table system_alerts drop constraint if exists system_alerts_alert_type_check;
alter table system_alerts add constraint system_alerts_alert_type_check check (alert_type in (
  'material_shortage', 'po_delayed', 'low_stock', 'production_delay',
  'worker_absence', 'production_disruption', 'so_ready_for_production',
  'po_needs_approval', 'stock_depletion_forecast', 'expiry_risk_low_usage',
  'margin_threshold_breach'
));
