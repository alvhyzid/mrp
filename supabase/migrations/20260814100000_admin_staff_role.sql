-- Migration: role baru admin_staff — administratif lintas-department (tidak
-- terikat ke satu department tertentu, beda dari 6 department manager/staff yang
-- sudah ada). Kewenangan pertama yang diberikan: create customer_purchase_orders,
-- sejajar dengan company_admin/general_manager yang sudah bisa (bukan approve/
-- update/cancel — cuma create, sesuai permintaan).

alter table if exists users
  drop constraint if exists users_role_check;

alter table if exists users
  add constraint users_role_check check (
    role in (
      'super_admin',
      'company_admin',
      'general_manager',
      'admin_staff',
      'production_manager', 'production_staff',
      'ppic_manager', 'ppic_staff',
      'finance_manager', 'finance_staff',
      'purchasing_manager', 'purchasing_staff',
      'warehouse_manager', 'warehouse_staff',
      'hr_manager', 'hr_staff',
      'viewer'
    )
  );

-- customers: admin_staff perlu bisa bikin client baru juga, karena form "Buat PO"
-- mengizinkan tambah client baru inline (lihat CustomerPurchaseOrdersPage).
drop policy if exists customers_write_ppic on customers;
create policy customers_write_ppic on customers
  for all using (
    company_id = public.jwt_company_id()
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('ppic_manager', 'ppic_staff', 'admin_staff'))
  )
  with check (
    company_id = public.jwt_company_id()
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('ppic_manager', 'ppic_staff', 'admin_staff'))
  );

-- customer_purchase_orders: izin CREATE saja (insert), bukan update/cancel/hold —
-- policy update sengaja TIDAK disentuh, admin_staff belum boleh ubah PO yang sudah
-- dibuat sampai ada permintaan eksplisit untuk itu.
drop policy if exists customer_purchase_orders_insert_ppic on customer_purchase_orders;
create policy customer_purchase_orders_insert_ppic on customer_purchase_orders
  for insert with check (
    company_id = public.jwt_company_id()
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('ppic_manager', 'ppic_staff', 'admin_staff'))
    and status = 'new'
  );

-- customer_purchase_order_lines: baris item WAJIB dibuat bareng PO-nya, jadi
-- admin_staff butuh akses yang sama di sini juga.
drop policy if exists customer_po_lines_write_ppic on customer_purchase_order_lines;
create policy customer_po_lines_write_ppic on customer_purchase_order_lines
  for all using (
    exists (
      select 1 from customer_purchase_orders cpo
      where cpo.customer_purchase_order_id = customer_purchase_order_lines.customer_purchase_order_id
        and cpo.company_id = public.jwt_company_id()
    )
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('ppic_manager', 'ppic_staff', 'admin_staff'))
  )
  with check (
    exists (
      select 1 from customer_purchase_orders cpo
      where cpo.customer_purchase_order_id = customer_purchase_order_lines.customer_purchase_order_id
        and cpo.company_id = public.jwt_company_id()
    )
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('ppic_manager', 'ppic_staff', 'admin_staff'))
  );

-- "Process PO -> SO" (task terpisah, sekalian di migration yang sama): dulu
-- company_admin/general_manager/ppic_manager boleh klik Process meski ppic_manager
-- cuma salah satu dari 3 approver, bukan penanggung jawab akhir. Sekarang HANYA
-- company_admin/general_manager, sesuai permintaan eksplisit.
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

  if not public.jwt_is_company_leadership() then
    raise exception 'Hanya company_admin atau general_manager yang boleh memproses PO client.';
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
