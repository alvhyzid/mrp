# FABRIX Carbon Reference

## 1. Authority

IBM Carbon Design System is the UI design authority for FABRIX.

Official site:
https://carbondesignsystem.com/

Carbon's component documentation is structured around:

- Usage
- Style
- Code
- Accessibility

Patterns describe reusable combinations of components and templates that address common user objectives through sequences and flows.

## 2. What FABRIX adopts directly

FABRIX should use Carbon guidance for:

- foundations
- grid and layout
- typography
- color
- spacing
- icons
- components
- component states
- interaction behavior
- forms
- dialogs
- data tables
- search
- filtering
- notifications
- loading
- navigation
- accessibility
- responsive behavior
- content/UX guidance where Carbon provides it

## 3. Component-first principle

Before creating a UI component:

1. Search Carbon for an existing component.
2. Check Carbon Usage guidance.
3. Check Carbon Style guidance.
4. Check Carbon Code guidance for the project's framework/version.
5. Check Carbon Accessibility guidance.
6. Only then consider a custom component.

A custom component must have a documented reason.

## 4. Pattern-first principle

A Carbon component solves a UI problem.

A Carbon pattern addresses a larger user objective or flow.

Therefore, when a UX problem appears, do not jump directly to a component.

Ask:

- What is the user's objective?
- Is there an existing Carbon pattern?
- Which Carbon components compose that pattern?
- Is the current interaction unnecessarily interruptive?
- Is the information hierarchy appropriate?

## 5. Current component landscape

The current official Carbon component overview includes components such as:

Accordion, Breadcrumb, Button, Checkbox, Code snippet, Contained list, Content switcher, Data table, Date picker, Dropdown, File uploader, Form, Inline loading, Link, List, Loading, Menu, Menu buttons/Overflow menu, Modal, Multiselect, Notification, Number input, Pagination, Popover, Progress bar, Progress indicator, Radio button, Search, Select, Slider, Structured list, Tabs, Tag, Text input, Toggle, Toggletip, Tooltip, and others.

Do not treat this list as permanent. Verify the current official documentation and project package version.

## 6. Feature flags and version awareness

Carbon currently has feature-flagged changes for some components, including Menu buttons/Overflow menu, Modal, Notification, Structured list, Tile, Toggle, and Tree view.

Do not enable or disable a Carbon feature flag merely for visual preference. Verify the project's installed Carbon version and the official migration/feature-flag guidance first.

## 7. Accessibility

Carbon accessibility guidance is part of component governance.

Audit:

- keyboard interaction
- focus management
- labels
- descriptions
- semantic structure
- screen-reader behavior
- color/contrast
- state communication
- error communication
- non-color alternatives

Do not assume that using a Carbon component automatically makes the surrounding composition accessible. Composition, labels, content, focus order, and custom behavior still require review.

## 8. Version rule

Never assume the latest Carbon documentation exactly matches the installed package.

Claude Code must report:

- installed Carbon package/version
- framework
- relevant Carbon packages
- feature flags in use
- custom wrappers
- local overrides

When a version conflict exists, the repository's installed version governs implementation until an explicit upgrade decision is made.
