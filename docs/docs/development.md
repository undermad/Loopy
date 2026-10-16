---
sidebar_position: 4
description: Branches, commits, hooks, pull requests and what CI checks.
---

# Development workflow

## Branches

Branch from `main` as `type/short-description`, for example `feat/project-file-migrations`.

## Commits

Format: `type: imperative summary`. No scope, no trailing period, at most 72 characters. Add a body when the reason is not obvious. Use a footer for `BREAKING CHANGE:` or `Closes #12`.

| Type       | Use for                                              |
| ---------- | ---------------------------------------------------- |
| `feat`     | new user-visible behaviour                           |
| `fix`      | bug fix                                              |
| `perf`     | performance change with no behaviour change          |
| `refactor` | restructuring with no behaviour change               |
| `test`     | tests only                                           |
| `docs`     | documentation only                                   |
| `build`    | build system, packaging, dependencies                |
| `ci`       | workflows, hooks, Dependabot                         |
| `chore`    | anything that touches no source, test or docs        |
| `revert`   | reverts an earlier commit; name the hash in the body |

`commitlint` rejects any other type and any scope in parentheses.

## Hooks

| Hook         | Runs                                                                                                                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pre-commit` | On staged files: `eslint --fix`, `stylelint --fix`, Prettier, `secretlint`, `markdownlint-cli2`, `cspell`, the 1 MB file guard and the `.env` guard. Then `tsc` on the whole project |
| `commit-msg` | `commitlint`                                                                                                                                                                         |
| `pre-push`   | `npm run test:unit`                                                                                                                                                                  |

Hooks live in `.husky/`. The file-level commands are in `.lintstagedrc.json`.

## Dependencies

Use `npm ci` to install. Use `npm install <package>` only to add or update a dependency, and commit the lockfile with it.

npm runs a dependency's install script only when the package is listed in `allowScripts` in `package.json`. Unlisted scripts are skipped with a warning. After adding a dependency, run `npm install-scripts ls` and approve what the app needs or deny the rest, in the root and in `docs/`. The Electron binary is not an install script: the project's own `postinstall` downloads it with `install-electron`.

## Pull requests

- Title in the commit format. Squash merge turns it into the commit on `main`.
- One concern per pull request.
- Fill in the template: What, Why, How to test, Checklist.
- Required checks: `ci`, `coverage`, `security`.

## What CI runs

| Workflow     | When                                    | Checks                                                                                                                |
| ------------ | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `ci`         | every pull request and push to `main`   | lint, format, types, knip, actionlint, unit and integration tests, build, E2E and accessibility on Ubuntu and Windows |
| `coverage`   | every pull request                      | coverage with thresholds, summary comment on the pull request                                                         |
| `security`   | pull requests, pushes to `main`, weekly | gitleaks over full history, `npm audit`, CodeQL                                                                       |
| `post-merge` | push to `main`                          | full test run and packaging on Windows, macOS and Linux                                                               |
| `docs`       | changes under `docs/`                   | build the site, check links, deploy to GitHub Pages from `main`                                                       |

Dependabot opens grouped minor and patch updates weekly for npm (root and `docs/`) and for GitHub Actions. Majors arrive as separate pull requests.
