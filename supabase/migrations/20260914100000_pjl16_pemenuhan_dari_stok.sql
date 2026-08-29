-- PJL-16 — SALES ORDER BOLEH SELESAI TANPA WORK ORDER.
--
-- KEPUTUSAN PEMILIK PRODUK (30 Agu 2026): penyelesaian Sales Order berarti KOMITMEN KOMERSIAL
-- TERPENUHI -- BUKAN "harus ada Work Order". FABRIX memproduksi buffer stock berdasarkan
-- forecast yang sudah terlihat, dan buffer itu sah dipakai memenuhi order berikutnya.
--
-- DUA JALUR PEMENUHAN, KEDUANYA SAH:
--   1. lewat produksi : SO -> Work Order -> produksi -> barang jadi -> pengiriman
--   2. lewat stok     : SO -> stok/buffer yang sudah ada -> pengiriman
--
-- YANG DICABUT: syarat "minimal ada satu Work Order". Versi sebelumnya menolak order yang
-- terkirim penuh dari stok lama, dan itu keliru menurut keputusan di atas.
--
-- YANG DIPERTAHANKAN, dan disengaja: bila Work Order MEMANG ADA, seluruhnya wajib selesai.
-- Sebuah order yang produksinya masih berjalan belum boleh ditutup meski barangnya sudah
-- dikirim dari stok -- komitmennya belum tuntas dieksekusi.
--
-- SUMBER PEMENUHAN DIBACA DARI JEJAK KANONIK, BUKAN KOLOM BARU:
--   shipment_lines.lot_id -> work_order_outputs.lot_id  (lot ini keluaran Work Order?)
--                         -> lots.source_type            (asal lot bila bukan dari produksi)
-- NOL kolom sales_order.stock_source dibuat -- itu akan jadi kebenaran persediaan kedua.

create or replace function public.kelayakan_penyelesaian_so(p_sales_order_id integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_so sales_orders%rowtype;
  v_baris integer;
  v_kurang integer;
  v_qty_dipesan numeric;
  v_qty_terkirim numeric;
  v_wo_total integer;
  v_wo_selesai integer;
  v_pembatalan integer;
  v_lot_total integer;
  v_lot_produksi integer;
  v_sumber text;
  v_sebab text[] := array[]::text[];
  v_layak boolean;
begin
  select * into v_so from sales_orders where sales_order_id = p_sales_order_id;
  if v_so.sales_order_id is null or v_so.company_id is distinct from public.jwt_company_id() then
    raise exception 'Sales Order tidak ditemukan di perusahaan Anda.';
  end if;

  select count(*),
         count(*) filter (where coalesce(qty_shipped, 0) < qty_ordered),
         coalesce(sum(qty_ordered), 0),
         coalesce(sum(coalesce(qty_shipped, 0)), 0)
    into v_baris, v_kurang, v_qty_dipesan, v_qty_terkirim
  from sales_order_lines where sales_order_id = p_sales_order_id;

  select count(*), count(*) filter (where wo.status = 'completed')
    into v_wo_total, v_wo_selesai
  from work_orders wo
  join sales_order_lines sol on sol.sales_order_line_id = wo.sales_order_line_id
  where sol.sales_order_id = p_sales_order_id and wo.status <> 'cancelled';

  select count(*),
         count(*) filter (where exists (select 1 from work_order_outputs woo where woo.lot_id = sl.lot_id))
    into v_lot_total, v_lot_produksi
  from shipment_lines sl
  join sales_order_lines sol on sol.sales_order_line_id = sl.sales_order_line_id
  where sol.sales_order_id = p_sales_order_id and sl.lot_id is not null;

  v_sumber := case
    when v_lot_total = 0 then 'belum_terkirim'
    when v_lot_produksi = v_lot_total then 'produksi'
    when v_lot_produksi = 0 then 'stok'
    else 'campuran'
  end;

  select count(*) into v_pembatalan
  from cancellation_requests
  where entity = 'sales_orders' and record_id = p_sales_order_id and status = 'pending';

  if v_so.status = 'completed' then
    v_sebab := array_append(v_sebab, 'Sales Order ini sudah selesai.');
  elsif v_so.status = 'cancelled' then
    v_sebab := array_append(v_sebab, 'Sales Order ini sudah dibatalkan.');
  end if;

  if v_baris = 0 then
    v_sebab := array_append(v_sebab, 'Sales Order ini belum punya baris pesanan.');
  end if;

  -- NOL TOLERANSI KURANG-KIRIM (BD-09).
  if v_kurang > 0 then
    v_sebab := array_append(v_sebab, format('Masih ada %s dari %s yang belum dikirim.',
                                 trim(to_char(v_qty_dipesan - v_qty_terkirim, 'FM999999990.####')),
                                 trim(to_char(v_qty_dipesan, 'FM999999990.####'))));
  end if;

  -- PJL-16: nol Work Order BUKAN lagi penghalang. Yang menghalangi hanyalah Work Order yang
  -- SUDAH ADA tetapi belum selesai.
  if v_wo_total > 0 and v_wo_selesai < v_wo_total then
    v_sebab := array_append(v_sebab, format('Produksi belum selesai: %s dari %s Work Order.', v_wo_selesai, v_wo_total));
  end if;

  if v_pembatalan > 0 then
    v_sebab := array_append(v_sebab, 'Masih ada permintaan pembatalan yang menunggu keputusan.');
  end if;

  v_layak := array_length(v_sebab, 1) is null;

  return jsonb_build_object(
    'layak', v_layak,
    'sebab_belum_layak', to_jsonb(v_sebab),
    'status', v_so.status,
    'baris', v_baris,
    'qty_dipesan', v_qty_dipesan,
    'qty_terkirim', v_qty_terkirim,
    'work_order_total', v_wo_total,
    'work_order_selesai', v_wo_selesai,
    'pembatalan_menunggu', v_pembatalan,
    -- PJL-16 -- sumber pemenuhan, DITURUNKAN dari jejak lot. Bukan kolom, bukan tebakan.
    'sumber_pemenuhan', v_sumber,
    'lot_terkirim', v_lot_total,
    'lot_dari_produksi', v_lot_produksi,
    'cuplikan', jsonb_build_object(
      'qty_dipesan', v_qty_dipesan,
      'qty_terkirim', v_qty_terkirim,
      'baris_kurang', v_kurang,
      'work_order_total', v_wo_total,
      'work_order_selesai', v_wo_selesai
    )
  );
end;
$$;

comment on function public.kelayakan_penyelesaian_so(integer) is
  'Kelayakan penutupan Sales Order: satu-satunya definisi, dipakai layar maupun kedua fungsi penutupan. MEMBACA saja. Nol syarat pembayaran (BD-10) dan nol syarat "harus ada Work Order" (PJL-16) -- pemenuhan boleh datang dari produksi MAUPUN dari stok yang sudah ada.';
