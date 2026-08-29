-- PJL-03 -- PENYELESAIAN SALES ORDER: tabel konfirmasi, transisi, dan kategori alasan.
--
-- ATURAN BISNIS YANG DITEGAKKAN (dikunci pemilik produk 29 Agu 2026):
--   PENYELESAIAN = PEMENUHAN, BUKAN PEMBAYARAN
--     -> Sales Order boleh selesai meski pelanggan masih menunggak. Nol syarat pembayaran
--        di seluruh berkas ini, dan itu disengaja.
--   NOL TOLERANSI KURANG-KIRIM
--     -> 9.800 dari 10.000 bukan "hampir selesai", melainkan BELUM selesai.
--   DUA KONFIRMASI, DUA DEPARTEMEN
--     -> PPIC mengonfirmasi pemenuhan; Manager/GM menutup. Satu pengguna satu peran,
--        jadi keduanya TIDAK MUNGKIN orang yang sama.
--
-- YANG SENGAJA TIDAK DILAKUKAN DI SINI:
--   nol kolom pembayaran, nol tabel Finance, nol status baru, nol peran baru, nol tabel log
--   baru. Jejaknya memakai status_transition_log yang sudah ada.

-- =============================================================================================
-- 1. TRANSISI YANG HILANG
-- =============================================================================================
-- Diukur 29 Agu 2026: status_transition_rules untuk sales_orders memuat empat baris, dan
-- `confirmed -> completed` BUKAN salah satunya. Sementara itu `in_production` TIDAK PERNAH
-- ditulis kode mana pun -- satu-satunya penulis status Sales Order adalah putuskan_pembatalan().
--
-- Tanpa baris ini, penutupan order MUSTAHIL meski tombolnya dibuat: trigger
-- enforce_status_transition akan menolaknya. Yang ditambahkan adalah SATU JALUR, bukan status
-- baru -- jadi AD-03 (kosakata status) tidak tersentuh dan tetap terbuka.
insert into status_transition_rules (table_name, from_status, to_status)
select 'sales_orders', 'confirmed', 'completed'
where not exists (
  select 1 from status_transition_rules
  where table_name = 'sales_orders' and from_status = 'confirmed' and to_status = 'completed'
);

-- =============================================================================================
-- 2. TEMPAT MEREKAM DUA KONFIRMASI
-- =============================================================================================
-- Bentuknya menyalin customer_po_approvals (persetujuan per DEPARTEMEN) ditambah snapshot
-- pelaku dan kategori alasan seperti cancellation_requests. Keduanya cetakan yang sudah ada;
-- ini BUKAN sistem persetujuan kedua.
--
-- KENAPA PERLU TABEL, bukan cukup status_transition_log: konfirmasi PPIC TIDAK mengubah status
-- apa pun. Tidak ada transisi untuk dicatat, jadi tidak ada barisnya di log transisi. Persoalan
-- yang sama sudah pernah diselesaikan begini di cancellation_requests.
create table if not exists sales_order_completion_approvals (
  sales_order_completion_approval_id serial primary key,
  company_id integer not null references companies(company_id),
  sales_order_id integer not null references sales_orders(sales_order_id),

  -- Departemen, bukan peran -- persis seperti customer_po_approvals. Peran boleh berubah
  -- kelak; yang tidak berubah adalah departemen mana yang berwenang.
  department text not null check (department in ('ppic', 'manager')),

  approved_by integer not null references users(user_id),
  approver_name_snapshot text not null,
  approver_role_snapshot text not null,
  approved_at timestamptz not null default now(),

  reason_category text not null,
  notes text,

  -- BUKTI, dan sekaligus PENJAGA DATA BASI.
  -- Isinya keadaan pemenuhan PERSIS saat dikonfirmasi. Saat penutupan, keadaan dihitung ulang
  -- dan dibandingkan dengan cuplikan ini; bila berbeda, penutupan DITOLAK.
  -- Tanpa ini, pengiriman yang berubah setelah konfirmasi PPIC akan lolos tanpa berbunyi.
  fulfillment_snapshot jsonb not null,

  -- Satu konfirmasi per departemen per Sales Order. Konfirmasi ulang menimpa yang lama
  -- lewat fungsi (bukan lewat baris kedua), supaya cuplikannya selalu yang terbaru.
  unique (sales_order_id, department)
);

create index if not exists sales_order_completion_approvals_per_so
  on sales_order_completion_approvals (sales_order_id);

comment on table sales_order_completion_approvals is
  'Konfirmasi menuju penutupan Sales Order: departemen ppic mengonfirmasi pemenuhan, departemen manager menutup. Bentuknya menyalin customer_po_approvals + snapshot pelaku ala cancellation_requests. fulfillment_snapshot adalah penjaga data basi, bukan sekadar catatan. PENYELESAIAN TIDAK BERGANTUNG PEMBAYARAN (aturan bisnis 29 Agu 2026).';

alter table sales_order_completion_approvals enable row level security;

-- IDEMPOTEN: migrasi yang gagal saat dijalankan ulang akan menggigit persis saat ia paling
-- dibutuhkan -- saat memulihkan basis data dari nol (INF-28).
drop policy if exists sales_order_completion_approvals_select_for_company on sales_order_completion_approvals;
create policy sales_order_completion_approvals_select_for_company
  on sales_order_completion_approvals for select
  using (company_id = public.jwt_company_id());

-- Menulis HANYA lewat fungsi kanonik -- nol kebijakan tulis, disengaja.

-- =============================================================================================
-- 3. KATEGORI ALASAN
-- =============================================================================================
-- Terikat departemen, sehingga alasan yang tercatat benar-benar mencerminkan siapa yang
-- memutuskan -- bukan sekadar pilihan yang kebetulan tersedia di layar.
insert into decision_reason_categories (entity, action, department, code, label, requires_note, sort_order)
select v.entity, v.action, v.department, v.code, v.label, v.requires_note, v.sort_order
from (values
  ('sales_orders', 'fulfillment_confirm', 'ppic',    'pemenuhan_lengkap',      'Pemenuhan lengkap — seluruh barang sudah diproduksi dan dikirim', false, 10),
  ('sales_orders', 'fulfillment_confirm', 'ppic',    'lainnya',                'Lainnya (wajib diisi catatan)',                                  true,  90),
  ('sales_orders', 'completion',          'manager', 'pemenuhan_terverifikasi','Pemenuhan terverifikasi — order ditutup',                        false, 10),
  ('sales_orders', 'completion',          'manager', 'sisa_dibatalkan_sah',    'Sisa komitmen sudah dibatalkan secara sah',                      false, 20),
  ('sales_orders', 'completion',          'manager', 'lainnya',                'Lainnya (wajib diisi catatan)',                                  true,  90)
) as v(entity, action, department, code, label, requires_note, sort_order)
where not exists (
  select 1 from decision_reason_categories d
  where d.entity = v.entity and d.action = v.action and d.code = v.code
);
