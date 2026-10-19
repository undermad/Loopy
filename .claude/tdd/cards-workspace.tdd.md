# TDD evidence: Cards workspace, saved cards and link fields

Source plan: the inline `/ecc:plan` for moving card design into its own workspace. No `*.plan.md` file was used. Open questions were settled with the recommended answers: a dropped saved card follows the saved card live, a link field holds one target with an Allow several toggle, and links point at internal assets only.

## User journeys

- As a designer, I want card templates designed in a Cards workspace, so that the board stays a canvas.
- As a designer, I want to save filled-in cards, with or without a template, as internal assets, so that I can reuse and file them like boards and notes.
- As a designer, I want to drop a saved card on a board, ticket, note or link field, so that it shows up wherever I plan.
- As a designer, I want a template field that links boards, palettes, notes or cards, so that a card can point at related work.

## RED

Pre-commit runs `npm run typecheck`, so a test-only commit could not land. RED was checked by running each new test before the code existed.

| Test target                                                         | RED output                                                                             |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `tests/unit/shared/cards.test.ts`                                   | `ZodError` on link values; `expected [ 'board', 'palette', 'note' ] to include 'card'` |
| `tests/integration/storage/cards-migration.test.ts`                 | `CHECK constraint failed: scope IN ('files', 'boards', 'palettes', 'notes')`           |
| `tests/integration/ipc/saved-cards.test.ts`                         | `promise resolved "undefined" instead of rejecting`; handlers missing                  |
| `tests/unit/renderer/lib/saved-cards.test.tsx`                      | `linkTargets is not a function`, `useSavedCards is not a function`                     |
| `tests/unit/renderer/AssetsCards.test.tsx`                          | `Unable to find role="tree" and name "Cards"`                                          |
| `tests/unit/renderer/CardLinkField.test.tsx`                        | `Unable to find role="group" and name "Home"`                                          |
| `tests/unit/renderer/CardsWorkspace.test.tsx`                       | `Failed to resolve import "@renderer/components/editors/Cards/CardLibrary"`            |
| `BoardCardsCoverage.test.tsx`, `BoardCoverage.test.tsx` (new cases) | Board still imported the removed `TemplateEditorDialog`                                |

## GREEN

| #   | What is guaranteed                                                                                                           | Test                                                                  | Type              |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------- |
| 1   | Card values accept one link or a list; `card` is a board, note and ticket link kind                                          | `tests/unit/shared/cards.test.ts`                                     | unit              |
| 2   | Migration 16 keeps every folder's scope, parent and owner, allows `cards`, and clears `template_id` when a template goes     | `tests/integration/storage/cards-migration.test.ts`                   | integration       |
| 3   | Saved cards create, rename, file, detach, reattach and delete; wrong folders, unknown templates and duplicate field ids fail | `tests/integration/ipc/saved-cards.test.ts`                           | integration       |
| 4   | Deleting a template turns its saved cards into cards with the template's layout                                              | `saved-cards.test.ts`, `lib/saved-cards.test.tsx`                     | integration, unit |
| 5   | Link values keep allowed kinds, drop duplicates and follow Allow several                                                     | `lib/saved-cards.test.tsx`                                            | unit              |
| 6   | Saved cards have a Cards tree, a File types entry and a delete action in Assets                                              | `AssetsCards.test.tsx`                                                | component         |
| 7   | Link fields show targets, open them, remove them and accept dropped assets                                                   | `CardLinkField.test.tsx`                                              | component         |
| 8   | The Cards workspace and preset exist; templates and cards open in the designer                                               | `CardsWorkspace.test.tsx`                                             | component         |
| 9   | The designer builds templates, makes cards from them, detaches, saves as template, duplicates and deletes                    | `CardsWorkspace.test.tsx`                                             | component         |
| 10  | The library lists, opens and drags saved cards                                                                               | `CardsWorkspace.test.tsx`                                             | component         |
| 11  | A dropped saved card becomes a board card that follows it; Properties saves, follows and copies                              | `BoardCoverage.test.tsx`, `BoardCardsCoverage.test.tsx`               | component         |
| 13  | Renaming a saved card rewrites `[[card:…]]` links in notes; `card:` parses as a link kind                                    | `saved-cards.test.ts`, `markdown.test.ts`, `lib/saved-cards.test.tsx` | integration, unit |
| 12  | The template, card and Assets flow works in the built app                                                                    | `tests/e2e/cards.spec.ts`                                             | e2e               |

Commands run: `npm run typecheck`, `npm run lint` (clean for `src` and `tests`), `npm run format:check`, `npm run knip`, `npm run test`, `npm run test:coverage` (95.57% statements, 88.51% branches overall), `npm run build`, `npx playwright test` (23 passed).

## Known gaps

- `npm run lint` also reports errors in a leftover checkout of the repository under `.claude`, outside this change.
- Designer edits do not rewrite the values stored on board items that follow a saved card. Those items show the live card and keep their own last values only for when the saved card is deleted.

## Follow-up: card links in notes

RED: `saved-cards.test.ts > rewrites card links in notes…` failed with `expected 'Lead: [[card:Knight]]…' to be 'Lead: [[card:Paladin]]…'`, and `markdown.test.ts` showed `parseLinkText('card:Knight|the hero')` returned `kind: 'note'`. `KIND_PREFIX` in `src/shared/markdown.ts` listed kinds by hand and missed `card`; it now comes from `LOOPY_LINK_KINDS`. GREEN: `cards:update` runs through `trackRename` with `card` in `NAMED_TABLES`.
