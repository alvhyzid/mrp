-- Migration: bersihkan 1 baris sales_order_line_margin_snapshots MLVT yang jadi
-- artefak pengujian sendiri (Claude Code), BUKAN data pemilik produk.
--
-- Konteks: sebelum migrasi 20260827130000 (koreksi presisi Sachet Roll Etawa
-- Fit) dijalankan, dilakukan verifikasi visual Margin Watch di browser (login
-- company.a@debug.mrp) untuk membuktikan panel packaging_breakdown yang baru
-- ditambahkan berfungsi -- klik ini memicu getMarginWatch.ts membuat baris
-- sales_order_line_margin_snapshots (Lapis 1, "dikunci sekali" by design)
-- memakai standard_cost LAMA (469,85 dibulatkan). Baris ini sekarang jadi baseline
-- yang secara PERMANEN salah (immutable by design, tidak ada mekanisme reset di
-- app) kalau dibiarkan -- bukan snapshot bisnis yang sah (belum pernah dilihat
-- pemilik produk), murni akibat aktivitas pengujian sesi ini. Dihapus supaya
-- panggilan getMarginWatch berikutnya membuat snapshot baru dari standard_cost
-- yang sudah benar (469,8470).
do $$
declare
  v_company_id integer;
  v_deleted integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then
    raise notice 'Perusahaan PT ITM tidak ditemukan -- migrasi dilewati (no-op).';
    return;
  end if;

  delete from sales_order_line_margin_snapshots
  where company_id = v_company_id
    and sales_order_line_id in (
      select sol.sales_order_line_id
      from sales_order_lines sol
      join items i on i.item_id = sol.item_id
      where i.company_id = v_company_id and i.item_code = 'MLVT-BOX/001ITM'
    );
  get diagnostics v_deleted = row_count;
  raise notice 'Baris sales_order_line_margin_snapshots MLVT (artefak pengujian) dihapus: % (0 kalau migrasi ini dijalankan ulang -- idempoten)', v_deleted;
end $$;
