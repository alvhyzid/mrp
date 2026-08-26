# CLAUDE CODE — FABRIX CARBON/UI/UX AS-IS AUDIT

## MODE: READ-ONLY / NO IMPLEMENTATION

You are performing an AS-IS audit of the existing FABRIX UI/UX implementation.

The project already has IBM Carbon Design System installed and functioning correctly. Do NOT replace Carbon, upgrade Carbon, redesign the system, or modify code during this audit.

## Primary objective

Determine:

1. How Carbon is currently implemented.
2. Where UI implementation is inconsistent.
3. Where UX flows are inconsistent or unnecessarily complex.
4. Where forms are unnecessarily burdensome.
5. Where modal/side-panel/page decisions are inconsistent.
6. Where custom UI duplicates Carbon.
7. Where implementation conflicts with Carbon guidance.
8. Which issues require architecture/UX decisions rather than direct coding.

## Mandatory behavior

- Inspect the repository before making conclusions.
- Do not change source code.
- Do not change CSS/SCSS.
- Do not modify package versions.
- Do not run migrations.
- Do not auto-fix anything.
- Do not create new components.
- Do not delete components.
- Do not refactor.
- Do not "clean up" while auditing.

## First inspect

Identify:

- framework
- Carbon package(s)
- installed Carbon version(s)
- theme
- global style/token configuration
- custom wrappers
- component directories
- page/layout architecture
- routing
- form infrastructure
- table infrastructure
- modal/dialog infrastructure
- notification infrastructure
- CSS/SCSS overrides
- test infrastructure
- visual regression infrastructure if present

## Carbon comparison

Use the official Carbon documentation as the authority:

https://carbondesignsystem.com/

For each relevant component/pattern compare the current implementation against:

- Usage
- Style
- Code
- Accessibility

Do not assume current online documentation exactly matches the installed package version. Report version differences.

## Audit all major UI patterns

Inspect at least:

- application shell/navigation
- page headers
- breadcrumbs
- buttons
- forms
- inputs
- selects
- dropdowns
- comboboxes
- date pickers
- data tables
- search
- filters
- pagination
- tabs
- modal
- side panel
- popover
- tooltip
- notifications
- loading
- empty states
- error states
- destructive actions
- confirmation flows
- create/edit flows
- bulk actions
- row actions

## Form audit

For each significant form:

- route/page
- component path
- field count
- required count
- optional count
- derived/defaulted count
- conditional count
- advanced count
- validation approach
- grouping
- submit/cancel behavior
- estimated cognitive burden 1–5
- Carbon concerns
- UX concerns

## Modal audit

For each modal:

- path
- trigger
- purpose
- Carbon variant
- content complexity
- field count
- scroll behavior
- actions
- destructive?
- repeated pattern?
- whether side panel/page appears more appropriate
- Carbon concern
- UX concern

## Consistency audit

Find repeated implementations that should likely be standardized.

Examples:

- different Create button treatments
- different modal sizes
- different form layouts
- different filter bars
- different table toolbars
- different status presentations
- different empty states
- different save/cancel placement
- different loading behavior
- different error behavior

## Accessibility audit

Identify evidence of:

- keyboard issues
- focus issues
- missing labels
- missing descriptions
- color-only state communication
- incorrect semantic markup
- custom controls without equivalent keyboard behavior
- problematic aria usage
- inaccessible modal/focus behavior

## Required output

Produce the report according to:

`11-audit-report-template.md`

Every finding must include evidence:

- file path
- component/page
- relevant code reference
- Carbon reference when applicable
- severity
- classification
- confidence

## Critical rule

If you encounter an ambiguity involving business semantics, workflow ownership, data meaning, or product behavior, DO NOT decide it yourself.

Mark:

`DECISION REQUIRED`

and explain why.

## End state

The repository must remain unchanged.

Report only.
