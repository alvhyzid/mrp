# FABRIX TESTING & QUALITY ENGINEERING GOVERNANCE

**Document Type:** Mandatory QA, Testing, Reliability & Release
Governance\
**Project:** FABRIX Manufacturing SaaS / Manufacturing Operating System\
**Primary Consumer:** Claude Chat Fable 5 --- Consultant\
**Downstream Consumers:** Claude Code Opus --- Instructor; Claude Code
--- Executor\
**Status:** MANDATORY\
**Version:** 1.0\
**Date:** 2026-08-24

------------------------------------------------------------------------

## 1. PURPOSE

This document defines the mandatory testing, quality engineering,
security, reliability, data integrity, performance, deployment, and
release governance for FABRIX.

FABRIX is a manufacturing-focused SaaS / manufacturing operating system.
Testing must protect:

-   business transaction correctness
-   inventory accuracy
-   MRP/MPS correctness
-   production planning correctness
-   purchasing correctness
-   data integrity
-   tenant isolation
-   security
-   auditability
-   calculation accuracy
-   concurrency safety
-   recoverability
-   deployment safety

Testing is NOT limited to:

> Does the feature work?

Testing must answer:

> Can this system be trusted with real manufacturing operations and real
> customer data?

------------------------------------------------------------------------

## 2. CORE PRINCIPLE

A feature is NOT complete because the happy path works.

A feature is complete only when it is:

``` text
FUNCTIONALLY CORRECT
+
DATA SAFE
+
TRANSACTION SAFE
+
SECURE
+
MULTI-TENANT SAFE
+
REGRESSION SAFE
+
PERFORMANT ENOUGH
+
ACCESSIBLE
+
OBSERVABLE
+
RECOVERABLE
+
TESTED
+
EVIDENCED
```

------------------------------------------------------------------------

## 3. NON-NEGOTIABLE RULES

### Rule 1 --- Every feature must have tests.

No production feature may be considered complete without appropriate
automated and/or manual tests.

### Rule 2 --- Critical business logic must be automated.

Examples:

-   MRP calculation
-   MPS calculation
-   inventory availability
-   stock reservation
-   production quantity
-   capacity calculation
-   cost calculation
-   lead time
-   procurement recommendation
-   order status transitions

### Rule 3 --- P0 failure blocks release.

``` text
P0 FAIL
   ↓
RELEASE BLOCKED
```

### Rule 4 --- Test status must be tracked.

Every test must have:

-   ID
-   description
-   priority
-   owner
-   schedule
-   status
-   last execution
-   result
-   evidence
-   next action

### Rule 5 --- PASS without evidence is not CERTIFIED.

Critical tests must produce evidence.

### Rule 6 --- Existing tests must be reused.

Do not create duplicate tests when an appropriate test already exists.

### Rule 7 --- Legacy code is not automatically trusted.

Existing code may work but still violate the current quality standard.

### Rule 8 --- Never silently skip a failed test.

A failure must become:

-   FIX REQUIRED
-   BLOCKED
-   ACCEPTED RISK with explicit approval
-   or RETEST

### Rule 9 --- Never claim a test was executed when it was not.

Claude must distinguish:

``` text
NOT RUN
PASS
FAIL
BLOCKED
```

### Rule 10 --- Testing must be continuously scheduled.

Some tests run on every PR, some every merge, some every deployment,
some periodically.

------------------------------------------------------------------------

## 4. SEVERITY MODEL

### P0 --- CRITICAL / RELEASE BLOCKER

Examples:

-   data corruption
-   cross-tenant data leakage
-   authentication bypass
-   authorization bypass
-   critical business calculation error
-   incorrect inventory transaction
-   duplicate financial/inventory transaction
-   failed database migration
-   unrecoverable data loss
-   critical security vulnerability
-   broken backup/restore capability
-   critical production workflow failure

P0 MUST block release.

### P1 --- HIGH

Examples:

-   major feature failure
-   significant performance degradation
-   critical integration failure with workaround
-   broken important workflow
-   serious observability failure
-   important regression

Normally blocks production release unless explicitly risk-accepted.

### P2 --- MEDIUM

Examples:

-   non-critical UX issue
-   moderate performance issue
-   edge case
-   non-critical workflow inconvenience

May be released with mitigation.

### P3 --- LOW

Examples:

-   cosmetic issue
-   minor usability improvement
-   non-critical optimization

### P4 --- INFORMATIONAL

Observations or future improvements.

------------------------------------------------------------------------

## 5. TEST LIFECYCLE

Every test must follow:

``` text
PLANNED
   ↓
SCHEDULED
   ↓
IN PROGRESS
   ↓
PASS / FAIL / BLOCKED
   ↓
FIX REQUIRED
   ↓
RETEST
   ↓
PASS
   ↓
CERTIFIED
```

Do not use only TODO → DONE.

------------------------------------------------------------------------

## 6. MANDATORY TEST CONTROL DOCUMENTS

Fable 5 MUST maintain:

``` text
FABRIX_TEST_MASTER.md
FABRIX_TEST_CALENDAR.md
FABRIX_TEST_COVERAGE_MATRIX.md
FABRIX_TEST_EXECUTION_LOG.md
FABRIX_TEST_DEBT.md
FABRIX_RELEASE_CERTIFICATION.md
```

These become the central QA control system.

------------------------------------------------------------------------

## 7. TEST MASTER LIST

`FABRIX_TEST_MASTER.md`

Every test must be registered with:

``` text
Test ID
Category
Module
Test Name
Description
Priority
Risk
Owner
Environment
Dependencies
Schedule
Status
Last Run
Last Result
Evidence
Defect ID
Next Action
Certification Status
```

Example:

``` text
DB-001
Category: Database
Module: Inventory
Test: Schema Integrity
Priority: P0
Owner: Claude Code
Environment: Staging
Status: PASS
Last Run: 2026-08-24
Evidence: test-results/DB-001/
Certification: CERTIFIED
```

------------------------------------------------------------------------

## 8. TEST EXECUTION HISTORY

Every execution must be recorded.

Example:

``` text
Test ID:
DB-002

Execution:
#004

Executed:
2026-08-24 22:15

Environment:
Staging

Dataset:
Manufacturing Demo Dataset v1.4

Result:
PASS

Duration:
2m 14s

Evidence:
test-results/DB-002/run-004/

Notes:
No orphan production order records found.
```

Never overwrite history.

------------------------------------------------------------------------

## 9. TEST EVIDENCE

Critical tests must produce evidence.

Recommended structure:

``` text
test-results/
├── DB-001/
│   ├── report.json
│   ├── output.log
│   └── summary.md
│
├── SEC-001/
│   ├── report.json
│   └── security-report.md
│
└── E2E-001/
    ├── screenshots/
    ├── trace/
    └── report.html
```

Evidence may include:

-   test report
-   logs
-   database reconciliation
-   screenshots
-   browser trace
-   API response
-   performance report
-   security scanner output
-   migration report

For P0:

> PASS without evidence is not certified.

------------------------------------------------------------------------

## 10. TEST CALENDAR

`FABRIX_TEST_CALENDAR.md`

### Every Pull Request

``` text
Lint
Type Check
Unit Tests
Static Analysis
Dependency Security Scan
```

### Every Merge

``` text
Integration Tests
API Tests
Database Tests
Regression Tests
```

### Every Staging Deployment

``` text
Migration Tests
E2E Tests
Smoke Tests
UI Regression
```

### Before Production

``` text
Full Regression
Security
Tenant Isolation
Critical E2E
Database Integrity
Migration
Backup/Restore
Performance
```

### After Production Deployment

``` text
Smoke Test
Health Check
Critical Workflow Verification
Error Monitoring
```

------------------------------------------------------------------------

## 11. RECURRING TEST SCHEDULE

Recommended baseline:

  Test                     Frequency                  Priority
  ------------------------ -------------------------- ----------
  Unit Tests               Every PR                   P0
  Integration Tests        Every merge                P0
  API Tests                Every merge                P0
  Dependency Security      Daily / CI                 P1
  Database Integrity       Every deployment           P0
  Migration Test           Every migration            P0
  Tenant Isolation         Every release              P0
  Critical E2E             Every deployment           P0
  Backup Verification      Daily                      P0
  Restore Verification     Weekly                     P0
  Performance Regression   Weekly / release           P1
  Full Security Scan       Weekly                     P1
  Full Regression          Every release              P0
  Load Test                Periodic                   P1
  Disaster Recovery        Quarterly                  P1
  Penetration Test         Major release / periodic   P0
  Chaos Test               Periodic                   P2

Adjust frequency based on system maturity, infrastructure, and risk.

------------------------------------------------------------------------

## 12. TEST COVERAGE MATRIX

`FABRIX_TEST_COVERAGE_MATRIX.md`

Track:

``` text
MODULE
↓
FUNCTION
↓
BUSINESS RULE
↓
UNIT TEST
↓
INTEGRATION TEST
↓
API TEST
↓
DATABASE TEST
↓
SECURITY TEST
↓
E2E TEST
↓
PERFORMANCE TEST
```

The matrix must expose test blind spots.

------------------------------------------------------------------------

## 13. DATABASE TESTING --- P0

Database is the source of truth for manufacturing transactions.

Test:

### Schema Integrity

-   table
-   column
-   datatype
-   nullable
-   default
-   primary key
-   foreign key
-   unique constraints
-   indexes
-   enums
-   check constraints

### Referential Integrity

-   orphan records
-   invalid foreign keys
-   cascade behavior
-   delete behavior
-   update behavior

### Constraint Testing

Test rejection of:

``` text
NULL
duplicate
invalid FK
negative quantities
invalid status
invalid dates
invalid tenant
```

### Transaction Testing

For:

``` text
Create Production Order
↓
Reserve Material
↓
Create Stock Reservation
↓
Update Inventory
```

failure of a critical step must produce the correct rollback.

### Concurrency Testing

Example:

``` text
Stock = 100

User A reserves 70
User B reserves 50
```

The system must not accidentally produce:

``` text
Reserved = 120
```

Test:

-   race conditions
-   locking
-   optimistic locking
-   pessimistic locking
-   duplicate submissions
-   concurrent updates
-   retries

------------------------------------------------------------------------

## 14. MIGRATION TESTING --- P0

Every migration must be tested.

### Fresh Migration

``` text
Empty Database
↓
All Migrations
↓
Latest Schema
```

### Upgrade Migration

``` text
Production-like vN
↓
Migration
↓
vN+1
```

### Rollback

Where supported:

``` text
vN+1
↓
Rollback
↓
vN
```

Validate:

-   schema
-   indexes
-   constraints
-   seed data
-   data preservation

------------------------------------------------------------------------

## 15. MIGRATION DATA RECONCILIATION --- P0

Before and after migration compare:

-   row count
-   critical totals
-   relationships
-   checksums where appropriate

Example:

``` text
Inventory transactions before = 10,000,000
Inventory transactions after  = 10,000,000
```

Any unexpected discrepancy must be investigated.

Prefer:

``` text
EXPAND
↓
MIGRATE
↓
SWITCH
↓
CONTRACT
```

for backward-compatible changes.

------------------------------------------------------------------------

## 16. MASTER DATA TESTING

Test:

-   UOM
-   currency
-   country
-   tax
-   warehouse
-   work center
-   machine
-   statuses
-   reference data

Detect:

-   duplicates
-   invalid codes
-   missing required data
-   invalid relationships

------------------------------------------------------------------------

## 17. UNIT TESTING --- P0

Critical business calculations must have unit tests.

Examples:

``` text
calculateMRP()
calculateAvailableStock()
calculateLeadTime()
calculateProductionCost()
calculateCapacity()
calculateSafetyStock()
```

Test:

-   normal
-   zero
-   null
-   negative
-   boundary
-   maximum
-   unexpected input

------------------------------------------------------------------------

## 18. BUSINESS RULE TESTING --- P0

Business rules must be executable and testable.

Example:

``` text
IF stock < required
THEN material shortage
```

Example:

``` text
IF production_order.status != RELEASED
THEN cannot start production
```

Every important business rule should have automated coverage.

------------------------------------------------------------------------

## 19. INTEGRATION TESTING --- P0

Test module-to-module flows.

Example:

``` text
Sales Order
↓
Demand
↓
MPS
↓
MRP
↓
Purchase Requisition
```

Validate output and downstream interpretation.

------------------------------------------------------------------------

## 20. API TESTING --- P0

Test:

-   method
-   request
-   response
-   validation
-   authentication
-   authorization
-   status code
-   error response
-   pagination
-   filtering
-   sorting
-   rate limiting where applicable

For critical APIs test:

``` text
valid
invalid
missing field
duplicate
unauthorized
forbidden
wrong tenant
```

------------------------------------------------------------------------

## 21. CONTRACT TESTING --- P1

Validate:

-   request schema
-   response schema
-   required fields
-   data types
-   enum values
-   versioning

------------------------------------------------------------------------

## 22. AUTHENTICATION TESTING --- P0

Test:

-   login
-   logout
-   session
-   token
-   refresh
-   expiration
-   invalid credentials
-   account lock
-   session invalidation
-   MFA if implemented
-   expired token
-   tampered token

------------------------------------------------------------------------

## 23. AUTHORIZATION / RBAC --- P0

Test roles such as:

``` text
Operator
Planner
PPIC
Warehouse
Purchasing
Finance
Admin
Super Admin
```

For each critical permission:

``` text
View
Create
Edit
Delete
Approve
Release
Export
```

Test authorization at backend/API level.

Hiding a button is NOT security.

------------------------------------------------------------------------

## 24. MULTI-TENANT ISOLATION --- P0 ABSOLUTE

Tenant A must never access Tenant B data.

Test:

``` text
ID manipulation
tenant_id manipulation
URL manipulation
API manipulation
filter manipulation
search
export
report
cache
background jobs
file storage
```

Cross-tenant leakage is a release blocker.

------------------------------------------------------------------------

## 25. IDOR --- P0

If User A requests an object belonging to User/Tenant B:

Expected:

``` text
403
```

or an appropriate non-disclosing response such as:

``` text
404
```

Never return protected data.

------------------------------------------------------------------------

## 26. INPUT VALIDATION --- P0

Test:

``` text
empty
null
very long strings
special characters
Unicode
HTML
SQL-like payloads
negative numbers
huge numbers
invalid dates
unexpected JSON
```

Validation must exist at:

``` text
Frontend
Backend
Database
```

Backend is authoritative.

------------------------------------------------------------------------

## 27. SECURITY TESTING --- P0

Test relevant OWASP risks:

-   broken access control
-   injection
-   authentication failures
-   security misconfiguration
-   XSS
-   CSRF where applicable
-   SSRF where applicable
-   insecure file upload
-   sensitive data exposure
-   vulnerable dependencies

------------------------------------------------------------------------

## 28. SQL INJECTION --- P0

Test user-controlled input in:

-   search
-   filters
-   sorting
-   reports
-   exports
-   API parameters

Do not assume ORM usage automatically eliminates every injection risk.

------------------------------------------------------------------------

## 29. XSS --- P0

Test user-controlled fields:

-   product
-   customer
-   material
-   notes
-   comments
-   descriptions
-   rich text
-   imported data

Ensure safe escaping/sanitization.

------------------------------------------------------------------------

## 30. FILE UPLOAD SECURITY --- P0

Test:

-   MIME spoofing
-   extension spoofing
-   oversized files
-   malicious content
-   executable content
-   path traversal
-   zip bombs
-   malware scanning where appropriate

------------------------------------------------------------------------

## 31. SECRET / ENVIRONMENT SECURITY --- P0

Secrets must never leak into:

-   Git
-   logs
-   frontend bundles
-   Docker images
-   error responses
-   client-side configuration

Examples:

``` text
DATABASE_PASSWORD
API_KEY
JWT_SECRET
CLOUD_SECRET
PRIVATE_KEY
```

Use secret scanning in CI/CD.

------------------------------------------------------------------------

## 32. ENVIRONMENT VALIDATION --- P1

Validate:

``` text
Local
Development
Staging
Production
```

for:

-   environment variables
-   database
-   storage
-   queues
-   email
-   third-party APIs
-   feature flags

------------------------------------------------------------------------

## 33. CONFIGURATION TESTING --- P1

Every environment variable should be:

-   documented
-   typed
-   required/optional
-   validated
-   safely defaulted where appropriate

Critical missing configuration should fail fast.

------------------------------------------------------------------------

## 34. CODE QUALITY --- P1

Use:

-   static analysis
-   linter
-   formatter
-   type checking
-   dead code detection
-   duplicate code detection

------------------------------------------------------------------------

## 35. CODE COVERAGE --- P1

Recommended starting targets:

``` text
Critical business logic: ≥ 90%
Core services: ≥ 80%
General application code: ≥ 70%
```

Coverage is a metric, not proof of correctness.

------------------------------------------------------------------------

## 36. DEPENDENCY SECURITY --- P0/P1

Scan:

-   package dependencies
-   Python dependencies
-   OS packages
-   Docker images
-   CI/CD actions

Detect:

-   CVEs
-   malicious packages
-   abandoned dependencies
-   high-risk versions

Critical vulnerabilities block release.

------------------------------------------------------------------------

## 37. E2E TESTING --- P0

E2E must represent real user workflows.

Example:

``` text
Login
↓
Create Product
↓
Create BOM
↓
Create Routing
↓
Create Production Order
↓
Release
↓
Reserve Material
↓
Start Production
↓
Complete
↓
Inventory Updated
```

Use E2E primarily for critical workflows, not every tiny interaction.

------------------------------------------------------------------------

## 38. GOLDEN PATH TESTS --- P0

### Procure-to-Stock

``` text
Purchase Requisition
↓
Approval
↓
Purchase Order
↓
Receipt
↓
Inventory
```

### Order-to-Production

``` text
Sales Order
↓
Demand
↓
MPS
↓
MRP
↓
Production Order
↓
Production
↓
Finished Goods
```

### Production

``` text
Work Order
↓
Material Reservation
↓
Material Issue
↓
Operation
↓
Quality
↓
Completion
↓
Inventory
```

------------------------------------------------------------------------

## 39. REGRESSION TESTING --- P0

Every change must protect existing functionality.

If Inventory changes, regression must consider dependent modules such
as:

-   MRP
-   Production
-   Purchasing
-   Reporting

------------------------------------------------------------------------

## 40. UI REGRESSION --- P1

Test:

-   layout
-   navigation
-   tables
-   forms
-   dialogs
-   drawers
-   responsive behavior
-   empty states
-   loading states
-   error states

Visual regression must follow the FABRIX Carbon Design Governance.

------------------------------------------------------------------------

## 41. PERFORMANCE --- P1

Measure:

-   API latency
-   database latency
-   page load
-   rendering
-   search
-   filtering
-   reporting
-   export
-   large tables

Use realistic datasets:

``` text
10K
100K
1M+
```

where applicable.

------------------------------------------------------------------------

## 42. LOAD TEST --- P1

Simulate expected concurrency.

Example:

``` text
10 users
100 users
500 users
1,000 users
```

Actual targets must follow FABRIX capacity requirements.

Test:

-   login
-   API
-   transactions
-   dashboard
-   search
-   reports

------------------------------------------------------------------------

## 43. STRESS TEST --- P1

Determine system limits.

Measure:

-   CPU
-   RAM
-   DB connections
-   latency
-   queue
-   errors
-   timeouts

------------------------------------------------------------------------

## 44. SPIKE TEST --- P1/P2

Simulate sudden traffic increases.

Evaluate:

-   autoscaling
-   queues
-   database
-   application stability
-   recovery

------------------------------------------------------------------------

## 45. DATABASE PERFORMANCE --- P1

Identify:

-   slow queries
-   missing indexes
-   full scans
-   N+1 queries
-   excessive joins
-   lock contention

Critical workloads:

-   inventory
-   MRP
-   production
-   sales
-   purchasing

------------------------------------------------------------------------

## 46. N+1 QUERY --- P1

Do not allow:

``` text
1 query for orders
+
100 product queries
+
100 user queries
+
100 work-center queries
```

Inspect query counts and query plans.

------------------------------------------------------------------------

## 47. CACHE --- P1

Test:

-   stale data
-   invalidation
-   race conditions
-   tenant isolation
-   cache poisoning
-   consistency

Tenant-specific cache keys must be tenant-aware.

------------------------------------------------------------------------

## 48. QUEUE / BACKGROUND JOBS --- P1

Test:

``` text
success
failure
retry
duplicate execution
timeout
dead-letter
```

Applicable to:

-   MRP
-   reports
-   email
-   import
-   export
-   synchronization
-   scheduled jobs

------------------------------------------------------------------------

## 49. IDEMPOTENCY --- P0

Critical transactions must be safe against duplicate requests.

Example:

``` text
POST /purchase-order
```

A network retry must not create two purchase orders.

Especially test:

-   payment
-   stock
-   purchase order
-   sales order
-   production order
-   inventory movement

------------------------------------------------------------------------

## 50. RETRY --- P1

Simulate:

-   network timeout
-   database timeout
-   service timeout
-   queue timeout

Ensure retry does not create duplicates.

------------------------------------------------------------------------

## 51. IMPORT --- P1

Test:

-   CSV
-   Excel
-   large files
-   duplicates
-   missing columns
-   invalid types
-   invalid references
-   duplicate SKU
-   invalid UOM
-   invalid warehouse
-   partial failure

------------------------------------------------------------------------

## 52. EXPORT --- P1

Test:

-   authorization
-   tenant isolation
-   large datasets
-   CSV
-   Excel
-   PDF where supported
-   encoding
-   dates
-   numbers
-   currency

------------------------------------------------------------------------

## 53. AUDIT LOG --- P0

Critical changes must be traceable:

``` text
WHO
WHAT
WHEN
BEFORE
AFTER
SOURCE
```

Example:

``` text
User A
changed
Production Order
quantity
100 → 150
2026-08-24 14:35
```

Normal users must not be able to freely modify audit records.

------------------------------------------------------------------------

## 54. TIMEZONE / DATE --- P1

Test:

-   UTC
-   local timezone
-   date boundary
-   midnight
-   month end
-   year end
-   scheduling
-   date ranges

------------------------------------------------------------------------

## 55. NUMBER / CURRENCY PRECISION --- P0

Avoid unsafe floating-point calculations for:

-   money
-   cost
-   tax
-   exact quantities
-   business-critical percentages

Test decimal boundaries and rounding.

------------------------------------------------------------------------

## 56. BACKUP --- P0

A backup is not valid until restoration is verified.

``` text
Backup created
↓
Backup readable
↓
Backup complete
↓
Restore succeeds
↓
Data validated
```

------------------------------------------------------------------------

## 57. RESTORE --- P0

Regularly perform:

``` text
Production-like database
↓
Backup
↓
Destroy test environment
↓
Restore
↓
Reconcile
```

Track:

-   RPO
-   RTO
-   restore duration
-   data completeness

------------------------------------------------------------------------

## 58. DISASTER RECOVERY --- P1

Simulate:

-   database failure
-   application failure
-   storage failure
-   queue failure
-   network failure
-   infrastructure failure

Document:

-   procedure
-   owner
-   RTO
-   RPO
-   dependencies

------------------------------------------------------------------------

## 59. OBSERVABILITY --- P1

Monitor:

-   error rate
-   latency
-   throughput
-   CPU
-   RAM
-   database
-   queue
-   storage
-   authentication failures
-   suspicious activity

------------------------------------------------------------------------

## 60. LOGGING --- P1

Logs should contain where appropriate:

-   timestamp
-   severity
-   service
-   request/correlation ID
-   operation
-   safe tenant context

Never log:

-   passwords
-   secrets
-   tokens
-   sensitive personal data

------------------------------------------------------------------------

## 61. ALERTING --- P1

Alert on:

``` text
DB connection exhaustion
API error spike
Latency spike
Queue backlog
Disk exhaustion
Authentication anomaly
```

Alerting itself must be tested.

------------------------------------------------------------------------

## 62. DEPLOYMENT --- P1

Validate:

``` text
Build
↓
Migration
↓
Deployment
↓
Startup
↓
Health Check
↓
Smoke Test
```

------------------------------------------------------------------------

## 63. ROLLBACK --- P0

Test:

``` text
v10
↓
Deploy v11
↓
Simulated failure
↓
Rollback v10
```

Database compatibility must be included.

------------------------------------------------------------------------

## 64. HEALTH CHECKS --- P1

Distinguish:

``` text
Liveness
Readiness
```

Check dependencies where appropriate:

-   application
-   database
-   queue
-   cache
-   storage
-   required external services

------------------------------------------------------------------------

## 65. FEATURE FLAGS --- P1

Test:

``` text
enabled
disabled
tenant-specific
role-specific
rollback
```

Feature flags must never become authorization bypasses.

------------------------------------------------------------------------

## 66. ACCESSIBILITY --- P1

Test:

-   keyboard
-   focus
-   screen reader
-   contrast
-   labels
-   forms
-   dialogs
-   tables
-   semantic structure

------------------------------------------------------------------------

## 67. UX TESTING --- P2

Evaluate with representative users:

-   Planner
-   PPIC
-   Warehouse
-   Production
-   Purchasing
-   Management

Evaluate:

-   task completion
-   clarity
-   number of steps
-   error recovery
-   information discoverability

------------------------------------------------------------------------

## 68. CHAOS / RESILIENCE --- P2

For mature environments simulate:

-   database latency
-   network latency
-   service failure
-   queue failure
-   container failure

System should fail gracefully and recover predictably.

------------------------------------------------------------------------

## 69. PENETRATION TEST --- P0 BEFORE MAJOR ENTERPRISE PRODUCTION

Automated scanning is not equivalent to penetration testing.

Scope:

``` text
Web
API
Authentication
Authorization
Multi-tenancy
File Upload
Infrastructure
Cloud Configuration
```

Use qualified security testing.

------------------------------------------------------------------------

## 70. TEST DEBT

`FABRIX_TEST_DEBT.md`

Every missing critical test must be tracked.

Example:

``` text
TEST-DEBT-001

Module:
APS

Missing:
Concurrency Test

Priority:
P0

Risk:
Scheduler may modify production sequence concurrently.

Target:
Before Production Release

Status:
OPEN
```

------------------------------------------------------------------------

## 71. TEST WORK MANAGEMENT

Every test is a work item.

Fable 5 MUST maintain:

``` text
WHAT needs testing
WHY it matters
PRIORITY
DEPENDENCY
WHO/WHAT executes it
WHEN it should run
CURRENT STATUS
LAST RESULT
EVIDENCE
NEXT ACTION
```

------------------------------------------------------------------------

## 72. TEST SCHEDULING RULE

When Fable 5 identifies a test requirement, it MUST determine:

``` text
PER COMMIT
PER PR
PER MERGE
PER DEPLOYMENT
PER RELEASE
DAILY
WEEKLY
MONTHLY
QUARTERLY
EVENT-DRIVEN
```

Never simply say:

> This should be tested.

Specify:

> This test must run on every production deployment.

------------------------------------------------------------------------

## 73. FEATURE TEST PLAN

For every new feature, Fable 5 must create:

``` text
Feature
Risk
Required Tests
Existing Tests
Missing Tests
Dependencies
Environment
Dataset
Schedule
Acceptance Criteria
Evidence Requirements
Release Impact
```

------------------------------------------------------------------------

## 74. FABLE 5 --- CONSULTANT ROLE

Claude Chat Fable 5 is the QA/Quality Engineering Consultant and
Governance Controller.

For every feature, module, architecture change, database change,
migration, deployment, security-sensitive change, or major refactor,
Fable 5 MUST:

1.  understand the change
2.  identify risks
3.  inspect existing tests
4.  identify required tests
5.  identify missing tests
6.  assign priority
7.  identify dependencies
8.  determine environment
9.  determine dataset
10. schedule tests
11. define acceptance criteria
12. define evidence requirements
13. update Test Master
14. update Coverage Matrix
15. update Test Debt
16. produce instructions for Opus
17. distinguish already-done from not-done work
18. identify the next executable tasks

Fable 5 must not merely provide generic QA advice.

------------------------------------------------------------------------

## 75. FABLE 5 OUTPUT FORMAT

For every feature:

``` text
## TEST PLAN

Feature:
Module:

### Risk Assessment

P0:
...

P1:
...

P2:
...

### Existing Tests

...

### Required Tests

| ID | Test | Priority | Schedule | Status |
|---|---|---|---|---|

### Missing Tests

...

### Dependencies

...

### Environment

...

### Dataset

...

### Acceptance Criteria

...

### Evidence Required

...

### Release Impact

...

### Next Actions

...
```

------------------------------------------------------------------------

## 76. FABLE 5 MUST TRACK DONE VS NOT DONE

Every review must distinguish:

``` text
ALREADY IMPLEMENTED
ALREADY TESTED
TESTED AND PASSED
TESTED AND FAILED
NOT YET TESTED
TEST MISSING
BLOCKED
REQUIRES RETEST
CERTIFIED
```

Never combine these states.

------------------------------------------------------------------------

## 77. CLAUDE CODE OPUS --- INSTRUCTOR ROLE

Opus converts Fable 5's test plan into implementation instructions.

Opus must define:

-   test architecture
-   file location
-   framework
-   fixtures
-   dataset
-   mocks
-   setup
-   teardown
-   execution command
-   expected output
-   evidence location
-   acceptance criteria

Example:

``` text
Create DB-INV-004.

Purpose:
Verify inventory reservation transaction atomicity.

Setup:
Use isolated staging database.

Scenario:
Reserve material across three inventory records.

Failure injection:
Force the third reservation operation to fail.

Expected:
All reservation changes rollback.

Evidence:
test-results/DB-INV-004/

Release Gate:
P0. Any failure blocks release.
```

------------------------------------------------------------------------

## 78. CLAUDE CODE --- EXECUTOR ROLE

Execution order:

``` text
READ TEST MASTER
↓
READ CURRENT TEST TASK
↓
CHECK EXISTING TESTS
↓
IMPLEMENT / MODIFY TEST
↓
RUN TEST
↓
COLLECT RESULT
↓
STORE EVIDENCE
↓
UPDATE TEST MASTER
↓
UPDATE EXECUTION LOG
↓
REPORT RESULT
```

------------------------------------------------------------------------

## 79. CLAUDE CODE FORBIDDEN BEHAVIOR

Never:

-   claim a test passed without running it
-   delete failed test history
-   skip P0 tests silently
-   downgrade severity to make release pass
-   remove assertions to make tests pass
-   weaken validation merely to satisfy tests
-   disable security controls merely to make E2E pass
-   mock away actual failures without documentation
-   modify expected results to match broken behavior
-   ignore tenant isolation
-   ignore migration compatibility

------------------------------------------------------------------------

## 80. TEST FAILURE PROTOCOL

When a test fails:

``` text
TEST FAIL
   ↓
CLASSIFY
   ↓
CODE BUG?
DATA BUG?
TEST BUG?
ENVIRONMENT BUG?
FLAKY TEST?
   ↓
CREATE / UPDATE DEFECT
   ↓
FIX
   ↓
RETEST
   ↓
PASS
```

Do not automatically assume the test is wrong.

------------------------------------------------------------------------

## 81. FLAKY TEST PROTOCOL

Record:

``` text
FLAKY
```

Track:

-   frequency
-   environment
-   timestamps
-   logs
-   concurrency
-   network
-   dependencies

Do not simply disable flaky critical tests.

------------------------------------------------------------------------

## 82. RELEASE CERTIFICATION

Before production release create:

`FABRIX_RELEASE_CERTIFICATION.md`

Example:

``` text
FABRIX RELEASE CERTIFICATION

Release:
vX.X.X

Date:
YYYY-MM-DD

P0 Tests:
PASS: 147
FAIL: 0
BLOCKED: 0

P1 Tests:
PASS: 238
FAIL: 2
BLOCKED: 1

Database:
PASS

Migration:
PASS

Security:
PASS

Tenant Isolation:
PASS

Critical E2E:
PASS

Backup:
PASS

Restore:
PASS

Performance:
PASS

Known Risks:
...

Release Decision:
CERTIFIED / NOT CERTIFIED
```

------------------------------------------------------------------------

## 83. RELEASE GATE

Minimum:

``` text
P0 FAIL = NO RELEASE
```

Also:

``` text
Tenant Isolation FAIL = NO RELEASE
Database Integrity FAIL = NO RELEASE
Migration FAIL = NO RELEASE
Critical Security FAIL = NO RELEASE
Critical Business Logic FAIL = NO RELEASE
Backup/Recovery Critical Failure = NO RELEASE
Critical E2E FAIL = NO RELEASE
```

------------------------------------------------------------------------

## 84. POST-DEPLOYMENT VERIFICATION

Immediately after production deployment:

``` text
Health Check
↓
Authentication
↓
Critical API
↓
Critical E2E
↓
Database Integrity
↓
Error Rate
↓
Latency
```

Monitor closely after release.

------------------------------------------------------------------------

## 85. CURRENT FABRIX STABILIZATION STRATEGY

FABRIX is already partially developed.

Do not stop development and attempt to create every test at once.

Use progressive stabilization.

### Phase 1 --- Critical Safety

``` text
Database Integrity
Migration Testing
Tenant Isolation
Authentication
Authorization
Business Rules
Transactions
Concurrency
Idempotency
Critical APIs
Critical E2E
Backup
Restore
Secrets
Dependency Security
```

### Phase 2 --- Reliability

``` text
Integration
Regression
Queue
Cache
Performance
Load
Observability
CI/CD
Rollback
```

### Phase 3 --- Product Quality

``` text
UI Regression
Accessibility
UX Testing
Browser Testing
Visual Consistency
```

### Phase 4 --- Scale

``` text
Stress
Spike
Chaos
Disaster Recovery
Advanced Security
Professional Pentest
```

------------------------------------------------------------------------

## 86. TEST DATA GOVERNANCE

Test datasets must be:

-   reproducible
-   versioned
-   isolated
-   documented
-   representative

For important tests record:

``` text
Dataset version
Database version
Application version
Environment
Seed version
```

------------------------------------------------------------------------

## 87. TEST ENVIRONMENT GOVERNANCE

Every test result should identify:

``` text
Application version
Database version
Environment
Commit SHA
Test dataset
Test runner version
Relevant configuration
```

------------------------------------------------------------------------

## 88. TEST REPRODUCIBILITY

Critical tests should be reproducible by another executor.

Provide:

-   command
-   environment
-   dataset
-   input
-   expected result
-   actual result
-   logs
-   relevant IDs

------------------------------------------------------------------------

## 89. TEST PRIORITIZATION

When time is limited:

``` text
P0 business/data/security
↓
P0 critical workflow
↓
P1 integration
↓
P1 performance
↓
P1 accessibility
↓
P2 UX
↓
P3 cosmetic
```

Never prioritize cosmetic polish above data integrity or security.

------------------------------------------------------------------------

## 90. MASTER INSTRUCTION TO FABLE 5

Use this as the governing instruction:

``` text
You are Claude Chat Fable 5, acting as the Quality Engineering Consultant and Test Governance Controller for FABRIX.

FABRIX is a manufacturing-focused SaaS / manufacturing operating system.

Your responsibility is not merely to recommend tests.

You must create, maintain, organize, prioritize, schedule, review, and govern the complete FABRIX testing lifecycle.

For every feature, module, architectural change, database change, migration, deployment, security-sensitive change, or major refactor:

1. Identify risks.
2. Determine required tests.
3. Inspect existing tests.
4. Identify missing tests.
5. Assign priority.
6. Determine dependencies.
7. Determine the correct environment.
8. Determine required dataset.
9. Schedule the test.
10. Define acceptance criteria.
11. Define required evidence.
12. Add/update the Test Master.
13. Add/update the Test Coverage Matrix.
14. Add/update Test Debt where required.
15. Produce implementation instructions for Claude Code Opus.
16. Ensure Claude Code executes the test.
17. Ensure execution result is recorded.
18. Ensure evidence is stored.
19. Ensure failed tests are tracked.
20. Ensure fixes are retested.
21. Ensure P0 failures block release.
22. Ensure release certification reflects actual evidence.

Never claim a test was executed when it was not.

Always distinguish:

NOT RUN
PLANNED
SCHEDULED
IN PROGRESS
PASS
FAIL
BLOCKED
FIX REQUIRED
RETEST
CERTIFIED

Do not delete historical test results.

Do not silently skip tests.

Do not downgrade severity merely to permit release.

Do not weaken application behavior merely to satisfy a test.

When a test fails, determine whether the failure is caused by:
- application code
- business logic
- database
- migration
- test
- environment
- infrastructure
- dependency
- flaky behavior

Then track the corrective action.

For P0 issues, release is blocked.

The objective is not maximum test count.

The objective is maximum confidence in the correctness, security, reliability, recoverability, and maintainability of FABRIX.
```

------------------------------------------------------------------------

## 91. FINAL GOVERNANCE MODEL

``` text
                    FABRIX PRODUCT
                          │
              ┌───────────┴───────────┐
              │                       │
           UI / UX                ENGINEERING
           CARBON                    CODE
              │                       │
              └───────────┬───────────┘
                          ↓
                QUALITY ENGINEERING
                          │
        ┌─────────────────┼─────────────────┐
        ↓                 ↓                 ↓
   TEST MASTER       TEST CALENDAR     COVERAGE MATRIX
        │                 │                 │
        └─────────────────┼─────────────────┘
                          ↓
                   TEST EXECUTION
                          │
                          ↓
                       EVIDENCE
                          │
                    ┌─────┴─────┐
                    ↓           ↓
                  PASS        FAIL
                    │           │
                    │         FIX
                    │           │
                    │        RETEST
                    │           │
                    └─────┬─────┘
                          ↓
                    CERTIFICATION
                          │
                          ↓
                    RELEASE GATE
                          │
                          ↓
                     PRODUCTION
                          │
                          ↓
                  POST-RELEASE TEST
                          │
                          ↓
                 CONTINUOUS MONITORING
```

------------------------------------------------------------------------

## 92. FINAL PRINCIPLE

FABRIX must not be developed with:

> Build feature → test if it works → move on.

Required lifecycle:

> **Plan → Build → Test → Evidence → Fix → Retest → Certify → Release →
> Monitor → Repeat.**

Every test must answer:

``` text
WHAT?
WHY?
WHEN?
WHO?
HOW?
EXPECTED RESULT?
ACTUAL RESULT?
EVIDENCE?
STATUS?
NEXT ACTION?
```

This document is mandatory for all future FABRIX development and must be
treated as a project-level Quality Engineering governance document.
