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

Fields sit on a 12-column grid. Add field lists the kinds in groups: text, numbers, choices, media, references and layout. A new field gets an id taken from its label, such as `max_health`, and keeps it when the label changes, so values and future exports stay stable.

Field settings always come in the same order, and each group folds away:

| Section    | Holds                                                                         |
| ---------- | ----------------------------------------------------------------------------- |
| Basics     | Field type, label, show label                                                 |
| Value      | What the kind needs: placeholder, choices, bounds, prefix and suffix, default |
| Layout     | Width in the row: full, three quarters, two thirds, half, third or quarter    |
| Text style | Size, weight, alignment and colour, for kinds that show text                  |
| Advanced   | Help text, shown on an info mark beside the label, and Hide on card           |

A hidden field keeps its value and shows, dimmed, in the designer and in Properties, but not on the card face.

| Group      | Kind            | Value                                                          | Extra settings                             |
| ---------- | --------------- | -------------------------------------------------------------- | ------------------------------------------ |
| Text       | Heading         | Text, larger and bold by default                               | Placeholder, default                       |
| Text       | Text, Long text | One line or several                                            | Placeholder, default                       |
| Text       | Date            | A calendar date                                                |                                            |
| Numbers    | Number          | A number, held inside its bounds                               | Minimum, maximum, default, prefix, suffix  |
| Numbers    | Stat bar        | A number drawn as a bar                                        | Minimum, maximum, default, prefix, suffix  |
| Numbers    | Rating          | Stars, hearts, circles or pips; click the current one to clear | Maximum up to 10, symbol, default          |
| Numbers    | Range           | A low and a high number, kept in order                         | Minimum, maximum, prefix, suffix           |
| Numbers    | Attributes      | A number per named row                                         | One row per line                           |
| Numbers    | Formula         | Worked out from other fields, never typed                      | Formula, decimal places, prefix, suffix    |
| Numbers    | Dice            | Dice notation such as `2d6+1`, with its range and average      | Default                                    |
| Choices    | Choice          | One of a list                                                  | Choices with colours, placeholder, default |
| Choices    | Multiple choice | Any of a list                                                  | Choices with colours                       |
| Choices    | Checkbox        | Yes or no                                                      | Default                                    |
| Choices    | Tags            | Short labels                                                   | Default, comma separated                   |
| Choices    | Checklist       | Steps to tick, with a done count                               |                                            |
| Media      | Image           | An image from assets                                           |                                            |
| Media      | Icon            | One of the game icons                                          |                                            |
| Media      | Colour          | A hex colour                                                   | Default                                    |
| References | Asset link      | One or more boards, palettes, notes or cards                   | Links to, Allow several                    |
| Layout     | Static text     | Fixed text the template writes on every card                   | Text                                       |
| Layout     | Divider, Spacer | A line, or empty space of a set height                         | Height for a spacer                        |

An asset link shows each target as the card a ticket's linked asset uses. Click it to open the target. Drop an internal asset on the field to set it; with Allow several the drop adds to the list. Links to limits the kinds, and a link to a deleted asset shows as Missing asset.

`coerceValue` in `src/renderer/lib/cards` checks every value against its field. A value that no longer fits, such as a removed choice or a link of a kind the field no longer takes, falls back to the field's default. Removing a field leaves its value on the card unused; adding it back with the same id brings the value back.

### Formulas

A formula names other fields by id: `attack * 2 + level`. It knows numbers, `+ - * / % ^`, brackets, the comparisons `== != > < >= <=`, which give 1 or 0, and `min`, `max`, `round`, `floor`, `ceil`, `abs`, `sqrt`, `clamp` and `if`. Number, stat bar, rating and checkbox fields count, a ticked checkbox as 1, and so do other formulas. An empty number counts as 0.

The settings list the ids a formula can use and say what is wrong: an unknown name, a formula that depends on itself, or a mistake in the text. The card shows Check the formula until it is fixed. `evaluateFormula` in `src/renderer/lib/cards` parses the text itself; nothing is passed to `eval`.

### Show when

Advanced, Show when ties a field to another one: it shows only while that field has a value, is empty, is or is not a given value, or is above or below a number. A rule that points at a removed field is ignored. The designer and Properties show such fields dimmed, so they stay editable.

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
