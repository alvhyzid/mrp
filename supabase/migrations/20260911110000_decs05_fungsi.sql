-- DEC-S05 — fungsi penerapan Payment Terms ke Sales Order.
--
-- SATU fungsi, satu tanggung jawab: mengubah aturan pembayaran menjadi komitmen yang
-- BEKU pada satu Sales Order. Ia TIDAK mencatat pembayaran dan TIDAK menghitung piutang.

create or replace function public.terapkan_payment_terms(
  p_sales_order_id integer,
  p_payment_term_id integer
)
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_so sales_orders%rowtype;
  v_term payment_terms%rowtype;
  v_total numeric(14,4);
  v_step payment_term_steps%rowtype;
  v_jumlah_step integer;
  v_urut integer := 0;
  v_terpakai numeric(14,4) := 0;
  v_amount numeric(14,4);
  v_dibuat integer := 0;
begin
  perform public.wajib_identitas_tenant();

  -- Wewenang: yang boleh menetapkan komitmen komersial adalah yang mengelola PO klien
  -- (Sales dan pimpinan). MENYALIN CUSTOMER_PO_MANAGE_ROLES di src/lib/roles.ts --
  -- nol daftar peran baru dikarang.
  if not coalesce(
       public.jwt_is_company_leadership()
       or public.jwt_app_role() = any (array['ppic_manager', 'ppic_staff', 'admin_staff', 'sales']),
       false) then
    raise exception 'Peran Anda tidak boleh menetapkan termin pembayaran.';
  end if;

  select * into v_so from sales_orders where sales_order_id = p_sales_order_id;
  if v_so.sales_order_id is null or v_so.company_id is distinct from public.jwt_company_id() then
    raise exception 'Sales Order tidak ditemukan di perusahaan Anda.';
  end if;

  select * into v_term from payment_terms where payment_term_id = p_payment_term_id;
  if v_term.payment_term_id is null or v_term.company_id is distinct from public.jwt_company_id() then
    raise exception 'Termin pembayaran tidak ditemukan di perusahaan Anda.';
  end if;

  -- §29: termin yang sudah dinonaktifkan tidak boleh dipakai transaksi BARU.
  -- Transaksi LAMA yang sudah memakainya tetap sah -- itu sebabnya pemeriksaan ini
  -- ada di sini, bukan di pembacaan.
  if not v_term.active then
    raise exception 'Termin pembayaran "%" sudah tidak aktif dan tidak bisa dipakai untuk transaksi baru.', v_term.name;
  end if;

  if exists (select 1 from sales_order_payment_obligations where sales_order_id = p_sales_order_id) then
    raise exception 'Sales Order ini sudah punya jadwal pembayaran. Perubahan termin mengikuti alur amandemen komersial.';
  end if;

  -- Dasar perhitungan: total baris Sales Order. Itu SATU-SATUNYA nilai yang ada --
  -- skema ini nol kolom pajak dan nol kolom diskon (disensus 29 Agu 2026).
  select coalesce(sum(qty_ordered * unit_price), 0) into v_total from sales_order_lines where sales_order_id = p_sales_order_id;
  if v_total <= 0 then
    raise exception 'Sales Order ini belum punya nilai yang bisa dijadwalkan pembayarannya.';
  end if;

  select count(*) into v_jumlah_step from payment_term_steps where payment_term_id = p_payment_term_id;
  if v_jumlah_step = 0 then
    raise exception 'Termin pembayaran "%" belum punya tahap apa pun.', v_term.name;
  end if;

  for v_step in
    select * from payment_term_steps where payment_term_id = p_payment_term_id order by sequence_no
  loop
    v_urut := v_urut + 1;

    if v_urut = v_jumlah_step then
      -- TAHAP TERAKHIR MENYERAP SISANYA. Aturan yang DIPILIH, bukan ditemukan --
      -- §25 menetapkan kriterianya ("obligations reconcile exactly with transaction
      -- total"), dan saat persentase tidak habis dibagi, inilah satu-satunya cara
      -- memenuhinya. Tanpa ini, 3 x 33,33% akan kehilangan sisa yang tidak pernah
      -- ditagihkan ke siapa pun.
      v_amount := v_total - v_terpakai;
    elsif v_step.percentage is not null then
      v_amount := round(v_total * v_step.percentage / 100, 4);
    else
      v_amount := v_step.fixed_amount;
    end if;

    if v_amount <= 0 then
      raise exception 'Tahap "%" menghasilkan nilai nol atau negatif. Periksa susunan terminnya.', v_step.label;
    end if;

    insert into sales_order_payment_obligations (
      company_id, sales_order_id, sequence_no,
      payment_term_id, payment_term_name_snapshot, label_snapshot,
      percentage_snapshot, trigger_event_snapshot, due_offset_days_snapshot, amount
    ) values (
      v_so.company_id, p_sales_order_id, v_step.sequence_no,
      v_term.payment_term_id, v_term.name, v_step.label,
      v_step.percentage, v_step.trigger_event, v_step.due_offset_days, v_amount
    );

    v_terpakai := v_terpakai + v_amount;
    v_dibuat := v_dibuat + 1;
  end loop;

  -- Penjaga terakhir: jumlah kewajiban WAJIB sama persis dengan nilai transaksi.
  -- Diperiksa di sini, bukan diserahkan ke test -- selisih uang yang lolos ke basis
  -- data jauh lebih mahal daripada permintaan yang ditolak.
  if v_terpakai <> v_total then
    raise exception 'Jumlah kewajiban (%) tidak sama dengan nilai Sales Order (%). Penjadwalan dibatalkan.', v_terpakai, v_total;
  end if;

  return v_dibuat;
end;
$$;

revoke execute on function public.terapkan_payment_terms(integer, integer) from public, anon;
grant execute on function public.terapkan_payment_terms(integer, integer) to authenticated;
