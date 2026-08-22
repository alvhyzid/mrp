-- Halaman Daftar Tugas Pembangunan -- PMB-07a selesai 22 Agu 2026 (Bagian 3
-- blok kerja paralel). Kolom snapshot identitas ditambahkan ke
-- purchase_orders/customer_purchase_orders/sales_orders, dibuktikan lewat
-- test permanen (tests/pmb07a_identity_snapshot.test.ts).
do $$
declare
  v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then
    raise notice 'Perusahaan PT ITM tidak ditemukan -- migrasi dilewati (no-op).';
    return;
  end if;

  update build_tasks set
    status = 'selesai',
    started_at = coalesce(started_at, now()),
    completed_at = now(),
    approved_at = now(),
    detail_pekerjaan = detail_pekerjaan || E'\n\n--- HASIL 22 Agu 2026 ---\nArkeologi dikonfirmasi: purchase_orders/customer_purchase_orders/sales_orders SEBELUM migrasi ini hanya referensi (supplier_id/customer_id), tidak ada salinan beku -- sama kelas masalah dengan shipments sebelum Alur 1. Migrasi 20260827480000 menambah kolom supplier_name_snapshot/supplier_address_snapshot/supplier_npwp_snapshot (purchase_orders) dan customer_name_snapshot/customer_billing_address_snapshot/customer_npwp_snapshot (customer_purchase_orders, sales_orders). createPurchaseOrder.ts dan createCustomerPurchaseOrder.ts mengisi snapshot saat dokumen terbit; process_customer_purchase_order() RPC mewariskan snapshot CPO ke SO (bukan query ulang customers). Jalur baca (listPurchaseOrders.ts/listCustomerPurchaseOrders.ts/listSalesOrders.ts) mengutamakan snapshot, fallback join hidup HANYA untuk dokumen lama. Dibuktikan tests/pmb07a_identity_snapshot.test.ts: ubah alamat supplier/client setelah dokumen terbit -> dokumen lama TIDAK berubah, dokumen baru pakai alamat baru (termasuk SO yang diproses dari CPO). Docs (rancangan-skema-database-mrp.md, daftar-database-sederhana.md) diperbarui.'
  where company_id = v_company_id and task_code = 'PMB-07a';

end $$;
