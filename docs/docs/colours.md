---
sidebar_position: 14
description: The Colours editor, palettes as the project's single source of colour, harmonies, palette clusters, image extraction, the contrast checker and presets.
---

# Colours

The Colours editor builds and keeps the project's colour palettes. A palette is the source of truth for its colours: anything that picks a palette colour stores a reference to it and follows later edits. It anchors the Palette workspace.

## Model

Project migration 8 adds two tables and two board columns.

| Table or column                            | Holds                                                                               |
| ------------------------------------------ | ----------------------------------------------------------------------------------- |
| `palettes`                                 | Name, harmony rule, `base_index`, source (`wheel`, `image` or `preset`), timestamps |
| `palette_colours`                          | One row per colour: position, optional name, hex. Removed with the palette          |
| `boards.background_ref`, `boards.grid_ref` | JSON `{ paletteId, colourId }` or null, next to the hex copy                        |

Project migration 9 adds clusters.

| Table or column                                    | Holds                                                                                                      |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `palette_clusters`                                 | Name and timestamps                                                                                        |
| `palettes.cluster_id`, `palettes.cluster_position` | The cluster a palette belongs to, or null, and its order inside it. Deleting a cluster sets the id to null |

A colour anywhere in the project is `{ hex, ref }` (`colourValueSchema` in `src/shared/colours.ts`): the hex is the last known value, the ref points at a palette colour. Note nodes keep their fill the same way under `data.fill`. The renderer resolves a ref through `src/renderer/lib/palettes` on every render, so editing a palette recolours every board, note and grid that uses it. Deleting a palette leaves the hex copy in place.

## Channels

| Channel                                                 | Does                                                                                                                                      |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `palettes:list`                                         | Every palette with its colours in order                                                                                                   |
| `palettes:create`, `palettes:update`, `palettes:delete` | Palette lifecycle; update replaces the colour list and keeps given ids                                                                    |
| `paletteClusters:list`, `paletteClusters:update`        | Clusters in creation order; update renames                                                                                                |
| `paletteClusters:create`                                | Creates a cluster, moves the given palettes into it and creates new ones inside it, in one transaction. Returns every palette and cluster |
| `paletteClusters:delete`                                | Removes a cluster and either ungroups its palettes or deletes them too                                                                    |
| `colour:pickScreen`                                     | Opens the live screen eyedropper and resolves the clicked colour, or null                                                                 |

Moving a palette is `palettes:update` with a `clusterId`. The palette goes to the end of that cluster, or out of any cluster with null.

The repository is `src/main/storage/palettes-repository.ts`; the handlers follow the boards pattern and refuse every call without an open project.

## Libraries

`src/renderer/lib/colour` is pure maths with no state: hex, RGB, HSV and HSL conversions, WCAG contrast, harmony rules, cluster generation (`cluster.ts`), image extraction, gradients, presets and the eyedropper binding. `src/renderer/lib/palettes` keeps the palette and cluster lists, reloads them when the project changes, and exposes `usePalettes`, `usePaletteClusters`, `usePaletteGroups`, `useResolvedColour` and `useColourFromRef` plus the palette actions and `createCluster`, `renameCluster`, `deleteCluster` and `moveToCluster`.

## Harmonies

The wheel follows Adobe Color. Hue offsets are measured on Adobe's artistic wheel, where yellow sits opposite purple and red opposite green, so `toWheelHue` and `fromWheelHue` in `src/renderer/lib/colour` map RGB hues onto that wheel and back with a 24-step table fitted from Adobe's output. Every rule places five colours; the base is the first unless the palette says otherwise.

| Rule                | Other four colours                                                                                          |
| ------------------- | ----------------------------------------------------------------------------------------------------------- |
| Analogous           | 18 and 36 degrees either side                                                                               |
| Monochromatic       | The base hue with saturation and brightness stepped down by 0.2, 0.4 and 0.6, wrapping upward when too dark |
| Triad               | 120 degrees either side, then a muted base and a muted shade of the first                                   |
| Complementary       | The opposite hue, then a muted base, a muted complement and a darker base                                   |
| Split complementary | 162 degrees either side, then a dark base and a dark shade of the first                                     |
| Square              | 90, 180 and 270 degrees away plus a muted base                                                              |
| Compound            | 30 and 150 degrees to one side, the complement and a muted base                                             |
| Shades              | The base brightness stepped down by 0.14, 0.30, 0.46 and 0.62, wrapping upward when too dark                |
| Custom              | No rule; any number of colours from 1 to 12                                                                 |

The wheel is drawn and read in that space: hue runs counter-clockwise with red at the right, the radius is saturation, and the disc is painted at a fixed brightness. The base handle sits above the others, so handles that share a position (every Shades colour, for instance) always move together. A harmony cannot break. Dragging the base, or the empty disc, moves the base under the pointer and derives all other slots again, saturation and brightness included. Dragging any other handle, typing its hex or nudging it with the arrow keys moves that colour, rotates every other hue by the same amount and leaves the others' saturation and brightness alone, exactly as on Adobe's wheel. Changing the rule, picking another base swatch or pressing Random derives the five colours from the base again. Switch the rule to Custom to move colours freely.

## Clusters

A cluster groups palettes that belong together, such as one palette per magic school. The Cluster tool generates the other members from a seed palette. Each new palette turns the seed around the artistic wheel, so the members share the seed's character and differ in hue.

| Rule              | Effect                                                                                                                                                                              |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New palettes      | How many to generate, 1 to 8                                                                                                                                                        |
| Hue scheme        | Where the new hues sit relative to the seed: complementary, split complementary, triad, square, analogous or evenly spaced. Automatic picks complementary, triad or square by count |
| Structure         | Keep turns every seed colour by the same angle, so a monochromatic seed gives monochromatic palettes. A harmony builds five colours from the turned base instead                    |
| Lightness balance | Pulls each colour towards the lightness of the seed colour it came from, so a yellow palette carries the same weight as a blue one. Interpolated in perceptual lightness            |

The seed's hue is the saturation-weighted circular mean of its colours. A grey seed is tinted, because turning a grey changes nothing. Once a scheme runs out of angles, or when the seed already sits in a cluster, the remaining hues go into the widest free gap on the wheel. Fill the gaps does only that, which is how you extend a cluster.

Each planned palette is named after its hue family. You can rename it, leave it out, or turn it by dragging its marker on the wheel. Create cluster stores the seed and the new palettes together. On a seed that is already in a cluster, the button adds them to that cluster.

Schemes live in `CLUSTER_SCHEMES` and `clusterOffsets` in `src/renderer/lib/colour/cluster.ts`. A new scheme is a list of angles in `ANCHORS` plus a label and hint in `colours.json`.

The library groups palettes under their clusters, with ungrouped palettes last. A cluster header collapses its palettes and has a menu to rename it, add palettes to it, delete it and keep the palettes, or delete it with them. Each palette menu can generate a cluster from that palette and move it to a cluster, to a new one or out of its cluster. Search matches palette and cluster names.

Every other place that offers palette colours groups them the same way: the project colour picker, the swatch popover and From palette menu of a colour input, and Add whole palette in the contrast checker. Each cluster is a labelled group with its palettes in cluster order, and ungrouped palettes come last under Ungrouped. Without clusters the lists stay flat. `usePaletteGroups` in `src/renderer/lib/palettes` returns these groups, skipping empty ones; `groupByCluster` is the same rule for any list that wraps palettes, such as the library with its drafts.

## Editing

Palettes are read-only until you press Modify. Modify, or New palette, opens a draft: the wheel, inputs and rule become editable, the list entry shows an Unsaved tag and mirrors every change as it happens, and nothing reaches the project until Save. Cancel drops the draft; the discard button on an unsaved new palette removes it from the list. Drafts live in a store in `src/renderer/lib/palettes` for the session, so switching workspaces keeps them and closing the project clears them. Dragging rotates from a snapshot taken when the drag starts, so hues never accumulate rounding error.

## Using it

The editor has a palette list on the left and five tools in the header.

| Tool         | Does                                                                                                                                                                                                                                                                                                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Colour wheel | Drag markers or use the arrow keys on a focused marker, type hex values, name colours, pick the base, change the rule, adjust brightness, copy values, add and remove colours in a custom palette                                                                                                                                                                         |
| From image   | Drop an image, choose a file or pick one already in assets. Dropped and chosen files are saved to assets first. Moods pick colourful, bright, muted, deep or dark clusters; dragging a sample point sets that colour from the pixel under it. Gradient mode picks evenly spaced stops by brightness and shows the CSS. Save as a new palette or apply to the selected one |
| Cluster      | Generates palettes that belong with the selected palette and stores them as a cluster, see Clusters                                                                                                                                                                                                                                                                       |
| Contrast     | A source colour checked against any number of colours: typed, picked from the swatch popover, picked from the screen, from a palette, or a whole palette at once. Each row shows both text directions, the ratio and pass or fail for AA and AAA at normal and large sizes. Use as source swaps a row with the source                                                     |
| Explore      | Built-in presets searchable by name, tag or rule. Add to project copies one into the palettes as a custom palette                                                                                                                                                                                                                                                         |

The active tool, selected palette, library visibility, cluster rules, drafts and the contrast colours are area state. Random generates a new base colour and applies the selected rule; for a custom palette it randomises every colour.

## Screen eyedropper

Pick from screen works live, anywhere on any display: other apps, videos and animations keep running under the loupe. The renderer calls `colour:pickScreen`, and the main process opens a transparent, always-on-top overlay over each display.

Each overlay loads its page from the `loopy-picker://` scheme in `src/main/screen-picker.ts`. The scheme is registered as secure, because `getUserMedia` needs a secure context. Main sends each overlay its display's source over `picker:start`. The overlay under the pointer starts streaming at once; the others start when the pointer first reaches them.

`setContentProtection(true)` keeps the overlay out of its own capture, so the loupe shows what is underneath. On Windows this needs Windows 10 version 2004 or later; older versions capture the overlay as black. The overlay hides the system cursor and draws its own crosshair, because screen capture includes the cursor and would otherwise sample it.

A click sends the pointer position over `picker:done`. The main process then takes one still capture of that display with `desktopCapturer` and reads the exact pixel, because video frames shift colours by a step or two. Escape or a right click cancels.

The overlay has its own preload, `src/preload/picker.ts`, built as a second entry in `electron.vite.config.ts`. One pick runs at a time.

### Performance

| Cost                                                               | Handling                                                                                                             |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Creating three overlay windows blocks the main process for ~250 ms | Overlays are hidden and reloaded after a pick, then reused. They are rebuilt when a display's bounds or scale change |
| `desktopCapturer.getSources` blocks the main process for ~220 ms   | Source ids are cached per display layout and looked up only after the overlays are visible                           |
| Reading a pixel through a CPU canvas copies the whole video frame  | The loupe draws on a GPU canvas; the hex reads one pixel back, at most every 50 ms                                   |
| Drawing on every pointer event and every video frame drops frames  | Both only schedule a draw; one draw runs per animation frame. Positions change through `transform`                   |

`screenPicker.dispose()` closes the hidden overlays when the last other window closes, so they never keep the app running. Repeat picks show the overlays in about 20 ms; the loupe goes live once `getUserMedia` starts, about 250 ms later.

## Picking colours elsewhere

`ProjectColourPicker` in `src/renderer/components/ProjectColourPicker` replaces the plain colour picker wherever a project colour is chosen: board background and grid in the header and Properties panel, and the note fill in Properties. Its popover lists every palette's swatches, grouped by cluster, above a custom picker; choosing a swatch stores the reference, choosing a custom colour clears it. The trigger shows a link badge while a reference is set.
