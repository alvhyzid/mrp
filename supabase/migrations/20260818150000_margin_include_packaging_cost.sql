-- Migration: get_sales_order_margin() diperbarui supaya biaya = unit_cost (bahan
-- non-kemasan+SDM) + packaging_cost (kolom baru, migration 20260818140000) — sebelum
-- ini cuma pakai unit_cost, sekarang menjumlah kedua suku persis seperti rumus §3:
-- "Biaya produksi order = Σ biaya batch + biaya kemasan".
create or replace function public.get_sales_order_margin(p_sales_order_id integer)
returns table (revenue numeric, cost numeric, margin numeric)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_company_id integer;
begin
  select so.company_id into v_company_id from sales_orders so where so.sales_order_id = p_sales_order_id;
  if v_company_id is null then
    return query select 0::numeric, 0::numeric, 0::numeric;
    return;
  end if;
  if v_company_id <> public.jwt_company_id() then
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
$$;

grant execute on function public.get_sales_order_margin(integer) to authenticated, service_role;

create or replace function public.get_monthly_operating_profit(p_company_id integer, p_year integer, p_month integer)
returns table (total_margin numeric, overhead numeric, operating_profit numeric)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_total_margin numeric;
  v_overhead numeric;
begin
  if p_company_id <> public.jwt_company_id() then
    raise exception 'Perusahaan tidak ditemukan.';
  end if;
  if not public.jwt_can_view_financial_data() then
    raise exception 'Anda tidak punya akses ke data margin.';
  end if;

  select coalesce(sum(sl.qty_shipped * (sol.unit_price - coalesce(l.unit_cost, 0) - coalesce(l.packaging_cost, 0))), 0) into v_total_margin
  from shipment_lines sl
  join sales_order_lines sol on sol.sales_order_line_id = sl.sales_order_line_id
  join sales_orders so on so.sales_order_id = sol.sales_order_id
  join shipments sh on sh.shipment_id = sl.shipment_id
  left join lots l on l.lot_id = sl.lot_id
  where so.company_id = p_company_id
    and sh.status in ('shipped', 'delivered')
    and extract(year from sh.shipment_date) = p_year
    and extract(month from sh.shipment_date) = p_month;

  select coalesce(nullif(cs.setting_value, '')::numeric, 0) into v_overhead
  from company_settings cs where cs.company_id = p_company_id and cs.setting_key = 'monthly_overhead_baseline';
  v_overhead := coalesce(v_overhead, 0);

  return query select v_total_margin, v_overhead, (v_total_margin - v_overhead);
end;
$$;

grant execute on function public.get_monthly_operating_profit(integer, integer, integer) to authenticated, service_role;
