# FABRIX Carbon Compliance Rules

## Status

These are mandatory implementation rules unless explicitly overridden by an Architecture/UX Decision Record.

## Rule C-001 — Carbon is the visual source of truth

Do not invent a parallel visual language.

Do not introduce arbitrary:

- colors
- spacing
- typography
- border treatments
- radii
- shadows
- icon styles
- control sizes
- interaction states

when Carbon already defines the appropriate treatment.

## Rule C-002 — Reuse Carbon components

If Carbon provides an appropriate component, use it.

Do not recreate:

- buttons
- inputs
- selects
- dropdowns
- menus
- modals
- notifications
- tooltips
- popovers
- tables
- tabs
- pagination
- loading indicators
- form primitives

without an approved reason.

## Rule C-003 — Reuse Carbon patterns

When Carbon provides a pattern relevant to the task, use the pattern as the baseline rather than inventing a new flow.

## Rule C-004 — No arbitrary CSS for Carbon behavior

Do not override Carbon styles merely to make a page look different.

Any intentional override must document:

- why Carbon cannot satisfy the requirement
- scope of the override
- affected components
- accessibility impact
- migration/maintenance impact

## Rule C-005 — No duplicate component implementations

If multiple local components solve the same UI problem, consolidate them or document why they are legitimately different.

## Rule C-006 — Component choice must follow use case

Do not select a component based only on developer convenience.

Evaluate:

- user objective
- frequency
- interruption
- information density
- task complexity
- reversibility
- accessibility
- responsive behavior

## Rule C-007 — Modal restraint

Do not use a modal merely because it is easy to implement.

Before using a modal, establish:

- the task is appropriately bounded
- interruption is justified
- content is not excessively long
- the user can understand the action and consequence
- the interaction is appropriate for the task frequency

If the task becomes too complex for a dialog, consider a page-level or other Carbon-supported pattern.

## Rule C-008 — Forms must minimize burden

Do not expose every available field by default.

For every form field, classify it as:

- required
- common optional
- optional
- advanced
- system-generated
- derived
- contextual
- deprecated

Fields that can be derived or defaulted should not unnecessarily become user inputs.

## Rule C-009 — Tables are task-oriented

A table must support the user's task.

Audit:

- columns
- density
- sorting
- filtering
- pagination
- selection
- row actions
- empty state
- loading
- error state
- responsive behavior

Do not add columns merely because data exists.

## Rule C-010 — Accessibility is mandatory

A Carbon component is not an excuse to skip accessibility review of its composition.

## Rule C-011 — Do not fork Carbon

Do not create a local fork or custom variant to solve a one-page problem.

If a true product-wide extension is needed, document it as a separate architectural decision.

## Rule C-012 — Respect installed version

Implementation must match the Carbon version actually installed in the repository.

If official documentation describes a newer API or feature, do not silently implement it.

## Rule C-013 — Explain deviations

Any deviation from Carbon must be reported as:

- deviation ID
- component/pattern
- Carbon guidance
- FABRIX requirement
- reason
- impact
- approval status

## Rule C-014 — Prefer tokens over hardcoded values

Use Carbon tokens and project-approved token mechanisms wherever applicable.

Avoid hardcoded visual values.

## Rule C-015 — Preserve semantic consistency

The same user action should use consistent Carbon semantics across modules unless there is a documented reason otherwise.

## Rule C-016 — No page-specific invention

A page must not invent a new modal, form pattern, filter bar, toolbar, status treatment, or action hierarchy if an approved Carbon pattern already exists.

## Compliance severity

CRITICAL:
- accessibility failure
- destructive interaction incorrectly represented
- inconsistent business-critical action semantics
- broken keyboard/focus behavior
- major Carbon component misuse

HIGH:
- wrong component/pattern
- repeated custom UI where Carbon exists
- severe form complexity
- inconsistent modal/side-panel/page strategy

MEDIUM:
- inconsistent spacing/typography/token use
- duplicated local wrappers
- inconsistent table/filter composition

LOW:
- minor visual deviations
- documentation gaps
- non-blocking consistency issues
