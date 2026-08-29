-- SEC-23 — PERAN NULL DITOLAK. Melengkapi SEC-21 yang ternyata BELUM TUNTAS.
--
-- ============================================================================
-- KENAPA MIGRASI INI ADA: VERIFIKASI INDEPENDEN MEMBANTAH LAPORAN SENDIRI
-- ============================================================================
-- SEC-21 menutup dua hal: hak eksekusi anon, dan gerbang identitas/tenant lewat
-- wajib_identitas_tenant(). Laporan giliran itu menyatakan lubangnya tertutup.
--
-- Diverifikasi ulang 29 Agu 2026 dengan MENJALANKAN, bukan membaca: sebuah sesi
-- yang klaimnya MEMBAWA company_id tetapi TIDAK membawa app_role berhasil membuat
-- Sales Order.
--
--   set_config('request.jwt.claims', '{"sub":"...","company_id":"<id>"}', true)
--   select process_customer_purchase_order(<po>, <plant>)
--     -> TIDAK DITOLAK, satu Sales Order tercipta
--
-- SEBABNYA persis kelas yang sama dengan SEC-21, di gerbang yang BERBEDA:
--   jwt_is_company_leadership()  ->  jwt_app_role() in (...)  ->  NULL in (...) = NULL
--   if not NULL                  ->  NULL, dan `if NULL` TIDAK dieksekusi
-- Gerbang PERAN dilewati. wajib_identitas_tenant() tidak menangkapnya karena ia
-- memeriksa identitas dan perusahaan -- BUKAN peran.
--
-- Ini contoh bahwa menambal satu gerbang tidak menutup kelasnya. §4 perintah
-- eksekusi menyebutnya eksplisit: NO ROLE -> DENY, NULL ROLE -> DENY.
--
-- ============================================================================
-- PERBAIKAN
-- ============================================================================
-- Setiap `if not public.jwt_xxx()` menjadi `if not coalesce(public.jwt_xxx(), false)`,
-- sehingga peran yang tidak diketahui diperlakukan sebagai TIDAK BERWENANG --
-- bukan sebagai "belum tentu tidak berwenang".
--
-- get_monthly_operating_profit(p_company_id integer, p_year integer, p_month integer)
create or replace function public.get_monthly_operating_profit(p_company_id integer, p_year integer, p_month integer)
 RETURNS TABLE(total_margin numeric, overhead numeric, operating_profit numeric, period_start date, period_end date)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  v_total_margin numeric;
  v_overhead numeric;
  v_start_day integer;
  v_period_start date;
  v_period_end date;
begin
  -- FAIL CLOSED: tanpa identitas ATAU tanpa konteks perusahaan -> TOLAK.
  perform public.wajib_identitas_tenant();
  if p_company_id is distinct from public.jwt_company_id() then
    raise exception 'Perusahaan tidak ditemukan.';
  end if;
  if not coalesce(public.jwt_can_view_financial_data(), false) then
    raise exception 'Anda tidak punya akses ke data margin.';
  end if;

  select nullif(cs.setting_value, '')::integer into v_start_day
  from company_settings cs where cs.company_id = p_company_id and cs.setting_key = 'payroll_period_start_day';

  if v_start_day is null or v_start_day <= 1 then
    -- Fallback bulan kalender (perilaku lama, tidak berubah).
    v_period_start := make_date(p_year, p_month, 1);
    v_period_end := (v_period_start + interval '1 month' - interval '1 day')::date;
  else
    v_period_end := make_date(p_year, p_month, v_start_day - 1);
    v_period_start := ((v_period_end - interval '1 month') + interval '1 day')::date;
  end if;

  select coalesce(sum(sl.qty_shipped * (sol.unit_price - coalesce(l.unit_cost, 0))), 0) into v_total_margin
  from shipment_lines sl
  join sales_order_lines sol on sol.sales_order_line_id = sl.sales_order_line_id
  join sales_orders so on so.sales_order_id = sol.sales_order_id
  join shipments sh on sh.shipment_id = sl.shipment_id
  left join lots l on l.lot_id = sl.lot_id
  where so.company_id = p_company_id
    and sh.status in ('shipped', 'delivered')
    and sh.shipment_date between v_period_start and v_period_end;

  select coalesce(nullif(cs.setting_value, '')::numeric, 0) into v_overhead
  from company_settings cs where cs.company_id = p_company_id and cs.setting_key = 'monthly_overhead_baseline';
  v_overhead := coalesce(v_overhead, 0);

  return query select v_total_margin, v_overhead, (v_total_margin - v_overhead), v_period_start, v_period_end;
end;
$function$
;

-- get_sales_order_margin(p_sales_order_id integer)
create or replace function public.get_sales_order_margin(p_sales_order_id integer)
 RETURNS TABLE(revenue numeric, cost numeric, margin numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  v_company_id integer;
begin
  -- FAIL CLOSED: tanpa identitas ATAU tanpa konteks perusahaan -> TOLAK.
  perform public.wajib_identitas_tenant();
  select so.company_id into v_company_id from sales_orders so where so.sales_order_id = p_sales_order_id;
  if v_company_id is null then
    return query select 0::numeric, 0::numeric, 0::numeric;
    return;
  end if;
  if v_company_id is distinct from public.jwt_company_id() then
    raise exception 'Sales order tidak ditemukan di perusahaan Anda.';
  end if;
  if not coalesce(public.jwt_can_view_financial_data(), false) then
    raise exception 'Anda tidak punya akses ke data margin.';
  end if;

  return query
  select
    coalesce(sum(sl.qty_shipped * sol.unit_price), 0)::numeric as revenue,
    coalesce(sum(sl.qty_shipped * (coalesce(l.unit_cost, 0) + coalesce(l.packaging_cost, 0))), 0)::numeric as cost,
    coalesce(sum(sl.qty_shipped * (sol.unit_price - coalesce(l.unit_cost, 0) - coalesce(l.packaging_cost, 0))), 0)::numeric as margin
  from shipment_lines sl
  join sales_order_lines sol on sol.sales_order_line_id = sl.sales_order_line_id
  left join lots l on l.lot_id = sl.lot_id
  where sol.sales_order_id = p_sales_order_id;
end;
$function$
;

-- process_customer_purchase_order(p_customer_purchase_order_id integer, p_production_plant_id integer)
create or replace function public.process_customer_purchase_order(p_customer_purchase_order_id integer, p_production_plant_id integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  v_po customer_purchase_orders%rowtype;
  v_plant_company_id integer;
  v_approved_count integer;
  v_processed_by integer;
  v_sales_order_id integer;
  v_company_code text;
  v_sequence integer;
  v_so_number text;
  v_idempotency_key text;
begin
  -- FAIL CLOSED: tanpa identitas ATAU tanpa konteks perusahaan -> TOLAK.
  perform public.wajib_identitas_tenant();
  select * into v_po from customer_purchase_orders where customer_purchase_order_id = p_customer_purchase_order_id;

  if v_po.customer_purchase_order_id is null or v_po.company_id is distinct from public.jwt_company_id() then
    raise exception 'PO client tidak ditemukan di perusahaan Anda.';
  end if;

  if not coalesce(public.jwt_is_company_leadership(), false) then
    raise exception 'Hanya company_admin atau general_manager yang boleh memproses PO client.';
  end if;

  -- Kunci pengulangan DITURUNKAN, bukan dikirim klien: ia bisa ditentukan ulang
  -- persis sama dari data yang sudah ada, jadi permintaan yang diulang -- entah
  -- karena tombol diklik dua kali atau karena jaringan mengirim ulang -- TIDAK
  -- PERNAH bisa melahirkan Sales Order kedua.
  v_idempotency_key := 'cpo-' || p_customer_purchase_order_id::text;

  select sales_order_id into v_sales_order_id
  from sales_orders
  where company_id = v_po.company_id and idempotency_key = v_idempotency_key;

  if v_sales_order_id is not null then
    return v_sales_order_id;
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

  begin
    insert into sales_orders (
      company_id, customer_purchase_order_id, customer_id, production_plant_id, status, so_number,
      idempotency_key, customer_name_snapshot, customer_billing_address_snapshot, customer_npwp_snapshot
    )
    values (
      v_po.company_id, v_po.customer_purchase_order_id, v_po.customer_id, p_production_plant_id, 'confirmed', v_so_number,
      v_idempotency_key, v_po.customer_name_snapshot, v_po.customer_billing_address_snapshot, v_po.customer_npwp_snapshot
    )
    returning sales_order_id into v_sales_order_id;
  exception when unique_violation then
    -- Dua permintaan berjalan BERSAMAAN dan keduanya lolos pemeriksaan di atas.
    -- Bisa kena dua kekangan berbeda: sales_orders_customer_purchase_order_id_key
    -- (ada sejak awal skema) ATAU sales_orders_idempotency_key_unique. Keduanya
    -- berarti hal yang sama persis di sini -- satu PO klien hanya boleh punya satu
    -- Sales Order -- jadi ditangani sama: ambil yang dibuat permintaan lain dan
    -- kembalikan sebagai keberhasilan, bukan sebagai galat.
    select sales_order_id into v_sales_order_id
    from sales_orders
    where company_id = v_po.company_id
      and customer_purchase_order_id = v_po.customer_purchase_order_id;
    if v_sales_order_id is null then
      raise;
    end if;
    return v_sales_order_id;
  end;

  insert into sales_order_lines (sales_order_id, item_id, qty_ordered, unit_price)
  select v_sales_order_id, cpol.item_id, cpol.qty_ordered, cpol.unit_price
  from customer_purchase_order_lines cpol
  where cpol.customer_purchase_order_id = v_po.customer_purchase_order_id;

  update customer_purchase_orders
  set status = 'processed', processed_by = v_processed_by, processed_at = now()
  where customer_purchase_order_id = v_po.customer_purchase_order_id;

  return v_sales_order_id;
end;
$function$
;
