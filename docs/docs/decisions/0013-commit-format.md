---
description: Conventional Commits without scope, squash merge.
---

# 0013 Conventional Commits without scope, squash merge

## Context

Commit history should be readable and usable for a changelog, with as little ceremony as possible.

## Decision

`type: summary` with no scope, enforced by commitlint. Pull request titles use the same format. Squash merge only.

## Consequences

Release automation can generate `CHANGELOG.md` and version bumps later. Branch protection must enable squash merge and disable the other merge methods.
