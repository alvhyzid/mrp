-- Surface items.cost_unverified (25 Agu 2026, formula resmi Gummy Zala V2/Drinkme V1)
-- di Margin Watch -- kolom terpisah dari missing_cost_item_codes: harga di sini ADA
-- dan IKUT dihitung, cuma belum dikonfirmasi purchasing.

alter table sales_order_line_margin_snapshots add column if not exists unverified_cost_item_codes text[];
