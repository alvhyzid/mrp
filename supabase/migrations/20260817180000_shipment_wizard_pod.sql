-- Migration: Sesi 2 (final, dikoreksi) — wizard tanda tangan Pengiriman TANPA
-- melompat status, + pod_token untuk Bukti Penerimaan publik (Sesi 3).
-- Lihat docs/rancangan-skema-database-mrp.md > shipments.pod_token & delivery_confirmations.

-- (a) pod_token: dibuat OTOMATIS oleh trigger (bukan app-layer) tepat saat status
-- jadi 'shipped' — acak/tidak bisa ditebak (gen_random_uuid() bawaan PostgreSQL 13+,
-- tidak butuh extension pgcrypto). unique supaya lookup pod_token->shipment 1:1 pasti.
alter table if exists shipments add column if not exists pod_token text;
alter table if exists shipments add constraint shipments_pod_token_unique unique (pod_token);

-- (b) delivery_confirmations: Bukti Penerimaan dari CLIENT (Sesi 3, halaman publik
-- tanpa login) — TIDAK terikat user_id (client bukan user terdaftar).
create table if not exists delivery_confirmations (
  delivery_confirmation_id serial primary key,
  shipment_id integer not null references shipments(shipment_id),
  photo_url text not null,
  received_by_name text,
  confirmed_at timestamptz not null default now()
);

create index if not exists delivery_confirmations_shipment_id_idx on delivery_confirmations (shipment_id);

alter table if exists delivery_confirmations enable row level security;

-- Baca: staf internal company yang sama (lihat riwayat POD) — scoped lewat join ke
-- shipments karena tabel ini sendiri tidak punya company_id langsung.
drop policy if exists delivery_confirmations_select_for_company on delivery_confirmations;
create policy delivery_confirmations_select_for_company on delivery_confirmations
  for select using (
    exists (select 1 from shipments s where s.shipment_id = delivery_confirmations.shipment_id and s.company_id = public.jwt_company_id())
  );

-- TIDAK ADA policy insert untuk role authenticated ATAU anon — baris ini HANYA
-- ditulis lewat endpoint publik (Sesi 3) yang pakai service-role SETELAH memvalidasi
-- pod_token & status shipment sendiri di kode aplikasi (pengunjung publik tidak
-- punya JWT sama sekali, jadi RLS berbasis jwt_company_id() tidak relevan di sini —
-- keamanan endpoint publik ada di app-layer, bukan di RLS tabel ini).

-- (c) process_shipment_shipped() (Sesi 3A, migration 20260817140000) — DIPERLUAS
-- (bukan direstrukturisasi) HANYA menambah 1 UPDATE generate pod_token di akhir,
-- SETELAH loop pengurangan stok yang sudah ada. Trigger ini AFTER UPDATE (bukan
-- BEFORE), jadi assignment "new.pod_token := ..." TIDAK akan tersimpan (AFTER
-- trigger tidak bisa mengubah baris lewat NEW) — makanya dipakai UPDATE eksplisit,
-- BUKAN mengubah NEW. Body loop stok SAMA PERSIS, tidak ada satu baris pun diubah.
create or replace function public.process_shipment_shipped()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_line record;
  v_lot_company_id integer;
  v_current_qty numeric;
begin
  for v_line in
    select shipment_line_id, lot_id, item_id, qty_shipped, sales_order_line_id
    from shipment_lines
    where shipment_id = new.shipment_id
  loop
    select company_id, quantity_on_hand into v_lot_company_id, v_current_qty
    from lots where lot_id = v_line.lot_id for update;

    if v_lot_company_id is null then
      raise exception 'Lot % (shipment_line %) tidak ditemukan.', v_line.lot_id, v_line.shipment_line_id;
    end if;

    if v_current_qty < v_line.qty_shipped then
      raise exception 'Stok lot % tidak cukup untuk shipment_line % (stok tersedia %, diminta %).',
        v_line.lot_id, v_line.shipment_line_id, v_current_qty, v_line.qty_shipped
        using errcode = '23514';
    end if;

    update lots set quantity_on_hand = quantity_on_hand - v_line.qty_shipped where lot_id = v_line.lot_id;

    insert into stock_movements (company_id, lot_id, movement_type, qty, reference_doc, created_by)
    values (v_lot_company_id, v_line.lot_id, 'shipment', -v_line.qty_shipped, 'SHIP-' || new.shipment_id, null);

    update sales_order_lines set qty_shipped = qty_shipped + v_line.qty_shipped
    where sales_order_line_id = v_line.sales_order_line_id;

    perform public.recompute_stock_projection_for_item(v_line.item_id);
  end loop;

  -- TAMBAHAN Sesi 2 (final): generate pod_token tepat di momen ini (status baru saja
  -- jadi 'shipped'). "where pod_token is null" murni jaga-jaga idempotency (state
  -- machine sudah menjamin draft->shipped cuma terjadi 1x per shipment, tidak
  -- mengandalkan guard ini untuk kebenaran, cuma pengaman tambahan).
  update shipments set pod_token = gen_random_uuid()::text
  where shipment_id = new.shipment_id and pod_token is null;

  return new;
end;
$function$;

-- (d) Fungsi ATOMIK BARU untuk wizard: bikin shipments (status TETAP 'draft') +
-- shipment_lines + document_signatures dalam 1 transaksi. BEDA TOTAL dari
-- sign_and_ship_shipment() versi sebelumnya (sudah di-drop, tidak pernah di-commit) —
-- versi itu menggabungkan tanda tangan DENGAN transisi ke 'shipped', versi ini
-- SENGAJA TIDAK menyentuh status/stok sama sekali. Tombol "Dikirim" yang sudah ada
-- (Sesi 3A/3B, UPDATE status biasa) TETAP satu-satunya pemicu draft->shipped, TIDAK
-- diubah oleh migrasi ini.
--
-- p_lines: jsonb array [{sales_order_line_id, item_id, qty_shipped, lot_id}, ...] —
-- tiap elemen di-insert SATU PER SATU ke shipment_lines supaya trigger
-- enforce_shipment_line_qty_limit (Sesi 3A, BEFORE INSERT per baris) tetap berlaku
-- APA ADANYA per baris, tidak diduplikasi/dilewati.
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
  p_confirmation_text text
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

  insert into shipments (company_id, sales_order_id, shipment_number, delivery_address, recipient_name, recipient_phone, vehicle_number, driver_name)
  values (p_company_id, p_sales_order_id, p_shipment_number, p_delivery_address, p_recipient_name, p_recipient_phone, p_vehicle_number, p_driver_name)
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
