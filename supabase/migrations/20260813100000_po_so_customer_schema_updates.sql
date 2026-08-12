-- Migration: 5 penyesuaian skema berdasarkan dokumen PO/SO asli perusahaan (lihat
-- docs/rancangan-skema-database-mrp.md, bagian items/lots/customers/
-- customer_purchase_orders/sales_orders).

-- 1) items.bpom_registration_number — nullable, khusus produk jadi yang sudah
--    teregistrasi BPOM. Tidak sensitif (bukan data finansial), jadi tidak perlu
--    masking lewat items_secure.
alter table if exists items
  add column if not exists bpom_registration_number text;

-- 2) customers.customer_type — order bisa dari perusahaan atau perorangan langsung.
alter table if exists customers
  add column if not exists customer_type text not null default 'company'
    check (customer_type in ('company', 'individual'));

-- 3) customer_purchase_orders: data PIC spesifik per order (bisa beda tiap order
--    meski client-nya sama perusahaan).
alter table if exists customer_purchase_orders
  add column if not exists pic_name text,
  add column if not exists pic_position text,
  add column if not exists pic_phone text,
  add column if not exists pic_email text;

-- 4) lots: dukungan bahan/kemasan kiriman client sendiri (customer_supplied).
--    unit_cost WAJIB 0 untuk lot jenis ini (bukan dibeli), dipaksa lewat trigger
--    supaya konsisten walau ada yang lupa set manual. source_customer_purchase_order_id
--    WAJIB diisi kalau source_type = customer_supplied (jejak balik ke PO asal).
alter table if exists lots
  drop constraint if exists lots_source_type_check;

alter table if exists lots
  add constraint lots_source_type_check check (source_type in ('purchased', 'produced', 'customer_supplied'));

alter table if exists lots
  add column if not exists source_customer_purchase_order_id integer references customer_purchase_orders(customer_purchase_order_id);

drop function if exists public.guard_customer_supplied_lot();
create function public.guard_customer_supplied_lot()
returns trigger
language plpgsql
as $$
begin
  if new.source_type = 'customer_supplied' then
    if new.source_customer_purchase_order_id is null then
      raise exception 'Lot dengan source_type customer_supplied wajib mengisi source_customer_purchase_order_id.';
    end if;
    new.unit_cost := 0;
  end if;
  return new;
end;
$$;

drop trigger if exists lots_guard_customer_supplied on lots;
create trigger lots_guard_customer_supplied
  before insert or update on lots
  for each row
  execute function public.guard_customer_supplied_lot();

-- 5) sales_orders.so_number — nomor SO internal, auto-generated saat "Process"
--    diklik (lihat perubahan fungsi process_customer_purchase_order di bawah),
--    terpisah dari customer_purchase_orders.po_number milik client.
alter table if exists sales_orders
  add column if not exists so_number text;

alter table if exists sales_orders
  add constraint sales_orders_so_number_unique unique (company_id, so_number);

-- process_customer_purchase_order() diperluas: generate so_number format
-- "<urutan 3-digit>/<bulan>-<kode company>/<tahun>" (mis. "001/8-ITM/2026"),
-- urutan reset tiap tahun per company. Kode company diambil dari
-- company_settings key 'so_number_company_code' kalau diisi, kalau tidak
-- fallback ke 3 huruf pertama nama company (huruf saja, di-uppercase).
create or replace function public.process_customer_purchase_order(
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
  v_company_code text;
  v_sequence integer;
  v_so_number text;
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

  select coalesce(nullif(cs.setting_value, ''), upper(left(regexp_replace(c.name, '[^A-Za-z]', '', 'g'), 3)))
    into v_company_code
  from companies c
  left join company_settings cs on cs.company_id = c.company_id and cs.setting_key = 'so_number_company_code'
  where c.company_id = v_po.company_id;

  select count(*) + 1 into v_sequence
  from sales_orders so
  where so.company_id = v_po.company_id
    and extract(year from so.created_at) = extract(year from now());

  v_so_number := to_char(v_sequence, 'FM000') || '/' || to_char(now(), 'FMMM') || '-' || coalesce(v_company_code, 'CO') || '/' || to_char(now(), 'FMYYYY');

  insert into sales_orders (company_id, customer_purchase_order_id, customer_id, production_plant_id, status, so_number)
  values (v_po.company_id, v_po.customer_purchase_order_id, v_po.customer_id, p_production_plant_id, 'confirmed', v_so_number)
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
