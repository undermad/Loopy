---
description: TypeScript 6 until typescript-eslint supports 7.
---

# 0004 TypeScript 6 until typescript-eslint supports 7

## Context

TypeScript 7 shipped shortly before the scaffold. typescript-eslint pins TypeScript below 6.1 and would fail on 7.

## Decision

Stay on the latest 6.x.

## Consequences

Dependabot proposes the bump when typescript-eslint publishes support. Review that pull request rather than pinning further.
