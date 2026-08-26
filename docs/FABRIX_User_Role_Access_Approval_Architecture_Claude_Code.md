<!-- CATATAN KEPALA — ditambahkan Claude Code, 25 Agu 2026 -->
> **Penulis dokumen**: Claude Opus 5, diserahkan lewat pemilik produk.
> **Diterima & dicatat**: 25 Agustus 2026.
> **Status di proyek ini**: **DICATAT SEBAGAI TASK `SEC-18`, BELUM DIKERJAKAN.**
>
> **§2 "RECONCILE FIRST" SUDAH DIJALANKAN** sebagai arkeologi baca-saja pada 25 Agu 2026.
> Hasilnya — tabel "sudah ada / sebagian / belum" beserta angka yang terukur — ada di detail
> task `SEC-18`. **Jangan mengulanginya.**
>
> **INI PEROMBAKAN, BUKAN PENAMBAHAN.** FABRIX hari ini memakai **satu kolom peran** per
> pengguna; dokumen ini mengusulkan **lima dimensi terpisah** (Level, Role, Position, Scope,
> Approval Authority). Diukur: **142 aturan RLS di 81 tabel**, dan **51 di antaranya menyebut
> peran**. Angka di task, bukan di sini, supaya tidak ada dua salinan.
>
> **SEBAGIAN ISINYA SUDAH ADA** — persetujuan PO klien tiga departemen, usul-sahkan standar
> produksi, dan penggolongan biaya SDM. **Jangan dibangun ulang.**
>
> **TIGA HAL DI DALAMNYA MENDESAK DAN BERDIRI SENDIRI** — tidak menunggu 12 fase:
> pemisahan pemeriksa/pelapor QC (§17), jejak audit yang tidak menyebut siapa (§29), dan
> siklus hidup akun yang tidak bisa dikirimi email (§24). Ketiganya sudah punya task sendiri.

# FABRIX — USER, ROLE, ACCESS & APPROVAL ARCHITECTURE

## User Management, Organization, Permission, Workflow & Approval Authority

**Phase:** Platform / Administration Architecture  
**Target:** Claude Code  
**Review Chain:** Claude Opus 5 → Claude Code  
**Status:** Architecture Blueprint + Implementation Instruction

---

## 1. MISSION

Build or reconcile FABRIX User Management so authorization is not limited to:

```text
User → Role → Permission
```

FABRIX requires:

```text
USER
 ↓
LEVEL + POSITION
 ↓
ROLE
 ↓
PERMISSION
 ↓
ORGANIZATION + SCOPE
 ↓
ACCESS POLICY
 ↓
WORKFLOW
 ↓
APPROVAL MATRIX
 ↓
REQUESTER → REVIEWER → APPROVER → EXECUTOR → VERIFIER
 ↓
AUDIT
```

This foundation must support Sales, Product & Engineering, Planning, Procurement, Manufacturing, Quality, Traceability, Maintenance, Finance, MES, Data, AI, Integrations and Administration.

---

## 2. CRITICAL INSTRUCTION — RECONCILE FIRST

Before implementing anything, inspect the existing FABRIX implementation.

Inspect:

```text
users
roles
permissions
authentication
authorization
organizations
companies
plants
departments
positions
approval workflows
workflow tables
audit logs
sessions
MFA
navigation permissions
existing admin pages
APIs
database schema
migrations
tests / E2E
```

Determine what already exists.

Do not create a parallel identity, role, permission or approval system if the existing system can be safely extended.

---

## 3. USER LEVEL

User Level represents organizational authority/seniority.

Baseline:

```text
L0 — Operator
L1 — Staff
L2 — Senior Staff
L3 — Supervisor
L4 — Manager
L5 — Head / Senior Manager
L6 — Director
L7 — Executive / Owner
```

Levels must be configurable per tenant/company.

**Level is not Role.**

---

## 4. ROLE

Role represents functional responsibility.

Examples:

```text
Sales Staff
Sales Supervisor
Sales Manager

R&D Staff
Product Engineer
R&D Supervisor
R&D Manager

Planner
Planning Supervisor
Planning Manager

Purchasing Staff
Buyer
Purchasing Supervisor
Purchasing Manager

Warehouse Operator
Warehouse Staff
Warehouse Supervisor
Warehouse Manager

Production Operator
Production Staff
Production Supervisor
Production Manager

QC Inspector
QA Staff
Quality Supervisor
Quality Manager

Maintenance Technician
Maintenance Supervisor
Maintenance Manager

Finance Staff
AR Staff
AP Staff
Cost Accountant
Finance Supervisor
Finance Manager

System Administrator
Master Data Administrator
Workflow Administrator
Security Administrator
```

Prefer configurable role composition instead of hard-coded role logic.

---

## 5. POSITION

Position represents the organizational job position.

Example:

```text
User
→ Position: Production Supervisor
→ Level: L3
→ Role: Production Supervisor
→ Department: Production
→ Plant: Surabaya
```

A position may provide default role, level, department and approval authority, but explicit overrides must be controlled and audited.

---

## 6. ORGANIZATION

Support:

```text
Tenant
 ↓
Company
 ↓
Business Unit
 ↓
Plant
 ↓
Department
 ↓
Section
 ↓
Team
 ↓
User
```

A user may have one primary organization assignment and additional authorized scopes where required.

---

## 7. SCOPE

Authorization must support:

```text
Tenant
Company
Business Unit
Plant
Warehouse
Department
Section
Team
Personal
```

Example:

```text
Budi
Role: Warehouse Supervisor
Plant: Surabaya
Warehouse: RM Warehouse
```

Budi may approve stock adjustments only within the permitted scope.

Never allow cross-company or cross-tenant access merely because a role exists.

---

## 8. PERMISSION MODEL

Use action-oriented permissions:

```text
VIEW
CREATE
EDIT
SUBMIT
APPROVE
REJECT
RELEASE
CANCEL
CLOSE
DELETE
EXPORT
PRINT
ADJUST
POST
```

Permission resolution must consider:

```text
User
Role
Permission
Scope
Organization
Resource
Workflow
Policy
Effective Date
```

---

## 9. REQUESTER / REVIEWER / APPROVER / EXECUTOR / VERIFIER

Workflows must support distinct actors:

```text
REQUESTER
    ↓
REVIEWER
    ↓
APPROVER
    ↓
EXECUTOR
    ↓
VERIFIER
```

Not every workflow requires every stage.

Do not automatically allow the same user to request, approve and execute the same transaction where policy requires separation.

---

## 10. APPROVAL AUTHORITY

Approval authority must not be hard-coded as:

```text
role = manager
```

It must be resolved by policy using possible conditions:

```text
document type
amount
department
plant
company
customer
product
discount
risk
request type
budget
```

Conceptual flow:

```text
REQUEST
 ↓
APPROVAL POLICY
 ↓
CONDITIONS
 ↓
APPROVER RESOLUTION
 ↓
APPROVAL TASK
```

---

## 11. APPROVAL MATRIX

Create configurable approval policies.

Example:

| Workflow | Requester | Condition | Approver | Level |
|---|---|---|---|---|
| Purchase Requisition | Staff | low value | Supervisor | L3 |
| Purchase Requisition | Staff | medium value | Manager | L4 |
| Purchase Requisition | Staff | high value | Director | L6 |
| Sales Discount | Sales | above threshold | Sales Manager | L4 |
| Sample Request | Sales | paid sample | Finance | Configurable |
| Sample Request | Sales | high cost | Management | Configurable |
| Engineering Change | Engineer | major change | Engineering Manager | L4 |
| Production Order | Planner | release | Production Supervisor | L3 |

These thresholds are examples only. They must be configurable per tenant.

---

## 12. SAMPLE REQUEST

The Sales architecture requires Sample Request to coordinate Sales, Finance, R&D and Management.

Conceptual:

```text
SALES
 ↓
SAMPLE REQUEST
 ↓
FINANCE REVIEW
 ↓
R&D REVIEW / EXECUTION
 ↓
MANAGEMENT APPROVAL
 ↓
APPROVED
 ↓
SAMPLE FULFILLMENT
```

The actual workflow must be condition-driven, for example by:

```text
Free / Paid
Sample Cost
Customer
Product
Quantity
Urgency
Expected Commercial Value
Management Threshold
```

Requester, financial reviewer, technical executor and management approver must be independently resolvable.

---

## 13. PROCUREMENT / PURCHASE ORDER

Example:

```text
Requester
 ↓
Supervisor Review
 ↓
Manager Approval
 ↓
Finance / Budget Approval
 ↓
Purchasing
```

Actual sequence must be driven by approval policy.

---

## 14. PRODUCTION ORDER

Example:

```text
Planner
 ↓
Create Production Order
 ↓
Production Supervisor
 ↓
Release
 ↓
Production Operator
 ↓
Execution
 ↓
Supervisor Verification
```

Conceptual roles:

```text
Planner = Requester
Production Supervisor = Approver / Releaser
Operator = Executor
Supervisor = Verifier
```

---

## 15. QUALITY

Example:

```text
QC Inspector
 ↓
Inspection Result
 ↓
QA Supervisor
 ↓
Disposition
```

Possible separation:

```text
QC Inspector → executes inspection
QA Supervisor → approves disposition
Quality Manager → approves exceptional disposition
```

---

## 16. ENGINEERING CHANGE

Support:

```text
Engineer
 ↓
Engineering Change Request
 ↓
Engineering Review
 ↓
Quality Review
 ↓
Production Review
 ↓
Management Approval
 ↓
Release
```

Major changes may require additional approval.

Approval routes must be configurable.

---

## 17. SEGREGATION OF DUTIES (SoD)

FABRIX must support SoD policies.

Example conflict:

```text
CREATE PURCHASE ORDER
+
APPROVE PURCHASE ORDER
+
RECEIVE GOODS
```

Another:

```text
CREATE PAYMENT
+
APPROVE PAYMENT
```

Detect conflicts during:

- role assignment;
- permission assignment;
- scope assignment;
- role changes;
- temporary access.

Example:

```text
⚠️ Segregation of Duties Conflict

This user would be able to:
Create Purchase Orders
and
Approve Purchase Orders.

Action:
Review Access / Override with Reason
```

Any override must be authorized and audited.

---

## 18. DELEGATION

Support temporary approval delegation:

```text
Delegate From
Delegate To
Start Date
End Date
Workflow Scope
Reason
```

Delegation automatically expires.

All delegation changes must be audited.

---

## 19. ESCALATION

Approval tasks should support SLA and escalation:

```text
Request
 ↓
Supervisor
 ↓
SLA expires
 ↓
Manager
 ↓
SLA expires
 ↓
Head
```

Configurable:

```text
SLA duration
Escalation target
Escalation level
Notification
Repeat behavior
```

---

## 20. EFFECTIVE-DATED ACCESS

Access assignments must support:

```text
effective_from
effective_to
```

Example:

```text
User: Budi
Role: Acting Production Supervisor

Effective:
01 Sep 2026
-
31 Dec 2026
```

After expiry the access becomes inactive automatically.

Apply this to roles, scopes, approval authority, delegation and temporary access.

---

## 21. TEMPORARY / EMERGENCY ACCESS

Support controlled temporary access for:

```text
Project access
Plant access
Approval authority
Admin access
Emergency / break-glass access
```

Require:

```text
reason
requester
approver
start
expiry
scope
audit
```

Emergency access must automatically expire and have enhanced auditing.

---

## 22. SERVICE / API ACCOUNTS

Distinguish:

```text
Human User
Service Account
API Client
Integration User
System Account
```

Each service account requires:

```text
owner
purpose
scope
credential lifecycle
expiry
audit
```

Do not grant interactive human permissions by default.

---

## 23. SESSION / DEVICE / MFA SECURITY

Administration should support:

```text
Active Sessions
Devices
Login History
Session Revocation
Suspicious Login
MFA Status
Security Events
```

MFA policies may be scoped to:

```text
Tenant
Company
Role
Level
User
Action
```

High-risk actions may require stronger authentication.

---

## 24. USER LIFECYCLE

Support:

```text
INVITED
 ↓
ACTIVE
 ↓
SUSPENDED
 ↓
LOCKED
 ↓
DEACTIVATED
```

Deactivation must preserve historical audit records.

---

## 25. ADMINISTRATION NAVIGATION

Recommended:

```text
⚙️ Administration
│
├── Users
├── Roles
├── Permissions
├── User Levels
├── Positions
├── Organization
│   ├── Companies
│   ├── Business Units
│   ├── Plants
│   ├── Departments
│   ├── Sections
│   └── Teams
│
├── Approval Matrix
├── Approval Delegation
├── Workflow
├── Segregation of Duties
├── Access Policies
├── Temporary Access
├── Sessions & Devices
├── Login Security
├── Audit Log
└── User Activity
```

Only expose items according to permission.

---

## 26. USER DETAIL UX

```text
User: Budi Santoso

Overview
├── Identity
├── Organization
├── Position
├── Level
├── Roles
├── Permissions
├── Scope
├── Approval Authority
├── Delegation
├── Security
├── Sessions
├── Activity
└── Audit
```

---

## 27. ROLE DETAIL UX

```text
Role: Production Supervisor

Overview
Permissions
Users
Organization Scope
Approval Authority
SoD Conflicts
Effective Dates
Audit
```

---

## 28. APPROVAL MATRIX UX

Recommended fields:

```text
Workflow
Condition
Requester
Required Approver
Approval Sequence
SLA
Escalation
Scope
Effective From
Effective To
Status
```

Example:

| Workflow | Condition | Approver | Sequence | SLA | Scope |
|---|---|---|---:|---|---|
| Purchase Requisition | below threshold | Supervisor | 1 | 24h | Plant |
| Purchase Requisition | above threshold | Manager | 2 | 48h | Plant |
| Sample Request | paid | Finance | 1 | 24h | Company |
| Engineering Change | major | Engineering Manager | 1 | 48h | Plant |

---

## 29. AUDIT REQUIREMENTS

Audit at minimum:

```text
User Created
User Invited
Role Assigned
Role Removed
Permission Changed
Scope Changed
Level Changed
Approval Authority Changed
Delegation Created
Delegation Expired
SoD Conflict Detected
SoD Override
MFA Changed
Session Revoked
User Suspended
User Reactivated
User Deactivated
Access Expired
```

Audit record should include:

```text
actor
target
action
timestamp
before
after
reason
source
correlation ID
```

---

## 30. SECURITY PRINCIPLES

Implement:

```text
Least Privilege
Deny by Default
Explicit Scope
Separation of Duties
Effective-Dated Access
Tenant Isolation
Company Isolation
Auditability
No Silent Privilege Escalation
```

---

# 31. CLAUDE CODE — MANDATORY EXECUTION INSTRUCTION

Before writing code:

1. Inspect existing authentication.
2. Inspect current users.
3. Inspect current roles.
4. Inspect permissions.
5. Inspect organizations, companies and plants.
6. Inspect workflow and approval implementation.
7. Inspect audit logging.
8. Inspect sessions and MFA.
9. Inspect relevant database models and migrations.
10. Inspect existing Administration UI.
11. Inspect routes.
12. Inspect tests/E2E.
13. Determine what already exists.
14. Determine what can be reused.
15. Determine what requires adaptation.
16. Determine what is missing.

Create an AS-IS vs TO-BE matrix before changing implementation.

---

# 32. DO NOT DUPLICATE EXISTING SYSTEMS

If existing functionality satisfies this architecture:

```text
KEEP
```

If partial:

```text
ADAPT
```

If schema restructuring is required:

```text
MIGRATE — DOCUMENT FIRST
```

If obsolete:

```text
DEPRECATE — DOCUMENT FIRST
```

If ambiguous:

```text
DECISION REQUIRED
```

Do not create parallel User, Role, Permission, Approval or Workflow systems if the current architecture can be extended safely.

---

# 33. IMPLEMENTATION ORDER

Only after reconciliation is approved:

```text
PHASE 1
Identity / User

PHASE 2
Organization / Position / Level

PHASE 3
Role / Permission

PHASE 4
Scope / Access Policy

PHASE 5
Approval Authority

PHASE 6
Approval Matrix / Workflow

PHASE 7
Delegation / Escalation

PHASE 8
Segregation of Duties

PHASE 9
Effective / Temporary Access

PHASE 10
Security / Sessions / MFA

PHASE 11
Audit / User Activity

PHASE 12
Service / API Accounts
```

Group phases according to the existing architecture where appropriate.

---

# 34. REQUIRED DATA MODEL REVIEW

Before any migration, produce an ERD covering conceptually:

```text
User
UserLevel
Position
Role
Permission
UserRole
RolePermission
Organization
Company
Plant
Department
Team
Scope
AccessPolicy
ApprovalAuthority
ApprovalMatrix
ApprovalRule
Workflow
WorkflowStep
ApprovalTask
Delegation
EscalationPolicy
SoDPolicy
SoDConflict
TemporaryAccess
Session
Device
AuditLog
ServiceAccount
```

These are conceptual names. Reuse existing entities where possible.

---

# 35. REQUIRED TESTING

### Unit

```text
permission resolution
scope resolution
approval resolution
SoD detection
delegation
effective dates
expiry
```

### Integration

```text
User → Role → Permission
User → Scope
Request → Approval Matrix
Approval → Workflow
Delegation → Approval
SoD → Role assignment
```

### E2E

Test:

```text
Staff creates request
 ↓
Supervisor receives approval
 ↓
Supervisor approves
 ↓
Executor receives task
 ↓
Verifier completes verification
```

Also test rejection, escalation, delegation, expiry and SoD conflict.

### Security

Test:

```text
Unauthorized page access
Unauthorized API access
Cross-company access
Cross-tenant access
Permission escalation
Expired access
Revoked access
Delegated access
SoD conflict
Session revocation
MFA enforcement
```

---

# 36. REQUIRED OUTPUT

After reconciliation and approved implementation, produce or update the existing FABRIX documentation system with:

```text
USER-MANAGEMENT-ASIS.md
USER-MANAGEMENT-TOBE.md
USER-ROLE-PERMISSION.md
ORGANIZATION-AND-SCOPE.md
APPROVAL-MATRIX.md
WORKFLOW-APPROVAL.md
SEGREGATION-OF-DUTIES.md
ACCESS-POLICY.md
SECURITY-AND-MFA.md
AUDIT-AND-ACTIVITY.md
```

Do not create duplicate documents if equivalent authoritative documents already exist.

---

# 37. REQUIRED CLAUDE CODE FINAL REPORT

Report:

```text
1. What already existed
2. What was reused
3. What was adapted
4. What was newly implemented
5. What remains missing
6. What was deprecated
7. What migrations are required
8. What permissions were introduced
9. What approval workflows were introduced
10. What SoD policies were introduced
11. What security controls were introduced
12. What tests were added
13. What risks remain
14. What decisions remain for Product Owner
15. What the next dependency is
```

---

# 38. ACCEPTANCE CRITERIA

FABRIX User Management is acceptable only when the system can answer:

```text
Who is this user?
Where does the user belong?
What is the user's position?
What is the user's level?
What roles does the user have?
What can the user do?
Where can the user do it?
When can the user do it?
What can the user approve?
What workflow can the user participate in?
Who can approve the user's request?
Who can execute it?
Who verifies it?
Can the user delegate?
What happens if approval is late?
Does the user's access violate SoD?
When does the user's access expire?
Who changed the access?
Can the entire access history be audited?
```

---

# 39. FINAL ARCHITECTURAL PRINCIPLE

FABRIX User Management is a **platform capability**, not merely an Administration CRUD screen.

The shared foundation is:

```text
IDENTITY
    +
ORGANIZATION
    +
AUTHORIZATION
    +
SCOPE
    +
WORKFLOW
    +
APPROVAL
    +
SECURITY
    +
AUDIT
```

Every operational domain must consume this shared foundation instead of implementing its own independent permission and approval logic.

**END OF DOCUMENT**
