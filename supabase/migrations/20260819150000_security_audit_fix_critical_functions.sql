-- Migration: Audit keamanan menyeluruh (dipicu temuan decide_production_standard_
-- proposal bisa dipanggil anon key) — pola yang sama ternyata ada di 44 dari 48
-- fungsi schema public. Migrasi ini menutup 12 yang KRITIS (tulis data nyata atau
-- baca data sensitif TANPA pemeriksaan internal apa pun).
--
-- SEBAB GANDA yang ditutup di sini (bukan cuma satu):
-- 1. `grant execute ... to service_role` TIDAK mencabut grant PUBLIC default
--    Postgres untuk fungsi baru.
-- 2. Supabase MEMBERI grant terpisah ke anon/authenticated lewat default
--    privileges platform-nya sendiri -- TIDAK ikut tercabut oleh
--    "revoke ... from public" saja (dibuktikan: debug_list_policies migration
--    20260812160000 SUDAH punya "revoke all ... from public" sejak awal, tapi
--    anon/authenticated TERNYATA masih EXECUTE -- diverifikasi lewat anon key
--    sungguhan yang berhasil membaca isi pg_policies).
-- Jadi REVOKE WAJIB eksplisit dari PUBLIC, anon, DAN authenticated -- ketiganya,
-- bukan salah satu saja.
--
-- 4 fungsi (create_shipment_with_signature, compute_production_batch_labor_cost,
-- resolve_department_alerts, upsert_department_alert) JUGA diperbaiki logika
-- internalnya (bukan cuma grant) -- lihat catatan per fungsi di bawah.

-- ============================================================
-- BAGIAN A — Grant-only fix: dipanggil HANYA lewat service-role dari app layer,
-- tidak perlu ubah logika internal (app layer sudah verifikasi role/company
-- SEBELUM memanggil RPC ini; gerbang grant sekarang jadi lapis TERAKHIR yang
-- benar, bukan tidak ada sama sekali seperti sebelumnya).
-- ============================================================

revoke execute on function public.record_manual_stock_adjustment(integer, numeric, text, text, integer) from public, anon, authenticated;
grant execute on function public.record_manual_stock_adjustment(integer, numeric, text, text, integer) to service_role;

revoke execute on function public.create_opening_balance_lot(integer, integer, integer, numeric, text, date, text, integer, numeric) from public, anon, authenticated;
grant execute on function public.create_opening_balance_lot(integer, integer, integer, numeric, text, date, text, integer, numeric) to service_role;

-- ============================================================
-- BAGIAN B — Grant-only fix: TIDAK PERNAH dipanggil dari app layer sama sekali
-- (dicek: grep kosong di src/ dan app/) -- HANYA dipanggil bersarang dari
-- fungsi trigger lain di migrasi yang sudah ada. Fungsi trigger berjalan sebagai
-- OWNER (postgres) karena SECURITY DEFINER, jadi panggilan bersarang itu TIDAK
-- terpengaruh sama sekali oleh revoke ini (owner selalu punya hak implisit) --
-- makanya TIDAK ADA grant baru ke service_role pun di sini, karena memang tidak
-- ada pemanggil legitimate dari luar. Diverifikasi ulang lewat test suite penuh
-- (alur yang memicu fungsi ini secara bersarang: konsumsi bahan WO, penerimaan
-- barang, deteksi kesiapan WO) TETAP jalan normal setelah revoke ini.
-- ============================================================

revoke execute on function public.recompute_stock_projection_for_item(integer) from public, anon, authenticated;
revoke execute on function public.recompute_work_order_machine_readiness(integer) from public, anon, authenticated;
revoke execute on function public.recompute_work_order_material_readiness(integer) from public, anon, authenticated;
revoke execute on function public.recompute_work_order_worker_readiness(integer) from public, anon, authenticated;

-- ============================================================
-- BAGIAN C — Grant fix + PERBAIKAN LOGIKA INTERNAL (defense in depth, bukan
-- cuma gerbang grant). Pola pemeriksaan: kalau ADA klaim jwt_company_id() (yang
-- berarti transaksi ini berasal dari sesi user sungguhan yang login), WAJIB
-- cocok dengan company_id data yang dirujuk. Kalau TIDAK ADA klaim (berarti
-- dipanggil lewat service-role key aplikasi -- jalur SAH satu-satunya sekarang
-- karena grant di bawah), pemeriksaan company dilewati -- BUKAN longgar sengaja,
-- tapi karena service-role key TIDAK PERNAH membawa klaim company_id sama sekali
-- (bukan token user), jadi memaksa jwt_company_id() cocok akan mematikan jalur
-- sah aplikasi sendiri. Gerbang GRANT (BAGIAN A pattern) tetap lapis utama;
-- pemeriksaan ini lapis KEDUA kalau grant suatu saat salah longgar lagi.
-- ============================================================

-- create_shipment_with_signature: SEBELUM ini percaya p_company_id APA ADANYA
-- tanpa verifikasi sama sekali. SEKARANG: company_id WAJIB cocok dengan company
-- pemilik p_sales_order_id yang sungguhan (bukan lagi trust-the-parameter).
create or replace function public.create_shipment_with_signature(
  p_company_id integer, p_sales_order_id integer, p_shipment_number text, p_delivery_address text,
  p_recipient_name text, p_recipient_phone text, p_vehicle_number text, p_driver_name text,
  p_lines jsonb, p_signed_by integer, p_signer_role text, p_signature_url_snapshot text, p_confirmation_text text
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
$function$;

revoke execute on function public.create_shipment_with_signature(integer, integer, text, text, text, text, text, text, jsonb, integer, text, text, text) from public, anon, authenticated;
grant execute on function public.create_shipment_with_signature(integer, integer, text, text, text, text, text, text, jsonb, integer, text, text, text) to service_role;

-- compute_production_batch_labor_cost: SEBELUM ini sudah derive company dari
-- batch (aman dari trust-the-parameter langsung), TAPI tidak pernah memeriksa
-- APAKAH pemanggil boleh melihat data upah sama sekali -- siapa pun bisa baca
-- total upah batch MANAPUN. SEKARANG: tambahkan pemeriksaan yang sama seperti
-- fungsi sejenisnya get_production_batch_labor_cost_total (company match kalau
-- ada klaim + jwt_can_view_wages()/jwt_can_view_financial_data()).
create or replace function public.compute_production_batch_labor_cost(p_production_batch_id integer)
returns numeric
language plpgsql
security definer
set search_path = public, pg_catalog
as $function$
declare
  v_company_id integer;
  v_weekday_hours numeric;
  v_saturday_hours numeric;
  v_hours_per_month numeric;
  v_total numeric;
begin
  select pb.company_id into v_company_id from production_batches pb where pb.production_batch_id = p_production_batch_id;
  if v_company_id is null then
    return 0;
  end if;

  if public.jwt_company_id() is not null then
    if public.jwt_company_id() <> v_company_id then
      raise exception 'Batch produksi tidak ditemukan di perusahaan Anda.';
    end if;
    if not (public.jwt_can_view_financial_data() or public.jwt_can_view_wages()) then
      raise exception 'Anda tidak punya akses ke biaya SDM.';
    end if;
  end if;

  select coalesce(nullif(cs.setting_value, '')::numeric, 7) into v_weekday_hours
  from company_settings cs where cs.company_id = v_company_id and cs.setting_key = 'work_calendar_weekday_hours';
  v_weekday_hours := coalesce(v_weekday_hours, 7);

  select coalesce(nullif(cs.setting_value, '')::numeric, 5) into v_saturday_hours
  from company_settings cs where cs.company_id = v_company_id and cs.setting_key = 'work_calendar_saturday_hours';
  v_saturday_hours := coalesce(v_saturday_hours, 5);

  select coalesce(nullif(cs.setting_value, '')::numeric, 173.3333) into v_hours_per_month
  from company_settings cs where cs.company_id = v_company_id and cs.setting_key = 'standard_hours_per_month';
  v_hours_per_month := coalesce(v_hours_per_month, 173.3333);

  select coalesce(sum(
    case e.wage_type
      when 'hourly' then coalesce(a.actual_hours, 0) * e.wage_rate
      when 'daily' then coalesce(a.actual_hours, 0) * (e.wage_rate / (case when extract(dow from a.work_date) = 6 then v_saturday_hours else v_weekday_hours end))
      when 'monthly' then coalesce(a.actual_hours, 0) * (e.wage_rate / v_hours_per_month)
      when 'piece_rate' then coalesce(a.qty_produced, 0) * e.wage_rate
      else 0
    end
  ), 0) into v_total
  from work_order_assignments a
  join employees e on e.employee_id = a.employee_id
  where a.production_batch_id = p_production_batch_id
    and a.status not in ('absent', 'replaced');

  return v_total;
end;
$function$;

revoke execute on function public.compute_production_batch_labor_cost(integer) from public, anon, authenticated;
grant execute on function public.compute_production_batch_labor_cost(integer) to service_role;

-- resolve_department_alerts: SEBELUM ini tidak punya parameter company_id SAMA
-- SEKALI -- WHERE-nya cuma alert_type+wo_id+item_id, jadi siapa pun yang tebak
-- wo_id/item_id company LAIN bisa "resolve" (sembunyikan) alert perusahaan itu.
-- SEKARANG: company diturunkan dari work_order/item yang direferensikan, dan
-- ikut jadi filter WHERE (bukan cuma dipakai untuk pemeriksaan izin).
create or replace function public.resolve_department_alerts(
  p_alert_type text, p_related_work_order_id integer, p_related_item_id integer
) returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $function$
declare
  v_company_id integer;
begin
  if p_related_work_order_id is not null then
    select company_id into v_company_id from work_orders where work_order_id = p_related_work_order_id;
  elsif p_related_item_id is not null then
    select company_id into v_company_id from items where item_id = p_related_item_id;
  end if;

  if v_company_id is null then
    return;
  end if;

  if public.jwt_company_id() is not null and public.jwt_company_id() <> v_company_id then
    raise exception 'Alert tidak ditemukan di perusahaan Anda.';
  end if;

  update system_alerts
  set status = 'resolved'
  where company_id = v_company_id
    and alert_type = p_alert_type
    and related_work_order_id is not distinct from p_related_work_order_id
    and related_item_id is not distinct from p_related_item_id
    and status = 'open';
end;
$function$;

revoke execute on function public.resolve_department_alerts(text, integer, integer) from public, anon, authenticated;
-- Tidak ada grant service_role: fungsi ini HANYA dipanggil bersarang dari
-- trigger lain (lihat BAGIAN B) -- konteks OWNER trigger tetap berjalan normal.

-- upsert_department_alert: p_company_id SUDAH ada sebagai parameter tapi
-- SEBELUM ini dipercaya mentah tanpa verifikasi apa pun. SEKARANG: kalau ada
-- p_related_work_order_id/p_related_item_id, company_id WAJIB cocok dengan
-- company asli data yang direferensikan itu (bukan lagi trust-the-parameter).
create or replace function public.upsert_department_alert(
  p_company_id integer, p_alert_type text, p_target_department text,
  p_related_work_order_id integer, p_related_item_id integer, p_message text, p_severity text
) returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $function$
declare
  v_existing_id integer;
  v_actual_company_id integer;
begin
  if p_related_work_order_id is not null then
    select company_id into v_actual_company_id from work_orders where work_order_id = p_related_work_order_id;
    if v_actual_company_id is not null and v_actual_company_id <> p_company_id then
      raise exception 'company_id tidak cocok dengan work order yang dirujuk.';
    end if;
  end if;
  if p_related_item_id is not null then
    select company_id into v_actual_company_id from items where item_id = p_related_item_id;
    if v_actual_company_id is not null and v_actual_company_id <> p_company_id then
      raise exception 'company_id tidak cocok dengan item yang dirujuk.';
    end if;
  end if;

  if public.jwt_company_id() is not null and public.jwt_company_id() <> p_company_id then
    raise exception 'Alert tidak ditemukan di perusahaan Anda.';
  end if;

  select system_alert_id into v_existing_id
  from system_alerts
  where company_id = p_company_id
    and alert_type = p_alert_type
    and target_department = p_target_department
    and related_work_order_id is not distinct from p_related_work_order_id
    and related_item_id is not distinct from p_related_item_id
    and status = 'open'
  limit 1;

  if v_existing_id is null then
    insert into system_alerts (company_id, alert_type, target_department, related_work_order_id, related_item_id, message, severity)
    values (p_company_id, p_alert_type, p_target_department, p_related_work_order_id, p_related_item_id, p_message, p_severity);
  else
    update system_alerts
    set message = p_message, severity = p_severity
    where system_alert_id = v_existing_id;
  end if;
end;
$function$;

revoke execute on function public.upsert_department_alert(integer, text, text, integer, integer, text, text) from public, anon, authenticated;
-- Tidak ada grant service_role: sama seperti resolve_department_alerts, hanya
-- dipanggil bersarang dari trigger lain.

-- ============================================================
-- BAGIAN D — Fungsi debug/diagnostik
-- ============================================================

-- debug_list_policies: MASIH DIPAKAI 2 test permanen (tests/role_hierarchy_
-- financial_access.test.ts, tests/employee_attendance_access.test.ts) lewat
-- service-role client -- TIDAK dihapus, tapi eksekusinya dipastikan ulang HANYA
-- untuk service_role (migration 20260812160000 sudah revoke-from-public, tapi
-- TERBUKTI anon/authenticated tetap bisa -- lihat catatan sebab-ganda di atas).
revoke execute on function public.debug_list_policies(text) from public, anon, authenticated;
grant execute on function public.debug_list_policies(text) to service_role;

-- debug_schema_snapshot: dicek TIDAK dipakai satu pun test/skrip permanen --
-- fungsi ini dump SELURUH skema (kolom, constraint, RLS policy, DEFINISI setiap
-- fungsi termasuk yang sensitif) sekaligus, jauh lebih besar permukaan
-- kebocorannya daripada debug_list_policies. Tujuannya sudah selesai (verifikasi
-- rebuild-migrasi Sesi 2A, sekali pakai) -- DIHAPUS TOTAL daripada disimpan
-- "siapa tahu perlu lagi". Audit sejenis di masa depan cukup buat fungsi
-- diagnostik baru yang scope-nya sempit (seperti debug_list_function_grants di
-- migration 20260819140000), bukan menyimpan alat dump-semua secara permanen.
drop function if exists public.debug_schema_snapshot();

-- ============================================================
-- BAGIAN E — perkuat debug_list_function_grants (migration 20260819140000)
-- supaya test regresi bisa membedakan fungsi trigger/event_trigger (yang
-- TERBUKTI tidak bisa dipanggil lewat RPC sama sekali, lihat catatan HANDOFF)
-- dari fungsi biasa, tanpa perlu daftar nama trigger di-hardcode di test.
-- ============================================================
drop function if exists public.debug_list_function_grants();
create function public.debug_list_function_grants()
returns table (
  function_signature text,
  function_name text,
  is_security_definer boolean,
  return_type text,
  grants text[]
)
language sql
security definer
set search_path = public, pg_catalog
as $$
  select
    p.oid::regprocedure::text as function_signature,
    p.proname::text as function_name,
    p.prosecdef as is_security_definer,
    p.prorettype::regtype::text as return_type,
    coalesce(
      (
        select array_agg(
          format('%s=%s', case when a.grantee = 0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end, a.privilege_type)
          order by (case when a.grantee = 0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end)
        )
        from aclexplode(p.proacl) a
      ),
      array['PUBLIC=EXECUTE (default Postgres -- tidak ada ACL eksplisit sama sekali)']
    ) as grants
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace
  order by p.proname;
$$;

revoke all on function public.debug_list_function_grants() from public;
grant execute on function public.debug_list_function_grants() to service_role;
