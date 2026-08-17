-- Migration: Tutup celah "foto bukti pengiriman wajib" di level DATABASE, bukan cuma
-- API (defense-in-depth). Sebelumnya WAJIB-nya cuma dijaga updateShipmentStatus.ts
-- (menolak target 'shipped' di endpoint itu) — kalau ada jalur lain yang menulis
-- langsung ke shipments.status (mis. RPC service-role lain, migrasi data, atau bug
-- di kode aplikasi masa depan), celah itu TIDAK tertutup di DB sama sekali.
--
-- DIPERLUAS di sini (BUKAN trigger baru terpisah) — enforce_status_transition()
-- (migration 20260817140000, sudah punya pola serupa untuk customer_purchase_orders'
-- syarat 3-department approval sebelum 'processed') SATU-SATUNYA tempat aturan
-- transisi status ditegakkan lintas tabel. Body fungsi disalin PERSIS dari definisi
-- terakhir, ditambah 1 cabang baru untuk shipments — supaya perilaku tabel lain
-- (customer_purchase_orders, sales_orders, work_orders, production_batches,
-- customer_po_approvals) tidak berubah sedikit pun.
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

  -- BARU: shipments draft->shipped WAJIB sudah ada foto bukti pengiriman
  -- (dispatch_photo_url, migration 20260817190000) — ditegakkan di sini supaya
  -- tidak bisa dilewati lewat jalur mana pun selain endpoint aplikasi yang benar
  -- (processShipmentDispatch.ts, yang SELALU mengisi kolom ini dalam UPDATE yang
  -- sama sebelum trigger ini sempat jalan).
  if TG_TABLE_NAME = 'shipments' and old.status = 'draft' and new.status = 'shipped' then
    if new.dispatch_photo_url is null then
      raise exception 'Foto bukti pengiriman wajib sebelum status diubah ke Di Proses.'
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
