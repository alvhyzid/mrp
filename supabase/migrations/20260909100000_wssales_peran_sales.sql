-- WS-SALES-ROLE — peran `sales` sebagai peran tersendiri (keputusan pemilik produk).
--
-- ============================================================================
-- ARSITEKTUR PERAN DI FABRIX — DISENSUS DULU, BUKAN DIASUMSIKAN
-- ============================================================================
-- Perintah eksekusi §12 melarang menulis `if role === "sales"` bila sudah ada
-- arsitektur izin kanonik. Disensus 29 Agu 2026, dan hasilnya menentukan seluruh
-- bentuk pekerjaan ini:
--
--   tabel roles           -> TIDAK ADA
--   tabel permissions     -> TIDAK ADA
--   tabel role_permissions-> TIDAK ADA
--   tabel departments     -> TIDAK ADA
--
-- Yang ADA: satu kolom teks `users.role` berkekangan CHECK, ditambah predikat di
-- src/lib/roles.ts (diimpor 113 berkas) dan perbandingan jwt_app_role() di dalam
-- kebijakan RLS serta fungsi basis data.
--
-- Jadi TIDAK ADA arsitektur izin yang lebih kanonik untuk dipakai. Nama peran ITULAH
-- mekanisme kanoniknya. Membuat tabel izin baru di sini justru akan melanggar aturan
-- yang lebih keras: dilarang membangun sistem identitas/peran/izin PARALEL.
--
-- Konsekuensi yang dilaporkan, bukan disembunyikan: FABRIX tidak membedakan PERAN dan
-- DEPARTEMEN (§9). Departemen diturunkan dari peran (canApproveDepartment,
-- jwt_decision_department). Memisahkan keduanya adalah perubahan arsitektur tersendiri
-- yang TIDAK dikerjakan di sini.
--
-- ============================================================================
-- YANG DIUBAH DAN YANG SENGAJA TIDAK
-- ============================================================================
-- DIUBAH : daftar nilai sah users.role -- BERTAMBAH satu, nol nilai dibuang.
-- DIUBAH : jwt_decision_department() -- `sales` dikenali sebagai departemen keputusan.
-- DITAMBAH: kategori alasan tahan/lepas untuk departemen `sales`.
--
-- TIDAK DIUBAH: arti `admin_staff` -- nol baris, nol predikat, nol kebijakan yang
--   menyangkutnya disentuh. `admin_staff` BUKAN Sales, dan tetap seperti sebelumnya.
-- TIDAK DIUBAH: satu pun pengguna nyata. Membuat PERAN bukan menugaskan ORANG.
--   Terukur sebelum migrasi: 7 pengguna nyata (admin_staff 1, company_admin 2,
--   finance_manager 1, hr_manager 1, ppic_manager 1, production_staff 1,
--   warehouse_manager 1) -- dan tak satu pun dipindahkan.
-- TIDAK DIBERIKAN ke Sales: wewenang persetujuan Finance/PPIC/Manager, mutasi
--   produksi, mutasi pengiriman, mutasi keuangan, disposisi mutu, dan formula/BOM.

-- 1) Daftar peran: BERTAMBAH, tidak ada yang dibuang.
alter table users drop constraint if exists users_role_check;
alter table users add constraint users_role_check check (
  role = any (array[
    'super_admin', 'company_admin', 'general_manager', 'admin_staff',
    'production_manager', 'production_staff',
    'ppic_manager', 'ppic_staff',
    'finance_manager', 'finance_staff',
    'purchasing_manager', 'purchasing_staff',
    'warehouse_manager', 'warehouse_staff',
    'hr_manager', 'hr_staff',
    'sales',
    'viewer'
  ])
);

-- 2) Departemen keputusan: `sales` dikenali.
--
-- BD-06 menyebut Sales sebagai salah satu departemen yang boleh MENAHAN PO klien.
-- Sampai sekarang aturan itu tidak bisa ditegakkan karena tidak ada peran yang
-- mewakilinya -- dan itulah yang dibuka di sini.
--
-- PERHATIKAN URUTANNYA: `sales` diperiksa SEBELUM jwt_is_company_leadership().
-- Tanpa itu, seorang pimpinan yang juga berperan Sales akan terbaca 'manager'.
-- Di sini tidak mungkin terjadi karena satu pengguna hanya punya satu peran, tetapi
-- urutannya ditulis eksplisit supaya tetap benar bila kelak peran bisa ganda.
create or replace function public.jwt_decision_department()
returns text
language sql
stable
as $$
  select case
    when public.jwt_app_role() = 'finance_manager' then 'finance'
    when public.jwt_app_role() = 'ppic_manager' then 'ppic'
    when public.jwt_app_role() = 'sales' then 'sales'
    when public.jwt_is_company_leadership() then 'manager'
    else null
  end;
$$;

comment on function public.jwt_decision_department() is
  'Departemen keputusan pengguna yang login, diturunkan dari perannya. MENYALIN canApproveDepartment() di src/lib/roles.ts, ditambah sales (WS-SALES-ROLE). Bila salah satunya berubah, keduanya wajib ikut.';

revoke execute on function public.jwt_decision_department() from public;
revoke execute on function public.jwt_decision_department() from anon;
grant execute on function public.jwt_decision_department() to authenticated;

-- 3) Kategori alasan milik departemen Sales.
--
-- Tanpa ini, Sales punya wewenang menahan tetapi TIDAK punya satu pun alasan yang
-- boleh dipilihnya -- yaitu tombol yang ada dan tidak bisa dipakai, bentuk cacat yang
-- sudah berulang di proyek ini.
insert into decision_reason_categories (entity, action, department, code, label, requires_note, sort_order) values
  ('customer_purchase_orders', 'hold', 'sales', 'informasi_pelanggan_kurang', 'Informasi pelanggan belum lengkap',   false, 110),
  ('customer_purchase_orders', 'hold', 'sales', 'spesifikasi_bermasalah',     'Spesifikasi produk bermasalah',       false, 120),
  ('customer_purchase_orders', 'hold', 'sales', 'harga_bermasalah',           'Harga belum disepakati',              false, 130),
  ('customer_purchase_orders', 'hold', 'sales', 'permintaan_pelanggan',       'Diminta pelanggan',                   false, 140),
  ('customer_purchase_orders', 'release', 'sales', 'informasi_lengkap',       'Informasi pelanggan sudah lengkap',   false, 80),
  ('customer_purchase_orders', 'release', 'sales', 'spesifikasi_disepakati',  'Spesifikasi sudah disepakati',        false, 90),
  ('customer_purchase_orders', 'release', 'sales', 'harga_disepakati',        'Harga sudah disepakati',              false, 100)
on conflict (entity, action, code) do nothing;

-- 4) RLS baris PO klien: Sales ikut, karena Sales mendaftarkan PO klien.
--
-- Jalur aplikasi memakai service role sehingga tidak bergantung kebijakan ini, tetapi
-- membiarkannya tertinggal akan mengulang persis cacat sales_order_lines: lapis kedua
-- yang tidak ikut diperbarui, dan ketidakhadirannya TIDAK BERBUNYI.
drop policy if exists customer_po_lines_write_ppic on public.customer_purchase_order_lines;
create policy customer_po_lines_write_ppic
  on public.customer_purchase_order_lines
  for all
  using (
    exists (
      select 1 from customer_purchase_orders cpo
      where cpo.customer_purchase_order_id = customer_purchase_order_lines.customer_purchase_order_id
        and cpo.company_id = public.jwt_company_id()
    )
    and (
      public.jwt_is_company_leadership()
      or public.jwt_app_role() = any (array['ppic_manager', 'ppic_staff', 'admin_staff', 'sales'])
    )
  )
  with check (
    exists (
      select 1 from customer_purchase_orders cpo
      where cpo.customer_purchase_order_id = customer_purchase_order_lines.customer_purchase_order_id
        and cpo.company_id = public.jwt_company_id()
    )
    and (
      public.jwt_is_company_leadership()
      or public.jwt_app_role() = any (array['ppic_manager', 'ppic_staff', 'admin_staff', 'sales'])
    )
  );
