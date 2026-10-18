# TDD evidence: Windows installer

Source plan: the `/ecc:plan` output in the session, steps 1 to 5. Branch `feat-installer`, commits `bd426b4..334e599`.

## User journeys

- As the developer, I want to install Loopy from a setup file, so that I can use it like any other Windows app.
- As the developer, I want `npm run dev` to keep its own data, so that a half-finished migration never touches my real projects.
- As a user, I want to double-click a `.loopy` file, so that it opens in Loopy, in the window I already have open if Loopy is running.
- As a user, I want to be asked before an import overwrites newer local work.

## Task report

| Step                 | Summary                                                                                                                  | RED                                                                                                                                                              | GREEN                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 2 Dev data           | `userDataOverride` picks `LOOPY_USER_DATA`, then `loopy-dev` when unpacked, else the default                             | `vitest run tests/unit/main/env.test.ts`: 3 failed, `userDataOverride` missing                                                                                   | 6 passed                                                                                   |
| 1 Installer          | NSIS per user, shortcuts, keep data on uninstall, `dist:win`, placeholder icon                                           | config only, no unit test                                                                                                                                        | `npm run dist:win` writes `dist/Loopy-Setup-0.1.0.exe` (171 MB); packaged smoke run passes |
| 3 Open from Explorer | `projectPathFromArgv`, `ProjectService.openFile`, replace prompt shared with File, Import, single-instance lock, dialogs | unit: module missing; integration: 6 failed, `openFile is not a function` and no prompt; e2e: both open-file specs fail on a build without the `index.ts` wiring | unit 6 passed, integration 12 passed, e2e 2 passed                                         |
| 4 Docs               | getting-started, tooling, architecture, projects, testing, development, ADR 0021                                         | n/a                                                                                                                                                              | markdownlint, cspell and Prettier pass in pre-commit                                       |
| 5 CI                 | `installer` job on `windows-latest` uploads `loopy-windows-installer`                                                    | n/a                                                                                                                                                              | not run yet; runs on the next push                                                         |

## Test specification

| #   | Guarantee                                                                                   | Test                                                                       | Type        | Result |
| --- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ----------- | ------ |
| 1   | `LOOPY_USER_DATA` wins for every build                                                      | `env.test.ts: uses LOOPY_USER_DATA when it is set`                         | unit        | PASS   |
| 2   | Unpacked builds use `loopy-dev`                                                             | `env.test.ts: keeps unpacked builds out of the installed app data`         | unit        | PASS   |
| 3   | The installed app keeps Electron's default                                                  | `env.test.ts: keeps the default for the installed app`                     | unit        | PASS   |
| 4   | A `.loopy` path is found in Explorer and dev argv, case-insensitively; switches are ignored | `open-file.test.ts: projectPathFromArgv` (4 tests)                         | unit        | PASS   |
| 5   | The replace dialog defaults to Keep mine; the error dialog names the file                   | `open-file.test.ts: replaceDialog, openFailedDialog`                       | unit        | PASS   |
| 6   | A file inside the projects directory opens by id without a copy                             | `project.test.ts: opens a file that is already in the library`             | integration | PASS   |
| 7   | An external file is imported, becomes current and is broadcast                              | `project.test.ts: imports an external file`                                | integration | PASS   |
| 8   | A missing file returns `NOT_FOUND` instead of throwing                                      | `project.test.ts: reports a missing file instead of throwing`              | integration | PASS   |
| 9   | A newer local copy is kept on decline, replaced on accept                                   | `project.test.ts: keeps a newer local copy`, `replaces a newer local copy` | integration | PASS   |
| 10  | File, Import asks before replacing newer work and cancels on decline                        | `project.test.ts: asks before File, Import replaces`                       | integration | PASS   |
| 11  | A `.loopy` path in argv opens the project at launch                                         | `open-file.spec.ts: opens a project file passed on the command line`       | e2e         | PASS   |
| 12  | A second launch hands its file to the running window and exits 0                            | `open-file.spec.ts: hands a file opened while Loopy runs`                  | e2e         | PASS   |

## Coverage and gaps

`npm run test:coverage`: 133 files, 879 tests passed; statements 95.84, branches 88.62, functions 95.25, lines 96.96, all above the 85 thresholds. `npm run test:e2e`: 17 passed.

Gaps: the installer itself (install, shortcuts, uninstall keeping `%APPDATA%\Loopy`) was built but not run through its wizard; that needs a manual install. `src/main/index.ts` is excluded from coverage by config; its wiring is covered by the two e2e specs. The CI job has not run yet. `npm run lint` from the repo root also reports 20 errors in a stale `drawing` checkout under `.claude/` that predate this work; `eslint src tests` is clean.
