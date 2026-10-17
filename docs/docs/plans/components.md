---
sidebar_position: 3
description: The reusable visual component library under src/renderer/ui, its rules, the first components and the gallery.
---

# UI component library

:::note Status
Implemented in the first iteration. The pages linked from the sidebar describe what shipped; this page keeps the reasoning and the parts still open.
:::

## Goals

1. One set of visual primitives, themed by tokens, that every screen uses.
2. Components know nothing about projects, IPC, translations or workspaces, so any of them can be used anywhere.
3. Correct keyboard and screen reader behaviour once, in the primitive, never per screen.

## Where it lives

`src/renderer/ui/<Name>/` with `<Name>.tsx`, `<Name>.module.scss` and `index.ts`. A top-level `src/renderer/ui/index.ts` re-exports every component, and consumers import from `@renderer/ui`. Tests sit in `tests/unit/renderer/ui/<Name>.test.tsx`.

The library follows ADR 0016 with one difference: it is the one library that contains components, and it contains only components. Internal libraries under `src/renderer/lib` never import it, and it never imports them.

## Rules

1. Tokens only. No literal colours, sizes or radii. A component that needs a value the tokens lack adds a token to `tokens.scss` and to the theme schema.
2. No app knowledge. No store, no `window.loopy`, no `useTranslation`. Text arrives through props, including every `aria-label`.
3. Radix underneath wherever there is keyboard or focus behaviour to get right: menus, dialogs, popovers, tabs, select, switch, checkbox, slider, tooltip, scroll area, toolbar. Plain elements for the rest.
4. Compound components over prop bags. `Dialog.Root`, `Dialog.Title`, `Dialog.Body`, `Dialog.Footer` mirror the Radix parts and keep each piece small.
5. `className` is accepted for placement only, such as a margin or a grid area. Internals are not restyled from outside; a new variant is a new prop.
6. Every interactive component gets the `focus-ring` mixin, a disabled state and two sizes, `sm` for headers and toolbars and `md` for everything else.
7. Each component has a behaviour test with Testing Library and an axe check, and an entry in the gallery.

## First components

Tier 1 unblocks the shell, the settings dialog and the welcome screen. Tier 2 unblocks the editors.

| Component                     | Built on                        | Tier | First used by                          |
| ----------------------------- | ------------------------------- | ---- | -------------------------------------- |
| `Button`, `IconButton`        | `button`                        | 1    | Everything                             |
| `Tooltip`                     | Radix Tooltip                   | 1    | Icon buttons                           |
| `Field`, `Input`, `TextArea`  | `label`, `input`, `textarea`    | 1    | New project, settings, quick add       |
| `Select`                      | Radix Select                    | 1    | Settings, editor switcher              |
| `Tabs`                        | Radix Tabs                      | 1    | Settings dialog                        |
| `Dialog`, `ConfirmDialog`     | Radix Dialog                    | 1    | New project, delete confirmations      |
| `DropdownMenu`, `ContextMenu` | Radix Dropdown and Context Menu | 1    | Headers, cards, tabs                   |
| `Separator`, `Kbd`, `Spinner` | plain                           | 1    | Menus, shortcuts page, loading         |
| `ScrollArea`                  | Radix Scroll Area               | 1    | Lists, backlog, columns                |
| `EmptyState`                  | plain                           | 1    | Welcome, empty boards                  |
| `Toast`                       | Radix Toast                     | 1    | Import and export results              |
| `Switch`, `Checkbox`          | Radix Switch and Checkbox       | 2    | Settings, filters                      |
| `Toolbar`, `ToggleGroup`      | Radix Toolbar and Toggle Group  | 2    | Editor headers, board tools            |
| `Popover`                     | Radix Popover                   | 2    | Colour picker, label picker            |
| `ColorSwatch`, `ColorPicker`  | `react-colorful`                | 2    | Board background, state colour         |
| `Slider`, `NumberInput`       | Radix Slider, `input`           | 2    | Zoom, settings                         |
| `Tag`, `Card`, `ListItem`     | plain                           | 2    | Ticket cards, backlog, recent projects |
| `Menubar`                     | Radix Menubar                   | 2    | The top bar                            |

Shell-specific pieces such as `AreaHeader`, `WorkspaceTabs` and the area corner stay in `src/renderer/components/Shell`. They are built from these primitives but are not primitives themselves.

## Tokens the components need

The current tokens cover background, surface, text, border, accent and focus. Components add semantic tokens, each with a light and dark value and a field in the theme schema: `surface-raised`, `surface-sunken`, `accent-fg`, `danger`, `warning`, `success`, `selection`, control heights for the two sizes, and `shadow-sm` for menus. Hover and pressed shades derive with `color-mix()` so themes stay at a dozen colours.

## Gallery

A `gallery` editor, registered only when `import.meta.env.DEV` is true, shows every component in every size and state against the live theme. It costs no dependency, exercises real theme switching, and doubles as the manual accessibility pass. Storybook, deferred in ADR 0011, is revisited once the library stops changing weekly; Storybook 10 with `@storybook/react-vite` is the candidate.

## Phases

| Phase | Delivers                                                                                                                         |
| ----- | -------------------------------------------------------------------------------------------------------------------------------- |
| C1    | Semantic tokens, `Button`, `IconButton`, `Tooltip`, `Field`, `Input`, `TextArea`, `Dialog`, `Tabs`, `Select`, the gallery editor |
| C2    | Menus, `ScrollArea`, `Separator`, `Kbd`, `Spinner`, `EmptyState`, `Toast`, `ConfirmDialog`                                       |
| C3    | Tier 2 as each editor needs it, never ahead of a consumer                                                                        |

Each phase updates a `docs/docs/components.md` page listing the components, their props and their status, and the gallery.

## Open questions

1. A single `@renderer/ui` barrel or per-component imports such as `@renderer/ui/Button`. The barrel is simpler and Vite tree-shakes it; per-component imports make unused code visible in `knip`.
2. Whether `Menubar` belongs in the library or in the shell, since only one screen will ever use it.
