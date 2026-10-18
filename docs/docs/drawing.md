---
sidebar_position: 16
description: Drawing on boards with the Brush and Eraser, drawing layers, brush settings and presets, and how tiles are rendered, stored and undone.
---

# Drawing

The Brush and Eraser paint on drawing layers, a board item made of raster tiles. A layer has no edges: it grows wherever you paint, so there is no canvas size to set. Drawing layers sit in the board's layer order like any other item.

## Tools

| Tool   | Key | Does                                                               |
| ------ | --- | ------------------------------------------------------------------ |
| Brush  | B   | Paints with the brush preset and colour shown in the options bar   |
| Eraser | E   | Removes paint from the active drawing layer with the eraser preset |

The first brush stroke on a board creates a layer called Drawing 1 on top of everything and paints into it. Later strokes go to the active layer: the selected drawing layer, or else the last layer painted in this board area. The Eraser uses the active layer too, or else the drawing under the pointer, and never creates one. Hidden and locked layers are skipped. Escape returns to Select.

| While drawing      | Does                                              |
| ------------------ | ------------------------------------------------- |
| `[` and `]`        | Make the brush smaller or larger by 15 percent    |
| Alt+click          | Picks the colour of the drawing under the pointer |
| Pen eraser end     | Erases for that stroke, whichever tool is active  |
| Middle drag, wheel | Pan and zoom, as with every other tool            |

The pointer shows the brush size as a circle; below four screen pixels it becomes a crosshair.

## Options bar and Brushes editor

While the Brush or Eraser is active, a bar across the top of the canvas shows the preset, size, opacity, flow and, for the Brush, the colour. Its last button opens the Brushes editor as a panel. The Brushes editor is also in the editor switcher under Design.

The Brushes editor switches between the Brush and Eraser, shows a stroke preview and a preview of every preset, and holds every setting. Changing a setting marks the preset as modified; Reset to preset puts it back. Brush settings are app-wide, not per project.

| Setting                 | Effect                                                                                  |
| ----------------------- | --------------------------------------------------------------------------------------- |
| Size                    | Tip diameter in board pixels                                                            |
| Opacity                 | The most a single stroke can cover; overlapping dabs inside one stroke never go past it |
| Flow                    | How much each dab adds, so low flow builds up as you go over an area                    |
| Tip shape               | Round or square                                                                         |
| Hardness                | 100 is a crisp edge, 0 fades from the centre                                            |
| Roundness, Angle        | Squash and turn the tip, for chisel and calligraphy tips                                |
| Spacing                 | Distance between dabs as a percentage of the tip size                                   |
| Smoothing               | Follows the pen with a lag that steadies the line; the stroke catches up when you lift  |
| Size and opacity jitter | Random reduction per dab                                                                |
| Angle jitter            | Random turn per dab                                                                     |
| Scatter, Count          | Spread dabs around the path, and how many to place at each step                         |
| Grain, scale, depth     | A paper or rough texture fixed to the layer, applied to the whole stroke                |

| Brush preset | Character                                    |
| ------------ | -------------------------------------------- |
| Pen          | Small, hard and smoothed                     |
| Pencil       | Small with a paper grain                     |
| Marker       | Flat chisel tip at 45 degrees, see-through   |
| Hard round   | The plain default tip                        |
| Soft round   | Large, soft edged                            |
| Airbrush     | Very soft with low flow that builds up       |
| Ink          | Heavily smoothed for clean lines             |
| Chalk        | Rough grain with a tip that turns and varies |
| Splatter     | Scattered dabs of varying size and opacity   |
| Highlighter  | Wide flat tip at low opacity                 |

The Eraser has Hard eraser and Soft eraser.

## Pen tablets

Strokes read every pen sample Chromium reports, through `getCoalescedEvents`, so a tablet's full rate is used rather than one point per frame. Each sample keeps pressure and tilt. On Windows, Chromium only gets pressure from a Wacom tablet when Use Windows Ink is on in the Wacom driver.

Pressure is recorded but not yet offered in the Brushes editor. Each dynamic setting has a `control` field, `off`, `pressure` or `tilt`, that the engine already applies, and `minSize` is the smallest size at no pressure.

## Drawing layers

A drawing layer is a board item of type `drawing`. The Layers panel lists it with a brush icon, and it can be renamed, hidden, locked, reordered and deleted like any item. Properties shows its opacity, its resolution and how many tiles it stores; its size and rotation are fixed.

With Select, a drawing is grabbed only where it is painted. Empty areas inside its bounds let clicks through to the items below. Drag a painted part to move the whole layer; Duplicate, copy and paste carry its paint. Drawing layers stay at the top level and never move into containers, dock or take arrows.

## Rendering and performance

A layer is a sparse grid of 512 pixel tiles. Only painted tiles exist. The layer's `resolution`, 2 by default, is raster pixels per board pixel, so a drawing stays sharp up to 200 percent zoom. Tile coordinates are fixed to the layer's origin; `offsetX` and `offsetY` in its data place the item's bounds on that grid, so moving a layer only changes `x` and `y`.

| Part                 | How it stays fast                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| Tiles on screen      | `DrawingItem` mounts a canvas only for tiles in view plus one tile around them; panning is a transform    |
| Zoomed out           | Below 50 percent zoom it shows reduced tiles, each built from four tiles one level down and cached        |
| Decoding             | Stored tiles decode on first view; at most 160 decoded tiles stay in memory, least recently used go first |
| Live strokes         | Dabs land in a wet buffer per tile and only the changed rectangle is composited, once per frame           |
| Picking and grabbing | A 32 by 32 coverage mask per tile answers hit tests without reading pixels back                           |

The engine stamps a cached tip bitmap for each dab. Each frame it draws the tile as it was before the stroke, then the wet buffer at the stroke's opacity, with `destination-out` for the Eraser. Grain masks the wet buffer first. When the stroke ends, the touched tiles are encoded as PNG with `convertToBlob`, a tile left empty is deleted, and the layer's bounds are measured from the masks.

## Storage, undo and IPC

Tiles live in the `board_tiles` table, added in project version 13: `node_id`, `tx`, `ty`, `bytes` and `updated_at`, deleted with their layer. `boards:applyChanges` takes `upsertTiles` and `removeTiles` beside the item and arrow changes, in the same transaction, and refuses a tile for an item that is not a drawing on that board. `boardTiles:list` returns a board's tiles, and `loadBoard` reads them with the board.

A stroke is one undo step: the layer's new bounds and its tiles before and after. The first stroke also creates the layer, so undoing it removes the layer. Deleting a layer keeps its tiles in the undo step. Undo waits for a stroke that is still encoding. Paint steps never merge with other edits, and when undo holds more than 256 MB of tiles the oldest steps are dropped.

Brush state is `brushes` in `settings.json`, added in settings version 4: the brush colour and, for the Brush and the Eraser, the preset id and its current settings. Changes save 300 ms after the last edit.

## Library

`src/renderer/lib/drawing` owns the tile cache, the stroke engine, brush state and the layer helpers. `src/shared/brushes.ts` holds the brush settings schema and the presets.

| Module               | Owns                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------ |
| `geometry.ts`        | Tile coordinates, the layer frame, visible ranges, levels, masks and layer bounds    |
| `stroke.ts`          | Turns pen samples into dabs: smoothing, curves, spacing, dynamics and jitter         |
| `tip.ts`, `grain.ts` | Tip shapes and the grain textures                                                    |
| `cache.ts`           | Decoded tiles, reduced levels, masks and change notices, synced with the board store |
| `engine.ts`          | `StrokeSession`: wet buffers and compositing for one stroke                          |
| `paint.ts`           | `beginPaint`: one stroke from the first sample to the saved, undoable change         |
| `brushes.ts`         | Brush state on top of settings, with presets, reset and the delayed save             |
| `layers.ts`          | Picking, creating, hit testing and colour picking on drawing layers                  |

Tests use `tests/unit/renderer/helpers/canvas-fake.ts`, a small software canvas with real pixels, because jsdom has no canvas. `tests/e2e/drawing.spec.ts` draws, erases, undoes, reloads, drags and zooms out in the built app.
