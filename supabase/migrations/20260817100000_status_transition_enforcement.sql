-- Migration: penegakan state machine + audit trail status di level DATABASE — lapis
-- pertahanan KEDUA yang independen dari kode aplikasi (audit 16 Agu 2026 menemukan
-- kode aplikasi bisa dilewati begitu saja lewat koneksi service-role langsung, tidak
-- ada satu pun constraint/trigger di database yang menahan transisi status tidak
-- valid, mis. customer_purchase_orders bisa lompat 'cancelled' -> 'processed').

-- Log generik LINTAS TABEL (bukan 1 tabel log per entitas) — setiap transisi status
-- VALID yang benar-benar terjadi di 5 tabel bertanda di bawah tercatat di sini.
create table if not exists status_transition_log (
  status_transition_log_id serial primary key,
  company_id integer references companies(company_id),
  table_name text not null,
  record_id integer not null,
  from_status text not null,
  to_status text not null,
  changed_by integer references users(user_id),
  changed_at timestamptz not null default now(),
  reason text
);

create index if not exists status_transition_log_company_id_idx on status_transition_log (company_id);
create index if not exists status_transition_log_table_record_idx on status_transition_log (table_name, record_id);

alter table if exists status_transition_log enable row level security;

drop policy if exists status_transition_log_select_for_company on status_transition_log;
create policy status_transition_log_select_for_company on status_transition_log
  for select using (company_id = public.jwt_company_id());

-- Baris di sini HANYA ditulis oleh trigger (security definer di bawah) — tidak ada
-- policy insert/update/delete untuk role biasa, supaya log tidak bisa diubah/dihapus
-- lewat jalur normal (integritas audit trail).

-- Definisi graf transisi valid per tabel — data-driven (nambah tabel baru = INSERT
-- baris baru + 1 CREATE TRIGGER, bukan menulis ulang fungsinya). Kalau FROM = TO,
-- itu BUKAN transisi (sekadar update kolom lain) dan selalu diizinkan tanpa perlu
-- terdaftar di sini — lihat enforce_status_transition() di bawah.
create table if not exists status_transition_rules (
  status_transition_rule_id serial primary key,
  table_name text not null,
  from_status text not null,
  to_status text not null,
  unique (table_name, from_status, to_status)
);

insert into status_transition_rules (table_name, from_status, to_status) values
  -- customer_purchase_orders: 'new' bisa ditunda/dibatalkan/diproses; 'on_hold' bisa
  -- dilanjut lagi ke 'new' atau dibatalkan; 'cancelled'/'processed' TERMINAL (sesuai
  -- permintaan eksplisit: cancelled TIDAK BOLEH -> processed, processed TIDAK BOLEH
  -- -> apa pun). on_hold TIDAK BOLEH langsung -> processed (harus lewat 'new' dulu,
  -- sinkron dengan pengecekan `po.status !== 'new'` di processCustomerPurchaseOrder.ts).
  ('customer_purchase_orders', 'new', 'on_hold'),
  ('customer_purchase_orders', 'new', 'cancelled'),
  ('customer_purchase_orders', 'new', 'processed'),
  ('customer_purchase_orders', 'on_hold', 'new'),
  ('customer_purchase_orders', 'on_hold', 'cancelled'),

  -- sales_orders: confirmed -> in_production -> completed, cancelled dari confirmed
  -- atau in_production. Catatan: sampai migrasi ini ditulis, TIDAK ADA kode aplikasi
  -- yang pernah mengubah status ini setelah dibuat (selalu 'confirmed') — graf ini
  -- disiapkan sesuai makna status yang sudah didokumentasikan, dipakai begitu fitur
  -- yang menuliskannya dibangun.
  ('sales_orders', 'confirmed', 'in_production'),
  ('sales_orders', 'confirmed', 'cancelled'),
  ('sales_orders', 'in_production', 'completed'),
  ('sales_orders', 'in_production', 'cancelled'),

  -- work_orders: planned -> in_progress -> completed, paused sebagai jeda sementara
  -- (bisa lanjut lagi ke in_progress), cancelled dari planned/in_progress/paused.
  -- Catatan: sama seperti sales_orders, saat ini belum ada kode aplikasi yang
  -- pernah mengubah kolom ini — baris in_progress yang ada di data sekarang berasal
  -- dari penyisipan manual saat verifikasi/testing, bukan lewat fitur nyata.
  ('work_orders', 'planned', 'in_progress'),
  ('work_orders', 'planned', 'cancelled'),
  ('work_orders', 'in_progress', 'paused'),
  ('work_orders', 'in_progress', 'completed'),
  ('work_orders', 'in_progress', 'cancelled'),
  ('work_orders', 'paused', 'in_progress'),
  ('work_orders', 'paused', 'cancelled'),

  -- production_batches: sama polanya dengan work_orders, tanpa 'paused' (skema
  -- production_batches tidak punya status ini).
  ('production_batches', 'planned', 'in_progress'),
  ('production_batches', 'planned', 'cancelled'),
  ('production_batches', 'in_progress', 'completed'),
  ('production_batches', 'in_progress', 'cancelled'),

  -- customer_po_approvals: pending -> approved ATAU pending -> rejected, keduanya
  -- TERMINAL (approve/reject adalah keputusan final 1 kali — sudah dicek di
  -- updateCustomerPoApproval.ts:60 `if (approval.status !== 'pending') return error`,
  -- sekarang ditegakkan juga di database).
  ('customer_po_approvals', 'pending', 'approved'),
  ('customer_po_approvals', 'pending', 'rejected')
on conflict (table_name, from_status, to_status) do nothing;

-- Fungsi trigger GENERIK (1 fungsi dipakai 5 tabel via 5 CREATE TRIGGER terpisah di
-- bawah — Postgres tidak punya cara memasang 1 trigger ke banyak tabel sekaligus,
-- tapi fungsi & tabel log-nya tetap satu, bukan diduplikasi per tabel).
--
-- SECURITY DEFINER supaya INSERT ke status_transition_log tetap jalan APAPUN role
-- yang melakukan UPDATE (service-role ATAU authenticated biasa) — RLS di
-- status_transition_log sengaja tidak punya policy insert untuk role biasa.
--
-- PENTING soal "menolak bahkan koneksi service-role": trigger Postgres MENOLAK
-- SEMUA sesi yang melakukan UPDATE lewat statement SQL biasa, tanpa peduli role-nya
-- (service_role di Supabase cuma punya hak bypass RLS, BUKAN pemilik tabel/superuser
-- — tidak bisa ALTER TABLE ... DISABLE TRIGGER). Ini yang membedakannya dari RLS policy
-- (yang memang cuma berlaku untuk role authenticated/anon, otomatis dilewati
-- service-role).
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

drop trigger if exists enforce_status_transition on customer_purchase_orders;
create trigger enforce_status_transition
  before update of status on customer_purchase_orders
  for each row
  execute function public.enforce_status_transition();

drop trigger if exists enforce_status_transition on sales_orders;
create trigger enforce_status_transition
  before update of status on sales_orders
  for each row
  execute function public.enforce_status_transition();

drop trigger if exists enforce_status_transition on work_orders;
create trigger enforce_status_transition
  before update of status on work_orders
  for each row
  execute function public.enforce_status_transition();

drop trigger if exists enforce_status_transition on production_batches;
create trigger enforce_status_transition
  before update of status on production_batches
  for each row
  execute function public.enforce_status_transition();

drop trigger if exists enforce_status_transition on customer_po_approvals;
create trigger enforce_status_transition
  before update of status on customer_po_approvals
  for each row
  execute function public.enforce_status_transition();
