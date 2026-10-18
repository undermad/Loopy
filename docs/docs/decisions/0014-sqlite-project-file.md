---
description: One SQLite database per project, stored by the app and shared as a .loopy file.
---

# 0014 One SQLite database per project, `.loopy`

Where the file lives and when it is written is superseded by [0022](./0022-save-based-project-files.md). The file format stands.

## Context

A project holds boards with text, images, diagrams and tasks that reference each other and reuse assets. A JSON document would need its own foreign keys, would carry images as base64 and would be rewritten whole on every save. The user should never manage files or folders; the app owns the storage and offers export and import.

## Decision

Each project is one SQLite database at `projects/<id>.loopy` under the user data directory, opened through `node:sqlite`. The file carries a fixed `application_id` and a `user_version`; SQL migrations run in order on open. Export is `VACUUM INTO` a copy, import is a copy into the projects directory. The `.loopy` extension is registered with the operating system through `electron-builder.yml`.

## Consequences

The export format is the working format, so there is nothing to keep in sync. Assets will live inside the database, content-addressed by hash, and reach the renderer through a custom protocol rather than base64 over IPC. Schema changes are append-only SQL migrations with a test that opens the previous version. The renderer never holds a database handle. ADR 0008 keeps its principle; its JSON mechanism now applies to settings and device state only.
