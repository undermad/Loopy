---
sidebar_position: 10
description: Creating, saving, opening and recovering projects, the recent list, and the project channels.
---

# Projects

A project is a `.loopy` file the user saves wherever they choose. While it is open, Loopy edits a working copy and writes the file only on Save. See ADR 0022.

## Welcome screen

With no project open the renderer shows `WelcomeScreen` from `src/renderer/components/Welcome`: New project, Open file, recovered work if any, and Recent.

| Area                 | Does                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------ |
| New project          | Opens `ProjectCreateView` with the name set to Untitled. Create opens the project without saving |
| Open file            | System open dialog, any folder. The file is copied to a working copy and opened                  |
| Recover unsaved work | Work left by a crash. Restore opens it with its changes still unsaved; Discard deletes it        |
| Recent               | The last ten files by path. A missing file is greyed out; the menu shows it or removes it        |

`ProjectDetails` in `src/renderer/components/ProjectDetails` holds the project fields. The creation view and File › Project settings… both use it, so a new required field is added once.

## Saving

| Action                | Result                                                                    |
| --------------------- | ------------------------------------------------------------------------- |
| File › Save, `Ctrl+S` | Writes to the saved path. An untitled project asks for a location first   |
| File › Save as…       | Asks for a location and keeps saving there                                |
| Any data write        | Marks the project unsaved: `•` in the window title, Unsaved in status bar |

Save writes a snapshot to a temporary file beside the target, then renames it over the target. A failed save keeps the changes marked unsaved and shows a toast.

## Unsaved work prompt

Main asks Save, Don't save or Cancel when the project was never saved or has unsaved changes. A saved project with no changes closes without asking.

The prompt runs before quit, the window close button, File › Quit, Close project, New project, Open, Restore, and a file opened from Explorer. File › Quit goes through `app:quit` so main can ask; a renderer `window.close()` would skip the prompt.

## Recovery

Working copies live in `userData/working/<id>.loopy` beside a `<id>.json` manifest with the saved path, the name and the unsaved flag. A clean shutdown deletes them. Any left at startup came from a crash, because Loopy holds a single-instance lock. `collectOrphans` keeps those with unsaved work and deletes the rest.

## Opening from Explorer

The installer registers `.loopy` with Loopy. `projectPathFromArgv` in `src/main/open-file.ts` finds the path in `argv` and `ProjectService.openFile` opens it. A second launch passes its `argv` to the running app through `second-instance` and quits. A missing or unreadable file shows an error dialog naming it.

## Library and channels

`src/renderer/lib/project` owns the current project, its path and unsaved flag, the recent list, recoverable work and the creation view flag. It refreshes on `project:changed`.

| Channel                                      | Does                                                                 |
| -------------------------------------------- | -------------------------------------------------------------------- |
| `project:create`                             | Opens an untitled project with the given name, after the prompt      |
| `project:open`, `project:openRecent`         | Open dialog, or a path from the recent list; never throws on failure |
| `project:save`, `project:saveAs`             | Saves; returns `saved`, `cancelled` or `failed`                      |
| `project:rename`                             | Renames the open project and marks it unsaved                        |
| `project:close`, `project:state`             | Closes after the prompt; returns current, path, flags and lists      |
| `project:recover`, `project:discardRecovery` | Restores or deletes crash leftovers offered at startup               |
| `project:list`                               | Recent files with a `missing` flag                                   |
| `project:reveal`, `project:removeRecent`     | Act on a path from the recent list only                              |
| `project:changed`                            | Pushed from main whenever any of the above changes                   |

Handlers take their dialogs, the save prompt and the device state store as dependencies, so `tests/integration/ipc/project.test.ts` runs every flow against a temporary directory. `tests/e2e/project-file.spec.ts` covers quitting and crash recovery in the built app.

## Upgrading

Version 2 of `state.json` stores recent projects by path. Its migration points old entries at `userData/projects/<id>.loopy`, so projects from earlier builds open from Recent and save in place.
