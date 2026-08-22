-- PMB-07b (22 Agu 2026, Bagian 4 blok kerja paralel) — Alamat Tujuan Kirim
-- sebagai Daftar. LAPISAN DATA & SERVER SAJA — layarnya menunggu cetakan UX
-- dari koreksi pemilik produk di Alur 1.
--
-- Arkeologi (b.2) SUDAH dilakukan sebelum menulis migrasi ini: blokir
-- over-shipment (enforce_shipment_line_qty_limit(), migrasi 20260817150000)
-- TERBUKTI SUDAH kumulatif per sales_order_line_id lintas SELURUH shipment
-- (bukan per shipment) — query SUM di dalamnya JOIN ke shipments tanpa
-- filter shipment_id, hanya filter sales_order_line_id + status<>'cancelled'.
-- TIDAK PERLU diperbaiki. delivery_address SUDAH free-text per shipment
-- sejak awal (migrasi 20260817140000, komentar "bisa beda per pengiriman
-- meski SO/customer sama") — TIDAK diwarisi otomatis dari customer, TIDAK
-- dianggap tetap. pod_token SUDAH unique constraint sejak awal (migrasi
-- 20260817180000) — mustahil 2 shipment berbagi token secara struktural.
--
-- KEPUTUSAN TEKNIS: TIDAK menambah parameter ke create_shipment_with_signature()
-- (RPC ini SUDAH PERNAH mengalami regresi grant akibat penambahan parameter —
-- lihat HANDOFF.md/fix_shipment_signature_grant_regression — menambah
-- parameter lagi akan menciptakan overload baru dengan ACL default lagi).
-- Sebagai gantinya: resolusi delivery_address_id->teks alamat dilakukan di
-- TypeScript SEBELUM memanggil RPC (RPC tetap terima teks polos seperti
-- sekarang, signature TIDAK berubah), lalu UPDATE delivery_address_id
-- terpisah SETELAH RPC sukses.

create table if not exists customer_delivery_addresses (
  customer_delivery_address_id serial primary key,
  company_id integer not null references companies(company_id),
  customer_id integer not null references customers(customer_id),
  label text not null,
  address text not null,
  pic_name text,
  pic_phone text,
  archived_at timestamptz,
  archived_by integer references users(user_id),
  created_at timestamptz not null default now()
);

create index if not exists customer_delivery_addresses_company_id_idx on customer_delivery_addresses (company_id);
create index if not exists customer_delivery_addresses_customer_id_idx on customer_delivery_addresses (customer_id);

alter table customer_delivery_addresses enable row level security;

drop policy if exists customer_delivery_addresses_select_for_company on customer_delivery_addresses;
create policy customer_delivery_addresses_select_for_company on customer_delivery_addresses
  for select using (company_id = public.jwt_company_id());

drop policy if exists customer_delivery_addresses_write_for_company on customer_delivery_addresses;
create policy customer_delivery_addresses_write_for_company on customer_delivery_addresses
  for all using (company_id = public.jwt_company_id()) with check (company_id = public.jwt_company_id());

-- Jejak alamat mana yang DIPILIH saat shipment ini dibuat (nullable — null
-- kalau alamat diketik langsung sebagai sekali-pakai, bukan dari daftar).
-- delivery_address (kolom teks yang SUDAH ADA) tetap satu-satunya nilai
-- BEKU sesungguhnya yang tampil di surat jalan — kolom ini murni jejak
-- referensi, TIDAK PERNAH dipakai untuk membaca ulang teks alamat.
alter table shipments
  add column if not exists delivery_address_id integer references customer_delivery_addresses(customer_delivery_address_id);
