---
sidebar_position: 6
description: Fewer card field types, a canvas that edits the layout in place, and the helpers that make cards faster to build.
---

# Card designer canvas

:::note Status
Implemented. [Cards](../cards.md) describes what ships; this page keeps the reasoning, what was left out and the test evidence.
:::

## Goals

1. Fewer field types: merge any type that is another type with a setting.
2. Edit the layout on the card itself: drag fields, resize them against the column grid, keep settings beside it.
3. Helpers that cut the clicks needed to build a template.

## Decisions

| Question         | Choice                                                    | Reason                                                                                   |
| ---------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Field types      | 14 types; 23 presets in Add field                         | One value shape per type; presets keep Heading, Stat bar, Rating and Tags one click away |
| Layout model     | The 12-column grid that flows, any span, minimum height   | Free placement fights Grow to fit and the scrolling body                                 |
| Editing values   | A Design and a Fill in mode                               | Dragging and resizing clash with typing into inputs                                      |
| Old projects     | No conversion                                             | The application has not shipped                                                          |
| Undo             | `useHistory` in the designer, merging keyed edits for 1 s | Typing a label or dragging a handle is one step, not one per key                         |
| Drops            | Field under the pointer, then the nearest in that zone    | The zone itself would otherwise win and drop every field at the end                      |
| Design-mode clip | Card, view and zones stop clipping in Design              | Toolbars and handles near the edge stayed out of reach                                   |

## Phases

| Phase | Scope                                                                                     |
| ----- | ----------------------------------------------------------------------------------------- |
| 1     | Merge field types into 14 with presets; changing type keeps shared settings               |
| 2     | Any column count, minimum height and Start a new row                                      |
| 3     | Canvas, toolbar, handles, rename in place, undo, keys, several fields, clipboard, helpers |

## Left out

Template inheritance, saved text styles for fields and a lock on whole zones wait for demand. Board cards keep the size they were given; Fit height applies to the template.

## Test evidence

| Guarantee                                                                 | Where                                              | Type       |
| ------------------------------------------------------------------------- | -------------------------------------------------- | ---------- |
| Merged types parse, reject old names and keep their defaults              | `tests/unit/shared/card-field-kinds.test.ts`       | unit       |
| Presets, value rules, formulas, accent and type changes                   | `tests/unit/renderer/lib/card-kinds.test.tsx`      | unit       |
| Views and settings of the merged types                                    | `tests/unit/renderer/CardMergedKinds.test.tsx`     | component  |
| Span, height, new row and lock in the schema                              | `tests/unit/shared/card-layout.test.ts`            | unit       |
| Grid maths, moves and drops                                               | `tests/unit/renderer/lib/card-layout.test.tsx`     | unit       |
| History, duplicate, paste, rename id, blocks, sample values, overflow     | `tests/unit/renderer/lib/card-editing.test.tsx`    | unit       |
| Designer keys, the unsaved flag and the shortcuts dialog entries          | `tests/unit/renderer/lib/card-keys.test.tsx`       | unit       |
| Drop target choice                                                        | `tests/unit/renderer/CardCanvasCollision.test.tsx` | unit       |
| Layout settings and grid placement                                        | `tests/unit/renderer/CardLayoutSettings.test.tsx`  | component  |
| Every canvas feature, keys, several fields, helpers and the unsaved guard | `tests/unit/renderer/CardDesignerCanvas.test.tsx`  | component  |
| Presets, mouse drags, resize handles, toolbar, keys, Fit height, save     | `tests/e2e/card-designer.spec.ts`                  | end to end |

Each phase was red before its code and green after it: 25, 13 and 42 failing tests. The last run passed 1162 unit and component tests and 28 end-to-end tests, with 95 percent statement coverage.
