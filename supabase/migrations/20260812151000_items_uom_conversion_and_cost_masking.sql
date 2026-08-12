-- Migration: items dapat base_uom/purchase_uom/uom_conversion_factor (Kelompok 2),
-- plus masking standard_cost lewat view (Kontrol Akses Data Finansial).

alter table if exists items
  rename column uom to base_uom;

alter table if exists items
  add column if not exists purchase_uom text;

update items set purchase_uom = base_uom where purchase_uom is null;

alter table if exists items
  alter column purchase_uom set not null;

alter table if exists items
  add column if not exists uom_conversion_factor numeric(14,6) not null default 1;

-- Item master ditulis oleh leadership (company_admin/general_manager) — sejalan
-- dengan app code src/features/mrp/server. Sebelumnya policy insert/update items
-- cuma cek company_id tanpa cek role, celah yang ditutup di sini.
drop policy if exists items_insert_for_company on items;
create policy items_insert_leadership on items
  for insert with check (company_id = public.jwt_company_id() and public.jwt_is_company_leadership());

drop policy if exists items_update_for_company on items;
create policy items_update_leadership on items
  for update using (company_id = public.jwt_company_id() and public.jwt_is_company_leadership())
  with check (company_id = public.jwt_company_id() and public.jwt_is_company_leadership());

-- standard_cost adalah data finansial sensitif (lihat Kontrol Akses Data Finansial):
-- hanya company_admin/general_manager/finance_manager yang boleh melihatnya. RLS
-- tidak bisa menyaring per-kolom, jadi SELECT langsung ke tabel dasar ditutup untuk
-- authenticated/anon (tidak ada policy select = default deny), dan akses baca yang
-- aman disediakan lewat view items_secure di bawah. Aplikasi (service-role client)
-- tetap bisa baca tabel dasar seperti biasa karena service-role melewati RLS.
drop policy if exists items_select_for_company on items;

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
  created_at
from items
where company_id = public.jwt_company_id();

grant select on items_secure to authenticated;
