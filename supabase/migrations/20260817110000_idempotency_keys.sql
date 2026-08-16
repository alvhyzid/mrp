-- Migration: idempotency_key untuk mencegah dokumen duplikat dari submit ganda
-- (audit 16 Agu 2026: 2 request POST /api/customer-purchase-orders identik yang
-- dikirim paralel TIDAK menghasilkan baris duplikat, tapi cuma kebetulan karena
-- unique(company_id, po_number) — bukan mekanisme idempotency yang disengaja, dan
-- request yang kalah race dapat error 500 mentah dari Postgres, bukan pesan jelas).

alter table if exists customer_purchase_orders
  add column if not exists idempotency_key text;

alter table if exists customer_purchase_orders
  add constraint customer_purchase_orders_idempotency_key_unique unique (company_id, idempotency_key);

alter table if exists sales_orders
  add column if not exists idempotency_key text;

alter table if exists sales_orders
  add constraint sales_orders_idempotency_key_unique unique (company_id, idempotency_key);

-- Catatan: kolom nullable, jadi banyak baris NULL tetap valid (Postgres menganggap
-- NULL <> NULL untuk keperluan unique constraint) — idempotency_key OPSIONAL per
-- request, cuma dipakai kalau endpoint pembuatnya mengirimkannya.
