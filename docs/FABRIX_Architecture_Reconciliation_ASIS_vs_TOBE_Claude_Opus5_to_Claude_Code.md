<!-- CATATAN KEPALA — ditambahkan Claude Code, 25 Agu 2026 -->
> **Penulis dokumen**: Claude Opus 5, diserahkan lewat pemilik produk.
> **Diterima & dicatat**: 25 Agustus 2026.
> **Status di proyek ini**: **DICATAT SEBAGAI TASK `AR-01`, BELUM DIKERJAKAN.**
>
> **SEBAGIAN BESAR ISINYA KEMUNGKINAN SUDAH TERCAKUP pekerjaan sebelumnya.** Tabel tumpang
> tindihnya ada di `HANDOFF.md` bagian WW dan di detail task `AR-01`. Yang **BELUM tercakup**
> itulah lingkup sesungguhnya — **bukan 34 bagian**.
>
> **JANGAN mengikuti §29 (15 berkas keluaran) mentah-mentah.** Dokumen ini sendiri menulis
> *"do not create duplicate documentation systems if one already exists"*, dan proyek ini
> sudah punya `ar0-inventaris-as-is.md`, `governance/design-debt.md`,
> `governance/pemetaan-komponen-carbon.md`, `audit-infrastruktur-fabrix.md`, `HANDOFF.md`,
> dan Daftar Tugas Pembangunan.
>
> **JANGAN memakai taksonomi P0–P3 dari §27.** Proyek ini sudah punya taksonomi urgensinya
> sendiri. Pemetaannya ada di task `AR-01`.

# FABRIX — ARCHITECTURE RECONCILIATION
## AS-IS vs TO-BE Audit & Decision Framework

**Target:** Claude Opus 5 → Claude Code  
**Phase:** `00 — Architecture Reconciliation`  
**Status:** Mandatory Gate before Product & Engineering

---

## 1. MISSION

Perform a complete evidence-based reconciliation of the existing FABRIX implementation against the approved FABRIX Master Architecture, UX Architecture, Sales Architecture, and Post-Sales Architecture.

The objective is **not** to redesign FABRIX from scratch.

```text
CURRENT FABRIX
     ↓
AS-IS AUDIT
     ↓
COMPARE
     ↓
TARGET FABRIX
     ↓
TO-BE
     ↓
RECONCILIATION
     ↓
DECISION
     ↓
SAFE NEXT IMPLEMENTATION
```

Determine:

- what exists;
- what is actually functional;
- what has a verified URL;
- current domain/entity ownership;
- current data model;
- current state machines and workflows;
- what matches the target architecture;
- conflicts;
- missing capabilities;
- what must be preserved;
- what should be adapted;
- what must be migrated;
- what should be deprecated;
- what requires an explicit decision;
- what must not be touched.

---

## 2. ABSOLUTE RULES

### DO NOT BUILD NEW FEATURES

During this phase:

```text
NO NEW BUSINESS FEATURE
NO NEW DOMAIN
NO NEW DATABASE MIGRATION
NO DESTRUCTIVE REFACTOR
NO ROUTE REWRITE
NO DATA DELETE
```

This phase is discovery, audit, analysis and decision preparation.

### DO NOT INVENT

Never invent:

- routes;
- pages;
- entities;
- fields;
- workflows;
- APIs;
- permissions;
- feature status;
- ownership.

Every conclusion requires evidence.

### CODE ≠ FEATURE COMPLETION

A feature is not implemented merely because a:

```text
database table
API
service
component
menu item
type/interface
migration
```

exists.

A user-facing feature should be marked implemented only when the relevant page/workflow is actually usable.

### PRESERVE EXISTING BEHAVIOR

Do not change working implementation merely to make it match the target architecture.

```text
DOCUMENT FIRST
DECIDE SECOND
CHANGE LATER
```

### PRESERVE PRODUCTION DATA

Any future migration proposal must identify:

```text
source
destination
mapping
transformation
validation
rollback
```

Do not execute destructive migration during this audit.

---

## 3. EVIDENCE HIERARCHY

Use evidence in this order:

```text
1. Actual running application behavior
2. Existing database/schema
3. Actual routes/pages
4. Existing APIs/services
5. Existing tests/E2E
6. Existing navigation configuration
7. Existing architecture/handoff documents
8. Target FABRIX architecture documents
9. Inference
```

When evidence conflicts, document the conflict. Do not silently resolve it.

---

## 4. REPOSITORY AUDIT

Inspect the complete repository and actual paths discovered.

At minimum investigate:

```text
src/
app/
pages/
routes/
components/
features/
modules/
domains/
services/
lib/
server/
api/
database/
db/
prisma/
migrations/
schema/
tests/
e2e/
config/
navigation/
auth/
permissions/
workflows/
jobs/
events/
```

Also inspect:

```text
package.json
README
CLAUDE.md
HANDOFF
architecture documents
ADR
environment configuration
CI/CD
test configuration
```

---

## 5. RUNNING APPLICATION AUDIT

Where possible, run the actual application and verify:

```text
Login
Navigation
Dashboard
Existing pages
CRUD
Transactions
Approvals
Reports
Workflows
Cross-domain interactions
```

Use browser/E2E verification for important user-facing pages where available.

Do not rely only on source code.

---

## 6. ROUTE AUDIT

Build an exact route inventory.

For every discovered route:

```text
Route
Page
Workspace
Feature
Permission
Status
Evidence
```

Example:

| Route | Page | Workspace | Feature | Status | Evidence |
|---|---|---|---|---|---|
| actual discovered route | Customers | Sales & CRM | Customers | Implemented | route + browser |
| actual discovered route | Sales Order | Sales & CRM | Sales Orders | Implemented | route + E2E |
| actual discovered route | MRP | Planning & APS | MRP | Partial | source + browser |

**DO NOT INVENT ROUTES.**

---

## 7. FEATURE INVENTORY

Create a complete inventory of existing functionality across:

```text
Overview
Control Tower
Sales & CRM
Product & Engineering
Planning & APS
Supply Chain
Procurement
Manufacturing
Quality
Traceability
Maintenance
Finance & Costing
Data & Analytics
AI
Integrations
Administration
```

Also identify capabilities already implemented that do not fit the target structure.

---

## 8. UX RECONCILIATION

Compare the current application navigation with:

```text
FABRIX_UX_Information_Architecture_v1.0.md
FABRIX_UX_Application_Shell_Navigation_Architecture_v1.0.md
```

Determine:

```text
CURRENT MENU
TARGET MENU
MISSING MENU
EXTRA MENU
MISPLACED MENU
BROKEN MENU
```

For every existing feature verify:

```text
navigation location
route
page
usability
workspace placement
```

---

## 9. DOMAIN RECONCILIATION

Compare current implementation against the FABRIX Master Architecture:

```text
01 UX / Information Architecture
02 Domain Architecture
03 Sales Architecture
04 Product & Engineering Architecture
05 Planning & APS Architecture
06 Supply Chain / Procurement Architecture
07 Manufacturing Architecture
08 Quality Architecture
09 Traceability Architecture
10 Maintenance Architecture
11 Costing & Finance Architecture
12 MES Architecture
13 Data & Analytics Architecture
14 AI Architecture
15 Integration Architecture
16 Platform / Administration Architecture
```

For every existing capability determine:

```text
AS-IS owner
TO-BE owner
conflict
decision
```

---

## 10. ENTITY AUDIT

For every major entity identify:

```text
Entity
Current table/model
Current owner
Current page
Current route
Current API
Current state
Relationships
Source of truth
Target owner
Target model
Target state
Migration required?
```

At minimum inspect:

```text
Company / Tenant
User
Customer
Contact
Lead
Opportunity
Sample Request
Quotation
Customer PO
Sales Order
Delivery
Return / RMA
Product
Item
SKU
Variant
Configuration
UOM
BOM
Formula
Routing
Operation
Work Center
Supplier
Purchase Requisition
RFQ
Purchase Order
Goods Receipt
Inventory
Warehouse
Location
Lot / Batch
Production Order
Work Order
Quality Inspection
NCR
CAPA
Equipment
Maintenance Order
Invoice
Payment
Cost
WIP
```

Do not assume these entities all exist.

---

## 11. SOURCE-OF-TRUTH AUDIT

Determine the authoritative source for:

```text
Customer master
Item master
BOM
Inventory balance
Lot genealogy
Production status
Quality disposition
Purchase Order status
Sales Order status
Manufacturing cost
```

Detect duplicate sources of truth.

Example:

```text
Inventory quantity A
        +
Inventory quantity B
        ↓
Which is authoritative?
```

Every conflict must be reported.

---

## 12. STATE MACHINE AUDIT

Inspect actual state machines for:

```text
Sales Order
Purchase Order
Production Order
Work Order
Quality Inspection
NCR
CAPA
Inventory Lot
Sample Request
Engineering Change
```

For each document:

```text
AS-IS states
Allowed transitions
Who can transition
Side effects
TO-BE states
Gap
```

Do not assume target states without evidence from the approved architecture/business rules.

---

## 13. WORKFLOW AUDIT

Inspect actual cross-domain flows:

```text
Lead → Opportunity
Opportunity → Sample Request
Quotation → Sales Order
Sales Order → Demand
Demand → Planning
Planning → MRP
MRP → Purchase Requisition
MRP → Production Order
Purchase Order → Goods Receipt
Goods Receipt → Quality
Quality → Inventory
Production → Quality
Production → Lot
Lot → Delivery
Production → Costing
Maintenance → Capacity
```

For each identify:

```text
exists
partial
missing
incorrect
unknown
```

---

## 14. AS-IS vs TO-BE MASTER MATRIX

Create:

| Domain | Capability | AS-IS | TO-BE | Gap | Decision | Priority | Evidence |
|---|---|---|---|---|---|---|---|
| Sales | Sales Orders | ... | ... | ... | KEEP/ADAPT/... | P0-P3 | ... |
| Engineering | BOM | ... | ... | ... | ... | ... | ... |
| Planning | MRP | ... | ... | ... | ... | ... | ... |
| Manufacturing | Production Order | ... | ... | ... | ... | ... | ... |
| Quality | Inspection | ... | ... | ... | ... | ... | ... |

Cover all relevant capabilities discovered.

---

## 15. DECISION CATEGORIES

Every gap/conflict must receive one:

### KEEP

Current implementation is aligned.

### ADAPT

Existing implementation is useful but must evolve.

Example:

```text
BOM exists
+
Revision missing
+
Effectivity missing
```

### MIGRATE

Existing structure must move to a canonical target structure.

Document:

```text
source
target
mapping
transformation
validation
rollback
```

### DEPRECATE

Existing model/feature no longer belongs to the target architecture.

Do not immediately delete it.

```text
ACTIVE
 ↓
DEPRECATED
 ↓
READ-ONLY / MIGRATION
 ↓
REMOVAL
```

### DECISION REQUIRED

Evidence or requirements are insufficient. Do not guess.

---

## 16. IMPLEMENTATION STATUS

Every feature/page receives one:

```text
IMPLEMENTED + VERIFIED URL
IMPLEMENTED
PARTIAL
PLACEHOLDER
ARCHITECTURE ONLY
NOT IMPLEMENTED
BROKEN
UNKNOWN
```

Definitions:

- **Implemented + Verified URL:** usable and route verified.
- **Implemented:** usable but dedicated route still needs verification or does not exist.
- **Partial:** meaningful functionality exists but target capability is incomplete.
- **Placeholder:** page/menu exists but meaningful functionality is absent.
- **Architecture Only:** documented but not implemented.
- **Not Implemented:** no meaningful implementation.
- **Broken:** exists but unusable.
- **Unknown:** insufficient evidence.

---

## 17. NAVIGATION STATUS MAP

Produce a complete status-aware navigation map.

Example:

```text
🏠 Overview                    🟢↗
🎯 Control Tower               🟡

💼 Sales & CRM
├── Customers                 🟢↗
├── Opportunities             🟢↗
├── Sample Requests           🟡
├── Quotations                🟢↗
└── Sales Orders              🟢↗

🧩 Product & Engineering
├── Products                  🟢
├── Items / SKU               🟢
├── BOM                       🟡
├── Routing                   ⚪
└── Engineering Changes       ⚪
```

Legend:

```text
🟢↗ Implemented + verified URL
🟢  Implemented
🟡  Partial
🟠  Placeholder
⚪  Architecture only
🔴  Not implemented
⚫  Unknown
```

Use actual evidence.

---

## 18. EXISTING FEATURES OUTSIDE TARGET NAVIGATION

Find:

```text
EXISTING FEATURE
        ↓
NOT REPRESENTED IN TARGET UX
```

For each decide:

```text
ADD TO NAVIGATION
MOVE TO ANOTHER WORKSPACE
CONTEXTUAL ONLY
HIDDEN / ADMIN ONLY
DEPRECATE
DECISION REQUIRED
```

Do not silently discard existing functionality.

---

## 19. TECHNICAL DEBT AUDIT

Identify debt relevant to future manufacturing development:

```text
Duplicate entity
Duplicate source of truth
Incorrect ownership
Tight coupling
Missing state machine
Missing audit trail
Hard-coded workflow
Hard-coded route
Duplicate calculation
Missing transaction boundary
Missing idempotency
Unsafe mutation
Legacy schema
Missing foreign key
Inconsistent naming
```

Classify:

```text
CRITICAL
HIGH
MEDIUM
LOW
```

---

## 20. MANUFACTURING READINESS AUDIT

Before Product & Engineering implementation, verify readiness for:

```text
Product
Item
SKU
Variant
Configuration
UOM
BOM
Formula
Routing
Operation
Revision
Effectivity
Engineering Change
Production Order
Work Order
Inventory
Lot / Batch
Quality
Costing
```

Do not implement these during this audit unless explicitly approved.

---

## 21. DATA MIGRATION RISK

For every ADAPT / MIGRATE / DEPRECATE decision identify:

```text
Data affected
Historical records affected
Production records affected
Financial records affected
Traceability affected
API consumers affected
UI affected
Reports affected
Integrations affected
```

Risk:

```text
LOW
MEDIUM
HIGH
CRITICAL
```

No migration is executed during reconciliation.

---

## 22. SECURITY / PERMISSION RECONCILIATION

Check:

```text
Current role
Current permission
Target permission
Entity ownership
Approval authority
Tenant isolation
Company isolation
Data visibility
Action authorization
```

Flag:

```text
permission escalation
missing permission
overly broad permission
cross-tenant risk
cross-company risk
```

---

## 23. AUDITABILITY RECONCILIATION

For important mutations check:

```text
actor
timestamp
before state
after state
reason
approval
correlation/reference
```

Especially:

```text
Sales Order
Purchase Order
Production Order
Inventory
Quality
BOM
Engineering Change
Cost
Finance
```

---

## 24. TEST RECONCILIATION

For each major capability identify:

```text
Unit tests
Integration tests
E2E tests
Browser verification
Migration tests
Permission tests
Concurrency tests
```

Classify:

```text
GOOD COVERAGE
PARTIAL
WEAK
NONE
UNKNOWN
```

---

## 25. REQUIRED REGISTERS

### Architecture Decision Register

| ID | Decision | Context | Options | Recommendation | Owner | Status |
|---|---|---|---|---|---|---|
| ADR-001 | ... | ... | ... | ... | ... | Open |

### Gap Register

| ID | Gap | Domain | Impact | Severity | Dependency | Proposed Action |
|---|---|---|---|---|---|---|
| GAP-001 | ... | ... | ... | ... | ... | ... |

### Risk Register

| ID | Risk | Impact | Probability | Severity | Mitigation |
|---|---|---|---|---|---|
| RISK-001 | ... | ... | ... | ... | ... |

---

## 26. REQUIRED DIAGRAMS

Create Mermaid diagrams for:

1. Current UX
2. Current Domains
3. Current Entities
4. Current Data Flow
5. Current Transaction Flow
6. Current Integrations
7. Target UX
8. Target Domains
9. Target Entity Relationships
10. Target Workflow
11. AS-IS → Reconciliation → TO-BE

Base diagrams on actual findings; do not fabricate implementation details.

---

## 27. PRIORITY

Classify every gap:

```text
P0 — BLOCKER
Must resolve before dependent implementation.

P1 — CRITICAL
Should resolve before next major domain.

P2 — IMPORTANT
Can be scheduled during implementation.

P3 — OPTIMIZATION
Can be deferred.
```

---

## 28. EXIT CRITERIA

Do not declare reconciliation complete until:

```text
[ ] Repository audited
[ ] Running application inspected
[ ] Routes audited
[ ] Navigation audited
[ ] Feature inventory completed
[ ] Existing entities inventoried
[ ] Source-of-truth conflicts identified
[ ] State machines audited
[ ] Workflows audited
[ ] UX AS-IS mapped
[ ] Domain AS-IS mapped
[ ] TO-BE mapped
[ ] AS-IS vs TO-BE matrix completed
[ ] KEEP decisions identified
[ ] ADAPT decisions identified
[ ] MIGRATE decisions identified
[ ] DEPRECATE decisions identified
[ ] DECISION REQUIRED items identified
[ ] Data migration risks identified
[ ] Permission risks identified
[ ] Auditability gaps identified
[ ] Test coverage gaps identified
[ ] Decision Register created
[ ] Gap Register created
[ ] Risk Register created
[ ] Current diagrams created
[ ] Target diagrams created
[ ] Navigation status mapped
[ ] Existing features missing from UX identified
[ ] No destructive changes made
[ ] Next implementation sequence defined
```

---

## 29. REQUIRED OUTPUT FILES

Adapt to the existing FABRIX documentation convention; do not create duplicate documentation systems if one already exists.

Recommended:

```text
docs/
└── architecture/
    └── reconciliation/
        ├── AS-IS.md
        ├── TO-BE.md
        ├── RECONCILIATION.md
        ├── FEATURE-INVENTORY.md
        ├── ROUTE-INVENTORY.md
        ├── ENTITY-INVENTORY.md
        ├── SOURCE-OF-TRUTH.md
        ├── STATE-MACHINES.md
        ├── WORKFLOW-MAP.md
        ├── GAP-REGISTER.md
        ├── RISK-REGISTER.md
        ├── DECISION-REGISTER.md
        ├── MIGRATION-IMPACT.md
        ├── TEST-COVERAGE.md
        └── NAVIGATION-STATUS.md
```

---

## 30. CLAUDE OPUS 5 INSTRUCTION

You are the architecture reviewer/orchestrator.

Do not invent repository findings.

Pass this entire protocol to Claude Code and require evidence-based execution.

After Claude Code completes the audit:

1. Review every finding.
2. Challenge unsupported assumptions.
3. Verify critical route claims.
4. Verify source-of-truth conclusions.
5. Verify state-machine conclusions.
6. Review P0/P1 risks.
7. Review migration proposals.
8. Identify unresolved decisions.
9. Reject destructive or speculative recommendations.
10. Approve the reconciliation only when the evidence is sufficient.
11. Produce the next implementation sequence only after reconciliation is approved.

---

## 31. CLAUDE CODE EXECUTION MODE

Execute in this order:

```text
PHASE A — DISCOVERY
    ↓
PHASE B — CURRENT STATE AUDIT
    ↓
PHASE C — TARGET ARCHITECTURE MAPPING
    ↓
PHASE D — RECONCILIATION
    ↓
PHASE E — DECISION / GAP / RISK REGISTERS
    ↓
PHASE F — REVIEW
    ↓
PHASE G — FINAL REPORT
```

Do not jump from discovery to coding.

---

## 32. STOP CONDITIONS

Stop and report instead of guessing when there is:

```text
Critical source-of-truth conflict
Ambiguous entity ownership
Potential data loss
Production-history corruption risk
Financial-history risk
Traceability-history risk
Cross-tenant security risk
Major route conflict
Major state-machine conflict
Unknown critical dependency
```

Use:

```text
STOP CONDITION

Issue:
Evidence:
Impact:
Options:
Recommended decision:
Required owner:
```

---

# 33. FINAL COMMAND TO CLAUDE CODE

Execute the complete FABRIX Architecture Reconciliation now.

**Do not build the next feature yet.**

First establish a verified AS-IS model of the current FABRIX implementation.

Then compare it against the approved TO-BE architecture.

Do not guess.

Do not invent routes.

Do not invent feature status.

Do not delete or rewrite working implementation.

Do not perform destructive migrations.

Do not create fake pages.

Do not mark a capability complete merely because backend/database code exists.

Produce:

```text
AS-IS
TO-BE
RECONCILIATION
FEATURE INVENTORY
ROUTE INVENTORY
ENTITY INVENTORY
SOURCE-OF-TRUTH AUDIT
STATE-MACHINE AUDIT
WORKFLOW MAP
GAP REGISTER
RISK REGISTER
DECISION REGISTER
MIGRATION IMPACT
TEST COVERAGE
NAVIGATION STATUS
```

Then explicitly state:

```text
WHAT WE KEEP
WHAT WE ADAPT
WHAT WE MIGRATE
WHAT WE DEPRECATE
WHAT WE BUILD NEXT
WHAT REQUIRES PRODUCT OWNER DECISION
WHAT MUST NOT BE TOUCHED
```

The result must be suitable for Claude Opus 5 to review and convert into the next implementation plan.

**Architecture Reconciliation must be completed and reviewed before beginning Product & Engineering implementation.**

---

# 34. SUCCESS CRITERIA

The phase succeeds only when the team can answer with evidence:

> **What exactly does FABRIX have today, what exactly should FABRIX become, what is the difference, and what is the safest sequence to close that gap?**

If this cannot be answered clearly, reconciliation is not complete.

**END OF DOCUMENT**
