---
description: electron-vite as build tool.
---

# 0003 electron-vite as build tool

## Context

Electron needs three bundles (main, preload, renderer) with different targets and a fast dev loop.

## Decision

electron-vite 6 on Vite 8, one config for all three processes.

## Consequences

The preload is emitted as CommonJS with dependencies bundled, because the sandboxed renderer cannot load ES modules or `node_modules`. Vite is shared with Vitest, so tests and builds see the same aliases.
