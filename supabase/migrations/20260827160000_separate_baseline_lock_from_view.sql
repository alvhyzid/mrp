-- Migration: pisahkan MEMBACA dari MENGUNCI baseline (Sesi 0C, 21 Agu 2026).
-- Lihat HANDOFF.md Sesi 0/0B/0C untuk laporan penyelidikan lengkap. Ringkas:
-- getMarginWatch.ts/getPlanningFeasibility.ts SEBELUMNYA mengunci baseline
-- secara *lazy* pada panggilan pertama (desain sengaja, terdokumentasi di
-- docs/rancangan-skema-database-mrp.md baris 307/312) -- TAPI aksi ini
-- terpicu oleh tombol yang LABELnya terdengar seperti "lihat" ("Cek
-- Kelayakan"/"Margin Watch"), dan TERBUKTI bisa dipicu role tanpa kewenangan
-- finansial (ppic_staff). Migrasi ini membuat MEMBACA (menghitung & menampilkan
-- angka) tidak PERNAH lagi menulis apa pun -- penguncian jadi aksi terpisah,
-- eksplisit, bergerbang peran finansial, dan bergerbang kelengkapan data biaya.
--
-- Skema: unique(sales_order_line_id) LAMA diganti unique index PARSIAL (hanya
-- 1 baris AKTIF/belum-diarsipkan per baris SO) -- supaya company_admin bisa
-- "kunci ulang" (relock) tanpa menghapus baseline lama (Doktrin 7: arsipkan,
-- jangan hard-delete data yang direferensikan).

alter table if exists sales_order_line_margin_snapshots
  add column if not exists archived_at timestamptz,
  add column if not exists archived_reason text,
  add column if not exists locked_by integer references users(user_id),
  add column if not exists relock_reason text;

alter table if exists sales_order_line_feasibility_snapshots
  add column if not exists archived_at timestamptz,
  add column if not exists archived_reason text,
  add column if not exists locked_by integer references users(user_id),
  add column if not exists relock_reason text;

-- Unique constraint lama (dari CREATE TABLE asli) diganti unique index parsial.
alter table if exists sales_order_line_margin_snapshots
  drop constraint if exists sales_order_line_margin_snapshots_sales_order_line_id_key;
create unique index if not exists sales_order_line_margin_snapshots_active_unique
  on sales_order_line_margin_snapshots (sales_order_line_id)
  where archived_at is null;

alter table if exists sales_order_line_feasibility_snapshots
  drop constraint if exists sales_order_line_feasibility_snapshots_sales_order_line_id_key;
create unique index if not exists sales_order_line_feasibility_snapshots_active_unique
  on sales_order_line_feasibility_snapshots (sales_order_line_id)
  where archived_at is null;

-- ═══ RLS: aksi MENGUNCI (insert) & MENGARSIPKAN (update archived_at) HANYA
-- role berkewenangan finansial (0C.3 -- eksplisit, termasuk untuk feasibility
-- yang SEBELUMNYA ikut mengizinkan ppic_manager/ppic_staff/production_manager
-- menulis; keputusan produk baru ini SENGAJA mempersempitnya). SELECT tetap
-- terbuka untuk role viewer masing-masing panel (tidak berubah). ═══
drop policy if exists sales_order_line_margin_snapshots_insert on sales_order_line_margin_snapshots;
create policy sales_order_line_margin_snapshots_insert on sales_order_line_margin_snapshots
  for insert with check (
    company_id = public.jwt_company_id()
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('finance_manager'))
  );

drop policy if exists sales_order_line_margin_snapshots_update on sales_order_line_margin_snapshots;
create policy sales_order_line_margin_snapshots_update on sales_order_line_margin_snapshots
  for update using (
    company_id = public.jwt_company_id()
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('finance_manager'))
  )
  with check (
    company_id = public.jwt_company_id()
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('finance_manager'))
  );

drop policy if exists sales_order_line_feasibility_snapshots_write on sales_order_line_feasibility_snapshots;
create policy sales_order_line_feasibility_snapshots_insert on sales_order_line_feasibility_snapshots
  for insert with check (
    company_id = public.jwt_company_id()
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('finance_manager'))
  );

drop policy if exists sales_order_line_feasibility_snapshots_update on sales_order_line_feasibility_snapshots;
create policy sales_order_line_feasibility_snapshots_update on sales_order_line_feasibility_snapshots
  for update using (
    company_id = public.jwt_company_id()
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('finance_manager'))
  )
  with check (
    company_id = public.jwt_company_id()
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('finance_manager'))
  );

-- ═══ 0C.6: bersihkan baris company_id=1 (PT ITM) yang terbukti lahir dari
-- klik verifikasi Claude Code, BUKAN dari penilaian bisnis pemilik produk
-- sungguhan (lihat forensik lengkap di HANDOFF.md Sesi 0C: margin snapshot
-- created_at 2026-08-21T02:43:14Z & feasibility snapshot created_at
-- 2026-08-20T15:44:17Z, keduanya berkorelasi persis dengan sesi kerja
-- verifikasi visual, bukan aktivitas order riil -- SO ini statusnya baru
-- "confirmed", belum pernah dikirim/diputuskan apa pun berdasarkan baseline
-- ini). Idempoten: kalau baris sudah tidak ada (mis. migrasi ini di-replay),
-- raise notice dan selesai, bukan error. ═══
do $$
declare
  v_company_id integer;
  v_deleted_margin integer;
  v_deleted_feasibility integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then
    raise notice 'Perusahaan PT ITM tidak ditemukan -- pembersihan dilewati (no-op).';
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
  get diagnostics v_deleted_margin = row_count;
  raise notice 'Baris sales_order_line_margin_snapshots MLVT (artefak verifikasi) dihapus: % (0 kalau sudah bersih -- idempoten)', v_deleted_margin;

  delete from sales_order_line_feasibility_snapshots
  where company_id = v_company_id
    and sales_order_line_id in (
      select sol.sales_order_line_id
      from sales_order_lines sol
      join items i on i.item_id = sol.item_id
      where i.company_id = v_company_id and i.item_code = 'MLVT-BOX/001ITM'
    );
  get diagnostics v_deleted_feasibility = row_count;
  raise notice 'Baris sales_order_line_feasibility_snapshots MLVT (id=282, artefak verifikasi) dihapus: % (0 kalau sudah bersih -- idempoten)', v_deleted_feasibility;
end $$;
