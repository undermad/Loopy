---
sidebar_position: 14
description: Game design features under consideration, how they fit the existing code and the order to build them in.
---

# Roadmap

Every feature on this page is considered, not committed. A feature moves to a plan in `docs/docs/plans` before work starts, and to its own page once it ships.

## Status

| Status      | Meaning                                                       |
| ----------- | ------------------------------------------------------------- |
| Considered  | Worth building; no plan yet                                   |
| Planned     | A page in `docs/docs/plans` describes scope, model and phases |
| In progress | Code is landing on a branch                                   |
| Shipped     | Described on its own page; removed from this one              |

## Order

Data tables come first, because balancing, loot tables, dialogue conditions and engine export all read from them. Runnable loop diagrams come second; they are what sets Loopy apart. Links between design objects and tickets come third, once there are design objects worth linking.

The rest follow demand. Each one is a new editor registered in `registerEditors.ts`, a new board node type, or both.

## Features

| Feature                     | Status      | Builds on                    |
| --------------------------- | ----------- | ---------------------------- |
| Game data tables            | Considered  | Project file                 |
| Runnable loop diagrams      | Considered  | Board, Properties type map   |
| Design and ticket links     | Considered  | Tickets, data tables, board  |
| Balancing sheets            | Considered  | Data tables                  |
| Loot and probability tables | Considered  | Data tables                  |
| Dialogue graphs             | Considered  | Board, data tables           |
| Progression trees           | Considered  | Board                        |
| Design document             | Considered  | Tiptap, tickets              |
| Level paper maps            | Considered  | Board units and grid         |
| Playtest log                | Considered  | Tickets                      |
| Lore wiki                   | Considered  | Design document              |
| Moodboards                  | Considered  | Board images, Colours editor |
| Item and card customisation | In progress | Cards, board, Properties     |

## Game data tables

A spreadsheet-style editor for items, enemies, abilities and levels. Each table has typed columns: number, text, enum, reference to a row in another table, colour or asset. Rows are validated against those types.

Tables export to JSON and CSV so Unity, Godot and Unreal can import them. They live in the project file as rows, which SQLite handles well; a schema change appends a migration to `src/main/storage/project-migrations.ts`.

## Runnable loop diagrams

Board node types for economies: source, pool, drain, converter and gate. Edges carry flow rates. A run steps the diagram and charts every pool over time, so "does gold inflate by hour five" has an answer before a prototype exists.

Each node type registers one section in the Properties type map. The simulation is pure functions in a new `src/renderer/lib/loops`, unit tested without React.

## Design and ticket links

Any design object links to tickets, and the link shows on both sides: a board node, a table row, a section of the design document. A ticket shows what it implements; a design object shows what work it has caused and whether that work is done.

## Balancing sheets

Formulas over data tables: experience curves, damage against armour, time to kill. Results plot live, so changing a value moves the curve.

## Loot and probability tables

Weighted drop tables that can nest, with pity and guarantee rules. A Monte Carlo run shows expected attempts to a given drop and the full distribution, not only the mean.

## Dialogue graphs

Branching conversation nodes with speakers, variables and conditions read from data tables. A preview steps through a conversation as the player would. Export targets Ink and Yarn Spinner.

## Progression trees

Skill trees, tech trees and quest dependencies as directed graphs on the board. Checks flag unreachable nodes and cycles.

## Design document

Structured pages in Tiptap, which tickets already use. Pages embed board snapshots, table views and live ticket lists. Design pillars sit at the top of the document and every section can reference them.

## Level paper maps

Rooms, doors, spawn points and sightlines drawn on a board with real units. A pacing overlay follows the critical path and marks combat, rest and reward beats.

## Playtest log

Sessions with tester, build and date. Notes are timestamped and tagged to features, and a note becomes a ticket in one action. Tag counts across sessions show where players struggle.

## Lore wiki

Pages for characters, places and factions, with backlinks between them. A glossary keeps names consistent across the design document and dialogue.

## Moodboards

Images dropped or pasted onto the board, already part of the board's later scope. A palette can be extracted from an image into the Colours editor.
