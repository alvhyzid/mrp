-- Migration: penegakan DATABASE (bukan cuma validasi form) — total qty_shipped kumulatif
-- untuk 1 sales_order_line_id TIDAK BOLEH melebihi qty_ordered-nya. MENGGANTI keputusan
-- desain sebelumnya (Sesi 3A 17 Agu 2026, migration 20260817140000) yang SENGAJA
-- mengizinkan over-shipment demi konsisten dengan pola goods_receipt_lines — instruksi
-- eksplisit sesi ini membalik keputusan itu KHUSUS untuk shipments (goods_receipt_lines
-- TIDAK diubah, tetap seperti semula, sesuai batas "hanya jadi referensi pola").
--
-- Pola trigger PERSIS enforce_status_transition() (hardening 17 Agustus): BEFORE
-- INSERT/UPDATE, SECURITY DEFINER (perlu, karena sales_order_lines RLS-nya enabled TAPI
-- NOL policy — default-deny total untuk role biasa, dikonfirmasi lewat query pg_policies
-- langsung sebelum menulis migrasi ini; tanpa SECURITY DEFINER, trigger ini akan gagal
-- baca qty_ordered untuk SEMUA pemanggil kecuali service-role).
--
-- Baris shipment_lines milik shipment berstatus 'cancelled' TIDAK dihitung ke total
-- kumulatif — kalau tidak, 1 shipment yang dibatalkan akan PERMANEN mengunci kuota qty
-- itu, mencegah percobaan pengiriman ulang yang sah. Ini bukan diminta eksplisit di
-- instruksi tapi konsekuensi logis wajar dari "sisa pesanan" — kalau ternyata TIDAK
-- diinginkan, mudah diubah (hapus filter `s.status <> 'cancelled'` di bawah).
create or replace function public.enforce_shipment_line_qty_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_qty_ordered numeric;
  v_already_committed numeric;
  v_remaining numeric;
begin
  select qty_ordered into v_qty_ordered
  from sales_order_lines
  where sales_order_line_id = new.sales_order_line_id;

  if v_qty_ordered is null then
    raise exception 'sales_order_line_id % tidak ditemukan.', new.sales_order_line_id;
  end if;

  select coalesce(sum(sl.qty_shipped), 0) into v_already_committed
  from shipment_lines sl
  join shipments s on s.shipment_id = sl.shipment_id
  where sl.sales_order_line_id = new.sales_order_line_id
    and s.status <> 'cancelled'
    and (TG_OP = 'INSERT' or sl.shipment_line_id <> old.shipment_line_id);

  v_remaining := v_qty_ordered - v_already_committed;

  if new.qty_shipped > v_remaining then
    raise exception 'Jumlah melebihi sisa pesanan — sisa %, diminta %.', v_remaining, new.qty_shipped
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_shipment_line_qty_limit on shipment_lines;
create trigger enforce_shipment_line_qty_limit
  before insert or update of qty_shipped, sales_order_line_id on shipment_lines
  for each row
  execute function public.enforce_shipment_line_qty_limit();
