---
sidebar_position: 11
description: Menu bar, workspaces, areas, gestures, shortcuts and saved layouts.
---

# Shell

The shell follows Blender: a menu bar on top with workspace tabs, a screen made of areas that each show one editor, and a status bar at the bottom. `AppShell` in `src/renderer/components/Shell` composes it from the libraries below.

## Workspaces

A workspace is a named tab with its own area tree. Click a tab to switch, double-click or use the context menu to rename, duplicate, move or delete it, and the `+` button adds one from a template: Planning, Design, Palette, Assets or Empty. Each workspace keeps its tree, its maximised area and every area's state while inactive.

Workspaces are device state. `src/renderer/lib/workspaces` holds them and writes them to `state.json` through `state:set` 500 ms after the last change and on unload, so they come back after a restart whichever project is open.

## Areas and editors

The tree in `src/shared/layout.ts` is a split node with children and fractional sizes, or an area with an editor id and opaque state. `src/renderer/lib/layout` holds the pure operations: split, join, close, swap, resize, change editor, patch state, and `normalise`, which flattens same-direction nesting and single-child splits. Every operation keeps sizes summing to one.

`src/renderer/lib/editors` is the registry. `registerEditors` in `src/renderer/components/editors` fills it at boot with the editor components, so the library never imports a component. The header of every area has the editor switcher on the left, a slot editors fill through `AreaHeaderContent`, and the area menu on the right.

| Gesture                                 | Result                                                     |
| --------------------------------------- | ---------------------------------------------------------- |
| Drag a corner inwards                   | Split along the drag axis at the pointer position          |
| Drag a corner outwards over a neighbour | Join: the dragged area takes the neighbour's space         |
| Ctrl and drag a corner over a neighbour | Swap the two areas                                         |
| Drag a divider                          | Resize, through `react-resizable-panels`                   |
| Area menu                               | Split, join with a side, swap with a side, maximise, close |
| Ctrl+Space                              | Maximise or restore the area under the pointer             |

Joining and swapping work between adjacent siblings of the same split, which covers the cases where both edges align.

## Layouts

A layout preset is a saved set of workspaces. Built-in presets come from `src/shared/layout-presets.ts`; saved ones live in `userData/layouts/<id>.json` through the `layouts:*` channels. Window menu: Save layout, Load layout with built-in and saved entries, Reset to default layout, Import layout and Export layout. Import and export use the exchange envelope with kind `layout`.

## Menu bar and shortcuts

The menu bar is a Radix Menubar rendered in the renderer. Edit commands first go to `runEditCommand` in `src/renderer/lib/commands`, which offers them to the area that last had focus; the board handles undo, redo, cut, copy, paste, delete and select all this way. Anything not handled goes to the main process, which calls the matching `webContents` method. The library exports `runEditCommand`, `registerEditTarget`, the `useEditTarget` hook and `isEditable`. Shortcuts are declared once in `src/renderer/lib/shortcuts/keymap.ts` and bound with `tinykeys`; the Help menu lists them.

| Shortcut      | Action                      |
| ------------- | --------------------------- |
| Ctrl+N        | New project                 |
| Ctrl+,        | Preferences                 |
| Ctrl+PageDown | Next workspace              |
| Ctrl+PageUp   | Previous workspace          |
| Ctrl+Space    | Maximise area under pointer |
| F11           | Toggle fullscreen           |

## File drops

A file dropped anywhere in the window that no editor handles is added to the project's assets, into the folder the asset options choose for its kind, and a toast reports the count. The Assets and Colours editors handle their own drops first. See the assets page.

## Status bar

Shows the open project, a hint while the pointer is over an area, and the app version. Window menu toggles it; the choice is stored in `state.json`.
