-- Alur 1 (21 Agu 2026) — Supplier & Pelanggan: CRUD lengkap + jalan keluar +
-- daftar bahan yang dipasok. Field baru sesuai koreksi pemilik produk (3.3);
-- kolom lama (contact_info, supplier_type, customer_type) TIDAK dihapus --
-- kompatibel-mundur, data PT ITM yang sudah ada tetap utuh.

alter table if exists suppliers
  add column if not exists address text,
  add column if not exists npwp text,
  add column if not exists pic_name text,
  add column if not exists pic_phone text,
  add column if not exists pic_email text,
  add column if not exists payment_terms text,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by integer references users(user_id);

create index if not exists suppliers_archived_at_idx on suppliers (company_id, archived_at);

alter table if exists customers
  add column if not exists billing_address text,
  add column if not exists shipping_address text,
  add column if not exists npwp text,
  add column if not exists pic_name text,
  add column if not exists pic_phone text,
  add column if not exists pic_email text,
  add column if not exists payment_terms text,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by integer references users(user_id);

create index if not exists customers_archived_at_idx on customers (company_id, archived_at);

-- 3.1b: shipments HANYA menyimpan referensi customer_id -- getShipmentDetail.ts
-- baris 43 melakukan JOIN LIVE ke customers.name setiap kali surat jalan
-- dibuka/dicetak. Dibuktikan: bila nama/alamat customer diubah HARI INI,
-- surat jalan yang SUDAH dicetak & ditandatangani BULAN LALU akan ikut
-- menampilkan nama/alamat BARU begitu dimuat ulang -- ini bug traceability,
-- bukan fitur. Pola sama dengan snapshot routing/BOM Sesi 6A: dokumen
-- membekukan identitas mitra PERSIS saat dokumen (shipment) dibuat, bukan
-- terus membaca master hidup. Aritmatika TIDAK berubah -- shipments tidak
-- punya angka biaya sama sekali, murni identitas cetak.
alter table if exists shipments
  add column if not exists customer_name_snapshot text,
  add column if not exists customer_billing_address_snapshot text,
  add column if not exists customer_npwp_snapshot text;

-- 3.4: daftar bahan yang dipasok -- hubungan BANYAK-ke-BANYAK supplier<->item.
-- SATU baris per (supplier, item): harga acuan & lead time KHUSUS bahan ini
-- SELALU baris yang sama diperbarui saat berubah (bukan riwayat bertingkat --
-- tidak diminta 3.4, dan "tanggal berlaku" cukup jadi tanggal harga TERKINI
-- mulai berlaku, konsisten dengan pola production_standards yang juga tidak
-- menyimpan riwayat setiap perubahan sebagai baris terpisah).
create table if not exists supplier_item_prices (
  supplier_item_price_id serial primary key,
  company_id integer not null references companies(company_id),
  supplier_id integer not null references suppliers(supplier_id),
  item_id integer not null references items(item_id),
  supplier_item_code text,
  supplier_item_name text,
  reference_price numeric(14,4),
  price_valid_from date,
  min_order_qty numeric(14,4),
  min_order_uom text,
  lead_time_days_override integer,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (supplier_id, item_id)
);

create index if not exists supplier_item_prices_company_id_idx on supplier_item_prices (company_id);
create index if not exists supplier_item_prices_item_id_idx on supplier_item_prices (item_id);

alter table if exists supplier_item_prices enable row level security;

drop policy if exists supplier_item_prices_select_for_company on supplier_item_prices;
create policy supplier_item_prices_select_for_company on supplier_item_prices
  for select using (company_id = public.jwt_company_id());

drop policy if exists supplier_item_prices_write_purchasing on supplier_item_prices;
create policy supplier_item_prices_write_purchasing on supplier_item_prices
  for all using (
    company_id = public.jwt_company_id()
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('purchasing_manager', 'purchasing_staff'))
  )
  with check (
    company_id = public.jwt_company_id()
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('purchasing_manager', 'purchasing_staff'))
  );

-- 3.5: TIDAK ada kolom baru di items -- items.standard_cost TETAP satu-satunya
-- sumber biaya standar yang authoritative, tidak pernah ditimpa harga acuan.
-- computeStandardCostPerUnit.ts (kode, bukan skema) yang mendapat langkah
-- TAMBAHAN: kalau leaf item belum punya standard_cost, boleh MENGESTIMASI dari
-- supplier_item_prices.reference_price (ditandai eksplisit di hasil fungsi),
-- tapi estimasi itu membuat baseline TIDAK BOLEH dikunci -- ditegakkan di
-- lockMarginBaseline.ts (kode), bukan lewat kolom skema baru.
