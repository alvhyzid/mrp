-- WS-S04 — FONDASI JEJAK KEPUTUSAN (BD-07).
--
-- ============================================================================
-- KENAPA MEMPERLUAS, BUKAN MEMBUAT SISTEM AUDIT KEDUA
-- ============================================================================
-- Sensus 29 Agu 2026 (docs/sales-crm/SALES_CRM_DECISION_AUDIT_ARCHITECTURE.md):
-- FABRIX SUDAH punya dua lapis jejak yang saling melengkapi --
--   data_change_audit_log  : baris APA yang berubah  (598 baris, trigger di 9 tabel)
--   status_transition_log  : KEPUTUSAN apa yang memindahkan keadaan (trigger di 6 tabel)
-- Membuat sales_decision_log / sales_approval_log / sales_activity_log akan melahirkan
-- pertanyaan yang tidak punya jawaban tunggal: "riwayat keputusan dibaca dari mana?"
--
-- LUBANG YANG TERUKUR, dan inilah yang ditutup migrasi ini:
--   data_change_audit_log.changed_by_role berisi peran DATABASE, bukan peran FABRIX --
--   'authenticator' 561 baris, 'postgres' 31, 'cli_login_postgres' 6 -- dan hanya
--   4 DARI 598 baris punya auth_uid, karena hampir seluruh jalur aplikasi memakai
--   service role. Jadi sistem tahu APA yang berubah dan hampir selalu tidak tahu SIAPA.
--
--   status_transition_log.reason SUDAH ADA sejak awal dan SELALU null -- triggernya
--   menuliskannya sebagai literal null. Tempat untuk alasan sudah disediakan, lalu
--   tidak pernah diisi.
--
-- ============================================================================
-- KENAPA KOLOM INI LAHIR BERSAMA PENULISNYA, BUKAN LEBIH DULU
-- ============================================================================
-- Aturan CLAUDE.md: sesuatu yang baru HANYA ditambahkan bersama PEMICU dan AKIBATNYA.
-- Kolom audit yang selalu null adalah bentuk yang sama persis dengan "status tanpa
-- pemicu", dan kolom `reason` di tabel ini SUDAH membuktikannya. Karena itu migrasi
-- BERIKUTNYA (20260906110000) yang membangun aksi Tahan/Lepas/Batalkan PO klien
-- dikerjakan di giliran yang SAMA -- keduanya tidak dipisah.
--
-- ============================================================================
-- BAGAIMANA KONTEKS KEPUTUSAN SAMPAI KE TRIGGER
-- ============================================================================
-- Trigger tidak menerima parameter, dan PostgREST tidak mengizinkan dua pernyataan
-- dalam satu transaksi dari klien. Jadi konteksnya dititipkan lewat setelan sesi
-- ber-lingkup transaksi (set_config(..., true)) yang dipasang fungsi RPC pemanggil,
-- lalu dibaca trigger dengan current_setting(..., true).
--
-- KONSEKUENSI YANG WAJIB DISADARI: perpindahan status yang TIDAK lewat RPC ber-konteks
-- tetap tercatat, hanya tanpa pelaku dan tanpa alasan. Itu DISENGAJA -- lihat aturan
-- klasifikasi baris di bawah. Yang TIDAK boleh terjadi adalah mengarang pelakunya.

alter table status_transition_log add column if not exists actor_name_snapshot text;
alter table status_transition_log add column if not exists actor_role_snapshot text;
alter table status_transition_log add column if not exists actor_department_snapshot text;
alter table status_transition_log add column if not exists reason_category text;
alter table status_transition_log add column if not exists approval_reference_id integer;

comment on column status_transition_log.actor_name_snapshot is
  'Nama pelaku SAAT keputusan dibuat. Snapshot, bukan join hidup: bila orangnya berganti nama, pindah departemen, atau keluar, riwayat lama tetap menunjukkan kapasitasnya saat itu.';
comment on column status_transition_log.actor_role_snapshot is
  'Peran FABRIX pelaku saat keputusan dibuat -- BUKAN peran database. data_change_audit_log.changed_by_role mencatat peran database dan karena itu tidak bisa menjawab siapa.';
comment on column status_transition_log.actor_department_snapshot is
  'Departemen pelaku saat keputusan dibuat. Dipakai menegakkan BD-06: penghalang dari satu departemen tidak boleh dilepas sembarang departemen lain.';
comment on column status_transition_log.reason_category is
  'Kode kategori alasan dari decision_reason_categories. Kategori dipisah dari catatan bebas supaya alasan bisa DISARING dan DIBANDINGKAN, bukan dibaca satu per satu.';
comment on column status_transition_log.reason is
  'Catatan tambahan bebas. WAJIB diisi bila reason_category bernilai kategori "lainnya".';
comment on column status_transition_log.approval_reference_id is
  'Rujukan ke baris persetujuan yang menjadi dasar keputusan ini, bila ada.';

-- ============================================================================
-- KATALOG KATEGORI ALASAN
-- ============================================================================
-- Bentuknya MENYALIN status_transition_rules: master aturan berlaku untuk SELURUH
-- tenant, jadi TANPA company_id. Ini juga mematuhi CLAUDE.md -- migrasi hanya boleh
-- membangun struktur dan master yang berlaku untuk semua tenant.
--
-- KENAPA TABEL DAN BUKAN DAFTAR DI KODE UI: §13 perintah, dan alasan yang lebih kuat --
-- daftar yang ditulis di kode UI tidak bisa dipakai MENYARING riwayat di sisi server,
-- dan akan bercabang begitu ada layar kedua yang menampilkan alasan yang sama.
create table if not exists decision_reason_categories (
  decision_reason_category_id serial primary key,
  entity text not null,
  action text not null,
  department text,
  code text not null,
  label text not null,
  requires_note boolean not null default false,
  sort_order integer not null default 0,
  active boolean not null default true,
  unique (entity, action, code)
);

comment on table decision_reason_categories is
  'Katalog kategori alasan untuk keputusan berdampak (BD-07 / §12). Master seluruh tenant, TANPA company_id -- bentuknya menyalin status_transition_rules. department null berarti kategori berlaku untuk departemen mana pun.';

alter table decision_reason_categories enable row level security;

-- Katalog ini master aturan yang sama untuk semua tenant dan TIDAK memuat data
-- perusahaan mana pun, jadi seluruh pengguna yang login boleh membacanya. Menulisnya
-- tetap tertutup bagi klien -- perubahannya lewat migrasi, seperti
-- status_transition_rules.
drop policy if exists decision_reason_categories_select_authenticated on decision_reason_categories;
create policy decision_reason_categories_select_authenticated
  on decision_reason_categories for select
  using (auth.uid() is not null);

-- ============================================================================
-- TRIGGER MEMBACA KONTEKS KEPUTUSAN
-- ============================================================================
create or replace function public.enforce_status_transition()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $$
declare
  v_allowed boolean;
  v_record_id integer;
  v_company_id integer;
  v_changed_by integer;
  v_approved_count integer;
  v_reason_category text;
  v_reason text;
  v_actor_name text;
  v_actor_role text;
  v_actor_department text;
  v_approval_ref integer;
begin
  if new.status = old.status then
    return new;
  end if;

  select exists (
    select 1 from status_transition_rules
    where table_name = TG_TABLE_NAME and from_status = old.status and to_status = new.status
  ) into v_allowed;

  if not v_allowed then
    raise exception 'Transisi status % -> % tidak valid untuk tabel %.', old.status, new.status, TG_TABLE_NAME
      using errcode = '23514';
  end if;

  if TG_TABLE_NAME = 'customer_purchase_orders' and new.status = 'processed' then
    select count(*) into v_approved_count
    from customer_po_approvals
    where customer_purchase_order_id = new.customer_purchase_order_id and status = 'approved';
    if v_approved_count < 3 then
      raise exception 'customer_purchase_orders % belum disetujui ketiga department (baru % dari 3) -- tidak boleh diproses.', new.customer_purchase_order_id, v_approved_count
        using errcode = '23514';
    end if;
  end if;

  -- shipments draft->shipped WAJIB sudah ada foto bukti pengiriman
  -- (dispatch_photo_url, migration 20260817190000) -- ditegakkan di sini supaya
  -- tidak bisa dilewati lewat jalur mana pun selain endpoint aplikasi yang benar.
  if TG_TABLE_NAME = 'shipments' and old.status = 'draft' and new.status = 'shipped' then
    if new.dispatch_photo_url is null then
      raise exception 'Foto bukti pengiriman wajib sebelum status diubah ke Di Proses.'
        using errcode = '23514';
    end if;
  end if;

  if TG_TABLE_NAME = 'customer_purchase_orders' then
    v_record_id := new.customer_purchase_order_id;
    v_company_id := new.company_id;
    v_changed_by := new.processed_by;
  elsif TG_TABLE_NAME = 'sales_orders' then
    v_record_id := new.sales_order_id;
    v_company_id := new.company_id;
  elsif TG_TABLE_NAME = 'work_orders' then
    v_record_id := new.work_order_id;
    v_company_id := new.company_id;
  elsif TG_TABLE_NAME = 'production_batches' then
    v_record_id := new.production_batch_id;
    v_company_id := new.company_id;
  elsif TG_TABLE_NAME = 'customer_po_approvals' then
    v_record_id := new.customer_po_approval_id;
    v_changed_by := new.approved_by;
    select company_id into v_company_id from customer_purchase_orders where customer_purchase_order_id = new.customer_purchase_order_id;
  elsif TG_TABLE_NAME = 'shipments' then
    v_record_id := new.shipment_id;
    v_company_id := new.company_id;
  end if;

  -- Konteks keputusan dititipkan RPC pemanggil lewat setelan sesi ber-lingkup
  -- transaksi. Bila perpindahan status datang dari jalur yang TIDAK menitipkan
  -- konteks, seluruh nilai di bawah null -- dan itu DISENGAJA. Baris tanpa pelaku
  -- adalah baris yang JUJUR mengatakan pelakunya tidak diketahui; mengarang
  -- pelakunya jauh lebih berbahaya daripada mengakui tidak tahu (§16 perintah).
  v_reason_category  := nullif(current_setting('fabrix.reason_category', true), '');
  v_reason           := nullif(current_setting('fabrix.reason_note', true), '');
  v_actor_name       := nullif(current_setting('fabrix.actor_name', true), '');
  v_actor_role       := nullif(current_setting('fabrix.actor_role', true), '');
  v_actor_department := nullif(current_setting('fabrix.actor_department', true), '');
  v_approval_ref     := nullif(current_setting('fabrix.approval_reference_id', true), '')::integer;

  if v_changed_by is null then
    v_changed_by := nullif(current_setting('fabrix.actor_user_id', true), '')::integer;
  end if;

  insert into status_transition_log (
    company_id, table_name, record_id, from_status, to_status, changed_by, reason,
    reason_category, actor_name_snapshot, actor_role_snapshot, actor_department_snapshot, approval_reference_id
  )
  values (
    v_company_id, TG_TABLE_NAME, v_record_id, old.status, new.status, v_changed_by, v_reason,
    v_reason_category, v_actor_name, v_actor_role, v_actor_department, v_approval_ref
  );

  return new;
end;
$$;
