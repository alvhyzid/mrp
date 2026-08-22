-- PMB-07a (22 Agu 2026) -- Pembekuan Identitas Mitra di Dokumen Terbit.
-- Arkeologi (dibuktikan lewat baca skema): purchase_orders/customer_purchase_
-- orders/sales_orders SEBELUM migrasi ini HANYA menyimpan referensi
-- (supplier_id/customer_id), TIDAK ADA salinan beku nama/alamat/NPWP --
-- persis kelas masalah yang sama dengan shipments SEBELUM Alur 1 (migrasi
-- 20260827300000). Pola snapshot di sini SAMA PERSIS dengan shipments.
--
-- LINGKUP KHUSUS identitas (nama, alamat RESMI badan usaha, NPWP) -- BUKAN
-- alamat tujuan kirim (itu PMB-07b, sifatnya berbeda: sering berganti per
-- pengiriman, bukan identitas badan usaha).

alter table purchase_orders
  add column if not exists supplier_name_snapshot text,
  add column if not exists supplier_address_snapshot text,
  add column if not exists supplier_npwp_snapshot text;

alter table customer_purchase_orders
  add column if not exists customer_name_snapshot text,
  add column if not exists customer_billing_address_snapshot text,
  add column if not exists customer_npwp_snapshot text;

alter table sales_orders
  add column if not exists customer_name_snapshot text,
  add column if not exists customer_billing_address_snapshot text,
  add column if not exists customer_npwp_snapshot text;

-- process_customer_purchase_order: signature TIDAK berubah (integer, integer)
-- -- ACL tetap dipertahankan Postgres (lihat HANDOFF.md "Pelajaran Tetap"),
-- fungsi ini SUDAH masuk ALLOWED_BROAD_GRANT (jwt_company_id()+jwt_is_company_
-- leadership() internal), grant luasnya TIDAK diubah di sini.
-- Sales Order MEWARISI snapshot identitas dari CPO yang sudah beku saat CPO
-- terbit -- BUKAN query ulang ke customers saat SO diproses -- supaya SO
-- konsisten dengan identitas yang tertulis di PO Klien aslinya.
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

  insert into sales_orders (company_id, customer_purchase_order_id, customer_id, production_plant_id, status, so_number, customer_name_snapshot, customer_billing_address_snapshot, customer_npwp_snapshot)
  values (v_po.company_id, v_po.customer_purchase_order_id, v_po.customer_id, p_production_plant_id, 'confirmed', v_so_number, v_po.customer_name_snapshot, v_po.customer_billing_address_snapshot, v_po.customer_npwp_snapshot)
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
