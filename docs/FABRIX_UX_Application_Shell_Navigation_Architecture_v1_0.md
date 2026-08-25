<!--
  DISALIN KE REPO 25 Agu 2026 atas perintah pemilik produk.
  Berkas asal : ~/Downloads/FABRIX_UX_Application_Shell_Navigation_Architecture_v1.0.md
  Penulis     : Fable 5 (sesi perancangan UX di luar repo ini)
  Status      : DOKUMEN RUJUKAN, bukan keputusan yang sudah berlaku.

  CARA MEMBACANYA, supaya sesi berikutnya tidak salah pakai:
  Isi dokumen ini adalah USULAN. Yang MENGIKAT adalah keputusan pemilik produk yang
  tercatat di CLAUDE.md dan di Daftar Tugas. Beberapa bagian dokumen ini SUDAH DIBATALKAN
  pemilik produk pada 25 Agu 2026 -- terutama aturan 'item parkir tidak muncul di navigasi'.
  Jangan menerapkan isi dokumen ini tanpa memeriksa keputusan yang lebih baru.
-->

# FABRIX — UX APPLICATION SHELL & NAVIGATION ARCHITECTURE v1.0

## Global Header, Left Navbar, Workspace Navigation, Page Structure & Implementation Status Mapping

**Status:** UX Application Shell Baseline  
**Audience:** Product Owner → Claude Fable 5 → Claude Opus 5 → Claude Code  
**Depends on:** `FABRIX_UX_Information_Architecture_v1.0.md`  
**Master Architecture:** `01 UX / Information Architecture`

---

# 1. PURPOSE

This document defines the application shell and navigation behavior for FABRIX.

It extends the previous Information Architecture document.

The previous document answered:

> What are the workspaces and capabilities of FABRIX?

This document answers:

> How are those workspaces presented and navigated inside the actual FABRIX application?

It covers:

- Global Header
- Left Navigation
- Workspace / Secondary Navigation
- Breadcrumb
- Page Header
- Tabs
- Contextual Action Bar
- Right Context Panel
- Global Search
- Command Palette
- Notifications
- Tasks / Approvals
- User / Company context
- Responsive navigation
- Role-based navigation
- Permission-based navigation
- Entity deep linking
- Navigation state
- Feature implementation status
- Existing URL/page verification
- Visual status markers
- Rules for implemented vs not implemented features

---

# 2. CRITICAL INSTRUCTION — VERIFY THE REAL FABRIX APPLICATION

This document must NOT be implemented as a purely theoretical navigation system.

Claude Fable 5 must first inspect the actual FABRIX project.

The objective is to reconcile:

```text
MASTER UX ARCHITECTURE
        +
CURRENT FABRIX CODEBASE
        +
CURRENT DATABASE / ROUTES
        +
CURRENT UI
        ↓
ACTUAL NAVIGATION STATUS
```

Fable 5 must identify every existing FABRIX feature/page and determine:

```text
IMPLEMENTED
IMPLEMENTED + URL EXISTS
IMPLEMENTED BUT NO DEDICATED URL
PARTIAL
PLACEHOLDER
NOT IMPLEMENTED
ARCHITECTURE ONLY
UNKNOWN
```

Do not assume that a feature exists merely because:

- a database table exists;
- a service exists;
- an API exists;
- a menu label exists;
- a component exists;
- a task is marked completed.

A feature is considered **UI implemented** only when the user can actually reach and use the relevant page/workflow.

---

# 3. IMPLEMENTATION STATUS LEGEND

The navigation must visually communicate implementation status.

Recommended legend:

```text
🟢 IMPLEMENTED
```

Feature/page exists and is usable.

```text
🔵 IMPLEMENTED + URL
```

Feature/page exists, is usable, and has a verified route/URL.

```text
🟡 PARTIAL
```

Some functionality exists, but the intended capability is incomplete.

```text
🟠 PLACEHOLDER
```

Navigation/page exists but functionality is not yet implemented.

```text
⚪ ARCHITECTURE ONLY
```

Defined in architecture but not implemented.

```text
🔴 NOT IMPLEMENTED
```

No meaningful implementation exists.

```text
⚫ UNKNOWN / NEEDS VERIFICATION
```

Evidence is insufficient.

---

# 4. IMPORTANT UX RULE FOR STATUS COLORS

Status colors must not depend only on font color.

Use multiple signals:

```text
Color
+
Icon
+
Tooltip
+
Optional status badge
+
Disabled/enabled state
```

Recommended visual behavior:

### Implemented

```text
Sales & CRM
```

Normal active navigation appearance.

### Implemented + URL

```text
Sales & CRM   ↗
```

or show route in tooltip / navigation metadata.

### Partial

```text
Planning & APS   ◐
```

### Architecture only

```text
MES              ○
```

### Not implemented

```text
AI               🔒
```

Do not use color alone because of accessibility.

---

# 5. NAVIGATION STATUS MUST BE DATA-DRIVEN

Navigation should eventually consume a status configuration rather than hard-coded visual decisions.

Conceptual model:

```text
NavigationItem
├── id
├── label
├── icon
├── route
├── workspace
├── domain
├── requiredPermission
├── implementationStatus
├── availability
├── featureFlag
├── badge
└── children[]
```

Example:

```json
{
  "id": "planning.mrp",
  "label": "MRP",
  "workspace": "planning",
  "domain": "planning",
  "route": "/planning/mrp",
  "implementationStatus": "implemented",
  "availability": "enabled"
}
```

Example not yet implemented:

```json
{
  "id": "planning.scenario",
  "label": "Scenario Planning",
  "workspace": "planning",
  "domain": "planning",
  "route": null,
  "implementationStatus": "architecture_only",
  "availability": "disabled"
}
```

These are conceptual examples, not instructions to create this exact schema without Fable/Opus review.

---

# 6. FABRIX APPLICATION SHELL

Recommended desktop structure:

```text
┌───────────────────────────────────────────────────────────────────────────────┐
│ FABRIX │ Global Search / Command │ + Create │ 🔔 │ Tasks │ Help │ Company │ User │
├───────────────┬───────────────────────────────────────────────────────────────┤
│               │                                                               │
│ GLOBAL        │ Breadcrumb                                                    │
│ NAVIGATION    │                                                               │
│               │ Workspace Header                                              │
│ 🏠 Overview   │                                                               │
│ 🎯 Control    │ Page / Workspace Content                                      │
│               │                                                               │
│ 💼 Sales      │                                                               │
│ 🧩 Product   │                                                               │
│ 📅 Planning  │                                                               │
│ 📦 Supply    │                                                               │
│ 🏭 Mfg       │                                                               │
│ 🔍 Quality   │                                                               │
│ 🔗 Trace     │                                                               │
│ 🔧 Maint.    │                                                               │
│ 💰 Finance   │                                                               │
│               │                                                               │
│ ──────────── │                                                               │
│ 📊 Data      │                                                               │
│ ✨ AI        │                                                               │
│ 🔌 Integr.   │                                                               │
│ ⚙️ Admin     │                                                               │
│               │                                                               │
│ Company      │                                                               │
└───────────────┴───────────────────────────────────────────────────────────────┘
```

---

# 7. GLOBAL HEADER

The global header is persistent across the application.

Recommended structure:

```text
┌───────────────────────────────────────────────────────────────────────────────┐
│ FABRIX │ Search │ Command │ + Create │ Notifications │ Tasks │ Help │ Context │
└───────────────────────────────────────────────────────────────────────────────┘
```

## 7.1 Left

```text
FABRIX Logo
Workspace / Product Context
```

## 7.2 Center

```text
Global Search
Command Palette trigger
```

## 7.3 Right

```text
Quick Create
Notifications
Tasks / Approvals
Help
Company / Tenant
User
```

---

# 8. GLOBAL SEARCH

Global search should search across entities.

Examples:

```text
Customer
Sales Order
Quotation
Product
Item
BOM
Purchase Order
Supplier
Production Order
Work Order
Batch
Lot
Equipment
Invoice
```

Search result should indicate entity type:

```text
ABC Manufacturing
Customer

SO-2026-00128
Sales Order

RM-00091
Raw Material

LOT-2026-00421
Inventory Lot
```

Selecting a result should open the canonical entity detail page.

---

# 9. COMMAND PALETTE

Command Palette provides fast navigation and actions.

Examples:

```text
Go to Sales
Go to MRP
Create Sales Order
Create Purchase Requisition
Create Production Order
Find Customer
Find Item
Find Lot
Open Control Tower
Open My Tasks
```

Commands must respect permissions.

---

# 10. QUICK CREATE

The `+ Create` button should be contextual.

Examples:

```text
Sales
+ Lead
+ Opportunity
+ Quotation
+ Sales Order
+ Sample Request

Planning
+ Demand
+ Forecast
+ Planning Run

Supply Chain
+ Purchase Requisition
+ RFQ
+ Purchase Order
+ Stock Transfer

Manufacturing
+ Production Order
+ Work Order

Quality
+ Inspection
+ NCR

Maintenance
+ Maintenance Order
```

Only actions available to the current user should appear.

---

# 11. LEFT NAVIGATION

The left navbar contains top-level workspaces only.

```text
🏠 Overview
🎯 Control Tower

💼 Sales & CRM
🧩 Product & Engineering
📅 Planning & APS
📦 Supply Chain
🏭 Manufacturing
🔍 Quality
🔗 Traceability
🔧 Maintenance
💰 Finance & Costing

───────────────

📊 Data & Analytics
✨ AI
🔌 Integrations
⚙️ Administration
```

Do not expose technical infrastructure here.

---

# 12. LEFT NAVIGATION BEHAVIOR

When collapsed:

```text
🏠
🎯
💼
🧩
📅
📦
🏭
🔍
🔗
🔧
💰
──
📊
✨
🔌
⚙️
```

Hover displays tooltip.

When expanded:

```text
📅 Planning & APS
```

When selected, the workspace opens its secondary navigation.

---

# 13. WORKSPACE / SECONDARY NAVIGATION

Workspace navigation contains capabilities inside the selected workspace.

Example:

```text
Planning & APS
────────────────────
Dashboard
Demand Planning
Sales Forecast
Demand Review
MPS
MRP
Material Requirements
Planned Orders
Capacity / RCCP
Scheduling
Gantt
Scenario Planning
Pegging
Exceptions
```

The secondary navigation can be implemented as:

- left nested menu;
- top workspace tabs;
- contextual sidebar;
- command/navigation panel.

Fable 5 should determine the best pattern based on actual FABRIX screen density.

---

# 14. BREADCRUMB

Breadcrumb should show hierarchy.

Example:

```text
Planning & APS
/
MRP
/
MRP Run #MRP-2026-001
```

For entity navigation:

```text
Sales & CRM
/
Customers
/
ABC Manufacturing
/
Sales Order SO-2026-00128
```

Breadcrumb should support direct navigation to parent levels.

---

# 15. PAGE HEADER

Standard page header:

```text
┌─────────────────────────────────────────────────────────────┐
│ ← Breadcrumb                                                │
│                                                             │
│ Sales Order SO-2026-00128             [Actions] [Status]   │
│ ABC Manufacturing                                          │
│                                                             │
│ [Edit] [Approve] [Release] [More]                         │
└─────────────────────────────────────────────────────────────┘
```

Page header should contain:

```text
Title
Subtitle / entity identity
Status
Primary actions
Secondary actions
```

---

# 16. TABS

Entity detail pages should use tabs where complexity requires it.

Example Production Order:

```text
Production Order
────────────────────────────────────────────────────────
Overview | Materials | Operations | Schedule | Quality |
Batch / Traceability | Cost | Documents | Timeline
```

Tabs must not become a dumping ground.

Use tabs only for logically related contexts.

---

# 17. RELATED RECORDS

Entities should expose related records.

Example Customer:

```text
Customer
├── Overview
├── Contacts
├── Opportunities
├── Quotations
├── Sales Orders
├── Deliveries
├── Returns
├── Complaints
├── Sample Requests
└── Timeline
```

Example Item:

```text
Item
├── Overview
├── Inventory
├── BOM
├── Formula
├── Routing
├── Suppliers
├── Purchase History
├── Production History
├── Quality
├── Lots
└── Cost
```

---

# 18. RIGHT CONTEXT PANEL

A right-side contextual panel may be used for:

```text
Activity
Comments
Documents
Related Tasks
Approvals
AI Insights
Audit
```

It should not duplicate the primary page.

---

# 19. GLOBAL TASK CENTER

Tasks and approvals should be accessible from the global header.

Example:

```text
Tasks
├── My Tasks
├── Pending Approval
├── Assigned to Me
├── Overdue
└── Completed
```

Task navigation should deep-link to the relevant entity.

---

# 20. NOTIFICATION CENTER

Notifications should distinguish:

```text
Information
Warning
Exception
Approval
Critical
```

Example:

```text
🔴 Material shortage for SO-00128
🟠 Supplier PO-00119 overdue
🟡 Production Order PO-00031 delayed
🔵 Sample Request SR-00012 awaiting approval
```

Clicking a notification should open the related context.

---

# 21. COMPANY / TENANT CONTEXT

The current company/tenant should always be visible or readily accessible.

Example:

```text
FABRIX
PT Example Manufacturing
▼
```

Switching company/tenant must respect authorization.

No cross-company data should become visible merely because the user can switch context.

---

# 22. USER MENU

```text
User
├── Profile
├── Preferences
├── Appearance
├── Keyboard Shortcuts
├── Session / Security
└── Sign Out
```

---

# 23. RESPONSIVE BEHAVIOR

Desktop:

```text
Persistent left navigation
Persistent global header
```

Tablet:

```text
Collapsible navigation
Persistent header
Contextual workspace navigation
```

Small screen:

```text
Compact header
Drawer navigation
Bottom/context actions where appropriate
```

Exact breakpoint values should be determined by the UI system rather than hard-coded in this architecture document.

---

# 24. ROLE-BASED NAVIGATION

Navigation visibility must be permission-driven.

Example:

```text
Planner
→ Planning & APS
→ Supply Chain
→ Control Tower

Production Manager
→ Manufacturing
→ Planning & APS
→ Quality
→ Control Tower

Warehouse
→ Supply Chain
→ Quality

Quality
→ Quality
→ Traceability
→ Supply Chain

Finance
→ Finance & Costing
→ Sales
→ Supply Chain

Sales
→ Sales & CRM
→ Overview
→ Control Tower
```

This is an example, not the final authorization matrix.

---

# 25. IMPLEMENTATION STATUS AUDIT — MANDATORY

This is a critical instruction to Fable 5.

Before finalizing the navigation, inspect the current FABRIX project and create a complete feature/page inventory.

Inspect at minimum:

```text
Repository
Routes
Pages
Layouts
Navigation configuration
Components
Database schema
API / server actions
Domain services
Tests
E2E tests
Existing HANDOFF files
Existing architecture documents
```

For every feature in the UX architecture, determine:

```text
Does the feature exist?
Does the page exist?
Does the route exist?
Is the page reachable?
Is the workflow functional?
Is it partial?
Is it a placeholder?
Is it only architecture?
```

---

# 26. FEATURE STATUS MATRIX

Fable 5 must produce a table like:

| Workspace | Feature | Page Exists | URL / Route | Functional | Status | Evidence |
|---|---|---:|---|---:|---|---|
| Sales & CRM | Customers | ? | ? | ? | ? | repository / browser |
| Sales & CRM | Sample Requests | ? | ? | ? | ? | repository / browser |
| Sales & CRM | Sales Orders | ? | ? | ? | ? | repository / browser |
| Product & Engineering | BOM | ? | ? | ? | ? | repository / browser |
| Planning & APS | MRP | ? | ? | ? | ? | repository / browser |
| Supply Chain | Purchase Orders | ? | ? | ? | ? | repository / browser |
| Manufacturing | Production Orders | ? | ? | ? | ? | repository / browser |
| Quality | Inspection | ? | ? | ? | ? | repository / browser |
| Traceability | Genealogy | ? | ? | ? | ? | repository / browser |
| Maintenance | Equipment | ? | ? | ? | ? | repository / browser |
| Finance & Costing | Costing | ? | ? | ? | ? | repository / browser |
| Data & Analytics | Report Builder | ? | ? | ? | ? | repository / browser |
| AI | AI Assistant | ? | ? | ? | ? | repository / browser |

The final matrix must contain every navigation item, not only the examples above.

---

# 27. URL VERIFICATION RULE

If a page exists and has a verified route:

```text
status = IMPLEMENTED + URL
```

The route must be recorded.

Example:

```text
MRP
Route: /planning/mrp
Status: 🟢 Implemented + URL
```

Do not invent URLs.

If a feature exists but no dedicated page/route exists:

```text
status = IMPLEMENTED BUT NO URL
```

If a URL exists but the page is only a placeholder:

```text
status = PLACEHOLDER
```

If a route returns an error or unusable page:

```text
status = BROKEN / NEEDS FIX
```

---

# 28. NAVIGATION STATUS DISPLAY

Recommended navigation representation:

```text
🏭 Manufacturing
│
├── Dashboard                  🟢
├── Production Orders          🟢 ↗
├── Work Orders                🟡
├── Production Schedule        🟡
├── Dispatch Board             ⚪
├── Production Operations      🟢 ↗
├── Material Consumption       🟢
├── Production Output          🟡
├── Scrap / Rework             🟡
└── Production Reports         ⚪
```

Where:

```text
🟢 = implemented
🟢 ↗ = implemented + verified URL
🟡 = partial
🟠 = placeholder
⚪ = architecture only
🔴 = not implemented
⚫ = unknown
```

The actual UI may instead use:

```text
normal text       = implemented
muted text        = not implemented
badge             = partial
disabled          = unavailable
```

but the status must remain discoverable.

---

# 29. IMPORTANT — DISABLED NAVIGATION BEHAVIOR

Do not make every unimplemented feature clickable.

Recommended:

### Implemented

```text
normal + clickable
```

### Partial

```text
clickable
+
"Partial" badge
```

### Placeholder

```text
muted
+
disabled OR preview page
```

### Architecture only

```text
muted / disabled
+
"Planned" tooltip
```

### Not implemented

```text
disabled
```

Do not create fake pages merely to make the navigation appear complete.

---

# 30. PRODUCT OWNER / INTERNAL MODE

FABRIX may support an internal development visibility mode where implementation status is explicitly shown.

Example:

```text
Planning & APS
├── MPS                 🟢
├── MRP                 🟢
├── Scheduling          🟡  60%
├── Gantt               🟡  40%
├── Scenario Planning   ⚪
```

This mode should not necessarily be exposed to ordinary customers/users.

It is primarily useful for:

```text
Product Owner
Architecture Team
Development Team
QA
```

---

# 31. PUBLIC / NORMAL USER MODE

Normal users should see clean navigation:

```text
Planning & APS
├── Demand Planning
├── MPS
├── MRP
├── Scheduling
└── Exceptions
```

They should not be burdened with:

```text
Architecture Only
Not Implemented
Technical Debt
```

unless the product owner explicitly chooses to expose such status.

---

# 32. FEATURE INVENTORY MUST INCLUDE EXISTING FEATURES NOT YET IN NAVIGATION

This is critical.

Fable 5 must not only check:

```text
Architecture → Existing UI
```

It must also check:

```text
Existing UI / Feature
        ↓
Is it represented in UX architecture?
```

If Claude Code has already implemented a feature that is missing from the proposed navigation:

```text
FLAG:
EXISTING FEATURE NOT REPRESENTED IN UX
```

Then determine:

```text
Add to navigation
Move to another workspace
Make contextual only
Deprecate
```

---

# 33. EXISTING URL DISCOVERY

Fable 5 must inspect the actual route system.

Possible evidence sources:

```text
Next.js / React routes
App Router
Page files
Route configuration
Link components
Navigation configuration
Browser verification
E2E tests
```

The final navigation status must use actual discovered routes.

Never invent:

```text
/planning/mrp
/manufacturing/orders
/quality/ncr
```

unless those routes actually exist.

---

# 34. URL REGISTRY

Fable 5 should produce a registry:

| Feature | Verified Route | Route Type | Access | Status |
|---|---|---|---|---|
| Customers | actual route | page | Sales | 🟢 |
| Sales Orders | actual route | page | Sales | 🟢 |
| MRP | actual route or none | page | Planning | ? |
| Production Orders | actual route | page | Manufacturing | ? |
| Traceability | actual route or none | page | Traceability | ? |

Only verified routes should be recorded.

---

# 35. NAVIGATION ↔ ROUTING RULE

Every enabled navigation item should satisfy:

```text
Navigation Item
      ↓
Permission Check
      ↓
Route Exists
      ↓
Page Loads
      ↓
Page Is Usable
```

If any critical step fails, the navigation status must reflect that.

---

# 36. ENTITY DEEP LINKING

Important entities must support direct navigation.

Examples:

```text
/customer/:id
/sales-order/:id
/item/:id
/bom/:id
/purchase-order/:id
/production-order/:id
/work-order/:id
/lot/:id
/equipment/:id
/invoice/:id
```

These are examples only.

Fable 5 must inspect and record actual route conventions.

---

# 37. CROSS-DOMAIN NAVIGATION

Example:

```text
Production Order
 ↓
Material
 ↓
Inventory Lot
 ↓
Supplier
```

The user should be able to navigate directly to each related entity.

Another:

```text
Customer
 ↓
Sales Order
 ↓
Delivery
 ↓
Finished Goods Lot
 ↓
Production Batch
 ↓
Raw Material Lot
```

This is especially important for Traceability.

---

# 38. NAVIGATION STATE

The application should preserve:

```text
Current Workspace
Current Page
Current Filter
Current Tab
Current Entity
Scroll / list state where practical
```

Example:

```text
Planning → MRP → Run #123 → Exceptions
```

If the user navigates to a related item and returns, FABRIX should preserve context where practical.

---

# 39. GLOBAL ACTION VS CONTEXTUAL ACTION

Global actions:

```text
Search
Command
Notifications
Tasks
Help
Company
User
```

Contextual actions:

```text
Approve
Release
Cancel
Schedule
Reserve
Inspect
Issue
Receive
Close
```

Contextual actions belong to the relevant page/entity.

---

# 40. CONTROL TOWER NAVIGATION

Control Tower is not a replacement for domain screens.

Example:

```text
Control Tower
 ↓
Material Shortage
 ↓
Open MRP Exception
 ↓
MRP Detail
 ↓
Pegging
 ↓
Purchase Requirement
 ↓
Purchase Requisition
```

The Control Tower should route users into the actual operational domain.

---

# 41. AI NAVIGATION

AI should be accessible globally where useful, but domain actions must remain domain-owned.

Example:

```text
AI Assistant
 ↓
"Why is Production Order PO-001 delayed?"
 ↓
AI identifies:
 ├── Material shortage
 ├── Equipment downtime
 └── Capacity conflict
 ↓
Links to:
 ├── MRP
 ├── Maintenance
 └── Scheduling
```

AI provides context and recommendations.

It does not bypass domain permissions.

---

# 42. FABLE 5 MANDATORY AUDIT COMMAND

Fable 5 must perform this audit before approving the navigation:

```text
AUDIT ALL CURRENT FABRIX FEATURES.

1. Scan the entire repository for implemented pages, routes,
   navigation entries, major components, domain services, APIs,
   workflows, and tests.

2. Scan the existing architecture and handoff documents.

3. Build a complete inventory of features currently implemented.

4. For every implemented feature, verify whether:
   - a page exists;
   - a route/URL exists;
   - the route is reachable;
   - the page is functional;
   - permissions are correctly applied;
   - the feature is represented in the proposed UX navigation.

5. For every feature in the proposed UX navigation, verify whether:
   - it exists in the current implementation;
   - a page exists;
   - a verified URL exists;
   - it is functional;
   - it is partial;
   - it is a placeholder;
   - it is architecture-only;
   - it is not implemented.

6. DO NOT INVENT URLS.

7. DO NOT MARK A FEATURE AS IMPLEMENTED ONLY BECAUSE
   A DATABASE TABLE, API, SERVICE OR COMPONENT EXISTS.

8. Use browser/E2E verification where possible for important
   user-facing pages.

9. Produce a complete AS-IS navigation map.

10. Produce a TO-BE navigation map.

11. Produce an AS-IS vs TO-BE gap matrix.

12. Mark every navigation item with implementation status.

13. For implemented pages with verified URLs, record the exact
    discovered route.

14. For pages not implemented or without a usable page, explicitly
    mark them as planned / partial / placeholder / not implemented.

15. Identify implemented features that are missing from the
    proposed UX architecture.

16. Recommend whether each missing feature should:
    - be added to navigation;
    - become contextual;
    - move to another workspace;
    - remain hidden;
    - be deprecated.

17. Do not change existing production implementation merely to
    make the navigation appear complete.

18. Do not create fake pages merely to satisfy the sitemap.
```

---

# 43. FABLE 5 OUTPUT — REQUIRED

Fable 5 must produce:

```text
01. Current Application Shell Assessment
02. Existing Route Inventory
03. Existing Page Inventory
04. Existing Navigation Inventory
05. Existing Feature Inventory
06. Verified URL Registry
07. Feature Implementation Status Matrix
08. Existing Feature Missing From UX Matrix
09. Proposed UX Navigation
10. Navigation Status Mapping
11. Role-Based Navigation Mapping
12. Permission-Based Navigation Mapping
13. Cross-Domain Navigation Map
14. Entity Deep-Link Map
15. UX / Route Conflicts
16. UX / Domain Conflicts
17. Missing Pages
18. Placeholder Pages
19. Broken Routes
20. Architecture-Only Features
21. Recommended UX Corrections
22. Final Application Shell Architecture
23. Final Navigation Architecture
24. Final Route / Navigation Registry
```

---

# 44. OPUS 5 RESPONSIBILITY

After Fable 5 completes the audit, Opus 5 should convert the approved UX architecture into technical design.

Opus should define:

```text
Application Shell
 ↓
Navigation Configuration
 ↓
Route Registry
 ↓
Permission Mapping
 ↓
Feature Flag Mapping
 ↓
Implementation Status Metadata
 ↓
Responsive Behavior
 ↓
Component Structure
 ↓
State Management
```

Opus must preserve actual existing routes where appropriate rather than inventing a parallel route system.

---

# 45. CLAUDE CODE RESPONSIBILITY

Claude Code should implement only after Fable 5 and Opus 5 review.

Claude Code must:

```text
1. Inspect existing shell.
2. Inspect current routes.
3. Inspect current navigation.
4. Preserve working routes unless migration is explicitly approved.
5. Implement the approved shell.
6. Add status metadata where required.
7. Verify every navigation link.
8. Verify permissions.
9. Verify responsive behavior.
10. Run unit tests.
11. Run integration tests.
12. Run E2E tests.
13. Perform browser verification.
14. Update HANDOFF.
```

If existing routes conflict with the target architecture:

```text
STOP
DOCUMENT
ESCALATE
```

Do not silently create duplicate routes.

---

# 46. FINAL RECOMMENDED GLOBAL SHELL

```text
┌───────────────────────────────────────────────────────────────────────────────┐
│ FABRIX │ Search / Command │ + Create │ 🔔 │ Tasks │ Help │ Company │ User   │
├───────────────┬───────────────────────────────────────────────────────────────┤
│               │ Breadcrumb                                                    │
│ 🏠 Overview   │                                                               │
│ 🎯 Control    │ Workspace Header                                              │
│               │                                                               │
│ 💼 Sales      │ Page Content                                                  │
│ 🧩 Product   │                                                               │
│ 📅 Planning  │                                                               │
│ 📦 Supply    │                                                               │
│ 🏭 Mfg       │                                                               │
│ 🔍 Quality   │                                                               │
│ 🔗 Trace     │                                                               │
│ 🔧 Maint.    │                                                               │
│ 💰 Finance   │                                                               │
│               │                                                               │
│ ──────────── │                                                               │
│ 📊 Data      │                                                               │
│ ✨ AI        │                                                               │
│ 🔌 Integr.   │                                                               │
│ ⚙️ Admin     │                                                               │
└───────────────┴───────────────────────────────────────────────────────────────┘
```

---

# 47. FINAL NAVIGATION PRINCIPLE

FABRIX navigation must represent:

> **One manufacturing operating system with multiple specialized workspaces.**

It must not become:

> A list of disconnected modules.

The user experience should follow:

```text
USER
 ↓
WORKSPACE
 ↓
PAGE
 ↓
ENTITY
 ↓
RELATED ENTITY
 ↓
ACTION
 ↓
WORKFLOW
 ↓
RESULT
```

while preserving:

```text
UX ownership
Domain ownership
Technical ownership
```

as separate concerns.

---

# 48. FINAL HANDOFF

This document belongs to:

```text
FABRIX MASTER ARCHITECTURE
└── 01 UX / Information Architecture
    ├── UX Information Architecture v1.0
    └── UX Application Shell & Navigation Architecture v1.0
```

It must be reviewed together with:

```text
02 Domain Architecture
03 Sales Architecture
Post-Sales Architecture Reconciliation
Current FABRIX Repository
Current FABRIX Routes
Current HANDOFF
```

The most important next action is **not coding the shell immediately**.

First:

```text
CURRENT FABRIX
      ↓
FEATURE / ROUTE AUDIT
      ↓
AS-IS NAVIGATION
      ↓
COMPARE TO UX BASELINE
      ↓
MARK IMPLEMENTED / PARTIAL / PLACEHOLDER / PLANNED
      ↓
FABLE 5 REVIEW
      ↓
OPUS 5 TECHNICAL DESIGN
      ↓
CLAUDE CODE
```

**END OF DOCUMENT**
