---
description: Projects are edited in a working copy and saved to a file the user chooses, with recovery after a crash.
---

# 0022 Project files saved where the user chooses

## Context

ADR 0014 kept every project in `userData/projects` and wrote each edit straight into it. Users could not choose where a project lives, could not start one without it being stored, and had no notion of unsaved changes. They asked for a desktop document model: create first, save later, choose the folder, be asked before quitting with unsaved work, and get work back after a crash.

## Decision

Each open project is a working copy in `userData/working/<id>.loopy`, with a `<id>.json` manifest holding the saved path and an unsaved-changes flag. Edits go to the working copy as before. Save writes a `VACUUM INTO` snapshot to a temporary file beside the target and renames it over the target. Recent projects are remembered by path.

Main owns the unsaved-work prompt. It runs before quit, window close, File › Quit, closing, creating or opening another project, and an Explorer open. A working copy left at startup came from a crash, because the single-instance lock rules out a second running copy, and the welcome screen offers it for recovery.

## Consequences

The file format is unchanged, so old files open normally. Saving rewrites the whole file, which costs time on projects with large assets. Writes are marked unsaved by the `syncingIpc` wrapper, so a new data channel is tracked as long as it goes through that wrapper. Recovery needs no autosave timer, because SQLite in WAL mode keeps each edit on disk.
