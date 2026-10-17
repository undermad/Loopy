---
sidebar_position: 13
description: The infinite board editor, its items, arrows and tools, the data model and how changes reach the project file.
---

# Board

The Board editor is an infinite canvas built on React Flow. It anchors the Design workspace. Everything on it is an item built on one base, so text, shapes, images, containers and cards share selection, resizing, styling, connecting and the Properties panel.

## Tools

The toolbar on the left of the canvas holds every tool. A creation tool places an item on a click at the default size, or at the size of the rectangle you drag, and then returns to Select. Text and containers open for typing straight away.

| Tool      | Key   | Does                                                                                              |
| --------- | ----- | ------------------------------------------------------------------------------------------------- |
| Select    | V     | Selects, moves and resizes items; a drag on the canvas draws a selection box                      |
| Hand      | H     | Pans with the left button                                                                         |
| Text      | T     | Plain text with no fill                                                                           |
| Sticky    | N     | A yellow note with a shadow; a double-click on the canvas places one too                          |
| Shape     | R O D | Rectangle, ellipse or diamond with centred text; the menu remembers the last shape                |
| Image     |       | Places an image from assets, or imports files first. Dropping image files on the canvas does both |
| Container | F     | A titled frame. Items placed or dropped inside it belong to it and move with it                   |
| Card      | C     | A card from the chosen card template, see the cards page                                          |
| Arrow     | A     | Drag from one item to another; the arrow joins the sides that face each other                     |

Escape returns to Select. Every item also has four connection handles that appear on hover, so an arrow can be dragged from any side without the Arrow tool.

## Editing

| Action             | How                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------- |
| Edit text or title | Double-click the item, or press Enter while it is selected; Escape or clicking away saves               |
| Label an arrow     | Double-click the arrow                                                                                  |
| Nest               | Drop an item onto a container; drag it out to release it                                                |
| Duplicate          | Ctrl+D, or the item's context menu. A container is copied with its children and the arrows between them |
| Order              | `]` brings to front, `[` sends to back                                                                  |
| Lock               | Ctrl+L or the context menu; a locked item cannot move, resize, connect or be deleted                    |
| Delete             | Delete or Backspace; a container takes its children with it                                             |
| Pan and zoom       | Middle or right drag, scroll to pan, Ctrl and wheel to zoom                                             |

Right-click an item or arrow for its context menu. A right-button drag still pans; the menu opens only when the pointer did not move.

## Items

An item's `data` holds a shared base and its own content. The base is `style`, `name` and `locked`; `resolveItemStyle` in `src/renderer/lib/board` layers the type's defaults, then any template style, then the item's own style.

| Style field                                        | Values                                                             |
| -------------------------------------------------- | ------------------------------------------------------------------ |
| `shape`                                            | rectangle, rounded, ellipse, diamond or pill                       |
| `fill`, `stroke`, `textColour`                     | A colour value with an optional palette reference; null for none   |
| `strokeWidth`, `strokeStyle`                       | Width in pixels; solid, dashed or dotted                           |
| `radius`, `padding`, `opacity`, `shadow`           | Corner radius, inner padding, 0 to 1, on or off                    |
| `fontSize`, `fontWeight`, `align`, `verticalAlign` | Text size and weight; left, centre or right; top, middle or bottom |

| Type        | Content                                                           |
| ----------- | ----------------------------------------------------------------- |
| `text`      | `text`. Text, sticky notes and shapes are presets of this type    |
| `image`     | `assetId`, `fit` (contain by default, cover or stretch) and `alt` |
| `container` | `title` and `showTitle`. Children point at it through `parent_id` |
| `card`      | `templateId` and `values`, keyed by field id                      |

`ItemFrame` in `src/renderer/components/editors/Board/items` draws the shape in SVG under the content, clips the content to the shape, and adds the resizer, the handles and the lock badge. A new item type supplies its content component, a data schema in `src/shared/board.ts`, a preset in `items.ts` and a Properties section. Items with no fill take their text colour from the board background, so they stay readable on dark boards.

## Arrows

An arrow is an edge with its style in `data`: `label`, `colour`, `width`, `dash`, `path` (curved, straight, stepped or rounded steps), `startMarker` and `endMarker` (none, arrow, filled arrow or dot), `animated`, and the `sourceHandle` and `targetHandle` sides. `ArrowEdge` draws its own markers in the arrow's colour. The path stops short of each handle by the length of a filled arrowhead, so the head sits flush against the item and points along the handle side. Selecting an arrow shows its properties, with Reverse direction.

## Units and grid

Every board has one scale, canvas pixels per metre, and a display unit (px, mm, cm, m or km), as Blender has a unit scale and a length unit. Coordinates and sizes are stored in canvas pixels; `unitInPixels` in `src/renderer/lib/board` derives the display unit from the scale, and `toUnits` and `fromUnits` convert with it. New boards use metres at 100 pixels per metre.

The grid is drawn by `Grid` as three line levels a decade apart, after Blender's world grid. `gridStep` picks the finest power of ten of the display unit whose lines sit at least twelve screen pixels apart, and `gridLevels` fades levels in and out as you zoom, so the grid stays readable from 1% to 2000%. It sits above the items in flow coordinates and takes no pointer events. Snapping uses the finest visible step, for moves, new items and drawn sizes.

Board colours and item colours are a hex copy plus an optional palette reference, resolved live through `src/renderer/lib/palettes`, see the colours page.

## Properties

The Properties editor follows the board selection kept in `src/renderer/lib/board`: the canvas records the active board, the selected item ids and the selected arrow ids. With nothing selected it edits the board itself. With one item it shows the item's name and lock, its type section, position and size in board units, then the style. With one arrow it shows the arrow's style. Several selected items show a count.

The header's panel button opens a Properties editor by splitting the board area to the right at a default width of 320 pixels.

## Model

Project migration 3 adds `boards`, `board_nodes` and `board_edges`; migrations 5 and 6 add units and the grid colour. Migration 10 adds `board_nodes.parent_id`, which cascades a container's deletion to its children, turns every old note into a `text` item with the sticky style and its fill, and adds `card_templates`.

| Table         | Columns                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------ |
| `boards`      | `id`, `name`, `background_color`, `grid_color`, refs, `unit`, `unit_scale`, timestamps           |
| `board_nodes` | `id`, `board_id`, `parent_id`, `type`, `x`, `y`, `width`, `height`, `z`, `data` JSON, timestamps |
| `board_edges` | `id`, `board_id`, `source_id`, `target_id`, `data` JSON                                          |

A child's position is relative to its container. `applyChanges` in `src/main/storage/boards-repository.ts` stores parents before children and refuses a parent on another board or one that would contain itself.

## Channels and library

| Channel                                                          | Does                                                            |
| ---------------------------------------------------------------- | --------------------------------------------------------------- |
| `boards:list`, `boards:create`, `boards:update`, `boards:delete` | Board lifecycle                                                 |
| `boards:read`                                                    | A board with its items and arrows                               |
| `boards:applyChanges`                                            | One transaction of item and arrow inserts, updates and removals |

`src/renderer/lib/board` keeps the board list, one snapshot per open board, the active board and the selection, and `items.ts` holds the pure item maths: presets, style resolution, nesting and reparenting, duplication, z-order, hit testing and connection sides. The canvas keeps React Flow's nodes in local state so a drag follows the pointer, and `commitChanges` applies the result to the store first and sends it when the gesture ends. The editor components live in `src/renderer/components/editors/Board` and the panels in `src/renderer/components/editors/Properties`.
