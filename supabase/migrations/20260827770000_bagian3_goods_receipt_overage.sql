-- BAGIAN 3 -- keputusan pemilik produk (22 Agu 2026): penerimaan barang
-- MELEBIHI qty dipesan pada 1 baris PO Supplier DIIZINKAN, TAPI diberi
-- peringatan (menyebut angka persis) DAN tercatat sebagai kejadian
-- tersendiri (siapa/kapan/berapa lebih) -- kelebihan menyangkut UANG
-- (tagihan supplier lebih besar dari PO), keuangan perlu tahu sebelum
-- membayar. BUKAN gerbang keras (barang sudah ADA secara fisik di gudang
-- saat sistem tahu -- menolak di database cuma bikin kelebihan itu tidak
-- tercatat, lebih berbahaya). Layar untuk melihat daftar ini BELUM
-- dibangun (menunggu cetakan UX, sesuai batas blok kerja ini) -- baru
-- lapisan data & deteksi.
create table if not exists public.goods_receipt_overage_log (
  goods_receipt_overage_log_id serial primary key,
  company_id integer not null references public.companies(company_id),
  goods_receipt_line_id integer not null references public.goods_receipt_lines(goods_receipt_line_id),
  purchase_order_line_id integer not null references public.purchase_order_lines(purchase_order_line_id),
  item_id integer not null references public.items(item_id),
  qty_ordered numeric(14,4) not null,
  qty_received_total numeric(14,4) not null,
  qty_over numeric(14,4) not null check (qty_over > 0),
  received_by integer references public.users(user_id),
  received_at timestamptz not null default now()
);
create index if not exists goods_receipt_overage_log_company_id_idx on public.goods_receipt_overage_log (company_id);

alter table public.goods_receipt_overage_log enable row level security;

drop policy if exists goods_receipt_overage_log_select_for_company on public.goods_receipt_overage_log;
create policy goods_receipt_overage_log_select_for_company on public.goods_receipt_overage_log
  for select using (company_id = public.jwt_company_id());
-- TIDAK ADA policy insert/update/delete untuk authenticated/anon -- satu-
-- satunya jalur tulis adalah createGoodsReceipt.ts lewat service-role.
