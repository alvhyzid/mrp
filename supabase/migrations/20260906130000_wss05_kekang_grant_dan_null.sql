-- WS-S05 — DUA PERBAIKAN KEAMANAN yang ditemukan penjaga proyek ini sendiri,
-- bukan oleh pembacaan kode.
--
-- ============================================================================
-- (1) SEMANTIK NULL: pemeriksaan yang TIDAK BERBUNYI untuk pemanggil tanpa klaim
-- ============================================================================
-- Ini yang lebih berbahaya dari dua temuan ini, dan ia tak terlihat dari membaca.
--
-- Bila fungsi dipanggil TANPA klaim JWT (mis. lewat kunci anon), jwt_company_id()
-- dan jwt_is_company_leadership() mengembalikan NULL. Dalam SQL:
--
--   v_po.company_id <> NULL                    -> NULL   (bukan true)
--   false or NULL                              -> NULL   (bukan true)
--   not NULL                                   -> NULL   (bukan true)
--
-- dan `if NULL then ... end if` TIDAK dieksekusi. Artinya kedua gerbang --
-- kepemilikan perusahaan DAN wewenang -- DILEWATI BEGITU SAJA, bukan ditolak.
--
-- Yang menghentikan permintaan itu hari ini hanyalah pasang_konteks_keputusan()
-- yang gagal menemukan barisnya di `users`. Itu pertahanan YANG KEBETULAN ADA,
-- bukan gerbang yang dirancang -- dan pertahanan kebetulan akan hilang begitu
-- ada yang merapikan urutan pemanggilan.
--
-- Diperbaiki dengan `is distinct from` (yang memperlakukan NULL sebagai BERBEDA,
-- bukan sebagai tidak-diketahui) dan `coalesce(..., false)`.
--
-- ============================================================================
-- (2) GRANT BAWAAN KE PUBLIC
-- ============================================================================
-- Postgres memberi EXECUTE kepada PUBLIC secara BAWAAN pada setiap fungsi baru.
-- `grant execute ... to authenticated` di migrasi sebelumnya MENAMBAH, bukan
-- membatasi -- sehingga keempat fungsi baru bisa dipanggil `anon`, yaitu tanpa
-- login sama sekali. Penjaganya: tests/function_grant_security_audit.test.ts.
--
-- pasang_konteks_keputusan() adalah PENOLONG INTERNAL dan tidak boleh dipanggil
-- siapa pun dari luar. Ia dicabut dari semuanya. Ketiga fungsi aksi tetap bisa
-- memanggilnya karena mereka SECURITY DEFINER dan berjalan sebagai pemiliknya.

create or replace function public.tahan_po_klien(
  p_customer_purchase_order_id integer,
  p_reason_category text,
  p_reason_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_po customer_purchase_orders%rowtype;
begin
  select * into v_po from customer_purchase_orders where customer_purchase_order_id = p_customer_purchase_order_id;
  if v_po.customer_purchase_order_id is null or v_po.company_id is distinct from public.jwt_company_id() then
    raise exception 'PO client tidak ditemukan di perusahaan Anda.';
  end if;

  if public.jwt_decision_department() is null then
    raise exception 'Peran Anda tidak mewakili departemen yang boleh menahan PO client.';
  end if;

  if v_po.status <> 'new' then
    raise exception 'PO client hanya bisa ditahan saat berstatus baru (status saat ini: %).', v_po.status;
  end if;

  perform public.pasang_konteks_keputusan('customer_purchase_orders', 'hold', p_reason_category, p_reason_note);

  update customer_purchase_orders set status = 'on_hold'
  where customer_purchase_order_id = p_customer_purchase_order_id;
end;
$$;

create or replace function public.lepas_po_klien(
  p_customer_purchase_order_id integer,
  p_reason_category text,
  p_reason_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_po customer_purchase_orders%rowtype;
  v_departemen_penahan text;
  v_departemen_saya text;
begin
  select * into v_po from customer_purchase_orders where customer_purchase_order_id = p_customer_purchase_order_id;
  if v_po.customer_purchase_order_id is null or v_po.company_id is distinct from public.jwt_company_id() then
    raise exception 'PO client tidak ditemukan di perusahaan Anda.';
  end if;

  if v_po.status <> 'on_hold' then
    raise exception 'PO client ini tidak sedang ditahan (status saat ini: %).', v_po.status;
  end if;

  v_departemen_saya := public.jwt_decision_department();
  if v_departemen_saya is null then
    raise exception 'Peran Anda tidak mewakili departemen mana pun.';
  end if;

  -- BD-06: penghalang dari satu departemen tidak boleh dilepas departemen lain.
  select actor_department_snapshot into v_departemen_penahan
  from status_transition_log
  where table_name = 'customer_purchase_orders'
    and record_id = p_customer_purchase_order_id
    and to_status = 'on_hold'
  order by status_transition_log_id desc
  limit 1;

  if v_departemen_penahan is not null and v_departemen_penahan <> v_departemen_saya then
    raise exception 'PO client ini ditahan oleh departemen %. Hanya departemen itu yang boleh melepasnya.', v_departemen_penahan;
  end if;

  perform public.pasang_konteks_keputusan('customer_purchase_orders', 'release', p_reason_category, p_reason_note);

  update customer_purchase_orders set status = 'new'
  where customer_purchase_order_id = p_customer_purchase_order_id;
end;
$$;

create or replace function public.batalkan_po_klien(
  p_customer_purchase_order_id integer,
  p_reason_category text,
  p_reason_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_po customer_purchase_orders%rowtype;
begin
  select * into v_po from customer_purchase_orders where customer_purchase_order_id = p_customer_purchase_order_id;
  if v_po.customer_purchase_order_id is null or v_po.company_id is distinct from public.jwt_company_id() then
    raise exception 'PO client tidak ditemukan di perusahaan Anda.';
  end if;

  -- coalesce WAJIB: `not NULL` bernilai NULL, dan `if NULL` tidak pernah dieksekusi --
  -- sehingga gerbang ini akan DILEWATI, bukan menolak, untuk pemanggil tanpa klaim.
  if not coalesce(public.jwt_is_company_leadership(), false) then
    raise exception 'Hanya Manager atau General Manager yang boleh membatalkan PO client.';
  end if;

  if v_po.status not in ('new', 'on_hold') then
    raise exception 'PO client berstatus % tidak bisa dibatalkan.', v_po.status;
  end if;

  perform public.pasang_konteks_keputusan('customer_purchase_orders', 'cancel', p_reason_category, p_reason_note);

  update customer_purchase_orders set status = 'cancelled'
  where customer_purchase_order_id = p_customer_purchase_order_id;
end;
$$;

-- Penolong internal: TIDAK boleh dipanggil siapa pun dari luar.
revoke execute on function public.pasang_konteks_keputusan(text, text, text, text) from public;
revoke execute on function public.pasang_konteks_keputusan(text, text, text, text) from anon;
revoke execute on function public.pasang_konteks_keputusan(text, text, text, text) from authenticated;

-- Ketiga aksi + penolong departemen: hanya pengguna yang SUDAH LOGIN.
revoke execute on function public.tahan_po_klien(integer, text, text) from public;
revoke execute on function public.tahan_po_klien(integer, text, text) from anon;
revoke execute on function public.lepas_po_klien(integer, text, text) from public;
revoke execute on function public.lepas_po_klien(integer, text, text) from anon;
revoke execute on function public.batalkan_po_klien(integer, text, text) from public;
revoke execute on function public.batalkan_po_klien(integer, text, text) from anon;
revoke execute on function public.jwt_decision_department() from public;
revoke execute on function public.jwt_decision_department() from anon;

grant execute on function public.tahan_po_klien(integer, text, text) to authenticated;
grant execute on function public.lepas_po_klien(integer, text, text) to authenticated;
grant execute on function public.batalkan_po_klien(integer, text, text) to authenticated;
grant execute on function public.jwt_decision_department() to authenticated;
