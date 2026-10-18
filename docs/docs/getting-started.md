---
sidebar_position: 2
description: Install, configure and run Loopy locally.
---

# Getting started

## Requirements

| Tool    | Version                   |
| ------- | ------------------------- |
| Node.js | 24, as pinned in `.nvmrc` |
| npm     | 11                        |

## Install and run

```bash
npm ci
cp .env.example .env
npm run dev
```

`npm ci` installs exactly what the lockfile says. Two project scripts then run: `postinstall` downloads the Electron binary with `install-electron`, and `prepare` installs the git hooks through husky. `npm run dev` starts electron-vite: the renderer gets hot module replacement, the main process restarts on change, and the app window opens on its own.

If `npm run dev` fails with `Error: Electron uninstall`, the binary is missing. Run `npx install-electron`.

## Environment variables

The main process reads `.env` at startup and validates it with a zod schema in `src/main/env.ts`. An invalid value stops the app with a message naming the variable.

| Variable          | Default | Purpose                                               |
| ----------------- | ------- | ----------------------------------------------------- |
| `LOOPY_LOG_LEVEL` | `info`  | Minimum log level: `debug`, `info`, `warn` or `error` |
| `LOOPY_USER_DATA` | none    | Directory for settings, state and projects            |

`.env` is ignored by git and rejected by a pre-commit guard. Add new variables to `.env.example` and to the schema in the same commit.

## Build and package

```bash
npm run build
npm run package
```

`build` writes main, preload and renderer bundles to `out/`. `package` runs electron-builder in directory mode and writes an unpacked app to `dist/win-unpacked`.

## Install on Windows

```bash
npm run dist:win
```

The script writes `dist/Loopy-Setup-<version>.exe`. Run it to install Loopy for the current user, with no administrator prompt. It adds Start menu and desktop shortcuts, an entry in Installed apps, and registers `.loopy` files.

The installer is not signed, so SmartScreen warns on first run. Choose More info, then Run anyway.

Uninstalling keeps `%APPDATA%\Loopy`, so projects and settings survive a reinstall. `npm run dev` uses `%APPDATA%\loopy-dev` and never touches them; the architecture page lists the directories.

## Documentation site

```bash
cd docs && npm ci
cd .. && npm run docs
```

The site has its own `package.json` so Docusaurus dependencies stay out of the app.
