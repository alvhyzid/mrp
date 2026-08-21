-- Migration FIXUP: migrasi sebelumnya (20260827160000) DROP policy lama
-- "sales_order_line_feasibility_snapshots_write" tapi CREATE policy dengan
-- nama BARU "sales_order_line_feasibility_snapshots_insert" tanpa "drop
-- policy if exists" utk nama barunya sendiri -- replay migrasi itu (dites
-- sengaja utk membuktikan idempotensi 0C.6) gagal dgn "policy ... already
-- exists". Ditemukan lewat pengujian ulang sungguhan, bukan cuma dibaca.
-- Migrasi 20260827160000 yang sudah diterapkan TIDAK diedit (aturan sama
-- dgn tidak rename migrasi yang sudah jalan) -- fixup ini menambahkan guard
-- yang hilang supaya SELURUH rangkaian migrasi aman direplay dari sini.
drop policy if exists sales_order_line_feasibility_snapshots_insert on sales_order_line_feasibility_snapshots;
create policy sales_order_line_feasibility_snapshots_insert on sales_order_line_feasibility_snapshots
  for insert with check (
    company_id = public.jwt_company_id()
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('finance_manager'))
  );
