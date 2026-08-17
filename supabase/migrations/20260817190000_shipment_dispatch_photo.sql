-- Migration: Foto Bukti Pengiriman (dispatch) — WAJIB diupload staff SAAT transisi
-- draft->shipped ("Proses Pengiriman" di UI), SEBELUM stok berkurang. Ini foto dari
-- sisi INTERNAL (staff gudang saat memuat/mengirim barang) — BEDA dari
-- delivery_confirmations.photo_url (Sesi 3, foto dari sisi CUSTOMER lewat halaman
-- publik Bukti Penerimaan saat menerima barang, belum dibangun).

alter table if exists shipments add column if not exists dispatch_photo_url text;

-- Public read (dipakai langsung lewat <img src>, sama seperti pola bucket lain di
-- proyek ini) — write lewat service-role di server (processShipmentDispatch.ts),
-- policy di sini defense-in-depth kalau ada jalur client langsung nanti. Folder
-- dibatasi per company_id + role yang sama dengan shipments_write_warehouse
-- (migration 20260812155000).
insert into storage.buckets (id, name, public)
values ('shipment-dispatch-photos', 'shipment-dispatch-photos', true)
on conflict (id) do nothing;

drop policy if exists shipment_dispatch_photos_public_read on storage.objects;
create policy shipment_dispatch_photos_public_read on storage.objects
  for select using (bucket_id = 'shipment-dispatch-photos');

drop policy if exists shipment_dispatch_photos_warehouse_write on storage.objects;
create policy shipment_dispatch_photos_warehouse_write on storage.objects
  for insert to authenticated with check (
    bucket_id = 'shipment-dispatch-photos'
    and (storage.foldername(name))[1] = public.jwt_company_id()::text
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('warehouse_manager', 'warehouse_staff', 'ppic_manager'))
  );

-- TIDAK ADA policy update/delete — shipment hanya melewati transisi draft->shipped
-- SEKALI, foto ini tidak pernah perlu diganti/dihapus setelah tercatat.
