---
description: No Cucumber for now.
---

# 0007 No Cucumber for now

## Context

Cucumber and Gherkin were considered for API tests. Loopy has no HTTP API; its API is the IPC contract between renderer and main.

## Decision

Test the IPC contract directly in Vitest. Do not add Cucumber in the scaffold.

## Consequences

Add Cucumber when a non-developer stakeholder reads or writes acceptance criteria, or when an HTTP API appears. It would sit on top of the IPC and persistence layers.
