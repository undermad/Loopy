---
description: zustand holds renderer state outside React, behind each library's hooks.
---

# 0017 zustand for renderer state

## Context

Settings, themes, workspaces and the layout tree are read by many components and written by a few. React context re-renders every consumer on each change, and drag gestures update the layout tree dozens of times a second.

## Decision

Each internal library owns a vanilla zustand store and exposes hooks and actions, never the store itself. Stores are created with `createStore` so the pure core can be driven from tests without React, and components subscribe through `useStore` with selectors.

## Consequences

A drag re-renders only the areas whose sizes changed. Libraries stay testable with a fake API and no DOM. The cost is one more dependency and the discipline of keeping store shapes private.
