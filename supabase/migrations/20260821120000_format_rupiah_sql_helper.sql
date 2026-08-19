-- Migration: format_rupiah_id() -- padanan SQL dari formatCurrency()
-- (src/lib/currency.ts) untuk kalimat notifikasi yang DIBUAT DI DALAM Postgres
-- (system_alerts.message) -- Perintah Gabungan A-F, Bagian F (21 Agu 2026).
-- Sebelumnya upsert_margin_threshold_alert() menulis "Rp1523025" tanpa
-- pemisah ribuan -- angka mentah dalam kalimat notifikasi persis kategori
-- yang gampang terlewat saat menyapu format uang.
--
-- SENGAJA TIDAK pakai to_char(..., 'FM999G999...') -- karakter G locale-aware
-- (bisa jadi koma/titik/spasi tergantung lc_numeric koneksi, TIDAK dijamin
-- Indonesia di lingkungan Supabase). Koma LITERAL di pola to_char ("999,999")
-- SELALU dikeluarkan apa adanya terlepas locale (beda dari G) -- lalu diganti
-- manual jadi titik di sini, supaya hasilnya konsisten di lingkungan mana pun.
create or replace function public.format_rupiah_id(p_value numeric)
returns text
language sql
immutable
as $$
  select 'Rp' || replace(trim(both ' ' from to_char(round(p_value), 'FM999,999,999,999,999,999')), ',', '.');
$$;

grant execute on function public.format_rupiah_id(numeric) to authenticated, service_role;

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

  v_message := format('Proyeksi margin SO line #%s (%s) %s — di bawah ambang %s.', p_sales_order_line_id, p_item_code, public.format_rupiah_id(p_projected_margin), public.format_rupiah_id(p_threshold));

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
