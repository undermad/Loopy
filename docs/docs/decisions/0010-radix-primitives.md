---
description: Radix Primitives for interactive widgets.
---

# 0010 Radix Primitives for interactive widgets

## Context

Dialogs, menus, tooltips and popovers need correct keyboard and screen reader behaviour, which is expensive to write and easy to break.

## Decision

Radix Primitives, unstyled, styled with SCSS Modules. `lucide-react` for icons.

## Consequences

Each primitive is a separate package added when first used. React Aria remains an option for data-heavy widgets such as tables and trees.
