# Contributing to Loopy

## Setup

1. Install Node 24 and npm 11. `.nvmrc` holds the Node version.
2. Run `npm install`. This also installs the git hooks.
3. Copy `.env.example` to `.env`.
4. Run `npm run dev`.

The documentation site has its own dependencies: `cd docs && npm install`, then `npm run docs` from the root.

## Branches

Branch from `main` as `type/short-description`, for example `feat/project-file-migrations` or `fix/editor-focus`.

## Commits

Format: `type: imperative summary`. No scope, no trailing period, at most 72 characters. Add a body when the why is not obvious. Use a footer for `BREAKING CHANGE:` or `Closes #12`.

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

Examples:

```text
feat: add schemaVersion and migration runner
fix: keep focus in editor after save
ci: run E2E on windows as well as ubuntu
```

`commitlint` rejects any other format at commit time.

## Hooks

| Hook         | Runs                                                                                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pre-commit` | `eslint --fix` and `stylelint --fix`, Prettier, `secretlint`, `markdownlint-cli2`, `cspell`, the 1 MB file guard, the `.env` guard, then `tsc` on the whole project |
| `commit-msg` | `commitlint`                                                                                                                                                        |
| `pre-push`   | unit and component tests                                                                                                                                            |

Slow checks (integration, E2E, coverage, knip) run in CI, not in hooks.

## Pull requests

- Title in the commit format. Squash merge turns it into the commit on `main`.
- One concern per pull request. A refactor and a feature are two pull requests.
- Fill in the template: What, Why, How to test, Checklist.
- Required checks: `ci`, `coverage`, `security`. They are configured as required in branch protection.

## Documentation

Any change to behaviour, tooling, scripts or conventions updates the matching page under `docs/docs` in the same pull request. Style rules are in `.claude/skills/writing-docs/SKILL.md`.

## Code comments

Do not add explanatory comments. If something is genuinely surprising, one line is allowed. Known gaps use `TODO(name):`. Everything else goes in the docs.
