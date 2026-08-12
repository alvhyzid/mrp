-- Migration: tambahkan bpom_registration_number (tidak sensitif) ke view items_secure
-- supaya konsisten dengan kolom yang sudah ditambahkan ke tabel items.

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
  bpom_registration_number,
  created_at
from items
where company_id = public.jwt_company_id();

grant select on items_secure to authenticated;
