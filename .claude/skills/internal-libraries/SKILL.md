---
name: internal-libraries
description: How each concern in Loopy (theme, i18n, layout, workspaces, shortcuts, settings, editors) is built as its own internal library with one entry point and no coupling to components or other concerns. Use before adding a concern, adding a module to an existing one, or importing from one.
---

# Internal libraries

Each concern is its own library. A library has one public entry point, owns its state and logic, and knows nothing about who uses it. Components compose libraries; they never contain the logic.

## Where a library lives

| Scope          | Folder                                         | Examples                                                        |
| -------------- | ---------------------------------------------- | --------------------------------------------------------------- |
| Renderer only  | `src/renderer/lib/<name>/`                     | `theme`, `i18n`, `layout`, `workspaces`, `shortcuts`, `editors` |
| Both processes | `src/shared/<name>.ts` or `src/shared/<name>/` | schemas, channel names, built-in themes and presets             |
| Main only      | `src/main/<area>/`                             | `storage`, `services`, `ipc`                                    |

## Rules

1. `index.ts` is the only import path. Write `@renderer/lib/theme`, never `@renderer/lib/theme/apply`. This is checked in review, not by a lint rule; do not add one to `eslint.config.js`.
2. Export the minimum. `knip` reports unused exports; delete them rather than keep them public.
3. No React components inside a library. Hooks and providers are fine. Components live in `src/renderer/components` and consume libraries. A library importing from `components` is a review finding.
4. Dependencies point one way: `shared` to `lib` to `components` to `App`. A library imports another library only through its alias path and never in a cycle.
5. Pure core, thin bindings. Logic lives in plain functions that receive what they need as arguments: an element, a store, a clock, an IPC function. React and Electron bindings sit in their own files beside it. The core is tested without jsdom or Electron.
6. State stays inside. A library owns its store and exposes hooks, selectors and actions. The store object and its shape are not exported.
7. A consumer takes only what it needs. Prefer `useTheme()` and `applyTheme(element, theme)` over a context object that carries everything.
8. Each library has a page or section under `docs/docs` naming what it owns and what `index.ts` exports, plus a row in the libraries table in `architecture.md`.

## Shape of a library

```text
src/renderer/lib/theme/
  index.ts        public API: types, hooks, actions, pure functions
  apply.ts        pure: writes colour tokens onto an element
  store.ts        zustand store, reached only through hooks exported from index.ts
  provider.tsx    React binding: subscribes to main, applies the active theme
tests/unit/renderer/lib/theme/
  apply.test.ts   pure core, no DOM beyond a bare element
  store.test.ts   actions and selectors outside React
```

Subfolders are allowed inside a library. Imports between siblings stay relative; imports of another library go through `@renderer/lib/<name>`.

## Checklist for a new library

- Folder with `index.ts`, nothing else imported from outside.
- Unit tests for the pure core before the React binding.
- Search the diff for imports into the library that are not its index, and for `components` imports inside it. `npm run knip` reports no unused exports.
- Docs page or section and the row in `architecture.md`, in the same commit.
- An ADR if the library picks a dependency the whole app will rely on.
