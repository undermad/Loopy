---
sidebar_position: 3
description: Electron process model, folder layout and IPC rules.
---

# Architecture

:::note Draft
This page describes the scaffold. It will be completed after the architecture discussion for the game design and project management features.
:::

## Process model

Electron runs three kinds of code with different privileges.

| Process  | Folder         | Can do                                                           |
| -------- | -------------- | ---------------------------------------------------------------- |
| Main     | `src/main`     | Everything Node can: files, windows, OS integration              |
| Preload  | `src/preload`  | Expose a small typed API to the renderer through `contextBridge` |
| Renderer | `src/renderer` | React UI only. No Node, no direct Electron access                |

The renderer runs with context isolation and the sandbox on, without Node integration, behind a Content Security Policy that allows only the app's own files. A unit test in `tests/unit/main/window.test.ts` keeps those settings in place.

## Folders

| Folder                    | Holds                                                                   |
| ------------------------- | ----------------------------------------------------------------------- |
| `src/main/ipc`            | One file per IPC area. Handlers validate input and return typed results |
| `src/main/services`       | Logic with no Electron dependency, such as the logger                   |
| `src/main/storage`        | Project databases, settings and device state on disk, with migrations   |
| `src/main/env.ts`         | Environment loading and validation                                      |
| `src/main/window.ts`      | Window options and creation                                             |
| `src/preload/index.ts`    | The `window.loopy` API                                                  |
| `src/renderer/lib`        | One internal library per concern, each behind a single `index.ts`       |
| `src/renderer/components` | React components, each in its own folder with its SCSS module           |
| `src/renderer/styles`     | Tokens, mixins and the global stylesheet                                |
| `src/shared`              | Types and zod schemas used by more than one process                     |

## Internal libraries

Every renderer concern is a library under `src/renderer/lib/<name>` with one public entry point, `index.ts`. A library owns its logic, state and hooks and contains no components. Components compose libraries and hold no logic of their own. Dependencies point one way: `src/shared`, then `lib`, then `components`, then `App`.

The boundary is a convention checked in review, not a lint rule. A deep import such as `@renderer/lib/theme/apply`, or any import of `components` from inside a library, is a review finding. `knip` fails CI on an export nothing uses, which keeps each index small. The rules and a checklist for adding a library are in `.claude/skills/internal-libraries/SKILL.md`, the reasoning in [ADR 0016](./decisions/0016-internal-libraries.md).

| Library      | Owns                                                            | Status  |
| ------------ | --------------------------------------------------------------- | ------- |
| `theme`      | Active theme, applying colour tokens, following the system mode | shipped |
| `i18n`       | i18next setup, language switching, `Intl` formatting            | shipped |
| `settings`   | Settings store synced with main                                 | shipped |
| `layout`     | Area tree model, split, join, resize, swap, maximise            | shipped |
| `workspaces` | Workspace list, active workspace, layout presets                | shipped |
| `editors`    | Editor registry: component, icon, title key, default state      | shipped |
| `shortcuts`  | Key map and the `useShortcuts` hook                             | shipped |
| `project`    | Current project, project list, recent projects                  | shipped |
| `tickets`    | Tickets snapshot, selection, ticket, state and label actions    | shipped |
| `board`      | Board list, open board snapshots, change commits                | shipped |

## IPC rules

1. Channel names and payload schemas live in `src/shared/ipc.ts`. Nothing else names a channel as a string.
2. The main process validates every payload it returns with the shared schema.
3. The preload validates every reply before handing it to the renderer and exposes only functions, never `ipcRenderer`.
4. The renderer calls `window.loopy.<method>()` and treats the result as trusted.
5. Every channel has a test in `tests/integration/ipc`.

`app:getVersion` shows the pattern end to end. Settings use `settings:get`, `settings:set` and a `settings:changed` push from main; the preload wraps pushes in subscribe functions that return an unsubscribe, so the renderer never sees `ipcRenderer`. Theme and locale channels are listed on the theming page.

## Storage

Everything lives under Electron's user data directory. `storagePaths` in `src/main/storage/paths.ts` is the only place that knows the layout.

| File                  | Holds                                                    | Format                     |
| --------------------- | -------------------------------------------------------- | -------------------------- |
| `settings.json`       | App preferences: theme, UI font, font size               | JSON with `schemaVersion`  |
| `state.json`          | Device state: recent projects, workspaces, status bar    | JSON with `schemaVersion`  |
| `projects/<id>.loopy` | One project: metadata, settings and later boards, assets | SQLite with `user_version` |
| `themes/<id>.json`    | One custom theme per file, see the theming page          | JSON with `schemaVersion`  |
| `layouts/<id>.json`   | One saved layout preset per file, see the shell page     | JSON with `schemaVersion`  |

The user never sees these paths. The project picker lists the `projects` directory, and sharing goes through export and import.

### Settings and device state

`createJsonStore` in `src/main/storage/json-store.ts` loads a JSON file, runs migrations from `src/main/storage/migrations.ts` up to the current version and validates with the zod schema from `src/shared`. A missing file yields the schema defaults, so a fresh install needs no setup step. A new key with a default needs no migration; renaming or removing one does. Writes go to a temporary file and are renamed into place.

Preferences and device state are separate files because the first is edited deliberately and worth backing up, while the second is rewritten constantly and can be lost without cost.

### Project databases

A project is one SQLite database opened through `node:sqlite`, which ships with the Node inside Electron, so there is no native module to rebuild. `src/main/storage/project-database.ts` owns the lifecycle:

| Function          | Does                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------- |
| `createProject`   | Creates the file, stamps the `application_id`, runs all migrations, inserts the project row |
| `openProject`     | Checks the SQLite header and `application_id`, migrates, validates the project row          |
| `isProjectFile`   | Header and `application_id` check without migrating, for dialogs and drag and drop          |
| `exportProject`   | `VACUUM INTO` a compacted copy at a path the user picked                                    |
| `importProject`   | Copies a `.loopy` file into the projects directory and opens it, which migrates it          |
| `readProjectInfo` | The id, name and timestamps from the singleton `project` row                                |

The export is the same format as the working file, so there is nothing to translate and a backup is a copy. Imports are copied rather than opened in place, so a file on removable or synced storage is never written live.

Databases open in WAL mode. While a project is open, SQLite keeps `-wal` and `-shm` files next to it and removes them on close. Schema changes are SQL strings in `src/main/storage/project-migrations.ts`, applied in order inside one transaction by `migrateDatabase`. A file with a `user_version` above the current one is refused rather than guessed at. The renderer never receives a database handle; features will expose what they need through IPC.

Version 1 holds the `project` row and a key-value `settings` table. Version 2 adds the tickets tables, see the tickets page. Version 3 adds boards, nodes, edges and an assets table, see the board page. Version 4 narrows ticket types. Version 5 adds board units and version 6 the grid colour.
