---
sidebar_position: 1
description: Plan for themes, translations, Blender-style areas and workspaces, and the menu bar.
---

# UI shell

:::note Draft
Design proposal, not yet implemented. Each phase below turns into real pages under `docs/docs` and ADRs when it lands.
:::

## Goals

1. Light and dark mode out of the box, custom themes as files the user can share.
2. Every visible string translated, English first, more languages without touching components.
3. Blender-style screen: areas that split, join, resize and swap, each showing any editor.
4. Workspaces as tabs in the top bar, each with its own area tree, remembered when switching, saved and loaded as named layouts.
5. A menu bar with File, Edit, Window and Help, a separator, then the workspace tabs.

## Vocabulary

Loopy borrows Blender's model and most of its names so the behaviour is predictable to anyone who knows Blender.

| Blender   | Loopy       | Meaning                                                                    |
| --------- | ----------- | -------------------------------------------------------------------------- |
| Workspace | Workspace   | A named tab holding one area tree                                          |
| Screen    | Layout      | The area tree of one workspace. Also the name of a saved set of workspaces |
| Area      | Area        | One rectangle in the tree, always showing exactly one editor               |
| Editor    | Editor      | What an area shows: Tickets, Progress, Board, Colours, Properties          |
| Region    | Header/Body | The area's header strip with the editor switcher, and the editor itself    |
| Theme     | Theme       | A named set of colour tokens with a light or dark base                     |

## Libraries

| Package                                                                                                              | Use                                                                          | Why this one                                                                                                                             |
| -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `zustand`                                                                                                            | Renderer state: settings, theme, workspaces, layout tree                     | Small, selector based so drag updates do not re-render the whole tree, no provider boilerplate, trivial to test outside React            |
| `react-resizable-panels`                                                                                             | Rendering split areas with draggable, keyboard-operable dividers             | Maintained, React 19, nests freely, handles pointer and keyboard resizing and min sizes. Loopy owns the tree model, the library draws it |
| `i18next`, `react-i18next`                                                                                           | Translations in renderer and main                                            | Runs in both processes, namespaces, typed keys, Intl-based plurals, can load language packs from disk at runtime later                   |
| `i18next-parser` (dev)                                                                                               | Extract keys from source, flag missing and unused ones in CI                 | Keeps `en` complete without manual bookkeeping                                                                                           |
| `@radix-ui/react-menubar`, `react-dropdown-menu`, `react-context-menu`, `react-dialog`, `react-select`, `react-tabs` | Menu bar, editor switcher, area and workspace context menus, settings dialog | Follows ADR 0010. Keyboard and screen reader behaviour for free                                                                          |
| `tinykeys`                                                                                                           | Global and per-area keyboard shortcuts                                       | 1 kB, declarative key maps, no focus trap of its own                                                                                     |
| `culori` (later)                                                                                                     | Theme editor: contrast checks and derived shades                             | Only needed once the theme editor ships                                                                                                  |

Considered and not chosen:

- `dockview` and `react-mosaic-component` ship a tiling layout with their own tree, serialisation and tabs. Neither gives Blender's corner gestures, so the custom part is the same, and owning the tree keeps the layout schema in `src/shared` under Loopy's migration rules. `dockview` stays the fallback if floating windows are ever needed.
- `@lingui` compiles messages at build time, which blocks user-installed language packs.
- CSS-in-JS theming. Tokens as custom properties already switch at runtime, nothing more is needed.

## Folders

| Folder                                                            | Holds                                                                                   |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `src/shared/theme.ts`                                             | Theme schema, built-in `light` and `dark` theme objects, token name list                |
| `src/shared/layout.ts`                                            | Workspace, layout node and layout preset schemas                                        |
| `src/shared/locales/<lng>/*.json`                                 | Translation resources, one file per namespace, used by both processes                   |
| `src/shared/i18n.ts`                                              | Supported languages, namespace list, typed resource declaration                         |
| `src/main/storage/themes-store.ts`, `layouts-store.ts`            | Directories of JSON files with list, read, write, delete, import, export                |
| `src/main/ipc/settings.ts`, `themes.ts`, `layouts.ts`, `shell.ts` | Handlers. `shell` covers native theme changes and the system locale                     |
| `src/renderer/lib/settings`                                       | Settings store synced with main through IPC                                             |
| `src/renderer/lib/theme`                                          | Active theme, `applyTheme`, system mode subscription                                    |
| `src/renderer/lib/i18n`                                           | i18next setup, `useFormat` for dates and numbers                                        |
| `src/renderer/lib/layout`                                         | Layout tree model and the pure `split`, `join`, `resize`, `swap`, `maximise` functions  |
| `src/renderer/lib/workspaces`                                     | Workspace list, active workspace, presets, persistence to `state.json`                  |
| `src/renderer/lib/editors`                                        | Editor registry. Editor components live in `components/editors/<Name>`                  |
| `src/renderer/lib/shortcuts`                                      | Key map definitions and the `useShortcuts` hook                                         |
| `src/renderer/components/Shell`                                   | `MenuBar`, `WorkspaceTabs`, `StatusBar`, `AreaTree`, `Area`, `AreaHeader`, `AreaCorner` |

Each `src/renderer/lib` entry is an internal library with one `index.ts`, no components inside and no deep imports from outside, as set out in ADR 0016 and `.claude/skills/internal-libraries/SKILL.md`. Components under `Shell` and `editors` only compose them.

## Themes

A theme is a JSON document. Built-in light and dark are the same shape as user themes, so there is one code path.

```ts
theme = {
  schemaVersion: 1,
  id: uuid,
  name: string,
  base: 'light' | 'dark',
  colors: {
    bg,
    surface,
    surfaceRaised,
    fg,
    fgMuted,
    border,
    accent,
    accentFg,
    focus,
    danger,
    warning,
    success,
    selection,
  },
};
```

Only base colours are stored. Hover, pressed and disabled shades derive in CSS with `color-mix()`, so a theme author fills in about a dozen fields and everything else follows.

| Concern   | Decision                                                                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tokens    | `tokens.scss` keeps spacing, radii and type, and the light colours as the first-paint default. `[data-theme='dark']` stays for the no-JS fallback       |
| Applying  | `ThemeProvider` writes `--color-*` on `<html>` with `style.setProperty`, sets `data-theme` to the base and `color-scheme`. No stylesheet is regenerated |
| Mode      | `settings.theme` becomes `{ mode: 'system' \| 'light' \| 'dark', light: themeId, dark: themeId }`. System mode follows `nativeTheme` pushed from main   |
| Storage   | `userData/themes/<id>.json`. Built-ins are not on disk                                                                                                  |
| Editor    | Settings dialog, Themes tab: duplicate a theme, edit each colour with live preview, contrast warnings, revert                                           |
| Export    | File dialog, writes the theme JSON. Import validates with the shared schema, assigns a new id on collision, copies it into `themes`                     |
| Migration | `settings.json` goes to `schemaVersion` 2: the old `theme` enum maps to the new object with built-in ids                                                |

Renderer-side tests: a theme applies the expected custom properties, an invalid file is refused with a readable error, system mode flips when main sends a change.

## Localisation

| Concern    | Decision                                                                                                                      |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Resources  | `src/shared/locales/en/{common,menu,shell,settings,editors}.json`. Namespaces follow the folders that use them                |
| Renderer   | `src/renderer/lib/i18n` initialises i18next once. Components use `useTranslation('shell')` and never contain English literals |
| Main       | Initialises the same resources for dialog titles, the macOS application menu and error messages                               |
| Typing     | `CustomTypeOptions` in `src/shared/i18n.ts` makes keys type-checked. A wrong key is a type error, not an empty label          |
| Language   | `settings.language: 'system' \| 'en'`, system resolved from `app.getLocale()`. Changing it re-renders without a restart       |
| Formatting | Dates, numbers and relative times go through `Intl` in `useFormat`, never through string concatenation                        |
| Checks     | `i18next-parser` in `npm run lint` fails on missing keys. A unit test asserts every locale has the same key set as `en`       |
| Testing    | A `cimode` pseudo-locale renders keys instead of values, so component tests assert on keys and never break on copy changes    |
| Later      | Language packs under `userData/locales/<lng>` loaded at start, the same way themes are, for community translations            |

## Areas and layout tree

### Model

```ts
layoutNode =
  | { kind: 'split', id, direction: 'row' | 'column', children: layoutNode[], sizes: number[] }
  | { kind: 'area', id, editor: editorId, state: Record<string, unknown> }
```

Invariants, each enforced by the reducer and covered by a unit test:

- `sizes` has one entry per child and sums to 1.
- A split has at least two children. Joining down to one child replaces the split with that child.
- A split never directly contains a split of the same direction. Nesting flattens on insert.
- Area state is opaque here. Each editor validates its own state with its own zod schema on mount and falls back to defaults, so a layout file never becomes invalid because an editor changed.

### Operations

Pure functions in `src/renderer/lib/layout/tree.ts`, exercised without React:

| Function     | Does                                                                                          |
| ------------ | --------------------------------------------------------------------------------------------- |
| `split`      | Replace an area with a split of two copies of it, or insert into the parent if same direction |
| `join`       | Remove an area and give its size to the chosen neighbour                                      |
| `resize`     | Set `sizes` of one split from the panel group's layout callback                               |
| `swap`       | Exchange the editors and states of two areas                                                  |
| `setEditor`  | Change an area's editor and reset its state to that editor's defaults                         |
| `maximise`   | Mark one area as filling the workspace. The tree is kept, only rendering changes              |
| `neighbours` | Areas sharing a full edge with a given area, used to decide whether a join is allowed         |

### Rendering

`AreaTree` walks the node and renders a `PanelGroup` per split and an `Area` per leaf. Panel sizes come from the model, and the `onLayout` callback writes them back with `resize`. The editor registry maps an `editorId` to a component, an icon, a translated title, a default state and a state schema. The area header holds the editor switcher on the left, like Blender, then whatever header controls the editor registers.

### Gestures

| Gesture                                           | Result                                                                     |
| ------------------------------------------------- | -------------------------------------------------------------------------- |
| Drag an area corner inwards                       | Split along the drag axis, divider follows the pointer                     |
| Drag an area corner outwards across a shared edge | Join into the neighbour, with a darkened arrow overlay                     |
| Ctrl + drag a corner into another area            | Swap the two areas                                                         |
| Drag a divider                                    | Resize                                                                     |
| Right click header, Area submenu                  | Split horizontal, split vertical, join, swap, close, maximise, flip header |
| Ctrl+Space                                        | Maximise or restore the area under the pointer                             |
| Ctrl+Shift+Space                                  | Maximise without the top bar                                               |

The corner hit target is a 10 px triangle on each corner of every area, with the Blender cursor on hover. Direction is decided after 4 px of movement, then locked.

### Editors

Editors ship as placeholders in the first phase so the shell can be tested with real switching:

| Editor     | Workspace it anchors | First version                                  |
| ---------- | -------------------- | ---------------------------------------------- |
| Tickets    | Planning             | Empty board frame                              |
| Progress   | Planning             | Empty timeline frame                           |
| Board      | Design               | Empty infinite canvas with pan and zoom        |
| Colours    | Palette              | Project colour schemes, reads from the project |
| Properties | Any                  | Context panel for the active selection         |
| Welcome    | Default              | Recent projects, links to docs                 |

## Workspaces

```ts
workspace = { id, name, icon?, root: layoutNode, maximisedAreaId?: string }
workspaces = { schemaVersion: 1, items: workspace[], activeId }
```

| Operation                          | Where                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------- |
| Switch                             | Click the tab, Ctrl+PageUp and Ctrl+PageDown                              |
| Add                                | The `+` tab opens a menu: duplicate current, or one of the layout presets |
| Rename, duplicate, delete, reorder | Tab context menu and drag to reorder                                      |
| Save as layout                     | Window menu. Prompts for a name, writes a layout preset                   |
| Load layout                        | Window menu. Replaces all workspaces after confirmation                   |

Each workspace keeps its full tree, maximised area and every area's state while inactive, so switching back restores it exactly.

### Persistence

| Data                                                 | Location                             | Why                                                                                          |
| ---------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------- |
| Live workspaces                                      | `state.json`, key `workspaces`       | One screen setup per machine, the same whichever project is open                             |
| Area state that names project data                   | Inside the same tree                 | Each editor resolves ids against the open project and falls back to its default when missing |
| Layout presets                                       | `userData/layouts/<id>.json`         | Named, shareable copies of a workspace set                                                   |
| Built-in presets: Default, Planning, Design, Palette | Code, `src/shared/layout-presets.ts` | Always available, cannot be deleted, can be duplicated                                       |
| Preset used on first run and by Reset                | `settings.defaultLayoutId`           | Preference                                                                                   |

Workspaces are device state, so they never travel with an exported project. Writes are debounced by 500 ms during drags and flushed on blur and quit.

## Menu bar

Rendered in the renderer with Radix Menubar, so it can hold the workspace tabs and be themed. The native menu stays minimal, enough for macOS conventions. `autoHideMenuBar` already hides it on Windows and Linux.

| Menu   | Items                                                                                                             |
| ------ | ----------------------------------------------------------------------------------------------------------------- |
| File   | New project, Open, Open recent, Import, Export, separator, Preferences, separator, Quit                           |
| Edit   | Undo, Redo, separator, Cut, Copy, Paste, Delete, separator, Select all                                            |
| Window | New window, Toggle fullscreen, separator, Save layout, Load layout, Reset to preset, separator, Toggle status bar |
| Help   | Documentation, Keyboard shortcuts, Report an issue, separator, About                                              |

After Help: a vertical rule, then the workspace tabs, then `+`. The bar is 32 px high. A status bar at the bottom shows the current mouse hints and the app version, like Blender, and can be hidden.

A later polish step moves the bar into the title bar with `titleBarStyle: 'hidden'` and `titleBarOverlay`, with `-webkit-app-region: drag` on the empty space.

Shortcuts are declared once in `src/renderer/lib/shortcuts/keymap.ts` with their translation key, so the menu labels, the Keyboard shortcuts page and `tinykeys` share one source.

## Exchange format

Themes and layout presets share one envelope so import can tell them apart and one validator handles both:

```json
{ "loopy": { "kind": "theme", "schemaVersion": 1, "app": "0.1.0" }, "data": {} }
```

Export writes this envelope. Import reads `loopy.kind`, validates `data` with the matching schema, runs migrations for older `schemaVersion` values and refuses newer ones, which matches the project file rules in ADR 0008.

## IPC

New channels in `src/shared/ipc.ts`, each with a schema, a preload method and a test in `tests/integration/ipc`:

| Channel                                                     | Direction        |
| ----------------------------------------------------------- | ---------------- |
| `settings:get`, `settings:set`                              | invoke           |
| `settings:changed`                                          | main to renderer |
| `shell:nativeTheme`, `shell:locale`                         | invoke and push  |
| `themes:list`, `get`, `save`, `delete`, `export`, `import`  | invoke           |
| `layouts:list`, `get`, `save`, `delete`, `export`, `import` | invoke           |
| `state:getWorkspaces`, `state:setWorkspaces`                | invoke           |

## Phases

| Phase | Delivers                                                                                                                                                                    | Docs and ADRs                                             |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 1     | zustand, settings IPC, i18next with `en`, `ThemeProvider` with built-in light, dark and system, settings dialog with Appearance and Language tabs, settings migration to v2 | `theming.md`, `localisation.md`, ADR zustand, ADR i18next |
| 2     | Menu bar, workspace tabs, status bar, area tree rendering, editor registry with placeholder editors, editor switcher, divider resizing, workspaces kept in memory           | `shell.md`, ADR in-renderer menu bar, ADR own layout tree |
| 3     | Corner split and join, swap, maximise, area context menu, keyboard shortcuts, workspace add, duplicate, rename, delete, reorder                                             | `shell.md` gestures and shortcuts tables                  |
| 4     | Persistence: workspaces in `state.json`, layout presets directory, save and load layout, built-in presets, export and import with the envelope                              | `architecture.md` storage table, ADR exchange format      |
| 5     | Theme directory, theme editor with live preview, theme export and import                                                                                                    | `theming.md` editor section                               |
| 6     | Title bar overlay, header flip and hide, `i18next-parser` in lint, pseudo-locale, language packs from disk                                                                  | `tooling.md`, `localisation.md`                           |

Each phase is one or more PRs, keeps `npm run test` and `npm run typecheck` green, and adds E2E coverage for its user-visible behaviour: split by corner drag, switch workspace and come back, change theme and restart, change language and see the menu update.

## Open questions

1. Whether the Edit menu owns undo and redo globally or each editor has its own stack. Affects where the command bus lives.
2. Frameless window from the start or in phase 6. Starting frameless costs a day on Windows snap and double-click behaviour but avoids two visual rewrites.

Decided: live workspaces are stored per device in `state.json`, not per project.
