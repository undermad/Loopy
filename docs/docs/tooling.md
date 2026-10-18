---
sidebar_position: 7
description: One paragraph per tool and why it is in the repository.
---

# Tooling

**electron-vite** builds main, preload and renderer from one config and gives the renderer hot module replacement. It replaces hand-written Vite configs per process.

**electron-builder** packages the app. Only directory mode is wired today; installers and signing come with the first release.

**TypeScript 6** with strict options, `noUncheckedIndexedAccess` and `noPropertyAccessFromIndexSignature`. TypeScript 7 waits for typescript-eslint support.

**Vitest** runs unit, component and integration tests in three projects with v8 coverage and an 85 percent threshold.

**Playwright** drives the built Electron app for E2E tests. **axe-core** runs inside it for accessibility checks.

**ESLint** with typescript-eslint's strict type-checked rules, React and React Hooks plugins. **Stylelint** with the standard SCSS config and property ordering. **Prettier** formats everything; ESLint and Stylelint defer to it.

**knip** finds unused files, exports and dependencies. It runs in CI so dead code cannot accumulate.

**secretlint** scans staged files for secrets before every commit. **gitleaks** scans the whole history in CI.

**markdownlint-cli2** and **cspell** keep documentation consistent and free of typos. Project words go in `cspell-words.txt`.

**husky** installs the git hooks, **lint-staged** runs tools on staged files only, **commitlint** enforces the commit format.

**dotenv** loads `.env` in the main process; **zod** validates it, every IPC payload, the settings and state files and project metadata.

**Dependabot** opens weekly grouped updates for npm and GitHub Actions.

**Docusaurus** builds this site from `docs/docs` with offline search and dark mode.
