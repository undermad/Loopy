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
| Colours           | The background and grid swatches in the header, or the Properties panel                   |

The viewport, grid, snap and minimap toggles are area state, so two areas can show one board at different zoom levels and the choice survives a workspace switch. The board's content, colour and units live in the project.

## Units and grid

Every board has a unit (px, mm, cm, m or km) and a scale in canvas pixels per unit, as Blender has a length unit and a unit scale. Coordinates and sizes are stored in canvas pixels; the Properties panel converts them with `toUnits` and `fromUnits` from `src/renderer/lib/board`, so changing the scale rescales what every panel shows without touching the data. New boards use metres at 100 pixels per metre. Choosing pixels sets the scale to 1 and locks it, so a 10 px note reads as 10 px.

The grid is drawn by `Grid` in `src/renderer/components/editors/Board` as three line levels a decade apart, after Blender's world grid. `gridStep` picks the finest power of ten of the unit whose lines sit at least twelve screen pixels apart; that level fades in as you zoom closer, the next level up is a unit (or ten, or a hundred, depending on zoom) drawn a little wider, and the level above that wider still. When the fine level reaches 120 screen pixels it hands over: the finest lines become the unit lines without a visible jump, because `gridLevels` interpolates width and opacity with the same fade. The scheme has no fixed range, so the zoom runs from 1% to 2000% and the grid stays readable. Lines through the origin mark the axes.

The grid colour is stored per board next to the background colour, picked from the header or the Properties panel, and drawn with opacity so one colour works on light and dark boards. Snapping uses the finest visible step, so a snapped note always lands on a line; with snapping off, moves are pixel exact.

## Properties

The Properties editor follows the board selection kept in `src/renderer/lib/board`: the canvas records the active board and the selected node ids, and any Properties area in the workspace shows the matching panel. With nothing selected it edits the board itself: name, background colour, unit and unit scale. With one note selected it shows position and size in board units and the note text; every node type shares the transform section and adds its own section from a type map, so a new node type registers one component. Several selected items show a count until multi-editing exists.

The header's panel button opens a Properties editor by splitting the board area to the right at a default width of 320 pixels, or closes every Properties area in the workspace if one is already open.

## Model

Project migration 3 adds `boards`, `board_nodes`, `board_edges` and an `assets` table reserved for images. Migration 5 adds `unit` and `unit_scale` to `boards`; migration 6 adds `grid_color`.

| Table         | Columns                                                                             |
| ------------- | ----------------------------------------------------------------------------------- |
| `boards`      | `id`, `name`, `background_color`, `grid_color`, `unit`, `unit_scale`, timestamps    |
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
