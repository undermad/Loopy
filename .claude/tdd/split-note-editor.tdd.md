# TDD evidence: Split note editor

Source plan: the inline `/ecc:plan` for a split view in Idea Map. No `*.plan.md` file was used.

## User journeys

- As a designer writing a note, I want the Markdown syntax and the rendered note side by side, so that I see the result while I type.
- As a designer, I want icons to switch between syntax only, split and rendered only, so that I can focus on one when I need to.
- As a designer with a Split note area, I want notes I open from Notes, the graph or links to land in that area, so that I do not get a second note area.

## RED

`npx vitest run tests/unit/renderer/NotesSplit.test.tsx tests/unit/renderer/LinkedAssets.test.tsx tests/unit/renderer/Notes.test.tsx`

- `NotesSplit.test.tsx`: `Failed to resolve import "@renderer/components/editors/Notes/SplitNoteEditor"` (compile-time RED, module missing)
- `LinkedAssets.test.tsx > opens a note in a split note area…`: `expected [ { kind: 'area', …(3) } ] to have a length of +0 but got 1`
- `Notes.test.tsx > opens a note link in the Idea Map workspace`: `expected { editor: 'note', …(3) } to deeply equal { editor: 'note', …(4) }`

## GREEN

- Same command: 30 passed. `NotesSplit.test.tsx` then gained a scroll sync test: 10 passed.
- `npx vitest run`: 140 files, 952 tests passed.
- `npm run build && npx playwright test tests/e2e/notes.spec.ts`: 2 passed.

## Test specification

| #   | What is guaranteed                                                                 | Test                                                                        | Type | Result |
| --- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ---- | ------ |
| 1   | Split note opens with syntax and rendered panes side by side, syntax shown raw     | `NotesSplit.test.tsx: shows the syntax and the rendered note side by side…` | unit | PASS   |
| 2   | Typing in the syntax pane saves the note and updates the rendered pane             | `NotesSplit.test.tsx: renders what is typed in the syntax pane`             | unit | PASS   |
| 3   | Syntax, Split and Rendered toggle the panes and are kept in area state as `view`   | `NotesSplit.test.tsx: switches between syntax, split and rendered…`         | unit | PASS   |
| 4   | A saved `view` is restored                                                         | `NotesSplit.test.tsx: opens in the view saved in area state`                | unit | PASS   |
| 5   | The divider resizes from the keyboard, clamped to 20–80%, saved as `ratio`         | `NotesSplit.test.tsx: resizes the panes from the keyboard within limits`    | unit | PASS   |
| 6   | The divider resizes by dragging, clamped, and stops after pointer up               | `NotesSplit.test.tsx: resizes the panes by dragging the divider`            | unit | PASS   |
| 7   | Links in the rendered pane navigate in the same area                               | `NotesSplit.test.tsx: follows links clicked in the rendered pane…`          | unit | PASS   |
| 8   | Tasks tick from the rendered pane                                                  | `NotesSplit.test.tsx: ticks a task from the rendered pane`                  | unit | PASS   |
| 9   | The rendered pane follows the syntax pane's relative scroll                        | `NotesSplit.test.tsx: keeps the rendered pane at the same relative scroll…` | unit | PASS   |
| 10  | With no note open, only the empty state shows                                      | `NotesSplit.test.tsx: shows the empty state without panes…`                 | unit | PASS   |
| 11  | Note links reuse a `noteSplit` area instead of adding a `note` area                | `LinkedAssets.test.tsx: opens a note in a split note area…`                 | unit | PASS   |
| 12  | The note link target lists `noteSplit` as an alternate                             | `Notes.test.tsx: opens a note link in the Idea Map workspace`               | unit | PASS   |
| 13  | In the built app: switch to Split note, type Markdown, see heading, bold and maths | `tests/e2e/notes.spec.ts: writes a note in the split editor…`               | e2e  | PASS   |

## Coverage and known gaps

`npx vitest run --coverage`: all files 95.79% statements, 88.63% branches. `NoteEditor.tsx` 98.68% lines (uncovered lines predate this change), `PaneDivider.tsx` 96.29% lines; line 34 (releasing pointer capture) is not reached because the jsdom stub reports no capture.

Scroll sync is proportional, not line-anchored. Switching an area to Split note from the editor switcher starts with no note open, because the switcher applies the editor's default state.

## Checkpoint commits

One commit, made after GREEN. Separate RED and GREEN commits were not possible: the pre-commit hook runs `npm run typecheck`, which failed on parallel `card` link work in the same checkout until that work was finished. The commit stages only the split note hunks in the files both pieces of work touched (`open.ts`, `NoteEditor.tsx`, `editors.json`, `notes.json`).
