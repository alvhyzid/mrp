-- Halaman Daftar Tugas Pembangunan -- PMB-07b selesai (lapisan data & server
-- saja) 22 Agu 2026, Bagian 4 blok kerja paralel.
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
    detail_pekerjaan = detail_pekerjaan || E'\n\n--- HASIL 22 Agu 2026 (LAPISAN DATA & SERVER SAJA -- layar MENUNGGU cetakan UX) ---\nArkeologi (b.2) dilakukan SEBELUM membangun: blokir kelebihan-kirim (enforce_shipment_line_qty_limit(), migrasi 20260817150000) TERBUKTI SUDAH kumulatif per sales_order_line_id lintas SELURUH shipment (bukan per-shipment) -- TIDAK PERLU diperbaiki. delivery_address SUDAH beku per shipment sejak awal (migrasi 20260817140000). pod_token SUDAH unique constraint sejak awal (migrasi 20260817180000). qty_remaining_to_ship SUDAH dihitung listSalesOrders.ts. Satu-satunya yang GENUINELY baru: tabel customer_delivery_addresses (daftar alamat tersimpan per customer, pola arsip sama Supplier/Customer) + kolom jejak shipments.delivery_address_id (resolusi dilakukan di TypeScript createShipmentWithSignature.ts, BUKAN parameter RPC -- sengaja menghindari pola regresi grant create_shipment_with_signature yang pernah terjadi).\nDibuktikan tests/pmb07b_delivery_addresses.test.ts (5 test): (a) pesanan 2.500 dipecah 1.000+1.500 ke 2 alamat -> sisa 2500->1500->0, 2 surat jalan alamat benar; (b) kirim 1.000 lagi setelah sisa nol -> ditolak database, pesan sebut sisa 0; (c) ubah alamat tersimpan A setelah surat jalan A terbit -> surat jalan A tidak berubah; (d) token POD 2 pengiriman berbeda & tidak bisa saling dipakai; alamat terpakai tidak bisa dihapus permanen, hanya diarsipkan.',
    notes = coalesce(notes || ' ', '') || 'Layar (UI pemilihan alamat) BELUM dibangun -- menunggu cetakan UX dari koreksi pemilik produk di Alur 1, sesuai batas eksplisit.'
  where company_id = v_company_id and task_code = 'PMB-07b';

end $$;
