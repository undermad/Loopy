---
sidebar_position: 6
description: Game data tables as internal assets with typed columns, their own workspace, export and links from other assets.
---

# Data tables

:::note Status
In progress on `feat/data-tables`. [Tables](../tables.md) describes what ships; this page keeps the reasoning.
:::

## Goals

1. A data table is an internal asset, sorted in folders and found by search like boards, notes and cards.
2. A Tables workspace pairs the table library with a spreadsheet-style editor.
3. Columns are typed and stable: their ids come from the label and survive renames, so exports stay stable.
4. Tables export to CSV, TSV, JSON, Markdown, JSON Schema and a `loopy-table.json` exchange file, and import from CSV, TSV and JSON.
5. Boards, tickets, notes and card link fields link to a table, and the board embed item shows it live.

## Changes since the first draft

| Change on the branch                         | Effect on this plan                                                                 |
| -------------------------------------------- | ----------------------------------------------------------------------------------- |
| Migration 17 adds `item_styles`              | Tables take migration 18                                                            |
| Board `table` item holds a small static grid | It stays; data tables show on boards through the embed item and a `table` link kind |
| Card field kinds merged into fourteen        | Column kinds reuse the card names: text, number, choice, checkbox, date and so on   |
| Formulas and dice live in `lib/cards`        | The pure parsers move to `src/shared/formulas` so main can compute exported values  |
| Sync domains push changes to other windows   | Tables get a `tables` domain                                                        |

## Model

| Table         | Columns                                                                         |
| ------------- | ------------------------------------------------------------------------------- |
| `data_tables` | `id`, `folder_id`, `name`, `columns` JSON, `created_at`, `updated_at`           |
| `data_rows`   | `id`, `table_id` cascade, `position` fractional key, `cells` JSON, `created_at` |

Rows are SQLite rows, so editing a cell writes one row, not the whole table. The first column is the key: a unique text id such as `sword_iron` that exports and row references use. A reference cell stores the row id, so renaming a key does not break it.

Migration 18 rebuilds `asset_folders` once more for the `tables` scope and drops the scope `CHECK`. `assertFolderScope` and the zod schema already guard scopes, so the next scope needs no rebuild.

## Decisions

| Question              | Choice                                        | Reason                                             |
| --------------------- | --------------------------------------------- | -------------------------------------------------- |
| Virtualising the grid | Fixed row height and a visible range in `lib` | Pure, testable, no dependency                      |
| Where exporters live  | `src/shared/tables`                           | Main writes files; the MCP server can reuse them   |
| Excel                 | Later                                         | Needs a dependency; CSV opens in Excel             |
| Formula references    | `column` and `reference.column`               | Covers lookups without a string type in the parser |
| Embedding on boards   | `table` link kind shown by the embed item     | Reuses link, embed, ticket and card link plumbing  |

## Phases

| Phase | Scope                                                                                      |
| ----- | ------------------------------------------------------------------------------------------ |
| 1     | Schemas, migration 18, repository, IPC, preload, sync domain                               |
| 2     | `lib/tables`: store, cell rules, formulas over rows, sorting, filtering, clipboard, window |
| 3     | Table library, grid editor, column settings, Tables workspace, Assets internal kind        |
| 4     | Exporters and importers, save and open dialogs                                             |
| 5     | `table` link kind in boards, tickets, notes and cards; live embed                          |
| 6     | End-to-end tests, coverage, docs                                                           |

## Later

Saved views, row variants that inherit from a parent row, shared enums, cards drawn from rows, column statistics, weighted columns for loot, localisation keys, version history, conditional formatting, engine export presets, an export folder written on save, Excel, and MCP tools.
