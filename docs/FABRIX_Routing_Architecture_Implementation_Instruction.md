# FABRIX — ROUTING ARCHITECTURE & IMPLEMENTATION INSTRUCTION

## Current-State Audit → Generalized Routing Engine → UX → Workflow → Validation

**Phase:** Product & Engineering  
**Domain:** Routing & Operations  
**Target:** Claude Opus 5 → Claude Code  
**Status:** Architecture Blueprint + Implementation Instruction

---

## 1. MISSION

Build or reconcile a Routing Engine that is general enough for multiple manufacturing industries and production models.

It must support, where configured:

```text
Discrete Manufacturing
Process Manufacturing
Batch Manufacturing
Assembly
Packaging
Food & Beverage
Chemical
Pharmaceutical
Cosmetics
Electronics
Automotive
Consumer Goods
Job Shop
Make-to-Stock
Make-to-Order
Engineer-to-Order
```

Routing defines:

> How a product is processed from start to finish, including operations, sequence/dependencies, resources, timing, capacity requirements, instructions, quality requirements and execution constraints.

Routing becomes a foundation for:

```text
BOM / Formula
 ↓
Routing
 ↓
Capacity
 ↓
Scheduling
 ↓
Production Order
 ↓
Work Order
 ↓
MES
 ↓
Costing
 ↓
Traceability
```

Routing is NOT merely:

```text
Operation 1
Operation 2
Operation 3
```

---

# 2. CRITICAL FIRST STEP — AUDIT ROUTING NOW

**DO NOT IMPLEMENT FIRST.**

Claude Code must inspect the existing FABRIX implementation.

Audit:

```text
Database / Schema
Routes
Pages
Components
Routing models
Operation models
Work Center models
Resource models
Production Order integration
BOM integration
Scheduling integration
Capacity integration
Costing integration
MES integration
APIs
Services
State machines
Permissions
Approval
Tests
E2E
Existing documentation
```

Search the repository for:

```text
routing
route
operation
operation sequence
work center
workcenter
resource
machine
labor
setup time
run time
queue time
move time
cycle time
capacity
production time
```

Do not assume Routing does not exist merely because its UI is incomplete.

---

# 3. REQUIRED AS-IS REPORT

Claude Code must determine:

1. Does Routing exist?
2. Where is its entity/database model?
3. What fields exist?
4. How does Routing relate to Product/Item?
5. How does Routing relate to BOM/Formula?
6. How does Routing relate to Production Order?
7. How does Routing relate to Work Order?
8. Does Operation exist?
9. Does Work Center exist?
10. Does Resource exist?
11. Does sequence exist?
12. Are parallel operations supported?
13. Are overlapping operations supported?
14. Are alternate operations supported?
15. Are setup/run/queue/move times supported?
16. Is capacity integrated?
17. Is scheduling integrated?
18. Is costing integrated?
19. Is MES integrated?
20. Are revision/effectivity supported?
21. Is approval/release supported?
22. Does a usable UI exist?
23. Does a verified URL exist?
24. What tests already exist?

Produce an evidence-based **ROUTING AS-IS** report.

---

# 4. AS-IS vs TO-BE MATRIX

Create:

| Capability | AS-IS | TO-BE | Gap | Decision |
|---|---|---|---|---|
| Routing Master | ? | General Routing | ? | KEEP/ADAPT/NEW |
| Operation | ? | Reusable Operation | ? | |
| Sequence | ? | Dependency Graph | ? | |
| Work Center | ? | Capacity Group | ? | |
| Resource | ? | General Resource | ? | |
| Setup Time | ? | Supported | ? | |
| Run Time | ? | Supported | ? | |
| Parallel Operation | ? | Supported | ? | |
| Overlap | ? | Supported | ? | |
| Alternate Operation | ? | Supported | ? | |
| Revision | ? | Supported | ? | |
| Effectivity | ? | Supported | ? | |
| Release | ? | Supported | ? | |
| Capacity | ? | Integrated | ? | |
| Scheduling | ? | Integrated | ? | |
| Costing | ? | Integrated | ? | |
| MES | ? | Future Integration | ? | |

Use actual repository/application evidence.

---

# 5. TARGET ROUTING ARCHITECTURE

Recommended conceptual hierarchy:

```text
PRODUCT / ITEM
      ↓
ROUTING
      ↓
ROUTING REVISION
      ↓
ROUTING OPERATIONS
      ↓
OPERATION
      ↓
RESOURCE REQUIREMENTS
      ↓
WORK CENTER / RESOURCE
      ↓
CAPACITY
      ↓
SCHEDULING
```

Important:

```text
Routing Definition
      ↓
Production Order
      ↓
Applied Routing / Snapshot
      ↓
Work Orders
      ↓
Execution
```

A released production order must not silently change because the Routing master was later revised.

---

# 6. ROUTING MASTER

Conceptual attributes:

```text
Code
Name
Description
Product / Item applicability
Routing Type
Status
Revision
Effective From
Effective To
Priority
Plant
Production Context
Default / Alternate
Owner
```

Do not copy these fields blindly into the current schema. Reconcile first.

Routing should support:

```text
STANDARD
ALTERNATE
SPECIAL
TEMPORARY
PILOT
REWORK
INSPECTION
PACKAGING
```

Only keep types that are justified by requirements.

---

# 7. OPERATION ARCHITECTURE

Operation is a reusable process definition.

Conceptual:

```text
Operation
├── Code
├── Name
├── Description
├── Instructions
├── Setup Duration
├── Run Duration
├── Queue Duration
├── Move Duration
├── Teardown Duration
├── Labor Requirement
├── Machine Requirement
├── Tool Requirement
├── Skill Requirement
├── Quality Requirement
├── Safety Requirement
└── Data Collection Requirement
```

Operation must be reusable across products.

Example:

```text
MIXING
FILLING
SEALING
WEIGHING
INSPECTION
PACKING
LABELING
CUTTING
WELDING
ASSEMBLY
CLEANING
```

---

# 8. OPERATION VS ROUTING

This distinction is mandatory.

```text
OPERATION
=
What process is performed?

ROUTING
=
In what sequence and under what rules are processes performed?
```

Example:

```text
Operations:
MIX
FILL
SEAL
LABEL

Routing A:
MIX → FILL → SEAL → LABEL

Routing B:
MIX → FILL → INSPECT → SEAL → LABEL
```

Same reusable Operations can participate in different Routings.

---

# 9. SEQUENCE AND DEPENDENCIES

Do not model Routing only as:

```text
1 → 2 → 3 → 4
```

Use dependency semantics.

Support:

```text
       ┌→ Operation B ─┐
Operation A            ├→ Operation D
       └→ Operation C ─┘
```

This enables parallel operations.

Validate that the graph is acyclic unless a future controlled looping/rework model explicitly supports loops.

---

# 10. PARALLEL OPERATIONS

Example:

```text
              ┌── Filling A ──┐
Mixing ───────┤               ├── Sealing
              └── Filling B ──┘
```

Do not force every manufacturing process into one linear route.

---

# 11. OVERLAP / PARTIAL TRANSFER

Support operation overlap where required.

Example:

```text
Operation A
████████████████

       Operation B
       ████████████████

              Operation C
              █████████████
```

Potential semantics:

```text
overlap quantity
overlap percentage
transfer batch
minimum transfer quantity
start offset
```

Before coding, define and test the exact semantics with Scheduling/APS architecture.

---

# 12. ALTERNATE OPERATIONS / RESOURCES

Support alternative paths:

```text
Operation: Packaging

Preferred:
Packaging Line 1

Alternative:
Packaging Line 2
```

Selection can depend on:

```text
capacity
availability
qualification
cost
priority
plant
material
customer requirement
```

Do not hard-code a single machine to an Operation.

---

# 13. RESOURCE ARCHITECTURE

General resource types may include:

```text
MACHINE
LABOR
TOOL
MOLD
LINE
ROOM
WORKSTATION
EXTERNAL
OTHER
```

A resource may have:

```text
capacity
calendar
skills
qualification
maintenance status
efficiency
cost rate
availability
location
```

The final resource taxonomy must remain configurable.

---

# 14. WORK CENTER

Work Center represents an operational grouping, location or capacity pool.

Example:

```text
Work Center: Filling

Resources:
Filler 01
Filler 02
Filler 03
```

Another factory may use:

```text
Plant
→ Production Line
→ Station
```

Therefore do not hard-code one universal hierarchy.

---

# 15. TIME MODEL

Support relevant time concepts:

```text
Setup Time
Run Time
Queue Time
Move Time
Wait Time
Teardown Time
Inspection Time
Transfer Time
```

Not every operation needs every time type.

The UI should reveal only applicable fields.

---

# 16. RUN-TIME CALCULATION

Support calculation modes such as:

```text
PER_UNIT
PER_BATCH
FIXED
FORMULA
RATE
```

Examples:

```text
10 seconds / unit
2 hours / batch
30 minutes fixed
100 units / hour
```

Support both time-based and rate-based production.

---

# 17. BATCH / LOT PROCESSING

Routing must support operations that process:

```text
1 unit
multiple units
batch
lot
continuous flow
```

Example:

```text
Mixing:
1 batch = 500 kg

Filling:
2,000 bottles/hour
```

Do not assume all operations are unit-based.

---

# 18. YIELD / SCRAP OWNERSHIP

Routing may represent process yield/loss.

Example:

```text
Input = 100 kg
Expected yield = 95 kg
Process loss = 5 kg
```

Do not duplicate BOM/Formula scrap semantics.

Recommended ownership:

```text
BOM / Formula
→ material quantity assumptions

Routing / Operation
→ process yield / loss assumptions
```

If current architecture differs, document the conflict before changing it.

---

# 19. QUALITY / SKILL / SAFETY REQUIREMENTS

Routing may reference:

```text
Inspection Required
Sampling Plan
Quality Checkpoint
Specification
Acceptance Criteria
Hold Required

Operator Skill
Certification
Machine Qualification
Tool Qualification
Safety Requirement
Training
```

Routing should reference Quality/HR master data rather than duplicating those systems.

---

# 20. MATERIAL CONSUMPTION POINTS

Operations should be able to associate material consumption points.

Example:

```text
Operation 10 — Mixing
→ RM-001
→ RM-002

Operation 20 — Filling
→ Packaging Material

Operation 30 — Labeling
→ Label
```

BOM/Formula remains the source of material definition.

Routing defines where/process context for consumption.

---

# 21. BOM / FORMULA ↔ ROUTING

Target relationship:

```text
PRODUCT / ITEM
      │
      ├──────────→ BOM / FORMULA
      │
      └──────────→ ROUTING
                         │
                         ↓
                    OPERATIONS
```

BOM/Formula answers:

> What materials are required?

Routing answers:

> How is it processed?

Together:

```text
BOM / Formula
+
Routing
=
Manufacturing Definition
```

---

# 22. REVISION AND EFFECTIVITY

Routing must support:

```text
Revision A
 ↓
Revision B
 ↓
Revision C
```

and:

```text
Effective From
Effective To
```

Never overwrite historical routing used by released production.

---

# 23. RELEASE LIFECYCLE

Recommended:

```text
DRAFT
 ↓
IN REVIEW
 ↓
APPROVED
 ↓
RELEASED
 ↓
SUPERSEDED
 ↓
OBSOLETE
```

Only valid released/effective Routings may be used for production.

Align state names with the existing Product/Engineering lifecycle architecture.

---

# 24. ROUTING SNAPSHOT

When a Production Order is released:

```text
Routing Master
      ↓
Revision B
      ↓
Production Order
      ↓
Applied Routing Snapshot
      ↓
Work Orders
```

If Revision C is released later, old Production Orders must not silently change.

This is mandatory for historical reproducibility, costing, traceability and audit.

---

# 25. ROUTING RESOLUTION

A planning/production transaction should be able to ask:

```text
Which routing applies to:
Product X
Plant Y
Order Type Z
Date D
Quantity Q
```

Resolver considers configured rules:

```text
Product
Plant
Effective Date
Status
Priority
Order Context
Alternate Routing
```

Return:

```text
Selected Routing
Selected Revision
Reason
```

The decision must be auditable.

---

# 26. ROUTING → PRODUCTION FLOW

```text
Production Demand
 ↓
Production Order
 ↓
Determine Product / Item
 ↓
Determine Effective BOM / Formula
 ↓
Determine Effective Routing
 ↓
Create Applied Routing Snapshot
 ↓
Generate Operations
 ↓
Resolve Resources
 ↓
Calculate Durations
 ↓
Calculate Capacity
 ↓
Schedule
 ↓
Generate Work Orders
 ↓
MES / Execution
```

---

# 27. ROUTING → CAPACITY / SCHEDULING

Routing provides:

```text
operation sequence
dependencies
duration
resource requirements
work center
alternative resources
calendar constraints
setup requirements
```

Capacity/Scheduling determines:

```text
start
finish
resource allocation
sequence timing
capacity consumption
```

**Routing defines process. Scheduling defines when it happens.**

Do not mix responsibilities.

---

# 28. ROUTING → COSTING

Routing provides process cost drivers:

```text
Machine Time
Labor Time
Setup Time
Resource Rate
External Process Cost
```

Costing consumes these.

Routing is not the accounting engine.

---

# 29. ROUTING → MES

Routing defines:

```text
operations
relationships
resource requirements
instructions
quality/execution requirements
```

MES later handles:

```text
actual execution
actual start/finish
operator actions
machine data
actual quantities
downtime
actual quality results
```

Do not put execution telemetry into the Routing master.

---

# 30. EXTERNAL OPERATIONS

Support an external operation:

```text
Operation 30
Plating
Resource Type:
EXTERNAL
```

Integration:

```text
Routing
 ↓
External Operation
 ↓
Supply / Procurement process
```

Do not embed Procurement logic inside Routing.

---

# 31. REWORK ROUTING

Support controlled rework:

```text
Inspection
 ↓
FAIL
 ↓
Rework Routing
 ↓
Re-inspection
```

Quality owns disposition.

Routing owns the process definition used for rework.

---

# 32. ROUTING BUSINESS RULES

At minimum enforce:

1. Routing code unique within its intended scope.
2. Operation references valid reusable Operation definition.
3. Released Routing is immutable.
4. Historical production retains applied Routing.
5. Effective-date conflicts are prevented or explicitly resolved.
6. Circular dependencies are rejected.
7. Invalid dependency graphs are rejected.
8. Required resources must be resolvable before release where policy requires.
9. Operation dependencies must be valid.
10. Required mandatory information must exist before release.
11. Alternate resources must satisfy qualification rules where configured.
12. Permissions control create/edit/approve/release.
13. Changes are auditable.
14. Production Orders do not silently inherit future routing revisions.
15. Routing remains independent from scheduling execution dates.

---

# 33. VALIDATION ENGINE

Before release, validate:

```text
✓ No circular dependency
✓ At least one valid start operation
✓ At least one valid terminal operation
✓ All operations valid
✓ Required resources resolvable
✓ Required work centers valid
✓ Time definitions valid
✓ Effective dates valid
✓ Revision valid
✓ Approval complete
✓ Required quality checkpoints configured
```

Errors:

```text
CANNOT RELEASE
```

Warnings may be allowed according to policy.

---

# 34. COMPLETE ROUTING FLOW

```text
CREATE ROUTING
      ↓
SELECT PRODUCT / ITEM
      ↓
DEFINE ROUTING METADATA
      ↓
ADD OPERATIONS
      ↓
DEFINE SEQUENCE / DEPENDENCIES
      ↓
DEFINE RESOURCES
      ↓
DEFINE TIME MODEL
      ↓
DEFINE MATERIAL CONSUMPTION POINTS
      ↓
DEFINE QUALITY REQUIREMENTS
      ↓
DEFINE SKILL / QUALIFICATION
      ↓
DEFINE ALTERNATE / PARALLEL PATHS
      ↓
DEFINE EFFECTIVITY
      ↓
VALIDATE
      ↓
SAVE DRAFT
      ↓
SUBMIT FOR REVIEW
      ↓
APPROVE
      ↓
RELEASE
      ↓
AVAILABLE FOR PLANNING / PRODUCTION
```

---

# 35. ROUTING CHANGE FLOW

```text
Released Routing
      ↓
Create New Revision
      ↓
Copy Previous Definition
      ↓
Edit
      ↓
Impact Analysis
      ↓
Review
      ↓
Approval
      ↓
Effective Date
      ↓
Release
      ↓
Old Revision → SUPERSEDED
```

Never directly edit a released historical definition.

---

# 36. UX PRINCIPLE

Routing UX must serve:

```text
Engineering / Process Designer
Planner / Manufacturing User
```

Engineering needs:

```text
definition
revision
effectivity
dependencies
resources
instructions
approval
```

Planning needs:

```text
duration
capacity
resource alternatives
sequence
constraints
```

MES later needs:

```text
operation
resource
work instruction
parameters
quality checks
execution requirements
```

Use one canonical Routing model with role-specific views.

---

# 37. ROUTING LIST UX

Recommended columns:

```text
Code
Name
Product
Plant
Revision
Status
Effective From
Effective To
Operations
Default
Updated
Owner
```

Filters:

```text
Product
Plant
Status
Revision
Routing Type
Effective Date
Owner
```

Actions:

```text
Open
Edit
Duplicate
Create Revision
Validate
Submit
Approve
Release
Supersede
Export
```

---

# 38. ROUTING DETAIL UX / LAYOUT

Recommended desktop shell:

```text
┌────────────────────────────────────────────────────────────────────────┐
│ Breadcrumb                                                             │
│ Product & Engineering / Routings                                      │
├────────────────────────────────────────────────────────────────────────┤
│ ROUTING: RT-0001                                      [Status]         │
│ Product: Product ABC                                  [Actions ▼]      │
├────────────────────────────────────────────────────────────────────────┤
│ Overview | Operations | Flow | Resources | Timing | Quality |         │
│ Materials | Revision | Effectivity | Validation | Audit               │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│                        ROUTING CONTENT                                 │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

Primary actions must be permission-driven:

```text
Edit
Duplicate
Create Revision
Validate
Submit
Approve
Release
Supersede
Obsolete
```

---

# 39. OVERVIEW TAB

Show:

```text
Routing Code
Routing Name
Product / Item
Plant
Revision
Status
Effective Date
Routing Type
Default / Alternate
Created By
Approved By
Owner
```

---

# 40. OPERATIONS TAB

Recommended:

```text
┌────┬──────────┬──────────────┬──────────────┬──────────┬─────────┐
│ Seq│ Operation│ Work Center  │ Resource     │ Duration │ Status  │
├────┼──────────┼──────────────┼──────────────┼──────────┼─────────┤
│ 10 │ Mixing   │ Mixing       │ Mixer 01     │ 30 min   │ ✓       │
│ 20 │ Filling  │ Filling      │ Filler 01    │ 60 min   │ ✓       │
│ 30 │ Inspect  │ QC           │ QC Station 1 │ 15 min   │ ✓       │
│ 40 │ Packing  │ Packaging    │ Line A       │ 45 min   │ ✓       │
└────┴──────────┴──────────────┴──────────────┴──────────┴─────────┘
```

Support:

```text
Add Operation
Edit
Duplicate
Delete
Reorder
Set Dependency
Set Parallel
Set Alternative
```

Do not make drag-and-drop the only way to define dependencies.

---

# 41. FLOW VIEW

Provide a visual flow editor for complex Routings:

```text
        ┌── Filling A ──┐
Mixing ─┤               ├─ Inspection ─ Packing
        └── Filling B ──┘
```

Support:

```text
Sequential
Parallel
Merge
Split
Alternative
Conditional Path
```

Keep a structured table representation for accessibility and precision.

---

# 42. OPERATION DETAIL DRAWER

Selecting an operation should open a contextual detail panel:

```text
┌─────────────────────────────────────────────┐
│ Operation 20 — Filling                     │
├─────────────────────────────────────────────┤
│ General                                     │
│ Resources                                   │
│ Timing                                      │
│ Materials                                   │
│ Quality                                     │
│ Skills / Qualification                      │
│ Instructions                                │
│ Parameters                                  │
│ Dependencies                                │
│ Alternatives                                │
│ Audit                                       │
└─────────────────────────────────────────────┘
```

Use a full detail page when complexity requires it.

---

# 43. RESOURCE UX

Support:

```text
Work Center
Resource Group
Specific Resource
Alternative Resources
Required Quantity
Qualification
Priority
Capacity
```

Example:

```text
Operation: Filling

Preferred:
Filler A

Alternatives:
Filler B
Filler C

Required:
1 machine
2 operators
```

---

# 44. TIMING UX

Do not force users to enter every time type.

Example:

```text
Time Model
[ Per Unit ▼ ]

Setup Time
Run Time
Queue Time
Move Time
Teardown Time
```

For rate-based operations:

```text
Production Rate
[ 100 units / hour ]

Batch Size
[ 500 units ]
```

Reveal fields dynamically according to selected model.

---

# 45. VALIDATION UX

Provide an explicit validation panel:

```text
Routing Validation

✓ Operations valid
✓ Dependency graph valid
✓ No circular dependency
✓ Resources valid
⚠ Resource calendar missing
✓ Effectivity valid
✕ Approval required
```

Severity:

```text
ERROR
WARNING
INFO
```

Mandatory errors block release.

---

# 46. REVISION UX

Example:

```text
Routing RT-0001

Revision A   SUPERSEDED
Revision B   RELEASED
Revision C   DRAFT
```

Show:

```text
Revision
Effective From
Effective To
Created By
Approved By
Change Reason
Change Summary
```

---

# 47. IMPACT ANALYSIS UX

Before releasing a new revision, identify:

```text
Affected Products
Affected BOM / Formula
Open Production Orders
Scheduled Operations
Future Planned Orders
Costing
Quality Specifications
MES Definitions
```

Do not silently modify already released Production Orders.

---

# 48. GENERALIZATION REQUIREMENTS

Routing must NOT assume:

```text
one plant
one work center
one machine
one operation sequence
one unit
one batch
one time model
one resource
one industry
one product
one manufacturing method
```

It should support, where needed:

```text
multi-plant
multi-routing
multi-revision
multi-resource
alternative resource
parallel operation
overlap
batch
unit
rate
continuous
external operation
rework
inspection
packaging
```

Advanced capabilities should be configurable and should not overwhelm the base UX.

---

# 49. MULTI-PLANT

A Routing may be:

```text
Global
Plant-specific
```

Example:

```text
Product ABC

Plant A → Routing A
Plant B → Routing B
```

Selection logic must be deterministic and auditable.

---

# 50. ALTERNATE ROUTING

Support:

```text
Routing A — Preferred
Routing B — Alternate
Routing C — Temporary
```

Selection may depend on:

```text
Plant
Product
Order Type
Capacity
Customer
Effective Date
Priority
```

Do not allow ambiguous routing selection.

---

# 51. ROUTING SECURITY

Permissions should distinguish:

```text
View Routing
Create Routing
Edit Draft Routing
Submit Routing
Approve Routing
Release Routing
Create Revision
Supersede Routing
Obsolete Routing
Export Routing
```

Edit authority does not automatically imply release authority.

---

# 52. AUDIT

Audit at minimum:

```text
Routing Created
Operation Added
Operation Removed
Dependency Changed
Resource Changed
Timing Changed
Revision Created
Routing Submitted
Routing Approved
Routing Released
Routing Superseded
Routing Obsoleted
```

Record:

```text
actor
timestamp
before
after
reason
revision
source
```

---

# 53. DOMAIN/API PRINCIPLES

Routing business logic must be domain-owned.

Avoid UI-specific business logic.

Conceptual services:

```text
RoutingService
OperationService
RoutingValidationService
RoutingRevisionService
RoutingReleaseService
RoutingImpactService
RoutingResolutionService
```

Reuse existing service conventions instead of creating duplicates.

---

# 54. MRP / APS BOUNDARY

Routing does not calculate material requirements.

```text
BOM / Formula
→ Material Requirement

Routing
→ Process / Capacity Requirement

MPS / MRP
→ Planning

APS / Scheduling
→ Timing / Resource Allocation
```

Keep responsibilities separate.

---

# 55. MES BOUNDARY

Routing defines:

```text
what operations exist
how they relate
what resources are required
what instructions/checks are required
```

MES later handles:

```text
actual execution
actual start/finish
operator actions
machine data
actual quantities
downtime
actual quality results
```

Do not put execution telemetry into Routing master data.

---

# 56. REQUIRED IMPLEMENTATION PLAN

Claude Code must first report:

```text
A. Routing AS-IS
B. Routing TO-BE
C. Gap Matrix
D. Data Model Recommendation
E. Domain Ownership
F. Workflow
G. UX Architecture
H. Route / URL
I. Permission Model
J. API / Service Boundary
K. Migration Impact
L. Test Plan
M. Implementation Sequence
```

Only after review/approval should implementation begin.

---

# 57. REQUIRED TEST MATRIX

Test:

```text
Basic linear routing
Parallel operations
Operation dependency
Split / merge
Alternative resource
Alternative routing
Multi-plant routing
Revision
Effectivity
Release
Supersede
Historical snapshot
Batch timing
Unit timing
Rate timing
Setup time
Queue time
Move time
Resource capacity
Skill requirement
Quality checkpoint
Material consumption point
External operation
Rework
Permission
Approval
Audit
```

Also negative cases:

```text
Circular dependency
Missing resource
Invalid effective dates
Duplicate routing
Conflicting routing
Released routing mutation
Unauthorized release
Expired routing
Invalid alternative
```

---

# 58. ACCEPTANCE CRITERIA

```text
[ ] Existing routing implementation audited
[ ] AS-IS documented
[ ] TO-BE documented
[ ] Gap matrix completed
[ ] Product/Item relationship defined
[ ] BOM/Formula relationship defined
[ ] Operation model defined
[ ] Work Center model defined
[ ] Resource model defined
[ ] Sequence/dependency model defined
[ ] Parallel operation supported
[ ] Overlap semantics defined
[ ] Alternative resource supported
[ ] Alternative routing supported
[ ] Time model generalized
[ ] Batch/unit/rate models supported
[ ] Revision supported
[ ] Effectivity supported
[ ] Release lifecycle supported
[ ] Historical routing snapshot supported
[ ] Validation engine defined
[ ] Capacity integration defined
[ ] Scheduling boundary defined
[ ] Costing boundary defined
[ ] MES boundary defined
[ ] Quality integration defined
[ ] UX list/detail/flow designed
[ ] Permissions defined
[ ] Approval defined
[ ] Audit defined
[ ] Multi-plant behavior defined
[ ] Rework behavior defined
[ ] External operation behavior defined
[ ] Tests defined
[ ] No destructive changes made without approval
```

---

# 59. FINAL COMMAND TO CLAUDE CODE

You are working on FABRIX Routing.

**Do not immediately rewrite or create Routing.**

First inspect the current FABRIX implementation and establish the real AS-IS.

Then compare it with this target architecture.

Answer with evidence:

```text
What Routing exists today?
What is correct?
What is incomplete?
What conflicts with the target architecture?
What can be reused?
What must be adapted?
What must be migrated?
What must be deprecated?
What is missing?
```

Then provide the recommended TO-BE Routing architecture.

The final Routing solution must be:

```text
GENERAL
CONFIGURABLE
MULTI-INDUSTRY
MULTI-PLANT
MULTI-PRODUCT
MULTI-RESOURCE
REVISION-AWARE
EFFECTIVITY-AWARE
CAPACITY-AWARE
SCHEDULING-READY
MES-READY
COSTING-READY
QUALITY-AWARE
TRACEABILITY-AWARE
AUDITABLE
PERMISSION-AWARE
```

Do not overfit the architecture to one factory.

Do not hard-code industry-specific assumptions.

Do not make Scheduling, MES, Quality or Costing the owner of Routing.

Routing is the reusable **manufacturing process definition** consumed by those domains.

After implementation, verify:

```text
UX
Database
API
Permissions
Workflow
Validation
Historical behavior
Integration
Unit Tests
Integration Tests
E2E
Browser
```

Only declare Routing complete after all acceptance criteria are satisfied.

**END OF DOCUMENT**
