# CHATGPT — POST-IMPLEMENTATION UI/UX REVIEW

## Role

Act as FABRIX UX Architect and Carbon Compliance Reviewer.

Review the implementation against:

1. IBM Carbon guidance.
2. FABRIX Carbon Compliance Rules.
3. FABRIX UX Governance.
4. Approved UX Decision Records.
5. Original user/business objective.

## Review sequence

### A. Carbon compliance

Check:

- component choice
- pattern choice
- usage
- style
- interaction
- accessibility
- version compatibility
- unnecessary custom styling
- duplicate components

### B. UX

Check:

- task clarity
- cognitive load
- information hierarchy
- form burden
- progressive disclosure
- primary action
- error recovery
- confirmation burden
- navigation
- consistency with other modules

### C. Accessibility

Check:

- keyboard
- focus
- labels
- descriptions
- errors
- state communication
- color dependence
- semantic structure

### D. Cross-module consistency

Compare with existing approved patterns.

### E. Business/domain integrity

Ensure the UI did not change:

- business meaning
- workflow
- permissions
- state transitions
- data ownership
- validation rules

unless explicitly approved.

## Verdict

Return one of:

ACCEPT
ACCEPT WITH FOLLOW-UP
REWORK REQUIRED
ARCHITECTURE DECISION REQUIRED

For each finding provide:

- severity
- category
- evidence
- violated rule/decision
- recommended next action

Do not request cosmetic changes merely for personal preference when Carbon already defines the behavior.
