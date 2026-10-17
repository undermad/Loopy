---
description: Each concern is an internal library with one entry point, consumed by components.
---

# 0016 One internal library per concern

## Context

The UI shell brings several concerns that every screen touches: themes, translations, the layout tree, workspaces, shortcuts, settings. Spread across components, they would couple everything to everything and make any one of them hard to test or replace.

## Decision

Each concern is a library under `src/renderer/lib/<name>` with a single `index.ts` as its public surface. Libraries hold logic, state, hooks and bindings but no components. Components in `src/renderer/components` compose libraries. Dependencies point one way, `shared` to `lib` to `components` to `App`. Deep imports into a library and imports of components from one are rejected in review; the lint configuration is not extended for this. The pure core of each library takes its collaborators as arguments and is tested without React or Electron. `.claude/skills/internal-libraries/SKILL.md` holds the rules and the checklist.

## Consequences

A consumer imports one path per concern and gets only what it needs. A library can be rewritten behind its index without touching components. `knip` keeps the public surface minimal. The cost is one more folder level and the discipline of adding the alias path rather than a relative import when one library needs another.
