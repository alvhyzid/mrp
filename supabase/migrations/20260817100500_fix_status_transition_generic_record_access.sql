-- Migration: perbaikan bug di enforce_status_transition() (migrasi
-- 20260817100000) — versi awal menulis record_id/company_id/changed_by pakai
-- `CASE TG_TABLE_NAME WHEN ... THEN new.field END` sebagai satu ekspresi.
-- PL/pgSQL mengompilasi itu jadi SATU query SQL yang butuh SEMUA field di semua
-- cabang valid untuk tipe NEW yang lagi aktif — walau cabangnya tidak "kena",
-- referensi field dari tabel lain (mis. new.sales_order_id saat NEW sebenarnya
-- baris customer_purchase_orders) tetap gagal di-resolve, melempar
-- "record new has no field ...". Ketemu saat verifikasi transisi VALID
-- (new -> on_hold) — transisi TIDAK VALID kebetulan tidak kena bug ini karena
-- sudah RAISE EXCEPTION lebih dulu, sebelum baris bermasalah itu tereksekusi.
-- Diperbaiki dengan IF/ELSIF (statement terpisah, field access baru di-resolve
-- betul-betul cuma saat cabangnya kena) menggantikan CASE-sebagai-ekspresi.

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
  -- FROM = TO bukan transisi (mis. update field lain sekalian menyertakan status
  -- yang nilainya sama) — selalu diizinkan, tidak dicatat sebagai transisi.
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

  -- Aturan tambahan di luar bentuk graf umum: customer_purchase_orders cuma boleh
  -- 'processed' kalau ketiga department sudah approve (sinkron dengan
  -- processCustomerPurchaseOrder.ts DAN docs/rancangan-skema-database-mrp.md).
  if TG_TABLE_NAME = 'customer_purchase_orders' and new.status = 'processed' then
    select count(*) into v_approved_count
    from customer_po_approvals
    where customer_purchase_order_id = new.customer_purchase_order_id and status = 'approved';
    if v_approved_count < 3 then
      raise exception 'customer_purchase_orders % belum disetujui ketiga department (baru % dari 3) — tidak boleh diproses.', new.customer_purchase_order_id, v_approved_count
        using errcode = '23514';
    end if;
  end if;

  -- record_id/company_id/changed_by: SENGAJA ditulis sebagai IF/ELSIF (bukan CASE
  -- TG_TABLE_NAME WHEN ... THEN new.field END seperti draf awal) — NEW di sini
  -- bertipe RECORD generik (fungsi ini dipasang di 5 tabel berbeda), dan PL/pgSQL
  -- mengompilasi satu ekspresi CASE seperti itu jadi SATU query SQL yang perlu
  -- semua field di semua cabang valid untuk TIPE NEW YANG SEDANG AKTIF — walau
  -- cabang itu tidak "kena", field dari tabel lain (mis. new.sales_order_id saat
  -- NEW sebenarnya baris customer_purchase_orders) tetap gagal di-resolve dan
  -- melempar error "record new has no field ...". IF/ELSIF adalah statement
  -- terpisah yang dieksekusi (dan field access-nya baru di-resolve) betul-betul
  -- cuma saat cabangnya kena, jadi aman untuk NEW yang tipenya beda-beda begini.
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
    -- customer_po_approvals tidak punya company_id sendiri (nempel ke customer_purchase_orders).
    v_record_id := new.customer_po_approval_id;
    v_changed_by := new.approved_by;
    select company_id into v_company_id from customer_purchase_orders where customer_purchase_order_id = new.customer_purchase_order_id;
  end if;

  insert into status_transition_log (company_id, table_name, record_id, from_status, to_status, changed_by, reason)
  values (v_company_id, TG_TABLE_NAME, v_record_id, old.status, new.status, v_changed_by, null);

  return new;
end;
$$;
