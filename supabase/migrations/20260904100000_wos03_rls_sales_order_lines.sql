-- WO-S03 (SC-03) — sales_order_lines: RLS menyala dengan NOL kebijakan.
--
-- KEADAAN SEBELUM MIGRASI INI (disensus dari pg_policy proyek nyata, 29 Agu 2026):
--   customers 2 · customer_purchase_orders 3 · customer_purchase_order_lines 1
--   customer_po_approvals 2 · customer_delivery_addresses 2 · sales_orders 2
--   shipments 2 · shipment_lines 2 · sales_order_lines --> 0
-- Persis SATU tabel Sales tanpa kebijakan, dan seluruh tetangganya terjaga.
--
-- INI GAGAL-TERTUTUP, BUKAN BOCOR. RLS menyala + nol kebijakan = klien ber-RLS
-- mendapat NOL baris. Aplikasi tetap jalan karena seluruh jalur Sales memakai
-- service role yang melewati RLS, dengan penyaringan tenant di kode aplikasi.
-- Yang hilang adalah LAPIS KEDUA yang dijanjikan Prinsip Arsitektur #1 CLAUDE.md:
-- isolasi lewat RLS, "bukan cuma filter di kode aplikasi".
--
-- KENAPA INI BUKAN KEBIJAKAN HAK AKSES BARU (dan karena itu tidak perlu keputusan
-- pemilik produk): kebijakan di bawah MENYALIN pola yang sudah dipakai tabel baris
-- sebelahnya, customer_po_lines_write_ppic -- kepemilikan ditegakkan LEWAT INDUK
-- dengan EXISTS, bukan lewat kolom company_id di tabel baris (sales_order_lines
-- memang tidak punya company_id). Peran untuk menulis DISELARASKAN dengan induknya,
-- sales_orders_update_ppic. Tidak ada satu peran pun yang mendapat akses yang hari
-- ini tidak dimilikinya: service role tetap melewati RLS seperti sebelumnya, dan
-- sebelum migrasi ini klien ber-RLS mendapat NOL baris -- jadi arah perubahannya
-- hanya MENAMBAH, tidak pernah melonggarkan.
--
-- YANG TIDAK DICAKUP MIGRASI INI, disebutkan supaya tidak dikira sudah beres:
--   - Ia TIDAK mengubah jalur aplikasi mana pun. Jalur yang ada tetap memakai
--     service role; migrasi ini tidak membuat satu pun jalur berpindah ke RLS.
--   - Ia TIDAK menyentuh sales_orders (yang sudah punya 2 kebijakan), dan TIDAK
--     menambah kebijakan INSERT/DELETE untuk sales_orders -- keduanya memang belum
--     ada, tetapi mengubahnya menyentuh pembuatan SO yang sedang menunggu AD-02.
--   - Ia TIDAK menyelesaikan SC-01, SC-02, SC-04, maupun SC-05.

do $$
begin
  if exists (
    select 1 from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'sales_order_lines'
  ) then
    raise exception 'sales_order_lines sudah punya kebijakan RLS -- migrasi ini menganggapnya nol. Periksa dulu sebelum melanjutkan.';
  end if;
end $$;

-- BACA: seluruh anggota company yang sama, sama persis dengan
-- sales_orders_select_for_company pada induknya. Baris Sales Order Line tidak
-- pernah lebih rahasia daripada Sales Order-nya sendiri.
create policy sales_order_lines_select_for_company
  on public.sales_order_lines
  for select
  using (
    exists (
      select 1 from public.sales_orders so
      where so.sales_order_id = sales_order_lines.sales_order_id
        and so.company_id = public.jwt_company_id()
    )
  );

-- TULIS: peran DISELARASKAN dengan sales_orders_update_ppic pada induknya.
-- Bentuk EXISTS + gabungan peran MENYALIN customer_po_lines_write_ppic.
create policy sales_order_lines_write_ppic
  on public.sales_order_lines
  for all
  using (
    exists (
      select 1 from public.sales_orders so
      where so.sales_order_id = sales_order_lines.sales_order_id
        and so.company_id = public.jwt_company_id()
    )
    and (
      public.jwt_is_company_leadership()
      or public.jwt_app_role() = any (array['ppic_manager', 'ppic_staff', 'production_manager'])
    )
  )
  with check (
    exists (
      select 1 from public.sales_orders so
      where so.sales_order_id = sales_order_lines.sales_order_id
        and so.company_id = public.jwt_company_id()
    )
    and (
      public.jwt_is_company_leadership()
      or public.jwt_app_role() = any (array['ppic_manager', 'ppic_staff', 'production_manager'])
    )
  );
