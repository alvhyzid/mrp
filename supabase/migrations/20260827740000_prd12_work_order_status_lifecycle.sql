-- PRD-12 -- Work Order status jadi hidup. Keputusan final pemilik produk
-- (22 Agu 2026): planned->in_progress OTOMATIS saat batch pertama dimulai;
-- ->completed MANUAL oleh PPIC/supervisor; ->paused/cancelled MANUAL wajib
-- alasan. Batch baru pada WO completed/cancelled DITOLAK DI DATABASE
-- (bukan diperingatkan) -- jalan keluar: company_admin/manajer produksi
-- membuka kembali WO dengan alasan wajib+tercatat, riwayat APPEND-ONLY.
--
-- Trigger enforce_status_transition() SUDAH terpasang di work_orders sejak
-- migrasi 20260817100000 -- baris di bawah HANYA menambah 2 rute baru
-- (reopen), rute maju (planned->in_progress dst) SUDAH ada sejak awal.
insert into public.status_transition_rules (table_name, from_status, to_status) values
  ('work_orders', 'completed', 'in_progress'),
  ('work_orders', 'cancelled', 'in_progress');

create table if not exists public.work_order_reopen_log (
  work_order_reopen_log_id serial primary key,
  company_id integer not null references public.companies(company_id),
  work_order_id integer not null references public.work_orders(work_order_id),
  previous_status text not null,
  reopened_by integer not null references public.users(user_id),
  reopened_at timestamptz not null default now(),
  reason text not null check (length(trim(reason)) > 0)
);
create index if not exists work_order_reopen_log_wo_id_idx on public.work_order_reopen_log (work_order_id);

alter table public.work_order_reopen_log enable row level security;

drop policy if exists work_order_reopen_log_select_for_company on public.work_order_reopen_log;
create policy work_order_reopen_log_select_for_company on public.work_order_reopen_log
  for select using (company_id = public.jwt_company_id());
-- TIDAK ADA policy insert/update/delete untuk authenticated/anon SAMA SEKALI --
-- satu-satunya jalur tulis adalah endpoint aplikasi lewat service-role
-- (pola sama seperti build_task_urgency_history). Append-only ditegakkan
-- dengan TIDAK adanya jalur update/delete apa pun, bahkan dari service-role
-- (tidak ada kode aplikasi yang pernah melakukan itu).
