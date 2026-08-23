> **CATATAN KEPALA — DIBACA LEBIH DULU (ditambahkan 24 Agu 2026 saat dokumen ini masuk repo)**
>
> Dokumen ini adalah **potret per 20 Agustus 2026**. Isinya TIDAK diperbarui mengikuti
> keadaan sistem, dan sebagian faktanya **sudah berubah** sejak ditulis:
>
> - Jumlah test bukan lagi 192, melainkan **275 test di 46 berkas** (per 24 Agu 2026).
> - "Routing non-linear" (S3) sudah **diturunkan urgensinya jadi Bisa Menunggu**, bukan lagi
>   dianggap penghalang.
> - Peran alamat & kontak pelanggan (address/contact roles) **SUDAH SELESAI** lewat PMB-07b —
>   di dokumen ini masih tertulis sebagai pekerjaan yang belum ada.
>
> **KEBENARAN STATUS TERKINI ADA DI DAFTAR TUGAS PEMBANGUNAN (`build_tasks`), BUKAN DI SINI.**
> Dokumen ini dipakai sebagai **peta cakrawala** — apa saja yang kelak mungkin dibutuhkan modul
> Sales — bukan sebagai daftar pekerjaan yang sedang berjalan. Sebelum mengerjakan apa pun yang
> disebut di sini, periksa dulu task terkait di Daftar Tugas.
>
> Keputusan strategis yang mengikat dokumen ini tercatat di modul **SLS** pada Daftar Tugas
> (lihat SLS-01 sampai SLS-05 dan SLS-90).

# FABRIX SALES DOMAIN
## Technical Architecture Specification — Draft v0.1
### Review Target: Claude Fable 5

> **Purpose:** This document is an architecture-review package for Claude Fable 5.  
> **Important:** Fable 5 must review and critique this architecture before any implementation specification is produced for Claude Opus 5 or Claude Code.

---

# 1. PURPOSE

FABRIX Sales Domain is a manufacturing-first commercial lifecycle system managing:

```text
Customer
→ Lead
→ Opportunity
→ Sample
→ Product Configuration
→ Costing
→ Pricing
→ Quotation
→ Contract
→ Sales Order
→ Demand
→ Fulfillment
→ Delivery
→ Return / Complaint
→ Analytics
```

Sales integrates with:

```text
R&D
Engineering
Finance
Planning
MRP
Production
Warehouse
Purchasing
QC
Logistics
```

Sales must not take ownership of other domains' execution truth.

---

# 2. ARCHITECTURAL PRINCIPLES

## 2.1 Domain Ownership

| Domain | Source of Truth |
|---|---|
| Sales | Commercial truth |
| R&D / Engineering | Technical truth |
| Planning | Demand & supply planning truth |
| Production | Manufacturing execution truth |
| Warehouse | Inventory truth |
| Finance | Financial truth |
| QC | Quality truth |
| Purchasing | Supplier/procurement truth |
| Logistics | Shipment truth |

## 2.2 Core Separation

### Commercial Truth

```text
Customer
Opportunity
Quotation
Contract
Sales Order
```

### Technical Truth

```text
Product
Configuration
BOM
Routing
Specification
```

### Planning Truth

```text
Demand
Supply
MPS
MRP
APS
```

### Execution Truth

```text
WO
PO
Inventory
Delivery
Shipment
```

### Financial Truth

```text
Cost
Receivable
Payment
Credit
Commission
```

---

# 3. SALES DOMAIN BOUNDARY

```text
                    SALES DOMAIN
                         │
       ┌─────────────────┼─────────────────┐
       │                 │                 │
   CUSTOMER          COMMERCIAL        FULFILLMENT
       │                 │                 │
       │          Lead/Opportunity        │
       │          Quotation               │
       │          Contract                │
       │          Sales Order             │
       │                                 │
       └────────────────┬────────────────┘
                        │
                     DEMAND
                        │
                ───── DOMAIN ─────
                        │
                Planning / MRP
```

Sales creates commercial commitment and demand. Sales does not directly execute production or procurement.

---

# 4. MODULE STRUCTURE

```text
sales/
│
├── customer/
├── lead/
├── opportunity/
├── sample/
├── configuration/
├── costing/
├── pricing/
├── quotation/
├── contract/
├── sales-order/
├── fulfillment/
├── delivery/
├── return/
├── complaint/
├── commission/
├── forecast/
└── analytics/
```

Cross-domain capabilities:

```text
workflow/
approval/
document/
notification/
audit/
rules/
```

---

# 5. CUSTOMER & ACCOUNT

## Entities

```text
Account
Contact
Address
CustomerProduct
CustomerCommercialProfile
CustomerPriceRule
CustomerCreditProfile
CustomerRelationship
```

Relationship:

```text
Account
 ├── Contacts
 ├── Addresses
 ├── Customer Products
 ├── Opportunities
 ├── Contracts
 └── Sales Orders
```

## Account Types

```text
PROSPECT
CUSTOMER
PARTNER
DISTRIBUTOR
RESELLER
AGENT
INTERNAL
```

Prospect conversion:

```text
PROSPECT
   ↓
QUALIFIED
   ↓
CUSTOMER
```

## Parent / Child Accounts

Example:

```text
ABC GROUP
│
├── PT ABC Indonesia
├── PT ABC Malaysia
├── PT ABC Singapore
└── ABC Trading Dubai
```

Must support group-level reporting, contracts, pricing and potentially credit policies.

## Contact Roles

```text
BUYER
DECISION_MAKER
TECHNICAL_CONTACT
FINANCE_CONTACT
QUALITY_CONTACT
RECEIVING_CONTACT
APPROVER
```

## Address Types

```text
BILLING
SHIPPING
FACTORY
OFFICE
WAREHOUSE
RETURN
```

## Customer Product

```text
CustomerProduct
```

Maps customer-specific product code to FABRIX product:

```text
Customer Product Code
FABRIX Product Code
Customer Description
Specification
Packaging
MOQ
UOM
Status
```

## Customer Commercial Profile

May include:

```text
Price Rules
Discount Rules
MOQ
Payment Terms
Currency
Credit Limit
Delivery Terms
Tax Rules
Contract
```

## Customer Status

```text
ACTIVE
INACTIVE
BLOCKED
SUSPENDED
PROSPECT
ARCHIVED
```

## Duplicate Detection

Potential duplicate matching can use:

```text
Legal Name
Tax ID
Phone
Email
Address
```

Possible actions:

```text
MERGE
LINK
CREATE_ANYWAY
```

Historical transactions must remain intact.

---

# 6. LEAD

Entity:

```text
Lead
```

Lifecycle:

```text
NEW
→ QUALIFIED
→ DISQUALIFIED
→ CONVERTED
```

Conversion may create/link:

```text
Account
Contact
Opportunity
```

Lead history must remain auditable.

---

# 7. OPPORTUNITY

Entity:

```text
Opportunity
```

Core fields:

```text
Account
Owner
Source
Estimated Value
Probability
Expected Close Date
Stage
Product Interest
Competitor
Lost Reason
```

Lifecycle:

```text
NEW
→ QUALIFICATION
→ TECHNICAL_EVALUATION
→ SAMPLE
→ QUOTATION
→ NEGOTIATION
→ WON / LOST
```

Opportunity can create:

```text
SampleRequest
ProductConfiguration
Costing
Quotation
```

---

# 8. SAMPLE REQUEST

Entities:

```text
SampleRequest
SampleDevelopment
SampleVersion
SampleCost
SampleApproval
CustomerFeedback
```

Flow:

```text
Opportunity
      ↓
Sample Request
      ↓
R&D
      ↓
Sample Development
      ↓
Finance
      ↓
Management
      ↓
Customer
      ↓
Feedback
```

Sample types:

```text
FREE
PAID
```

The sample process must support department-level tracking across:

```text
Sales
R&D
Finance
Management
```

It must support:

- sample request
- approval
- cost
- payment if applicable
- development
- sample versioning
- dispatch
- customer receipt
- feedback
- revision
- conversion to opportunity/quotation

---

# 9. PRODUCT CONFIGURATION

Entities:

```text
ProductConfiguration
ConfigurationParameter
ConfigurationRule
ConfigurationValidation
```

Example:

```text
Base Product:
Gummy

Parameters:
Weight
Flavor
Shape
Color
Sweetener
Active Ingredient
Packaging
```

Configuration rules may express dependencies:

```text
IF parameter A = X
THEN parameter B allowed values = [...]
```

States:

```text
DRAFT
VALIDATING
VALID
INVALID
APPROVED
EXPIRED
SUPERSEDED
```

Configuration must be versioned.

## Critical Boundary

```text
Customer Configuration
        ↓
Candidate BOM
        ↓
Candidate Routing
        ↓
Costing
```

Customer configuration must NOT automatically modify production BOM or production routing.

Production master data requires Engineering approval.

---

# 10. COSTING

Entities:

```text
Costing
CostScenario
CostComponent
CostAssumption
CostSource
```

Conceptual model:

```text
Material
+
Packaging
+
Labor
+
Machine
+
Setup
+
Overhead
+
External Process
+
Other
```

Supported cost sources may include:

```text
STANDARD_COST
SUPPLIER_QUOTE
ESTIMATED_COST
MANUAL_COST
HISTORICAL_COST
```

Cost scenarios can represent different volumes:

```text
10k
100k
500k
```

Each scenario can produce different unit economics.

Costing should support:

- yield
- scrap
- setup cost
- batch economics
- machine cost
- labor
- packaging
- external process
- overhead
- assumptions
- cost confidence
- cost validity / expiry
- supplier quotation basis

---

# 11. PRICING

Pricing engine consumes:

```text
Cost
Customer
Quantity
Price List
Contract
Discount
Margin Rule
Commercial Terms
```

Outputs:

```text
Base Price
Discount
Net Price
Margin
Margin %
```

Pricing must support:

```text
MARGIN
MARKUP
FIXED_PRICE
CONTRACT_PRICE
CUSTOMER_PRICE
```

Price waterfall should be traceable.

Example:

```text
Standard Price
- Volume Discount
- Customer Discount
- Special Commercial Discount
= Final Price
```

Minimum margin and approval thresholds must be rule-driven.

---

# 12. QUOTATION

Entities:

```text
Quotation
QuotationLine
QuotationRevision
QuotationApproval
QuotationTerm
```

Lifecycle:

```text
DRAFT
→ REVIEW
→ APPROVAL
→ SENT
→ NEGOTIATION
→ ACCEPTED
→ REJECTED
→ EXPIRED
```

Quotation must snapshot:

```text
Product
Configuration
Quantity
Costing Reference
Price
Discount
Terms
Validity
Delivery
Payment
```

Quotation revisions must preserve history.

Negotiation must create controlled revisions, not silently overwrite the prior quotation.

---

# 13. CONTRACT / BLANKET ORDER

Entities:

```text
Contract
ContractLine
BlanketOrder
OrderRelease
ContractPrice
ContractCommitment
```

Relationship:

```text
Contract
 ↓
Blanket Order
 ↓
Release
 ↓
Sales Order
```

Contract commitment must track:

```text
Committed
Released
Ordered
Delivered
Remaining
```

Contract may control:

```text
Price
Discount
MOQ
Payment Terms
Lead Time
Packaging
Quality Requirements
```

Contract pricing must support effective dates and potential escalation rules.

---

# 14. SALES ORDER

Entities:

```text
SalesOrder
SalesOrderLine
SalesOrderRevision
SalesOrderChangeRequest
PromiseSchedule
OrderApproval
```

Sales Order represents the commercial commitment.

It must snapshot:

```text
Customer
Product
Configuration
Quantity
Price
Discount
Tax
Payment Terms
Delivery Terms
Promised Date
```

A confirmed Sales Order must not dynamically depend on mutable quotation data.

---

# 15. SALES ORDER STATE MACHINE

```text
DRAFT
 ↓
SUBMITTED
 ↓
VALIDATING
 ↓
PENDING_APPROVAL
 ↓
CONFIRMED
 ↓
IN_FULFILLMENT
 ↓
PARTIALLY_FULFILLED
 ↓
FULFILLED
 ↓
CLOSED
```

Terminal states:

```text
CANCELLED
REJECTED
```

Header state must not replace line-level fulfillment state.

---

# 16. ORDER CHANGE MANAGEMENT

Confirmed Sales Orders must not be directly edited.

Flow:

```text
SalesOrder
 ↓
ChangeRequest
 ↓
Impact Analysis
 ↓
Approval
 ↓
Revision
```

Impact analysis should evaluate:

```text
Demand
ATP
CTP
Material
Capacity
Production
Inventory
Delivery
Financial
```

Example:

```text
Current:
100k / 30 Sep

Requested:
120k / 25 Sep

System:
Material shortage
Capacity shortage
Earliest feasible = 5 Oct
```

The user must be able to:

```text
Accept Change
Accept with Revised Promise
Reject Change
Counter Proposal
```

---

# 17. ATP

ATP should consider:

```text
On Hand
+
Scheduled Receipts
-
Existing Allocation
-
Reservations
```

Output:

```text
Available Quantity
Shortage
Earliest Availability
```

ATP must support multiple warehouses.

Inventory under quality hold must not be treated as available.

---

# 18. CTP

If ATP is insufficient:

```text
SO
 ↓
ATP
 ↓
Shortage
 ↓
CTP
 ↓
Planning
```

CTP evaluates:

```text
BOM
Material
Routing
Capacity
Lead Time
Existing Orders
Calendar
```

Output:

```text
Earliest Feasible Date
Capacity Risk
Material Risk
```

Sales receives feasibility information; Planning remains responsible for supply decisions.

---

# 19. DEMAND INTERFACE

Confirmed SO creates demand:

```text
SalesOrderLine
      ↓
Demand
```

Demand should store:

```text
Source Type
Source ID
Source Line
Product
Configuration
Quantity
Due Date
Priority
Warehouse
Customer
```

Demand must support versioning and pegging.

Sales Order should remain the source of commercial commitment while Planning owns planning decisions.

---

# 20. FULFILLMENT

Fulfillment may use:

```text
ON_HAND
PRODUCTION
PURCHASE
TRANSFER
SUBCONTRACT
```

Conceptual flow:

```text
Demand
 ↓
Reservation
 ↓
Allocation
 ↓
Pick
 ↓
Pack
 ↓
Delivery
```

---

# 21. RESERVATION VS ALLOCATION

Reservation:

> Supply is reserved for a demand.

Allocation:

> A specific supply source is linked to the demand.

Example:

```text
SO = 100k

Batch A = 40k
Batch B = 30k
WO-123 = 30k
```

Allocation must be traceable.

Supply may originate from:

```text
Inventory Lot
Production Output
Purchase Receipt
Transfer
```

---

# 22. DELIVERY

Entities:

```text
DeliveryOrder
DeliveryLine
Shipment
ShipmentLine
POD
BatchAllocation
```

Must support:

```text
Partial Delivery
Split Shipment
Consolidated Shipment
Multiple Warehouse
Batch Allocation
FEFO/FIFO
Customer-specific requirements
```

One shipment may contain multiple Sales Orders.

One Sales Order may be fulfilled by multiple shipments.

---

# 23. PICK / PACK

Conceptual fulfillment state:

```text
ALLOCATED
    ↓
PICKING
    ↓
PICKED
    ↓
PACKING
    ↓
PACKED
    ↓
READY_TO_SHIP
```

---

# 24. SHIPMENT

Shipment may contain:

```text
Carrier
Vehicle
Driver
Tracking
Shipping Cost
Departure
ETA
```

Shipment must be traceable to Delivery Order and Sales Order.

---

# 25. PROOF OF DELIVERY

POD may contain:

```text
Received By
Received Date
Signature
Photo
Document
Condition
Notes
```

Possible outcomes:

```text
DELIVERED
PARTIALLY_RECEIVED
REJECTED
DAMAGED
```

---

# 26. RETURN / RMA

Flow:

```text
Customer
 ↓
Return Request
 ↓
RMA
 ↓
Return Shipment
 ↓
Warehouse Receipt
 ↓
Inspection
 ↓
Disposition
```

Disposition:

```text
RELEASE
REWORK
REPLACE
SCRAP
RETURN_TO_SUPPLIER
CREDIT
```

Historical delivery must not be altered to represent a return.

---

# 27. CUSTOMER COMPLAINT

Entities:

```text
Complaint
ComplaintInvestigation
ComplaintResolution
CAPAReference
```

Complaint classifications:

```text
QUALITY
QUANTITY
PACKAGING
DELIVERY
DOCUMENTATION
PRODUCT
SERVICE
COMMERCIAL
OTHER
```

Severity:

```text
LOW
MEDIUM
HIGH
CRITICAL
```

Complaint traceability should support:

```text
Customer
 ↓
SO
 ↓
Delivery
 ↓
Batch
 ↓
WO
 ↓
QC
 ↓
Material Lot
 ↓
Supplier
```

For quality incidents, complaint may trigger investigation and CAPA workflows in the Quality domain.

---

# 28. SALES COMMISSION

Entities:

```text
CommissionPlan
CommissionRule
CommissionTransaction
CommissionSettlement
CommissionAdjustment
```

Possible basis:

```text
REVENUE
GROSS_MARGIN
COLLECTED_REVENUE
QUANTITY
NEW_CUSTOMER
```

Must support:

```text
Tier
Split
Bonus
Clawback
Settlement
```

Commission may be earned at:

```text
SO confirmation
Delivery
Invoice
Payment
```

according to company policy.

---

# 29. SALES FORECAST

Entities:

```text
Forecast
ForecastVersion
ForecastLine
ForecastSource
ForecastOverride
ForecastConsumption
ForecastScenario
```

Sources:

```text
HISTORICAL
CUSTOMER
SALES
CONTRACT
OPPORTUNITY
STATISTICAL
AI
MANUAL
```

Scenarios:

```text
BASE
UPSIDE
DOWNSIDE
COMMIT
```

Forecast must support:

- versioning
- sales override
- management override
- forecast consumption
- forecast vs actual
- scenario planning
- rolling horizon

---

# 30. FORECAST CONSUMPTION

Example:

```text
Forecast = 100k

Confirmed SO = 80k

Remaining Forecast = 20k
```

Forecast history must remain intact.

Do not simply delete forecast quantities.

---

# 31. SALES ANALYTICS

Analytics must cover:

## Funnel

```text
Lead
→ Opportunity
→ Sample
→ Quotation
→ SO
```

## Pipeline

```text
Pipeline
Weighted Pipeline
Best Case
Commit
Won
```

## Commercial

```text
Revenue
Margin
Discount
Average Deal
Win Rate
Sales Cycle
```

## Customer

```text
Revenue
Margin
Retention
Order Frequency
Complaint
Return
Payment
```

## Product

```text
Revenue
Volume
Margin
Return
Complaint
```

## Forecast

```text
Forecast
Actual
Variance
Accuracy
```

---

# 32. CUSTOMER PROFITABILITY

Customer profitability should not rely only on revenue.

Conceptual contribution:

```text
Revenue
- COGS
- Discount
- Freight
- Sample Cost
- Returns
- Commission
- Special Handling
= Contribution
```

This allows management to distinguish high-revenue customers from high-profit customers.

---

# 33. EVENT ARCHITECTURE

Sales should publish domain events such as:

```text
AccountCreated
LeadCreated
OpportunityCreated
SampleRequested
SampleCompleted
QuotationCreated
QuotationApproved
QuotationAccepted
ContractCreated
SalesOrderCreated
SalesOrderConfirmed
SalesOrderChanged
SalesOrderCancelled
DemandCreated
AllocationCreated
DeliveryCreated
DeliveryCompleted
ReturnCreated
ComplaintCreated
PaymentReceived
```

Other domains should consume events through defined integration contracts.

The exact event transport mechanism must be reviewed rather than assumed.

---

# 34. AUDITABILITY

Critical records must preserve:

```text
Created By
Created At
Updated By
Updated At
Revision
Previous State
New State
Reason
Approval
```

No silent overwriting of historical commercial commitments.

---

# 35. PERMISSION MODEL

Initial roles:

```text
Sales Rep
Sales Manager
Finance
R&D
Engineering
Planning
Warehouse
Production
QC
Management
Administrator
```

Examples:

```text
Sales Rep
→ create quotation

Sales Manager
→ approve discount

Finance
→ approve credit

Engineering
→ approve BOM

Planning
→ approve production feasibility

Management
→ approve strategic exception
```

Exact permission granularity must be reviewed.

---

# 36. API BOUNDARY — INITIAL DRAFT

Potential capability-oriented APIs:

```text
POST /sales/opportunities
POST /sales/sample-requests
POST /sales/configurations/validate
POST /sales/costings/calculate
POST /sales/quotations
POST /sales/quotations/{id}/accept
POST /sales/contracts
POST /sales/orders
POST /sales/orders/{id}/validate
POST /sales/orders/{id}/confirm
POST /sales/orders/{id}/change-requests
POST /sales/orders/{id}/promise
POST /sales/orders/{id}/cancel
GET  /sales/orders/{id}/fulfillment
GET  /sales/orders/{id}/traceability
```

These are only architectural placeholders. Fable must review naming, boundaries, command/query separation, idempotency and integration patterns before implementation.

---

# 37. DATABASE PRINCIPLE

Conceptual model:

```text
Master Data
      ↓
Transactional Data
      ↓
Immutable Revision
      ↓
Domain Events
      ↓
Analytics Projection
```

Core Sales transactions should use a relational transactional model unless Fable identifies a stronger justified alternative.

Analytics should not depend on expensive transactional queries for all dashboards.

Read models/projections may be introduced where appropriate.

---

# 38. CRITICAL DATA INTEGRITY RULES

1. Confirmed SO must not alter quotation history.
2. SO must not directly alter production BOM.
3. Sales must not directly create WO.
4. Sales must not directly create PO.
5. Reservation must not reduce physical inventory.
6. Delivered quantity must not be rewritten to accommodate returns.
7. Return must be a separate transaction.
8. Complaint must not rewrite historical delivery data.
9. Forecast consumption must preserve forecast history.
10. Commercial overrides require actor, timestamp and reason.
11. Customer configuration must not automatically mutate manufacturing master data.
12. Confirmed commercial values must be versioned or immutable.
13. Critical cross-domain references must remain traceable.

---

# 39. REFERENCE END-TO-END TRANSACTION

Use this as an architecture validation scenario:

Customer requests:

```text
Gummy
5g
Strawberry
Zero Sugar
Vitamin C
100,000 pcs
```

Expected conceptual flow:

```text
Lead
 ↓
Opportunity
 ↓
Sample Request
 ↓
R&D
 ↓
Sample Approval
 ↓
Customer Feedback
 ↓
Product Configuration
 ↓
BOM Candidate
 ↓
Routing Candidate
 ↓
Costing
 ↓
Pricing
 ↓
Quotation
 ↓
Negotiation
 ↓
Quotation Accepted
 ↓
Sales Order
 ↓
Credit Check
 ↓
ATP
 ↓
CTP
 ↓
Demand
 ↓
MRP
 ↓
WO
 ↓
Production
 ↓
QC
 ↓
FG Inventory
 ↓
Allocation
 ↓
Delivery
 ↓
POD
 ↓
Invoice
 ↓
Payment
```

If there is a complaint:

```text
Complaint
 ↓
Batch Trace
 ↓
WO
 ↓
QC
 ↓
Material Lot
 ↓
Investigation
 ↓
CAPA
```

Fable must use this scenario to identify broken boundaries, missing entities, race conditions, missing states and integration gaps.

---

# 40. FABLE 5 REVIEW MANDATE

## Role

Act as a **Principal Enterprise Architect / Manufacturing Systems Architect** reviewing the FABRIX Sales Domain Technical Architecture.

Do not implement code.

Do not produce a generic ERP architecture.

Do not simplify the architecture merely to reduce complexity.

The objective is to identify weaknesses before the architecture is handed to Claude Opus 5 and eventually Claude Code.

---

## Review Areas

Evaluate:

1. Domain boundaries
2. Entity ownership
3. Aggregate boundaries
4. State machines
5. Transaction consistency
6. Event architecture
7. Database design
8. API boundaries
9. Revision/versioning
10. Auditability
11. Multi-warehouse fulfillment
12. ATP/CTP integration
13. Demand/Planning integration
14. Product configuration
15. Costing and pricing
16. Contract/blanket order
17. Return/complaint traceability
18. Forecast architecture
19. Commission architecture
20. Analytics architecture
21. RBAC and approval
22. Scalability
23. Multi-company readiness
24. Multi-currency readiness
25. Multi-UOM readiness
26. Manufacturing-specific requirements
27. Edge cases
28. Failure scenarios
29. Data integrity
30. Integration resilience
31. Idempotency
32. Concurrency
33. Event ordering
34. Partial failure recovery
35. Data migration implications
36. Observability
37. Security
38. Performance
39. Extensibility
40. Testing strategy

---

# 41. ISSUE CLASSIFICATION

For every issue found, classify:

```text
CRITICAL
HIGH
MEDIUM
LOW
```

For each issue provide:

```text
Problem
Why it matters
Recommended architecture
Impacted entities
Impacted workflows
Migration / implementation implications
```

Do not merely list generic best practices.

Every recommendation must be tied to FABRIX's manufacturing-first architecture.

---

# 42. SPECIAL REVIEW — DOMAIN BOUNDARIES

Pay particular attention to whether these boundaries are correctly maintained:

```text
Commercial Truth
Technical Truth
Planning Truth
Execution Truth
Financial Truth
Inventory Truth
Quality Truth
```

Identify any coupling that could create:

- inconsistent data
- accidental master-data mutation
- planning corruption
- inventory corruption
- financial inconsistencies
- audit problems
- race conditions
- duplicate transactions

---

# 43. SPECIAL REVIEW — MANUFACTURING

Review whether the Sales architecture can correctly handle:

```text
Make-to-Stock
Make-to-Order
Configure-to-Order
Engineer-to-Order
Private Label
OEM
Contract Manufacturing
Repeat Order
Forecast-driven production
Contract / blanket demand
Partial fulfillment
Backorder
Multi-level BOM
Subassembly
Alternate BOM
Alternate Routing
Scrap
Yield
Co-product
By-product
Batch/lot traceability
Expiry
Quality hold
```

Only recommend features that make sense for FABRIX.

---

# 44. SPECIAL REVIEW — COMMERCIAL EDGE CASES

Analyze:

```text
Customer changes quantity after production starts
Customer changes specification after BOM release
Customer changes delivery date
Customer cancels partially produced order
Customer changes packaging
Customer requests lower price after quotation acceptance
Customer PO differs from quotation
Customer has multiple legal entities
Customer orders through parent company
Multiple warehouses fulfill one SO
Multiple SOs share one production batch
One SO is fulfilled by multiple WOs
One WO fulfills multiple SOs
Customer returns only part of a shipment
Customer rejects a batch
Customer receives replacement
Customer receives credit
Contract quantity is not fully released
Contract price changes during its term
Forecast is consumed by actual orders
```

---

# 45. SPECIAL REVIEW — FAILURE & CONCURRENCY

Review scenarios such as:

```text
Two salespeople simultaneously create the same customer
Two users confirm orders against the same ATP
Two orders attempt to reserve the same inventory
SO is changed while MRP is running
SO is cancelled while production is active
Customer accepts quotation while quotation is being revised
Delivery is created while inventory is under QC hold
Payment arrives while credit hold is being evaluated
Event is delivered twice
Event arrives out of order
External integration is temporarily unavailable
```

Recommend transaction boundaries, idempotency keys, locking/versioning strategies and retry behavior.

---

# 46. REQUIRED FABLE OUTPUT

Produce the following sections:

```text
A. Executive Architecture Assessment

B. Architecture Scorecard

C. Critical Issues

D. High Priority Issues

E. Medium / Low Issues

F. Recommended Architecture Changes

G. Revised Domain Model

H. Revised Entity Relationships

I. Revised Aggregate Boundaries

J. Revised State Machines

K. Revised Event Model

L. Revised API Boundaries

M. Revised Data Ownership Model

N. Data Integrity Rules

O. Concurrency & Idempotency Model

P. Failure Recovery Model

Q. Permission / Approval Model

R. Manufacturing Integration Review

S. Planning / MRP / APS Integration Review

T. Finance Integration Review

U. Warehouse / Fulfillment Integration Review

V. Quality / Complaint Integration Review

W. Analytics Architecture Review

X. Security Review

Y. Scalability Review

Z. Implementation Risks

AA. Architecture Decisions That Must Be Locked

AB. Architecture Decisions That Should Remain Configurable

AC. Questions That Must Be Resolved Before Coding

AD. Recommended Implementation Sequence

AE. Revised FABRIX Sales Technical Architecture v0.2
```

---

# 47. IMPORTANT OUTPUT CONSTRAINTS FOR FABLE

Fable must:

- preserve the manufacturing-first nature of FABRIX
- not convert FABRIX into a generic CRM
- not convert FABRIX into a generic ERP
- not write implementation code
- not prematurely choose frameworks unless necessary
- distinguish architectural requirements from implementation preferences
- identify assumptions explicitly
- identify unresolved decisions explicitly
- avoid silently replacing the business blueprint
- preserve existing terminology unless a change is justified
- explain every major architectural change

---

# 48. NEXT STAGE AFTER FABLE

Fable output will be reviewed and then passed to Claude Opus 5.

The intended pipeline is:

```text
FABRIX Business Blueprint
        +
This Technical Architecture
        ↓
CLAUDE FABLE 5
Architecture Review
        ↓
Revised Architecture v0.2
        ↓
CLAUDE OPUS 5
Implementation Specification
        ↓
Implementation Packets
        ↓
CLAUDE CODE
```

Claude Code should NOT receive this document as an implementation instruction without the Fable and Opus review stages.

---

# 49. OPUS 5 EXPECTED FUTURE OUTPUT

After Fable review, Claude Opus 5 should convert the approved architecture into:

```text
01. Final Architecture
02. Module Boundaries
03. Entity Model
04. Database Schema
05. Aggregate Boundaries
06. State Machines
07. Workflow Definitions
08. Permission Matrix
09. API Contracts
10. Domain Events
11. Integration Contracts
12. Validation Rules
13. Business Rules
14. Error Handling
15. Audit Requirements
16. Idempotency Rules
17. Concurrency Rules
18. Background Jobs
19. Notifications
20. Reporting
21. Test Strategy
22. Seed Data
23. Migration Strategy
24. Implementation Phases
25. Claude Code Task Breakdown
```

Each Claude Code implementation packet should eventually contain:

```text
Objective
Context
Dependencies
Modules / Files
Entities
Schema
Business Rules
State Transitions
API
Events
Permissions
Validation
Error Cases
UI Requirements
Tests
Acceptance Criteria
Non-Goals
```

---

# 50. FABRIX DEVELOPMENT METHODOLOGY

The architecture process for FABRIX should follow:

```text
                    FABRIX BUSINESS DESIGN
                             │
                             ▼
                  TECHNICAL ARCHITECTURE
                             │
                             ▼
                      ┌─────────────┐
                      │ FABLE 5     │
                      │ REVIEW      │
                      └──────┬──────┘
                             │
                    Architecture Review
                             │
                             ▼
                  REVISED ARCHITECTURE
                             │
                             ▼
                      ┌─────────────┐
                      │ OPUS 5      │
                      │ SPECIFIER   │
                      └──────┬──────┘
                             │
                   Implementation Specification
                             │
                             ▼
                    TASK / MODULE PACK
                             │
                             ▼
                      ┌─────────────┐
                      │ CLAUDE CODE │
                      │ BUILDER     │
                      └──────┬──────┘
                             │
                             ▼
                     IMPLEMENTED CODE
                             │
                             ▼
                       TEST / REVIEW
                             │
                             └──────► ITERATION
```

The goal is to prevent Claude Code from making architectural decisions ad hoc while coding.

---

# 51. FINAL ARCHITECTURAL PRINCIPLE

FABRIX Sales owns:

> **Commercial commitment.**

Planning owns:

> **How the demand can be supplied.**

Engineering owns:

> **What can technically be manufactured.**

Production owns:

> **What was actually manufactured.**

Warehouse owns:

> **What physically exists and where it is.**

Quality owns:

> **Whether it is acceptable.**

Finance owns:

> **What the commercial and financial consequences are.**

The systems must be deeply integrated, but ownership must remain explicit.

The desired digital thread is:

```text
CUSTOMER
   ↓
LEAD
   ↓
OPPORTUNITY
   ↓
SAMPLE / R&D
   ↓
CONFIGURATION
   ↓
COSTING
   ↓
PRICING
   ↓
QUOTATION
   ↓
CONTRACT
   ↓
SALES ORDER
   ↓
ATP / CTP
   ↓
DEMAND
   ↓
MPS / MRP / APS
   ↓
MAKE / BUY / TRANSFER
   ↓
PRODUCTION / PROCUREMENT
   ↓
INVENTORY
   ↓
FULFILLMENT
   ↓
DELIVERY
   ↓
POD
   ↓
INVOICE
   ↓
PAYMENT
   ↓
COMPLAINT / RETURN
   ↓
CUSTOMER INTELLIGENCE
   ↓
REPEAT ORDER
```

**End of FABRIX Sales Technical Architecture Draft v0.1**
