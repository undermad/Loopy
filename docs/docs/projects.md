---
sidebar_position: 10
description: The welcome screen, the projects directory, the recent list, and the project channels.
---

# Projects

## Welcome screen

With no project open the renderer shows `WelcomeScreen` from `src/renderer/components/Welcome`: New project, Open file, the projects in the projects directory, and the recent list. Creating or opening a project replaces it with the workspaces. Closing the project brings it back.

Open file imports: the chosen `.loopy` file is copied into the projects directory and the copy is opened, so a file on removable or synced storage is never written live. The hint under the button says so.

## Where projects live

`userData/projects/<id>.loopy`, one file per project, named by the project id stored inside it. The main process keeps at most one project open. `state.json` holds the ten most recently opened projects with their names, so the welcome screen can show a recent entry even after its file is gone, greyed out with a Remove action.

## Library and channels

`src/renderer/lib/project` owns the current project, the directory listing and the recent list, and refreshes the listing whenever main pushes `project:changed`.

| Channel                                                    | Does                                                                    |
| ---------------------------------------------------------- | ----------------------------------------------------------------------- |
| `project:list`                                             | Every readable project in the directory, newest opened first            |
| `project:create`                                           | Creates and opens a project with the given name                         |
| `project:open`                                             | Opens by id; returns `opened` or `failed` with a code, never throws     |
| `project:close`, `project:state`                           | Closes the current project; returns current and recent                  |
| `project:import`, `project:export`                         | File dialogs in main, then copy in or `VACUUM INTO` out                 |
| `project:delete`, `project:reveal`, `project:removeRecent` | Removes the file, shows it in the file manager, trims the recent list   |
| `project:changed`                                          | Pushed from main whenever the current project or the recent list change |

Every handler takes its dialogs and the device state store as dependencies, so `tests/integration/ipc/project.test.ts` runs the whole flow against a temporary directory.
