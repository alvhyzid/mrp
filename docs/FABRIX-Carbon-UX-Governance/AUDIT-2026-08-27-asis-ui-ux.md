# FABRIX UI/UX AS-IS AUDIT REPORT

**Audit date:** 27 August 2026
**Auditor:** Claude Code (read-only audit per `06-claude-code-asis-audit-prompt.md`)
**Commit audited:** `7ce6e3c`
**Report format:** `11-audit-report-template.md`

> **Method note.** Every number in this report was produced by scanning the repository at the
> commit above, not estimated. Comment blocks were stripped before counting so that prose
> describing a pattern is never counted as an instance of it. Where a scan produced a false
> positive, that is stated in place rather than silently dropped.

---

## 1. Executive summary

### Repository

FABRIX — a multi-tenant manufacturing MRP SaaS. Monorepo-less single Next.js application.

Scanned surface:

| Item | Count |
|---|---:|
| TSX files under `src/` and `app/` | 128 |
| Feature page components (`src/features/**/pages/*.tsx`) | 39 |
| Route pages (`app/**/page.tsx`) | 39 |
| Route layouts (`app/**/layout.tsx`) | 29 |
| API routes (`app/api/**/route.ts`) | 120 |
| Feature domains (`src/features/*`) | 17 |
| Shared UI components (`src/components/ui/*`) | 16 |
| Vitest test files | 63 (378 passing, 7 skipped at audit time) |

### Framework

- Next.js **16.3.0**, App Router, Turbopack
- React **19.2.8**, TypeScript
- Sass **1.103.1**
- Tailwind CSS **3.4.19** — still installed and active (see F-01, F-11)

### Carbon version

| Package | Declared | Resolved |
|---|---|---|
| `@carbon/react` | `^1.114.0` | **1.114.0** |
| `@carbon/icons-react` | `^11.86.0` | **11.86.0** |
| `@carbon/styles` | (transitive) | **1.113.0** |

`@carbon/charts` is **not installed**. This matters for any data-visualisation work: Carbon's
Gantt specification explicitly states the charts are not part of the `carbon-charts` library,
and the data-visualisation colour tokens live in that package, so they are unavailable here.

### Theme

`g10`, emitted explicitly through the official theme mixin rather than through
`@use ... with ($theme:)`:

```scss
// src/styles/carbon.scss
@use '@carbon/styles/scss/config' with ($css--font-face: false);
@use '@carbon/styles/scss/themes';
@use '@carbon/styles/scss/theme';
@include theme.theme(themes.$g10);
```

`$css--font-face: false` is deliberate and documented: Carbon emits `url('~@ibm/plex/...')`,
a webpack-specific prefix that Turbopack cannot resolve (90 build errors). IBM Plex is loaded
through `next/font` instead. **This is a correct and well-reasoned deviation.**

### Overall assessment

Carbon adoption is **substantially complete and, in most respects, correctly done**. All 39
feature pages import Carbon components. The application shell is genuine Carbon UI Shell with
`SkipToContent` and labelled global actions. Tables, modals, notifications, and skeletons are
Carbon components rather than reimplementations. Raw HTML control usage is very low (11
`<button>`, 5 `<input>`, 4 `<table>` instances across 128 files), and the exceptions that
remain are registered in an automated guard with recorded justification.

The problems that do exist are **not "Carbon was not adopted"**. They are:

1. A **second, parallel design-token system** that was never removed (F-01).
2. **Inconsistent treatment of identical user actions across modules** — most visibly
   destructive delete (F-02) and success feedback (F-07).
3. **Field-level validation is largely missing**, so errors surface at page level (F-03).
4. Several **shared components that were mandated but never adopted**, next to competing
   mechanisms that were (F-04, F-05).

None of these are cosmetic. Items 2 and 3 change how a user understands whether their action
succeeded or which field is wrong.

### Top 10 risks

| ID | Severity | Category | Finding | Evidence |
|---|---|---|---|---|
| F-01 | HIGH | A/F | Two parallel design-token systems; Carbon values hand-copied into a Tailwind HSL layer | `app/globals.css:1-25`, `tailwind.config.ts:17-30`, 17 files / ~181 utility usages |
| F-02 | HIGH | A/E | Native `window.confirm()` used for permanent deletion in 5 pages, while one page already uses a Carbon danger modal | `RoutingsPage.tsx:332`, `SalesOrdersPage.tsx:365,403`, `PurchasingPage.tsx:372,487`, `CustomersPage.tsx:224` vs `ItemsPage.tsx:1545` |
| F-03 | HIGH | A/B | Field-level validation essentially absent: `invalidText` in 5 of 128 files, `required` in 6 | scan of all TSX |
| F-04 | MEDIUM | F/C | Three competing help mechanisms; the one mandated by project rule has **zero** adopters | `src/components/ui/field-help.tsx:35` (0 importers) vs `provenance-info-button` (19 files) vs Carbon `Toggletip` (2 files) |
| F-05 | MEDIUM | F | Dead shadcn/Radix layer still in tree and in `package.json` | `card.tsx`, `select.tsx`, `data-table.tsx` — 0 importers |
| F-06 | MEDIUM | B/C | No defined threshold for when a form becomes a stepped modal; one two-step flow has no progress indicator at all | `ShipmentsPage.tsx:835` (`label="Langkah 1 dari 2"`) |
| F-07 | MEDIUM | B | Success feedback inconsistent: shared toast used in 6 of 39 pages, inline notification in 37 | `AreaNotifikasi` grep |
| F-08 | MEDIUM | D | Three different loading treatments, including bare "Memuat…" text in 9 files | grep |
| F-09 | MEDIUM | C | Zero row selection, zero bulk actions, zero overflow menus across all 16 table pages | scan |
| F-13 | MEDIUM | F | No visual-regression infrastructure: no Storybook, no screenshot baselines, Playwright not a project dependency | `package.json`, `tests/` |

---

## 2. Architecture

### UI architecture

Routing is App Router with two route groups:

- `app/(public)/` — login, register, forgot/reset password, invite, POD confirmation
- `app/(shell)/` — 26 authenticated application areas
- `app/shipments/[shipmentId]/surat-jalan/` — a print-only route deliberately outside the shell

`app/**/page.tsx` files are thin routing wrappers that re-export from `src/features/<domain>/pages/`.
This separation is consistently honoured for pages. For API routes it is partially honoured
(the repository's own documentation records which routes still contain business logic inline).

**Shell:** `src/features/navigasi/AppShellCarbon.tsx` uses Carbon `Header`, `HeaderName`,
`HeaderGlobalBar`, `HeaderGlobalAction`, `HeaderPanel`, `SideNav`, `SideNavMenu`,
`SideNavLink`, `Switcher`, `Theme`, and `SkipToContent`. Global actions carry `aria-label`.
This is genuine UI Shell usage, not a reimplementation.

**Page header:** a shared `KepalaHalaman` component (`src/components/ui/kepala-halaman.tsx`)
wraps Carbon `Breadcrumb`/`BreadcrumbItem` plus title and intro text. **30 of 39** feature
pages use it. The 9 that do not are the public auth pages, the POD page, and the print page —
all legitimately outside the shell.

### Component architecture

`src/components/ui/` holds 16 shared components of three distinct generations:

| Generation | Files | Live importers |
|---|---|---:|
| Carbon-era shared components | `kepala-halaman`, `notifikasi`, `modal-bertahap`, `layar-publik`, `field-help`, `answer-basis`, `kpi-card` | 30 / 6 / 4 / 7 / **0** / 2 / 1 |
| Hybrid (Carbon + hand-written Tailwind) | `provenance-info-button` | 19 |
| Legacy shadcn/Radix | `button`, `input`, `select`, `card`, `dialog`, `table`, `badge`, `data-table` | 2 / 1 / **0** / **0** / 2 / 1 / 3 / **0** |

### Styling/token architecture

Two systems coexist:

1. **Carbon** — `src/styles/carbon.scss` configures and emits the g10 theme; route-level
   `.scss` files under `app/(shell)/<area>/` add area-specific classes built from Carbon
   spacing/type/theme tokens.
2. **Tailwind + shadcn HSL tokens** — `app/globals.css` declares `--background`,
   `--foreground`, `--primary`, `--muted`, and so on, *hand-converted from Carbon values*.
   The file's own comment says so explicitly.

Tailwind's `content` globs still cover `./app/**` and `./src/**`, and `@tailwind base`
(preflight) is active, so a second CSS reset is layered over Carbon's.

Hard-coded hex colours are nearly eliminated: **1 file, 10 occurrences**
(`src/features/mrp/components/NotificationBell.tsx`).

### Custom wrapper architecture

Wrappers are thin and mostly justified. Two carry hand-written Tailwind rather than tokens:
`provenance-info-button.tsx` (38 utility usages) and `field-help.tsx` (6).

### Test/visual regression architecture

- 63 Vitest files; 378 passing, 7 skipped at the audited commit.
- Three of them are **custom Carbon governance guards**, which is unusual and valuable:
  - `tests/elemen_mentah_halaman_internal.test.ts` — fails on raw `<button>/<input>/<table>/<select>/<textarea>` in feature pages and components, on `<Table>` without a responsive class, on wide tables without the wide variant, on missing pagination, and on `size="lg"` modals outside an allow-list. Exceptions require an in-file marker and file registration; known debt is tracked in a list that may only shrink.
  - `tests/layar_publik_carbon.test.ts` — public-screen Carbon conformance.
  - `tests/sudut_tajam_carbon.test.ts` — fails on any new `border-radius: 50%/9999px` outside a justified allow-list.
- **No Storybook. No screenshot baselines. Playwright is not a project dependency.** Visual
  evidence is produced ad hoc per working session and is not retained as a regression gate.

---

## 3. Carbon inventory

Counts are "files importing the component / total JSX instances", measured with comments stripped.

| Component | Carbon equivalent | Files | Instances | Custom wrapper | Deviation | Notes |
|---|---|---:|---:|---|---|---|
| InlineNotification | native | 37 | 124 | — | — | Dominant feedback mechanism |
| Button | native | 33 | 183 | legacy `button.tsx` (2 importers) | — | Legacy version nearly dead |
| Tag | native | 26 | 77 | — | — | Used for status; see §7 |
| TextInput | native | 24 | 111 | legacy `input.tsx` (1) | — | |
| SkeletonText | native | 22 | 43 | — | — | |
| Dropdown | native | 19 | 82 | legacy `select.tsx` (0) | — | Carbon `Select` used once |
| Tile | native | 18 | 41 | legacy `card.tsx` (0) | — | |
| DataTableSkeleton | native | 16 | 43 | — | — | |
| Table family | native | 16 | 39 tables / 160 cells | legacy `table.tsx` (1) | — | |
| DataTable | native | 15 | 18 | legacy `data-table.tsx` (0) | — | |
| TableToolbar + ToolbarSearch | native | 15 | 16 | — | — | Consistent |
| Pagination | native | 14 | 14 | — | — | Missing on 2 of 16 table pages |
| ComposedModal | native | 13 | 18 | legacy `dialog.tsx` (2) | — | |
| NumberInput | native | 11 | 36 | — | see F-18 | Carbon `min-inline-size: 9.375rem` fights narrow cells |
| StructuredList | native | 9 | 12 lists / 78 cells | — | — | Used for label/value detail panels |
| TableExpand* | native | 9 | 10 | — | — | |
| Checkbox | native | 7 | 8 | — | — | |
| FileUploader(Button) | native | 4+2 | 7 | — | — | |
| Modal | native | 3 | 4 | — | — | Small/danger confirmations only — correct |
| PasswordInput | native | 3 | 4 | — | — | |
| Toggletip | native | 2 | 2 | — | — | One of three help mechanisms |
| UI Shell family | native | 1 | 13 | — | — | Header/SideNav/Switcher/SkipToContent |
| Breadcrumb | native | 1 | 1 | `kepala-halaman` | — | Correctly centralised |
| Tabs | native | 1 | 1 | — | — | Only `WarehouseDashboardPage` |
| ProgressIndicator | native | 1 | 1 | `modal-bertahap` | — | Correctly centralised |
| ToastNotification | native | 1 | 1 | `notifikasi` (`AreaNotifikasi`) | position + timeout are project decisions | Carbon defines neither |
| DatePicker | native | 1 | 1 | — | — | Only one adopter |
| ContentSwitcher / Search / Layer / Accordion / CodeSnippet / RadioButton / MultiSelect / FormGroup / TextArea / InlineLoading | native | 1 each | 1–3 | — | — | Long tail |

**Raw HTML elements still present** (comments stripped):

| Element | Files | Instances | Status |
|---|---:|---:|---|
| `<form>` | 7 | 7 | Not guarded; Carbon `Form` is optional in Carbon's own guidance |
| `<button>` | 6 | 11 | 3 registered as recorded debt (task `DS-20`), 2 registered as justified exceptions |
| `<input>` | 3 | 5 | 1 recorded debt, rest inside legacy shadcn components |
| `<table>` | 3 | 4 | Print document + PPIC daily/monthly grids, all marked as exceptions |

---

## 4. Pattern inventory

| Pattern | Locations | Current approach | Carbon reference | Consistency | Risk |
|---|---|---|---|---|---|
| List/table page | 16 pages | `DataTable` + `TableToolbar` + `TableToolbarSearch` + `Dropdown` filter + `Pagination` | `components/data-table/usage`, `patterns/list-pattern` | **High** (15/16 identical) | Low |
| Create record | 16 modals | `ComposedModal size="md"` | `components/modal/usage` | High on size, **low on structure** | F-06 |
| Long create form | 4 modals | `ProgressIndicator` via shared `modal-bertahap` | `components/modal/usage#progress-modal` | Applied to 4 of 10 candidates | F-06 |
| Edit record | same modals | same modal, no confirmation summary | project rule (new data only) | High | Low |
| Delete / archive | 6 sites | **`window.confirm()`** in 5 pages; Carbon danger `Modal` in 1 | `components/modal/usage` (danger) | **Low** | **F-02** |
| Search | 15 pages | `TableToolbarSearch` | `components/search/usage` | High | Low |
| Filter | 15 pages | `Dropdown` in toolbar | `patterns/filtering` | High | Low |
| Pagination | 14 of 16 | Carbon `Pagination` | `components/pagination/usage` | High | F-16 |
| Row actions | all table pages | inline `Button` per row | `components/menu-buttons/usage` (OverflowMenu) | Consistent but dense | F-09 |
| Bulk actions | **none** | — | `components/data-table/usage` (batch actions) | n/a | F-09 (decision) |
| Detail view | 9 pages | `StructuredList` label/value, or expandable row | `components/structured-list/usage` | Medium | Low |
| Empty state | ~32 pages | sentence inside table body | `patterns/empty-states` | Medium | Low |
| Loading | 39 pages | `DataTableSkeleton` (16), `SkeletonText` (22), plain text (9) | `components/skeleton/usage` | **Low** | F-08 |
| Error | 37 pages | `InlineNotification kind="error"` at page level | `components/notification/usage` | High as a mechanism, **wrong level** for field errors | F-03 |
| Success | 39 pages | 6 pages toast, rest inline or nothing | `components/notification/usage` | **Low** | F-07 |
| Contextual help | 21 sites | `ProvenanceInfoButton` (19), `Toggletip` (2), `FieldLabel` (0) | `components/toggletip/usage` | **Low** | F-04 |
| Multi-step flow | 5 sites | 4 use shared component; 1 uses a static header label | `components/progress-indicator/usage` | **Low** | F-06 |
| Responsive table | 16 pages | project class flips rows to cards below 672px / 1056px | Carbon has no equivalent; documented deviation | High | Low |

---

## 5. Form audit

Field counts are Carbon input instances per file (`TextInput`, `NumberInput`, `Dropdown`,
`Select`, `Checkbox`, `TextArea`, `DatePicker`, `PasswordInput`, `RadioButtonGroup`,
`MultiSelect`, `FileUploader*`, `Toggle`). "Required" counts the `required` prop; "Invalid"
counts `invalidText`; "Helper" counts `helperText`.

| Form (file) | Fields | Required | Invalid | Helper | Stepped | Burden 1–5 | Findings |
|---|---:|---:|---:|---:|---|---:|---|
| `mrp/PurchasingPage.tsx` | 27 | 0 | 0 | 7 | no | **5** | Three modals in one page; no field validation; no required marks |
| `mrp/CustomerPurchaseOrdersPage.tsx` | 21 | 0 | 0 | 2 | **yes (4)** | 3 | Stepped; still no field validation |
| `mrp/ItemsPage.tsx` | 20 | 5 | 0 | 8 | **yes (3)** | 3 | Best-documented form; only page using `FormGroup`; still no `invalidText` |
| `mrp/WorkOrdersPage.tsx` | 20 | 0 | 0 | 4 | no | **4** | 8-field single-scroll modal + page-level fields |
| `hr/HrDashboardPage.tsx` | 16 | 0 | 1 | 2 | **yes (3)** | 3 | |
| `production/ProductionDashboardPage.tsx` | 16 | 0 | 0 | 1 | no | 4 | |
| `ppic/PpicDashboardPage.tsx` | 14 | 0 | 0 | 1 | no | 4 | Inline capacity editing inside a data table (documented deviation) |
| `mrp/BomsPage.tsx` | 13 | 0 | 0 | 4 | **yes (2)** | 3 | |
| `warehouse/WarehouseDashboardPage.tsx` | 13 | 0 | 0 | 2 | no | 4 | No modal at all — fields live on the page |
| `documents/DocumentsPage.tsx` | 11 | 1 | 0 | 4 | no | 3 | |
| `mrp/CustomersPage.tsx` | 11 | 0 | 0 | 6 | no | **4** | 10-field single-scroll modal |
| `mrp/ShipmentsPage.tsx` | 9 | 0 | 1 | 1 | **text only** | 4 | "Langkah 1 dari 2" with no progress indicator |
| `mrp/RoutingsPage.tsx` | 8 | 0 | 0 | 3 | no | 3 | |
| `auth/ProfilePage.tsx` | 7 | 0 | 2 | 2 | no | 2 | One of only 4 files with field-level validation |
| `mrp/BuildTasksPage.tsx` | 7 | 0 | 0 | 0 | no | 3 | No helper text at all |
| `kamus/KamusPage.tsx` | 6 | 0 | 0 | 0 | no | 2 | |
| `auth/RegisterPage.tsx` | 4 | 4 | 0 | 3 | no | 1 | Correctly marks required |
| `company/CompanySettingsPage.tsx` | 4 | 0 | 1 | 2 | no | 2 | |
| `company/SetelanPerhitunganPage.tsx` | 4 | 0 | 0 | 1 | no | 2 | |
| `auth/LoginPage.tsx` | 2 | 2 | 0 | 0 | no | 1 | |
| `auth/ResetPasswordPage.tsx` | 2 | 2 | 0 | 1 | no | 1 | |
| `auth/ForgotPasswordPage.tsx` | 1 | 1 | 0 | 0 | no | 1 | |

**Aggregate:** across 128 files, `invalidText` appears in **5** and `required` in **6** — and
five of those six are the public authentication pages. Inside the application, only
`ItemsPage` and `DocumentsPage` mark any field as required.

`FormGroup` is used in **1** file. `FieldLabel` (the project's mandated click-to-open help
component) is used in **0**.

---

## 6. Modal/dialog audit

22 modal instances found (18 `ComposedModal`, 4 `Modal`).

| Modal | Purpose | Variant | Fields | Complexity (lines) | Scroll | Alternative | Finding |
|---|---|---|---:|---:|---|---|---|
| `CustomerPurchaseOrdersPage` — Buat PO klien | create | ComposedModal `md`, stepped | 19 | 304 | per step | — | OK; largest form, correctly stepped |
| `HrDashboardPage` — Karyawan | create/edit | ComposedModal `md`, stepped | 15 | 209 | per step | — | OK |
| `ItemsPage` — Master data | create/edit | ComposedModal `md`, stepped | 14 | 337 | per step | — | OK |
| `BomsPage` — Master data | create/edit | ComposedModal `md`, stepped | 12 | 212 | per step | — | OK |
| `CustomersPage` | create/edit | ComposedModal `md` | 10 | 50 | single | **stepped or page** | F-06 |
| `PurchasingPage` — Master data | create/edit | ComposedModal `md` | 10 | 127 | single | **stepped** | F-06 |
| `PurchasingPage` — Supplier | create/edit | ComposedModal `md` | 9 | 105 | single | **stepped** | F-06 |
| `PpicDashboardPage` — block detail | read-only detail | ComposedModal `md` | 9 | 207 | single | side panel | Read-only detail in a modal; Carbon prefers non-interruptive surfaces |
| `DocumentsPage` — Master dokumen | create | ComposedModal `md` | 8 | 94 | single | — | Borderline |
| `WorkOrdersPage` — Buat Work Order | create | ComposedModal `md` | 8 | 125 | single | **stepped** | F-06 |
| `RoutingsPage` — Master data | create/edit | ComposedModal `md`, danger present | 7 | 148 | single | — | Borderline |
| `ShipmentsPage` — Langkah 1 dari 2 | multi-step dispatch | ComposedModal `md` | 7 | 147 | single | **stepped** | **F-06 — step count is a static text label only** |
| `PurchasingPage` — Buat PO baru | create | ComposedModal `md` | 6 | 94 | single | — | OK |
| `ProductionDashboardPage` — Catat gangguan | create | ComposedModal `md` | 4 | 61 | single | — | OK |
| `TeamManagePage` — Kelola tim | edit | ComposedModal `sm` | 2 | 37 | none | — | OK |
| `ShipmentsPage` — Kurangi stok | confirm | ComposedModal `sm` | 1 | 41 | none | — | OK |
| `ItemsPage` ×2 | **danger confirm** | `Modal sm` + danger | 0 | 27 / 14 | none | — | **Correct pattern; the only page that has it** |
| `ProfilePage` | confirm | `Modal sm` | 0 | 17 | none | — | OK |
| `CompanySettingsPage` | confirm | `Modal sm` | 0 | 13 | none | — | OK |
| `DocumentsPage` | preview | ComposedModal **`lg`** | 0 | 11 | — | — | Only `lg` in the app; registered in the guard allow-list |
| `PpicDashboardPage` — yield per tahap | read-only detail | ComposedModal `md` | 0 | 103 | single | side panel | Read-only detail in a modal |

**Size distribution:** `md` ×16, `sm` ×5, `lg` ×1. Size usage is consistent and matches Carbon's
guidance that brief single-decision dialogs should be small.

**Structure is where consistency breaks.** Four modals of 12–19 fields are stepped; six modals
of 7–10 fields are single-scroll; and one two-step flow announces its steps in a header label
instead of a progress indicator.

---

## 7. Table/search/filter audit

### Tables

16 pages render Carbon tables; 15 compose them through `DataTable`. Sorting is enabled via
`isSortable`. All tables carry the project's responsive class, which converts rows to stacked
cards below 672px (and below 1056px for tables of 8 or more columns). This is a documented
deviation — Carbon has no row-to-card behaviour — and it is enforced by an automated guard.

Expandable rows (`TableExpandRow`) are used in 9 pages for detail-in-place.

### Search

`TableToolbarSearch` in 15 pages, all inside `TableToolbar`. One page uses standalone `Search`
(the PPIC Gantt board, which has no `DataTable`). Consistent.

### Filters

`Dropdown` inside `TableToolbarContent` in 15 pages. Carbon's dedicated filtering pattern
(multi-select filter with applied-filter tags) is not used anywhere; single-select dropdowns
are the only filter idiom. Adequate for current density; noted, not faulted.

### Pagination

Carbon `Pagination` in 14 files. Two table-bearing pages have none:
`mrp/BuildTasksPage.tsx` and `ppic/PpicDashboardPage.tsx`.

### Bulk actions

**None.** Zero instances of `TableSelectAll`, `TableSelectRow`, `TableBatchActions`,
`TableBatchAction`, `TableToolbarMenu`, or `OverflowMenu` anywhere in the repository. Row
actions are inline buttons in a trailing "Aksi" column.

---

## 8. Accessibility

Automated signals across all 128 TSX files:

| Check | Result |
|---|---|
| Empty `labelText` / `titleText` / `iconDescription` / `label` | **0** |
| `onClick` on non-interactive elements (`div`/`span`/`td`/`tr`/`li`) | **0** |
| `hasIconOnly` buttons without `iconDescription` | **0** |
| `title=` used as a hover tooltip on a non-interactive element | **0** |
| `<img>` without `alt` | **0** (scan reported 3; all three were false positives — the `alt` attribute sits on the following line of multi-line JSX. Verified individually at `ProfilePage.tsx:325,409` and `AppShellCarbon.tsx:258`, the last correctly using `alt=""` under an `aria-hidden` wrapper) |
| `hideLabel` on Carbon controls | **30 occurrences** — see below |

| Finding | Location | Severity | Evidence | Recommendation |
|---|---|---|---|---|
| `hideLabel` used 30 times; each site depends on surrounding context to supply a visible label | `DocumentsPage` ×3, `KamusPage` ×3, `BomsPage` ×3, `HrDashboardPage`, and 20 others | LOW–MEDIUM | scan | Review per site. Screen-reader users are served correctly; sighted users may be left with an unlabelled control. The project already hit this exact failure once, in the PPIC capacity cell, where two hidden-label number inputs read as meaningless boxes until units were made visible |
| Colour-carrying status | `Tag` used 77 times for status | LOW | scan | `Tag` always carries text in this codebase, so status is not colour-only. No action |
| Focus management in modals | Carbon `ComposedModal`/`Modal` handle focus trap natively | — | — | No finding |
| Keyboard access to Gantt bars | `src/features/ppic/components/PapanGantt.tsx` | LOW | Bars are real `<button>` elements with `:focus-visible` outline | Correct by construction; drag-reschedule has no keyboard equivalent — noted as a gap, not a regression |

**Not covered by this audit:** contrast ratios, screen-reader walkthrough, and real keyboard
traversal. Those require running the application with assistive technology; static scanning
cannot establish them. Stating this explicitly so the absence of findings is not read as a
clean bill of health.

---

## 9. Consistency matrix

| Pattern | Items / BOM / Karyawan | Sales Orders / Customers / Purchasing | PPIC / Production / Warehouse | Preferred |
|---|---|---|---|---|
| Create form | stepped modal (Progress) | single-scroll modal | mixed / page-level fields | **Stepped modal above an agreed field threshold** |
| Delete | Carbon danger `Modal` (Items only) | `window.confirm()` | n/a | **Carbon danger modal everywhere** |
| Success feedback | shared toast (`AreaNotifikasi`) | inline notification or none | inline notification | **Shared toast, per existing project rule** |
| Error feedback | page-level `InlineNotification` | page-level `InlineNotification` | page-level `InlineNotification` | **Field-level `invalidText` + page-level only for non-field errors** |
| Loading | `DataTableSkeleton` | `DataTableSkeleton` + plain text | `DataTableSkeleton` + plain text | **Skeleton everywhere** |
| Contextual help | `ProvenanceInfoButton` | `ProvenanceInfoButton` | `ProvenanceInfoButton` / `Toggletip` | **One mechanism — decision required** |
| Row actions | inline buttons | inline buttons | inline buttons | Consistent today; `OverflowMenu` worth evaluating |
| Required marking | `ItemsPage` only | none | none | **Decision required (which fields are business-required)** |

---

## 10. Findings

### F-01 — Two parallel design-token systems

- **Severity:** HIGH · **Classification:** A (Carbon violation) + F (technical debt) · **Priority:** P1 · **Confidence:** High
- **Location:** `app/globals.css:1-60`, `tailwind.config.ts:17-60`, 17 consuming files
- **Evidence:** `globals.css` defines `--background`, `--foreground`, `--primary`, `--muted`, `--border` and others as HSL triples, with an in-file comment stating the values were converted by hand from `@carbon/colors` and `@carbon/themes`. Tailwind maps them to utilities (`text-foreground`, `text-muted-foreground`, `bg-muted`, `text-destructive`, …). Measured live usage: `text-muted-foreground` 72, `text-foreground` 39, `text-primary` 29, `text-destructive` 18, `bg-muted` 11, others ≤6 — **~181 usages across 17 files**. Meanwhile Carbon emits its own `--cds-*` tokens from `src/styles/carbon.scss`.
- **Carbon reference:** `elements/color`, `elements/themes`; rules C-001, C-014
- **Problem:** The same colour exists twice, in two notations, in two files, maintained by different mechanisms. A theme change applied to Carbon does not reach the Tailwind layer, and vice versa.
- **Impact:** Divergence is silent. It does not fail a build or a test; it appears as "some screens look slightly different" — which is exactly the complaint this project already recorded.
- **Decision required:** NO (removal is technical), but sequencing across 17 files needs a plan.

### F-02 — Native browser confirmation for permanent deletion

- **Severity:** HIGH · **Classification:** A + E (accessibility) · **Priority:** P0 · **Confidence:** High
- **Location:** `src/features/mrp/pages/RoutingsPage.tsx:332`, `SalesOrdersPage.tsx:365`, `SalesOrdersPage.tsx:403`, `PurchasingPage.tsx:372`, `PurchasingPage.tsx:487`, `CustomersPage.tsx:224`
- **Evidence:** e.g. `window.confirm('Hapus permanen Routing "…"? Tindakan ini tidak bisa dibatalkan.')`. By contrast `ItemsPage.tsx:1545` uses a Carbon `Modal` with `danger`, with an in-file comment explaining the size choice.
- **Carbon reference:** `components/modal/usage` — danger variant for destructive actions
- **Problem:** Six irreversible actions are confirmed by an unstyled browser dialog that cannot show consequence detail (what else references this record), cannot be themed, and is not part of the application's focus management. The same class of action is represented two different ways in the same product.
- **Impact:** Users learn two different mental models for "delete". The browser dialog also cannot express the server-side rule this product uses elsewhere — delete-if-unused versus deactivate-if-used — so the user is asked to confirm without being told which will happen.
- **Decision required:** NO. The target pattern already exists in the repository.

### F-03 — Field-level validation essentially absent

- **Severity:** HIGH · **Classification:** A + B · **Priority:** P1 · **Confidence:** High
- **Location:** repository-wide; `invalidText` present only in `HrDashboardPage`, `ShipmentsPage`, `ProfilePage` (×2), `CompanySettingsPage`
- **Evidence:** 5 of 128 files use `invalidText`; 6 use `required`, five of which are public auth pages. Errors are surfaced as page-level `InlineNotification` in 37 files.
- **Carbon reference:** `components/form/usage` (validation and error states), `components/text-input/usage`
- **Problem:** When a 19-field form is rejected, the user gets one sentence at the top of the modal and must work out which field it refers to.
- **Impact:** Highest on the largest forms — exactly where the cost of guessing is greatest.
- **Decision required:** **PARTIAL — YES.** Which fields are business-required, and what each rejection message should say, is domain knowledge. The mechanism is not.

### F-04 — Three competing contextual-help mechanisms; the mandated one is unused

- **Severity:** MEDIUM · **Classification:** F + C · **Priority:** P2 · **Confidence:** High
- **Location:** `src/components/ui/field-help.tsx:35` (`FieldLabel`, **0 importers**), `src/components/ui/provenance-info-button.tsx` (**19 importers**), Carbon `Toggletip` (**2 files**), plus Carbon `helperText` (~50 usages)
- **Evidence:** grep for `field-help` returns no importing file anywhere in `src/` or `app/`.
- **Carbon reference:** `components/toggletip/usage` (click-activated) vs `components/tooltip/usage` (hover)
- **Problem:** A component created specifically to satisfy the rule "help opens on click, never on hover, because the factory floor uses touch devices" was never adopted, while a hand-built alternative (`ProvenanceInfoButton`, itself carrying 38 hand-written Tailwind utilities and depending on the legacy shadcn dialog) became the de facto standard.
- **Impact:** Dead code that reads as governance. A future reader sees a rule and a component satisfying it, and does not discover that no screen uses it.
- **Decision required:** **YES** — which of the three becomes canonical is a UX decision.

### F-05 — Dead shadcn/Radix layer

- **Severity:** MEDIUM · **Classification:** F · **Priority:** P2 · **Confidence:** High
- **Location:** `src/components/ui/{card,select,data-table}.tsx` (0 importers each); `{button,input,table}.tsx` (imported only by the dead `data-table.tsx` and by `ConfirmAndSignModal.tsx`); `dialog.tsx` (2 importers); `badge.tsx` (3 importers)
- **Evidence:** import scan across `src/` and `app/`; `@radix-ui/react-dialog`, `@radix-ui/react-select`, `@radix-ui/react-slot`, `class-variance-authority`, `tailwind-merge`, `tailwindcss-animate`, `lucide-react` all still in `package.json`
- **Carbon reference:** rule C-005 (no duplicate component implementations)
- **Problem:** A complete second component library sits in the tree, mostly unreferenced.
- **Impact:** Low runtime risk (tree-shaken), real comprehension risk: two `Button`s, two `Table`s, two `Dialog`s.
- **Decision required:** NO.

### F-06 — No defined threshold for stepped forms; one step flow has no indicator

- **Severity:** MEDIUM · **Classification:** B + C · **Priority:** P2 · **Confidence:** High
- **Location:** `ShipmentsPage.tsx:835` (`label="Langkah 1 dari 2"` with no `ProgressIndicator`); single-scroll modals of 7–10 fields in `CustomersPage`, `PurchasingPage` ×2, `WorkOrdersPage`, `RoutingsPage`, `DocumentsPage`
- **Evidence:** modal audit table, §6
- **Carbon reference:** `components/modal/usage#progress-modal`, `components/progress-indicator/usage`
- **Problem:** The shared stepped-modal component exists and works, but nothing defines when it applies. The result is that a 10-field modal scrolls while a 12-field modal steps.
- **Impact:** Two experiences for the same task shape. `ShipmentsPage` is the sharpest case: it tells the user there are two steps but shows no indicator of where they are.
- **Decision required:** **YES** — the threshold is a UX judgement.

### F-07 — Success feedback inconsistent

- **Severity:** MEDIUM · **Classification:** B · **Priority:** P2 · **Confidence:** High
- **Location:** `AreaNotifikasi` used in 6 of 39 pages: `ProfilePage`, `CustomerPurchaseOrdersPage`, `ItemsPage`, `HrDashboardPage`, `BomsPage`, `CompanySettingsPage`
- **Evidence:** grep; `InlineNotification` appears in 37 files
- **Carbon reference:** `components/notification/usage` — toast for transient confirmation, inline for context-bound messages
- **Problem:** A project rule already exists (success → toast, top right, auto-dismiss after 5 s; failure → never auto-dismiss). It is honoured in 6 pages.
- **Impact:** In the other pages a successful save is either silent or indistinguishable in placement from an error.
- **Decision required:** NO — the rule exists.

### F-08 — Three loading treatments

- **Severity:** MEDIUM · **Classification:** D · **Priority:** P2 · **Confidence:** High
- **Location:** plain "Memuat…" text in `PpicDashboardPage`, `NotificationBell`, `CustomersPage`, `SalesOrdersPage`, `ItemsPage`, `KpiPage`, `MyKpiPage`, `DocumentsPage`, `KamusPage`
- **Carbon reference:** `components/skeleton/usage`, `components/loading/usage`
- **Problem/Impact:** Skeletons preserve layout; a text line collapses it, so the page jumps when data lands.
- **Decision required:** NO.

### F-09 — No row selection, bulk actions, or overflow menus

- **Severity:** MEDIUM · **Classification:** C (product decision) · **Priority:** P2 · **Confidence:** High
- **Location:** all 16 table pages
- **Evidence:** zero instances of `TableSelectAll`, `TableSelectRow`, `TableBatchActions`, `TableToolbarMenu`, `OverflowMenu`
- **Carbon reference:** `components/data-table/usage` (batch actions), `components/menu-buttons/usage`
- **Problem:** Every row action is an always-visible button, which consumes horizontal space in a product that already fights column truncation; and no multi-record operation is possible.
- **Impact:** Unknown without workflow knowledge — a planner who approves 30 purchase requests one at a time has a different problem than one who approves two.
- **Decision required:** **YES** — does the domain require bulk operations?

### F-10 — `SalesOrdersPage` only partially migrated

- **Severity:** MEDIUM · **Classification:** F · **Priority:** P2 · **Confidence:** High
- **Location:** `src/features/mrp/pages/SalesOrdersPage.tsx` (1,235 lines)
- **Evidence:** 78 hand-written Tailwind utility usages (the highest in the repository), 2 `window.confirm()` sites, 4 Carbon inputs, no `helperText`, plain-text loading
- **Problem/Impact:** The page imports Carbon (26 components) yet carries the largest concentration of the old styling system. It is the clearest single-file remnant of the pre-Carbon era.
- **Decision required:** NO.

### F-11 — Two CSS resets

- **Severity:** LOW–MEDIUM · **Classification:** D · **Priority:** P2 · **Confidence:** High
- **Location:** `app/globals.css:1` (`@tailwind base`) layered over Carbon's own reset from `@carbon/styles`
- **Problem/Impact:** Preflight normalises elements Carbon has already normalised differently. No specific defect was traced to it during this audit, so this is reported as a structural risk, not an observed break.
- **Decision required:** NO.

### F-12 — `hideLabel` breadth

- **Severity:** LOW · **Classification:** E · **Priority:** P3 · **Confidence:** Medium
- **Location:** 30 sites across 15 files
- **Problem:** Carbon-correct for screen readers; may leave sighted users without a visible label depending on surrounding context.
- **Impact:** Demonstrated once already in this codebase, where a pair of hidden-label number inputs was unintelligible until visible units were added.
- **Decision required:** NO — but requires per-site human review, not a blanket change.

### F-13 — No visual-regression infrastructure

- **Severity:** MEDIUM · **Classification:** F · **Priority:** P2 · **Confidence:** High
- **Location:** `package.json`, `tests/`
- **Evidence:** no Storybook, no screenshot baselines, no Playwright dependency; the only UI-shaped automation is three static-analysis guards
- **Problem:** The three guards are genuinely good — they catch raw elements, non-responsive tables, missing pagination, and stray rounded corners. But every visual claim ("no horizontal scroll at six widths", "nothing clipped at either edge") is produced by hand per session and then discarded.
- **Impact:** Visual regressions can only be caught by whoever happens to look.
- **Decision required:** NO.

### F-14 — Carbon package version skew

- **Severity:** LOW · **Classification:** A · **Priority:** P3 · **Confidence:** High
- **Evidence:** `@carbon/react` resolves to 1.114.0 while `@carbon/styles` resolves to 1.113.0
- **Problem/Impact:** Components and their stylesheets come from different releases. No defect was observed; flagged so that any style discrepancy is checked against this first.
- **Decision required:** NO.

### F-15 — Very large page components

- **Severity:** MEDIUM · **Classification:** D · **Priority:** P2 · **Confidence:** High
- **Evidence:** `PpicDashboardPage.tsx` 1,964 lines; `ItemsPage.tsx` 1,594; `PurchasingPage.tsx` 1,408; `SalesOrdersPage.tsx` 1,235; `WorkOrdersPage.tsx` 1,189; `CustomerPurchaseOrdersPage.tsx` 1,120
- **Problem:** Single files hold several tables plus up to three modals. `PurchasingPage` alone contains 27 form fields across three modals.
- **Impact:** Raises the cost of every consistency fix, because each fix must be located repeatedly inside long files.
- **Decision required:** NO.

### F-16 — Pagination missing on two table pages

- **Severity:** LOW · **Classification:** D · **Priority:** P3 · **Confidence:** High
- **Location:** `mrp/BuildTasksPage.tsx`, `ppic/PpicDashboardPage.tsx`
- **Decision required:** NO.

### F-17 — Remaining raw HTML controls

- **Severity:** LOW · **Classification:** F · **Priority:** P3 · **Confidence:** High
- **Evidence:** 11 `<button>`, 5 `<input>`, 4 `<table>`, 7 `<form>` instances. Of these, 3 are tracked as recorded debt under task `DS-20` (`NotificationBell.tsx` ×2 buttons, `ConfirmAndSignModal.tsx` ×1 input), and the rest carry in-file exception markers with stated reasons (print document, Gantt bars, PPIC daily/monthly grids).
- **Note:** `<form>` is not currently guarded. Carbon does not require its `Form` component, so this is a gap in the guard rather than a defect in the code.
- **Decision required:** NO.

### F-18 — Carbon `NumberInput` minimum width fights table-cell usage

- **Severity:** LOW · **Classification:** G (intentional deviation, documented) · **Priority:** P3 · **Confidence:** High
- **Location:** `app/(shell)/ppic/ppic.scss` — override of `.cds--number input[type='number'] { min-inline-size: 0 }`
- **Evidence:** `node_modules/@carbon/styles/scss/components/number-input/_number-input.scss:65` sets `min-inline-size: 9.375rem`
- **Note:** Recorded here so the override is visible to reviewers, and because it is evidence that Carbon's `NumberInput` is not designed for narrow in-cell editing. That in turn is relevant to the open question of whether capacity editing belongs in a table at all.
- **Decision required:** NO (the override), **YES** (in-table editing as a pattern).

---

## 11. Recommended backlog

| Priority | ID | Problem | Owner | Decision required | Suggested next step |
|---|---|---|---|---|---|
| P0 | F-02 | Native `window.confirm` for 6 destructive actions | Claude Code | No | Replace with the Carbon danger modal already used in `ItemsPage`; state the delete-vs-deactivate outcome in the dialog |
| P1 | F-01 | Duplicate token system | Claude Chat → Claude Code | No | Plan removal file-by-file, starting with `SalesOrdersPage` (F-10); the guard suite can enforce no new usage |
| P1 | F-03 | No field-level validation | ChatGPT → Claude Code | **Yes** | Decide required fields and messages per form; then apply `invalidText`/`required` |
| P2 | F-04 | Three help mechanisms, mandated one unused | ChatGPT | **Yes** | Choose canonical mechanism; retire the others |
| P2 | F-06 | Stepped-form threshold undefined | ChatGPT | **Yes** | Set a field-count or context-count threshold; fix `ShipmentsPage` first |
| P2 | F-07 | Success feedback inconsistent | Claude Code | No | Apply the existing toast rule to the remaining 33 pages |
| P2 | F-09 | No bulk actions or overflow menus | ChatGPT | **Yes** | Decide whether multi-record operations exist in the workflow |
| P2 | F-05 | Dead shadcn layer | Claude Code | No | Remove zero-importer files; migrate the 3 live holdouts; then drop the dependencies |
| P2 | F-08 | Three loading treatments | Claude Code | No | Replace plain text with skeletons in 9 files |
| P2 | F-10 | `SalesOrdersPage` partially migrated | Claude Code | No | Full migration pass |
| P2 | F-13 | No visual-regression gate | Claude Chat → Claude Code | No | Add screenshot baselines at the six mandated widths for a shortlist of screens |
| P2 | F-15 | 1,000–2,000 line page components | Claude Chat | No | Extract modals into per-domain components (the Gantt board is a working precedent) |
| P2 | F-11 | Two CSS resets | Claude Code | No | Resolve together with F-01 |
| P3 | F-12 | `hideLabel` breadth | Human review | No | Review 30 sites for visible-label context |
| P3 | F-14 | Carbon version skew | Claude Code | No | Align `@carbon/styles` with `@carbon/react` |
| P3 | F-16 | Pagination missing on 2 pages | Claude Code | No | Add or justify |
| P3 | F-17 | Raw HTML controls | Claude Code | No | Already tracked as `DS-20`; extend the guard to `<form>` |

---

## 12. Decisions required from ChatGPT

Five items cannot proceed without product, workflow, or UX judgement:

1. **F-03 — Which fields are business-required, per form, and what each rejection message should say.** The mechanism is trivial; the semantics are not. Marking a field required changes what the system will refuse to record.
2. **F-04 — Which contextual-help mechanism becomes canonical:** the project's own `FieldLabel` (click-activated, currently unused), `ProvenanceInfoButton` (in use in 19 files, but built on the legacy component layer), or Carbon `Toggletip`. This determines whether an existing rule is enforced or replaced.
3. **F-06 — The threshold at which a create form becomes a stepped modal.** Field count is one candidate; number of distinct contexts is another. Ten-field modals currently sit on both sides of the line.
4. **F-09 — Whether the domain requires multi-record operations** (bulk approve, bulk archive, bulk assign). If yes, Carbon batch actions apply and row actions should likely move into an overflow menu. If no, the current design is correct and should be recorded as a deliberate choice rather than an omission.
5. **F-18 — Whether editing values inside a data table is an accepted pattern.** Carbon states the data table is not a spreadsheet replacement. Work-centre capacity is currently edited in-row. Moving it to a modal is a workflow question (how often is capacity changed?), not a styling question.

---

## 13. Repository changes

**NONE** to application code, stylesheets, components, configuration, tests, or database.

This audit added exactly one file — this report — under
`docs/FABRIX-Carbon-UX-Governance/`. No other file in the repository was created, modified,
or deleted during the audit.

---

## Appendix A — Audit method and its limits

**What was done:** the repository was scanned at commit `7ce6e3c` with purpose-written
read-only scripts covering component imports and JSX instance counts, modal composition and
field counts, form field/validation/help counts, accessibility signals, styling-system usage,
and test infrastructure. Comments were stripped before counting. Installed package versions
were read from `node_modules`, not from `package.json` ranges. Carbon's own stylesheet source
was read from `node_modules` where a specific value mattered.

**What this method cannot establish**, stated so that silence is not mistaken for a pass:

- Contrast ratios and real screen-reader behaviour.
- Actual keyboard traversal order.
- Whether an empty state, error message, or helper text is *correct* — only whether it exists.
- Whether a form's field set matches the business process.
- Runtime behaviour of any screen. No screen was opened during this audit.

**One correction made during the audit, recorded rather than hidden:** the accessibility scan
initially reported three `<img>` elements without `alt`. All three were false positives caused
by line-based matching against multi-line JSX. They were verified individually and removed
from the findings. A check that accuses wrongly trains readers to ignore it.

## Appendix B — Repository state at audit time

The audited commit `7ce6e3c` includes work completed immediately before the audit began
(a rebuild of the PPIC Gantt board to Carbon's data-visualisation specification, and an
extension of the raw-element guard to cover `src/features/**/components/`). This is disclosed
because that work is recent enough that its patterns are over-represented in "current
practice": for example, the Gantt board is the only feature component with its own stylesheet
and the only one to use `Search` standalone. It should be read as the newest convention, not
as the established one.
