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

A following card also keeps the values it last showed on the board. If the saved card is deleted, the board card stays with those values and its template.

## Model

Migration 10 adds `card_templates` with `id`, `name`, a `data` JSON column holding `width`, `height`, `style`, `accent`, `gap` and `fields`, and timestamps. Migration 16 adds `cards` with `folder_id`, `name`, a nullable `template_id`, a `layout` JSON column used only without a template, and `field_values`. It also rebuilds `asset_folders` to allow the `cards` scope. The schemas are in `src/shared/cards.ts`. Field ids must be unique within a layout.

Deleting a template copies its layout into every saved card that used it, so they become cards without a template. Board cards made with the Card tool keep their values and show them in a plain list until another template is chosen.

| Channel                                                                                      | Does                                                           |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `cardTemplates:list`, `cardTemplates:create`, `cardTemplates:update`, `cardTemplates:delete` | Template lifecycle; delete detaches saved cards first          |
| `cards:list`, `cards:create`, `cards:update`, `cards:delete`                                 | Saved cards; `templateId: null` in an update detaches the card |

A board card item stores `templateId`, `cardId` and `values`. A card link is `{ kind: 'card', id }` in board link items, ticket links and card values, and `[[card:Name]]` in notes.

## Library

`src/renderer/lib/cards` keeps templates and saved cards, reloads them when the project changes, and exposes `useCardTemplates`, `useSavedCards`, `useBoardCard`, `resolveCardLayout`, the create, update, duplicate and delete actions, the field kinds and the starter templates. The components live in `src/renderer/components/editors/Cards`: `CardLibrary`, `CardDesigner`, `CardView` and `TemplateSettings`. A new field kind is an entry in `CARD_FIELD_KINDS`, its value rule in `FIELD_KINDS`, a case in `CardView` and a label in `editors.json`.
