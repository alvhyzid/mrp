-- Membersihkan sisa fixture verifikasi manual di tenant uji Company B (25 Agu 2026).
--
-- ================= KENAPA INI BOLEH DIHAPUS =================
--
-- Diperiksa lebih dulu, bukan disimpulkan dari namanya: nama "Supplier Visual Cek V1" dan
-- "Pelanggan Uji Provenance" TIDAK MUNCUL di satu berkas pun — tidak di tests/, tidak di
-- scripts/, tidak di src/, tidak di docs/, tidak di migrasi. Nol rujukan.
--
-- Keduanya dibuat TANGAN pada 22 Agu 2026 saat verifikasi visual panel Asal-Usul, dan
-- verifikasi itu sudah selesai. Prosedur verifikasi tertulis (docs/checklist-audit-jalan-kaki.md)
-- pun tidak menyebut keduanya -- ia justru menyuruh MEMBUAT supplier baru sebagai bagian
-- langkahnya, jadi tidak ada yang bergantung pada baris ini.
--
-- Tiga baris status_transition_log menunjuk shipment 275 & 367 yang SUDAH TIDAK ADA
-- (tabel shipments kosong) -- sisa sesi verifikasi 17 Agu.
--
-- ================= YANG SENGAJA TIDAK DISENTUH =================
--
--   Company B itu sendiri dan akun company.b@debug.mrp -- menghapus keduanya memutus
--   SELURUH verifikasi visual, dan itu satu-satunya jalur pemeriksaan tampilan yang tidak
--   menyentuh data nyata.
--   document_types (9) dan ai_capability_status (6): master/turunan, bukan fixture.
--   data_change_audit_log: jejak perubahan sengaja BERTAHAN melewati penghapusan apa pun --
--   itu justru gunanya.
--
-- Penegakan kunci asing DIBIARKAN HIDUP; tabel anak dihapus eksplisit lewat induknya.
-- IDEMPOTEN: seluruhnya DELETE bersyarat.

do $$
declare
  v_company_b integer;
begin
  select company_id into v_company_b from companies where name = 'Company B' limit 1;
  if v_company_b is null then
    raise notice 'Company B tidak ditemukan -- pembersihan dilewati (no-op).';
    return;
  end if;

  delete from customer_delivery_addresses
    where customer_id in (select customer_id from customers where company_id = v_company_b);
  delete from supplier_item_prices where company_id = v_company_b;
  delete from suppliers where company_id = v_company_b;
  delete from customers where company_id = v_company_b;

  -- Jejak status milik shipment yang sudah tidak ada.
  delete from status_transition_log
    where company_id = v_company_b
      and table_name = 'shipments'
      and not exists (select 1 from shipments s where s.shipment_id = status_transition_log.record_id);

  raise notice 'Sisa fixture verifikasi Company B dibersihkan (company_id=%)', v_company_b;
end $$;
