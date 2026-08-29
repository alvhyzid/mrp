-- DEC-S05 — PAYMENT TERMS + PAYMENT OBLIGATION.
--
-- ============================================================================
-- TEMUAN YANG MENENTUKAN SELURUH BENTUK PEKERJAAN INI (§3, §40)
-- ============================================================================
-- Perintah eksekusi menyatakan: ACTUAL PAYMENT -> Finance, RECEIVABLE -> Finance,
-- dan status pembayaran DITURUNKAN dari catatan keuangan kanonik.
--
-- Disensus 29 Agu 2026 terhadap seluruh 101 tabel: DOMAIN FINANCE UNTUK PIUTANG
-- PELANGGAN TIDAK ADA SAMA SEKALI.
--
--   tabel payments        -> NIHIL
--   tabel receivables     -> NIHIL
--   tabel ledger/journal  -> NIHIL
--   tabel jatuh tempo     -> NIHIL
--   invoices              -> ADA, tetapi FK-nya ke subscription_plans dan kolomnya
--                            period_start/period_end/payment_gateway_ref. Itu FABRIX
--                            MENAGIH TENANT-nya, BUKAN tenant menagih pelanggan.
--                            Nol kolom customer_id. Nol pemakai di kode aplikasi.
--
-- KONSEKUENSINYA, dan ini ARCHITECTURE GAP yang dilaporkan bukan ditambal:
-- tidak ada catatan pembayaran yang bisa dijadikan sumber penurunan status. Karena itu
-- migrasi ini SENGAJA TIDAK membuat tabel pembayaran maupun piutang -- §40 melarangnya
-- tegas: "Do not invent a parallel Finance system."
--
-- Yang dibangun HANYA dua hal yang memang milik komersial:
--   PAYMENT TERMS      -- aturan pembayaran yang bisa dipakai ulang
--   PAYMENT OBLIGATION -- komitmen berapa dan kapan, MILIK TRANSAKSI
--
-- Keduanya BUKAN pembayaran. Keduanya BUKAN piutang.
--
-- ============================================================================
-- TIGA HAL YANG TIDAK DITEBAK (§17, §18, §25) -- jawabannya dari pengukuran
-- ============================================================================
-- MATA UANG (§17): nol kolom currency/fx/exchange di seluruh skema. Sistem ini
--   SATU MATA UANG (IDR). Kewajiban memakai mata uang transaksi yang sama, dan
--   TIDAK membangun sistem mata uang kedua. Multi-currency = gap terbuka.
--
-- PAJAK (§18): nol kolom tax/ppn/discount di seluruh skema. Karena itu persentase
--   hanya bisa berlaku atas SATU-SATUNYA nilai yang ada -- total baris Sales Order
--   (qty x unit_price). Bila kelak pajak ada, dasar perhitungannya WAJIB diputuskan
--   ulang; dicatat sebagai OPEN BUSINESS RULE, bukan dianggap sudah dijawab.
--
-- PRESISI (§25): uang di sistem ini numeric(14,4) -- unit_price, qty_ordered,
--   snapshot margin, seluruhnya. Kewajiban memakai presisi YANG SAMA, bukan yang baru.
--
-- PEMBULATAN (§25): tidak ada mekanisme pembulatan kanonik untuk dipakai ulang.
--   §25 sendiri menetapkan kriteria terimanya: "obligations reconcile exactly with
--   transaction total". Satu-satunya cara memenuhinya saat persentase tidak habis
--   dibagi adalah LANGKAH TERAKHIR MENYERAP SISANYA. Itu yang diterapkan, dan itu
--   ATURAN YANG DIPILIH -- bukan perilaku yang ditemukan.
--
-- PEMICU "SEBELUM KIRIM" (§19): TIDAK dikarang. Dibaca dari mesin status pengiriman
--   yang sudah ada: draft -> shipped. Jadi "sebelum pengiriman" berarti sebelum
--   perpindahan itu. Payment Terms TIDAK memiliki status pengiriman.

create table if not exists payment_terms (
  payment_term_id serial primary key,
  company_id integer not null references companies(company_id),
  name text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, name)
);

comment on table payment_terms is
  'Aturan pembayaran yang bisa dipakai ulang (DEC-S05). BUKAN pembayaran, BUKAN piutang. Milik domain komersial/Sales.';

-- Pemicu diambil dari peristiwa yang BENAR-BENAR ADA di sistem ini, bukan dikarang.
-- konfirmasi_order : Sales Order berstatus confirmed (ada hari ini)
-- sebelum_kirim    : sebelum transisi shipments draft -> shipped (ada hari ini)
-- sebelum_produksi : sebelum Work Order mulai (ada hari ini)
-- setelah_kirim_n_hari : jatuh tempo relatif setelah pengiriman
create table if not exists payment_term_steps (
  payment_term_step_id serial primary key,
  payment_term_id integer not null references payment_terms(payment_term_id) on delete cascade,
  sequence_no integer not null,
  label text not null,
  -- SALAH SATU: persentase ATAU nominal tetap. Kekangan di bawah menegakkannya,
  -- supaya tidak ada baris yang punya keduanya atau tidak punya keduanya.
  percentage numeric(9,4),
  fixed_amount numeric(14,4),
  trigger_event text not null check (trigger_event in ('konfirmasi_order', 'sebelum_produksi', 'sebelum_kirim', 'setelah_kirim_n_hari')),
  due_offset_days integer,
  unique (payment_term_id, sequence_no),
  constraint payment_term_steps_satu_dasar check (
    (percentage is not null and fixed_amount is null)
    or (percentage is null and fixed_amount is not null)
  ),
  constraint payment_term_steps_persentase_masuk_akal check (percentage is null or (percentage > 0 and percentage <= 100)),
  constraint payment_term_steps_nominal_positif check (fixed_amount is null or fixed_amount > 0)
);

comment on table payment_term_steps is
  'Tahap pembayaran di dalam satu Payment Term. Boleh persentase ATAU nominal tetap, tidak boleh keduanya -- ditegakkan kekangan, bukan diserahkan ke kode.';

-- ============================================================================
-- KEWAJIBAN PEMBAYARAN — MILIK TRANSAKSI, BEKU
-- ============================================================================
-- Tiap baris adalah SNAPSHOT: label, persentase, dan nominal DIBEKUKAN saat terms
-- diterapkan ke Sales Order. Mengubah master kelak TIDAK mengubah baris ini -- itulah
-- syarat §8, dan bentuk inilah yang memenuhinya.
--
-- PERHATIKAN APA YANG TIDAK ADA DI SINI, dan itu disengaja:
--   nol kolom paid_amount, nol kolom payment_date, nol kolom status tersimpan.
-- Menambahkannya berarti membangun sumber kebenaran pembayaran KEDUA, dan hari ini
-- tidak ada satu pun catatan pembayaran untuk menurunkannya. Status yang tidak pernah
-- bisa dicapai adalah cacat, bukan persiapan.
create table if not exists sales_order_payment_obligations (
  sales_order_payment_obligation_id serial primary key,
  company_id integer not null references companies(company_id),
  sales_order_id integer not null references sales_orders(sales_order_id),
  sequence_no integer not null,

  payment_term_id integer references payment_terms(payment_term_id),
  payment_term_name_snapshot text not null,
  label_snapshot text not null,
  percentage_snapshot numeric(9,4),
  trigger_event_snapshot text not null,
  due_offset_days_snapshot integer,

  amount numeric(14,4) not null check (amount > 0),

  created_at timestamptz not null default now(),
  unique (sales_order_id, sequence_no)
);

comment on table sales_order_payment_obligations is
  'Komitmen pembayaran milik SATU Sales Order, DIBEKUKAN saat terms diterapkan (DEC-S05 §8). BUKAN catatan pembayaran dan BUKAN piutang -- keduanya milik Finance, yang di FABRIX BELUM ADA (lihat ARCHITECTURE GAP di migrasi ini).';

create index if not exists sales_order_payment_obligations_per_so
  on sales_order_payment_obligations (sales_order_id);

alter table payment_terms enable row level security;
alter table payment_term_steps enable row level security;
alter table sales_order_payment_obligations enable row level security;

drop policy if exists payment_terms_select_for_company on payment_terms;
create policy payment_terms_select_for_company
  on payment_terms for select using (company_id = public.jwt_company_id());

drop policy if exists payment_term_steps_select_for_company on payment_term_steps;
create policy payment_term_steps_select_for_company
  on payment_term_steps for select
  using (exists (
    select 1 from payment_terms pt
    where pt.payment_term_id = payment_term_steps.payment_term_id
      and pt.company_id = public.jwt_company_id()
  ));

drop policy if exists sales_order_payment_obligations_select_for_company on sales_order_payment_obligations;
create policy sales_order_payment_obligations_select_for_company
  on sales_order_payment_obligations for select using (company_id = public.jwt_company_id());

-- Menulis HANYA lewat fungsi kanonik. Nol kebijakan tulis -- disengaja, sama seperti
-- cancellation_requests: perubahan berdampak wajib lewat gerbang yang mencatat pelakunya.
