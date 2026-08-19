-- Migration: perbaikan pendekatan peringatan ambang margin (Margin Watch
-- Lapis 2). upsert_department_alert/resolve_department_alerts (yang tadinya
-- akan dipakai ulang) TERNYATA sudah diubah migration 20260819150000 (audit
-- keamanan) supaya company_id WAJIB diturunkan dari related_work_order_id
-- ATAU related_item_id -- kalau KEDUANYA null (persis kasus alert margin,
-- yang terkait sales_order_line, BUKAN work_order/item), fungsi itu diam-diam
-- return TANPA melakukan apa pun (ditemukan lewat percobaan nyata: alert
-- ter-upsert tapi resolve tidak pernah benar-benar mengubah status). Fungsi
-- itu JUGA sudah di-revoke dari authenticated (hanya dipanggil bersarang dari
-- trigger lain sejak audit keamanan) -- app layer tidak semestinya
-- memanggilnya langsung lagi.
--
-- Solusi: fungsi BARU, MANDIRI, khusus alert margin -- pakai related_po_id
-- (kolom fleksibel tanpa FK yang sudah didokumentasikan dipakai lintas
-- makna tergantung alert_type sejak migration awal system_alerts) untuk
-- menyimpan sales_order_line_id. Company_id diverifikasi milik sales_order_line
-- itu sendiri (bukan dipercaya mentah dari parameter) -- pola sama dengan
-- perbaikan upsert_department_alert di audit keamanan.
create or replace function public.upsert_margin_threshold_alert(
  p_sales_order_line_id integer,
  p_item_code text,
  p_projected_margin numeric,
  p_threshold numeric
) returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $function$
declare
  v_company_id integer;
  v_dept text;
  v_existing_id integer;
  v_message text;
begin
  select so.company_id into v_company_id
  from sales_order_lines sol
  join sales_orders so on so.sales_order_id = sol.sales_order_id
  where sol.sales_order_line_id = p_sales_order_line_id;

  if v_company_id is null then
    return;
  end if;

  if p_threshold is null or p_projected_margin >= p_threshold then
    update system_alerts
    set status = 'resolved'
    where company_id = v_company_id
      and alert_type = 'margin_threshold_breach'
      and related_po_id = p_sales_order_line_id
      and status = 'open';
    return;
  end if;

  v_message := format('Proyeksi margin SO line #%s (%s) Rp%s — di bawah ambang Rp%s.', p_sales_order_line_id, p_item_code, round(p_projected_margin), round(p_threshold));

  foreach v_dept in array array['finance', 'management']
  loop
    select system_alert_id into v_existing_id
    from system_alerts
    where company_id = v_company_id
      and alert_type = 'margin_threshold_breach'
      and target_department = v_dept
      and related_po_id = p_sales_order_line_id
      and status = 'open'
    limit 1;

    if v_existing_id is null then
      insert into system_alerts (company_id, alert_type, target_department, related_po_id, message, severity)
      values (v_company_id, 'margin_threshold_breach', v_dept, p_sales_order_line_id, v_message, 'critical');
    else
      update system_alerts set message = v_message where system_alert_id = v_existing_id;
    end if;
  end loop;
end;
$function$;

revoke execute on function public.upsert_margin_threshold_alert(integer, text, numeric, numeric) from public, anon, authenticated;
grant execute on function public.upsert_margin_threshold_alert(integer, text, numeric, numeric) to service_role;
