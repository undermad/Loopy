---
sidebar_position: 5
description: The test levels, how to run them and how to add a test at each level.
---

# Testing

## Levels

| Level           | Tool                                | Folder                                                       | Proves                                                                                                            |
| --------------- | ----------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Unit            | Vitest                              | `tests/unit/main`, `tests/unit/shared`, `tests/unit/preload` | pure logic, env parsing, the migration runner, the window hardening options                                       |
| Component       | Vitest, Testing Library, jsdom      | `tests/unit/renderer`                                        | components behave as the user sees them; a snapshot for stable layout                                             |
| IPC contract    | Vitest with a mocked `ipcMain`      | `tests/integration/ipc`                                      | each handler validates and returns the shared schema                                                              |
| Persistence     | Vitest on real temp files           | `tests/integration/storage`                                  | JSON stores and project databases: round-trips, corrupt or foreign files, unsupported versions, export and import |
| E2E             | Playwright with the Electron driver | `tests/e2e`                                                  | the built app launches, the window works, the renderer has no Node access                                         |
| Accessibility   | axe-core injected by Playwright     | `tests/e2e/a11y.spec.ts`                                     | no serious or critical violations in the main window                                                              |
| Packaging smoke | CI only                             | `.github/workflows/post-merge.yml`                           | the app packages on all three operating systems                                                                   |

## Commands

| Command                             | Runs                                                                                                 |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `npm run test`                      | unit, component and integration                                                                      |
| `npm run test:unit`                 | unit and component only, also the pre-push hook                                                      |
| `npm run test:unit:watch`           | the same in watch mode                                                                               |
| `npm run test:integration`          | IPC contract and persistence                                                                         |
| `npm run test:coverage`             | everything in Vitest with coverage; fails under 80 percent lines, branches, functions and statements |
| `npm run build && npm run test:e2e` | Playwright against `out/`                                                                            |
| `npm run test:all`                  | all of the above in order                                                                            |

Vitest projects are defined in `vitest.config.ts`. Playwright is configured in `playwright.config.ts` and shares one Electron fixture in `tests/e2e/fixtures/electron.ts`.

## Adding a test

- Pure function or service: a file next to the matching path under `tests/unit`, importing the module directly.
- Component: render with Testing Library, query by role, assert what the user sees. Mock `window.loopy` in `beforeEach`.
- New IPC channel: a test in `tests/integration/ipc` that captures the handler from a mocked `ipcMain.handle` and calls it.
- Project schema change: a SQL migration appended to `src/main/storage/project-migrations.ts` and a test in `tests/integration/storage` that opens a database written at the previous version.
- Settings or device state change: a migration in the matching store under `src/main/storage` when a key is renamed or removed, and a test in `tests/integration/storage` that loads a file written at the previous version. A new key with a default needs only a schema test.
- User journey: a spec in `tests/e2e` using the `window` fixture. Keep the suite under ten tests; each launches Electron.

## Snapshots

Use a snapshot only for a presentational component whose markup is stable and reviewed. Do not snapshot screens, lists with data or anything with a loading state. When a snapshot changes, read the diff before running `vitest -u`.

## Electron and Playwright

The E2E suite launches the built app from `out/`, so run `npm run build` first. The preload must stay CommonJS and bundle its dependencies, because the sandboxed renderer cannot load ES modules or `node_modules`; `electron.vite.config.ts` sets this. axe-core is injected with `page.evaluate` because the Content Security Policy blocks injected script tags.

Drag and drop in the tickets editor is pointer-driven, so a test drags with `mouse.move`, `mouse.down`, a few more moves and `mouse.up`, as `dragWithMouse` in `tests/e2e/app.spec.ts` does. Playwright's `dragTo` dispatches native HTML5 drag events, which the Electron driver does not deliver.

## jsdom stubs

`tests/setup/renderer.ts` stubs `ResizeObserver`, pointer capture, `scrollIntoView` and `getClientRects`, which jsdom lacks, and moves every `react-resizable-panels` separator away from the origin. Without that, every element sits at 0,0 in jsdom, the library takes each click for a divider drag and Radix menus never open. TipTap editors cannot be typed into with `userEvent`: a test sets the text of a paragraph inside the content-editable element and waits a tick for ProseMirror's mutation observer, then fires `blur` or clicks a toolbar button.

## E2E user data

The Electron fixture in `tests/e2e/fixtures/electron.ts` starts every test with an empty temporary directory passed as `LOOPY_USER_DATA`, which main applies with `app.setPath` before anything is read. A run never touches the settings, projects or themes of the machine it runs on.
