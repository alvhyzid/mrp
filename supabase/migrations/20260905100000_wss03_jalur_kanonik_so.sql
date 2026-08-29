-- WS-S03 (SC-04 + SC-01b) — SATU jalur kanonik pembuatan Sales Order.
--
-- KEADAAN SEBELUM MIGRASI INI, terukur 29 Agu 2026:
--   Ada DUA implementasi lengkap untuk satu proses bisnis yang sama.
--     (a) public.process_customer_purchase_order(integer, integer)
--         ATOMIK (satu transaksi plpgsql), wewenang ditegakkan lewat JWT,
--         MENYALIN tiga kolom snapshot identitas -- tetapi NOL pemanggil di
--         kode aplikasi (hanya dua berkas test), dan TIDAK punya idempotensi.
--     (b) src/features/mrp/server/processCustomerPurchaseOrder.ts
--         DIPAKAI route produksi, punya idempotency_key + balasan "replayed",
--         tetapi memakai kompensasi delete manual (bukan transaksi) dan
--         TIDAK menyalin satu pun kolom snapshot identitas.
--
--   Akibat (b) yang sudah nyata: Sales Order yang lahir lewat layar TIDAK
--   membekukan identitas pelanggan, lalu ditandai layar sebagai "terbit
--   sebelum kolom snapshot ada" -- padahal dibuat hari itu juga.
--
-- YANG DILAKUKAN MIGRASI INI: memindahkan idempotensi ke jalur (a), supaya
-- jalur (a) menjadi satu-satunya penulis sales_orders dan jalur (b) bisa
-- menyusut jadi pemanggil RPC. Setelah ini, (a) memiliki SELURUH kemampuan
-- yang tadinya hanya dimiliki (b).
--
-- KENAPA idempotency_key DITURUNKAN DI DALAM FUNGSI, BUKAN JADI PARAMETER BARU.
-- Ini bukan selera. Grant di Postgres melekat pada TANDA TANGAN fungsi, dan
-- proyek ini SUDAH pernah mengalami regresi grant akibat menambah parameter ke
-- RPC (dicatat di migrasi 20260827520000, dan diulang sebagai peringatan di
-- createShipmentWithSignature.ts). Menurunkan kuncinya dari p_customer_purchase_
-- order_id membuat TANDA TANGAN TIDAK BERUBAH -- jadi create or replace di bawah
-- MEMPERTAHANKAN grant yang sudah ada, termasuk keanggotaan ALLOWED_BROAD_GRANT.
-- Kuncinya memang tidak perlu datang dari klien: ia bisa ditentukan ulang persis
-- sama dari data yang sudah ada, yang justru membuatnya lebih kuat.
--
-- URUTAN PEMERIKSAAN BERUBAH, DAN ITU DISENGAJA. Pemeriksaan pengulangan
-- diletakkan SEBELUM gerbang "status harus new". Alasannya: pada percobaan
-- kedua, PO klien-nya SUDAH berstatus processed -- jadi bila urutannya dibalik,
-- pengulangan yang sah akan ditolak dengan pesan "PO client hanya bisa diproses
-- dari status new", yaitu kegagalan yang membingungkan untuk permintaan yang
-- sebenarnya benar.
--
-- YANG TIDAK DIUBAH SAMA SEKALI, disebut supaya tidak dikira ikut bergeser:
--   - Tanda tangan fungsi, dan karenanya seluruh grant-nya.
--   - Kelima gerbang wewenang & validasi (peran, kepemilikan company, status new,
--     3 persetujuan, pabrik milik company) -- urutan gerbang STATUS saja yang
--     bergeser relatif terhadap pemeriksaan pengulangan.
--   - Format nomor SO dan cara menghitungnya.
--   - Warisan snapshot identitas dari PO klien (sudah benar sejak 20260827480000).
--   - Nol perubahan tabel, nol perubahan data.

create or replace function public.process_customer_purchase_order(
  p_customer_purchase_order_id integer,
  p_production_plant_id integer
)
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_po customer_purchase_orders%rowtype;
  v_plant_company_id integer;
  v_approved_count integer;
  v_processed_by integer;
  v_sales_order_id integer;
  v_company_code text;
  v_sequence integer;
  v_so_number text;
  v_idempotency_key text;
begin
  select * into v_po from customer_purchase_orders where customer_purchase_order_id = p_customer_purchase_order_id;

  if v_po.customer_purchase_order_id is null or v_po.company_id <> public.jwt_company_id() then
    raise exception 'PO client tidak ditemukan di perusahaan Anda.';
  end if;

  if not public.jwt_is_company_leadership() then
    raise exception 'Hanya company_admin atau general_manager yang boleh memproses PO client.';
  end if;

  -- Kunci pengulangan DITURUNKAN, bukan dikirim klien: ia bisa ditentukan ulang
  -- persis sama dari data yang sudah ada, jadi permintaan yang diulang -- entah
  -- karena tombol diklik dua kali atau karena jaringan mengirim ulang -- TIDAK
  -- PERNAH bisa melahirkan Sales Order kedua.
  v_idempotency_key := 'cpo-' || p_customer_purchase_order_id::text;

  select sales_order_id into v_sales_order_id
  from sales_orders
  where company_id = v_po.company_id and idempotency_key = v_idempotency_key;

  if v_sales_order_id is not null then
    return v_sales_order_id;
  end if;

  if v_po.status <> 'new' then
    raise exception 'PO client hanya bisa diproses dari status new (status saat ini: %).', v_po.status;
  end if;

  select count(*) into v_approved_count
  from customer_po_approvals
  where customer_purchase_order_id = p_customer_purchase_order_id and status = 'approved';

  if v_approved_count < 3 then
    raise exception 'PO client belum disetujui oleh ketiga department (baru % dari 3).', v_approved_count;
  end if;

  select company_id into v_plant_company_id from production_plants where production_plant_id = p_production_plant_id;
  if v_plant_company_id is null or v_plant_company_id <> v_po.company_id then
    raise exception 'Lokasi pabrik tidak valid untuk perusahaan Anda.';
  end if;

  select user_id into v_processed_by from users where auth_uid = auth.uid()::text;

  select coalesce(nullif(cs.setting_value, ''), upper(left(regexp_replace(c.name, '[^A-Za-z]', '', 'g'), 3)))
    into v_company_code
  from companies c
  left join company_settings cs on cs.company_id = c.company_id and cs.setting_key = 'so_number_company_code'
  where c.company_id = v_po.company_id;

  select count(*) + 1 into v_sequence
  from sales_orders so
  where so.company_id = v_po.company_id
    and extract(year from so.created_at) = extract(year from now());

  v_so_number := to_char(v_sequence, 'FM000') || '/' || to_char(now(), 'FMMM') || '-' || coalesce(v_company_code, 'CO') || '/' || to_char(now(), 'FMYYYY');

  begin
    insert into sales_orders (
      company_id, customer_purchase_order_id, customer_id, production_plant_id, status, so_number,
      idempotency_key, customer_name_snapshot, customer_billing_address_snapshot, customer_npwp_snapshot
    )
    values (
      v_po.company_id, v_po.customer_purchase_order_id, v_po.customer_id, p_production_plant_id, 'confirmed', v_so_number,
      v_idempotency_key, v_po.customer_name_snapshot, v_po.customer_billing_address_snapshot, v_po.customer_npwp_snapshot
    )
    returning sales_order_id into v_sales_order_id;
  exception when unique_violation then
    -- Dua permintaan berjalan BERSAMAAN dan keduanya lolos pemeriksaan di atas.
    -- Bisa kena dua kekangan berbeda: sales_orders_customer_purchase_order_id_key
    -- (ada sejak awal skema) ATAU sales_orders_idempotency_key_unique. Keduanya
    -- berarti hal yang sama persis di sini -- satu PO klien hanya boleh punya satu
    -- Sales Order -- jadi ditangani sama: ambil yang dibuat permintaan lain dan
    -- kembalikan sebagai keberhasilan, bukan sebagai galat.
    select sales_order_id into v_sales_order_id
    from sales_orders
    where company_id = v_po.company_id
      and customer_purchase_order_id = v_po.customer_purchase_order_id;
    if v_sales_order_id is null then
      raise;
    end if;
    return v_sales_order_id;
  end;

  insert into sales_order_lines (sales_order_id, item_id, qty_ordered, unit_price)
  select v_sales_order_id, cpol.item_id, cpol.qty_ordered, cpol.unit_price
  from customer_purchase_order_lines cpol
  where cpol.customer_purchase_order_id = v_po.customer_purchase_order_id;

  update customer_purchase_orders
  set status = 'processed', processed_by = v_processed_by, processed_at = now()
  where customer_purchase_order_id = v_po.customer_purchase_order_id;

  return v_sales_order_id;
end;
$$;
