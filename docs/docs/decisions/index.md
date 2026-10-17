---
sidebar_position: 0
description: Architecture decision records for Loopy.
---

# Decisions

Hard-to-reverse choices are recorded here, one file each, with Context, Decision and Consequences. Add a record when you pick between frameworks, change a file format or set a convention the whole repository follows.

| Record                                  | Decision                                         |
| --------------------------------------- | ------------------------------------------------ |
| [0001](./0001-react-renderer.md)        | React for the renderer                           |
| [0002](./0002-npm.md)                   | npm as package manager                           |
| [0003](./0003-electron-vite.md)         | electron-vite as build tool                      |
| [0004](./0004-typescript-6.md)          | TypeScript 6 until typescript-eslint supports 7  |
| [0005](./0005-vitest.md)                | Vitest for unit, component and integration tests |
| [0006](./0006-playwright-electron.md)   | Playwright with the Electron driver for E2E      |
| [0007](./0007-no-cucumber.md)           | No Cucumber for now                              |
| [0008](./0008-versioned-persistence.md) | Versioned project files from day one             |
| [0009](./0009-scss-modules-tokens.md)   | SCSS Modules with tokens and cascade layers      |
| [0010](./0010-radix-primitives.md)      | Radix Primitives for interactive widgets         |
| [0011](./0011-storybook-later.md)       | Storybook deferred to iteration 2                |
| [0012](./0012-docusaurus.md)            | Docusaurus for documentation                     |
| [0013](./0013-commit-format.md)         | Conventional Commits without scope, squash merge |
| [0014](./0014-sqlite-project-file.md)   | One SQLite database per project, `.loopy`        |
| [0015](./0015-app-state-json.md)        | App settings and device state as JSON files      |
| [0016](./0016-internal-libraries.md)    | One internal library per concern                 |
| [0017](./0017-zustand.md)               | zustand for renderer state                       |
| [0018](./0018-i18next.md)               | i18next for translations                         |
| [0019](./0019-tiptap.md)                | TipTap for rich text                             |
