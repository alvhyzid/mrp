-- SEC-21 — GAGAL-TERTUTUP untuk fungsi ber-hak istimewa Sales/CRM & keuangan.
--
-- ============================================================================
-- TEMUAN P0 YANG DIBUKTIKAN, BUKAN DIDUGA
-- ============================================================================
-- Dijalankan terhadap tenant uji di staging pada 29 Agu 2026, memakai kunci anon
-- SAJA (tanpa login sama sekali):
--
--   anon.rpc('process_customer_purchase_order', {...})
--     -> berhasil, mengembalikan sales_order_id 901
--     -> SATU Sales Order benar-benar tercipta di perusahaan yang bukan miliknya
--
-- Jadi pemanggil yang TIDAK LOGIN dapat membuat dokumen komersial untuk perusahaan
-- mana pun yang PO klien-nya sudah punya tiga persetujuan.
--
-- DUA SEBAB, dan keduanya harus ditutup:
--
-- (1) HAK EKSEKUSI BAWAAN. Postgres memberi EXECUTE kepada PUBLIC pada setiap fungsi
--     baru. Sensus: 11 fungsi SECURITY DEFINER bisa dipanggil `anon`.
--
-- (2) SEMANTIK NULL -- dan ini yang tidak terlihat dari membaca kode. Gerbangnya
--     ditulis begini:
--         if v_company_id <> public.jwt_company_id() then raise exception ...
--         if not public.jwt_can_view_financial_data() then raise exception ...
--     Tanpa JWT, jwt_company_id() dan jwt_can_view_financial_data() bernilai NULL:
--         v_company_id <> NULL  ->  NULL      (bukan true)
--         not NULL              ->  NULL      (bukan true)
--     dan `if NULL then ... end if` TIDAK PERNAH DIEKSEKUSI. Gerbangnya DILEWATI,
--     bukan menolak. Kedua gerbang -- kepemilikan perusahaan DAN wewenang -- gagal
--     TERBUKA, persis kebalikan dari yang seharusnya.
--
-- ============================================================================
-- YANG DISENTUH DAN YANG SENGAJA TIDAK
-- ============================================================================
-- Enam fungsi di bawah diperiksa lebih dulu terhadap SELURUH 145 kebijakan RLS:
-- NOL kebijakan memakainya, jadi mencabut hak `anon` TIDAK mematikan RLS mana pun.
--
-- SENGAJA TIDAK DISENTUH, dan alasannya masing-masing:
--   confirm_delivery                    -- jalur POD publik yang MEMANG tanpa login;
--                                          gerbangnya token, bukan peran.
--   is_super_admin_user (6 kebijakan)   -- dipakai RLS; mencabutnya mematikan RLS itu.
--   user_has_no_company (1 kebijakan)   -- sama.
--   employee_belongs_to_current_user (2)-- sama, dan milik domain HR.
--   employee_matches_managed_department -- sama.
-- Keempat yang dipakai RLS punya bentuk berbeda (menerima auth_uid sebagai PARAMETER)
-- dan sudah tercatat menunggu perancangan ulang. Menyentuhnya di sini akan
-- memadamkan kebijakan yang sedang berjalan -- risiko yang lebih besar daripada yang
-- sedang ditutup.
--
-- ============================================================================
-- CARA MEMPERBAIKI: SATU PENGAMAN, BUKAN MENULIS ULANG LIMA FUNGSI
-- ============================================================================
-- Badan keenam fungsi di bawah DIAMBIL APA ADANYA dari basis data, lalu diberi
-- SATU pernyataan di awal. Logika bisnisnya tidak disentuh sama sekali -- yang
-- ditambahkan hanyalah gerbang yang menolak lebih dulu. Perbandingan `<>` terhadap
-- jwt_company_id() sekaligus diubah jadi `is distinct from` sebagai lapis kedua.

create or replace function public.wajib_identitas_tenant()
returns void
language plpgsql
stable
as $$
begin
  -- DUA hal diperiksa, bukan satu. auth.uid() saja tidak cukup: pengguna yang sudah
  -- login tetapi klaim company_id-nya kosong (mis. hook token gagal) akan lolos
  -- pemeriksaan identitas, lalu membuka lubang NULL yang sama di gerbang berikutnya.
  if auth.uid() is null then
    raise exception 'Aksi ini membutuhkan sesi login yang sah.' using errcode = '28000';
  end if;
  if public.jwt_company_id() is null then
    raise exception 'Sesi Anda tidak membawa konteks perusahaan.' using errcode = '28000';
  end if;
end;
$$;

comment on function public.wajib_identitas_tenant() is
  'Gerbang GAGAL-TERTUTUP: menolak pemanggil tanpa identitas ATAU tanpa konteks perusahaan. Ada karena gerbang berbasis perbandingan (<>, not) GAGAL TERBUKA saat nilainya NULL -- terbukti 29 Agu 2026 dengan pemanggil anon membuat Sales Order sungguhan.';

revoke execute on function public.wajib_identitas_tenant() from public;
revoke execute on function public.wajib_identitas_tenant() from anon;
grant execute on function public.wajib_identitas_tenant() to authenticated;

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

  if not public.jwt_is_company_leadership() then
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
  if not public.jwt_can_view_financial_data() then
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
  if not public.jwt_can_view_financial_data() then
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

-- get_work_order_labor_cost_total(p_work_order_id integer)
create or replace function public.get_work_order_labor_cost_total(p_work_order_id integer)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  v_company_id integer;
  v_hours_per_day numeric;
  v_hours_per_month numeric;
  v_total numeric;
begin
  -- FAIL CLOSED: tanpa identitas ATAU tanpa konteks perusahaan -> TOLAK.
  perform public.wajib_identitas_tenant();
  select wo.company_id into v_company_id
  from work_orders wo
  where wo.work_order_id = p_work_order_id;

  if v_company_id is null then
    return 0;
  end if;

  if v_company_id is distinct from public.jwt_company_id() then
    raise exception 'Work order tidak ditemukan di perusahaan Anda.';
  end if;

  if not (public.jwt_can_view_financial_data() or public.jwt_can_view_wages()) then
    raise exception 'Anda tidak punya akses ke biaya SDM.';
  end if;

  select coalesce(nullif(cs.setting_value, '')::numeric, 8) into v_hours_per_day
  from company_settings cs
  where cs.company_id = v_company_id and cs.setting_key = 'standard_hours_per_day';
  v_hours_per_day := coalesce(v_hours_per_day, 8);

  select coalesce(nullif(cs.setting_value, '')::numeric, 173) into v_hours_per_month
  from company_settings cs
  where cs.company_id = v_company_id and cs.setting_key = 'standard_hours_per_month';
  v_hours_per_month := coalesce(v_hours_per_month, 173);

  select coalesce(sum(
    case e.wage_type
      when 'hourly' then coalesce(a.actual_hours, 0) * e.wage_rate
      when 'daily' then coalesce(a.actual_hours, 0) * (e.wage_rate / v_hours_per_day)
      when 'monthly' then coalesce(a.actual_hours, 0) * (e.wage_rate / v_hours_per_month)
      when 'piece_rate' then coalesce(a.qty_produced, 0) * e.wage_rate
      else 0
    end
  ), 0) into v_total
  from work_order_assignments a
  join employees e on e.employee_id = a.employee_id
  where a.work_order_id = p_work_order_id
    and a.status not in ('absent', 'replaced');

  return v_total;
end;
$function$
;

-- get_production_batch_labor_cost_total(p_production_batch_id integer)
create or replace function public.get_production_batch_labor_cost_total(p_production_batch_id integer)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  v_company_id integer;
begin
  -- FAIL CLOSED: tanpa identitas ATAU tanpa konteks perusahaan -> TOLAK.
  perform public.wajib_identitas_tenant();
  select pb.company_id into v_company_id from production_batches pb where pb.production_batch_id = p_production_batch_id;
  if v_company_id is null then
    return 0;
  end if;
  if v_company_id is distinct from public.jwt_company_id() then
    raise exception 'Batch produksi tidak ditemukan di perusahaan Anda.';
  end if;
  if not (public.jwt_can_view_financial_data() or public.jwt_can_view_wages()) then
    raise exception 'Anda tidak punya akses ke biaya SDM.';
  end if;
  return public.compute_production_batch_labor_cost(p_production_batch_id);
end;
$function$
;

-- get_production_batch_labor_cost_detail(p_production_batch_id integer)
create or replace function public.get_production_batch_labor_cost_detail(p_production_batch_id integer)
 RETURNS TABLE(employee_id integer, employee_name text, wage_type text, hours numeric, cost numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  v_company_id integer;
  v_weekday_hours numeric;
  v_saturday_hours numeric;
  v_hours_per_month numeric;
begin
  -- FAIL CLOSED: tanpa identitas ATAU tanpa konteks perusahaan -> TOLAK.
  perform public.wajib_identitas_tenant();
  select pb.company_id into v_company_id
  from production_batches pb
  where pb.production_batch_id = p_production_batch_id;

  if v_company_id is null then
    return;
  end if;

  if v_company_id is distinct from public.jwt_company_id() then
    raise exception 'Batch produksi tidak ditemukan di perusahaan Anda.';
  end if;

  if public.jwt_app_role() <> 'company_admin' then
    return;
  end if;

  select coalesce(nullif(cs.setting_value, '')::numeric, 7) into v_weekday_hours
  from company_settings cs where cs.company_id = v_company_id and cs.setting_key = 'work_calendar_weekday_hours';
  v_weekday_hours := coalesce(v_weekday_hours, 7);

  select coalesce(nullif(cs.setting_value, '')::numeric, 5) into v_saturday_hours
  from company_settings cs where cs.company_id = v_company_id and cs.setting_key = 'work_calendar_saturday_hours';
  v_saturday_hours := coalesce(v_saturday_hours, 5);

  select coalesce(nullif(cs.setting_value, '')::numeric, 173.3333) into v_hours_per_month
  from company_settings cs where cs.company_id = v_company_id and cs.setting_key = 'standard_hours_per_month';
  v_hours_per_month := coalesce(v_hours_per_month, 173.3333);

  return query
  select
    e.employee_id,
    e.name,
    e.wage_type,
    coalesce(a.actual_hours, 0) as hours,
    case e.wage_type
      when 'hourly' then coalesce(a.actual_hours, 0) * e.wage_rate
      when 'daily' then coalesce(a.actual_hours, 0) * (e.wage_rate / (case when extract(dow from a.work_date) = 6 then v_saturday_hours else v_weekday_hours end))
      when 'monthly' then coalesce(a.actual_hours, 0) * (e.wage_rate / v_hours_per_month)
      when 'piece_rate' then coalesce(a.qty_produced, 0) * e.wage_rate
      else 0
    end as cost
  from work_order_assignments a
  join employees e on e.employee_id = a.employee_id
  where a.production_batch_id = p_production_batch_id
    and a.status not in ('absent', 'replaced');
end;
$function$
;

-- Hak eksekusi: hanya pengguna yang SUDAH LOGIN. Keenamnya sudah diperiksa: nol
-- kebijakan RLS memakainya, jadi pencabutan ini tidak memadamkan RLS mana pun.
revoke execute on function public.process_customer_purchase_order(integer, integer) from public, anon;
revoke execute on function public.get_sales_order_margin(integer) from public, anon;
revoke execute on function public.get_monthly_operating_profit(integer, integer, integer) from public, anon;
revoke execute on function public.get_work_order_labor_cost_total(integer) from public, anon;
revoke execute on function public.get_production_batch_labor_cost_total(integer) from public, anon;
revoke execute on function public.get_production_batch_labor_cost_detail(integer) from public, anon;

grant execute on function public.process_customer_purchase_order(integer, integer) to authenticated;
grant execute on function public.get_sales_order_margin(integer) to authenticated;
grant execute on function public.get_monthly_operating_profit(integer, integer, integer) to authenticated;
grant execute on function public.get_work_order_labor_cost_total(integer) to authenticated;
grant execute on function public.get_production_batch_labor_cost_total(integer) to authenticated;
grant execute on function public.get_production_batch_labor_cost_detail(integer) to authenticated;
