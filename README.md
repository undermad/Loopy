# Loopy

Desktop tool for game design and project management. Runs fully offline on Windows, macOS and Linux.

The product description will grow as features land. For now the repository holds a complete, tested Electron scaffold.

## Requirements

| Tool    | Version           |
| ------- | ----------------- |
| Node.js | 24 (see `.nvmrc`) |
| npm     | 11                |

## Run it locally

```bash
npm ci
```

```bash
cp .env.example .env
```

```bash
npm run dev
```

`npm ci` installs exactly what the lockfile says, then the `postinstall` script downloads the Electron binary and `prepare` installs the git hooks. Use `npm install <package>` only when you change dependencies, and commit the lockfile. `npm run dev` opens the app window with hot reload for the renderer and automatic restarts for the main process.

Dependencies may only run install scripts when listed in `allowScripts` in `package.json`. After adding a dependency, run `npm install-scripts ls` and approve or deny what it reports.

## Environment variables

Loaded from `.env` by the main process only and validated at startup. A missing or invalid value stops the app with a readable message.

| Variable          | Default | Purpose                                               |
| ----------------- | ------- | ----------------------------------------------------- |
| `LOOPY_LOG_LEVEL` | `info`  | Minimum log level: `debug`, `info`, `warn` or `error` |

`.env` is ignored by git. Commit changes to `.env.example` instead.

## Scripts

| Script                  | What it does                                                 |
| ----------------------- | ------------------------------------------------------------ |
| `npm run dev`           | Start the app with hot reload                                |
| `npm run build`         | Build main, preload and renderer into `out/`                 |
| `npm run package`       | Build and produce an unpacked app in `dist/`                 |
| `npm run lint`          | ESLint and Stylelint                                         |
| `npm run format:check`  | Prettier check (`npm run format` to write)                   |
| `npm run typecheck`     | TypeScript for all processes                                 |
| `npm run test`          | Unit, component and integration tests                        |
| `npm run test:coverage` | Same with coverage and thresholds                            |
| `npm run test:e2e`      | Playwright against the built app (run `npm run build` first) |
| `npm run test:all`      | Everything above                                             |
| `npm run knip`          | Unused files, exports and dependencies                       |
| `npm run secrets`       | Secret scan over the tree                                    |
| `npm run docs`          | Serve the documentation site                                 |

## Commits and pull requests

Commits follow `type: imperative summary`, no scope, 72 characters max. Allowed types: `feat`, `fix`, `perf`, `refactor`, `test`, `docs`, `build`, `ci`, `chore`, `revert`. `commitlint` enforces this on every commit.

Branches are named `type/short-description`. Pull request titles use the commit format because squash merge turns them into the commit on `main`. One concern per pull request. Required checks: `ci`, `coverage`, `security`.

Full details are in [CONTRIBUTING.md](CONTRIBUTING.md).

## Documentation

The documentation site lives in `docs/` and is built with Docusaurus. Run `cd docs && npm install` once, then `npm run docs` from the root. Every change to behaviour, tooling or conventions updates the matching page in the same commit.

## Before the first release

- Set the copyright holder in `LICENSE`.
- Set `url` and `organizationName` in `docs/docusaurus.config.ts` for GitHub Pages.
- Enable branch protection on `main` with the required checks above and squash merge only.

## Licence

MIT. See [LICENSE](LICENSE).
