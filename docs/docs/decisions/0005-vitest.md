---
description: Vitest for unit, component and integration tests.
---

# 0005 Vitest for unit, component and integration tests

## Context

The project needs one fast runner for Node code, React components and file-system integration tests.

## Decision

Vitest 5 with three projects (`unit`, `renderer`, `integration`), v8 coverage and an 80 percent threshold.

## Consequences

Jest is not used. Snapshots are Vitest snapshots and are limited to stable presentational components.
