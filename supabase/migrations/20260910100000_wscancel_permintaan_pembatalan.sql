-- WS-SALES-CANCEL + WS-PO-HOLD — PERMINTAAN PEMBATALAN (BD-02, BD-03, BD-06, BD-07).
--
-- ============================================================================
-- §10 — DIAUDIT DULU: apakah sudah ada mekanisme "usulan -> keputusan"?
-- ============================================================================
-- SUDAH ADA, dan dipakai dua kali dengan bentuk yang sama:
--   production_standard_proposals : ..._id, company_id, <subjek>, status,
--                                   created_at, decided_by, decided_at
--   leave_requests                : ..._id, company_id, <subjek>, status,
--                                   requested_by, decided_by, decided_at
--
-- Tabel di bawah MENYALIN bentuk itu, bukan mengarang yang baru. Yang DITAMBAHKAN
-- adalah hal yang kedua tabel itu belum punya dan BD-07 mewajibkannya: snapshot
-- pelaku (nama, peran, departemen) dan kategori alasan.
--
-- SATU TABEL untuk DUA entitas (Sales Order dan PO Klien), berkunci entity+record_id --
-- menyalin pola decision_reason_categories. Membuat dua tabel terpisah untuk alur yang
-- identik justru akan melahirkan duplikasi yang dilarang.
--
-- ============================================================================
-- KENAPA BUKAN STATUS BARU DI sales_orders
-- ============================================================================
-- Alternatif yang terlihat lebih elegan: menambah status `cancellation_requested`
-- sehingga seluruh alur memakai status_transition_rules yang sudah ada.
--
-- DITOLAK, dan alasannya bukan selera: AD-03 -- keputusan tentang KOSAKATA STATUS
-- Sales Order -- masih TERBUKA, dan §41 perintah eksekusi menyatakan perubahan
-- arsitektur status berada di luar lingkup. Menambah status di sini akan mendahului
-- keputusan itu.
--
-- Bentuk yang dipilih TIDAK menyentuh sales_orders.status selama tahap permintaan.
-- Pembatalan akhirnya memakai transisi `confirmed -> cancelled` YANG SUDAH ADA. Jadi
-- ia tetap benar apa pun hasil AD-03.
--
-- ============================================================================
-- YANG TIDAK PERNAH DIHAPUS (§6, §7, §8, §37)
-- ============================================================================
-- Pembatalan HANYA mengubah status komersial Sales Order. Ia TIDAK menyentuh Work
-- Order, riwayat produksi, pemakaian bahan, riwayat persediaan, maupun pengiriman --
-- termasuk kuantitas yang sudah terkirim. Ditegakkan oleh bentuk fungsinya: satu
-- UPDATE pada satu kolom, dan nol DELETE di mana pun.

create table if not exists cancellation_requests (
  cancellation_request_id serial primary key,
  company_id integer not null references companies(company_id),
  entity text not null check (entity in ('sales_orders', 'customer_purchase_orders')),
  record_id integer not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'withdrawn')),

  requested_by integer references users(user_id),
  requester_name_snapshot text,
  requester_role_snapshot text,
  requester_department_snapshot text,
  requested_at timestamptz not null default now(),
  reason_category text not null,
  reason_note text,

  -- Keadaan EKSEKUSI saat permintaan diajukan. Inilah bahan tinjauan dampak (§6, §7):
  -- pemutus melihat apa yang SUDAH terjadi sebelum memutuskan, tanpa perlu alur
  -- tinjauan tersendiri yang belum diputuskan bentuknya.
  execution_snapshot jsonb,

  decided_by integer references users(user_id),
  decider_name_snapshot text,
  decider_role_snapshot text,
  decided_at timestamptz,
  decision_reason_category text,
  decision_note text
);

-- Satu permintaan terbuka per dokumen. Tanpa ini, Sales bisa mengajukan berkali-kali
-- dan pemutus tidak tahu mana yang berlaku.
create unique index if not exists cancellation_requests_satu_terbuka
  on cancellation_requests (entity, record_id) where status = 'pending';

create index if not exists cancellation_requests_per_dokumen
  on cancellation_requests (entity, record_id);

comment on table cancellation_requests is
  'Permintaan pembatalan untuk Sales Order dan PO Klien. Bentuknya menyalin production_standard_proposals/leave_requests, ditambah snapshot pelaku dan kategori alasan sesuai BD-07. PERMINTAAN BUKAN PEMBATALAN: baris di sini tidak mengubah status dokumen apa pun sampai diputuskan.';

alter table cancellation_requests enable row level security;

-- IDEMPOTEN: migrasi yang gagal saat dijalankan ulang akan menggigit persis saat ia
-- paling dibutuhkan -- saat memulihkan basis data dari nol (INF-28).
drop policy if exists cancellation_requests_select_for_company on cancellation_requests;
create policy cancellation_requests_select_for_company
  on cancellation_requests for select
  using (company_id = public.jwt_company_id());

-- Menulis HANYA lewat fungsi kanonik di bawah -- nol kebijakan tulis, disengaja.
-- Fungsi-fungsi itu security definer sehingga tetap bisa menulis.

-- Kategori alasan untuk kedua tindakan baru.
insert into decision_reason_categories (entity, action, department, code, label, requires_note, sort_order) values
  ('sales_orders', 'cancel_request', 'sales',   'permintaan_pelanggan',   'Diminta pelanggan',                    false, 10),
  ('sales_orders', 'cancel_request', 'sales',   'pembatalan_pelanggan',   'Pelanggan membatalkan pesanan',        false, 20),
  ('sales_orders', 'cancel_request', 'sales',   'spesifikasi_berubah',    'Spesifikasi berubah dan tidak disepakati', false, 30),
  ('sales_orders', 'cancel_request', 'sales',   'harga_tidak_disepakati', 'Harga tidak disepakati',               false, 40),
  ('sales_orders', 'cancel_request', null,      'lainnya',                'Lainnya',                              true,  999),

  ('sales_orders', 'cancel_decision', 'manager', 'disetujui_risiko_komersial', 'Disetujui — risiko komersial',    false, 10),
  ('sales_orders', 'cancel_decision', 'manager', 'disetujui_permintaan_pelanggan', 'Disetujui — permintaan pelanggan', false, 20),
  ('sales_orders', 'cancel_decision', 'manager', 'ditolak_sudah_produksi',     'Ditolak — produksi sudah berjalan', false, 30),
  ('sales_orders', 'cancel_decision', 'manager', 'ditolak_sudah_dikirim',      'Ditolak — sebagian sudah dikirim', false, 40),
  ('sales_orders', 'cancel_decision', null,      'lainnya',                    'Lainnya',                          true,  999),

  ('customer_purchase_orders', 'cancel_request', 'sales', 'permintaan_pelanggan', 'Diminta pelanggan',             false, 10),
  ('customer_purchase_orders', 'cancel_request', 'sales', 'pembatalan_pelanggan', 'Pelanggan membatalkan pesanan', false, 20),
  ('customer_purchase_orders', 'cancel_request', null,    'lainnya',              'Lainnya',                       true,  999)
on conflict (entity, action, code) do nothing;
