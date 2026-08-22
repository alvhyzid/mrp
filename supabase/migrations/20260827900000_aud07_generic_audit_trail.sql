-- AUD-07 (23 Agu 2026) -- lapisan jejak tulis TERPUSAT, satu tabel + satu
-- fungsi trigger generik, dipasang di tabel-tabel yang sudah tercatat sebagai
-- gap (employees, suppliers, customers, customer_purchase_orders,
-- purchase_orders, sales_orders, shipments, attendance_events,
-- attendance_corrections) -- BUKAN enam tambalan terpisah.
--
-- ARKEOLOGI (4.1, dicatat supaya tidak dibangun ulang): mekanisme jejak yang
-- SUDAH ADA sebelum migrasi ini SEMUANYA per-fitur, bukan generik --
-- status_transition_log (transisi status tertentu saja), kamus_term_history,
-- build_task_urgency_history/build_task_approval_history, kpi snapshot
-- history, work_order_reopen_log. Tabel-tabel di lingkup AUD-07 (employees,
-- suppliers, dst) TIDAK PUNYA mekanisme jejak apa pun sebelum ini -- dikonfirmasi
-- lewat pencarian trigger di atasnya (kosong).
--
-- DITEGAKKAN DI DATABASE (trigger AFTER INSERT/UPDATE/DELETE), BUKAN di
-- lapisan aplikasi -- baris berubah lewat jalur MANA PUN (aplikasi lewat
-- service role, skrip Node, `supabase db query` langsung, dashboard SQL
-- editor) SAMA-SAMA tertangkap, karena trigger berjalan di level Postgres,
-- bukan di kode TypeScript.
--
-- KETERBATASAN JUJUR (dicatat, bukan disembunyikan): "siapa" yang tertangkap
-- PERSIS tergantung JALUR tulisnya --
--   - Tulisan lewat sesi ber-JWT (mis. langsung dari klien dengan anon key +
--     token) -> auth.uid() terisi, identitas PASTI.
--   - Tulisan lewat SERVICE ROLE (mayoritas jalur aplikasi hari ini -- server
--     Next.js selalu pakai service role, bukan meneruskan JWT pengguna ke
--     Postgres) -> auth.uid() KOSONG, hanya `changed_by_role` = 'service_role'
--     yang tercatat, BUKAN user_id manusia yang sebenarnya memicu aksi itu di
--     aplikasi. Menutup celah ini sepenuhnya butuh SETIAP fungsi server
--     (createXxx/updateXxx) menyertakan user_id pemanggil lewat parameter
--     eksplisit atau `set_config` per-request -- perubahan lebih besar,
--     dicatat sebagai lanjutan (lihat catatan di build_tasks), TIDAK
--     dikerjakan dalam migrasi ini.
create table if not exists data_change_audit_log (
  data_change_audit_log_id bigserial primary key,
  company_id integer,
  table_name text not null,
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  row_pk text,
  changed_by_auth_uid text,
  changed_by_role text,
  old_data jsonb,
  new_data jsonb,
  changed_at timestamptz not null default now()
);

create index if not exists data_change_audit_log_table_row_idx on data_change_audit_log (table_name, row_pk, changed_at desc);
create index if not exists data_change_audit_log_company_idx on data_change_audit_log (company_id, changed_at desc);

alter table data_change_audit_log enable row level security;

-- APPEND-ONLY (4.3): tidak ada policy update/delete untuk siapa pun selain
-- service_role (yang memang tidak tunduk RLS) -- bahkan company_admin tidak
-- bisa mengubah/menghapus baris jejak lewat API.
drop policy if exists data_change_audit_log_select on data_change_audit_log;
create policy data_change_audit_log_select on data_change_audit_log
  for select using (company_id = public.jwt_company_id() and public.jwt_is_company_leadership());

revoke all on data_change_audit_log from public, anon, authenticated;
grant select on data_change_audit_log to authenticated;
grant all on data_change_audit_log to service_role;

-- Fungsi trigger generik -- satu fungsi, dipakai ulang di semua tabel lingkup.
-- company_id diambil dari NEW/OLD bila kolom itu ada di tabel target; kalau
-- tidak ada (mis. tabel anak seperti attendance_corrections yang company_id-nya
-- tersirat lewat FK), NULL -- tetap tercatat, hanya tidak bisa disaring per
-- company lewat kolom ini (masih bisa lewat join manual saat dibutuhkan).
create or replace function public.log_data_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_row jsonb;
  v_company_id integer;
  v_pk_col text;
  v_pk_val text;
begin
  v_row := to_jsonb(coalesce(new, old));

  begin
    v_company_id := (v_row ->> 'company_id')::integer;
  exception when others then
    v_company_id := null;
  end;

  -- Kolom PK tunggal per tabel, mengikuti konvensi proyek nama_tabel_tunggal_id
  -- (lihat CLAUDE.md) -- dipetakan eksplisit per tabel lingkup, bukan ditebak
  -- otomatis (nama PK tidak selalu = nama_tabel + "_id" persis, mis. tabel
  -- jamak "employees" -> "employee_id").
  v_pk_col := case TG_TABLE_NAME
    when 'employees' then 'employee_id'
    when 'suppliers' then 'supplier_id'
    when 'customers' then 'customer_id'
    when 'customer_purchase_orders' then 'customer_purchase_order_id'
    when 'purchase_orders' then 'purchase_order_id'
    when 'sales_orders' then 'sales_order_id'
    when 'shipments' then 'shipment_id'
    when 'attendance_events' then 'attendance_event_id'
    when 'attendance_corrections' then 'attendance_correction_id'
    else null
  end;
  if v_pk_col is not null then
    v_pk_val := v_row ->> v_pk_col;
  end if;

  insert into data_change_audit_log (company_id, table_name, operation, row_pk, changed_by_auth_uid, changed_by_role, old_data, new_data)
  values (
    v_company_id,
    TG_TABLE_NAME,
    TG_OP,
    v_pk_val,
    (select auth.uid())::text,
    session_user,
    case when TG_OP in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when TG_OP in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );

  return coalesce(new, old);
end;
$$;

revoke all on function public.log_data_change() from public, anon, authenticated;

-- Pasang trigger di seluruh tabel lingkup AUD-07 (4.2): employees (perubahan
-- gaji/BPJS/PTKP), suppliers/purchase_orders/customers/customer_purchase_orders/
-- sales_orders (master mitra & transaksi inti), shipments (pengiriman),
-- attendance_events/attendance_corrections (absensi, termasuk temuan salah-label
-- tutup-otomatis).
do $$
declare
  t text;
begin
  foreach t in array array[
    'employees', 'suppliers', 'customers', 'customer_purchase_orders',
    'purchase_orders', 'sales_orders', 'shipments',
    'attendance_events', 'attendance_corrections'
  ]
  loop
    execute format('drop trigger if exists audit_log_trigger on %I', t);
    execute format(
      'create trigger audit_log_trigger after insert or update or delete on %I for each row execute function public.log_data_change()',
      t
    );
  end loop;
end $$;
