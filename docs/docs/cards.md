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

Fields sit on a 12-column grid. There are 14 field types. Add field lists presets in groups (text, numbers, choices, media, references and layout): a preset is a type with settings already chosen, such as Stat bar, a number drawn as a bar. A new field gets an id taken from its label, such as `max_health`, and keeps it when the label changes, so values and future exports stay stable.

Field settings always come in the same order, and each group folds away:

| Section    | Holds                                                                                         |
| ---------- | --------------------------------------------------------------------------------------------- |
| Basics     | Field type, label, show label                                                                 |
| Value      | What the kind needs: placeholder, choices, bounds, prefix and suffix, default                 |
| Layout     | Zone, columns from 1 to 12 with presets, Start a new row, minimum height in steps of 4 pixels |
| Text style | Size, weight, alignment and colour, for kinds that show text                                  |
| Advanced   | Help text, shown on an info mark beside the label, and Hide on card                           |

A hidden field keeps its value and shows, dimmed, in the designer and in Properties, but not on the card face.

| Type       | Value                                                 | Settings                                                                     | Presets                               |
| ---------- | ----------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------- |
| Text       | Text on one line or several                           | Lines, Same text on every card, placeholder, default                         | Heading, Text, Long text, Static text |
| Date       | A calendar date                                       |                                                                              | Date                                  |
| Number     | A number, or a low and high pair                      | Low and high, display (number, bar, symbols), bounds, symbol, default, affix | Number, Stat bar, Rating, Range       |
| Attributes | A number per named row                                | One row per line                                                             | Attributes                            |
| Formula    | Worked out from other fields, never typed             | Formula, decimal places, prefix, suffix                                      | Formula                               |
| Dice       | Dice notation such as `2d6+1`, with range and average | Default                                                                      | Dice                                  |
| Choice     | One value from a list, or several                     | Allow several, Allow new entries, choices with colours, default              | Choice, Multiple choice, Tags         |
| Checkbox   | Yes or no                                             | Default                                                                      | Checkbox                              |
| Checklist  | Steps to tick, with a done count                      |                                                                              | Checklist                             |
| Image      | An image from assets                                  |                                                                              | Image                                 |
| Icon       | One of the game icons                                 |                                                                              | Icon                                  |
| Colour     | A hex colour                                          | Default                                                                      | Colour                                |
| Asset link | One or more boards, palettes, notes or cards          | Links to, Allow several                                                      | Asset link                            |
| Separator  | A line, or empty space of a set height                | Draw a line, height                                                          | Divider, Spacer                       |

Symbols show up to 10 marks; the maximum sets how many. A choice with Allow new entries takes values that are not in its list, which is how Tags works. The field list names each field by the preset it matches, so a number drawn as a bar reads Stat bar.

An asset link shows each target as the card a ticket's linked asset uses. Click it to open the target. Drop an internal asset on the field to set it; with Allow several the drop adds to the list. Links to limits the kinds, and a link to a deleted asset shows as Missing asset.

`coerceValue` in `src/renderer/lib/cards` checks every value against its field. A value that no longer fits, such as a removed choice or a link of a kind the field no longer takes, falls back to the field's default. Removing a field leaves its value on the card unused; adding it back with the same id brings the value back.

### Formulas

A formula names other fields by id: `attack * 2 + level`. It knows numbers, `+ - * / % ^`, brackets, the comparisons `== != > < >= <=`, which give 1 or 0, and `min`, `max`, `round`, `floor`, `ceil`, `abs`, `sqrt`, `clamp` and `if`. Number fields count unless they hold a low and high pair, checkboxes count as 1 when ticked, and so do other formulas. An empty number counts as 0.

The settings list the ids a formula can use and say what is wrong: an unknown name, a formula that depends on itself, or a mistake in the text. The card shows Check the formula until it is fixed. `evaluateFormula` in `src/renderer/lib/cards` parses the text itself; nothing is passed to `eval`.

### Show when

Advanced, Show when ties a field to another one: it shows only while that field has a value, is empty, is or is not a given value, or is above or below a number. A rule that points at a removed field is ignored. The designer and Properties show such fields dimmed, so they stay editable.

## Card styling

Card settings, shown when no field is selected, come in the same order as field settings: size, background, accent, border, text.

| Section    | Holds                                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Size       | A preset (poker, bridge, tarot, mini, square, landscape) or custom width and height, Grow to fit fields, spacing, padding            |
| Background | Fill, a gradient towards a colour at an angle, an image from assets that fills or fits, and an overlay that fades it toward the fill |
| Accent     | Colour, placement (top band, left stripe, border, header or none) and Accent from a choice field                                     |
| Border     | Colour, width, corner radius, shadow                                                                                                 |
| Text       | Colour, size and font (app font, serif, monospace, rounded, condensed or handwritten)                                                |

Accent from takes the colour of the option picked in a choice field, or the first one picked when it allows several, so a Legendary item turns gold. Without a pick, or for an option with no colour, the accent colour applies. The header placement paints the header zone in the accent and switches its text to a readable colour.

Each field sits in a zone: header, body or footer. The header and footer keep their height, and the body scrolls when the card runs out of room. Grow to fit fields lets the preview grow past its height; a card on a board keeps the size it was given.

`CardFace` draws the backdrop, accent and zones for both the designer preview and board cards, so they look the same.

## Board cards

A card placed with the Card tool shows its template and keeps its values on the item. Dropping a saved card places a card that follows it: edits on the board, in Properties or in the designer show wherever it is placed. Properties offers Save as card asset for a template card, and Make independent copy for a following card. A copy needs a template, because a board item has no layout of its own.

Right-click a board card for Edit card or Edit card template. Edit card opens the saved card it follows, or else that board card itself in the designer: its name, template and values save back to the board, and Save as card asset turns it into a saved card it then follows. Edit card template opens the template, also for a following card.

A following card also keeps the values it last showed on the board. If the saved card is deleted, the board card stays with those values and its template.

## Model

Migration 10 adds `card_templates` with `id`, `name`, a `data` JSON column holding the whole layout (size, style, accent, background, font and fields), and timestamps. Migration 16 adds `cards` with `folder_id`, `name`, a nullable `template_id`, a `layout` JSON column used only without a template, and `field_values`. It also rebuilds `asset_folders` to allow the `cards` scope. The schemas are in `src/shared/cards`. Field ids must be unique within a layout.

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

| Step | Where                                                                                    |
| ---- | ---------------------------------------------------------------------------------------- |
| 1    | Schema and its place in `CARD_FIELD_KINDS` and the union in `src/shared/cards/fields.ts` |
| 2    | Text style in `FIELD_KINDS` and at least one entry in `FIELD_PRESETS` in `lib/cards`     |
| 3    | View in `Cards/fields` and value settings in `Cards/settings/kindSettings.tsx`           |
| 4    | Names in `cards.kinds` and `cards.presets` in `editors.json`                             |

The view and settings maps are typed per kind, so a kind without a view fails the type check. Prefer a setting on an existing type over a new type when the value has the same shape. Changing a field's type with `changeFieldKind` keeps every setting both types share, such as placeholder, prefix or choices, and drops a default that no longer fits.
