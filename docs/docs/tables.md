---
sidebar_position: 18
description: Data tables, the Tables workspace, typed columns, formulas, validation, links from other assets and how rows are stored.
---

# Data tables

A data table holds game data such as items, enemies, abilities and levels. Each row has a unique key and typed cells. Tables are internal assets, so they sit in folders in the Assets editor, and boards, tickets, notes and cards can link to them.

## Tables workspace

The Tables workspace pairs the Table library with the table editor. It ships in the default layout and as the Data tables preset. If a saved layout lacks it, the app creates it the first time anything opens a table.

| Action         | How                                                                                          |
| -------------- | -------------------------------------------------------------------------------------------- |
| Make a table   | New table in the library, or New data table in the Assets editor's + menu                    |
| Open a table   | Click it in the library. Table links in boards, tickets, notes and cards open it too         |
| Rename         | Type in the name field in the editor's toolbar                                               |
| Duplicate      | The library row's menu. The copy keeps the columns and rows                                  |
| Delete         | The library row's menu, or the Assets editor. Links to it then show as missing               |
| Link elsewhere | Drag a library row onto a board, a ticket, a note or a card link field                       |
| Find rows      | The search box keeps rows whose key or any shown value contains every word                   |
| Sort           | Click a column header: ascending, descending, then table order. Empty cells always sort last |

## Editing

| Keys                            | Does                                                                              |
| ------------------------------- | --------------------------------------------------------------------------------- |
| Arrows, Tab, Home, End          | Move the focused cell; Shift with an arrow extends the selection                  |
| Typing, Enter, F2, double-click | Edit the focused cell. Enter saves and moves down, Escape cancels                 |
| Delete, Backspace               | Clear the selected cells                                                          |
| Space                           | Tick or untick a checkbox                                                         |
| Ctrl+C, Ctrl+X, Ctrl+V          | Copy, cut and paste tab-separated text, so cells move to and from Excel or Sheets |
| Ctrl+D                          | Fill the first selected row down the selection                                    |
| Ctrl+Z, Ctrl+Y                  | Undo and redo cell, row and column changes                                        |
| Ctrl+A                          | Select every cell                                                                 |

Pasting past the last row adds rows. A pasted key that is already taken, or a value a column cannot hold, is skipped and counted in a message. Add row gives the new row a key such as `row_4`. Drop an image asset on an image cell, or an internal asset on an asset link cell.

The Edit menu runs the same commands while the grid has focus. Only the rows in view are drawn, so a table of tens of thousands of rows scrolls smoothly.

## Columns

The first column is the key. It must be unique within the table, and exports and row references use it. Its header name, `id` by default, is set in its settings.

Add column lists the kinds. A new column gets an id from its label, such as `max_hp`, and keeps it when the label changes. The gear in a header opens the column's settings: label, id, type, description, the kind's value settings, Required and Unique, moving and deleting. Drag a header's right edge to resize it.

| Kind          | Holds                                      | Settings                             |
| ------------- | ------------------------------------------ | ------------------------------------ |
| Text          | Text                                       | Several lines, maximum length        |
| Number        | A number; `1,5` reads as `1.5`             | Whole numbers, minimum, maximum      |
| Checkbox      | Yes or no; `x`, `yes` and `1` read as yes  | Default                              |
| Choice        | One option, or several separated by commas | Options, one per line; Allow several |
| Date          | A date written `2026-01-31`                |                                      |
| Colour        | A hex colour                               |                                      |
| Image         | An image asset                             |                                      |
| Asset link    | Boards, palettes, notes, cards or tables   | Links to, Allow several              |
| Row reference | A row of another table, typed by its key   | Table, Allow several                 |
| Formula       | A number worked out from the row           | Formula, decimal places              |
| Dice          | Dice notation such as `2d6+1`              |                                      |

Changing a column's type starts its kind settings fresh. Values that no longer fit stay in the row and are flagged until edited.

## Formulas

A formula uses column ids, numbers, `+ - * / % ^`, comparisons and `min`, `max`, `round`, `floor`, `ceil`, `abs`, `sqrt`, `clamp` and `if`. Checkboxes count as 1 or 0 and dice as their average. A single row reference reads the referenced row: `weapon.damage * 2`. Formulas can use other formulas; a loop shows `#cycle`.

## Problems

The toolbar counts problems, and a cell with one gets a red edge and a tooltip.

| Problem        | When                                                     |
| -------------- | -------------------------------------------------------- |
| Required       | A required cell is empty                                 |
| Must be unique | A unique column holds the same value twice               |
| Wrong type     | A value no longer fits the column                        |
| Bounds         | A number is outside the minimum or maximum, or not whole |
| Not an option  | A choice value is not in the options                     |
| Missing row    | A row reference points at a deleted row                  |
| Formula error  | A formula names an unknown column or loops               |

## Export and import

Export in the editor's toolbar writes the table through a save dialog. Formula columns export their computed values and row references export the referenced keys.

| Format           | Writes                                                                                |
| ---------------- | ------------------------------------------------------------------------------------- |
| CSV, TSV         | A header of column ids, then one line per row                                         |
| JSON array       | One object per row with the key and typed values; empty cells are `null`              |
| JSON keyed by id | One object keyed by the row key, which Unity, Godot and Unreal loaders can read       |
| Markdown table   | Column labels and shown values, for design documents                                  |
| JSON Schema      | The shape of a row, for validating exported JSON in an engine or a build              |
| Loopy table file | `.loopy-table.json` with columns and raw cells, for moving a table to another project |

Import in the library reads a CSV, TSV, JSON or Loopy table file into a new table named after the file. A column named `id` or `key` becomes the key, otherwise the first column does; blank keys become `row_1` and repeated keys get a suffix. Column kinds are guessed from the values: yes and no, numbers, hex colours, dates, a few repeated values as a choice, or text. JSON reads an array of objects or an object keyed by id; nested values become text. References and asset links in a Loopy table file still point into the project they came from.

## Links

A table link is `{ kind: 'table', id }` in board link and embed items, ticket links and card link fields, and `[[table:Name]]` in notes. Renaming a table rewrites its note links. A board embed shows the first twenty rows live, with computed formulas.

## Model

Migration 18 adds `data_tables` with `folder_id`, `name`, `key_name` and a `columns` JSON column, and `data_rows` with `table_id`, `key`, a fractional `position` and a `cells` JSON column. Keys are unique per table, and deleting a table deletes its rows. The migration also rebuilds `asset_folders` for the `tables` scope and drops the scope `CHECK`; `assertFolderScope` and the zod schema guard scopes, so the next scope needs no rebuild.

Schemas, cell parsing, formulas over rows, validation and CSV parsing are pure code in `src/shared/tables`, so main can use them too. The formula and dice parsers live in `src/shared/formulas` and cards use them as well.

| Channel                                                               | Does                                                                                          |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `tables:list`                                                         | Tables with a row count, without rows                                                         |
| `tables:read`                                                         | One table and its rows in order                                                               |
| `tables:create`, `tables:update`, `tables:duplicate`, `tables:delete` | Table lifecycle; create takes rows as well                                                    |
| `tables:patchRows`                                                    | Inserts, updates, moves and deletes rows in one transaction and returns only the changed rows |
| `tables:export`, `tables:import`                                      | Save and open dialogs in main; the formats are pure functions in `src/shared/tables`          |

An update sets the cells it names and removes the ones set to `null`. A failing operation rolls back the whole patch.

## Library

`src/renderer/lib/tables` keeps the table list, loads a table's rows when an editor or embed asks for them, and reloads open tables when another window changes them. `editRows` sends a patch and records its inverse, so `undoTable` and `redoTable` work per table. Pure helpers handle the visible row range, sorting, filtering, copying, pasting and filling.

The components live in `src/renderer/components/editors/Tables`: `TableLibrary`, `TableEditor`, `TableGrid`, `CellView`, `ColumnSettings` and `TablePreview` for embeds.
