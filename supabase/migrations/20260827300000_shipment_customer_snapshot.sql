-- Alur 1 (3.1b, 21 Agu 2026) — shipments HANYA menyimpan sales_order_id;
-- getShipmentDetail.ts (baris 43/79) melakukan JOIN LIVE ke customers.name
-- setiap kali surat jalan dibuka/dicetak. Dibuktikan: ubah nama/alamat
-- customer hari ini, surat jalan BULAN LALU yang sudah dicetak & ditandatangani
-- akan ikut menampilkan versi BARU begitu dimuat ulang. Perbaikan: bekukan
-- identitas mitra PERSIS saat shipment dibuat (pola sama dengan snapshot
-- routing/BOM Sesi 6A) -- 3 parameter baru DITAMBAHKAN di akhir (default null,
-- tidak memutus signature lama kalau ada pemanggil lain).
create or replace function public.create_shipment_with_signature(
  p_company_id integer,
  p_sales_order_id integer,
  p_shipment_number text,
  p_delivery_address text,
  p_recipient_name text,
  p_recipient_phone text,
  p_vehicle_number text,
  p_driver_name text,
  p_lines jsonb,
  p_signed_by integer,
  p_signer_role text,
  p_signature_url_snapshot text,
  p_confirmation_text text,
  p_customer_name_snapshot text default null,
  p_customer_billing_address_snapshot text default null,
  p_customer_npwp_snapshot text default null
)
returns table (out_shipment_id integer, out_shipment_number text, out_document_signature_id integer)
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $$
declare
  v_shipment_id integer;
  v_document_signature_id integer;
  v_line jsonb;
begin
  if p_signature_url_snapshot is null then
    raise exception 'Tanda tangan digital belum diunggah — tidak bisa membuat pengiriman.';
  end if;
  if jsonb_array_length(p_lines) = 0 then
    raise exception 'Minimal 1 baris item wajib diisi.';
  end if;

  insert into shipments (
    company_id, sales_order_id, shipment_number, delivery_address, recipient_name, recipient_phone,
    vehicle_number, driver_name, customer_name_snapshot, customer_billing_address_snapshot, customer_npwp_snapshot
  )
  values (
    p_company_id, p_sales_order_id, p_shipment_number, p_delivery_address, p_recipient_name, p_recipient_phone,
    p_vehicle_number, p_driver_name, p_customer_name_snapshot, p_customer_billing_address_snapshot, p_customer_npwp_snapshot
  )
  returning shipment_id into v_shipment_id;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    insert into shipment_lines (shipment_id, sales_order_line_id, item_id, qty_shipped, lot_id)
    values (
      v_shipment_id,
      (v_line ->> 'sales_order_line_id')::integer,
      (v_line ->> 'item_id')::integer,
      (v_line ->> 'qty_shipped')::numeric,
      (v_line ->> 'lot_id')::integer
    );
  end loop;

  insert into document_signatures (company_id, document_type, document_id, signed_by, signer_role_at_signing, signature_url_snapshot, confirmation_text)
  values (p_company_id, 'shipment', v_shipment_id, p_signed_by, p_signer_role, p_signature_url_snapshot, p_confirmation_text)
  returning document_signature_id into v_document_signature_id;

  return query select v_shipment_id, p_shipment_number, v_document_signature_id;
end;
$$;
