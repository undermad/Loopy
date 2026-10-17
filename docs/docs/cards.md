---
sidebar_position: 17
description: Card templates for the board, their field kinds, the template editor and how cards keep their values.
---

# Cards

A card is a board item drawn from a card template. The template sets the layout and style once; every card made from it holds only its own values. Editing a template updates every card that uses it, on every board in the project.

## Using it

| Action            | How                                                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Make a template   | The Card tool's menu, New card template. Start from a blank card or a starter: Character, Item, Ability, Location or Quest |
| Place a card      | Pick a template in the Card tool's menu, then click or drag on the canvas                                                  |
| Fill it in        | Type straight into the card, or use the Values section in Properties                                                       |
| Change a template | Edit card templates in the Card tool's menu, Edit template in a card's Properties, or the card's context menu              |

The template editor shows the field list on the left, a live preview in the middle and settings on the right. Drag fields by their grip to reorder them. Click a field, in the list or in the preview, to edit it; the Card button edits the card's size, spacing, padding, accent, background, border, corner radius, text colour, font size and shadow. Changes stay in the editor until Save template.

## Fields

Fields sit on a 12-column grid. Each has a width in the row (full, three quarters, two thirds, half, third or quarter), a label it can hide, and a text size, weight, colour and alignment.

| Kind      | Value                            | Extra settings             |
| --------- | -------------------------------- | -------------------------- |
| Heading   | Text, larger and bold by default | Placeholder, default value |
| Text      | One line of text                 | Placeholder, default value |
| Long text | Several lines                    | Placeholder, default value |
| Number    | A number                         | Minimum, maximum, default  |
| Choice    | One of a list                    | Choices, default           |
| Checkbox  | Yes or no                        | Default                    |
| Tags      | A list of short labels           | Default, comma separated   |
| Image     | An image from assets             |                            |
| Stat bar  | A number drawn as a bar          | Minimum, maximum, default  |
| Colour    | A hex colour                     | Default                    |
| Divider   | None                             |                            |

`coerceValue` in `src/renderer/lib/cards` checks every value against its field, so a value that no longer fits, such as a removed choice, falls back to the field's default. Removing a field leaves its value on the card unused; adding it back with the same id brings the value back.

## Model

Migration 10 adds `card_templates` with `id`, `name`, a `data` JSON column holding `width`, `height`, `style`, `accent`, `gap` and `fields`, and timestamps. The schemas are in `src/shared/cards.ts`. Field ids must be unique within a template. Deleting a template keeps its cards and their values; they show the values in a plain list until another template is chosen.

| Channel                                                                                      | Does               |
| -------------------------------------------------------------------------------------------- | ------------------ |
| `cardTemplates:list`, `cardTemplates:create`, `cardTemplates:update`, `cardTemplates:delete` | Template lifecycle |

## Library

`src/renderer/lib/cards` keeps the template list, reloads it when the project changes, and exposes `useCardTemplates`, `useCardTemplate`, the create, update, duplicate and delete actions, the field kinds and the starter templates. `CardView` in `src/renderer/components/editors/Board/cards` renders a template with values for the board, the Properties panel and the editor preview. A new field kind is an entry in `CARD_FIELD_KINDS`, its value rule in `FIELD_KINDS`, a case in `CardView` and a label in `editors.json`.
