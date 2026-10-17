---
sidebar_position: 13
description: The infinite board editor, its data model and how changes reach the project file.
---

# Board

The Board editor is an infinite canvas built on React Flow. It anchors the Design workspace. The first version has pan, zoom, a background colour per board, a dot grid, a minimap and sticky notes that connect with edges; images, shapes and frames come later.

## Using it

| Action            | How                                                                                       |
| ----------------- | ----------------------------------------------------------------------------------------- |
| Pan               | Middle or right mouse drag, or scroll; left drag selects                                  |
| Zoom              | Ctrl and wheel, or the zoom buttons in the header                                         |
| Add a note        | Double-click the canvas                                                                   |
| Edit a note       | Double-click the note, or press Enter while it is selected; Escape or clicking away saves |
| Move or resize    | Drag the note; select it and pull a corner to resize                                      |
| Connect two notes | Drag from a note's handle to another note                                                 |
| Delete            | Select and press Delete or Backspace                                                      |
| Switch board      | The board dropdown in the header, which also creates, renames and deletes                 |
| Background colour | The swatch in the header                                                                  |

The viewport, grid and minimap toggles are area state, so two areas can show one board at different zoom levels and the choice survives a workspace switch. The board's content and colour live in the project.

## Model

Project migration 3 adds `boards`, `board_nodes`, `board_edges` and an `assets` table reserved for images.

| Table         | Columns                                                                             |
| ------------- | ----------------------------------------------------------------------------------- |
| `boards`      | `id`, `name`, `background_color`, timestamps                                        |
| `board_nodes` | `id`, `board_id`, `type`, `x`, `y`, `width`, `height`, `z`, `data` JSON, timestamps |
| `board_edges` | `id`, `board_id`, `source_id`, `target_id`, `data` JSON                             |

Node `data` is validated per type by a zod schema in `src/shared/board.ts`; the only type today is `note` with a `text` field.

## Channels and library

| Channel                                                          | Does                                                           |
| ---------------------------------------------------------------- | -------------------------------------------------------------- |
| `boards:list`, `boards:create`, `boards:update`, `boards:delete` | Board lifecycle                                                |
| `boards:read`                                                    | A board with its nodes and edges                               |
| `boards:applyChanges`                                            | One transaction of node and edge inserts, updates and removals |

`src/renderer/lib/board` keeps the board list and one snapshot per open board. `commitChanges` applies a change locally first and then sends it, so dragging feels immediate; React Flow's drag and resize changes are sent when the gesture ends, not on every frame. The editor components live in `src/renderer/components/editors/Board`.
