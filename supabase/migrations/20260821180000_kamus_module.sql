-- Migration: Modul Kamus (K1) -- docs/rencana-modul-kamus-paralel.md BAGIAN 2.
-- Antrean internal supaya pemilik produk & tim bisa menjelaskan MAKNA kolom/
-- metrik data secara paralel sambil Claude Code bekerja di modul lain --
-- BUKAN sistem AI (tidak ada panggilan LLM di sini), draf awal ditulis Claude
-- Code manual saat sesi kerja, disimpan sebagai teks biasa.

create table if not exists kamus_terms (
  kamus_term_id serial primary key,
  company_id integer not null references companies(company_id),
  scope text not null check (scope in ('FIELD', 'METRIC', 'RELATION', 'RULE')),
  entity text, -- nama tabel (FIELD/RELATION), null untuk METRIC/RULE
  field text,  -- nama kolom, null kecuali FIELD
  term_key text not null, -- kunci unik dibaca manusia, mis. "bom_lines.qty_per_unit_output" / "metric.margin_kontribusi"
  priority smallint not null check (priority between 1 and 5),
  domain text not null check (domain in ('uang', 'kuantitas', 'status', 'standar', 'proses', 'lainnya')),
  suggested_role text, -- departemen disarankan menjawab (teks bebas, pola sama system_alerts.target_department -- BUKAN FK ke tabel roles, sistem ini tidak punya tabel roles terpisah)
  status text not null default 'BELUM' check (status in ('BELUM', 'DRAF_AI', 'DIJAWAB', 'DIKONFIRMASI', 'TIDAK_RELEVAN')),
  ai_draft text,
  answer_plain text,
  answer_pitfall text,
  answer_range text,
  answered_by integer references users(user_id),
  answered_at timestamptz,
  confirmed_by integer references users(user_id),
  confirmed_at timestamptz,
  assigned_to_role text,
  assigned_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  unique (company_id, term_key)
);

create index if not exists kamus_terms_company_id_idx on kamus_terms (company_id);
create index if not exists kamus_terms_status_priority_idx on kamus_terms (company_id, status, priority);

create table if not exists kamus_term_history (
  kamus_term_history_id serial primary key,
  kamus_term_id integer not null references kamus_terms(kamus_term_id),
  changed_by integer references users(user_id),
  changed_at timestamptz not null default now(),
  field_changed text not null,
  old_value text,
  new_value text
);
create index if not exists kamus_term_history_term_id_idx on kamus_term_history (kamus_term_id);

create table if not exists kamus_routing_rules (
  kamus_routing_rule_id serial primary key,
  company_id integer not null references companies(company_id),
  domain text,
  entity_pattern text, -- pola nama tabel/kata kunci utk dicocokkan, mis. "bom%" atau "margin"
  suggested_role text not null,
  rationale text,
  created_at timestamptz not null default now()
);
create index if not exists kamus_routing_rules_company_id_idx on kamus_routing_rules (company_id);

alter table kamus_terms enable row level security;
alter table kamus_term_history enable row level security;
alter table kamus_routing_rules enable row level security;

-- SELECT: semua role internal perusahaan boleh baca (antrean terbuka utk semua,
-- supaya siapa pun bisa bantu jawab -- prinsip inti modul ini).
drop policy if exists kamus_terms_select_for_company on kamus_terms;
create policy kamus_terms_select_for_company on kamus_terms
  for select using (company_id = public.jwt_company_id());

-- INSERT/UPDATE: SENGAJA TIDAK ADA policy untuk role authenticated (default
-- deny) -- pola sama dengan employees ("Tidak ada policy select di tabel
-- dasar... akses lewat view/endpoint resmi"). SEMUA tulis (backlog generator,
-- impor kamus-sementara.md, jawab pertanyaan, tugaskan departemen, konfirmasi)
-- HARUS lewat server function pakai admin client (getAdminClient()), dengan
-- gerbang role diperiksa di TypeScript SEBELUM menulis -- pola konsisten
-- dipakai di createEmployee/updateBom/dst sepanjang proyek ini. Ini menutup
-- jalur PostgREST langsung pakai JWT user (anon/authenticated) yang bisa
-- melewati gerbang role kalau RLS dibuat longgar.

drop policy if exists kamus_term_history_select_for_company on kamus_term_history;
create policy kamus_term_history_select_for_company on kamus_term_history
  for select using (
    exists (select 1 from kamus_terms kt where kt.kamus_term_id = kamus_term_history.kamus_term_id and kt.company_id = public.jwt_company_id())
  );

drop policy if exists kamus_routing_rules_select_for_company on kamus_routing_rules;
create policy kamus_routing_rules_select_for_company on kamus_routing_rules
  for select using (company_id = public.jwt_company_id());

drop policy if exists kamus_routing_rules_write_leadership on kamus_routing_rules;
create policy kamus_routing_rules_write_leadership on kamus_routing_rules
  for all using (company_id = public.jwt_company_id() and public.jwt_is_company_leadership())
  with check (company_id = public.jwt_company_id() and public.jwt_is_company_leadership());

-- Trigger riwayat: catat SETIAP perubahan field jawaban (bukan semua kolom --
-- cuma yang bermakna "jawaban manusia berubah") ke kamus_term_history, plus
-- auto-update updated_at & version. "changed_by" diambil dari NEW.answered_by/
-- NEW.confirmed_by (server function SELALU eksplisit mengisi ini sebelum
-- update) -- BUKAN auth.uid(), karena semua tulis lewat admin client
-- (service_role) yang TIDAK membawa konteks JWT user, auth.uid() akan selalu
-- NULL di situ.
create or replace function public.kamus_terms_track_history()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_changed_by integer;
begin
  v_changed_by := coalesce(new.answered_by, new.confirmed_by);

  if new.answer_plain is distinct from old.answer_plain then
    insert into kamus_term_history (kamus_term_id, changed_by, field_changed, old_value, new_value)
    values (new.kamus_term_id, v_changed_by, 'answer_plain', old.answer_plain, new.answer_plain);
  end if;
  if new.answer_pitfall is distinct from old.answer_pitfall then
    insert into kamus_term_history (kamus_term_id, changed_by, field_changed, old_value, new_value)
    values (new.kamus_term_id, v_changed_by, 'answer_pitfall', old.answer_pitfall, new.answer_pitfall);
  end if;
  if new.answer_range is distinct from old.answer_range then
    insert into kamus_term_history (kamus_term_id, changed_by, field_changed, old_value, new_value)
    values (new.kamus_term_id, v_changed_by, 'answer_range', old.answer_range, new.answer_range);
  end if;
  if new.status is distinct from old.status then
    insert into kamus_term_history (kamus_term_id, changed_by, field_changed, old_value, new_value)
    values (new.kamus_term_id, v_changed_by, 'status', old.status, new.status);
  end if;

  new.updated_at := now();
  new.version := old.version + 1;
  return new;
end;
$$;

drop trigger if exists kamus_terms_history_trigger on kamus_terms;
create trigger kamus_terms_history_trigger
  before update on kamus_terms
  for each row
  execute function public.kamus_terms_track_history();

grant execute on function public.kamus_terms_track_history() to service_role;
