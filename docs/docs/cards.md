---
sidebar_position: 17
description: The Cards workspace, card templates, saved cards as internal assets, link fields and how board cards keep their values.
---

# Cards

Cards have their own workspace. A card template sets a layout and style once. A saved card is an internal asset with its own values, made from a template or with a layout of its own. A board card is an item on a board that shows a template, or follows a saved card.

## Cards workspace

The Cards workspace pairs the Card library with the Card designer. It ships in the default layout and as the Cards preset. If a saved layout lacks it, the app creates it the first time anything opens a card or template.

| Action                  | How                                                                                                                          |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Make a template         | New template in the library, then Blank card or a starter: Character, Item, Ability, Location or Quest                       |
| Make a card             | New card, then Blank card without a template or a template; or New card from this template while editing one                 |
| Open a template or card | Click it in the library. Card links, the board's Edit template and the Assets editor open the designer too                   |
| Fill in a card          | Type straight into the preview; Save card keeps the values                                                                   |
| Detach or attach        | Template in the card's header. No template copies the template's layout into the card, so its fields can change on their own |
| Turn a card into one    | Save as template on a card without a template creates the template and attaches the card to it                               |
| Place a card            | Drag it from the library or the Assets editor onto a board, a ticket, a note or a link field                                 |

The designer shows the field list on the left, a live preview in the middle and settings on the right. A card that uses a template shows only the preview and Edit template, because its layout belongs to the template. Drag fields by their grip to reorder them. Changes stay in the designer until Save template or Save card.

## Fields

Fields sit on a 12-column grid. Each has a width in the row (full, three quarters, two thirds, half, third or quarter), a label it can hide, and a text size, weight, colour and alignment.

| Kind       | Value                                        | Extra settings             |
| ---------- | -------------------------------------------- | -------------------------- |
| Heading    | Text, larger and bold by default             | Placeholder, default value |
| Text       | One line of text                             | Placeholder, default value |
| Long text  | Several lines                                | Placeholder, default value |
| Number     | A number                                     | Minimum, maximum, default  |
| Choice     | One of a list                                | Choices, default           |
| Checkbox   | Yes or no                                    | Default                    |
| Tags       | A list of short labels                       | Default, comma separated   |
| Image      | An image from assets                         |                            |
| Stat bar   | A number drawn as a bar                      | Minimum, maximum, default  |
| Colour     | A hex colour                                 | Default                    |
| Asset link | One or more boards, palettes, notes or cards | Links to, Allow several    |
| Divider    | None                                         |                            |

An asset link shows each target as the card a ticket's linked asset uses. Click it to open the target. Drop an internal asset on the field to set it; with Allow several the drop adds to the list. Links to limits the kinds, and a link to a deleted asset shows as Missing asset.

`coerceValue` in `src/renderer/lib/cards` checks every value against its field. A value that no longer fits, such as a removed choice or a link of a kind the field no longer takes, falls back to the field's default. Removing a field leaves its value on the card unused; adding it back with the same id brings the value back.

## Board cards

A card placed with the Card tool shows its template and keeps its values on the item. Dropping a saved card places a card that follows it: edits on the board, in Properties or in the designer show wherever it is placed. Properties offers Save as card asset for a template card, and Make independent copy for a following card. A copy needs a template, because a board item has no layout of its own.

Right-click a board card for Edit card or Edit card template. Edit card opens the saved card it follows, or else that board card itself in the designer: its name, template and values save back to the board, and Save as card asset turns it into a saved card it then follows. Edit card template opens the template, also for a following card.

A following card also keeps the values it last showed on the board. If the saved card is deleted, the board card stays with those values and its template.

## Model

Migration 10 adds `card_templates` with `id`, `name`, a `data` JSON column holding `width`, `height`, `style`, `accent`, `gap` and `fields`, and timestamps. Migration 16 adds `cards` with `folder_id`, `name`, a nullable `template_id`, a `layout` JSON column used only without a template, and `field_values`. It also rebuilds `asset_folders` to allow the `cards` scope. The schemas are in `src/shared/cards.ts`. Field ids must be unique within a layout.

Deleting a template copies its layout into every saved card that used it, so they become cards without a template. Board cards made with the Card tool keep their values and show them in a plain list until another template is chosen.

| Channel                                                                                      | Does                                                           |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `cardTemplates:list`, `cardTemplates:create`, `cardTemplates:update`, `cardTemplates:delete` | Template lifecycle; delete detaches saved cards first          |
| `cards:list`, `cards:create`, `cards:update`, `cards:delete`                                 | Saved cards; `templateId: null` in an update detaches the card |

A board card item stores `templateId`, `cardId` and `values`. A card link is `{ kind: 'card', id }` in board link items, ticket links and card values, and `[[card:Name]]` in notes. Renaming a saved card rewrites its note links; deleting it leaves them in place, shown as missing.

## Library

`src/renderer/lib/cards` keeps templates and saved cards, reloads them when the project changes, and exposes `useCardTemplates`, `useSavedCards`, `useBoardCard`, `resolveCardLayout`, the create, update, duplicate and delete actions, the field kinds and the starter templates. The components live in `src/renderer/components/editors/Cards`: `CardLibrary`, `CardDesigner`, `BoardCardDesigner` for a card on a board, `CardPreview`, `CardView`, one view per field kind in `fields/` and the settings panels in `settings/`. The designer's area state is `target`: a template, a saved card, or `{ kind: 'item', id, boardId }` for a board card.

## Adding a field kind

Each kind is one schema in `src/shared/cards/fields.ts`, joined into the `cardFieldSchema` union on `kind`. A field keeps only the keys its kind uses, so a stored field from an older shape parses and drops the rest on the next save; a stored default of the wrong type becomes no default.

| Step | Where                                                                                      |
| ---- | ------------------------------------------------------------------------------------------ |
| 1    | Schema and its place in `CARD_FIELD_KINDS` and the union in `src/shared/cards/fields.ts`   |
| 2    | Group, width, value type, text style and starting settings in `FIELD_KINDS` in `lib/cards` |
| 3    | View in `Cards/fields` and value settings in `Cards/settings/kindSettings.tsx`             |
| 4    | Name in `cards.kinds` in `editors.json`                                                    |

The view and settings maps are typed per kind, so a kind without a view fails the type check. Changing a field's kind with `changeFieldKind` keeps its id, label, width and style and starts the kind's own settings fresh.
