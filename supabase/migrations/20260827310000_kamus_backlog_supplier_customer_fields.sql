-- Migration: backlog Kamus utk kolom baru Alur 1 (migrasi 20260827290000 &
-- 20260827300000) — kolom baru wajib masuk antrean Kamus sesuai aturan proyek.
do $$
declare
  v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then
    raise notice 'Perusahaan PT ITM tidak ditemukan -- backlog Kamus dilewati (no-op).';
    return;
  end if;

  insert into kamus_terms (company_id, scope, entity, field, term_key, priority, domain, suggested_role, status, ai_draft)
  values
    (v_company_id, 'FIELD', 'suppliers', 'address', 'suppliers.address', 3, 'standar', 'purchasing', 'DRAF_AI', 'Alamat lengkap supplier (Alur 1, 21 Agu 2026).'),
    (v_company_id, 'FIELD', 'suppliers', 'npwp', 'suppliers.npwp', 3, 'standar', 'purchasing', 'DRAF_AI', 'Nomor NPWP supplier.'),
    (v_company_id, 'FIELD', 'suppliers', 'pic_name', 'suppliers.pic_name', 3, 'standar', 'purchasing', 'DRAF_AI', 'Nama kontak person (PIC) supplier.'),
    (v_company_id, 'FIELD', 'suppliers', 'pic_phone', 'suppliers.pic_phone', 3, 'standar', 'purchasing', 'DRAF_AI', 'Nomor telepon PIC supplier.'),
    (v_company_id, 'FIELD', 'suppliers', 'pic_email', 'suppliers.pic_email', 3, 'standar', 'purchasing', 'DRAF_AI', 'Email PIC supplier.'),
    (v_company_id, 'FIELD', 'suppliers', 'payment_terms', 'suppliers.payment_terms', 3, 'standar', 'purchasing', 'DRAF_AI', 'Termin pembayaran ke supplier ini.'),
    (v_company_id, 'FIELD', 'suppliers', 'archived_at', 'suppliers.archived_at', 3, 'standar', 'purchasing', 'DRAF_AI', 'Waktu supplier ini diarsipkan (Alur 1, 21 Agu 2026) -- NULL berarti masih aktif dan boleh dipilih di PO Supplier baru.'),
    (v_company_id, 'FIELD', 'suppliers', 'archived_by', 'suppliers.archived_by', 3, 'standar', 'purchasing', 'DRAF_AI', 'Siapa yang mengarsipkan supplier ini.'),
    (v_company_id, 'FIELD', 'customers', 'billing_address', 'customers.billing_address', 3, 'standar', 'ppic', 'DRAF_AI', 'Alamat penagihan/faktur client (Alur 1, 21 Agu 2026).'),
    (v_company_id, 'FIELD', 'customers', 'shipping_address', 'customers.shipping_address', 3, 'standar', 'ppic', 'DRAF_AI', 'Alamat pengiriman client -- boleh beda dari alamat penagihan.'),
    (v_company_id, 'FIELD', 'customers', 'npwp', 'customers.npwp', 3, 'standar', 'ppic', 'DRAF_AI', 'Nomor NPWP client.'),
    (v_company_id, 'FIELD', 'customers', 'pic_name', 'customers.pic_name', 3, 'standar', 'ppic', 'DRAF_AI', 'Nama kontak person (PIC) client.'),
    (v_company_id, 'FIELD', 'customers', 'pic_phone', 'customers.pic_phone', 3, 'standar', 'ppic', 'DRAF_AI', 'Nomor telepon PIC client.'),
    (v_company_id, 'FIELD', 'customers', 'pic_email', 'customers.pic_email', 3, 'standar', 'ppic', 'DRAF_AI', 'Email PIC client.'),
    (v_company_id, 'FIELD', 'customers', 'payment_terms', 'customers.payment_terms', 3, 'standar', 'ppic', 'DRAF_AI', 'Termin pembayaran client ini.'),
    (v_company_id, 'FIELD', 'customers', 'archived_at', 'customers.archived_at', 3, 'standar', 'ppic', 'DRAF_AI', 'Waktu client ini diarsipkan (Alur 1, 21 Agu 2026) -- NULL berarti masih aktif dan boleh dipilih di PO Client baru.'),
    (v_company_id, 'FIELD', 'customers', 'archived_by', 'customers.archived_by', 3, 'standar', 'ppic', 'DRAF_AI', 'Siapa yang mengarsipkan client ini.'),
    (v_company_id, 'FIELD', 'shipments', 'customer_name_snapshot', 'shipments.customer_name_snapshot', 3, 'standar', 'warehouse', 'DRAF_AI', 'Nama client dibekukan PERSIS saat surat jalan ini dibuat (Alur 1, 3.1b) -- tidak ikut berubah kalau data client diedit belakangan. NULL utk shipment lama dari sebelum kolom ini ada.'),
    (v_company_id, 'FIELD', 'shipments', 'customer_billing_address_snapshot', 'shipments.customer_billing_address_snapshot', 3, 'standar', 'warehouse', 'DRAF_AI', 'Alamat penagihan client dibekukan PERSIS saat surat jalan ini dibuat.'),
    (v_company_id, 'FIELD', 'shipments', 'customer_npwp_snapshot', 'shipments.customer_npwp_snapshot', 3, 'standar', 'warehouse', 'DRAF_AI', 'NPWP client dibekukan PERSIS saat surat jalan ini dibuat.'),
    (v_company_id, 'RELATION', 'supplier_item_prices', null, 'supplier_item_prices', 3, 'standar', 'purchasing', 'DRAF_AI', 'Daftar bahan yang dipasok tiap supplier (Alur 1, 3.4, 21 Agu 2026) -- harga acuan HANYA untuk perencanaan, BUKAN HPP. Satu baris per (supplier, bahan); diisi dari layar Supplier ATAU layar Item, keduanya menulis ke tabel yang sama.'),
    (v_company_id, 'FIELD', 'supplier_item_prices', 'reference_price', 'supplier_item_prices.reference_price', 3, 'standar', 'purchasing', 'DRAF_AI', 'Harga acuan supplier untuk bahan ini -- belum ada pembelian nyata. Boleh dipakai Margin Watch sebagai estimasi, TIDAK BOLEH jadi dasar baseline terkunci (HPP tetap dari lot hasil penerimaan barang).')
  on conflict (company_id, term_key) do nothing;
end $$;
