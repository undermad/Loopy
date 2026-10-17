# Loopy

Electron desktop app for game design and project management. Local-only for now. React 19 renderer, TypeScript 6, electron-vite, Vitest, Playwright.

## Commands

| Task                                  | Command                                                     |
| ------------------------------------- | ----------------------------------------------------------- |
| Run the app with HMR                  | `npm run dev`                                               |
| Build all processes                   | `npm run build`                                             |
| Lint, format check, type check        | `npm run lint`, `npm run format:check`, `npm run typecheck` |
| Unit, component and integration tests | `npm run test`                                              |
| Coverage with thresholds              | `npm run test:coverage`                                     |
| E2E against the built app             | `npm run build && npm run test:e2e`                         |
| Dead code and unused dependencies     | `npm run knip`                                              |
| Docs site                             | `npm run docs`                                              |

## Where code goes

- `src/main`: Electron main process. Window creation, IPC handlers, services, versioned storage, env loading.
- `src/preload`: the only bridge between renderer and main. Thin, typed, validates replies.
- `src/renderer`: React app. Components live in `components/<Name>/<Name>.tsx` with `<Name>.module.scss` beside them.
- `src/shared`: types and zod schemas used by more than one process. IPC channel names live here.
- `tests/unit`, `tests/integration`, `tests/e2e`: see the testing page in `docs/`.

## Conventions

- No explanatory comments in code. Two exceptions: a one-line note where behaviour is genuinely surprising, and `TODO(name):` for a known gap. Everything else belongs in `docs/`.
- Every change to behaviour, tooling or scripts updates the matching page in `docs/docs` in the same commit. Follow `.claude/skills/writing-docs/SKILL.md` for style.
- Commits: `type: imperative summary`, no scope, 72 characters max. Types: feat, fix, perf, refactor, test, docs, build, ci, chore, revert.
- Styling: design tokens are CSS custom properties in `src/renderer/styles/tokens.scss`. Components use SCSS Modules. Cascade layer order is declared in `global.scss`. No autoprefixer; Electron ships one Chromium.
- Renderer never touches Node. New IPC channels get a name in `src/shared/ipc.ts`, a zod schema, a handler in `src/main/ipc`, a method in `src/preload`, and a test in `tests/integration/ipc`.
- Projects are SQLite files (`.loopy`) with `user_version`; settings and device state are JSON files with `schemaVersion`, all under the user data directory. A project schema change appends a SQL migration to `src/main/storage/project-migrations.ts`; a settings or state change adds a migration in its store under `src/main/storage`. Each gets a test in `tests/integration/storage`.
- TypeScript stays on 6.x until typescript-eslint supports 7. Dependabot will open the PR.
