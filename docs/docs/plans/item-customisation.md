---
sidebar_position: 5
description: Richer card fields, card styling, a reordered Properties panel and new board item kinds, with the model and phases.
---

# Item and card customisation

:::note Status
Implemented on one branch. [Cards](../cards.md) and [Board](../board.md) describe what ships; this page keeps the reasoning and what was left out.
:::

## Goals

1. More card field kinds, grouped so the right one is easy to find.
2. Settings every field shares: help text, hidden on the card face, a zone and a visibility rule.
3. Card-level styling: size presets, background image and gradient, accent placement, font and an accent taken from a choice.
4. One property order everywhere, collapsible sections and basic settings before advanced ones.
5. Editing several board items at once, style presets, and copy and paste of a style.
6. New board item kinds: icon, checklist, table and embed.

## Principles

| Principle                  | In practice                                                                                                          |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| One definition per kind    | A field kind or item kind is one entry in a typed map; a missing view or setting is a type error                     |
| One property order         | Identity, content, layout, appearance, typography, behaviour                                                         |
| Basics first               | Each section shows the common settings; the rest sit behind More                                                     |
| Lenient read, strict write | Old fields parse into the new shape; values that no longer fit fall back to the default                              |
| No `eval`                  | Formulas use a small parser in `src/renderer/lib/cards` that knows numbers, field ids, operators and a few functions |

## Model

The field schema in `src/shared/cards.ts` becomes a discriminated union on `kind`. Each kind keeps the keys it uses, and keys it shared with the old flat field keep their names, so stored templates parse without a rewrite. Unknown keys are dropped on the next save.

Card values gain checklists, ranges and attribute rows. Item styles gain a font, line height, text decoration, text case, gradient and shadow levels; `shadow: true` reads as a medium shadow.

Style presets are a new `item_styles` table, so the project version rises and an older Loopy refuses the file instead of misreading it.

## Phases

| Phase | Scope                                                                                      |
| ----- | ------------------------------------------------------------------------------------------ |
| 1     | Field kind registry and schema union, no change in behaviour                               |
| 2     | Grouped field picker, settings in a fixed order, readable field ids, shared field settings |
| 3     | New field kinds, formulas and visibility rules                                             |
| 4     | Card size presets, background, accent placement, zones, font, accent from a choice         |
| 5     | Properties sections, item capabilities, editing several items, style presets, new styles   |
| 6     | Icon, checklist, table and embed items                                                     |

## Changes from the plan

- The field picker is a grouped menu; Radix type-ahead finds a kind by its first letters, so there is no separate search box.
- Choices keep their colour on the option, so Accent from reads it straight from the field.
- Grow to fit fields grows the designer preview. A card on a board keeps the size it was given, because measuring it would add a resize to the undo history on every edit.
- Old projects need no migration: the application has not shipped, and older fields still parse.

## Out of scope

Card backs, printing and PDF export wait for demand. Embeds show boards, notes, palettes and cards; tickets need a ticket link kind first. Loop diagram nodes stay on the [roadmap](../roadmap.md).
