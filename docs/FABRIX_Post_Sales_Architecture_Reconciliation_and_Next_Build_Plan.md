# FABRIX — POST-SALES ARCHITECTURE RECONCILIATION & NEXT BUILD PLAN

## From Existing Sales Foundation → Manufacturing Core → Planning/APS → MES Boundary

**Status:** Architecture Steering Baseline  
**Audience:** Claude Fable 5 → Claude Opus 5 → Claude Code

---

## 0. Executive Directive

FABRIX is already an actively developed and partially implemented manufacturing operating system.

This document is **not** a greenfield implementation plan.

The immediate objective after Sales architecture work is:

```text
EXISTING FABRIX IMPLEMENTATION
        +
MASTER ARCHITECTURE
        ↓
ARCHITECTURE RECONCILIATION
        ↓
ARCHITECTURE DECISIONS
        ↓
FABLE 5 REVIEW
        ↓
OPUS 5 TECHNICAL DESIGN
        ↓
CLAUDE CODE IMPLEMENTATION
        ↓
CROSS-DOMAIN VERIFICATION
```

Existing production behavior is evidence. Architecture is the target. Business requirements are the authority. None should be silently overwritten.

---

# 1. Current Project Position

FABRIX already has substantial implementation across foundations, master data, sales, procurement, inventory/warehouse, production foundations, delivery, margin, documents, security, deployment/CI, and other platform capabilities.

Therefore the project is now in:

> **Architecture ↔ Implementation Reconciliation**

not:

> Architecture → Start Coding

The architecture must catch up with implementation without destabilizing working behavior.

---

# 2. Master Architecture Status

```text
FABRIX MASTER ARCHITECTURE
│
├── 01 UX / Information Architecture          🔵 FINAL BASELINE
├── 02 Domain Architecture                    🔵 FINAL BASELINE
├── 03 Sales Architecture                     🟢 DESIGNED
├── 04 Product & Engineering Architecture    🟡 PARTIAL
├── 05 Planning & APS Architecture           🟢 DESIGNED
├── 06 Supply Chain / Procurement            🟢 DESIGNED
├── 07 Manufacturing Architecture            🟡 PARTIAL
├── 08 Quality Architecture                  🟢 DESIGNED
├── 09 Traceability Architecture             🟢 DESIGNED
├── 10 Maintenance Architecture              🟡 BASELINE
├── 11 Costing & Finance Architecture        🟡 PARTIAL
├── 12 MES Architecture                      🔴 NOT DESIGNED
├── 13 Data & Analytics Architecture         🔴 NOT DESIGNED
├── 14 AI Architecture                       🔴 NOT DESIGNED
├── 15 Integration Architecture              🔴 NOT DESIGNED
└── 16 Platform / Administration Architecture 🔴 NOT DESIGNED
```

---

# 3. Core Architecture Principle

FABRIX has three separate layers:

```text
UX / INFORMATION ARCHITECTURE
        ↓
BUSINESS DOMAIN ARCHITECTURE
        ↓
TECHNICAL ARCHITECTURE
```

Never automatically map:

```text
UX menu = database module
Domain = microservice
Technical engine = user-facing module
```

Example:

```text
UX:
Manufacturing → BOM

Domain:
Engineering → BOM

Technical:
BOM domain services / repositories / transactions
```

---

# 4. UX Baseline

```text
🏠 Overview
🎯 Control Tower
💼 Sales & CRM
🏭 Manufacturing
📅 Planning & APS
📦 Supply Chain
🔍 Quality
🔧 Maintenance
💰 Finance
📊 Data & Excel
✨ AI
🔌 Integrations
⚙️ Administration
```

`Pre-MES` must not become a user-facing module.

---

# 5. Canonical Post-Sales Digital Thread

```text
CUSTOMER
   ↓
SALES ORDER
   ↓
DEMAND
   ↓
MPS
   ↓
MRP
   ├──────────────────────┐
   ↓                      ↓
BUY                     MAKE
   ↓                      ↓
PROCUREMENT          PRODUCTION ORDER
   ↓                      ↓
RECEIVING            CAPACITY / SCHEDULING
   ↓                      ↓
QUALITY                WORK ORDER
   ↓                      ↓
INVENTORY             MES / EXECUTION
   │                      │
   └──────────┬───────────┘
              ↓
          TRACEABILITY
              ↓
           COSTING
              ↓
           FINANCE
```

This is the primary architecture verification scenario.

---

# 6. Immediate Priority — Architecture Reconciliation

Before implementing deeper MRP/APS/MES capabilities, create an explicit AS-IS vs TO-BE inventory.

For every important entity/domain:

```text
DOMAIN
ENTITY
CURRENT IMPLEMENTATION
CURRENT OWNER
CURRENT DATABASE MODEL
CURRENT STATE MACHINE
TARGET OWNER
TARGET MODEL
TARGET STATE MACHINE
CONFLICT
DECISION
MIGRATION REQUIRED
TEST REQUIRED
```

Do not assume that the new architecture automatically replaces existing implementation.

---

# 7. Reconciliation Decision Model

Every conflict must resolve into one of:

```text
KEEP
ADAPT
MIGRATE
DEPRECATE
DECISION REQUIRED
```

No silent architectural migrations.

---

# 8. Production Data Protection

For any migration affecting operational data:

```text
BASELINE
   ↓
MIGRATION
   ↓
RECONCILIATION
   ↓
AUTOMATED TEST
   ↓
BROWSER / E2E TEST
```

Critical inventory, financial and transaction values must be reconciled before and after migration.

---

# 9. Priority 1 — Product & Engineering Architecture

Engineering answers:

> How is a product technically defined and manufactured?

Product answers:

> What is the item/product?

Minimum product concepts:

```text
Product
Item
SKU
Variant
Configuration
UOM
Product Lifecycle
```

Minimum engineering concepts:

```text
BOM
BOM Line
Formula
Formula Line
Routing
Operation
Specification
Revision
Effectivity
Engineering Change
Approval
Release
```

Engineering lifecycle should support, as appropriate:

```text
DRAFT
REVIEW
APPROVED
RELEASED
SUPERSEDED
OBSOLETE
```

Exact states must be validated against existing implementation and business requirements.

---

# 10. BOM / Formula / Routing Authority

```text
PRODUCT / ITEM
      ↓
CONFIGURATION
      ↓
BOM / FORMULA
      ↓
ROUTING
      ↓
REVISION
      ↓
EFFECTIVITY
      ↓
RELEASE
```

MRP, Manufacturing and Costing must consume the released/effective definition rather than inventing their own versions.

Historical production must remain reproducible using the engineering definition effective when it was planned/released.

---

# 11. Engineering Change Control

```text
Change Request
 ↓
Impact Analysis
 ↓
Review
 ↓
Approval
 ↓
Effective Date / Revision
 ↓
Release
```

Changes must preserve historical reproducibility and auditability.

---

# 12. Priority 2 — Manufacturing Core

Core concepts:

```text
Production Plan
Production Order
Work Order
Operation
Material Requirement
Production Output
Scrap
Rework
Resource
Work Center
Schedule
```

Mandatory distinction:

```text
Production Order
= production intent / authorized manufacturing work

Work Order
= executable operation-level work

Scheduling
= when / where / resource allocation

MES
= actual shop-floor execution events
```

Do not collapse these into one object.

---

# 13. Production Order State Machine

Baseline:

```text
PLANNED
   ↓
FIRM
   ↓
RELEASED
   ↓
SCHEDULED
   ↓
READY
   ↓
IN_EXECUTION
   ↓
COMPLETED
   ↓
CLOSED
```

Possible exception states:

```text
ON_HOLD
CANCELLED
BLOCKED
```

Fable 5 must validate this against current implementation before Opus/Code changes it.

---

# 14. Work Order State

Baseline candidate:

```text
PLANNED
   ↓
RELEASED
   ↓
READY
   ↓
DISPATCHED
   ↓
IN_PROGRESS
   ↓
COMPLETED
```

Actual quantities, times, operators, machine states and execution events belong to the MES boundary.

---

# 15. Priority 3 — Scheduling / APS Foundation

Do not start with the Gantt UI.

First define:

```text
Resource
Work Center
Resource Group
Calendar
Shift
Capacity
Operation
Operation Dependency
Setup Time
Run Time
Queue Time
Move Time
Alternative Resource
Maintenance Availability
```

Then:

```text
Scheduling Engine
        ↓
Gantt / Visual Schedule
```

Gantt is a visualization of schedule semantics, not the scheduling engine.

---

# 16. Capacity and Operation Model

Capacity must support:

```text
Finite Capacity
Rough / Infinite Capacity where applicable
Resource Availability
Shift Calendar
Maintenance Downtime
Planned Downtime
Existing Commitments
Alternative Resources
```

Operations must be able to represent:

```text
Sequential Operations
Parallel Operations
Overlapping Operations
Operation Dependencies
Alternative Routing
Operation-specific Resources
```

---

# 17. Priority 4 — MPS / MRP Deepening

The MRP conceptual pipeline:

```text
Demand
 ↓
MPS
 ↓
BOM / Formula Explosion
 ↓
Gross Requirement
 ↓
Inventory Netting
 ↓
Reservations / Allocations
 ↓
Safety Stock
 ↓
Lot Sizing
 ↓
Lead Time Offset
 ↓
Planned Order
 ↓
Pegging
 ↓
Rescheduling
 ↓
Firming
 ↓
MAKE / BUY
```

MRP must be multi-level.

Agreed item categories:

```text
RAW MATERIAL
PACKAGING MATERIAL
SEMI FINISHED
FINISHED GOODS
CONSUMABLE
SPARE PART
SERVICE
```

Explicitly excluded:

```text
SUB-ASSEMBLY
BY-PRODUCT
CO-PRODUCT
```

Do not reintroduce excluded concepts merely because generic ERP software supports them.

---

# 18. MRP Special Cases

Architecture must explicitly address, where required:

```text
Multi-level BOM
Scrap
Yield
Alternate BOM
Alternate Routing
MAKE item
BUY item
MAKE-or-BUY item
Safety Stock
Minimum Order Quantity
Maximum Order Quantity
Order Multiple
Lead Time
Planning Fence
Firming
Pegging
Rescheduling
```

Any feature not supported by the business case should not be added merely for completeness.

---

# 19. MRP Output Contract

MRP should create planning outputs:

```text
Planned Production Order
Planned Purchase Requirement
Planning Exception
Pegging Relationship
```

Then:

```text
Planner Approval / Firming
       ↓
Production Order
or
Purchase Requisition
```

MRP should not directly create uncontrolled downstream transactions.

---

# 20. Procurement Boundary

Planning determines:

```text
What is needed?
How much?
When?
```

Procurement determines:

```text
From whom?
At what price?
Under what terms?
Supplier commitment
```

Flow:

```text
MRP
 ↓
Purchase Recommendation
 ↓
Purchase Requisition
 ↓
RFQ
 ↓
Supplier Quotation
 ↓
Supplier Selection
 ↓
Purchase Order
 ↓
Supplier Confirmation
 ↓
Receiving
 ↓
Quality
 ↓
Inventory
```

---

# 21. Inventory Boundary

Inventory owns physical stock state.

Conceptually:

```text
AVAILABLE
RESERVED
QUARANTINE
BLOCKED
REJECTED
```

Receiving does not automatically imply AVAILABLE.

Quality disposition may control release into available stock.

---

# 22. Quality Boundary

Quality owns quality disposition.

```text
Receipt
 ↓
Inspection Required
 ↓
Inspection
 ├── PASS → Release
 ├── FAIL → Hold / Reject
 └── CONDITIONAL → Controlled Disposition
```

Production quality:

```text
Production
 ↓
In-Process Inspection
 ↓
Final Inspection
 ↓
Release
```

---

# 23. Traceability Architecture

Traceability should be modeled as genealogy, not merely duplicated batch fields.

```text
Supplier Lot
 ↓
Inventory Lot
 ↓
Material Consumption
 ↓
Production Batch
 ↓
Finished Goods Lot
 ↓
Delivery
 ↓
Customer
```

Must support:

```text
Forward Trace
Backward Trace
Batch Genealogy
Recall Scope
```

Example:

```text
RM-LOT-001
 ↓
WO-001
 ↓
BATCH-001
 ├── FG-LOT-001
 ├── FG-LOT-002
 └── SCRAP
```

---

# 24. Costing Architecture

Manufacturing Costing should be designed before full implementation.

Components:

```text
Material
Labor
Machine
Overhead
Subcontracting
Packaging
Scrap
Yield Loss
Quality-related Cost
Other Manufacturing Cost
```

Suggested staged implementation:

```text
Phase 1
Material + Labor

Phase 2
Machine

Phase 3
Overhead

Phase 4
Standard vs Actual
Variance
```

Architecture should not be postponed merely because some cost data is not yet available.

---

# 25. Finance Boundary

```text
Production Actuals
 ↓
Manufacturing Costing
 ↓
WIP / FG Valuation
 ↓
Finance / GL
```

Finance owns accounting consequences.

Finance is not the source of truth for physical production events.

---

# 26. Maintenance ↔ Scheduling

Maintenance owns equipment availability.

Example:

```text
Mixer-01
Maintenance
10:00–14:00
```

Scheduling consumes:

```text
Mixer-01 unavailable
```

This affects:

```text
Capacity
Schedule
Production Order
Delivery Risk
Control Tower
```

---

# 27. Cross-Domain Events

Candidate events:

```text
SalesOrderConfirmed
DemandCreated
MPSApproved
MRPCompleted
PlannedOrderCreated
PurchaseRequisitionApproved
PurchaseOrderApproved
SupplierConfirmed
GoodsReceived
QualityInspectionRequired
QualityPassed
QualityFailed
InventoryReleased
ProductionOrderReleased
ScheduleReleased
ProductionDispatchReady
BatchCreated
GenealogyRecorded
MaintenanceDue
EquipmentUnavailable
CostCalculated
CostVarianceDetected
```

Events are integration mechanisms, not replacements for authoritative transactions.

---

# 28. Concurrency and Idempotency

High-contention operations must define:

```text
Locking
Optimistic Concurrency
Idempotency
Retry
Conflict Resolution
Audit
```

Examples:

```text
Stock reservation
Stock issue
MRP run
Production order release
Schedule allocation
PO approval
Quality release
Batch consumption
```

---

# 29. Canonical End-to-End Test

Maintain at least one complete manufacturing scenario:

```text
Customer
 ↓
Sales Order
 ↓
Demand
 ↓
MPS
 ↓
MRP
 ├── BUY
 │    ↓
 │   PR
 │    ↓
 │   PO
 │    ↓
 │   Receipt
 │    ↓
 │   QC
 │    ↓
 │   Inventory
 │
 └── MAKE
      ↓
   Production Order
      ↓
   Capacity
      ↓
   Schedule
      ↓
   Work Order
      ↓
   MES
      ↓
   Production Output
      ↓
   QC
      ↓
   Batch / Genealogy
      ↓
   FG Inventory
      ↓
   Delivery
      ↓
   Customer
```

This scenario becomes an architecture and E2E acceptance gate.

---

# 30. AS-IS / TO-BE Reconciliation Matrix

Fable 5 must create and populate this from actual repository/schema/code evidence:

| Domain | Entity | Current Implementation | Target Architecture | Conflict | Decision | Migration | Test |
|---|---|---|---|---|---|---|---|
| Product | Item | Inspect actual | Confirm | TBD | TBD | TBD | TBD |
| Engineering | BOM | Inspect actual | Engineering-owned | TBD | TBD | TBD | TBD |
| Engineering | Routing | Inspect actual | Engineering-owned | TBD | TBD | TBD | TBD |
| Planning | MRP | Existing / partial | Planning-owned engine | TBD | TBD | TBD | TBD |
| Procurement | PO | Existing | Procurement-owned | TBD | TBD | TBD | TBD |
| Inventory | Stock | Existing | Inventory-owned | TBD | TBD | TBD | TBD |
| Manufacturing | Production Order | Existing / partial | Manufacturing-owned | TBD | TBD | TBD | TBD |
| Scheduling | Schedule | Partial / future | Scheduling-owned | TBD | TBD | TBD | TBD |
| Quality | Inspection | Existing / partial | Quality-owned | TBD | TBD | TBD | TBD |
| Traceability | Genealogy | Existing / partial | Traceability-owned | TBD | TBD | TBD | TBD |
| Costing | Cost | Partial | Costing-owned | TBD | TBD | TBD | TBD |

Do not invent the current implementation values. Inspect the repository and database.

---

# 31. Architecture Compliance Gate

Before any major new domain implementation:

```text
Architecture reviewed
        ↓
Domain owner identified
        ↓
Source of truth identified
        ↓
State machine defined
        ↓
Cross-domain dependencies defined
        ↓
Commands / Events defined
        ↓
Concurrency defined
        ↓
Migration impact checked
        ↓
Security scope defined
        ↓
Tests defined
        ↓
Implementation
        ↓
E2E verification
```

---

# 32. Fable 5 Responsibilities

Fable 5 must:

1. Inspect existing FABRIX implementation evidence.
2. Compare implementation with Master Architecture.
3. Identify conflicts.
4. Identify missing architecture.
5. Identify duplicated ownership.
6. Identify weak source-of-truth boundaries.
7. Identify state-machine inconsistencies.
8. Identify migration risks.
9. Identify cross-domain coupling.
10. Identify technical debt that can block MRP/APS/MES.
11. Validate UX/domain separation.
12. Validate manufacturing domain boundaries.
13. Produce a corrected architecture baseline.

Fable 5 must not assume that a new document automatically overrides existing code.

---

# 33. Required Fable 5 Output

```text
01. Executive Assessment
02. Existing System Inventory
03. AS-IS Architecture
04. TO-BE Architecture
05. AS-IS vs TO-BE Gap Matrix
06. Architecture Conflicts
07. Domain Ownership Review
08. Source-of-Truth Review
09. Engineering Architecture Review
10. Manufacturing Core Review
11. Planning / MRP Review
12. Procurement Review
13. Inventory Review
14. Quality Review
15. Traceability Review
16. Costing Review
17. Scheduling / APS Review
18. MES Boundary Review
19. Security / Tenancy Review
20. Data Migration Review
21. Testing / E2E Review
22. Risk Register
23. Architecture Decision Records Required
24. Corrected Architecture
25. Recommended Implementation Sequence
```

---

# 34. Required Opus 5 Handoff

Fable 5 output should be transformed by Claude Opus 5 into:

```text
Domain Model
 ↓
Aggregate Model
 ↓
Entity Model
 ↓
State Machines
 ↓
Commands
 ↓
Queries
 ↓
Domain Services
 ↓
Application Services
 ↓
Events
 ↓
API Contracts
 ↓
Persistence
 ↓
Security
 ↓
Concurrency
 ↓
Migration
 ↓
Testing
```

Opus must not redesign business requirements without explicit justification.

---

# 35. Required Claude Code Handoff

Claude Code should receive implementation instructions only after Fable → Opus review.

Process:

```text
Read Architecture
 ↓
Read Existing Code
 ↓
Inspect Existing DB
 ↓
Create Implementation Plan
 ↓
Identify Migration Impact
 ↓
Implement Incrementally
 ↓
Run Tests
 ↓
Run E2E
 ↓
Run Browser Verification
 ↓
Run Security Checks
 ↓
Run Migration Reconciliation
 ↓
Update HANDOFF
```

If an architectural conflict is discovered:

```text
STOP
DOCUMENT
ASK / ESCALATE
```

Do not silently invent a new model.

---

# 36. Development Priority

Recommended sequence after Sales:

```text
1. Architecture Reconciliation
        ↓
2. Product & Engineering
        ↓
3. Manufacturing Core
        ↓
4. Scheduling / Capacity Foundation
        ↓
5. MPS / MRP Deepening
        ↓
6. Procurement Integration
        ↓
7. Quality / Traceability Integration
        ↓
8. Manufacturing Costing
        ↓
9. MES Architecture
        ↓
10. MES Implementation
        ↓
11. Data & Analytics
        ↓
12. AI
        ↓
13. Integrations
```

This is dependency-aware, not a requirement that all work be strictly serial.

---

# 37. Prohibited Patterns

Do not:

1. Rewrite working production data merely to match a new document.
2. Create duplicate sources of truth without justification.
3. Turn every domain into a microservice.
4. Put technical engines in the UX sidebar.
5. Let MRP directly mutate inventory.
6. Let AI silently execute consequential transactions.
7. Let analytics become an operational source of truth.
8. Collapse Production Order, Work Order, Scheduling and MES.
9. Build Gantt before defining scheduling semantics.
10. Build MES before defining the Production/MES execution boundary.
11. Reintroduce excluded business concepts merely because generic ERP software supports them.
12. Treat unit tests as sufficient proof of cross-domain correctness.
13. Perform large migrations without before/after reconciliation.
14. Continue feature expansion when an architecture conflict blocks the dependency chain.

---

# 38. Protected Business Constraints

Confirmed item categories:

```text
RAW MATERIAL
PACKAGING MATERIAL
SEMI FINISHED
FINISHED GOODS
CONSUMABLE
SPARE PART
SERVICE
```

Explicitly excluded:

```text
SUB-ASSEMBLY
BY-PRODUCT
CO-PRODUCT
```

Other protected principles:

```text
FABRIX > Traditional ERP
Procurement is required
MES is execution, not the whole platform
UX ≠ Domain ≠ Technical
Inventory owns physical stock
Quality owns quality disposition
Traceability owns genealogy
Costing owns manufacturing cost
Finance owns accounting
AI assists / recommends under governance
```

---

# 39. Architecture Decision Records

Create ADRs for at least:

```text
ADR-001 Product vs Item vs SKU
ADR-002 BOM / Formula Ownership
ADR-003 Routing Ownership
ADR-004 Revision and Effectivity
ADR-005 Production Order vs Work Order
ADR-006 Scheduling Ownership
ADR-007 MES Boundary
ADR-008 Inventory Source of Truth
ADR-009 Quality Disposition Ownership
ADR-010 Traceability Genealogy Model
ADR-011 Manufacturing Cost Model
ADR-012 MRP Output Contract
ADR-013 Cross-Domain Event Model
ADR-014 Concurrency Strategy
ADR-015 Migration Strategy
ADR-016 AI Action Governance
```

---

# 40. Success Criteria

This stage is successful when:

### Architecture
- Every major domain has an owner.
- Every authoritative entity has an owner.
- Major state machines are defined.
- Cross-domain dependencies are explicit.

### Existing implementation
- Existing implementation is inventoried.
- Conflicts are documented.
- No major conflict is silently ignored.

### Manufacturing
```text
Product → Engineering → Planning → Supply / Production
```
has a coherent digital thread.

### Execution boundary
```text
Production Order
      ↓
Work Order
      ↓
Scheduling
      ↓
MES
```
is explicit.

### Data safety
```text
Migration
 ↓
Reconciliation
 ↓
Tests
```
is mandatory.

### Delivery
```text
Fable 5
 ↓
Opus 5
 ↓
Claude Code
```
is the controlled architecture-to-code pipeline.

---

# 41. Final Architecture Principle

FABRIX must evolve as:

```text
BUSINESS REQUIREMENT
        ↓
UX
        ↓
DOMAIN
        ↓
SOURCE OF TRUTH
        ↓
STATE MACHINE
        ↓
BUSINESS RULE
        ↓
TRANSACTION
        ↓
EVENT
        ↓
TECHNICAL IMPLEMENTATION
        ↓
TEST
        ↓
REAL-WORLD VERIFICATION
```

Not:

```text
FEATURE REQUEST
        ↓
TABLE
        ↓
UI
        ↓
DONE
```

---

# 42. Handoff Statement

This document is the **Post-Sales Architecture Steering Baseline**.

Its purpose is to prevent the next stage of FABRIX development from diverging between:

```text
Existing Claude Code implementation
```

and:

```text
FABRIX Master Architecture
```

The immediate next deliverable is:

> **AS-IS / TO-BE Architecture Reconciliation + Manufacturing Core Architecture**

After that is approved, deeper MRP, APS, Manufacturing, Traceability, Costing and eventually MES can proceed against a stable architectural spine.

**END OF DOCUMENT**
