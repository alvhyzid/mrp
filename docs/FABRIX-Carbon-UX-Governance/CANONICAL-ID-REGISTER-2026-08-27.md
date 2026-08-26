# FABRIX — CANONICAL ID REGISTER (UI/UX SCOPE)

**Generated:** 27 August 2026 · **Commit:** `7ce6e3c` · **Mode:** read-only

Columns: **Canonical ID · Document path · Status · Owner · Related scope**

> **How to read this register.**
>
> - **Canonical ID** is the repository's own identifier. `F-xx` identifiers from
>   `AUDIT-2026-08-27-asis-ui-ux.md` are *reconciliation labels only* and are shown in §4 so
>   they can be resolved — they are not a second tracking system.
> - **Document path** is where the item actually lives. Task records live in the `build_tasks`
>   table (visible in-app at `/build-tasks`); the file listed is the migration that created or
>   last amended that record, which is the only file-system trace a task has.
> - **Status** is read from `build_tasks.status` at the commit above, not from memory. Values:
>   `selesai` (done) · `menunggu_persetujuan` (awaiting owner sign-off) · `sedang_dikerjakan`
>   (in progress) · `menunggu` (queued).
> - **Owner** is `build_tasks.pic`, plus the decision owner where the record shows the item
>   originated from the product owner (`origin = pemilik_produk`).
> - **Related scope** names the files or screens the item actually touches, verified at this
>   commit.

---

## 1. Governance documents (rules, not tasks)

These carry no task ID. They are the authority a task is measured against.

| Canonical ID | Document path | Status | Owner | Related scope |
|---|---|---|---|---|
| C-001 … C-016 | `docs/FABRIX-Carbon-UX-Governance/02-carbon-compliance-rules.md` | Proposed — **not yet adopted** | Product owner (adoption) | Whole UI. Overlap with existing rules mapped in `RECONCILIATION-2026-08-27.md` §5 |
| FABRIX UX governance §1–§10 | `docs/FABRIX-Carbon-UX-Governance/03-fabrix-ux-governance.md` | Proposed — **§9 conflicts with `CLAUDE.md`** | Product owner | Ownership model, form-field decisions, consistency |
| Audit methodology A–H / P0–P3 | `docs/FABRIX-Carbon-UX-Governance/04-ui-ux-audit-methodology.md` | Proposed | Product owner | Finding classification |
| `UX-YYYY-NNN` decision records | `docs/FABRIX-Carbon-UX-Governance/05-ux-decision-records.md` | Proposed — **conflicts with two existing decision homes** | Product owner | Decision storage |
| Data-page template §1–§9 | `docs/governance/cetakan-halaman-data.md` | **In force** | Product owner | All 16 table pages; modal anatomy §6e/§6e-2/§6e-3; visual evidence §6c/§6d |
| Carbon reference order (4 sources) | `docs/governance/rujukan-carbon.md` | **In force** | Product owner | Every Carbon decision; per-screen catalogue URLs |
| Carbon component mapping | `docs/governance/pemetaan-komponen-carbon.md` | **In force** | Claude Code | Component selection |
| Design debt register | `docs/governance/design-debt.md` | **In force** | Claude Code | Recorded deviations |
| Project rules (ARTI ANGKA, DS-RULES, responsive, modal, upload) | `CLAUDE.md` | **In force — highest authority** | Product owner | Whole repository |
| AS-IS audit F-01…F-18 | `docs/FABRIX-Carbon-UX-Governance/AUDIT-2026-08-27-asis-ui-ux.md` | Delivered — **3 corrections applied** | Claude Code | Evidence only, not authority |
| Reconciliation | `docs/FABRIX-Carbon-UX-Governance/RECONCILIATION-2026-08-27.md` | Delivered | Claude Code | Status of every F-id; 4 conflicts raised |

---

## 2. Canonical task IDs — Design System (`DS`)

| Canonical ID | Document path | Status | Owner | Related scope |
|---|---|---|---|---|
| `DS-01` | `supabase/migrations/20260828460000_ds01_fondasi_carbon.sql` | **selesai** | Claude Code + Product owner | `src/styles/carbon.scss`, theme g10, IBM Plex via `next/font` |
| `DS-02` | `supabase/migrations/20260828550000_ds02_layar_publik_selesai.sql` | **selesai** | Claude Code | `app/(public)/**` — login, register, forgot/reset, POD |
| `DS-03` | `supabase/migrations/20260828530000_ds02_layar_publik_carbon.sql` | **menunggu** — awaiting owner | Claude Code + **Product owner** | Ordering of the remaining Carbon migration; blocks nothing today |
| `DS-04` | `supabase/migrations/20260828590000_ds04_ui_shell_carbon.sql` | **selesai** | Claude Code + Product owner | `src/features/navigasi/AppShellCarbon.tsx`, `app/(shell)/shell.scss` |
| `DS-05` | `supabase/migrations/20260828640000_ds05_master_item.sql` | **selesai** | Claude Code | `src/features/mrp/pages/ItemsPage.tsx` — the approved reference screen |
| **`DS-06`** | `supabase/migrations/20260828640000_ds05_master_item.sql` | **menunggu** | Claude Code | **6 `window.confirm` sites in 4 files**: `RoutingsPage:332`, `CustomersPage:224`, `PurchasingPage:372,487`, `SalesOrdersPage:365,403`. Carries an owner decision on *timing* — see conflict below |
| `DS-07` | `supabase/migrations/20260828650000_ds05_koreksi_toolbar.sql` | **selesai** | Claude Code + Product owner | 44px touch threshold across Carbon controls |
| `DS-08` | `supabase/migrations/20260828660000_ds07_cetakan_sapu_tugas.sql` | **selesai** | Claude Code | `docs/governance/cetakan-halaman-data.md` — the page template itself |
| `DS-09` | `supabase/migrations/20260828930000_ds09_kamus_dan_temuan_provenance.sql` | **menunggu_persetujuan** | Claude Code | All 39 feature pages; 39/39 now import Carbon |
| **`DS-10`** | `supabase/migrations/20260828930000_ds09_kamus_dan_temuan_provenance.sql` | **menunggu** | Claude Code | `src/components/ui/provenance-info-button.tsx` — raw `<button>` + 38 hand-written Tailwind utilities, used by **19** pages |
| `DS-11` | `supabase/migrations/20260828970000_ds09_seluruh_halaman_cetakan_items.sql` | **selesai** | Claude Code | Guard exception anchoring (markers, not line numbers) |
| `DS-12` | `supabase/migrations/20260828970000_ds09_seluruh_halaman_cetakan_items.sql` | **selesai** | Claude Code | Migrated table pages aligned to the template |
| `DS-13` | `supabase/migrations/20260829020000_qq_ds16_ds13_ds15_selesai.sql` | **selesai** | Claude Code | Breadcrumbs centralised into `kepala-halaman.tsx` |
| **`DS-14`** | `supabase/migrations/20260828980000_oo_migrasi_tak_diterapkan_dan_temuan_ds09.sql` | **menunggu** (partially delivered) | Claude Code | Two-edge / six-width visual evidence. Rule written into `cetakan-halaman-data.md` §6c & §6d; **expanded-row tables still unmeasured** |
| `DS-15` | `supabase/migrations/20260828990000_pp_ukuran_dua_tepi_dan_pemisahan_ds13.sql` | **selesai** | Claude Code | `SalesOrdersPage` raw tables at 631 / 1130 / 1171 — **that scope only**; 78 Tailwind utilities remain untracked |
| `DS-16` | `supabase/migrations/20260829010000_pp3_sebab_ds14_terbukti.sql` | **selesai** | Claude Code | `tests/elemen_mentah_halaman_internal.test.ts` — 9 assertions, scans `pages/` **and** `components/` |
| `DS-17` | `supabase/migrations/20260829030000_rr_project_ketiga_dan_temuan.sql` | **menunggu** | Claude Code | `BomsPage` has neither delete nor archive |
| **`DS-18`** | `supabase/migrations/20260829060000_vv_po_bertahap_dan_uu2_dicabut.sql` | **menunggu_persetujuan** | Claude Code | Modal size & form columns. Rule in `cetakan-halaman-data.md` §6e/§6e-2; component `src/components/ui/modal-bertahap.tsx`; applied to PO klien, Karyawan, Item, BOM |
| `DS-19` | `supabase/migrations/20260829090000_yy_ppic_lima_bagian.sql` | **sedang_dikerjakan** | Claude Code | `src/features/ppic/components/PapanGantt.tsx` + `papan-gantt.scss`. Weekly board rebuilt; **Daily and Monthly views still legacy grids** |
| `DS-20` | `supabase/migrations/20260829100000_zz_papan_gantt_carbon.sql` | **menunggu** | Claude Code | `NotificationBell.tsx` (2 raw buttons + 10 hex colours), `ConfirmAndSignModal.tsx` (1 raw input) |

---

## 3. Canonical task IDs — adjacent families

| Canonical ID | Document path | Status | Owner | Related scope |
|---|---|---|---|---|
| `AUD-42` | `supabase/migrations/20260828820000_task_sapuan_tertunda.sql` (amended by `…20260829080000_xx_tiga_modal_bertahap.sql`) | **menunggu** (`mendesak`) | Claude Code | Guard false-accusation class; comment-honesty rule |
| **`AUD-47`** | `supabase/migrations/20260829030000_rr_project_ketiga_dan_temuan.sql` | **menunggu** (`bisa_menunggu`) | Claude Code | `RoutingsPage:332` + `kpi_module.test.ts` exact-match guard. **Overlaps `DS-06`** — duplicate tracking, decision required |
| `AUD-48` | `supabase/migrations/20260829080000_xx_tiga_modal_bertahap.sql` | **menunggu** | Claude Code | `POST /api/items` returns less than callers read; class check across all `authedFetch` sites |
| `RSP-01` | `supabase/migrations/20260828090000_uu_jawaban_mst18_mst19_rsp01_aud14.sql` | **selesai** | Claude Code | Horizontal scroll: side nav, table toolbar, truncated columns |
| `RSP-02` | `supabase/migrations/20260828230000_ff_rsp02_pengawas_dan_pertanyaan.sql` | **menunggu** (`mendesak`) | Claude Code | Guard for `overflow-hidden` on table containers |
| `NAV-01` | `supabase/migrations/20260828590000_ds04_ui_shell_carbon.sql` | **menunggu** — awaiting owner | Claude Code + **Product owner** | Final navigation architecture |
| `MST-08` | `supabase/migrations/20260827340000_build_tasks_seed_history.sql` | **menunggu** | Claude Code | Work Center create/rename/archive — **no screen exists**; `/ppic` |
| `MST-09` | same | **menunggu** | Claude Code | Production plant CRUD — **no screen exists** |
| `MST-10` | same | **menunggu** (`bisa_menunggu`) | Claude Code | Work shift settings — **no screen exists** |
| `MST-16` | `supabase/migrations/20260828210000_persetujuan_enam_keputusan_dan_perbaikan.sql` | **selesai** | Claude Code + Product owner | `/items` detail panel; delete-vs-deactivate computed server-side |
| `PMB-11` | `supabase/migrations/20260828080000_tt5_pmb11_mst15_inf19_selesai.sql` | **selesai** | Claude Code + Product owner | `/purchasing` supplier modal — the original modal template |

---

## 4. Historical audit findings → canonical ID

`F-xx` are reconciliation labels from `AUDIT-2026-08-27-asis-ui-ux.md`. This section exists so
they can be resolved to repository identifiers and then dropped.

| Canonical ID | Document path | Status | Owner | Related scope |
|---|---|---|---|---|
| `DS-06` ← F-02 | as §2 | menunggu | Claude Code | Destructive confirmation, 6 sites / 4 files |
| `DS-10` ← F-04 (part) | as §2 | menunggu | Claude Code | Raw provenance button |
| `DS-18` ← F-06 | as §2 | menunggu_persetujuan | Claude Code | Stepped forms / modal sizing |
| `DS-15` ← F-10 (part) | as §2 | selesai | Claude Code | Sales Order raw tables only |
| `DS-16` + `DS-20` ← F-17 | as §2 | selesai / menunggu | Claude Code | Raw-markup governance + residue |
| `DS-14` ← F-12, F-13 (part) | as §2 | menunggu | Claude Code | Visual evidence method |
| — ← F-01, F-11 | **NEW CANONICAL ID REQUIRED** (next free `DS-21`) | not created | **Product owner** to authorise | Parallel token system: `app/globals.css`, `tailwind.config.ts`, 181 usages / 17 files |
| — ← F-03 | **NEW CANONICAL ID REQUIRED** | not created | **Product owner** to authorise | Field-level validation: `invalidText` 5 files, `required` 6 files |
| — ← F-04 (decision half) | **NEW CANONICAL ID REQUIRED** | not created | **Product owner** to authorise | Which help mechanism is canonical |
| — ← F-05 | **NEW CANONICAL ID REQUIRED** | not created | **Product owner** to authorise | Dead shadcn layer: `card/select/data-table.tsx` 0 importers |
| — ← F-07 | **NEW CANONICAL ID REQUIRED** | not created | **Product owner** to authorise | `AreaNotifikasi` in 6 of 39 pages |
| — ← F-08 | **NEW CANONICAL ID REQUIRED** | not created | **Product owner** to authorise | Bare "Memuat…" in 9 files |
| — ← F-09 | **NEW CANONICAL ID REQUIRED** (decision first) | not created | **Product owner** to decide | No row selection / bulk actions / overflow menus |
| — ← F-10 (remainder) | **NEW CANONICAL ID REQUIRED** | not created | **Product owner** to authorise | 78 Tailwind utilities in `SalesOrdersPage` |
| — ← F-13 | **NEW CANONICAL ID REQUIRED** | not created | **Product owner** to authorise | No visual-regression gate |
| — ← F-15 | **NEW CANONICAL ID REQUIRED** | not created | **Product owner** to authorise | Six page components over 1,100 lines |
| — ← F-16 | **NEW CANONICAL ID REQUIRED** *or close as intentional* | not created | **Product owner** to decide | `BuildTasksPage`, `PpicDashboardPage` without pagination |
| n/a ← F-14 | no ID needed | informational | Claude Code | `@carbon/react` 1.114.0 vs `@carbon/styles` 1.113.0 |
| n/a ← F-18 | `docs/governance/design-debt.md` | documented deviation | Claude Code | `NumberInput` min-width override in `ppic.scss` |
| n/a ← F-12 | no ID needed | informational | Human review | 30 `hideLabel` sites |

**No new identifier was created by this register.** Next free numbers are `DS-21` and `AUD-49`.

---

## 5. Documented deviations (kept, not tasks)

| Canonical ID | Document path | Status | Owner | Related scope |
|---|---|---|---|---|
| DEV-1 table → cards | `docs/governance/cetakan-halaman-data.md` §6b, §6b-2 | **in force** | Product owner | `.tabel-responsif` in `src/styles/carbon.scss`; 16 pages; guard-enforced |
| DEV-2 full-width layout | `app/(shell)/shell.scss:10`; `CLAUDE.md` | **in force** | Product owner (25 Aug 2026) | All shell screens |
| DEV-3 two-level breadcrumb | `cetakan-halaman-data.md` §6a | **in force** | Product owner | `src/components/ui/kepala-halaman.tsx` |
| DEV-4 `NumberInput` min-width override | `app/(shell)/ppic/ppic.scss` | **in force** | Claude Code | PPIC capacity cell. Underlying in-table-editing pattern needs an owner decision |
| DEV-5 Gantt board built to spec | `src/features/ppic/components/PapanGantt.tsx` | **in force** | Product owner (26 Aug 2026) | `@carbon/charts` not installed; Carbon states Gantt is a spec, not a component |
| DEV-6 two-column value list in PPIC detail modal | `app/(shell)/ppic/ppic.scss:200` | **in force** | Claude Code | **Display surface, not a form** — the one-column form rule does not apply |
| DEV-7 single `lg` modal | `DocumentsPage.tsx:538`; guard allow-list | **in force** | Claude Code | Document preview only; the sole `size="lg"` modal in the repository |

**None of the seven was found obsolete at this commit.**

---

## 6. Open conflicts blocking assignment

| Canonical ID | Document path | Status | Owner | Related scope |
|---|---|---|---|---|
| CONFLICT-1 | `RECONCILIATION-2026-08-27.md` §5 | **decision required** | **Product owner** | `DS-06` says replace `window.confirm` *during each page's migration*; the audit said sweep now at P0. Both cannot hold |
| CONFLICT-2 | same | **decision required** | **Product owner** | Three homes for binding decisions: `CLAUDE.md`, `build_tasks`, and the proposed `UX-YYYY-NNN` |
| CONFLICT-3 | same | **decision required** | **Product owner** | `DS-06` vs `AUD-47` both track destructive confirmation |
| CONFLICT-4 | same | **decision required** | **Product owner** | Ownership model: `03-fabrix-ux-governance.md` §9 vs `CLAUDE.md` autonomy rules |

---

## 7. Repository state when this register was generated

```
$ git rev-parse --short HEAD   → 7ce6e3c
$ git diff --stat              → (empty)
$ git diff --name-only         → (empty)
$ git status --short           → 3 untracked files, all under docs/
```

**READ-ONLY. NO APPLICATION CODE CHANGED.**
