-- Migration: Kesiapan AI (Tenant-Facing) -- docs/spesifikasi-kesiapan-ai-tenant.md
-- BAGIAN 2. Katalog kemampuan AI + prasyarat terukur + gerbang per kemampuan.
-- TANPA LLM di sini -- murni skema + mesin pengukuran dari data nyata (lihat
-- src/features/ai-readiness/server/computeMetric.ts).
--
-- PENYIMPANGAN JUJUR dari spesifikasi:
-- 1. ai_capabilities/ai_capability_requirements dibuat GLOBAL (tanpa company_id),
--    bukan "bisa dikonfigurasi per tenant" seperti §1.4 -- baru ada SATU tenant
--    nyata (Indo Taste) saat ini, jadi kolom per-tenant-override utk threshold
--    belum dibangun (prinsip "jangan bangun abstraksi spekulatif utk tenant yang
--    belum ada"). Bisa ditambah company_id + fallback ke default global nanti
--    kalau tenant kedua benar-benar butuh ambang berbeda.
-- 2. Kemampuan "Advisor / saran tindakan" (§1.4 baris terakhir) TIDAK diseed --
--    prasyaratnya butuh "eval internal lulus ambang" dan tabel eval suite belum
--    ada sama sekali (butuh 30-50 soal+jawaban benar dari pemilik produk sendiri,
--    gate yang sama sudah tercatat di HANDOFF sbg blocker Fase 1-3 AI roadmap).
--    Per §7 STOP CONDITION: tidak membuat angka pengganti utk metric_key yang
--    tidak bisa dihitung -- jadi kemampuan ini dilewati, bukan diisi asal.
-- 3. quality.* (downtime_classified, ncr_root_cause) dari §1.5 JUGA dilewati --
--    tidak ada tabel downtime/NCR di skema saat ini (§2.2 dokumen sumber keliru
--    berasumsi tabel itu sudah ada). Dicatat di HANDOFF, bukan diproksi diam-diam
--    pakai tabel lain yang maknanya berbeda (mis. production_disruptions).

create table if not exists ai_capabilities (
  ai_capability_id serial primary key,
  code text not null unique,
  name text not null,
  description text not null,
  tier text not null check (tier in ('CORE', 'INSIGHT', 'COPILOT')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists ai_capability_requirements (
  ai_capability_requirement_id serial primary key,
  capability_id integer not null references ai_capabilities(ai_capability_id) on delete cascade,
  code text not null,
  label text not null,
  metric_key text not null,
  threshold numeric not null,
  comparator text not null check (comparator in ('GTE', 'LTE')),
  weight numeric not null default 100,
  is_blocking boolean not null default true,
  sort_order integer not null default 0,
  unique (capability_id, code)
);

-- Hasil evaluasi PER TENANT, dihitung ulang (bukan diketik manual) oleh
-- recomputeAiReadiness() -- lihat catatan "cache di render" di bawah.
create table if not exists ai_capability_status (
  ai_capability_status_id serial primary key,
  company_id integer not null references companies(company_id),
  capability_id integer not null references ai_capabilities(ai_capability_id) on delete cascade,
  readiness_percent numeric(5,2) not null,
  is_unlocked boolean not null,
  blocking_reasons jsonb not null default '[]'::jsonb,
  computed_at timestamptz not null default now(),
  unique (company_id, capability_id)
);
create index if not exists ai_capability_status_company_idx on ai_capability_status (company_id);

-- Pengecualian sadar (demo/uji coba) -- HANYA super_admin (staf platform kita,
-- bukan admin tenant), wajib beralasan + berbatas waktu (§3.3). Tidak ada UI
-- tenant yang mengarah ke tabel ini sama sekali.
create table if not exists ai_capability_overrides (
  ai_capability_override_id serial primary key,
  company_id integer not null references companies(company_id),
  capability_id integer not null references ai_capabilities(ai_capability_id) on delete cascade,
  unlocked_by integer not null references users(user_id),
  reason text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists ai_capability_overrides_company_idx on ai_capability_overrides (company_id);

-- Disiapkan sekarang, dipakai saat fitur AI benar-benar hidup (§3.6) -- belum
-- ada pemanggil (tidak ada fitur jawab-AI yang live), tapi skema+RLS sudah
-- siap supaya komponen AnswerBasis tidak menunggu migrasi baru nanti.
create table if not exists ai_answer_feedback (
  ai_answer_feedback_id serial primary key,
  company_id integer not null references companies(company_id),
  capability_id integer references ai_capabilities(ai_capability_id),
  user_id integer not null references users(user_id),
  question text not null,
  answer text not null,
  feedback_reason text,
  readiness_snapshot jsonb,
  created_at timestamptz not null default now()
);
create index if not exists ai_answer_feedback_company_idx on ai_answer_feedback (company_id);

alter table ai_capabilities enable row level security;
alter table ai_capability_requirements enable row level security;
alter table ai_capability_status enable row level security;
alter table ai_capability_overrides enable row level security;
alter table ai_answer_feedback enable row level security;

-- Katalog global: semua tenant baca, hanya super_admin tulis -- pola sama
-- persis dgn subscription_plans (20260811100000).
drop policy if exists ai_capabilities_select_auth on ai_capabilities;
create policy ai_capabilities_select_auth on ai_capabilities
  for select using (auth.role() = 'authenticated');
drop policy if exists ai_capabilities_write_super_admin on ai_capabilities;
create policy ai_capabilities_write_super_admin on ai_capabilities
  for all using (public.is_super_admin_user(auth.uid()::text))
  with check (public.is_super_admin_user(auth.uid()::text));

drop policy if exists ai_capability_requirements_select_auth on ai_capability_requirements;
create policy ai_capability_requirements_select_auth on ai_capability_requirements
  for select using (auth.role() = 'authenticated');
drop policy if exists ai_capability_requirements_write_super_admin on ai_capability_requirements;
create policy ai_capability_requirements_write_super_admin on ai_capability_requirements
  for all using (public.is_super_admin_user(auth.uid()::text))
  with check (public.is_super_admin_user(auth.uid()::text));

-- Status kesiapan: tenant boleh baca MILIKNYA SENDIRI saja (halaman ini
-- tenant-facing, §2.4 aturan RLS). Tidak ada policy insert/update utk
-- authenticated -- ditulis recomputeAiReadiness() lewat admin client.
drop policy if exists ai_capability_status_select_for_company on ai_capability_status;
create policy ai_capability_status_select_for_company on ai_capability_status
  for select using (company_id = public.jwt_company_id());

-- Override: HANYA super_admin, baik baca maupun tulis -- admin tenant (bahkan
-- company_admin) tidak boleh melihat ATAU membuat override tenant manapun.
drop policy if exists ai_capability_overrides_super_admin_only on ai_capability_overrides;
create policy ai_capability_overrides_super_admin_only on ai_capability_overrides
  for all using (public.is_super_admin_user(auth.uid()::text))
  with check (public.is_super_admin_user(auth.uid()::text));

-- Umpan balik: tenant boleh baca miliknya sendiri (leadership meninjau nanti);
-- insert lewat server function (siapa saja yg lihat jawaban AI boleh lapor
-- "jawaban ini salah"), bukan lewat policy authenticated langsung.
drop policy if exists ai_answer_feedback_select_for_company on ai_answer_feedback;
create policy ai_answer_feedback_select_for_company on ai_answer_feedback
  for select using (company_id = public.jwt_company_id());

-- Seed katalog kemampuan sesuai §1.4, KECUALI "Advisor / saran tindakan"
-- (lihat catatan penyimpangan #2 di atas file).
insert into ai_capabilities (code, name, description, tier, sort_order) values
  ('panel_asal_usul', 'Panel Asal-Usul', 'Setiap angka standar/hasil hitung menyertakan rumus, input, dan sumbernya. Tidak ada prasyarat -- selalu aktif.', 'CORE', 0),
  ('process_mining', 'Process Mining', 'Insight durasi & pola transisi status dari status_transition_log nyata.', 'INSIGHT', 1),
  ('copilot_data_pabrik', 'Copilot Data Pabrik', 'Tanya-jawab berbasis definisi kamus istilah pabrik Anda sendiri.', 'COPILOT', 2),
  ('narasi_laporan', 'Narasi & Laporan', 'Ringkasan naratif otomatis dari data operasional, dibangun di atas Copilot.', 'COPILOT', 3),
  ('penjelasan_margin_biaya', 'Penjelasan Margin & Biaya', 'Penjelasan berbasis kamus utk setiap angka margin/biaya standar (metrik keuangan).', 'COPILOT', 4),
  ('anomaly_detection', 'Anomaly Detection', 'Deteksi penyimpangan dari standar yang sudah dipelajari dari produksi nyata (K8).', 'INSIGHT', 5)
on conflict (code) do nothing;

insert into ai_capability_requirements (capability_id, code, label, metric_key, threshold, comparator, weight, is_blocking, sort_order)
select c.ai_capability_id, r.code, r.label, r.metric_key, r.threshold, r.comparator, r.weight, true, r.sort_order
from ai_capabilities c
join (values
  ('process_mining', 'data_days', 'Riwayat data transaksi (hari)', 'data.days_of_history', 90, 'GTE', 50, 0),
  ('process_mining', 'data_transitions', 'Jumlah transisi status tercatat', 'data.status_transitions_count', 200, 'GTE', 50, 1),
  ('copilot_data_pabrik', 'kamus_p12', 'Kamus prioritas 1-2 dikonfirmasi (%)', 'kamus.p12_confirmed_ratio', 70, 'GTE', 100, 0),
  ('narasi_laporan', 'kamus_p12', 'Kamus prioritas 1-2 dikonfirmasi (%) -- sama dgn prasyarat Copilot', 'kamus.p12_confirmed_ratio', 70, 'GTE', 60, 0),
  ('narasi_laporan', 'data_days_30', 'Riwayat data transaksi (hari)', 'data.days_of_history', 30, 'GTE', 40, 1),
  ('penjelasan_margin_biaya', 'kamus_metrik', 'Kamus metrik keuangan dikonfirmasi (%)', 'kamus.metric_finance_ratio', 100, 'GTE', 100, 0),
  ('anomaly_detection', 'k8_learned', 'Item dgn standar K8 DIPELAJARI (jumlah)', 'k8.learned_items_count', 5, 'GTE', 100, 0)
) as r(capability_code, code, label, metric_key, threshold, comparator, weight, sort_order)
  on r.capability_code = c.code
on conflict (capability_id, code) do nothing;
