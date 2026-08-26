# FABRIX Carbon UI/UX Governance

## Purpose

This document set establishes the UI/UX governance baseline for FABRIX.

The project uses IBM Carbon Design System as the primary and authoritative UI design system. FABRIX does **not** create a competing visual design system. FABRIX-specific rules exist only where product, domain, workflow, content, or repository constraints require decisions that Carbon cannot define.

## Source of truth hierarchy

1. IBM Carbon Design System — authoritative UI/component/pattern guidance.
2. FABRIX Carbon Implementation Rules — repository rules for applying Carbon consistently.
3. FABRIX UX/Product Decisions — domain and workflow decisions that Carbon cannot determine.
4. Existing implementation — evidence to audit, not authority when it conflicts with the above.
5. AI-generated implementation — never authoritative by itself.

## Core principle

> If Carbon already provides an appropriate component or pattern, use it rather than inventing a custom UI solution.

## Important boundary

Carbon determines how a UI interaction should be represented and provides usage, style, code, and accessibility guidance.

FABRIX determines what the user needs to accomplish, what business rules apply, and what domain workflow is correct.

## Documents

- `01-carbon-reference.md` — concise reference map and principles.
- `02-carbon-compliance-rules.md` — rules Claude Chat and Claude Code must follow.
- `03-fabrix-ux-governance.md` — product/UX rules that sit above Carbon.
- `04-ui-ux-audit-methodology.md` — AS-IS audit methodology.
- `05-ux-decision-records.md` — decision record format.
- `06-claude-code-asis-audit-prompt.md` — first command to Claude Code; audit only, no changes.
- `07-claude-chat-implementation-prompt.md` — prompt for converting approved decisions into implementation planning.
- `08-claude-code-implementation-prompt.md` — execution prompt after planning/approval.
- `09-chatgpt-review-prompt.md` — post-implementation review prompt.
- `10-workflow.md` — operating model for ChatGPT → Claude Chat → Claude Code → ChatGPT.
- `11-audit-report-template.md` — expected Claude Code AS-IS audit output.
- `12-carbon-component-checklist.md` — practical component/pattern checklist.
- `13-ui-ux-backlog-template.md` — remediation backlog structure.

## Current Carbon reference

As of August 2026, the official Carbon site lists React Components `^1.114.0` and was updated August 24, 2026. Always verify the live official documentation before making decisions that depend on version-specific behavior.

Official reference:
https://carbondesignsystem.com/
