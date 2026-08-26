# FABRIX CURRENT UI/UX RECONCILIATION

**Date:** 27 August 2026 · **Mode:** READ-ONLY · **Role:** Repository Reconciliation Engineer

---

> ## ⚠ PREMISE CORRECTION — READ THIS FIRST
>
> The reconciliation brief states that the historical audit photographed the repository at
> commit `7ce6e3c` and that **"sejak commit tersebut, project telah mengalami perubahan
> signifikan"**, then lists twelve changes said to have happened since.
>
> **That is not what the repository shows.**
>
> ```
> $ git rev-parse --short HEAD        → 7ce6e3c
> $ git log --oneline 7ce6e3c..HEAD   → (empty — 0 commits)
> $ git status --short                → ?? docs/.../AUDIT-2026-08-27-asis-ui-ux.md
> ```
>
> `7ce6e3c` **is** current HEAD. There have been **zero commits since it**, and the only
> uncommitted change in the tree is the audit report itself. The historical audit was not a
> photograph of an older state — it was written **today, against this exact commit**.
>
> Therefore **every one of the twelve listed changes landed *before* `7ce6e3c`, not after**,
> and each is already accounted for in the audit. This does not make the brief wrong about
> the work having happened; it makes it wrong about *when* relative to the audit, which
> changes the answer to every reconciliation question.
>
> Consequence for this document: **"reconciliation" here means re-verifying each finding
> against HEAD and correcting the audit where the audit itself was wrong** — not measuring
> drift over time. Two audit errors were found this way and are corrected below (F-02 count,
> and the framing of F-06).
>
> Four specific numeric claims in the brief could not be reproduced. They are listed in §13
> with the counts that were measured instead, and — where the cause could be traced — the
> reason the claim probably arose.

---

## 1. Current Repository State

| Item | Value |
|---|---|
| Current commit | `7ce6e3c` — *DS-19: papan Gantt PPIC dibangun ulang menurut spesifikasi Carbon* |
| Current branch | `main` |
| Commits after `7ce6e3c` | **0** |
| Working tree | 1 untracked file: `docs/FABRIX-Carbon-UX-Governance/AUDIT-2026-08-27-asis-ui-ux.md`. No modified, staged, or deleted files. |
| Framework | Next.js **16.3.0**, App Router, Turbopack |
| React | **19.2.8** |
| TypeScript | yes (`npm run typecheck` clean at HEAD) |
| `@carbon/react` | declared `^1.114.0` → resolved **1.114.0** |
| `@carbon/icons-react` | declared `^11.86.0` → resolved **11.86.0** |
| `@carbon/styles` | transitive → resolved **1.113.0** (skew vs `@carbon/react`; no defect observed) |
| `@carbon/charts` | **not installed** |
| Other UI packages | `tailwindcss` 3.4.19, `sass` 1.103.1, `@dnd-kit/core` 6.3.1, `@radix-ui/react-{dialog,select,slot}`, `class-variance-authority`, `tailwind-merge`, `tailwindcss-animate`, `lucide-react`, `@tanstack/react-table` |
| Carbon feature flags | **none enabled.** `next dev` logs `enable-v12-dynamic-floating-styles is available but not enabled`; no `FeatureFlags` provider and no flag configuration in `carbon.scss`. |
| Theme | `g10`, emitted via `@include theme.theme(themes.$g10)` in `src/styles/carbon.scss`; `$css--font-face: false` (documented Turbopack workaround), IBM Plex through `next/font` |
| Token configuration | **two systems.** Carbon `--cds-*` from `@carbon/styles`; plus a shadcn/Tailwind HSL layer in `app/globals.css` (`--background`, `--foreground`, `--primary`, …) whose own comment states the values were hand-converted from Carbon sources |
| Local Carbon wrappers | `kepala-halaman` (Breadcrumb+title, 30 pages), `notifikasi`/`AreaNotifikasi` (ToastNotification, 6 pages), `modal-bertahap` (ProgressIndicator+ModalFooter, 4 pages), `layar-publik` (7 pages), `answer-basis`, `kpi-card`, `provenance-info-button` (19 pages) |
| Legacy custom UI | `src/components/ui/{button,input,select,card,dialog,table,badge,data-table}.tsx` — shadcn/Radix generation |
| Custom CSS/SCSS | `src/styles/carbon.scss` + 20 route-level `app/(shell)/*/*.scss` + `src/features/ppic/components/papan-gantt.scss` + `app/globals.css` |
| Styling overrides of Carbon | one documented: `.ppic-kapasitas .cds--number input[type='number'] { min-inline-size: 0 }`, overriding Carbon's `min-inline-size: 9.375rem` (`@carbon/styles/scss/components/number-input/_number-input.scss:65`) |
| Design-system guards | `tests/elemen_mentah_halaman_internal.test.ts` (9 assertions), `tests/layar_publik_carbon.test.ts`, `tests/sudut_tajam_carbon.test.ts` |
| Test infrastructure | Vitest, 63 files, **378 passed / 7 skipped / 0 failed** at HEAD |
| Visual regression | **none.** No Storybook, no screenshot baselines, Playwright not a project dependency |

**Version rule applied:** installed versions above were read from `node_modules`, not from the
`package.json` ranges, and Carbon's own SCSS source was read from `node_modules` wherever a
specific value mattered. No dependency, lockfile, migration, or source file was changed.

---

## 2. Historical Audit Context

The historical audit is `docs/FABRIX-Carbon-UX-Governance/AUDIT-2026-08-27-asis-ui-ux.md`,
produced earlier today against commit `7ce6e3c` — the same commit reconciled here.

`FABRIX-UX-DECISION-PACK.md` is **not present** in the repository and was not supplied as a
context document. Anything that depends on it is marked UNVERIFIED in §13.

Because audit and reconciliation share a commit, F-01…F-18 are used strictly as
**reconciliation identifiers**, exactly as the brief requires. They are mapped to the
repository's own canonical identifier families in §4 and are not carried forward as a second
tracking system.

---

## 3. F-01 — F-18 Reconciliation

| Historical ID | Current Status | Canonical ID | Evidence | Notes |
|---|---|---|---|---|
| F-01 parallel token system | **CONFIRMED** | NEW CANONICAL ID REQUIRED (next free: `DS-21`) | `app/globals.css` declares the HSL token layer; live usage measured at HEAD: `text-muted-foreground` 72, `text-foreground` 39, `text-primary` 29, `text-destructive` 18, `bg-muted` 11, `bg-background` 6, `bg-info-subtle` 2, `text-info-subtle-foreground` 2, `border-info` 1, `bg-card` 1 = **181 usages in 17 files** | The brief's "88 → 66 handwritten colors" could not be reproduced under any counting method — see §13.1 |
| F-02 destructive confirmation | **CONFIRMED — and the audit undercounted the pages while overcounting them in prose** | **`DS-06`** (primary) + `AUD-47` (overlapping subset) | `window.confirm` at `RoutingsPage.tsx:332`, `CustomersPage.tsx:224`, `PurchasingPage.tsx:372,487`, `SalesOrdersPage.tsx:365,403` = **6 sites in 4 files**. Carbon `danger` modal exists only at `ItemsPage.tsx:1552,1576` | The audit wrote "5 pages"; it is **4**. `DS-06` already records the exact distribution: *"Routing (1), Sales Order (2), Pelanggan (1), Purchasing (2)"*. See CONFLICT in §5 |
| F-03 no field-level validation | **CONFIRMED** | NEW CANONICAL ID REQUIRED | `invalidText` present in 5 of 128 files; `required` in 6, five of which are the public auth pages | Which fields are business-required is a product decision (§12) |
| F-04 contextual help fragmentation | **CHANGED** | `DS-10` (partial) + NEW CANONICAL ID REQUIRED for the canonical-mechanism decision | `FieldLabel` importers outside its own file: **0**. `ProvenanceInfoButton`: **19**. Carbon `Toggletip`: **3 files** (`ItemsPage`, `SetelanPerhitunganPage`, `AppShellCarbon`) | Audit said Toggletip in 2 files; re-verified at HEAD it is **3**. The brief's "FieldLabel ada pada 3 halaman" is a name collision — see §13.2 |
| F-05 dead shadcn layer | **CONFIRMED** | NEW CANONICAL ID REQUIRED | `card.tsx`, `select.tsx`, `data-table.tsx` — 0 importers. `button`/`input`/`table` — only the dead `data-table.tsx` plus `ConfirmAndSignModal.tsx`. `dialog.tsx` 2, `badge.tsx` 3 | |
| F-06 stepped-form threshold | **CHANGED — the finding is real, its framing was wrong** | **`DS-18`** (`menunggu_persetujuan`) | `PenandaLangkah` used by PO klien, Karyawan, Item, BOM. `ShipmentsPage.tsx:835` shows `label="Langkah 1 dari 2"` with no `ProgressIndicator` | The rule already exists and already rejects field count. See §9 |
| F-07 success feedback | **CONFIRMED** | NEW CANONICAL ID REQUIRED | `<AreaNotifikasi>` rendered in **6** pages: `ProfilePage:502`, `CustomerPurchaseOrdersPage:1116`, `ItemsPage:1590`, `BomsPage:950`, `HrDashboardPage:897`, `CompanySettingsPage:283`. `InlineNotification` in 37 files. `ToastNotification` imported only inside the shared component | AreaNotifikasi **is** canonical by rule, but adopted in 6 of 39 pages |
| F-08 three loading treatments | **CONFIRMED** | NEW CANONICAL ID REQUIRED | `DataTableSkeleton` 16 files, `SkeletonText` 22, bare "Memuat…" in 9 files | |
| F-09 no bulk actions / overflow menus | **CONFIRMED** | NEW CANONICAL ID REQUIRED (decision first) | 0 instances of `TableSelectAll`, `TableSelectRow`, `TableBatchActions`, `TableToolbarMenu`, `OverflowMenu` | Product decision, not a defect until decided (§12) |
| F-10 SalesOrdersPage partial migration | **CHANGED** | `DS-15` covers **only** the three raw tables and is `selesai`; the styling remainder has NO canonical ID → NEW CANONICAL ID REQUIRED | At HEAD: 1,234 lines, 78 hand-written Tailwind utilities (highest in repo), 2 `window.confirm`, 0 `helperText`, 4 "Memuat" strings, `Pagination` 1, `DataTable` 3, `.tabel-responsif--lebar` in use | `DS-15` closed the raw-table part; nothing tracks the rest |
| F-11 two CSS resets | **CONFIRMED** | folds into F-01's ID | `app/globals.css:1` `@tailwind base` over Carbon's reset | No specific defect traced |
| F-12 `hideLabel` breadth | **CONFIRMED (informational)** | none required | 30 occurrences across 15 files | Carbon-correct; needs per-site human judgement |
| F-13 no visual-regression infra | **CONFIRMED** | NEW CANONICAL ID REQUIRED | no Storybook, no baselines, Playwright absent from `package.json` | The three static guards are real and working, but prove nothing visual |
| F-14 Carbon version skew | **CONFIRMED** | none required | `@carbon/react` 1.114.0 vs `@carbon/styles` 1.113.0 | |
| F-15 very large page components | **CONFIRMED** | NEW CANONICAL ID REQUIRED | `PpicDashboardPage` 1,964 · `ItemsPage` 1,594 · `PurchasingPage` 1,408 · `SalesOrdersPage` 1,234 · `WorkOrdersPage` 1,189 · `CustomerPurchaseOrdersPage` 1,120 | |
| F-16 pagination gaps | **CONFIRMED, narrower than feared** | NEW CANONICAL ID REQUIRED (or close as intentional) | 14 of 16 table pages have `Pagination`. Missing: `BuildTasksPage`, `PpicDashboardPage`. `/customers`, `/documents`, `/team` **all have it** | Whether those two need it is a judgement, not an omission — see §8 |
| F-17 raw HTML governance | **ALREADY FIXED (governance) / CONFIRMED (residue)** | **`DS-16`** (`selesai`) + **`DS-20`** (`menunggu`) | Guard scans `src/features/**/pages/*.tsx` **and** `**/components/*.tsx`; debt list holds 3 items pointing at `DS-20`; quota mechanism proven both directions (2 → green, 1 → exactly 1 violation) | `<form>` is outside guard scope — Carbon does not mandate its `Form` component, so this is a scope note, not a violation |
| F-18 NumberInput min-width override | **CONFIRMED as intentional** | none required | override in `app/(shell)/ppic/ppic.scss`; Carbon source at `_number-input.scss:65` | Class G — documented deviation |

---

## 4. Canonical Identifier Mapping

Repository identifier families in use (read from `build_tasks`, company_id 1): `ABS AIP AIR
AR AUD BSL DOC DPY DS FIN FND GDG HR INF KMS KPI KRM MLV MRG MST NAV OVR PJL PLT PMB PMN PRD
PRF PRV QMS RBD RDM SEC SLS`. Highest numbers: **`DS-20`**, **`AUD-48`**, **`MST-35`**,
**`RSP-02`**. Next free would be `DS-21` and `AUD-49` — **stated as fact, not claimed**. No
new identifier was created by this reconciliation.

| Historical Finding | Canonical ID | Existing/New | Reason |
|---|---|---|---|
| F-02 destructive confirmation | **`DS-06`** | Existing | *"window.confirm masih dipakai di Routing (1), Sales Order (2), Pelanggan (1), Purchasing (2)"* — matches the measurement exactly |
| F-02 (Routing subset + a guard) | `AUD-47` | Existing | Covers `RoutingsPage.tsx:332` plus an unrelated guard. **Overlaps `DS-06`** — see §5 CONFLICT-3 |
| F-04 raw-button part | `DS-10` | Existing | *"ProvenanceInfoButton Masih Tombol Mentah"* |
| F-04 canonical-mechanism decision | — | **NEW CANONICAL ID REQUIRED** | No existing task asks *which* help mechanism wins |
| F-06 stepped forms / modal rules | **`DS-18`** | Existing | *"Ukuran Modal & Jumlah Kolom Form Tidak Konsisten"*, `menunggu_persetujuan` |
| F-10 raw tables in Sales Order | `DS-15` | Existing (**closed**) | Scope was three raw tables only |
| F-10 remaining legacy styling | — | **NEW CANONICAL ID REQUIRED** | 78 Tailwind utilities untracked by any task |
| F-17 guard | `DS-16` | Existing (**closed**) | Guard built and proven |
| F-17 residue | **`DS-20`** | Existing | 3 raw elements in `components/`, recorded as debt inside the guard |
| F-12 / F-13 visual evidence | `DS-14` | Existing (**partially delivered**) | Two-edge, six-width measurement is implemented and in `cetakan-halaman-data.md` §6c/§6d; `DS-14` remains open for expanded-row tables |
| F-01, F-03, F-05, F-07, F-08, F-09, F-11, F-13, F-15, F-16 | — | **NEW CANONICAL ID REQUIRED** | No existing task covers them. Creating IDs requires owner authorisation per §7 of the brief |
| F-14, F-18, F-12 | — | None needed | Version note, documented deviation, informational |

Also open and adjacent, found while mapping — listed so they are not rediscovered later:
`DS-03` (Carbon migration ordering, awaiting owner), `DS-09` (`menunggu_persetujuan`),
`DS-17` (BOM has no delete/archive), `DS-19` (`sedang_dikerjakan`), `NAV-01` (navigation
architecture, awaiting owner), `RSP-02` (overflow-hidden guard).

---

## 5. Governance Rule Comparison

### ALREADY EXISTS

| New rule | Existing coverage |
|---|---|
| **C-001** Carbon is the visual source of truth | `CLAUDE.md` — "DS-RULES §D.1: seluruh ukuran, jarak, warna, tipografi memakai TOKEN Carbon. Nol angka px, nol nilai warna langsung" |
| **C-002** Reuse Carbon components | `CLAUDE.md` — "Dua Jalur Hidup untuk Hal yang Sama Adalah CACAT", enforced by `tests/elemen_mentah_halaman_internal.test.ts` |
| **C-003** Reuse Carbon patterns | `CLAUDE.md` — "DS-RULES §B.1: POLA MENENTUKAN KOMPONEN, BUKAN SEBALIKNYA" |
| **C-004** No arbitrary CSS overrides | `CLAUDE.md` — "DS-RULES §E.3: bila Carbon dinilai keliru, itu DEVIASI, didokumentasikan, bukan improvisasi diam-diam" |
| **C-005** No duplicate component implementations | `CLAUDE.md` — "Kebetulan Benar — Kelas Cacat Keempat" |
| **C-006** Component choice follows use case | `CLAUDE.md` — "DS-RULES §C.1: buka tab *Usage* LEBIH DULU" (the `Tag` misuse is the recorded example) |
| **C-007** Modal restraint | `docs/governance/cetakan-halaman-data.md` §6e "Memilih ukuran: dari ISI, bukan dari jumlah field" and §6e-2 |
| **C-009** Tables are task-oriented | `cetakan-halaman-data.md` §2, §3, §4; guard enforces responsive class, wide variant, pagination, empty state |
| **C-011** Do not fork Carbon | `CLAUDE.md` — "DS-RULES §E.3" |
| **C-012** Respect installed version | `CLAUDE.md` — "DS-RULES §D.2: nama token diverifikasi dari PAKET YANG TERPASANG, dan verifikasinya dengan MENJALANKAN" |
| **C-013** Explain deviations | `cetakan-halaman-data.md` §6 "Dua deviasi sadar — JANGAN diperbaiki"; `docs/governance/design-debt.md` |
| **C-014** Prefer tokens | same as C-001 |
| **C-016** No page-specific invention | `cetakan-halaman-data.md` §9 "KERANGKA HALAMAN BERSAMA" |
| UX governance §2 minimise cognitive load | `CLAUDE.md` — "Rasa Bingung Pemilik Produk Adalah ALAT DETEKSI"; field classes A/B/C |
| UX governance §3 primary action | `CLAUDE.md` — modal rule 9: destructive actions physically separated |
| UX governance §7 consistency | `cetakan-halaman-data.md` in full |
| Audit methodology Phase J priorities | `build_tasks.urgency` (`super_urgent`/`penting`/`bisa_menunggu`) |

**Nothing above should be re-adopted.** Adding a second wording of an existing rule is the
"two live paths" failure the repository already guards against.

### NEW AND WORTH ADOPTING

| New rule | Why it adds something |
|---|---|
| **C-008** Every field classified as required / common optional / optional / advanced / system-generated / derived / contextual / deprecated | The repository has an informal A/B/C classification for *usefulness*, but nothing that classifies a field by *obligation*. This is the missing structure behind F-03, and it is exactly what would let `required`/`invalidText` be applied without guessing. |
| **C-010** Accessibility review of the composition, not just the component | Existing rules cover touch targets (44px) and click-not-hover help. Focus order, screen-reader labels, and error announcement are not covered anywhere. |
| **C-015** Same user action uses consistent Carbon semantics across modules | Implied by the page template but never stated as a cross-module rule. F-02 and F-07 are both instances of its absence. |
| Audit methodology Phase I classification A–H | The repository has urgency but no *finding type*. A/B/C/D/E/F/G/H would let "Carbon violation" be distinguished from "product decision" in the task list itself. |
| `05-ux-decision-records.md` `UX-YYYY-NNN` format | The repository records decisions inside `CLAUDE.md` prose and inside task rows. A dedicated decision-record format would make superseded decisions visible. **Note the collision risk** — see CONFLICT-2. |
| Report template §13 "Repository changes: NONE" | Makes read-only audits falsifiable. Adopting it costs nothing. |

### CONFLICT / DECISION REQUIRED

**CONFLICT-1 — F-02 remediation timing contradicts a recorded owner decision.**
The audit put F-02 at **P0** with the next step *"replace with the Carbon danger modal"*.
`DS-06` already carries a different, deliberate instruction:

> *"Ganti Modal danger Carbon **SAAT halaman masing-masing dimigrasikan** — bukan sebagai
> penyisiran tersendiri. Alasannya: perubahannya baru bisa diperiksa bersama layarnya."*

Both cannot be followed. Either the sweep happens now (audit) or it waits for each page's
migration (`DS-06`). **DECISION REQUIRED.** Do not resolve this silently — the existing
decision has a stated reason, and the audit did not know about it.

**CONFLICT-2 — two decision-record systems.**
`05-ux-decision-records.md` introduces `UX-YYYY-NNN`. The repository already records
binding decisions in `CLAUDE.md` (rule sections dated by decision) and in `build_tasks`
rows. `CLAUDE.md` states the reason explicitly: *"Task menyimpan PEKERJAAN; CLAUDE.md
menyimpan ATURAN … aturan yang hanya hidup di task punya umur simpan pendek."* Adopting a
third location needs an explicit rule about which one wins. **DECISION REQUIRED.**

**CONFLICT-3 — duplicate canonical IDs for the same defect.**
`DS-06` (all six `window.confirm` sites) and `AUD-47` (the Routing site plus an unrelated
guard) both track the same code. Whichever survives, the other should reference it.
**DECISION REQUIRED** — this is identifier governance, which §7 of the brief reserves.

**CONFLICT-4 — governance ownership model does not match this repository.**
`03-fabrix-ux-governance.md` §9 assigns UX/IA/Carbon-compliance ownership to ChatGPT and
implementation strategy to Claude Chat. `CLAUDE.md` currently grants Claude Code autonomy
over technical decisions provided they are recorded, and reserves business rules for the
owner. The two models overlap on "component mapping" and "interaction strategy".
**DECISION REQUIRED** — otherwise the same question has two owners.

---

## 6. Documented Deviations

| Deviation | Current State | Still Needed? | Evidence | Action |
|---|---|---|---|---|
| 1. Table → stacked cards below 672px (and 1056px for ≥8 columns) | **Active** | **Yes** | `.tabel-responsif` defined 3× in `src/styles/carbon.scss`, used in **16** feature pages; guard fails any `<Table>` without it | **KEEP.** Carbon has no equivalent; removing it reintroduces the truncation class that produced RSP-01/RSP-02 |
| 2. Full-width content instead of Carbon grid | **Active** | **Yes** | `app/(shell)/shell.scss:10` — *"AREA ISI — DEVIASI RESMI LEBAR PENUH"* | **KEEP.** Owner decision, 25 Aug 2026; reason (ERP column density) unchanged |
| 3. Two-level breadcrumb | **Active** | **Yes** | `cetakan-halaman-data.md` §6a; `kepala-halaman.tsx` is the single implementation | **KEEP** |
| 4. PPIC `NumberInput` width override | **Active** | **Yes, while in-table editing stands** | `app/(shell)/ppic/ppic.scss`; Carbon source `_number-input.scss:65` sets `min-inline-size: 9.375rem` | **KEEP the override; the underlying pattern is a decision** (§12.5). The override is evidence that Carbon's `NumberInput` was not designed for narrow in-cell use |
| 5. Gantt board | **Active, rebuilt at HEAD** | **Yes** | `src/features/ppic/components/PapanGantt.tsx` + `papan-gantt.scss`; registered in the raw-element guard's exception list with reason | **KEEP.** Carbon's own page states Gantt is a specification, not a component, and `@carbon/charts` is not installed |
| 6. PPIC detail modal two-column value list | **Active** | **Yes** | `.ppic-daftar-nilai` in `ppic.scss:200`, used once in `PpicDashboardPage` | **KEEP.** This is a **display/detail surface, not a form** — the one-column form rule does not apply to it. Recorded here because the distinction is easy to lose |
| 7. Single `size="lg"` modal for document preview | **Active** | **Yes** | `DocumentsPage.tsx:538` is the **only** `<ComposedModal size="lg">` in the repository; guard allow-lists it | **KEEP.** A preview surface is content, not a form |

**No deviation was found obsolete.** None was removed, weakened, or re-argued.

---

## 7. Completed Since `7ce6e3c`

**Nothing.** Zero commits exist after `7ce6e3c`, and the working tree contains only the
untracked audit report.

The twelve items the brief lists as "since `7ce6e3c`" are verifiable in the repository but
landed **before** that commit. They are recorded here with canonical IDs and evidence
because the reconciliation needs them anchored correctly in time.

| Canonical ID | Work | Evidence | Status |
|---|---|---|---|
| `DS-09` | Carbon applied across the page set | 39 of 39 feature pages import `@carbon/react`; 0 pages without | **verified** — task itself is `menunggu_persetujuan`, not closed |
| `DS-16` | Raw-markup governance + guard | `tests/elemen_mentah_halaman_internal.test.ts`, 9 assertions, scope covers `pages/` and `components/` | **verified**, task `selesai` |
| `DS-14` | Two-edge / six-width visual evidence | `cetakan-halaman-data.md` §6c and §6d; measurement script measures left edge, right edge, and horizontal scroll | **verified as partially delivered**, task still `menunggu` for expanded-row tables |
| `DS-18` | Modal size and form-column rules | `cetakan-halaman-data.md` §6e, §6e-2, §6e-3; `src/components/ui/modal-bertahap.tsx` | **verified**, task `menunggu_persetujuan` |
| — | `AreaNotifikasi` built | `src/components/ui/notifikasi.tsx`; rendered in 6 pages | **verified** (no canonical ID found for the component itself) |
| `AUD-47` | Destructive confirmation (Routing) | task exists; **code unchanged** — `RoutingsPage.tsx:332` still calls `window.confirm` | **CLAIMED BUT NOT VERIFIED as done.** The task was created; the fix was not applied |
| `DS-15` | Sales Order raw tables | task `selesai`; `SalesOrdersPage` now uses `Table` + `.tabel-responsif--lebar` at lines 631, 1177 | **verified for its stated scope only** |
| — | Pagination on `/customers`, `/documents`, `/team` | all three render `<Pagination>` | **verified** |
| `DS-18` | Stepped form on PO klien | `PenandaLangkah` in `CustomerPurchaseOrdersPage`, plus Karyawan, Item, BOM | **verified — four pages, not one** |
| — | Modal `lg` reduced to 1 | exactly one `<ComposedModal size="lg">` (`DocumentsPage:538`) | **verified at 1.** The prior figure of 8 could not be checked — no commit in range shows it |
| — | Parallel Tailwind/shadcn tokens reduced | 181 usages remain in 17 files | **verified as still present.** "Reduced" is plausible but the claimed magnitudes do not reproduce — §13.1 |
| — | Contextual help changed | `FieldLabel` 0 importers, `ProvenanceInfoButton` 19, `Toggletip` 3 | **verified as unchanged in the direction claimed** — §13.2 |

---

## 8. Still Open

- **F-01 / F-11** — parallel token system and second CSS reset. 181 usages, 17 files.
- **F-02** — 6 `window.confirm` sites in 4 files. Tracked as `DS-06`; **timing is in conflict** (§5).
- **F-03** — field-level validation absent (`invalidText` 5 files, `required` 6).
- **F-05** — dead shadcn layer; 3 files with zero importers, 3 live holdouts.
- **F-07** — success feedback: canonical mechanism exists, adopted in 6 of 39 pages.
- **F-08** — bare "Memuat…" in 9 files.
- **F-09** — no row selection / bulk actions / overflow menus. **Decision first.**
- **F-10 remainder** — 78 hand-written Tailwind utilities in `SalesOrdersPage`, untracked.
- **F-13** — no visual-regression gate.
- **F-15** — six page components over 1,100 lines.
- **F-16** — 2 of 16 table pages without pagination. **Judgement, not automatic.**
- **F-04 decision** — which contextual-help mechanism is canonical.

## 9. Partially Resolved

- **F-06 / `DS-18`** — the rule exists and is written (`cetakan-halaman-data.md` §6e-2), the
  shared component exists (`modal-bertahap.tsx`), and four modals use it. What remains is
  application to the rest, and one flow (`ShipmentsPage`) that announces two steps without a
  progress indicator. Task status `menunggu_persetujuan`.
- **F-17 / `DS-16` + `DS-20`** — governance built, proven, and enforced; three raw elements
  remain, recorded as debt with a shrink-only list.
- **F-04 / `DS-10`** — the raw-button half is tracked; the "which mechanism wins" half is not.
- **F-10 / `DS-15`** — raw tables closed; styling remainder untracked.
- **`DS-14`** — two-edge measurement delivered and written into the page template; expanded-row
  tables not yet measured.

## 10. Closed

- **`DS-16`** — raw-markup guard exists, is enforced, and its debt quota was proven in both
  directions (allowance 2 → passes; allowance 1 → reports exactly 1 violation).
- **`DS-15`** — three raw tables in Sales Order, for that scope only.
- **F-18** — Carbon `NumberInput` override: intentional, documented, evidenced against
  Carbon's own source.
- **F-14** — version skew: recorded, no defect observed.

---

## 11. Current UX/UI Risk

Priorities below are derived from evidence at HEAD, not inherited from the audit.

**P0 — none.**
The audit assigned P0 to F-02. Reconciliation **lowers it to P1**, for a reason discovered
during this pass and not available to the audit: `DS-06` records an owner decision that these
replacements happen with each page's migration, and gives a defensible reason (the change can
only be verified alongside its screen). A P0 that contradicts a recorded decision is not a P0
— it is an unresolved conflict, and it is filed as CONFLICT-1.

**P1**

1. **F-02** — six irreversible actions confirmed by a browser dialog that cannot state whether
   the record will be deleted or deactivated, while the correct pattern already exists one
   file away. Blocked on CONFLICT-1, not on knowing what to do.
2. **F-03** — no field-level validation. The largest forms (19, 15, 14 fields) are exactly
   where a page-level error message costs the most.
3. **F-01** — two token systems. Silent divergence; no test or build can catch it.

**P2**

4. **F-07** — success feedback inconsistent; a rule exists and is followed in 6 of 39 pages.
5. **F-04** — three help mechanisms; the mandated one is unused (decision required).
6. **F-06 remainder** — one flow claims steps it does not show.
7. **F-13** — every visual claim is hand-made per session and then discarded.
8. **F-05**, **F-08**, **F-10 remainder**, **F-15**.

**P3**

9. **F-12** (`hideLabel` review), **F-14** (version alignment), **F-16** (2 pages),
   **F-17 residue** (`DS-20`).

**Risk not captured by any finding, stated because silence would imply it was checked:**
contrast ratios, real screen-reader behaviour, and actual keyboard traversal remain unmeasured.
The Gantt board's drag-to-reschedule has no keyboard equivalent.

---

## 12. Decisions Required

1. **CONFLICT-1 — `window.confirm` timing.** Sweep all six sites now, or keep `DS-06`'s
   per-page rule? The existing decision has a stated reason; overriding it is the owner's call.
2. **CONFLICT-2 — where binding decisions live.** `CLAUDE.md`, `build_tasks`, or the new
   `UX-YYYY-NNN` records. One must win.
3. **CONFLICT-3 — `DS-06` vs `AUD-47`.** Which identifier owns the destructive-confirmation work.
4. **CONFLICT-4 — ownership model.** `03-fabrix-ux-governance.md` §9 vs `CLAUDE.md` autonomy rules.
5. **F-03 — business-required fields.** Which fields the system should refuse to record without,
   per form, and what each rejection says. Domain knowledge; not inferable from code.
6. **F-04 — canonical contextual-help mechanism.** `FieldLabel` (mandated, unused),
   `ProvenanceInfoButton` (19 pages, built on the legacy layer), or Carbon `Toggletip` (3 pages).
   Note: provenance panels answer *"where did this number come from"*, which is not the same
   question as field help — **they should not be assumed interchangeable**.
7. **F-09 — bulk operations.** Does the workflow require multi-record approve/archive/assign?
   If not, the current design should be recorded as deliberate rather than left looking forgotten.
8. **F-18 / deviation 4 — in-table editing.** Carbon states the data table is not a spreadsheet
   replacement. Work-centre capacity is edited in-row. Whether that stays is a workflow question
   (how often does capacity change?), not a styling one.
9. **New canonical IDs.** Ten findings have no canonical ID. Next free numbers are `DS-21` and
   `AUD-49`. No ID was created by this reconciliation.
10. **Adoption of C-008, C-010, C-015, and the A–H classification** (§5 "New and worth adopting").

---

## 13. Unverified / Unable to Verify

### 13.1 "88 handwritten colors → now ~66" — NOT REPRODUCIBLE

Counted three ways at HEAD:

| Method | Result |
|---|---|
| Hex literals in all `.tsx`/`.ts`/`.scss`/`.css` under `src/` and `app/` | **25** across 4 files |
| …of which are **live code** rather than explanatory comments | **10**, all in `src/features/mrp/components/NotificationBell.tsx` (`#c6c6c6`, `#e0e0e0`, `#161616`, …) |
| `rgb()`/`rgba()`/`hsl()` literals | 4 / 0 |
| shadcn semantic colour utilities (`text-muted-foreground` etc.) — the closest thing to "a second colour system still in use" | **181** across 17 files |

The other 15 hex strings sit inside comments explaining Carbon conversions
(`app/globals.css` 12, `layar-publik.tsx` 2, `carbon.scss` 1) and were excluded, since a
comment describing a colour is not a hard-coded colour.

No counting method produces 66 or 88. **UNVERIFIED** — if the figure came from a different
definition, supply it and it will be recounted rather than argued about.

### 13.2 "FieldLabel ada pada 3 halaman" — NOT REPRODUCIBLE, and the cause is traceable

Grepping `FieldLabel` returns hits in three files, so the claim is understandable. All of
them are **`getFieldLabel`**, an unrelated function exported by `src/lib/glossary.ts:281`
that converts a database column name into an Indonesian label. It is used in
`DebugPage.tsx` and `TestTenantPage.tsx` for table headings.

The help component `FieldLabel` in `src/components/ui/field-help.tsx:35` has **zero
importers**. The two share a substring and nothing else. **Finding F-04 stands.**

### 13.3 "Modal `lg` diturunkan dari 8 menjadi 1"

The current figure of **1** is verified (`DocumentsPage.tsx:538`). The prior figure of 8
cannot be checked: no commit exists in the stated range, and no earlier count is recorded in
the repository. **UNVERIFIED as a delta; verified as a current state.**

### 13.4 `FABRIX-UX-DECISION-PACK.md`

Not present in `docs/`, not supplied as context. Anything depending on it is **UNVERIFIED**.

### 13.5 "ProvenanceInfoButton pada 17 lokasi"

Measured **19** importing files at HEAD. Close, and possibly a different counting basis
(pages vs files, or excluding `src/components/ui/*`). Recorded so the number in circulation
is corrected rather than repeated.

### 13.6 Corrections to the audit itself

- **F-02 said "5 pages"; it is 4** (`RoutingsPage`, `CustomersPage`, `PurchasingPage`,
  `SalesOrdersPage`) with 6 call sites. `DS-06` had it right all along.
- **F-04 said Carbon `Toggletip` in 2 files; it is 3** (`ItemsPage`,
  `SetelanPerhitunganPage`, `AppShellCarbon`).
- **F-06's framing was wrong.** The audit reasoned from field count. `cetakan-halaman-data.md`
  §6e-2 already forbids exactly that — see §9 below. The underlying inconsistency is real; the
  lens was not.

### 13.7 Not measurable by static analysis

Contrast ratios · screen-reader output · keyboard traversal order · whether an error message,
helper text, or empty state is *correct* rather than merely present · runtime behaviour of any
screen. **No screen was opened during this reconciliation.**

---

## §9 (brief) — Stepped Form Rule Conflict Check

**Result: SEAMLESS / CONSISTENT — with one correction, and it lands on the audit, not the repository.**

The new governance says field count must not be the sole threshold for a stepped form. The
repository's existing owner decision, `cetakan-halaman-data.md` §6e-2 (26 Aug 2026), already
says something stronger, quoting Carbon's own warning:

> *"A progress modal is not a solution for excess modal content. It should only be used to
> present information in more consumable and focused chunks."*

and turning it into a test that has nothing to do with counting:

> *"UJI SEBUAH BAGIAN SAH ATAU TIDAK: bagian itu bisa diberi judul yang **menyebut satu hal**,
> dan setiap field di dalamnya menjawab hal itu. Bila judulnya terpaksa berbunyi 'Lanjutan'
> atau 'Bagian 2', pemecahannya salah — itu memuatkan, bukan mengelompokkan."*

The owner decisions for **PO klien, Karyawan, Item, and BOM** were made on that basis and are
verifiable in the code: Karyawan is Identitas / Gaji / Pajak & BPJS; Item is Identitas /
Satuan / Persediaan; BOM is Resep / Komponen. Each section names one thing.

**No conflict with the repository. The conflict is with the audit**, whose F-06 reasoned from
field count ("modals of 7–10 fields are single-scroll while 12–19 step"). That framing is
retired here. What survives F-06 is narrower and still true:

- `ShipmentsPage.tsx:835` tells the user there are two steps and shows no indicator — this is
  a defect under the existing rule, not under a new one.
- Whether `CustomersPage`, `PurchasingPage`, `WorkOrdersPage`, and `DocumentsPage` contain
  more than one context each is a judgement to be made per form against the §6e-2 test, not
  a threshold to be set.

**No product-owner decision was deleted, weakened, or reinterpreted.**

---

## 14. Repository Changes

```
$ git status --short
?? docs/FABRIX-Carbon-UX-Governance/AUDIT-2026-08-27-asis-ui-ux.md
?? docs/FABRIX-Carbon-UX-Governance/RECONCILIATION-2026-08-27.md

$ git diff --stat        → (empty)
$ git diff --name-only   → (empty)
```

**READ-ONLY AUDIT**
**NO APPLICATION CODE CHANGED**

Both untracked files are documentation under `docs/`. Nothing under `src/`, `app/`,
`tests/`, `supabase/`, `package.json`, or any lockfile or config was created, modified, or
deleted. No migration was run. No dependency was changed. No finding was fixed.
