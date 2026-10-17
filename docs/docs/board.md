---
sidebar_position: 13
description: The infinite board editor, its data model and how changes reach the project file.
---

# Board

The Board editor is an infinite canvas built on React Flow. It anchors the Design workspace. The first version has pan, zoom, a background colour per board, a metric grid with snapping, a minimap, a Properties panel for the selected item and sticky notes that connect with edges; images, shapes and frames come later.

## Using it

| Action            | How                                                                                       |
| ----------------- | ----------------------------------------------------------------------------------------- |
| Pan               | Middle or right mouse drag, or scroll; left drag selects                                  |
| Zoom              | Ctrl and wheel, or the zoom buttons in the header                                         |
| Add a note        | Double-click the canvas                                                                   |
| Edit a note       | Double-click the note, or press Enter while it is selected; Escape or clicking away saves |
| Move or resize    | Drag the note; it follows the pointer exactly. Select it and pull a corner to resize      |
| Select            | Click a note; the selection outline follows it and the Properties panel shows its values  |
| Snap              | The magnet in the header snaps moves and new notes to the visible grid dots               |
| Grid              | The grid button shows or hides the grid; its spacing follows the zoom, never the user     |
| Properties        | The panel button splits the board area and opens a Properties editor beside it            |
| Connect two notes | Drag from a note's handle to another note                                                 |
| Delete            | Select and press Delete or Backspace                                                      |
| Switch board      | The board dropdown in the header, which also creates, renames and deletes                 |
| Background colour | The swatch in the header                                                                  |

The viewport, grid, snap and minimap toggles are area state, so two areas can show one board at different zoom levels and the choice survives a workspace switch. The board's content, colour and units live in the project.

## Units and grid

Every board has a unit (px, mm, cm, m or km) and a unit scale, the number of canvas pixels in one unit, as Blender has a length unit and a unit scale. Coordinates and sizes are stored in canvas pixels; the Properties panel converts them with `toUnits` and `fromUnits` from `src/renderer/lib/board`, so changing the scale rescales what every panel shows without touching the data. New boards use metres at 100 pixels per metre.

The grid is one unit per dot and ten units per line, and it is not resizable by hand. `gridStep` picks the power of ten that keeps dots at least sixteen screen pixels apart at the current zoom, so zooming in reveals finer dots and zooming out hides them, the way Blender's grid subdivides. Snapping uses the same step, so a snapped note always lands on a visible dot; with snapping off, moves are pixel exact.

## Properties

The Properties editor follows the board selection kept in `src/renderer/lib/board`: the canvas records the active board and the selected node ids, and any Properties area in the workspace shows the matching panel. With nothing selected it edits the board itself: name, background colour, unit and unit scale. With one note selected it shows position and size in board units and the note text; every node type shares the transform section and adds its own section from a type map, so a new node type registers one component. Several selected items show a count until multi-editing exists.

The header's panel button opens a Properties editor by splitting the board area to the right at a default width of 320 pixels, or closes every Properties area in the workspace if one is already open.

## Model

Project migration 3 adds `boards`, `board_nodes`, `board_edges` and an `assets` table reserved for images. Migration 5 adds `unit` and `unit_scale` to `boards`.

| Table         | Columns                                                                             |
| ------------- | ----------------------------------------------------------------------------------- |
| `boards`      | `id`, `name`, `background_color`, `unit`, `unit_scale`, timestamps                  |
| `board_nodes` | `id`, `board_id`, `type`, `x`, `y`, `width`, `height`, `z`, `data` JSON, timestamps |
| `board_edges` | `id`, `board_id`, `source_id`, `target_id`, `data` JSON                             |

Node `data` is validated per type by a zod schema in `src/shared/board.ts`; the only type today is `note` with a `text` field.

## Channels and library

| Channel                                                          | Does                                                           |
| ---------------------------------------------------------------- | -------------------------------------------------------------- |
| `boards:list`, `boards:create`, `boards:update`, `boards:delete` | Board lifecycle                                                |
| `boards:read`                                                    | A board with its nodes and edges                               |
| `boards:applyChanges`                                            | One transaction of node and edge inserts, updates and removals |

`src/renderer/lib/board` keeps the board list, one snapshot per open board, the active board and the selection. The canvas keeps React Flow's nodes in local state and applies every change to it, so a dragged note follows the pointer frame by frame; `commitChanges` applies the result to the store first and then sends it when the gesture ends, not on every frame. The editor components live in `src/renderer/components/editors/Board` and the panels in `src/renderer/components/editors/Properties`.
