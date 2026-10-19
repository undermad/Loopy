---
sidebar_position: 7
description: The reusable component library under src/renderer/ui and how to use it.
---

# Components

Every screen is built from the primitives in `src/renderer/ui`, imported from `@renderer/ui`. They know nothing about projects, IPC or translations: text, including every `aria-label`, arrives through props. Rules and rationale are in the [component library plan](./plans/components.md).

## Catalogue

| Component                                          | Built on               | Notes                                                                                                                    |
| -------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `Button`                                           | `button`               | `variant` primary, secondary, ghost, danger. `loading` disables and spins                                                |
| `IconButton`                                       | `button`, `Tooltip`    | `label` is required and doubles as the tooltip. `active` sets `aria-pressed`                                             |
| `RichText`, `RichContent`                          | TipTap                 | HTML in and out; `labels` names every toolbar button. `RichContent` renders read-only through the same schema            |
| `Tooltip`, `TooltipProvider`                       | Radix Tooltip          | One provider at the app root                                                                                             |
| `Field`, `Input`, `TextArea`, `Select`             | Radix Label and Select | `Field` wires id, hint and error to the control inside it                                                                |
| `Switch`, `ToggleGroup`                            | Radix Switch, Toggle   | `ToggleGroup` is single-select and never empties                                                                         |
| `ScrollStrip`                                      | `div`                  | Overflowing toolbar with no scrollbar: wheel or middle drag scrolls it, faded edges show hidden content                  |
| `NumberInput`                                      | `input`                | Drag left or right to change the value, Shift for tenths of a step; click to type. Commits on Enter or blur              |
| `Tabs`                                             | Radix Tabs             | `Root`, `List`, `Trigger`, `Content`                                                                                     |
| `Dialog`, `ConfirmDialog`                          | Radix Dialog           | `Dialog.Content` takes `title`, `description` and `closeLabel`                                                           |
| `DropdownMenu`, `ContextMenu`, `Menubar`           | Radix menus            | Same parts and styles for all three, plus `Shortcut`                                                                     |
| `Popover`                                          | Radix Popover          | `Root`, `Trigger`, `Anchor`, `Close`, `Content`                                                                          |
| `PropertySection`                                  | `button`, `section`    | Collapsible group of settings under a heading; `more` keeps advanced settings behind a More toggle. Open or controlled   |
| `ScrollArea`                                       | Radix Scroll Area      | `orientation` vertical, horizontal or both. Vertical content is held to the viewport width, so it never scrolls sideways |
| `Toolbar`                                          | Radix Toolbar          | `Root`, `Group`, `Button`, `Separator`                                                                                   |
| `ToastProvider`, `useToast`                        | Radix Toast            | `show({ title, description, variant })`                                                                                  |
| `ColorPicker`, `ColorSwatch`                       | `react-colorful`       | Hex only                                                                                                                 |
| `Tag`, `Kbd`, `Separator`, `Spinner`, `EmptyState` | plain elements         |                                                                                                                          |

Every interactive component has `sm` and `md` sizes, a disabled state and the `focus-ring` mixin.

## Adding a component

1. Create `src/renderer/ui/<Name>/` with `<Name>.tsx`, `<Name>.module.scss` and `index.ts`, and add the export to `src/renderer/ui/index.ts`.
2. Use tokens only. Shared control and menu mixins live in `src/renderer/ui/styles`.
3. Add `tests/unit/renderer/ui/<Name>.test.tsx` with a behaviour test and `expectNoViolations` from `tests/setup/axe.ts`.
4. Add the row above.
