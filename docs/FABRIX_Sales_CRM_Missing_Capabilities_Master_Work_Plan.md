# FABRIX — SALES & CRM
# MASTER WORK PLAN — MISSING CAPABILITIES

**Document Type:** Domain Architecture / Specification / Implementation Plan  
**Domain:** Sales & CRM  
**Status:** Ready for Agent 01 execution planning

## 1. Purpose

Sales & CRM is not complete merely because Customers, Customer PO, and Sales Orders exist.

The following approved/planned capabilities must be reconciled and implemented:

1. Quotations
2. Pricing
3. Items / Product Reference
4. Returns / RMA
5. Complaints
6. Leads & Opportunities
7. Sample Requests
8. Sales Analytics
9. Contracts
10. Sales Forecast
11. Demand Signal
12. Fulfillment Coordination
13. Delivery Coordination
14. Commission

Work incrementally and in parallel where dependencies allow.

**Never rebuild Sales & CRM from zero.**

Use:

**AS-IS → Evidence → Reconciliation → TO-BE → Cross-Domain Contract → Work Order → Implementation → Test → Evidence → Review**

---

## 2. Non-Negotiable Architecture Principles

### 2.1 Sales & CRM ownership

Sales & CRM owns:

- customer commercial relationship;
- leads;
- opportunities;
- quotations;
- commercial pricing;
- customer PO;
- sales order;
- customer-specific product reference;
- sample request/customer-facing sample coordination;
- complaint/customer-facing record;
- RMA initiation/customer-facing return record;
- commercial contracts/agreements;
- sales forecast;
- commercial demand signal;
- fulfillment coordination;
- delivery coordination visibility;
- commission business record where Sales-owned.

Sales & CRM is **not** the source of truth for:

- Formula;
- BOM;
- Routing;
- production execution;
- physical inventory;
- batch/genealogy;
- quality disposition;
- shipment execution;
- payment/accounting;
- manufacturing cost;
- machine/resource availability.

### 2.2 Cross-domain rule

Do not create duplicate source-of-truth data in Sales & CRM.

Use references, historical snapshots, derived status, events, APIs/services, and canonical contracts.

### 2.3 Existing implementation

Existing capabilities must be:

**AUDIT → VERIFY → CORRECT**

not automatically:

**DELETE → REBUILD**

Replace existing implementation only when evidence shows incorrect behavior, ownership violation, security/data-integrity issue, duplicate source of truth, architectural conflict, or lifecycle conflict.

---

## 3. Common Capability Specification

Every capability must be analyzed through:

1. Business purpose
2. AS-IS
3. Existing implementation
4. Entity
5. Ownership/source of truth
6. Lifecycle/state
7. Business rules
8. Permissions
9. Decision/audit requirements
10. Cross-domain dependencies
11. UX
12. Data integrity/versioning
13. Integration contract
14. Tests/acceptance criteria
15. Work order

---

# 4. WORKSTREAMS

## WS-S10 — QUOTATION
**Priority: P0/P1**

### Goal

Replace Excel-only quotation management with a structured transactional capability.

### Minimum data

- quotation number;
- customer/contact;
- quotation date;
- validity;
- currency;
- product;
- customer product code where relevant;
- quantity;
- MOQ;
- unit price;
- discount where applicable;
- payment terms;
- lead time;
- delivery terms where applicable;
- notes;
- attachments;
- prepared by;
- approval;
- sent date;
- customer response.

### Lifecycle

Reconcile with the State Machine Registry before implementation.

Conceptually support:

**Draft → Review/Approval → Issued/Sent → Accepted / Rejected / Expired / Revised / Cancelled**

Do not hardcode states without reconciliation.

### Rules

- quotation is versioned;
- revisions do not destroy previous versions;
- validity can cause expiry;
- accepted quotation may become source for the next commercial transaction;
- historical price remains stable;
- quotation does not automatically become SO without an explicit business transition.

### R&D/Product integration

Quotation may consume Product, Product Configuration, Formula-derived information, and Costing/price inputs.

Sales must not own Formula/BOM/Routing.

---

## WS-S11 — PRICING
**Priority: P0/P1**

Pricing must not be reduced to a `price` field on SO.

Support where required:

- base price;
- customer-specific price;
- negotiated price;
- MOQ;
- currency;
- effective date;
- expiry;
- quantity tiers;
- approval;
- quotation-specific override;
- historical price snapshot.

**Price master/reference ≠ transaction price.**

Quotation/SO must preserve the price actually agreed for that transaction.

Manufacturing/material/formula costs remain owned by the appropriate domains.

---

## WS-S12 — ITEMS / PRODUCT REFERENCE
**Priority: P0**

Sales needs canonical Product Identity.

Support:

- FABRIX Product ID;
- product name;
- customer product code/reference;
- customer-specific naming;
- commercial description;
- sales unit;
- relevant packaging/reference.

Do not create:

**Sales Product ≠ Manufacturing Product ≠ Engineering Product**

If Engineering/Product owns the canonical Product entity, Sales references it.

Customer Product Code is a customer-specific reference, not a new product identity.

---

## WS-S13 — LEADS & OPPORTUNITIES
**Priority: P1**

### Lead

Minimum:

- source;
- company/person;
- contact;
- inquiry;
- owner;
- status;
- qualification;
- next activity;
- notes;
- history.

Conceptual lifecycle:

**New → Contacted → Qualified → Converted / Disqualified**

### Opportunity

Minimum:

- customer/prospect;
- value;
- probability;
- expected close date;
- products;
- estimated quantity;
- expected volume;
- owner;
- stage;
- activities;
- quotation relationship;
- lost reason;
- won/lost history.

Conceptual lifecycle:

**New → Qualified → Proposal/Quotation → Negotiation → Won / Lost**

Reconcile all states with the canonical State Machine Registry.

---

## WS-S14 — SAMPLE REQUESTS
**Priority: P1**

### Flow

Customer → Sales → Sample Request → R&D → Sample Development → Formula/R&D work → Sample Ready → Payment if applicable → Shipment → Tracking → Customer

### Data

- request number;
- customer;
- opportunity/quotation/SO relation where relevant;
- product reference;
- customer specification;
- quantity;
- sample type;
- free/paid;
- amount;
- payment requirement;
- approval for free sample where required;
- R&D request;
- status;
- shipment;
- tracking;
- attachments;
- history.

### Ownership

Sales: customer/commercial coordination.  
R&D: sample development/formula.  
Finance: payment verification.  
Delivery: shipment execution.

Sample may be **FREE or PAID**. Do not create a fake payment source of truth in Sales.

---

## WS-S15 — RETURNS / RMA
**Priority: P0/P1**

RMA is different from cancellation.

**Cancellation:** stops remaining commitment.  
**RMA:** handles goods already delivered and subsequently returned.

Minimum:

- RMA number;
- customer;
- related SO;
- shipment;
- product;
- quantity;
- batch/lot;
- reason;
- complaint relation;
- evidence;
- requested resolution;
- approval;
- return shipment;
- received quantity;
- disposition;
- replacement/refund/credit outcome.

Cross-domain:

- Quality → inspection/disposition
- Inventory → returned stock
- Traceability → batch/genealogy
- Finance → refund/credit
- Delivery → return shipment
- Sales → customer/commercial coordination

Do not duplicate Batch, Inventory, Payment, or Quality entities.

---

## WS-S16 — COMPLAINTS
**Priority: P0/P1**

Minimum:

- complaint number;
- customer/contact;
- SO;
- shipment;
- product;
- batch/lot;
- affected quantity;
- complaint date;
- description;
- photos/evidence;
- severity;
- owner;
- status;
- investigation;
- root-cause reference;
- corrective action;
- resolution;
- replacement/RMA relation.

Sales/CRM owns the customer-facing complaint record.

Quality owns investigation/disposition where applicable.

Complaint should support traceability:

**Customer → SO → Shipment → Product → Batch → Quality/Production evidence**

Do not duplicate Batch/Genealogy.

---

## WS-S17 — CONTRACTS / COMMERCIAL AGREEMENTS
**Priority: P1**

Focus initially on structured commercial agreements, not a generic legal document engine.

Minimum:

- customer;
- agreement number;
- agreement type;
- effective date;
- expiry;
- product scope;
- price terms;
- payment terms;
- volume commitment;
- MOQ;
- delivery terms;
- approval;
- attachments;
- versions;
- status.

Document storage belongs to the document-management capability.

Commercial terms must remain structured data.

Do not store commercial truth only as PDF.

---

## WS-S18 — SALES FORECAST
**Priority: P1/P2**

Forecast is not a copy of Sales Orders.

It represents expected future demand.

Distinguish:

- committed;
- probable;
- pipeline;
- forecast;
- actual.

Inputs may include opportunities, historical sales, customer plans, agreements, Sales input, and market assumptions.

Output must be capable of becoming an input to Planning.

Sales Forecast → Planning Demand/Forecast interface.

Sales does not own MPS/MRP.

---

## WS-S19 — DEMAND SIGNAL
**Priority: P0/P1**

Demand Signal is the commercial interface into Planning.

Examples:

- Confirmed SO → Demand Signal
- Forecast → Demand Signal
- Customer commitment/change → Demand update

Demand Signal is **not MRP**.

Sales produces commercial demand information. Planning owns demand planning, MPS, and MRP.

Minimum contract:

- producer;
- consumer;
- trigger;
- authoritative source;
- business meaning;
- product;
- quantity;
- requested date;
- priority;
- version;
- change/cancellation;
- idempotency;
- retry;
- audit.

---

## WS-S20 — FULFILLMENT COORDINATION
**Priority: P0/P1**

Sales needs visibility into customer commitment fulfillment without taking over execution.

Sales view may show:

- ordered quantity;
- confirmed quantity;
- produced quantity;
- quality-released quantity;
- available quantity;
- shipped quantity;
- delivered quantity;
- remaining quantity;
- requested date;
- expected date;
- blockers.

Ownership:

- Manufacturing → production
- Quality → release
- Inventory → availability
- Delivery → shipment
- PPIC → planning/feasibility
- Sales → customer-facing coordination

Derived statuses must not become duplicate source-of-truth states.

---

## WS-S21 — DELIVERY COORDINATION
**Priority: P1**

Sales needs coordination/visibility, while Delivery/Logistics owns shipment execution.

Sales needs:

- delivery request;
- SO reference;
- destination;
- requested delivery date;
- confirmed delivery date;
- shipment status;
- tracking;
- POD;
- delivered quantity;
- remaining quantity;
- delivery exception.

Support:

**Customer Registered Address + Transaction-Specific Shipping Address**

Historical shipment must use a frozen address snapshot.

---

## WS-S22 — COMMISSION
**Priority: P1/P2**

Do not hardcode a global commission percentage.

Minimum:

- salesperson;
- customer;
- transaction;
- eligible amount;
- commission rule;
- rate;
- basis;
- period;
- status;
- approval;
- payout status.

Before implementation, determine the commission basis, such as:

- quotation;
- SO;
- invoice;
- payment received;
- delivery;
- gross margin;
- combination.

Finance remains owner of accounting/payout.

---

## WS-S23 — SALES ANALYTICS
**Priority: P2**

Build analytics after operational data models are sufficiently stable.

Minimum areas:

### Pipeline
- leads;
- opportunities;
- conversion;
- pipeline value;
- weighted pipeline.

### Quotation
- issued;
- accepted;
- rejected;
- expired;
- conversion rate.

### Sales Order
- order value;
- quantity;
- fulfillment;
- cancellation;
- delay.

### Customer
- new;
- active;
- inactive;
- repeat;
- order value.

### Complaint/RMA
- count;
- value;
- product;
- customer;
- batch relation;
- resolution time.

### Forecast
- forecast;
- committed;
- actual;
- variance.

Analytics must consume canonical operational data.

---

# 5. RECOMMENDED EXECUTION WAVES

## Wave 1 — Commercial Foundation

1. Product Reference
2. Pricing
3. Quotation

Dependency:

**Product → Pricing → Quotation → Sales Order**

## Wave 2 — Pre-Sales

4. Leads
5. Opportunities
6. Sample Requests

Conceptual flow:

**Lead → Opportunity → Quotation → Sample → SO**

Sample is optional.

## Wave 3 — Commercial Commitment

7. Contracts
8. Sales Order Amendment
9. Demand Signal

## Wave 4 — Fulfillment

10. Fulfillment Coordination
11. Delivery Coordination

## Wave 5 — After Sales

12. Complaints
13. Returns/RMA

Complaint does not automatically create RMA.

## Wave 6 — Commercial Planning

14. Sales Forecast

## Wave 7 — Commission

15. Commission

## Wave 8 — Analytics

16. Sales Analytics

This is dependency guidance, not an absolute serial blocker. Independent workstreams may proceed in parallel.

---

# 6. CROSS-DOMAIN CONTRACTS TO DEFINE

At minimum reconcile:

### Sales → Engineering/Product
Product identity, configuration, formula-derived information.

### Sales → Planning
Demand Signal, Forecast, SO changes.

### Sales → Manufacturing
Production visibility / commitment impact.

### Sales → Inventory
Availability visibility.

### Sales → Quality
Complaint / quality information.

### Sales → Delivery
Shipment/delivery coordination.

### Sales → Finance
Payment terms, payment milestones, payment verification, outstanding, commercial completion dependency.

### Sales → Traceability
Batch/lot references.

### Sales → Costing
Cost/pricing input where needed.

A contract must not simply become direct access to another domain's tables without architectural justification.

---

# 7. PAYMENT CONTRACT

Finance is not yet fully built, so do not create a fake Finance source of truth in Sales.

Sales needs a contract for:

- payment terms;
- payment milestones;
- payment requirements;
- payment status;
- verified payment;
- outstanding;
- payment gate.

Example:

**60% Before Production + 40% Before Shipment**

→ 60% verified: production gate may open  
→ 40% verified: shipment gate may open

If transaction terms differ, gates follow the transaction's agreed terms.

Partial payment must be supported.

**SO COMPLETED ≠ PAID**

An SO may be completed when commercial fulfillment is complete while Finance still shows outstanding receivable.

Finance remains source of truth for payment.

---

# 8. MID-PROCESS CANCELLATION

Canonical principle:

**CANCEL THE COMMITMENT, NEVER ERASE THE HISTORY.**

If a customer requests cancellation after execution starts:

**Customer → Sales → Cancellation Request → Impact Assessment → Manager/GM Decision → Cancel Remaining Commitment → Cross-Domain Effects → Audit**

Never delete:

- SO;
- WO;
- production;
- material movement;
- shipment;
- payment;
- traceability history.

If delivered goods are returned, use **RMA**, not cancellation.

Partial execution must remain visible:

**Original Commitment + Executed + Cancelled + Remaining**

Every consequential decision must capture:

- actor;
- action;
- timestamp;
- reason;
- previous state;
- resulting state;
- entity;
- transaction/version;
- evidence where applicable.

Reason should use:

**Reason Category + Additional Note**

If `Other/Lainnya`, Additional Note is mandatory.

---

# 9. SECURITY REQUIREMENTS

Every new capability must fail closed.

Test at minimum:

- anonymous;
- authenticated wrong tenant;
- wrong role;
- wrong department;
- missing identity;
- missing tenant;
- unauthorized function;
- RLS;
- API authorization.

Unknown/NULL authorization:

**DENY**

Database function privileges must be explicitly reconciled. Do not assume a grant to `authenticated` is sufficient.

Security tests must prove the intended rejection mechanism, not merely that a request happened to fail somewhere else.

---

# 10. VERSIONING / HISTORICAL TRUTH

Historical commercial facts must remain stable.

At minimum:

- Quotation → versioned
- Pricing → effective/historical price
- Contract → versioned
- SO → historical commitment
- SO Amendment → original + proposed change + decision
- Shipment → address snapshot
- Decision → actor snapshot

Do not reconstruct historical transactions from today's master data.

---

# 11. DEFINITION OF DONE

A capability may be marked DONE only when:

### Architecture
- ownership clear;
- source of truth clear;
- entity reconciled;
- state reconciled;
- cross-domain impact reviewed.

### Business
- business rules defined;
- permissions defined;
- decision rules defined.

### UX
- list;
- detail;
- create/edit;
- lifecycle/status;
- loading;
- empty state;
- error state;
- responsive;
- accessibility.

### Data
- schema;
- constraints;
- indexes;
- tenant isolation;
- audit;
- version/snapshot where required.

### Integration
- producer/consumer;
- contract;
- failure;
- retry;
- idempotency;
- event/API behavior.

### Testing
- unit;
- integration;
- authorization;
- tenant isolation;
- E2E;
- regression.

### Evidence
- actual test results;
- UX evidence;
- migration evidence;
- security evidence;
- reconciliation result.

### Release
- no unresolved P0;
- no unresolved critical security issue;
- no duplicate source of truth;
- no known destructive data issue.

---

# 12. CLAUDE CODE EXECUTION PROTOCOL

For each workstream:

### Phase A — Discovery
Audit:

- routes;
- pages;
- components;
- services;
- API;
- database;
- migrations;
- tests;
- navigation;
- existing entities.

### Phase B — Reconciliation
Compare:

**AS-IS vs canonical governance vs business decisions**

### Phase C — Plan
Produce:

- gaps;
- risks;
- architecture proposal;
- cross-domain contracts;
- work orders.

### Phase D — Implement
Execute small, reversible work orders.

### Phase E — Verify
Test:

- happy path;
- negative path;
- authorization;
- tenant isolation;
- atomicity;
- regression;
- UX.

### Phase F — Report
Separate:

- completed;
- partial;
- blocked;
- new finding;
- new decision;
- security issue;
- next work order.

---

# 13. CURRENT IMMEDIATE TASK FOR AGENT 01

Before building everything, reconcile the existing repository/runtime against:

1. Quotations
2. Pricing
3. Product Reference
4. Leads
5. Opportunities
6. Samples
7. Contracts
8. Forecast
9. Demand Signal
10. Fulfillment
11. Delivery
12. Complaint
13. RMA
14. Commission
15. Analytics

Produce:

| Capability | Existing | Status | Owner | Gap | Dependency | Priority |
|---|---|---|---|---|---|---|

Use only:

- IMPLEMENTED
- PARTIAL
- DOCUMENTED ONLY
- MISSING
- CONFLICT
- UNKNOWN

Do not label something MISSING merely because it was absent from documentation; verify repository/runtime evidence.

Then create the smallest safe parallel workstreams.

---

# 14. IMPORTANT DECISION RULE

Do not block all work because some discovery questions remain open.

Build what is ready.

Discover what is unknown.

Escalate only genuine new decisions.

For any new business decision:

**Evidence → Options → Impact → Recommendation → Architecture Guardian/Product Owner Decision**

Do not guess.

---

# 15. FINAL SALES & CRM COMPLETION CRITERIA

Sales & CRM is not COMPLETE merely because:

- Customers are complete;
- Customer PO is complete;
- Sales Orders are complete.

All approved Sales & CRM capabilities must have a defensible status.

Target end-to-end commercial flow:

**LEAD**
↓
**OPPORTUNITY**
↓
**SAMPLE (optional)**
↓
**QUOTATION**
↓
**CONTRACT (optional)**
↓
**CUSTOMER PO**
↓
**SALES ORDER**
↓
**APPROVAL**
↓
**DEMAND SIGNAL**
↓
**FULFILLMENT COORDINATION**
↓
**DELIVERY COORDINATION**
↓
**COMPLETED**

After sales:

**COMPLAINT → RMA (if required) → RESOLUTION**

Parallel:

**PRICING / FORECAST / COMMISSION / ANALYTICS**

All flows must preserve FABRIX domain boundaries.

**Do not create workarounds for domains not yet built.**
**Do not create duplicate sources of truth.**
**Do not erase historical truth.**
**Do not equate UX menu structure with domain ownership.**
**Do not equate green tests with architecture compliance.**
**Do not assume existing implementation is correct.**

Use actual repository/runtime evidence for every correction.
