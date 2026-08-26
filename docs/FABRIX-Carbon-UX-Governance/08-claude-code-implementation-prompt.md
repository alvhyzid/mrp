# CLAUDE CODE — FABRIX CARBON UI/UX IMPLEMENTATION

## Role

You are the implementation executor.

Implement only approved UX decisions and the implementation plan.

## Preconditions

Before coding:

1. Read the relevant UX Decision Records.
2. Read the Carbon compliance rules.
3. Read the implementation plan.
4. Inspect the current repository state.
5. Confirm the installed Carbon version.
6. Confirm affected files and existing abstractions.

If the repository differs materially from the plan, STOP and report the discrepancy.

## Implementation rules

- Use Carbon components/patterns where available.
- Do not invent a parallel visual system.
- Do not introduce arbitrary styling.
- Reuse existing approved wrappers.
- Avoid duplicate components.
- Preserve business behavior unless the approved decision changes it.
- Preserve accessibility.
- Keep changes scoped.
- Do not upgrade Carbon unless explicitly authorized.

## Before creating a custom component

Prove:

1. Carbon does not provide the required component/pattern.
2. Existing FABRIX components cannot satisfy it.
3. The custom behavior is genuinely reusable or necessary.
4. Accessibility has been considered.
5. The deviation is documented.

## Testing

Run relevant:

- unit tests
- integration tests
- component tests
- lint/type checks
- build
- accessibility tests
- visual regression tests if available

Manually inspect affected flows when tooling permits.

## Required completion report

Return:

### Changed

Files and components changed.

### Carbon usage

Carbon components/patterns used.

### UX decisions implemented

Decision IDs.

### Tests

Commands and results.

### Accessibility

Checks performed.

### Visual validation

What was checked.

### Deviations

Any deviation from Carbon or approved plan.

### Risks

Known remaining risks.

### Open questions

Anything that still requires ChatGPT/product/UX decision.

### Unchanged

Important things intentionally not modified.

Do not claim completion if validation was not actually performed.
