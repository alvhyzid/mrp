# FABRIX UI/UX AS-IS Audit Methodology

## Principle

Audit before modifying.

The first audit is read-only. No UI code, CSS, component, or data should be changed.

## Phase A — Repository discovery

Identify:

- framework
- Carbon package/version
- build system
- theme
- token configuration
- global styles
- Carbon imports
- custom CSS/SCSS
- custom component library
- layout primitives
- UI shell
- routing
- page templates
- form abstractions
- table abstractions
- modal abstractions
- notification abstractions

## Phase B — Component inventory

For every UI component/pattern found:

- name
- path
- type
- Carbon equivalent
- custom or Carbon
- reuse count
- props/API
- visual overrides
- behavior overrides
- accessibility concerns

## Phase C — Pattern inventory

Audit:

- create
- edit
- delete
- archive
- approval
- rejection
- search
- filtering
- sorting
- bulk action
- row action
- detail view
- side panel
- modal
- wizard
- form
- empty state
- loading
- error
- success
- notification
- import/export

## Phase D — Form audit

For every form:

- number of fields
- required fields
- optional fields
- derived fields
- defaultable fields
- conditional fields
- advanced fields
- grouping
- validation
- error presentation
- save/cancel behavior
- navigation interruption

Score form burden from 1–5:

1 = minimal
2 = light
3 = moderate
4 = heavy
5 = excessive

## Phase E — Modal audit

For each modal:

- purpose
- trigger
- frequency
- content length
- field count
- scroll behavior
- actions
- destructive action?
- Carbon variant
- whether a page/side panel would be more appropriate
- consistency with other modals

## Phase F — Data table audit

Check:

- columns
- density
- toolbar
- filters
- search
- sort
- pagination
- selection
- row action
- bulk action
- empty
- loading
- error
- responsive behavior

## Phase G — Accessibility audit

Check:

- keyboard
- focus
- labels
- descriptions
- error messaging
- color dependence
- semantic structure
- screen-reader labels
- interactive states
- contrast
- touch/target concerns where applicable

## Phase H — Consistency audit

Compare repeated patterns across modules.

Create a consistency matrix:

Pattern | Module A | Module B | Module C | Preferred

## Phase I — Classification

Every finding must be classified:

A — Carbon violation
B — UX usability issue
C — Product/domain decision
D — Implementation quality issue
E — Accessibility issue
F — Technical debt
G — Intentional deviation
H — Unknown / needs decision

## Phase J — Priority

P0 — blocks critical task or creates severe accessibility/data risk
P1 — major UX/consistency problem
P2 — significant improvement
P3 — polish/documentation

## Audit rule

Do not prescribe implementation fixes during AS-IS discovery unless the requested report explicitly asks for recommendations. First establish facts.
