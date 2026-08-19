-- Migration: kolom transparansi utk standard_labor_cost_per_unit yang sekarang
-- benar-benar dihitung (bukan selalu NULL lagi) -- sama pola dengan
-- cost_data_complete/missing_cost_item_codes utk bahan/kemasan.
alter table sales_order_line_margin_snapshots add column if not exists labor_cost_complete boolean not null default false;
alter table sales_order_line_margin_snapshots add column if not exists labor_cost_notes text[];
