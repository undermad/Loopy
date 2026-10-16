---
description: Versioned project files from day one.
---

# 0008 Versioned project files from day one

## Context

Users will keep project files on disk for years. A file written by one version must open in every later version.

## Decision

Every project file carries `schemaVersion`. Loading runs migrations up to the current version, then validates with zod. Writes go through a temporary file and a rename.

## Consequences

A format change always adds a migration and a test that loads a file from the previous version. The migration runner is tested independently of the current schema.
