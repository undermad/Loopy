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
| Brush     | B     | Paints on a drawing layer, created on the first stroke; see the drawing page                      |
| Eraser    | E     | Erases paint from the active drawing layer                                                        |

Escape returns to Select. The Brush and Eraser stay active until you change tool. Every item also has four connection handles that appear on hover, so an arrow can be dragged from any side without the Arrow tool. The toolbar scrolls with the wheel or a middle-button drag when the area is too short for it.

## Navigation

The wheel zooms around the pointer and a middle-button drag pans, whichever tool is active; the Hand tool also pans with the left button. Creation and arrow tools cover the canvas with `CreationOverlay`, and the Brush and Eraser with `DrawingOverlay`; both apply the same wheel zoom and middle-button pan through `useCanvasNavigation` in `navigation.ts`. That pan moves the view once per animation frame and shows the grabbing cursor. The view is saved to area state through `useViewportSave` in `viewportSave.ts`, 150 ms after it stops moving and only when it changed. Preferences, Editors tab, can make the wheel pan instead.

## Quick create

Press Space on the board for a quick create menu at the pointer. It lists every item kind by category: basics, shapes, layout, card templates and images from assets. Type to filter, use the arrow keys and Enter, or click. The item lands under the pointer.

The same menu opens when you drop an arrow on empty canvas, from a handle or with the Arrow tool. The new item is placed there and the arrow connects to it. The + buttons around a selected item open it too, with Same as this item first; the choice is placed one gap away on that side and joined with an arrow.

## Selecting inside containers and cards

The first click on a container or card selects it, and a drag moves it. Its children and a card's inputs stay inactive, with the grab cursor, until it is selected. A second click then selects the child under the pointer, or puts a card input in edit mode with its own cursor.

| Action                  | How                                                  |
| ----------------------- | ---------------------------------------------------- |
| Select the deepest item | Ctrl+click                                           |
| Drill into a container  | Double-click selects the child under the pointer     |
| Step out                | Escape selects the parent, then clears the selection |
| Step in                 | Enter selects a container's children                 |
| Add to the selection    | Shift+click                                          |
| Pick one docked item    | Click a docked group again once it is selected       |

Docked items select as a group first: a click on any of them selects the whole group, and a second click on a member selects that item alone. A selected group shows one frame around all of its items instead of an outline per item. Escape on a single docked item selects its group again. `clusterSelection` in `focus.ts` does this.

`focus.ts` in `src/renderer/lib/board` works out which items are reachable from the selection. The canvas gives every other item `pointer-events: none`, so a click falls through to its container.

## Editing

| Action             | How                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------- |
| Edit text or title | Double-click the item, or press Enter while it is selected; Escape or clicking away saves               |
| Label an arrow     | Double-click the arrow                                                                                  |
| Nest               | Drop an item onto a container; drag it out to release it                                                |
| Duplicate          | Ctrl+D, or the item's context menu. A container is copied with its children and the arrows between them |
| Copy, cut, paste   | Ctrl+C, Ctrl+X, Ctrl+V, or the Edit menu. Pastes at the pointer and works across boards                 |
| Undo and redo      | Ctrl+Z, Ctrl+Shift+Z or Ctrl+Y, the header buttons, or the Edit menu                                    |
| Select all         | Ctrl+A selects every item beside the current selection                                                  |
| Order              | `]` brings to front, `[` sends to back; the Layers panel and Arrange buttons step one layer at a time   |
| Lock               | Ctrl+L or the context menu; a locked item cannot move, resize, connect or be deleted                    |
| Delete             | Delete or Backspace; a container takes its children with it                                             |
| Pan and zoom       | Middle drag to pan, the wheel to zoom, with any tool                                                    |
| Rotate             | Drag just outside a corner of a selected item; the corner itself still resizes                          |
| Resize evenly      | Hold Shift while dragging a corner to keep the proportions                                              |
| Snap               | Hold Ctrl while moving, resizing or rotating; with grid snap on it is always on                         |

Right-click an item or arrow for its context menu. A right-button drag still pans; the menu opens only when the pointer did not move. A card's menu has Edit card and Edit card template, see the cards page.

Pasting an image from the clipboard imports it into assets and places it. Plain text becomes a text item. Copied items carry their children, the arrows between them and their docks.

## Dragging

Rotation turns the item together with its selection outline, resize handles, rotate zones and connection handles, so a rotated item is selected, resized and rotated along its own edges. `ItemFrame` draws all of them inside one rotated layer, and `ItemResizer` with `resize.ts` resizes in the item's own axes. The + buttons sit outside the rotated sides. The + buttons and seam buttons hide while an item rotates. Snapping rounds the angle to the nearest 15 degrees, from 0. Pressing Ctrl in the middle of a rotation snaps at once. `rotation.ts` holds the angle maths and Properties has a Rotation field.

Rotating a container turns everything inside it around the container's centre, so the contents keep their place in it. Resizing a container changes only the container. Items inside it keep their own handles and can be rotated and resized on their own. `carryContents` in `docking.ts` moves the contents.

| While dragging    | Shows                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------ |
| Over a container  | An accent outline, a tint and a "Move into" label. Dropping there nests the item                       |
| Near another item | A docking bar on the facing side. Dropping there snaps the item flush and docks them                   |
| Lined up with one | Red guides at matching edges or centres, with a snap of a few screen pixels; off while grid snap is on |

Items stay docked only while they touch. After every change, `commitChanges` checks each affected dock with `settleDocks` and splits it into the groups that still touch; an item left on its own loses its dock, so removing the middle of three docked items unlinks the outer two. The fix is part of the same change, so undo restores the dock too.

A docked group acts as one item. Its frame covers the width and height of all its items, in the group's own rotation, and has the same resize handles and rotate zones as a single item. Resizing the frame scales every item and the gaps between them, so the seams stay closed. Rotating it turns every item around the group's centre by the same angle. A docked item cannot be resized or rotated on its own: it shows no handles, and Properties disables its width and height; its Rotation field turns the whole group.

The group is not stored. `dockGroup` in `docking.ts` builds it from the items that share a `dock` id, `selectedDockGroup` finds it when the selection is exactly one whole group, and `transformGroup` applies a new frame. `DockGroupFrame` draws the frame with `ItemResizer` and `RotateHandles`, the same components as a single item. Seams are measured in the group's own frame, so a rotated group stays docked. A rotated item resizes along its own axes with the opposite edge held in place.

Docked items move together: drag any of them and the rest follow. Alt+drag pulls one out of its dock and skips docking. Selecting a docked item outlines the rest of its group with a dashed line and shows an unlink button on each seam; the button splits the group there. Detach is also in the context menu and in Properties. A dock is a shared `dock` id in item data, kept by `docking.ts`.

## Arranging

With two or more items selected, Properties shows Align and Arrange. Alignment works in board space, so nested items line up with top-level ones.

| Shortcut     | Does                    |
| ------------ | ----------------------- |
| Alt+A, Alt+D | Align left, align right |
| Alt+W, Alt+S | Align top, align bottom |
| Alt+H, Alt+V | Align centres           |
| Alt+Shift+H  | Distribute horizontally |
| Alt+Shift+V  | Distribute vertically   |

A selected item shows a + button on each side, which opens quick create for that side. The + buttons, seam buttons and other quick controls hide while an item is being dragged or resized, and Preferences can turn the + buttons off. `arrange.ts` holds the guides, alignment, distribution and quick-create maths.

## Layers

The Layers panel lists the open board's items, top first, with children indented under their container. Click a row to select, Shift or Ctrl+click to add, double-click to rename. Drag the grip to reorder items that share a parent; the board redraws in the new order while you drag, through `setLiveLayers`, and the order is saved on drop. The eye and lock buttons set `hidden` and `locked`. A hidden item stays in the file but is not drawn or snapped to.

## Assets on the board

Drag a tile from the Assets panel, or files from the system, onto the canvas. An image becomes an image item sized to its proportions. Video plays in a file item, audio gets a player, and any other file shows its icon, name, kind and size. Dropping one image onto an image item replaces its picture, and dropping it onto a card's image field fills that field. A drop inside a container lands in the container, which is highlighted while you drag.

The Assets editor uses dnd-kit inside its own area, so `reportAssetDrag` in `src/renderer/lib/assets` passes the pointer to any element marked with `assetDropZoneProps`. A drop there wins over the folder under the pointer. Internal assets travel as `links`, a list of `{ kind, id }`.

## Links to boards and palettes

Drag a board or colour palette card from the Assets editor onto the canvas to place a link item. It shows the same card as a ticket's linked asset: the board icon or the palette's colours, the name and the type. A board cannot link to itself, so dropping the open board does nothing. Dropping several assets at once stacks them one under another, 16 units apart, left edges aligned with the first item under the pointer, and selects them all.

Select a link item, then click its card to open it. Dragging the card moves the item instead. A palette opens like a ticket link: in an open Colours editor, or in the Palette workspace. A board opens in the same board area and remembers the board you came from. A back button below the tools returns to it. Links can go several boards deep, and the button steps back one board at a time. Picking a board from the header clears the trail.

A saved card dragged from the Assets editor or the Card library becomes a card item that follows the saved card, sized to its layout, see the cards page. An asset dropped on a card's asset link field fills that field instead.

A note dragged from the Assets editor or the Notes editor becomes a link item too. Its card shows the note's title and first line, and clicking it opens the note in the Idea Map workspace, see the notes page.

The item type is `link`, with `target` in its data. Properties can point it at another board or palette. The trail is the area state `boardTrail`, a list of board ids, so each board area keeps its own. `AssetLinkCard` in `src/renderer/components/AssetLinkCard` draws the card for boards and tickets.

## Items

An item's `data` holds a shared base and its own content. The base is `style`, `name`, `locked`, `hidden`, `dock` and `rotation` in degrees; `resolveItemStyle` in `src/renderer/lib/board` layers the type's defaults, then any template style, then the item's own style.

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
| `card`      | `templateId`, `cardId` and `values`, keyed by field id            |
| `file`      | `assetId` of a non-image asset                                    |
| `drawing`   | `resolution`, `offsetX` and `offsetY`; paint lives in tiles       |

`ItemFrame` in `src/renderer/components/editors/Board/items` draws the shape in SVG under the content, clips the content to the shape, and adds the resizer, the handles and the lock badge. A new item type supplies its content component, a data schema in `src/shared/board.ts`, a preset in `items.ts` and a Properties section. Items with no fill take their text colour from the board background, so they stay readable on dark boards.

## Arrows

An arrow is an edge with its style in `data`: `label`, `colour`, `width`, `dash`, `path` (curved, straight, stepped or rounded steps), `startMarker` and `endMarker` (none, arrow, filled arrow or dot), `animated`, and the `sourceHandle` and `targetHandle` sides. `ArrowEdge` draws its own markers in the arrow's colour. The path stops short of each handle by the length of a filled arrowhead, so the head sits flush against the item and points along the handle side. Selecting an arrow shows its properties, with Reverse direction.

## Units and grid

Every board has one scale, canvas pixels per metre, and a display unit (px, mm, cm, m or km), as Blender has a unit scale and a length unit. Coordinates and sizes are stored in canvas pixels; `unitInPixels` in `src/renderer/lib/board` derives the display unit from the scale, and `toUnits` and `fromUnits` convert with it. New boards use metres at 100 pixels per metre.

The grid is drawn by `Grid` as three line levels a decade apart, after Blender's world grid. `gridStep` picks the finest power of ten of the display unit whose lines sit at least twelve screen pixels apart, and `gridLevels` fades levels in and out as you zoom, so the grid stays readable from 1% to 2000%. It sits above the items in flow coordinates and takes no pointer events. Snapping uses the finest visible step, for moves, new items and drawn sizes.

Board colours and item colours are a hex copy plus an optional palette reference, resolved live through `src/renderer/lib/palettes`, see the colours page.

## Properties

The Properties editor follows the board selection kept in `src/renderer/lib/board`: the canvas records the active board, the selected item ids and the selected arrow ids. With nothing selected it edits the board itself. Every item shows the same sections in the same order: name, locked, visible and docking; position and size in board units; Arrange with its layer number; then its own content and its style. With one arrow it shows the arrow's style. Several selected items show Align and Arrange.

Number fields scrub: drag left or right to change the value, hold Shift for tenths of a step, or click to type.

The header has three zones. History (undo, redo) and view (zoom, fit, minimap) sit on the left, canvas (background, grid colour, grid, snap) in the middle, and the panel buttons for Properties, Assets and Layers on the far right. Assets opens on the left of the board, Layers below Properties, and Properties on the right at 320 pixels. The Design workspace starts with all three open.

## Model

Project migration 3 adds `boards`, `board_nodes` and `board_edges`; migrations 5 and 6 add units and the grid colour. Migration 10 adds `board_nodes.parent_id`, which cascades a container's deletion to its children, turns every old note into a `text` item with the sticky style and its fill, and adds `card_templates`.

| Table         | Columns                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------ |
| `boards`      | `id`, `name`, `background_color`, `grid_color`, refs, `unit`, `unit_scale`, timestamps           |
| `board_nodes` | `id`, `board_id`, `parent_id`, `type`, `x`, `y`, `width`, `height`, `z`, `data` JSON, timestamps |
| `board_edges` | `id`, `board_id`, `source_id`, `target_id`, `data` JSON                                          |
| `board_tiles` | `node_id`, `tx`, `ty`, `bytes` PNG, `updated_at`                                                 |

Migration 13 adds `board_tiles`, the paint of drawing layers, see the drawing page.

A child's position is relative to its container. `applyChanges` in `src/main/storage/boards-repository.ts` stores parents before children and refuses a parent on another board or one that would contain itself.

## Channels and library

| Channel                                                          | Does                                                    |
| ---------------------------------------------------------------- | ------------------------------------------------------- |
| `boards:list`, `boards:create`, `boards:update`, `boards:delete` | Board lifecycle                                         |
| `boards:read`                                                    | A board with its items and arrows                       |
| `boards:applyChanges`                                            | One transaction of item, arrow and drawing tile changes |
| `boardTiles:list`                                                | The drawing tiles of a board                            |

`src/renderer/lib/board` keeps the board list, one snapshot and one tile map per open board, the active board and the selection, and `items.ts` holds the pure item maths: presets, style resolution, nesting and reparenting, duplication, z-order, hit testing and connection sides. `layers.ts`, `clipboard.ts` and `history.ts` add layer order, copy and paste, and undo. `commitChanges` records each change with its inverse; edits to the same items within half a second, and changes from one gesture, merge into one step. Undo and redo keys work in the board, Properties and Layers, which carry `boardScopeProps`. The canvas keeps React Flow's nodes in local state so a drag follows the pointer, and `commitChanges` applies the result to the store first and sends it when the gesture ends. The editor components live in `src/renderer/components/editors/Board` and the panels in `src/renderer/components/editors/Properties`.
