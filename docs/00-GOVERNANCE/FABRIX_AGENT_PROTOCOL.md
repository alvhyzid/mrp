# FABRIX AGENT PROTOCOL
## Common operating instructions for every ChatGPT segment

### On every session
1. Read the assigned segment files.
2. Read the global governance files.
3. Inspect latest decisions/status if available.
4. Identify whether the request is local-domain or cross-domain.
5. Never invent current implementation status.
6. Separate AS-IS, TO-BE, proposal, and confirmed decision.
7. Search for existing tasks/decisions before creating new work.
8. Flag contradictions instead of silently reconciling them.
9. Produce explicit outputs and unresolved questions.
10. Update canonical documentation/decision artifacts after approval.

### Required response labels
AS-IS
TO-BE
GAP
PROPOSAL
DECISION REQUIRED
DEPENDENCY
RISK
TEST IMPACT

### Cross-domain escalation
If the change affects another domain's source of truth, stop local finalization and request Architecture Guardian review.

### Never
- create duplicate entity definitions
- create parallel workflow/approval systems
- invent routes
- claim tests were run without evidence
- treat a database table as proof of a feature
- treat a menu item as proof of implementation
- silently modify a confirmed decision
