# FABRIX UI/UX GOVERNANCE

## IBM Carbon Design System --- Mandatory Design & Implementation Standard

**Document type:** Product UI/UX Governance & Execution Instruction\
**Project:** FABRIX Manufacturing SaaS / Manufacturing Operating System\
**Primary design system:** IBM Carbon Design System\
**Audience:** Claude Chat Fable 5 (Consultant), Claude Code Opus
(Instructor), Claude Code (Executor), Product Designer, Frontend
Engineer\
**Status:** Mandatory / Project-wide\
**Applies to:** Existing UI + all future UI/UX work\
**Version:** 1.0\
**Baseline:** 2026-08-24

------------------------------------------------------------------------

## 1. PURPOSE

This document establishes the **single UI/UX source of truth for
FABRIX**.

FABRIX must not evolve as a collection of individually designed screens.
It must behave as **one coherent product system**.

IBM Carbon Design System is therefore not a visual inspiration, optional
library, or loose reference. It is the **fundamental design system and
governing design language** for FABRIX.

Carbon defines reusable assets, design tokens, components, patterns,
interaction behavior, accessibility expectations, and usage guidance.
IBM explicitly positions Carbon as a system of reusable assets and
guidance intended to create consistent digital experiences. Carbon also
provides component-specific usage, style, code, and accessibility
guidance.

**Core rule:**

> If Carbon already provides a component, pattern, token, interaction
> model, or usage rule that satisfies the FABRIX requirement, FABRIX
> MUST use Carbon's solution rather than inventing a custom alternative.

A custom solution is allowed only when: 1. Carbon has no suitable
component/pattern; 2. the manufacturing domain requires a genuinely
domain-specific interaction; 3. the custom design still follows Carbon's
tokens, grid, typography, spacing, accessibility, interaction
principles, and visual language; 4. the deviation is documented and
approved.

------------------------------------------------------------------------

# 2. NON-NEGOTIABLE DESIGN PRINCIPLE

## Carbon First. Custom Second. Improvisation Never.

Every UI decision must follow this order:

1.  **Use an existing Carbon component.**
2.  **Use a Carbon pattern/composition.**
3.  **Compose existing Carbon components.**
4.  **Create a FABRIX domain pattern using Carbon components and
    tokens.**
5.  **Create a custom component only when the above cannot solve the
    requirement.**

Never:

-   invent a visually similar button;
-   invent a custom input when Carbon Input exists;
-   invent a custom dropdown when Carbon Select/ComboBox exists;
-   use arbitrary colors;
-   use arbitrary spacing;
-   use arbitrary typography;
-   use arbitrary border radius;
-   create random shadows;
-   create random card styles;
-   create one-off table interactions;
-   create inconsistent modal behavior;
-   create different loading patterns for different modules;
-   create different empty states for different screens;
-   create different notification behavior for different modules;
-   create a component merely because it is faster to code.

The question is not:

> "Can we make this look good?"

The question is:

> "What is the Carbon-approved way to solve this UX problem?"

------------------------------------------------------------------------

# 3. FABRIX DESIGN GOVERNANCE MODEL

FABRIX must be treated as a **design system implementation**, not merely
a frontend application.

### Layer 1 --- Carbon Foundation

Use Carbon for:

-   color;
-   typography;
-   spacing;
-   grid;
-   icons;
-   motion;
-   themes;
-   focus;
-   accessibility;
-   layering;
-   component foundations.

### Layer 2 --- Carbon Components

Prefer Carbon components for:

-   buttons;
-   inputs;
-   selects;
-   combo boxes;
-   dropdowns;
-   checkboxes;
-   radio buttons;
-   toggles;
-   sliders;
-   date pickers;
-   notifications;
-   tags;
-   tooltips;
-   popovers;
-   modals;
-   drawers;
-   menus;
-   pagination;
-   tabs;
-   accordions;
-   tables;
-   search;
-   progress indicators;
-   loading states;
-   file upload;
-   breadcrumbs;
-   links;
-   tiles;
-   etc.

### Layer 3 --- FABRIX Domain Patterns

FABRIX may define domain-specific patterns such as:

-   Manufacturing Order workspace;
-   Production Planning board;
-   MRP exception workspace;
-   Material shortage analysis;
-   Capacity planning view;
-   Work Center board;
-   BOM explorer;
-   Routing editor;
-   Quality inspection workspace;
-   Maintenance work order workspace;
-   Inventory movement workspace;
-   Procurement recommendation workspace;
-   APS scheduling workspace.

These are **patterns**, not excuses to create a new visual language.

They must be composed from Carbon components and Carbon tokens.

### Layer 4 --- FABRIX Application

Modules such as:

-   Sales;
-   Demand Planning;
-   MPS;
-   MRP;
-   Capacity Planning;
-   APS;
-   Manufacturing;
-   Purchasing;
-   Inventory;
-   Quality;
-   Maintenance;
-   Finance;
-   HR;
-   etc.

must all use the same underlying design language.

------------------------------------------------------------------------

# 4. SOURCE-OF-TRUTH HIERARCHY

When conflicting instructions exist, use this priority:

1.  Current IBM Carbon Design System documentation.
2.  Carbon component usage documentation.
3.  Carbon component style documentation.
4.  Carbon accessibility documentation.
5.  Carbon design tokens.
6.  Carbon implementation/library documentation.
7.  FABRIX Design System rules in this document.
8.  Existing FABRIX UI only when it does not conflict with the above.
9.  Individual developer preference --- NEVER authoritative.

Existing UI is **not automatically the standard**.

A legacy screen that violates Carbon must be treated as technical/design
debt.

------------------------------------------------------------------------

# 5. MANDATORY WORKFLOW FOR EVERY UI CHANGE

Every feature must pass through the following sequence.

## Step 1 --- Identify the user task

Define:

-   user;
-   objective;
-   context;
-   primary action;
-   secondary actions;
-   information required;
-   expected outcome;
-   error conditions;
-   empty state;
-   loading state;
-   permission/state constraints.

Do not begin by drawing components.

## Step 2 --- Identify the Carbon solution

Search Carbon documentation before designing.

Determine:

-   component;
-   variant;
-   size;
-   state;
-   usage rule;
-   accessibility behavior;
-   responsive behavior;
-   content rule.

## Step 3 --- Compose the screen

Build the experience from Carbon primitives and components.

## Step 4 --- Define all states

Every interactive component must consider:

-   default;
-   hover;
-   focus;
-   active;
-   selected;
-   disabled;
-   read-only;
-   loading;
-   error;
-   warning;
-   success;
-   empty;
-   overflow;
-   responsive/reflow.

Only states relevant to a component need to be implemented, but they
must be explicitly considered.

## Step 5 --- Validate accessibility

At minimum:

-   keyboard navigation;
-   visible focus;
-   logical focus order;
-   semantic labels;
-   contrast;
-   screen-reader meaning;
-   error communication;
-   state communication.

Carbon's accessibility guidance is based around WCAG/IBM accessibility
practices.

## Step 6 --- Validate against existing FABRIX UI

Ask:

-   Does another module solve the same problem differently?
-   Is there already a component for this?
-   Is the same Carbon component configured consistently?
-   Are spacing and typography consistent?
-   Are interaction states consistent?

If inconsistent, fix the system rather than creating another exception.

------------------------------------------------------------------------

# 6. DESIGN TOKENS ARE MANDATORY

Tokens are the foundation of FABRIX visual consistency.

Do not hard-code visual values when a Carbon token exists.

## 6.1 Color

Use semantic Carbon color tokens.

Do not choose colors based on:

-   personal preference;
-   screenshot sampling;
-   random hex values;
-   "looks better";
-   copied colors from another SaaS.

Color must have a semantic role.

Typical roles include:

-   background;
-   layer;
-   field;
-   border;
-   text;
-   link;
-   icon;
-   support;
-   focus;
-   interactive;
-   overlay.

Carbon documentation distinguishes core tokens from component-specific
tokens. Component tokens must only be used for their intended component.

### Forbidden

``` text
#123456
#F5F5F5
rgba(...)
random blue
random gray
```

when a Carbon token already represents the intended role.

### Rule

> Never ask "what color should this be?" first. Ask "what semantic role
> does this color represent?"

------------------------------------------------------------------------

# 7. TYPOGRAPHY

FABRIX typography must use Carbon typography/type tokens.

Do not create arbitrary:

-   font sizes;
-   font weights;
-   line heights;
-   letter spacing;
-   heading styles.

Typography must communicate hierarchy.

Use typography consistently for:

-   page title;
-   section heading;
-   subsection;
-   body;
-   labels;
-   helper text;
-   captions;
-   data values;
-   table content;
-   status;
-   metadata.

### ERP/MANUFACTURING RULE

Dense information does not justify arbitrary typography.

If a screen contains large amounts of manufacturing data:

-   use the correct Carbon type scale;
-   use hierarchy;
-   use spacing;
-   use progressive disclosure;
-   use tables/data structures;
-   use filtering;
-   use tabs;
-   use drawers;
-   use expandable sections.

Do not solve density by shrinking everything into unreadable text.

------------------------------------------------------------------------

# 8. SPACING

Spacing must use Carbon spacing tokens.

Never invent:

-   7px;
-   11px;
-   13px;
-   18px;
-   22px;
-   27px;

unless the exact value is part of an approved Carbon token/API
requirement.

Spacing must communicate relationships.

Use tighter spacing for:

-   label → input;
-   icon → label;
-   related metadata.

Use larger spacing for:

-   section separation;
-   major content groups;
-   page-level hierarchy.

### Core rule

> Consistent spacing is more important than individually optimized
> spacing.

------------------------------------------------------------------------

# 9. GRID AND LAYOUT

Use Carbon's grid/layout principles.

Do not position major UI elements using arbitrary pixel coordinates.

Screens must be structured using:

-   application shell;
-   grid;
-   columns;
-   responsive breakpoints;
-   spacing tokens;
-   layout primitives.

For desktop-heavy ERP screens, density is allowed, but it must remain
structured.

### Do not create:

-   random floating panels;
-   arbitrary absolute-position layouts;
-   inconsistent page gutters;
-   random card widths;
-   random content widths.

------------------------------------------------------------------------

# 10. ICONOGRAPHY

Use Carbon icons wherever an appropriate icon exists.

Do not:

-   substitute emojis;
-   use random icon libraries;
-   mix multiple icon visual styles;
-   redraw Carbon icons;
-   use icons merely for decoration.

Icons must communicate meaning.

If an icon represents an action, its behavior must follow the Carbon
interaction model.

Icon-only buttons require an accessible label and appropriate
tooltip/label behavior where applicable.

------------------------------------------------------------------------

# 11. BUTTON RULES

Buttons are actions.

Do not use buttons for navigation when a link is semantically correct.

Before adding a button determine:

-   action type;
-   priority;
-   destructive/non-destructive;
-   primary/secondary/tertiary/ghost/danger as appropriate;
-   size;
-   icon usage;
-   disabled state;
-   loading state.

### Primary action

Use for the main action of a context.

Examples:

-   Create Work Order
-   Release Order
-   Submit
-   Save

Do not place multiple competing primary actions in the same context
without strong justification.

### Secondary action

Use for important but non-primary actions.

### Tertiary/Ghost

Use for lower-emphasis actions.

### Danger

Use only for destructive or high-risk actions.

Do not make an action red simply because it is important.

------------------------------------------------------------------------

# 12. LINKS

Use Carbon Link for navigation and references.

A link should communicate navigation/reference semantics.

Avoid:

-   making text look like a button when it navigates;
-   generic "Click here";
-   ambiguous "Read more".

Link context must be understandable.

------------------------------------------------------------------------

# 13. INPUTS

All data entry must use the appropriate Carbon input component.

Applicable examples:

-   Text Input;
-   Number Input;
-   Text Area;
-   Search;
-   Select;
-   Combo Box;
-   Multi Select;
-   Date Picker;
-   Time Picker;
-   Checkbox;
-   Radio Button;
-   Toggle;
-   Slider.

Do not create custom input chrome.

Every input must define:

-   label;
-   required/optional status;
-   helper text if necessary;
-   validation;
-   error state;
-   disabled/read-only state;
-   accessible name;
-   appropriate keyboard behavior.

### Manufacturing example

For:

`Planned Quantity`

do not create a custom HTML number field because "ERP users need
something compact."

Use Carbon Number Input and configure it appropriately.

------------------------------------------------------------------------

# 14. SELECT VS COMBO BOX VS SEARCH

Do not choose components by visual preference.

### Select

Use when users choose from a relatively known set of options.

### Combo Box

Use when users may search/type to find an option.

### Multi Select

Use when multiple values can be selected.

### Search

Use for information retrieval rather than simply selecting a form
option.

### Rule

The component must match the user's mental task.

------------------------------------------------------------------------

# 15. FORMS

Forms must be structured by user workflow, not database schema.

Bad:

``` text
field_1
field_2
field_3
field_4
field_5
field_6
...
```

Good:

``` text
Order Information
Material
Quantity
Schedule

Production Configuration
BOM
Routing
Work Center

Planning
Priority
Requested Date
Production Date
```

Group fields by user intent.

Use progressive disclosure for advanced fields.

Do not expose every ERP database field by default.

------------------------------------------------------------------------

# 16. DATA TABLES

Tables are critical to manufacturing SaaS.

Do not build custom tables without first determining whether Carbon Data
Table / related Carbon data patterns solve the problem.

A table must define:

-   column hierarchy;
-   alignment;
-   sorting;
-   filtering;
-   selection;
-   pagination;
-   density;
-   row actions;
-   empty state;
-   loading state;
-   error state;
-   overflow;
-   responsive behavior;
-   keyboard behavior.

### Numeric alignment

Numeric data should generally be aligned consistently for comparison.

Examples:

-   quantities;
-   cost;
-   stock;
-   lead time;
-   percentages.

### Status

Use Carbon status mechanisms such as Tags where appropriate.

Do not use arbitrary colored pills.

------------------------------------------------------------------------

# 17. DENSE MANUFACTURING TABLES

FABRIX will frequently display:

-   SKU;
-   material;
-   quantity;
-   UOM;
-   planned date;
-   due date;
-   status;
-   work center;
-   lead time;
-   stock;
-   shortage;
-   capacity;
-   variance.

Density is acceptable.

Visual chaos is not.

Use:

-   consistent row height;
-   hierarchy;
-   correct typography;
-   semantic color;
-   column prioritization;
-   sticky behavior only when justified;
-   filtering;
-   sorting;
-   grouping;
-   pagination/virtualization where necessary.

Do not reduce font size below the Carbon type system merely to fit more
columns.

------------------------------------------------------------------------

# 18. TAGS / STATUS

Tags communicate classification or status.

Use semantic states consistently.

Example:

``` text
Draft
Planned
Released
In Progress
Completed
Blocked
Cancelled
```

FABRIX must define a global status vocabulary.

The same status must not appear:

-   green in one module;
-   blue in another;
-   yellow in another;
-   as a badge elsewhere.

Create one status mapping.

Example conceptual mapping:

``` text
Success → completed / healthy
Warning → attention required
Error → failure / blocked
Information → informational state
Neutral → draft / inactive
```

The exact Carbon token must be used rather than arbitrary colors.

------------------------------------------------------------------------

# 19. NOTIFICATIONS

Use Carbon notification patterns.

Differentiate:

-   inline notification;
-   toast;
-   modal confirmation;
-   system alert.

Do not use toast notifications for information the user must retain
while working.

Do not use modals for simple informational messages.

Do not interrupt users unnecessarily.

------------------------------------------------------------------------

# 20. MODALS

A modal interrupts the current workflow.

Use it only when interruption is justified.

Good examples:

-   destructive confirmation;
-   important decision;
-   focused short task;
-   required confirmation.

Bad examples:

-   long forms;
-   complete ERP records;
-   large tables;
-   complex workflows;
-   information that should be a page/drawer.

For complex contextual editing, prefer a page or side panel/drawer where
Carbon supports the pattern.

------------------------------------------------------------------------

# 21. DRAWERS / SIDE PANELS

Use drawers for contextual work where users need to inspect or edit
something without losing the current context.

Examples:

-   Work Order details;
-   Material details;
-   MRP exception details;
-   Inventory movement details.

The drawer must not become a "second application."

Keep hierarchy clear.

------------------------------------------------------------------------

# 22. TOOLTIP

Tooltips are supplemental.

Do not put essential information exclusively in a tooltip.

Do not use tooltips for:

-   long explanations;
-   required instructions;
-   error messages;
-   critical business rules.

Tooltips are particularly appropriate for icon-only controls when
additional context is necessary.

------------------------------------------------------------------------

# 23. POPOVER

Use popovers for contextual information or lightweight interaction.

Do not use a popover as a substitute for:

-   a full page;
-   a modal;
-   a drawer;
-   a form that requires significant attention.

------------------------------------------------------------------------

# 24. SEARCH

Search is a first-class ERP interaction.

FABRIX may require:

-   global search;
-   module search;
-   table filtering;
-   SKU/material search;
-   customer search;
-   work order search.

Do not make every search experience visually different.

Search behavior must be predictable across modules.

------------------------------------------------------------------------

# 25. DATE AND TIME

Manufacturing systems are highly date/time dependent.

Use Carbon date/time components.

Always define:

-   date format;
-   timezone behavior;
-   locale behavior;
-   range behavior;
-   validation;
-   disabled dates;
-   keyboard interaction.

Do not invent date picker visuals.

------------------------------------------------------------------------

# 26. LOADING STATES

Loading must be intentional.

Use Carbon loading/skeleton/progress patterns where appropriate.

Different situations require different feedback:

### Skeleton

Use when the structure of the content is known.

### Progress

Use when meaningful progress can be communicated.

### Spinner/loading indicator

Use for short indeterminate operations.

Never leave users wondering whether the application is frozen.

------------------------------------------------------------------------

# 27. EMPTY STATES

Every major data view must define an empty state.

Example:

``` text
No production orders found.

Try changing your filters or create a new production order.
```

Empty state must explain:

1.  what is empty;
2.  why it may be empty;
3.  what the user can do next.

Do not create decorative empty-state illustrations unless there is a
clear UX reason.

------------------------------------------------------------------------

# 28. ERROR STATES

Errors must be actionable.

Bad:

``` text
Error 500
```

Better:

``` text
Production order could not be released.

The selected material has insufficient available stock.

Review material availability before releasing the order.
```

Error communication must distinguish:

-   validation error;
-   business rule error;
-   system error;
-   network error;
-   permission error.

------------------------------------------------------------------------

# 29. DESTRUCTIVE ACTIONS

High-risk manufacturing actions require deliberate UX.

Examples:

-   Cancel Work Order;
-   Delete BOM;
-   Close Production Order;
-   Remove routing operation;
-   Approve irreversible transaction.

Use Carbon danger/destructive patterns.

Confirmation must communicate:

-   what will happen;
-   what object is affected;
-   whether the action can be undone.

Never ask:

> "Are you sure?"

without context.

------------------------------------------------------------------------

# 30. ACCESSIBILITY IS NOT OPTIONAL

FABRIX follows Carbon accessibility principles.

Minimum requirements:

-   keyboard accessibility;
-   visible focus;
-   logical focus order;
-   semantic HTML;
-   accessible labels;
-   meaningful names;
-   sufficient contrast;
-   screen-reader compatibility;
-   correct state announcements;
-   error identification;
-   no keyboard traps.

Carbon documents accessibility around WCAG and IBM accessibility
practices.

For critical custom components, test:

1.  automated accessibility;
2.  keyboard interaction;
3.  screen reader behavior.

------------------------------------------------------------------------

# 31. RESPONSIVE DESIGN

FABRIX is desktop-first because manufacturing applications are commonly
used on large screens, but desktop-first does not mean desktop-only.

Design behavior must be defined for:

-   large desktop;
-   standard desktop;
-   tablet;
-   narrow viewport where applicable.

Do not simply shrink desktop UI.

Define:

-   what disappears;
-   what collapses;
-   what becomes scrollable;
-   what reflows;
-   what becomes a drawer;
-   what remains persistent.

------------------------------------------------------------------------

# 32. RESPONSIVE TABLE RULE

Never force every table column to remain visible on small screens.

Prioritize:

1.  identity;
2.  status;
3.  primary value;
4.  primary action.

Secondary information may:

-   collapse;
-   move into details;
-   become horizontally scrollable;
-   become a responsive detail view.

------------------------------------------------------------------------

# 33. APPLICATION SHELL

The application shell must be consistent across FABRIX.

It should define:

-   global navigation;
-   module navigation;
-   page title;
-   breadcrumb/context where appropriate;
-   user/account area;
-   notification area;
-   content region.

Do not allow each module to invent its own shell.

------------------------------------------------------------------------

# 34. NAVIGATION

Navigation must reflect the user's mental model.

For manufacturing:

``` text
Planning
  Demand
  MPS
  MRP
  Capacity
  APS

Manufacturing
  Production Orders
  Shop Floor
  Work Centers

Inventory
  Stock
  Movements
  Warehouse

Purchasing
  Purchase Requisitions
  Purchase Orders
  Suppliers
```

The exact information architecture may evolve, but the interaction model
must remain consistent.

------------------------------------------------------------------------

# 35. BREADCRUMBS

Use breadcrumbs where hierarchical context is valuable.

Do not add breadcrumbs merely because the screen exists several levels
deep.

Breadcrumbs should communicate:

> Where am I?

They should not replace navigation.

------------------------------------------------------------------------

# 36. TABS

Tabs represent related views at the same hierarchy level.

Good:

``` text
Overview | Materials | Operations | Quality | History
```

Bad:

``` text
Dashboard | Create Order | Delete | Settings
```

Do not use tabs as a general-purpose navigation mechanism.

------------------------------------------------------------------------

# 37. ACCORDIONS

Use accordions when users may need to expand/collapse related
information.

Do not hide critical information by default simply to make a page look
cleaner.

------------------------------------------------------------------------

# 38. CARDS / TILES

Cards are not the default answer for everything.

Do not create a dashboard where every piece of information is a card.

Use cards/tiles when they represent meaningful independent content or
actions.

For dense operational data, tables and structured layouts are often
superior.

------------------------------------------------------------------------

# 39. DASHBOARDS

FABRIX dashboards must prioritize decisions, not decoration.

A dashboard should answer:

-   What requires attention?
-   What changed?
-   What is at risk?
-   What action should I take?

Manufacturing dashboard examples:

``` text
Production Output
Plan vs Actual
Material Shortage
Capacity Utilization
Late Orders
Quality Issues
Maintenance Due
```

Avoid:

-   decorative charts;
-   unnecessary gradients;
-   excessive colors;
-   giant numbers without context;
-   visual noise.

------------------------------------------------------------------------

# 40. DATA VISUALIZATION

Charts must follow the same design principles as the rest of the system.

Use semantic color.

Do not use color merely for decoration.

Every chart should have:

-   title;
-   meaningful units;
-   understandable axes;
-   readable labels;
-   accessible interpretation;
-   empty state;
-   loading state;
-   error state.

------------------------------------------------------------------------

# 41. FABRIX DOMAIN COMPONENT RULE

When a domain-specific UI is required, use this structure:

``` text
FABRIX Domain Pattern
    ↓
Carbon Layout
    ↓
Carbon Components
    ↓
Carbon Tokens
    ↓
Carbon Interaction Rules
    ↓
Carbon Accessibility Rules
```

Example:

``` text
MRP Exception Workspace
    ├── Carbon Data Table
    ├── Carbon Tag
    ├── Carbon Button
    ├── Carbon Search
    ├── Carbon Filter
    ├── Carbon Pagination
    └── Carbon Side Panel
```

The workspace is custom.

The building blocks remain Carbon.

------------------------------------------------------------------------

# 42. CUSTOM COMPONENT GOVERNANCE

A custom component must not be created without a documented reason.

Required specification:

``` text
Component name:
Problem solved:
Why Carbon components are insufficient:
User:
Primary use case:
Variants:
States:
Keyboard behavior:
Accessibility:
Responsive behavior:
Tokens used:
Existing Carbon components composed:
Why custom behavior is required:
```

A custom component without this information is rejected.

------------------------------------------------------------------------

# 43. "CARBON WRAPPER" RULE

If FABRIX creates a custom domain component, it should behave like a
Carbon-native component.

Example:

`ProductionStatusIndicator`

It may be custom because the manufacturing domain requires a specific
semantic combination.

But it must still use:

-   Carbon typography;
-   Carbon color tokens;
-   Carbon spacing tokens;
-   Carbon iconography;
-   Carbon focus behavior;
-   Carbon interaction conventions;
-   Carbon accessibility principles.

------------------------------------------------------------------------

# 44. DO NOT MODIFY CARBON VISUALLY WITHOUT REASON

Avoid overriding Carbon styles simply to match an existing screen.

Bad approach:

``` text
Carbon Button
→ custom border radius
→ custom height
→ custom font
→ custom shadow
→ custom color
```

This destroys system consistency.

Preferred:

``` text
Carbon Button
→ supported variant
→ supported size
→ correct token/theme
```

------------------------------------------------------------------------

# 45. COMPONENT STATES MUST BE COMPLETE

A component specification is incomplete if it only shows the happy path.

For each relevant interactive component document:

``` text
Default
Hover
Focus
Active
Selected
Disabled
Loading
Error
Warning
Read-only
```

Not every component needs every state, but every applicable state must
be handled.

------------------------------------------------------------------------

# 46. CONTENT DESIGN

UX consistency includes language.

FABRIX UI copy should be:

-   concise;
-   explicit;
-   action-oriented;
-   predictable;
-   domain-appropriate.

Avoid:

``` text
Oops!
Something went wrong.
Click here.
```

Prefer:

``` text
Unable to release work order.
```

Actions should use verbs:

``` text
Create
Save
Release
Approve
Cancel
Delete
Export
Import
Retry
```

------------------------------------------------------------------------

# 47. ERP / MANUFACTURING UX PRINCIPLES

Carbon governs the visual and interaction system.

Manufacturing domain rules govern the information architecture.

FABRIX must optimize for:

-   operational clarity;
-   high information density;
-   low cognitive load;
-   fast repetitive workflows;
-   keyboard efficiency;
-   traceability;
-   error prevention;
-   exception handling;
-   auditability;
-   predictable navigation.

Do not make the ERP "pretty" at the expense of productivity.

------------------------------------------------------------------------

# 48. KEYBOARD-FIRST ERP PRINCIPLE

Power users must be considered first-class users.

Where Carbon supports keyboard interaction, preserve it.

Examples:

-   tab navigation;
-   enter/space activation;
-   escape to close contextual UI;
-   keyboard selection;
-   accessible table interaction.

Never remove keyboard accessibility to simplify implementation.

------------------------------------------------------------------------

# 49. PERFORMANCE AND UX

UI architecture must consider:

-   large datasets;
-   pagination;
-   virtualization;
-   lazy loading;
-   progressive rendering;
-   skeleton states;
-   network failures.

A visually correct interface that freezes with 50,000 inventory rows is
not acceptable UX.

------------------------------------------------------------------------

# 50. DESIGN REVIEW CHECKLIST

Before approving any screen:

### Carbon compliance

-   [ ] Carbon component used where available.
-   [ ] Carbon usage guidance checked.
-   [ ] Carbon tokens used.
-   [ ] No arbitrary colors.
-   [ ] No arbitrary typography.
-   [ ] No arbitrary spacing.
-   [ ] No unnecessary custom components.
-   [ ] Icons follow Carbon.
-   [ ] Interaction patterns follow Carbon.

### UX

-   [ ] User goal is clear.
-   [ ] Primary action is clear.
-   [ ] Navigation is consistent.
-   [ ] Information hierarchy is clear.
-   [ ] Form structure follows user workflow.
-   [ ] Error handling exists.
-   [ ] Empty state exists.
-   [ ] Loading state exists.
-   [ ] Destructive actions are protected.

### Accessibility

-   [ ] Keyboard navigation works.
-   [ ] Focus is visible.
-   [ ] Focus order is logical.
-   [ ] Labels are meaningful.
-   [ ] Contrast is acceptable.
-   [ ] Screen-reader semantics are considered.
-   [ ] Interactive states are accessible.

### Responsive

-   [ ] Desktop behavior defined.
-   [ ] Narrow viewport behavior defined.
-   [ ] Tables have responsive strategy.
-   [ ] Drawers/modals behave correctly.
-   [ ] No content is accidentally clipped.

------------------------------------------------------------------------

# 51. CLAUDE CHAT FABLE 5 --- CONSULTANT INSTRUCTION

Claude Chat Fable 5 acts as the **UX/UI consultant and governance
reviewer**.

It must NOT immediately propose custom UI.

For every UI/UX request, Fable 5 must perform:

### Phase A --- Understand

Identify:

-   user;
-   task;
-   workflow;
-   business objective;
-   data;
-   actions;
-   risks.

### Phase B --- Carbon Mapping

Map every proposed UI element to Carbon.

Example:

``` text
Requirement:
Select Work Center

Carbon mapping:
Combo Box

Reason:
Users may search a potentially large list of work centers.
```

### Phase C --- Pattern Definition

Define:

-   layout;
-   components;
-   variants;
-   states;
-   interactions;
-   accessibility;
-   responsive behavior.

### Phase D --- Consistency Check

Compare with existing FABRIX patterns.

Flag:

``` text
CONFLICT
Existing screen uses custom dropdown.
Carbon equivalent: Combo Box.
Recommendation: migrate existing screen.
```

### Phase E --- Execution Specification

Produce a clear implementation instruction for Claude Code Opus.

Fable 5 must distinguish:

``` text
MUST
SHOULD
MAY
FORBIDDEN
```

------------------------------------------------------------------------

# 52. CLAUDE CODE OPUS --- INSTRUCTOR INSTRUCTION

Claude Code Opus acts as the **implementation architect/instructor**.

It receives the consultant specification and converts it into executable
technical instructions.

Responsibilities:

1.  inspect existing implementation;
2.  identify current Carbon usage;
3.  identify deviations;
4.  identify reusable components;
5.  define implementation sequence;
6.  prevent duplicate components;
7.  enforce token usage;
8.  enforce accessibility;
9.  define acceptance criteria.

Opus must not translate vague design language directly into arbitrary
CSS.

Example:

Bad:

``` text
Make the button look more modern.
```

Good:

``` text
Use the Carbon Button component.
Use the approved variant and size.
Do not introduce custom border radius, shadow, typography, or color.
Implement disabled, focus, hover, active, and loading states where applicable.
```

------------------------------------------------------------------------

# 53. CLAUDE CODE --- EXECUTOR INSTRUCTION

Claude Code is the **executor**.

It must follow the hierarchy:

``` text
Carbon
  ↓
FABRIX Design Governance
  ↓
Claude Chat specification
  ↓
Claude Code Opus implementation instruction
  ↓
Code
```

Claude Code must not reinterpret design decisions independently.

If an implementation request conflicts with Carbon:

``` text
STOP
REPORT CONFLICT
PROPOSE CARBON-COMPLIANT SOLUTION
WAIT FOR RESOLUTION IF REQUIRED
```

Do not silently introduce a custom solution.

------------------------------------------------------------------------

# 54. CLAUDE CODE --- FORBIDDEN BEHAVIOR

Claude Code must never:

-   invent a new button;
-   invent a new input;
-   invent a new modal;
-   invent arbitrary card styles;
-   invent arbitrary spacing;
-   invent arbitrary colors;
-   install another UI framework merely to solve a visual problem;
-   mix component libraries without explicit architectural approval;
-   copy UI patterns from competitors without mapping them to Carbon;
-   reproduce an existing inconsistent FABRIX screen simply because it
    already exists;
-   use inline styles to bypass the design system;
-   introduce magic numbers for visual styling when a token exists.

------------------------------------------------------------------------

# 55. LEGACY UI REMEDIATION

FABRIX is already approximately 20% developed and contains
inconsistencies.

Do not treat the current UI as the design baseline.

The remediation process is:

``` text
Audit
  ↓
Classify
  ↓
Map to Carbon
  ↓
Define canonical component
  ↓
Refactor
  ↓
Validate
  ↓
Freeze the pattern
```

Classify inconsistencies as:

### A --- Visual inconsistency

Examples:

-   different button heights;
-   different colors;
-   different spacing.

### B --- Component inconsistency

Examples:

-   two different dropdown implementations.

### C --- Interaction inconsistency

Examples:

-   one module opens details in a modal;
-   another opens a drawer.

### D --- UX inconsistency

Examples:

-   different ways of filtering;
-   different save behavior.

### E --- Accessibility issue

Examples:

-   missing focus;
-   insufficient contrast;
-   keyboard trap.

Priority:

``` text
Accessibility
↓
Interaction
↓
Component
↓
Visual
```

------------------------------------------------------------------------

# 56. DESIGN DEBT REGISTER

Create and maintain:

``` text
FABRIX Design Debt Register
```

Each item:

``` text
ID:
Screen:
Module:
Problem:
Category:
Carbon equivalent:
Current implementation:
Target implementation:
Priority:
Effort:
Status:
```

Example:

``` text
DS-001
Module: Inventory
Problem: Custom dropdown
Category: Component inconsistency
Carbon equivalent: Combo Box
Priority: High
Status: Planned
```

------------------------------------------------------------------------

# 57. CANONICAL COMPONENT LIBRARY

FABRIX must maintain a canonical mapping.

Example:

  FABRIX Need            Canonical Carbon Solution
  ---------------------- ----------------------------------------------
  Primary action         Carbon Button
  Secondary action       Carbon Button
  Navigation             Carbon Link
  Text entry             Carbon Text Input
  Numeric entry          Carbon Number Input
  Long text              Carbon Text Area
  Single selection       Carbon Select
  Searchable selection   Carbon Combo Box
  Multi-selection        Carbon Multi Select
  Search                 Carbon Search
  Date                   Carbon Date Picker
  Toggle state           Carbon Toggle
  Boolean choice         Carbon Checkbox
  Exclusive choice       Carbon Radio Button
  Status                 Carbon Tag
  Contextual help        Carbon Tooltip
  Contextual content     Carbon Popover
  Confirmation           Carbon Modal
  Contextual editing     Carbon Side Panel/appropriate Carbon pattern
  Navigation hierarchy   Carbon Breadcrumb
  Page sections          Carbon Tabs where appropriate
  Data                   Carbon Data Table / appropriate data pattern
  Loading                Carbon Loading/Skeleton
  Progress               Carbon Progress Indicator
  Notification           Carbon Notification
  Pagination             Carbon Pagination

This table is a starting governance map. Always verify the current
Carbon documentation and exact component capabilities before
implementation.

------------------------------------------------------------------------

# 58. COMPONENT SELECTION DECISION TREE

When building UI:

``` text
Does Carbon have this component?
        |
       YES
        ↓
Use Carbon
        |
       NO
        ↓
Can the requirement be composed
from Carbon components?
        |
       YES
        ↓
Compose Carbon
        |
       NO
        ↓
Is the requirement domain-specific?
        |
       YES
        ↓
Create FABRIX domain pattern
using Carbon foundations
        |
       NO
        ↓
Re-evaluate requirement
```

Never jump directly from requirement to custom component.

------------------------------------------------------------------------

# 59. DESIGN SYSTEM CHANGE CONTROL

Once a FABRIX component/pattern becomes canonical, changing it requires
impact analysis.

Check:

-   screens affected;
-   modules affected;
-   workflows affected;
-   accessibility;
-   responsive behavior;
-   developer implementation;
-   documentation;
-   regression risk.

Do not create local overrides to avoid updating the canonical component.

------------------------------------------------------------------------

# 60. "ONE PROBLEM = ONE CANONICAL SOLUTION"

If five modules have the same problem, they should normally use one
canonical solution.

Example:

If all modules need:

``` text
Filter by status
```

do not allow:

``` text
Inventory → dropdown
Production → segmented buttons
Purchasing → custom popover
Quality → custom chips
```

unless there is a legitimate UX reason.

The default is one consistent interaction model.

------------------------------------------------------------------------

# 61. ACCEPTANCE CRITERIA FOR UI

A UI feature is not complete until:

``` text
[ ] Carbon mapping completed
[ ] Carbon usage guidance reviewed
[ ] Component variants defined
[ ] Relevant states defined
[ ] Accessibility reviewed
[ ] Responsive behavior defined
[ ] Loading state defined
[ ] Empty state defined
[ ] Error state defined
[ ] Destructive actions reviewed
[ ] Existing FABRIX patterns checked
[ ] No unnecessary custom component
[ ] No arbitrary visual values
[ ] Implementation matches specification
```

------------------------------------------------------------------------

# 62. DEFINITION OF DONE

A UI feature is **DONE** only when:

1.  UX objective is satisfied.
2.  Carbon usage is correct.
3.  Visual implementation uses Carbon tokens.
4.  Component behavior follows Carbon.
5.  Accessibility is addressed.
6.  Responsive behavior is addressed.
7.  All relevant states exist.
8.  Existing FABRIX patterns remain consistent.
9.  No duplicate component was created unnecessarily.
10. Code and UI match the specification.

------------------------------------------------------------------------

# 63. FINAL COMMAND FOR ALL THREE CLAUDE ROLES

The following rule is mandatory:

> DO NOT DESIGN FROM MEMORY.

Before deciding how a Carbon component should behave, consult the
current Carbon documentation.

Before creating a custom component, prove that Carbon cannot satisfy the
requirement.

Before implementing a new pattern, check whether FABRIX already has an
equivalent pattern.

Before modifying existing UI, check whether the existing UI violates
this governance document.

When uncertain:

``` text
CHECK CARBON
→ CHECK FABRIX CANONICAL PATTERN
→ CHECK ACCESSIBILITY
→ THEN IMPLEMENT
```

------------------------------------------------------------------------

# 64. MASTER SYSTEM PROMPT

The following text may be used as the shared instruction for the FABRIX
AI development workflow:

``` text
You are working on FABRIX, a manufacturing-focused SaaS / manufacturing operating system.

IBM Carbon Design System is the mandatory foundation for all UI and UX.

Carbon is not a visual reference. Carbon is the governing design system.

For every UI/UX decision:

1. Check whether Carbon already provides the required component or pattern.
2. Follow Carbon's official usage guidance.
3. Use Carbon design tokens for color, typography, spacing, layering, borders, focus, and interaction.
4. Do not invent arbitrary visual values when Carbon provides a token.
5. Do not create custom components when a Carbon component is sufficient.
6. If Carbon does not provide the required solution, compose existing Carbon components first.
7. Only create a custom FABRIX component when the requirement is genuinely domain-specific or Carbon cannot satisfy it.
8. Custom FABRIX components must visually and behaviorally inherit Carbon principles.
9. Every interactive UI must account for applicable hover, focus, active, selected, disabled, loading, error, warning, and read-only states.
10. Accessibility is mandatory.
11. Keyboard navigation and visible focus are mandatory.
12. Responsive behavior must be defined.
13. Loading, empty, and error states must be designed.
14. Do not copy inconsistent legacy FABRIX UI merely because it already exists.
15. Treat existing inconsistencies as design debt and migrate them toward the canonical Carbon-based solution.
16. Do not introduce another UI component library without explicit architectural approval.
17. Do not use arbitrary colors, spacing, typography, shadows, borders, or radii when Carbon provides the appropriate system value.
18. Do not use emoji or unrelated icon libraries when an appropriate Carbon icon exists.
19. Optimize ERP UX for clarity, information density, operational speed, error prevention, traceability, and keyboard efficiency.
20. If a request conflicts with Carbon, report the conflict and propose the Carbon-compliant solution rather than silently improvising.

Always follow:

CARBON
→ FABRIX DESIGN GOVERNANCE
→ CANONICAL FABRIX PATTERN
→ IMPLEMENTATION SPECIFICATION
→ CODE

Never:

REQUEST
→ PERSONAL DESIGN PREFERENCE
→ ARBITRARY CSS
→ CODE
```

------------------------------------------------------------------------

# 65. OFFICIAL REFERENCES

Primary reference:

https://carbondesignsystem.com/

Carbon getting started:

https://carbondesignsystem.com/designing/get-started/

Carbon components:

https://carbondesignsystem.com/components/

Carbon foundations:

https://carbondesignsystem.com/elements/

Carbon accessibility:

https://carbondesignsystem.com/guidelines/accessibility/

Carbon component checklist / definition of done:

https://carbondesignsystem.com/contributing/component-checklist/

------------------------------------------------------------------------

# 66. GOVERNANCE PRINCIPLE

FABRIX must ultimately feel like **one product**, even when it contains
dozens of manufacturing modules.

The user should never feel:

> "This screen was made by a different developer."

The user should feel:

> "This is FABRIX."

That consistency comes from enforcing the system at every level:

``` text
DESIGN LANGUAGE
      ↓
TOKENS
      ↓
COMPONENTS
      ↓
PATTERNS
      ↓
MODULES
      ↓
WORKFLOWS
      ↓
ENTIRE FABRIX PRODUCT
```

**Carbon is the foundation.\
FABRIX patterns are the domain layer.\
Consistency is the product standard.**
