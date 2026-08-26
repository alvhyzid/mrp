# FABRIX UX Governance

## Purpose

Carbon governs the UI system.

FABRIX UX governance governs product-specific decisions that Carbon cannot determine.

## 1. User goal before screen

Every screen should have a clear primary user objective.

Document:

- who is using it
- what they are trying to accomplish
- what information they need
- what decision/action they need to make
- what the system can infer automatically

## 2. Minimize cognitive load

Prefer:

- sensible defaults
- derived values
- contextual fields
- progressive disclosure
- task-focused screens
- clear primary action
- predictable navigation

Avoid:

- asking for information the system already knows
- exposing internal technical concepts unnecessarily
- mixing unrelated tasks
- excessive confirmation
- long forms without progressive disclosure

## 3. Primary action

Each task surface should have a clear primary action.

Secondary and destructive actions must not compete visually or semantically with the primary action.

## 4. Progressive disclosure

Reveal complexity only when required.

Typical hierarchy:

Essential
→ Common optional
→ Advanced
→ System/technical details

## 5. Form field decision

For each field ask:

1. Is it required by business rules?
2. Can the system derive it?
3. Can it have a safe default?
4. Is it needed at this stage?
5. Is it needed by most users?
6. Is it only needed for advanced scenarios?

## 6. Navigation

Navigation should reflect the user's mental model and product domain, not database tables or implementation architecture.

## 7. Consistency

Consistency is mandatory where the same task or concept appears repeatedly.

Examples:

- Create
- Edit
- Delete
- Archive
- Approve
- Reject
- Search
- Filter
- Export
- Assign
- View details

## 8. Domain overrides

A domain workflow may require behavior that is not directly represented by a generic Carbon pattern.

When that happens:

- preserve Carbon visual/interaction conventions
- document the domain reason
- do not create a new visual language
- obtain explicit approval

## 9. UX decision boundary

ChatGPT owns/reviews:

- user objective
- workflow architecture
- information architecture
- task complexity
- interaction strategy
- Carbon compliance
- cross-module consistency

Claude Chat owns:

- repository interpretation
- implementation strategy
- component mapping
- migration plan

Claude Code owns:

- code changes
- tests
- repository validation
- implementation evidence

## 10. Acceptance standard

A UI change is not accepted merely because:

- it compiles
- tests pass
- it looks attractive

It must also:

- follow Carbon
- preserve business semantics
- reduce or maintain cognitive burden
- maintain interaction consistency
- remain accessible
- avoid unnecessary custom UI
