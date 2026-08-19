-- Migration: get_monthly_operating_profit() sekarang mengelompokkan berdasar
-- PERIODE GAJIAN (company_settings.payroll_period_start_day, mis. 26 = periode
-- 26 bulan sebelumnya s/d 25 bulan berjalan) -- bukan bulan kalender lagi.
-- Keputusan EKSPLISIT pemilik produk (21 Agu 2026, Bagian E): komponen biaya
-- terbesar (gaji) dihitung per periode gajian, jadi laporan laba operasional
-- HARUS ikut periode yang sama supaya tidak muncul "anomali" yang sebenarnya
-- cuma beda penanggalan.
--
-- FALLBACK: company yang BELUM mengisi payroll_period_start_day (NULL) tetap
-- pakai bulan KALENDER PERSIS SEPERTI SEBELUMNYA -- zero regresi utk tenant
-- yang belum mengonfigurasi ini.
--
-- p_year/p_month TETAP jadi LABEL periode (mis. year=2026,month=8 = "Agustus
-- 2026" = periode gaji 26 Jul - 25 Agu 2026 kalau start_day=26) -- dipilih
-- supaya pemanggil (UI, kalau nanti dibuat) tidak perlu berubah cara
-- memilih bulan, cuma ARTI "bulan" yang berubah begitu tenant mengisi config.
-- Return type BERUBAH (tambah period_start/period_end) -- Postgres tidak
-- mengizinkan CREATE OR REPLACE mengubah tipe return, harus DROP dulu.
drop function if exists public.get_monthly_operating_profit(integer, integer, integer);

create function public.get_monthly_operating_profit(p_company_id integer, p_year integer, p_month integer)
returns table (total_margin numeric, overhead numeric, operating_profit numeric, period_start date, period_end date)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_total_margin numeric;
  v_overhead numeric;
  v_start_day integer;
  v_period_start date;
  v_period_end date;
begin
  if p_company_id <> public.jwt_company_id() then
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
$$;

grant execute on function public.get_monthly_operating_profit(integer, integer, integer) to authenticated, service_role;
