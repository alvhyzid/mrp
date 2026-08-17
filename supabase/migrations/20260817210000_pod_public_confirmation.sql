-- Migration: Sesi 3 — Halaman publik Bukti Penerimaan (Proof of Delivery, /pod/[token]).
-- INI HALAMAN PERTAMA di seluruh sistem yang diakses TANPA login sama sekali — semua
-- keputusan di bawah ini dibuat dengan asumsi pengunjung TIDAK PUNYA JWT/session apa
-- pun, jadi RLS berbasis jwt_company_id() TIDAK RELEVAN untuk permukaan ini. Keamanan
-- di sini bertumpu pada 2 hal: (1) pod_token acak tidak bisa ditebak (gen_random_uuid(),
-- sudah ada sejak migration 20260817140000), (2) SEMUA jalur tulis (foto + transisi
-- status) HANYA lewat service-role di app-layer (confirmDelivery.ts) yang memvalidasi
-- token+status shipped dulu — TIDAK ADA policy insert untuk anon/authenticated di
-- storage bucket maupun tabel delivery_confirmations (tabel itu sendiri sudah
-- TIDAK PUNYA policy insert sejak migration 20260817180000, konsisten di sini).

-- (a) Bucket foto bukti penerimaan — public read (foto ditampilkan lagi ke staf
-- internal lewat panel detail Shipments nanti, pola sama seperti shipment-dispatch-
-- photos), TAPI SENGAJA TIDAK ADA policy insert/update/delete SAMA SEKALI untuk role
-- apa pun (anon MAUPUN authenticated) — beda dari bucket lain di proyek ini yang
-- masih punya policy insert 'authenticated' sebagai defense-in-depth. Di sini TIDAK
-- ADA pengunjung authenticated yang legal menulis (pengunjung publik tidak login),
-- jadi policy insert 'authenticated' justru jadi CELAH (staf internal mana pun bisa
-- upload sembarang file ke bucket publik ini tanpa lewat validasi pod_token).
-- Satu-satunya jalur tulis yang sah adalah service-role dari confirmDelivery.ts.
insert into storage.buckets (id, name, public)
values ('delivery-confirmation-photos', 'delivery-confirmation-photos', true)
on conflict (id) do nothing;

drop policy if exists delivery_confirmation_photos_public_read on storage.objects;
create policy delivery_confirmation_photos_public_read on storage.objects
  for select using (bucket_id = 'delivery-confirmation-photos');

-- (b) Fungsi atomik: transisi shipped->delivered + insert delivery_confirmations
-- dalam 1 transaksi. "for update" mengunci baris shipments yang cocok — kalau 2
-- submit terjadi hampir bersamaan dengan pod_token yang SAMA, submit kedua akan
-- menunggu submit pertama commit, lalu WHERE status='shipped' tidak lagi cocok
-- (statusnya sudah 'delivered') sehingga v_shipment_id null dan submit kedua
-- DITOLAK — token otomatis tidak bisa dipakai ulang, tanpa perlu tabel/flag terpisah.
create or replace function public.confirm_delivery(
  p_pod_token text,
  p_photo_url text,
  p_received_by_name text
)
returns table (out_shipment_id integer)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_shipment_id integer;
begin
  select shipment_id into v_shipment_id
  from shipments
  where pod_token = p_pod_token and status = 'shipped'
  for update;

  if v_shipment_id is null then
    raise exception 'Token tidak valid atau pengiriman sudah dikonfirmasi sebelumnya.'
      using errcode = '23514';
  end if;

  if p_photo_url is null or length(trim(p_photo_url)) = 0 then
    raise exception 'Foto bukti penerimaan wajib diunggah.'
      using errcode = '23514';
  end if;

  insert into delivery_confirmations (shipment_id, photo_url, received_by_name)
  values (v_shipment_id, p_photo_url, p_received_by_name);

  -- enforce_status_transition() (trigger BEFORE UPDATE OF status yang sudah ada
  -- sejak migration 20260817140000/20260817200000) tetap jalan APA ADANYA di sini —
  -- memvalidasi shipped->delivered lewat status_transition_rules + mencatat
  -- status_transition_log, TIDAK direstrukturisasi/dilewati sama sekali.
  update shipments set status = 'delivered' where shipment_id = v_shipment_id;

  return query select v_shipment_id;
end;
$$;
