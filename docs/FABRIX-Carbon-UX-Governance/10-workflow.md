# FABRIX UI/UX AI Workflow

## Operating model

```text
Claude Code
    │
    │ AS-IS evidence
    ▼
ChatGPT
    │
    │ UX/Carbon decisions
    ▼
Claude Chat
    │
    │ repository-aware implementation plan
    ▼
Claude Code
    │
    │ implementation + evidence
    ▼
ChatGPT
    │
    │ review
    ├── ACCEPT
    └── REWORK → Claude Code
```

## Decision routing

### Send to ChatGPT when

The question concerns:

- Carbon compliance
- component/pattern selection
- UX flow
- information architecture
- form complexity
- modal/page/side-panel strategy
- cross-module consistency
- business workflow
- domain semantics
- accessibility interpretation
- product behavior

### Send to Claude Chat when

The decision is already known and the question is:

- where to implement
- how existing components map to the decision
- which files are affected
- migration sequence
- implementation architecture
- dependency impact
- test planning

### Send to Claude Code when

The task is execution:

- modify components
- refactor
- add tests
- fix implementation
- update styles/tokens within approved rules
- run validation
- report evidence

## Stop conditions for Claude Code

Claude Code must STOP and request a decision if implementation requires guessing about:

- business behavior
- domain ownership
- workflow
- permissions
- source of truth
- destructive semantics
- cross-module interaction
- new UX pattern
- Carbon deviation

## Stop conditions for Claude Chat

Claude Chat must STOP and escalate if:

- the repository reveals a conflict with an approved UX decision
- implementation requires a new UX pattern
- Carbon guidance conflicts with a product requirement
- a decision affects multiple domains
- a proposed change changes business semantics

## Evidence loop

Never treat "done" as proof.

Completion requires:

implementation
→ tests
→ visual/interaction validation
→ accessibility validation
→ Carbon compliance review
→ UX acceptance

## Guiding rule

> ChatGPT decides WHAT and WHY.
> Claude Chat determines repository-aware HOW.
> Claude Code executes and proves WHAT was changed.
