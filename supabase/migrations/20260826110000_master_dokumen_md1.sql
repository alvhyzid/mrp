-- Master Dokumen MD-1 (Bagian C, 26 Agu 2026) — fondasi: registry, viewer, akses.
-- Sumber: rencana-kerja-master-dokumen.md §2-4 & §6. Gerbang waktu "setelah SAS001 &
-- SAS005 terkirim" DIBATALKAN eksplisit oleh pemilik produk 26 Agu 2026 ("asumsikan
-- sudah ada, kita bangun semuanya nanti diperbaiki sambil jalan") -- berlaku untuk
-- SEMUA gerbang serupa di dokumen manapun, dicatat di HANDOFF.md.
--
-- PENYIMPANGAN dari model data §2 (diperiksa & didokumentasikan, bukan diam-diam):
-- (1) `department_id` -> `department text` (department_owner_role_id di document_types
--     juga jadi `owner_role text`) -- proyek ini TIDAK punya tabel `roles`/`departments`
--     terpisah, department selalu free-text dgn daftar nilai yang sama dipakai
--     employees.department/system_alerts.target_department (pola sudah mapan).
-- (2) `ocr_text tsvector` SENGAJA TIDAK ditambahkan sekarang -- itu scope MD-3
--     (pencarian isi dokumen), menambahkannya sekarang tanpa dipakai = kolom mati
--     (prinsip "bangun untuk kebutuhan nyata sekarang", memory build-for-real-tenant).
--     Migrasi MD-3 nanti tinggal ADD COLUMN, tidak ada migrasi ulang yang mahal.
-- (3) Primary key ikut konvensi proyek: `document_id` (bukan `id`), dst.

create table if not exists document_types (
  document_type_id serial primary key,
  company_id integer not null references companies(company_id),
  code text not null,
  name text not null,
  owner_role text, -- departemen disarankan memiliki jenis ini (pola sama kamus_terms.suggested_role) -- nullable, bisa lintas-departemen
  sensitivity_default text not null default 'UMUM' check (sensitivity_default in ('UMUM', 'DEPARTEMEN', 'TERBATAS')),
  requires_expiry boolean not null default false,
  retention_months integer,
  reminder_days_before integer[],
  created_at timestamptz not null default now(),
  unique (company_id, code)
);

create index if not exists document_types_company_id_idx on document_types (company_id);

alter table document_types enable row level security;

drop policy if exists document_types_select_for_company on document_types;
create policy document_types_select_for_company on document_types
  for select using (company_id = public.jwt_company_id());

-- TIDAK ADA insert/update/delete untuk authenticated -- pola default-deny yang sama
-- dipakai Kamus/AI-Project/AI-Readiness/Absensi/KPI, semua tulis lewat service-role.

create table if not exists documents (
  document_id serial primary key,
  company_id integer not null references companies(company_id),
  doc_type text not null, -- merujuk document_types.code (company yang sama), tidak FK komposit -- doc_type tetap valid dibaca meski baris document_types-nya diarsipkan/berubah nanti
  title text not null,
  doc_number text,
  description text,
  storage_path text not null,
  mime_type text not null,
  size_bytes bigint not null,
  checksum_sha256 text not null,
  issued_by text, -- penerbit: nama vendor/klien/internal, free text
  issued_date date,
  effective_date date,
  expiry_date date,
  status text not null default 'AKTIF' check (status in ('AKTIF', 'KEDALUWARSA', 'DIARSIP', 'DIGANTI')),
  version_group_id integer, -- document_id dari versi PERTAMA di grup ini; null = belum pernah direvisi (dirinya sendiri grupnya)
  version_no integer not null default 1,
  superseded_by integer references documents(document_id),
  sensitivity text not null default 'UMUM' check (sensitivity in ('UMUM', 'DEPARTEMEN', 'TERBATAS')),
  department text check (department in ('production', 'ppic', 'finance', 'purchasing', 'warehouse', 'hr', 'management', 'fat', 'rnd')), -- wajib diisi kalau sensitivity DEPARTEMEN/TERBATAS, divalidasi di server function
  uploaded_by integer not null references users(user_id),
  uploaded_at timestamptz not null default now()
);

create index if not exists documents_company_id_idx on documents (company_id);
create index if not exists documents_doc_type_idx on documents (company_id, doc_type);
create index if not exists documents_status_idx on documents (company_id, status);
create index if not exists documents_version_group_idx on documents (version_group_id);

alter table documents enable row level security;

-- Departemen efektif user yang login, dari role (bukan employees.department --
-- company_admin/general_manager/admin_staff sengaja TIDAK ter-map, mereka lolos lewat
-- jwt_is_company_leadership() di policy, bukan lewat departemen tertentu).
create or replace function public.jwt_document_department()
returns text
language sql
stable
as $$
  select case
    when public.jwt_app_role() ~ '_manager$' then regexp_replace(public.jwt_app_role(), '_manager$', '')
    when public.jwt_app_role() ~ '_staff$' then regexp_replace(public.jwt_app_role(), '_staff$', '')
    else null
  end;
$$;

grant execute on function public.jwt_document_department() to authenticated;

-- Aturan §3.4 (non-negotiable): UMUM = semua orang di company; DEPARTEMEN = siapa pun
-- (manager atau staff) di departemen yang ditandai, atau leadership; TERBATAS = HANYA
-- manager departemen yang ditandai, atau leadership (staff departemen sendiri TIDAK
-- otomatis lihat dokumen TERBATAS departemennya -- v1, per kontrak kerja HRD §7.6).
drop policy if exists documents_select_for_company on documents;
create policy documents_select_for_company on documents
  for select using (
    company_id = public.jwt_company_id()
    and (
      sensitivity = 'UMUM'
      or public.jwt_is_company_leadership()
      or (sensitivity = 'DEPARTEMEN' and department = public.jwt_document_department())
      or (sensitivity = 'TERBATAS' and department = public.jwt_document_department() and public.jwt_app_role() ~ '_manager$')
    )
  );

-- TIDAK ADA insert/update/delete untuk authenticated -- semua tulis (termasuk hard
-- delete berkas yatim, dibatasi company_admin di level TypeScript) lewat service-role.

create table if not exists document_links (
  document_link_id serial primary key,
  company_id integer not null references companies(company_id),
  document_id integer not null references documents(document_id),
  entity_type text not null, -- nama tabel yang ditaut, mis. 'lots'/'sales_orders'/'production_batches'
  entity_id integer not null,
  link_role text not null, -- mis. 'COA'/'SUMBER'/'SERTIFIKAT'/'POD'
  created_at timestamptz not null default now()
);

create index if not exists document_links_company_id_idx on document_links (company_id);
create index if not exists document_links_document_idx on document_links (document_id);
create index if not exists document_links_entity_idx on document_links (entity_type, entity_id);

alter table document_links enable row level security;

-- Baca ikut visibilitas dokumen induknya (bukan cuma company_id) -- kalau baris
-- documents-nya tersembunyi RLS, tautannya juga harus tersembunyi, bukan cuma
-- company-scoped longgar.
drop policy if exists document_links_select_visible_document on document_links;
create policy document_links_select_visible_document on document_links
  for select using (
    company_id = public.jwt_company_id()
    and exists (select 1 from documents d where d.document_id = document_links.document_id)
  );

create table if not exists document_access_log (
  document_access_log_id serial primary key,
  company_id integer not null references companies(company_id),
  document_id integer not null references documents(document_id),
  accessed_by integer not null references users(user_id),
  action text not null check (action in ('view', 'download')),
  accessed_at timestamptz not null default now()
);

create index if not exists document_access_log_company_id_idx on document_access_log (company_id);
create index if not exists document_access_log_document_idx on document_access_log (document_id);

alter table document_access_log enable row level security;

-- Log akses hanya boleh dibaca leadership (audit trail dokumen TERBATAS, bukan
-- konsumsi umum tiap orang) -- beda dari status_transition_log/document_signatures
-- yang company-wide select, karena isinya "siapa membuka dokumen sensitif apa".
drop policy if exists document_access_log_select_leadership on document_access_log;
create policy document_access_log_select_leadership on document_access_log
  for select using (company_id = public.jwt_company_id() and public.jwt_is_company_leadership());

-- Bucket PRIVAT (§3.2, PERTAMA di proyek ini -- semua bucket sebelumnya public
-- avatar/logo/signature/POD) -- "lihat tanpa unduh" = signed URL berumur pendek dari
-- server, BUKAN akses langsung authenticated biasa.
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Storage policy SEJALAN dengan RLS documents (§3.4 mini-audit C-3): baris
-- documents yang tersembunyi RLS -> berkasnya juga tidak bisa diambil langsung lewat
-- storage.objects, bahkan kalau seseorang tahu path-nya persis.
drop policy if exists documents_bucket_select_visible on storage.objects;
create policy documents_bucket_select_visible on storage.objects
  for select using (
    bucket_id = 'documents'
    and exists (
      select 1 from documents d
      where d.storage_path = storage.objects.name
        and d.company_id = public.jwt_company_id()
        and (
          d.sensitivity = 'UMUM'
          or public.jwt_is_company_leadership()
          or (d.sensitivity = 'DEPARTEMEN' and d.department = public.jwt_document_department())
          or (d.sensitivity = 'TERBATAS' and d.department = public.jwt_document_department() and public.jwt_app_role() ~ '_manager$')
        )
    )
  );

-- TIDAK ADA insert/update/delete untuk authenticated di bucket ini -- unggah HANYA
-- lewat service-role (uploadFileWithMetadata + registerDocument, lihat
-- src/features/documents/server/), pola sama document_signatures.
