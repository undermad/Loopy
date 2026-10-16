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
npm install
cp .env.example .env
npm run dev
```

`npm install` also installs the git hooks through husky. `npm run dev` starts electron-vite: the renderer gets hot module replacement, the main process restarts on change, and the app window opens on its own.

## Environment variables

The main process reads `.env` at startup and validates it with a zod schema in `src/main/env.ts`. An invalid value stops the app with a message naming the variable.

| Variable          | Default | Purpose                                               |
| ----------------- | ------- | ----------------------------------------------------- |
| `LOOPY_LOG_LEVEL` | `info`  | Minimum log level: `debug`, `info`, `warn` or `error` |

`.env` is ignored by git and rejected by a pre-commit guard. Add new variables to `.env.example` and to the schema in the same commit.

## Build and package

```bash
npm run build
npm run package
```

`build` writes main, preload and renderer bundles to `out/`. `package` runs electron-builder in directory mode and writes an unpacked app to `dist/`. Installers and code signing are not configured yet.

## Documentation site

```bash
cd docs && npm install
cd .. && npm run docs
```

The site has its own `package.json` so Docusaurus dependencies stay out of the app.
