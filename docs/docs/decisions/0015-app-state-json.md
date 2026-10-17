---
description: App settings and device state live in two JSON files outside any project.
---

# 0015 App settings and device state as JSON files

## Context

Theme, font and window placement describe the person and the machine, not the work. They must not travel with an exported project or change when the user switches projects.

## Decision

Two JSON files under the user data directory: `settings.json` for preferences the user edits deliberately and `state.json` for device state the app rewrites on its own. Both carry `schemaVersion`, run through the migration runner from ADR 0008 and validate with zod schemas in `src/shared`, which supply defaults for missing keys. Project-level settings such as colour schemes stay inside the `.loopy` file.

## Consequences

A fresh install needs no setup step and a lost `state.json` costs nothing. Adding a key with a default needs no migration. The two files stay independent of each other and of any project, so a user can back up `settings.json` alone.
