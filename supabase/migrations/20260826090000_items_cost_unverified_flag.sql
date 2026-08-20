-- Formula resmi Gummy Zala V2 / Drinkme V1 (14 Agu 2026, formulator Dhiska, status
-- Production) menggantikan formula simulasi lama. Beberapa harga bahan di formula
-- resmi masih ASUMSI (belum dikonfirmasi purchasing) -- perlu ditandai TERPISAH dari
-- "harga belum ada" (standard_cost null, sudah tertangani computeStandardCostPerUnit).
-- Kolom baru: harga ADA tapi statusnya "belum diverifikasi", bukan "hilang".

alter table items add column if not exists cost_unverified boolean not null default false;
alter table items add column if not exists cost_unverified_note text;

drop view if exists items_secure;
create view items_secure
with (security_invoker = false)
as
select
  item_id,
  company_id,
  item_code,
  name,
  type,
  base_uom,
  purchase_uom,
  uom_conversion_factor,
  shelf_life_days,
  min_stock_level,
  reorder_point,
  reorder_qty,
  is_active,
  case when public.jwt_can_view_financial_data() then standard_cost else null end as standard_cost,
  case when public.jwt_can_view_financial_data() then cost_unverified else null end as cost_unverified,
  case when public.jwt_can_view_financial_data() then cost_unverified_note else null end as cost_unverified_note,
  bpom_registration_number,
  created_at
from items
where company_id = public.jwt_company_id();

grant select on items_secure to authenticated;
