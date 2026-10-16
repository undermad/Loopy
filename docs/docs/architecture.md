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
| `src/main/storage`        | Project files on disk: save, load, migrations                           |
| `src/main/env.ts`         | Environment loading and validation                                      |
| `src/main/window.ts`      | Window options and creation                                             |
| `src/preload/index.ts`    | The `window.loopy` API                                                  |
| `src/renderer/components` | React components, each in its own folder with its SCSS module           |
| `src/renderer/styles`     | Tokens, mixins and the global stylesheet                                |
| `src/shared`              | Types and zod schemas used by more than one process                     |

## IPC rules

1. Channel names and payload schemas live in `src/shared/ipc.ts`. Nothing else names a channel as a string.
2. The main process validates every payload it returns with the shared schema.
3. The preload validates every reply before handing it to the renderer and exposes only functions, never `ipcRenderer`.
4. The renderer calls `window.loopy.<method>()` and treats the result as trusted.
5. Every channel has a test in `tests/integration/ipc`.

The scaffold ships one channel, `app:getVersion`, which shows the pattern end to end.

## Project files

Projects are JSON files with a `schemaVersion` field. `src/main/storage` loads a file, runs migrations up to the current version, validates the result and only then returns it. Writes go to a temporary file first and are renamed into place so a crash cannot leave a half-written project. See [Testing](testing) for how migrations are covered.
