-- WS-SALES-CANCEL — fungsi permintaan & keputusan pembatalan.
--
-- PRINSIP YANG DITEGAKKAN DI SINI, dan tiap satu punya barisnya sendiri di bawah:
--   PERMINTAAN != PEMBATALAN     -> mengajukan tidak mengubah status dokumen
--   PEMOHON != PEMUTUS           -> pemohon tidak boleh memutuskan permintaannya sendiri
--   GAGAL TERTUTUP               -> tanpa identitas/perusahaan/peran -> TOLAK
--   RIWAYAT EKSEKUSI TIDAK PERNAH DIHAPUS -> hanya satu kolom status yang berubah

create or replace function public.ajukan_pembatalan(
  p_entity text,
  p_record_id integer,
  p_reason_category text,
  p_reason_note text default null
)
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_user users%rowtype;
  v_company_id integer;
  v_status text;
  v_departemen text;
  v_snapshot jsonb;
  v_id integer;
begin
  perform public.wajib_identitas_tenant();

  select * into v_user from users where auth_uid = auth.uid()::text;
  if v_user.user_id is null then
    raise exception 'Pengguna tidak dikenali.';
  end if;

  v_departemen := public.jwt_decision_department();
  if v_departemen is null then
    raise exception 'Peran Anda tidak mewakili departemen yang boleh mengajukan pembatalan.';
  end if;

  if p_entity = 'sales_orders' then
    select company_id, status into v_company_id, v_status from sales_orders where sales_order_id = p_record_id;
    -- Keadaan eksekusi SAAT diajukan -- bahan tinjauan dampak bagi pemutus.
    select jsonb_build_object(
      'work_order', coalesce((select count(*) from work_orders wo
         join sales_order_lines sol on sol.sales_order_line_id = wo.sales_order_line_id
         where sol.sales_order_id = p_record_id), 0),
      'qty_dipesan', coalesce((select sum(qty_ordered) from sales_order_lines where sales_order_id = p_record_id), 0),
      'qty_terkirim', coalesce((select sum(qty_shipped) from sales_order_lines where sales_order_id = p_record_id), 0),
      'pengiriman', coalesce((select count(*) from shipments where sales_order_id = p_record_id), 0)
    ) into v_snapshot;
  elsif p_entity = 'customer_purchase_orders' then
    select company_id, status into v_company_id, v_status from customer_purchase_orders where customer_purchase_order_id = p_record_id;
    v_snapshot := jsonb_build_object('status_po', v_status);
  else
    raise exception 'Entitas % tidak didukung.', p_entity;
  end if;

  if v_company_id is null or v_company_id is distinct from public.jwt_company_id() then
    raise exception 'Dokumen tidak ditemukan di perusahaan Anda.';
  end if;

  if v_status = 'cancelled' then
    raise exception 'Dokumen ini sudah dibatalkan.';
  end if;

  if exists (select 1 from cancellation_requests where entity = p_entity and record_id = p_record_id and status = 'pending') then
    raise exception 'Sudah ada permintaan pembatalan yang menunggu keputusan untuk dokumen ini.';
  end if;

  perform public.pasang_konteks_keputusan(p_entity, 'cancel_request', p_reason_category, p_reason_note);

  insert into cancellation_requests (
    company_id, entity, record_id, status,
    requested_by, requester_name_snapshot, requester_role_snapshot, requester_department_snapshot,
    reason_category, reason_note, execution_snapshot
  ) values (
    v_company_id, p_entity, p_record_id, 'pending',
    v_user.user_id, v_user.name, v_user.role, v_departemen,
    p_reason_category, nullif(btrim(p_reason_note), ''), v_snapshot
  )
  returning cancellation_request_id into v_id;

  -- CATATAN PENTING: status dokumen SENGAJA TIDAK DIUBAH di sini.
  -- Permintaan bukan pembatalan.
  return v_id;
end;
$$;

create or replace function public.putuskan_pembatalan(
  p_cancellation_request_id integer,
  p_keputusan text,
  p_reason_category text,
  p_reason_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_user users%rowtype;
  v_req cancellation_requests%rowtype;
begin
  perform public.wajib_identitas_tenant();

  select * into v_user from users where auth_uid = auth.uid()::text;
  if v_user.user_id is null then
    raise exception 'Pengguna tidak dikenali.';
  end if;

  -- Wewenang AKHIR ada di Manager/General Manager (BD-02, BD-06).
  -- coalesce WAJIB: `not NULL` bernilai NULL dan cabangnya tidak akan dieksekusi.
  if not coalesce(public.jwt_is_company_leadership(), false) then
    raise exception 'Hanya Manager atau General Manager yang boleh memutuskan permintaan pembatalan.';
  end if;

  select * into v_req from cancellation_requests where cancellation_request_id = p_cancellation_request_id;
  if v_req.cancellation_request_id is null or v_req.company_id is distinct from public.jwt_company_id() then
    raise exception 'Permintaan pembatalan tidak ditemukan di perusahaan Anda.';
  end if;

  if v_req.status <> 'pending' then
    raise exception 'Permintaan ini sudah diputuskan (status: %).', v_req.status;
  end if;

  -- PEMISAHAN TUGAS: pemohon tidak boleh memutuskan permintaannya sendiri.
  -- Ini berlaku BAHKAN bila pemohonnya seorang pimpinan -- justru di situlah aturan
  -- ini paling dibutuhkan, karena pimpinan punya wewenang memutus.
  if v_req.requested_by = v_user.user_id then
    raise exception 'Pemohon tidak boleh memutuskan permintaan pembatalannya sendiri.';
  end if;

  if p_keputusan not in ('approved', 'rejected') then
    raise exception 'Keputusan harus approved atau rejected.';
  end if;

  perform public.pasang_konteks_keputusan(v_req.entity, 'cancel_decision', p_reason_category, p_reason_note);

  update cancellation_requests
  set status = p_keputusan,
      decided_by = v_user.user_id,
      decider_name_snapshot = v_user.name,
      decider_role_snapshot = v_user.role,
      decided_at = now(),
      decision_reason_category = p_reason_category,
      decision_note = nullif(btrim(p_reason_note), '')
  where cancellation_request_id = p_cancellation_request_id;

  if p_keputusan = 'approved' then
    -- Pembatalan terkendali: HANYA satu kolom status yang berubah.
    -- Nol DELETE. Work Order, riwayat produksi, pemakaian bahan, riwayat persediaan,
    -- dan pengiriman -- termasuk yang sudah terkirim -- tidak disentuh sama sekali.
    if v_req.entity = 'sales_orders' then
      update sales_orders set status = 'cancelled' where sales_order_id = v_req.record_id;
    else
      update customer_purchase_orders set status = 'cancelled' where customer_purchase_order_id = v_req.record_id;
    end if;
  end if;
end;
$$;

revoke execute on function public.ajukan_pembatalan(text, integer, text, text) from public, anon;
revoke execute on function public.putuskan_pembatalan(integer, text, text, text) from public, anon;
grant execute on function public.ajukan_pembatalan(text, integer, text, text) to authenticated;
grant execute on function public.putuskan_pembatalan(integer, text, text, text) to authenticated;
