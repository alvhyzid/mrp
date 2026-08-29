-- PJL-03 -- fungsi kelayakan, konfirmasi pemenuhan, dan penutupan Sales Order.
--
-- SATU DEFINISI KELAYAKAN, DIPAKAI TIGA PIHAK: layar, konfirmasi PPIC, dan penutupan.
-- Alasannya bukan kerapian. Bila layar memakai rumus TypeScript dan server memakai rumus SQL,
-- keduanya akan menyimpang pada suatu hari, dan yang terlihat di layar bukan yang ditegakkan
-- server -- kelas "dua jalur hidup" yang sudah berulang di proyek ini.

-- =============================================================================================
-- 1. KELAYAKAN -- MURNI MEMBACA
-- =============================================================================================
create or replace function public.kelayakan_penyelesaian_so(p_sales_order_id integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_so sales_orders%rowtype;
  v_baris integer;
  v_kurang integer;
  v_qty_dipesan numeric;
  v_qty_terkirim numeric;
  v_wo_total integer;
  v_wo_selesai integer;
  v_pembatalan integer;
  v_sebab text[] := array[]::text[];
  v_layak boolean;
begin
  select * into v_so from sales_orders where sales_order_id = p_sales_order_id;
  if v_so.sales_order_id is null or v_so.company_id is distinct from public.jwt_company_id() then
    raise exception 'Sales Order tidak ditemukan di perusahaan Anda.';
  end if;

  select count(*),
         count(*) filter (where coalesce(qty_shipped, 0) < qty_ordered),
         coalesce(sum(qty_ordered), 0),
         coalesce(sum(coalesce(qty_shipped, 0)), 0)
    into v_baris, v_kurang, v_qty_dipesan, v_qty_terkirim
  from sales_order_lines where sales_order_id = p_sales_order_id;

  -- Work Order BATAL sengaja tidak dihitung -- ia bukan bukti produksi berjalan maupun selesai.
  -- Aturan yang sama dipakai turunkanEksekusiSo() di sisi aplikasi.
  select count(*), count(*) filter (where wo.status = 'completed')
    into v_wo_total, v_wo_selesai
  from work_orders wo
  join sales_order_lines sol on sol.sales_order_line_id = wo.sales_order_line_id
  where sol.sales_order_id = p_sales_order_id and wo.status <> 'cancelled';

  select count(*) into v_pembatalan
  from cancellation_requests
  where entity = 'sales_orders' and record_id = p_sales_order_id and status = 'pending';

  if v_so.status = 'completed' then
    v_sebab := array_append(v_sebab, 'Sales Order ini sudah selesai.');
  elsif v_so.status = 'cancelled' then
    v_sebab := array_append(v_sebab, 'Sales Order ini sudah dibatalkan.');
  end if;

  if v_baris = 0 then
    v_sebab := array_append(v_sebab, 'Sales Order ini belum punya baris pesanan.');
  end if;

  -- NOL TOLERANSI KURANG-KIRIM (BD-09). Angkanya disebut supaya orang tahu berapa yang kurang,
  -- bukan sekadar "belum bisa".
  if v_kurang > 0 then
    v_sebab := array_append(v_sebab, format('Masih ada %s dari %s yang belum dikirim.',
                                 trim(to_char(v_qty_dipesan - v_qty_terkirim, 'FM999999990.####')),
                                 trim(to_char(v_qty_dipesan, 'FM999999990.####'))));
  end if;

  -- GAGAL TERTUTUP saat tidak ada Work Order sama sekali: tanpa Work Order tidak ada BUKTI
  -- produksi untuk diperiksa, dan aturan bisnis mensyaratkan seluruh komitmen sudah diproduksi.
  -- Keadaan ini dicatat sebagai pertanyaan terbuka (PJL-16), bukan diputuskan diam-diam.
  if v_wo_total = 0 then
    v_sebab := array_append(v_sebab, 'Belum ada Work Order sebagai bukti produksi.');
  elsif v_wo_selesai < v_wo_total then
    v_sebab := array_append(v_sebab, format('Produksi belum selesai: %s dari %s Work Order.', v_wo_selesai, v_wo_total));
  end if;

  if v_pembatalan > 0 then
    v_sebab := array_append(v_sebab, 'Masih ada permintaan pembatalan yang menunggu keputusan.');
  end if;

  -- array_append, BUKAN `v_sebab || 'teks'`: operator || dengan literal tak bertipe membuat
  -- Postgres menafsirkan teksnya sebagai LITERAL ARRAY dan gagal "malformed array literal".
  -- Ditemukan saat menjalankan, bukan saat membaca -- typecheck dan tinjauan kode keduanya lolos.
  v_layak := array_length(v_sebab, 1) is null;

  return jsonb_build_object(
    'layak', v_layak,
    'sebab_belum_layak', to_jsonb(v_sebab),
    'status', v_so.status,
    'baris', v_baris,
    'qty_dipesan', v_qty_dipesan,
    'qty_terkirim', v_qty_terkirim,
    'work_order_total', v_wo_total,
    'work_order_selesai', v_wo_selesai,
    'pembatalan_menunggu', v_pembatalan,
    -- CUPLIKAN PENJAGA DATA BASI: hanya FAKTA yang menentukan kelayakan, tanpa
    -- keterangan yang bisa berubah kata-katanya. Dibandingkan apa adanya saat penutupan.
    'cuplikan', jsonb_build_object(
      'qty_dipesan', v_qty_dipesan,
      'qty_terkirim', v_qty_terkirim,
      'baris_kurang', v_kurang,
      'work_order_total', v_wo_total,
      'work_order_selesai', v_wo_selesai
    )
  );
end;
$$;

comment on function public.kelayakan_penyelesaian_so(integer) is
  'Kelayakan penutupan Sales Order: satu-satunya definisi, dipakai layar maupun kedua fungsi penutupan. MEMBACA saja. Nol syarat pembayaran -- penyelesaian berbasis pemenuhan (aturan bisnis 29 Agu 2026).';

-- Untuk layar: satu panggilan untuk seluruh Sales Order milik perusahaan pemanggil,
-- supaya halaman daftar tidak memanggil N kali.
create or replace function public.kelayakan_penyelesaian_so_semua()
returns table (sales_order_id integer, kelayakan jsonb)
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
begin
  perform public.wajib_identitas_tenant();
  return query
    select so.sales_order_id, public.kelayakan_penyelesaian_so(so.sales_order_id)
    from sales_orders so
    where so.company_id = public.jwt_company_id();
end;
$$;

-- =============================================================================================
-- 2. KONFIRMASI PEMENUHAN -- DEPARTEMEN PPIC
-- =============================================================================================
create or replace function public.konfirmasi_pemenuhan_sales_order(
  p_sales_order_id integer,
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
  v_kelayakan jsonb;
  v_id integer;
  v_company_id integer;
begin
  perform public.wajib_identitas_tenant();

  select * into v_user from users where auth_uid = auth.uid()::text;
  if v_user.user_id is null then
    raise exception 'Pengguna tidak dikenali.';
  end if;

  -- Wewenang: departemen PPIC. Memakai pemetaan yang SUDAH ADA (jwt_decision_department),
  -- bukan peran baru -- ppic_manager, sama seperti yang menyetujui departemen ppic di PO klien.
  -- coalesce tidak diperlukan di sini karena pembandingnya '=' pada nilai yang bisa NULL:
  -- NULL = 'ppic' bernilai NULL, dan `if not NULL` tidak dieksekusi -- karena itu ditulis
  -- sebagai `is distinct from`.
  if public.jwt_decision_department() is distinct from 'ppic' then
    raise exception 'Hanya PPIC yang boleh mengonfirmasi pemenuhan Sales Order.';
  end if;

  -- Mengunci baris SO: dua konfirmasi/penutupan bersamaan jadi BERURUTAN, dan yang kedua
  -- melihat keadaan yang sudah berubah alih-alih keadaan basi.
  select company_id into v_company_id from sales_orders where sales_order_id = p_sales_order_id for update;
  if v_company_id is null or v_company_id is distinct from public.jwt_company_id() then
    raise exception 'Sales Order tidak ditemukan di perusahaan Anda.';
  end if;

  v_kelayakan := public.kelayakan_penyelesaian_so(p_sales_order_id);
  if not (v_kelayakan->>'layak')::boolean then
    raise exception 'Belum bisa dikonfirmasi. %', array_to_string(
      array(select jsonb_array_elements_text(v_kelayakan->'sebab_belum_layak')), ' ');
  end if;

  perform public.pasang_konteks_keputusan('sales_orders', 'fulfillment_confirm', p_reason_category, p_reason_note);

  insert into sales_order_completion_approvals (
    company_id, sales_order_id, department, approved_by,
    approver_name_snapshot, approver_role_snapshot,
    reason_category, notes, fulfillment_snapshot
  ) values (
    v_company_id, p_sales_order_id, 'ppic', v_user.user_id,
    v_user.name, v_user.role,
    p_reason_category, nullif(btrim(p_reason_note), ''), v_kelayakan->'cuplikan'
  )
  on conflict (sales_order_id, department) do update set
    approved_by = excluded.approved_by,
    approver_name_snapshot = excluded.approver_name_snapshot,
    approver_role_snapshot = excluded.approver_role_snapshot,
    approved_at = now(),
    reason_category = excluded.reason_category,
    notes = excluded.notes,
    fulfillment_snapshot = excluded.fulfillment_snapshot
  returning sales_order_completion_approval_id into v_id;

  return v_id;
end;
$$;

-- =============================================================================================
-- 3. PENUTUPAN -- MANAGER / GENERAL MANAGER
-- =============================================================================================
create or replace function public.selesaikan_sales_order(
  p_sales_order_id integer,
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
  v_company_id integer;
  v_status text;
  v_kelayakan jsonb;
  v_ppic sales_order_completion_approvals%rowtype;
begin
  perform public.wajib_identitas_tenant();

  select * into v_user from users where auth_uid = auth.uid()::text;
  if v_user.user_id is null then
    raise exception 'Pengguna tidak dikenali.';
  end if;

  -- coalesce WAJIB: `not NULL` bernilai NULL dan cabangnya tidak akan dieksekusi -- gerbang
  -- yang DILEWATI, bukan menolak. Kelas cacat SEC-23.
  if not coalesce(public.jwt_is_company_leadership(), false) then
    raise exception 'Hanya Manager atau General Manager yang boleh menutup Sales Order.';
  end if;

  select company_id, status into v_company_id, v_status
  from sales_orders where sales_order_id = p_sales_order_id for update;
  if v_company_id is null or v_company_id is distinct from public.jwt_company_id() then
    raise exception 'Sales Order tidak ditemukan di perusahaan Anda.';
  end if;

  select * into v_ppic from sales_order_completion_approvals
  where sales_order_id = p_sales_order_id and department = 'ppic';
  if v_ppic.sales_order_completion_approval_id is null then
    raise exception 'PPIC belum mengonfirmasi pemenuhan Sales Order ini.';
  end if;

  -- PEMISAHAN TUGAS. Satu pengguna hanya punya satu peran, sehingga orang yang mengonfirmasi
  -- pemenuhan tidak mungkin orang yang menutup -- tetapi itu sifat data hari ini, bukan aturan.
  -- Ditulis eksplisit supaya tetap berlaku bila kelak seseorang bisa memegang dua peran.
  if v_ppic.approved_by = v_user.user_id then
    raise exception 'Orang yang mengonfirmasi pemenuhan tidak boleh menutup Sales Order yang sama.';
  end if;

  v_kelayakan := public.kelayakan_penyelesaian_so(p_sales_order_id);
  if not (v_kelayakan->>'layak')::boolean then
    raise exception 'Belum bisa diselesaikan. %', array_to_string(
      array(select jsonb_array_elements_text(v_kelayakan->'sebab_belum_layak')), ' ');
  end if;

  -- PENJAGA DATA BASI. Keadaan bisa berubah antara konfirmasi PPIC dan penutupan:
  -- pengiriman dibatalkan, Work Order dibuka kembali, baris pesanan berubah. Menutup di atas
  -- konfirmasi yang sudah tidak mencerminkan kenyataan berarti keputusan diambil atas data
  -- yang salah -- dan tidak ada satu pun gejala yang akan muncul kemudian.
  if v_kelayakan->'cuplikan' is distinct from v_ppic.fulfillment_snapshot then
    raise exception 'Keadaan pemenuhan berubah sejak PPIC mengonfirmasi. Konfirmasi PPIC perlu diulang sebelum Sales Order ditutup.';
  end if;

  perform public.pasang_konteks_keputusan('sales_orders', 'completion', p_reason_category, p_reason_note);

  insert into sales_order_completion_approvals (
    company_id, sales_order_id, department, approved_by,
    approver_name_snapshot, approver_role_snapshot,
    reason_category, notes, fulfillment_snapshot
  ) values (
    v_company_id, p_sales_order_id, 'manager', v_user.user_id,
    v_user.name, v_user.role,
    p_reason_category, nullif(btrim(p_reason_note), ''), v_kelayakan->'cuplikan'
  )
  on conflict (sales_order_id, department) do update set
    approved_by = excluded.approved_by,
    approver_name_snapshot = excluded.approver_name_snapshot,
    approver_role_snapshot = excluded.approver_role_snapshot,
    approved_at = now(),
    reason_category = excluded.reason_category,
    notes = excluded.notes,
    fulfillment_snapshot = excluded.fulfillment_snapshot;

  -- SATU kolom yang berubah. Nol DELETE, nol perubahan pada Work Order, produksi, pemakaian
  -- bahan, persediaan, lot, maupun pengiriman -- riwayat eksekusi tidak pernah ditulis ulang.
  update sales_orders set status = 'completed' where sales_order_id = p_sales_order_id;
end;
$$;

revoke execute on function public.kelayakan_penyelesaian_so(integer) from public, anon;
revoke execute on function public.kelayakan_penyelesaian_so_semua() from public, anon;
revoke execute on function public.konfirmasi_pemenuhan_sales_order(integer, text, text) from public, anon;
revoke execute on function public.selesaikan_sales_order(integer, text, text) from public, anon;
grant execute on function public.kelayakan_penyelesaian_so(integer) to authenticated;
grant execute on function public.kelayakan_penyelesaian_so_semua() to authenticated;
grant execute on function public.konfirmasi_pemenuhan_sales_order(integer, text, text) to authenticated;
grant execute on function public.selesaikan_sales_order(integer, text, text) to authenticated;
