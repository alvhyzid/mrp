-- PERBAIKAN KERAS (21 Agu 2026) — migrasi 20260827300000 (snapshot identitas
-- client Alur 1) memakai "create or replace function" dan menyalin badan
-- fungsi dari migrasi LAMA (20260817180000), bukan dari versi TERKINI
-- (20260819150000, audit keamanan 19 Agu 2026). Akibatnya DUA hal ikut
-- hilang tanpa disadari: (1) pemeriksaan p_company_id vs sales_order
-- sungguhan (dulu "trust-the-parameter", sudah ditambal), dan (2) revoke
-- execute dari public/anon/authenticated (CREATE OR REPLACE FUNCTION me-
-- reset grant ke default PostgreSQL, yaitu PUBLIC EXECUTE). Ditemukan lewat
-- tests/function_grant_security_audit.test.ts (regresi terdeteksi otomatis,
-- bukan ditemukan manual) SEBELUM sempat dilaporkan sebagai "selesai".
--
-- Migrasi ini mengembalikan pemeriksaan company_id DAN menambahkan 3
-- parameter snapshot Alur 1, LALU menegakkan ulang revoke/grant yang benar
-- dengan SIGNATURE BARU (13 parameter lama + 3 parameter snapshot).
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
set search_path = public, pg_catalog
as $function$
declare
  v_shipment_id integer;
  v_document_signature_id integer;
  v_line jsonb;
  v_actual_company_id integer;
begin
  select company_id into v_actual_company_id from sales_orders where sales_order_id = p_sales_order_id;
  if v_actual_company_id is null then
    raise exception 'Sales order tidak ditemukan.';
  end if;
  if v_actual_company_id <> p_company_id then
    raise exception 'company_id tidak cocok dengan sales order yang dirujuk.';
  end if;
  if public.jwt_company_id() is not null and public.jwt_company_id() <> v_actual_company_id then
    raise exception 'Sales order tidak ditemukan di perusahaan Anda.';
  end if;

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
$function$;

-- Signature LAMA (13 parameter, tanpa snapshot) dari migrasi 20260827300000
-- masih ada sebagai overload terpisah di Postgres (CREATE OR REPLACE dengan
-- parameter default TAMBAHAN membuat overload baru, bukan mengganti yang
-- lama) -- drop eksplisit supaya tidak ada 2 versi fungsi yang hidup
-- berdampingan, salah satunya lupa di-revoke.
drop function if exists public.create_shipment_with_signature(integer, integer, text, text, text, text, text, text, jsonb, integer, text, text, text);

revoke execute on function public.create_shipment_with_signature(integer, integer, text, text, text, text, text, text, jsonb, integer, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_shipment_with_signature(integer, integer, text, text, text, text, text, text, jsonb, integer, text, text, text, text, text, text) to service_role;
