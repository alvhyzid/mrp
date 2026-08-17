-- Migration: Shipments tahap fisik (Sesi 3A, rencana-kerja-playbook-ams.md) — traceability
-- lot WAJIB, nomor surat jalan otomatis, state machine draft->shipped->delivered, dan
-- pengurangan stok yang TEPAT terjadi saat status berubah jadi 'shipped' (BUKAN saat baris
-- shipment_line ditambahkan, karena baris bisa ditambah berkali-kali selagi masih draft).
--
-- Pola trigger stok/stock_movements MENGIKUTI persis process_goods_receipt_line() dan
-- trigger_recompute_stock_projection() (lihat migrations 20260812152500/20260812155500) —
-- SATU perbedaan bentuk yang disengaja: kedua fungsi itu AFTER INSERT di tabel detail
-- (1 baris baru = 1 efek stok), sedangkan di sini efeknya baru boleh terjadi saat HEADER
-- (shipments) pindah status ke 'shipped' — jadi triggernya AFTER UPDATE OF status di
-- shipments, isinya LOOP semua shipment_lines yang sudah ada untuk shipment itu. Ini
-- konsekuensi langsung dari requirement "draft dulu, baris ditambah beberapa kali, baru
-- disubmit" — bukan pola baru yang dipilih sembarangan.

-- (a) Traceability lot WAJIB — tabel ini 0 baris sekarang (dicek di Laporan Arkeologi
-- sebelumnya), jadi SET NOT NULL langsung aman. Kalau asumsi ini salah, ALTER ini sendiri
-- yang akan gagal keras (Postgres menolak NOT NULL kalau ada baris existing yang NULL) —
-- sengaja tidak ditambah guard manual terpisah, constraint asli sudah jadi pengaman.
alter table shipment_lines
  alter column lot_id set not null;

-- (b) shipment_number: pola PERSIS so_number (sales_orders) — text nullable di level DB
-- (selalu diisi app-layer sebelum insert, sama seperti so_number bukan DB-generated),
-- unique per company. Prefix "SJ-" (Surat Jalan) SENGAJA ditambahkan supaya tidak
-- tertukar visual dengan nomor SO walau strukturnya sama — lihat catatan di
-- generateShipmentNumber() (Sesi 3A app-layer, HANYA satu implementasi TypeScript, TIDAK
-- diduplikasi jadi fungsi DB seperti process_customer_purchase_order() — so_number PUNYA
-- fungsi DB kedua sebagai pengaman jalur RPC langsung, tapi itu menambah beban sinkronisasi
-- yang sudah diakui sebagai utang teknis di komentar processCustomerPurchaseOrder.ts; tidak
-- direplikasi di sini supaya tidak menambah utang yang sama).
--
-- delivery_address WAJIB diisi tiap kali (bisa beda per pengiriman meski SO/customer sama)
-- — NOT NULL langsung karena tabel 0 baris. recipient_name/recipient_phone/vehicle_number/
-- driver_name nullable (opsional, bisa diisi belakangan/tidak semua pengiriman butuh).
alter table shipments
  add column shipment_number text,
  add column vehicle_number text,
  add column driver_name text,
  add column delivery_address text not null,
  add column recipient_name text,
  add column recipient_phone text;

alter table shipments
  add constraint shipments_shipment_number_unique unique (company_id, shipment_number);

-- (c) qty_shipped kumulatif di sales_order_lines — pola PERSIS purchase_order_lines.qty_received
-- (increment otomatis oleh trigger, bukan dihitung on-the-fly). Tipe numeric(14,4) sama
-- seperti qty_ordered di tabel yang sama.
alter table sales_order_lines
  add column qty_shipped numeric(14,4) not null default 0;

-- (d) Daftarkan shipments ke state machine generik yang sudah ada (status_transition_rules +
-- enforce_status_transition(), migration 20260817100000). draft->shipped, draft->cancelled,
-- shipped->delivered — SELAIN itu ditolak (termasuk draft->delivered langsung, dan
-- shipped->shipped/apa pun setelah delivered/cancelled karena keduanya TERMINAL, sama seperti
-- pola cancelled/processed di customer_purchase_orders).
insert into status_transition_rules (table_name, from_status, to_status) values
  ('shipments', 'draft', 'shipped'),
  ('shipments', 'draft', 'cancelled'),
  ('shipments', 'shipped', 'delivered')
on conflict (table_name, from_status, to_status) do nothing;

-- enforce_status_transition() adalah 1 fungsi generik dipakai lintas tabel (lihat komentar
-- panjang di migration 20260817100000 soal kenapa IF/ELSIF, bukan CASE) — DIPERLUAS di sini
-- dengan 1 cabang baru untuk shipments, isi body SELEBIHNYA disalin PERSIS dari definisi
-- terakhir (20260817100500) supaya perilaku 5 tabel lama tidak berubah sedikit pun. Postgres
-- tidak punya cara "tambah 1 cabang" ke fungsi yang sudah ada selain CREATE OR REPLACE utuh.
create or replace function public.enforce_status_transition()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_allowed boolean;
  v_record_id integer;
  v_company_id integer;
  v_changed_by integer;
  v_approved_count integer;
begin
  if new.status = old.status then
    return new;
  end if;

  select exists (
    select 1 from status_transition_rules
    where table_name = TG_TABLE_NAME and from_status = old.status and to_status = new.status
  ) into v_allowed;

  if not v_allowed then
    raise exception 'Transisi status % -> % tidak valid untuk tabel %.', old.status, new.status, TG_TABLE_NAME
      using errcode = '23514';
  end if;

  if TG_TABLE_NAME = 'customer_purchase_orders' and new.status = 'processed' then
    select count(*) into v_approved_count
    from customer_po_approvals
    where customer_purchase_order_id = new.customer_purchase_order_id and status = 'approved';
    if v_approved_count < 3 then
      raise exception 'customer_purchase_orders % belum disetujui ketiga department (baru % dari 3) — tidak boleh diproses.', new.customer_purchase_order_id, v_approved_count
        using errcode = '23514';
    end if;
  end if;

  if TG_TABLE_NAME = 'customer_purchase_orders' then
    v_record_id := new.customer_purchase_order_id;
    v_company_id := new.company_id;
    v_changed_by := new.processed_by;
  elsif TG_TABLE_NAME = 'sales_orders' then
    v_record_id := new.sales_order_id;
    v_company_id := new.company_id;
  elsif TG_TABLE_NAME = 'work_orders' then
    v_record_id := new.work_order_id;
    v_company_id := new.company_id;
  elsif TG_TABLE_NAME = 'production_batches' then
    v_record_id := new.production_batch_id;
    v_company_id := new.company_id;
  elsif TG_TABLE_NAME = 'customer_po_approvals' then
    v_record_id := new.customer_po_approval_id;
    v_changed_by := new.approved_by;
    select company_id into v_company_id from customer_purchase_orders where customer_purchase_order_id = new.customer_purchase_order_id;
  elsif TG_TABLE_NAME = 'shipments' then
    v_record_id := new.shipment_id;
    v_company_id := new.company_id;
  end if;

  insert into status_transition_log (company_id, table_name, record_id, from_status, to_status, changed_by, reason)
  values (v_company_id, TG_TABLE_NAME, v_record_id, old.status, new.status, v_changed_by, null);

  return new;
end;
$$;

drop trigger if exists enforce_status_transition on shipments;
create trigger enforce_status_transition
  before update of status on shipments
  for each row
  execute function public.enforce_status_transition();

-- (e) Pengurangan stok TEPAT saat status jadi 'shipped' — trigger TERPISAH dari
-- enforce_status_transition (yang cuma menjaga transisi valid & mencatat log), AFTER UPDATE
-- supaya jalan SETELAH enforce_status_transition sudah memastikan transisi ini sah (kalau
-- transisi ilegal, enforce_status_transition sudah melempar exception di tahap BEFORE UPDATE
-- dan baris tidak pernah benar-benar ter-update — trigger ini tidak akan sempat jalan sama
-- sekali untuk kasus itu). WHEN clause memastikan ini persis 1 kali per shipment (hanya
-- transisi draft->shipped yang memicu, dan status_transition_rules sudah menjamin sebuah
-- shipment tidak bisa balik ke draft atau ke shipped lagi setelah initial transisi).
--
-- Soal qty melebihi sales_order_lines.qty_ordered: SENGAJA TIDAK diblok di sini (lihat
-- process_goods_receipt_line() — qty_received juga naik tanpa batas terhadap qty_ordered,
-- tidak ada preseden constraint "tidak boleh lebih dari yang dipesan" di manapun di
-- codebase ini). Yang DIBLOK cuma stok lot fisik tidak cukup (guard SELECT...FOR UPDATE +
-- cek, pola PERSIS record_manual_stock_adjustment()).
create or replace function public.process_shipment_shipped()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
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

  return new;
end;
$$;

drop trigger if exists shipments_process_shipped on shipments;
create trigger shipments_process_shipped
  after update of status on shipments
  for each row
  when (old.status = 'draft' and new.status = 'shipped')
  execute function public.process_shipment_shipped();

-- (f) Saran lot FEFO — fungsi baca murni, SENGAJA BUKAN security definer (beda dari fungsi
-- di atas) supaya RLS lots (lots_write_operations, satu-satunya policy di tabel itu, cmd ALL
-- termasuk SELECT) tetap berlaku otomatis lewat privilese pemanggil sendiri — tidak perlu
-- filter company_id manual di sini, dan otomatis terbatas ke role yang memang boleh lihat
-- lots (warehouse/production/ppic + leadership), tidak ada risiko bocor lintas company.
create or replace function public.suggest_fefo_lots(p_item_id integer, p_production_plant_id integer)
returns table (lot_id integer, lot_number text, expiry_date date, quantity_on_hand numeric)
language sql
stable
as $$
  select lot_id, lot_number, expiry_date, quantity_on_hand
  from lots
  where item_id = p_item_id
    and production_plant_id = p_production_plant_id
    and status = 'available'
    and quantity_on_hand > 0
  order by expiry_date asc nulls last, lot_id asc;
$$;
