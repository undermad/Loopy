---
sidebar_position: 15
description: The Assets editor, where project files live, how folders and drop targets work, and where the bytes are stored.
---

# Assets

The Assets editor stores every file a project needs inside the project: sprites, audio, video, documents, fonts, 3D models and archives. Files are bytes in the `.loopy` SQLite file, so a project moves as one file and nothing points at a path on disk.

Assets come in two groups. External assets are imported files. Internal assets are things made in Loopy: boards and colour palettes. Both appear in the editor, so a search finds a board or a palette as well as a file.

## Using it

| Action                 | How                                                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Browse by folder       | The Folders view shows a tree with All files at the top. Click a folder, or use the arrow keys and Enter         |
| Browse by kind         | The File types view lists the eight kinds with counts. Imports and drops there land in the folder for each kind  |
| Import                 | Import files… opens the file dialog, or drop files from the desktop anywhere on the editor                       |
| Drop into a folder     | Drop files on a folder row in the tree; the row highlights while you hover                                       |
| Move files             | Drag a card onto a folder row, pick Move to… in the card's menu, or change Folder in the details panel           |
| Select many            | Ctrl-click adds a card, Shift-click selects a range. The menu then moves or deletes the whole selection          |
| Rename, export, delete | Right-click a card, or use the details panel                                                                     |
| Place on a board       | Drag a card onto a board canvas, see the board page                                                              |
| Folders                | New folder creates one inside the selected folder. Right-click a row to rename, nest, move or delete it          |
| Layout                 | The grid and list toggle in the header; list rows show the folder path                                           |
| Search                 | Matches the name, kind and tags of the files in the current folder or kind. All files searches the whole project |
| Internal assets        | Boards and Colour palettes have their own trees under Internal, and their own entries in File types              |

Deleting a folder keeps its files and subfolders and moves them to the parent. Deleting a file removes its bytes.

## Internal assets

The sidebar has an External section with the file tree and an Internal section with a Boards tree and a Colour palettes tree. Their top-level folders are fixed and cannot be renamed, moved or deleted. Subfolders can be made inside them to sort boards and palettes, but a board can only go into a Boards folder and a palette into a Colour palettes folder. The main process refuses any other move.

| Action       | How                                                                                   |
| ------------ | ------------------------------------------------------------------------------------- |
| Sort         | Drag a board or palette card onto a folder in its own tree, or pick Folder in Details |
| Rename       | Details panel, Name                                                                   |
| Open         | Double-click the card, press Enter on it, or use Open in Details. See opening below   |
| Find by name | Search lists matching internal assets under an Internal heading below the files       |

Opening a board or palette uses `openInEditor` from `src/renderer/lib/workspaces`. If any workspace already has a board, or colours, editor, the asset loads there and that workspace becomes active. Otherwise the app switches to the Design workspace for a board or Palette for a palette, creating it from its template if it is gone. If that workspace has no such editor, the item goes into an Empty area, or into a new area split off the first one.

## Drop targets

Files dropped into other workspaces, and imports made in the File types view, land where the asset options say. Open the options with the gear in the header.

| Setting                       | Effect                                                                               |
| ----------------------------- | ------------------------------------------------------------------------------------ |
| Folder matching the file type | Each kind has a folder; the defaults are the seven folders every project starts with |
| Top level                     | Every dropped file lands outside any folder                                          |
| A named folder                | Every dropped file lands in that folder                                              |

With the first setting a table maps each kind to a folder or to Top level. A kind whose folder was deleted falls back to Top level. Changes save as soon as you pick them. Drop targets only use file folders.

## Model

Project migration 8 adds `asset_folders` and extends the `assets` table from migration 3 with `folder_id`, `name`, `kind`, `width`, `height`, `tags` and `updated_at`. It also inserts the seven default folders with the ids in `DEFAULT_FOLDER_IDS` in `src/shared/assets.ts`. Settings live in the project `settings` table as JSON: `dropTarget` is `byKind`, `root` or a folder id, and `kindFolders` maps a kind to a folder id or `null` for the top level.

Project migration 11 adds `scope` to `asset_folders` (`files`, `boards` or `palettes`, default `files`) and `folder_id` to `boards` and `palettes`. A folder's parent must have the same scope, and `assertFolderScope` in `assets-repository.ts` checks every folder move and every board or palette move. A board or palette with no folder sits in the fixed top-level folder; deleting a folder moves its boards and palettes to the parent.

The kind of a file comes from its extension first and its MIME type second, see `assetKindOf`. Images get their pixel size on import from `src/main/storage/image-size.ts`. A file larger than 64 MB is refused.

## Channels

`src/main/ipc/assets.ts` works on the open project. Every mutation returns the whole snapshot of folders, assets and settings.

| Channel                                                             | Does                                                                    |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `assets:snapshot`                                                   | Folders, assets without bytes, and settings                             |
| `assets:createFolder`, `assets:updateFolder`, `assets:deleteFolder` | Folder lifecycle with a scope; delete moves contents to the parent      |
| `assets:import`                                                     | Takes file names and bytes plus a target: `auto`, a folder id or `null` |
| `assets:pick`                                                       | Opens the OS file dialog in main and imports the picked files           |
| `assets:update`, `assets:move`, `assets:delete`                     | Rename one file or set its tags, move or delete many                    |
| `assets:export`                                                     | Save dialog, then writes the bytes to disk                              |
| `assets:settings`                                                   | Patches `dropTarget` and `kindFolders`                                  |

The renderer reads bytes through the `loopy-asset://asset/<id>` protocol registered in `src/main/asset-protocol.ts`, so `<img>`, `<audio>` and `<video>` tags work without an IPC round trip. `assetUrl(id)` builds the URL and percent-encodes the id; `assetIdFromUrl` decodes it and rejects anything malformed.

## Renderer

`src/renderer/lib/assets` keeps the snapshot, reloads when the project changes, and exposes `folderActions`, `assetActions`, `importFiles(files, target)`, `pickFiles(target)` and `dropFolderFor(name, mime)` for other editors that accept drops. Pure helpers such as `buildFolderTree`, `folderCounts`, `kindCounts` and `matchesAssetSearch` derive the views.

The components live in `src/renderer/components/editors/Assets`. `InternalGrid` and `InternalDetails` show boards and palettes. View, search, layout, scope, selected folder, kind, selected file or internal asset and the details toggle are area state, so they survive workspace switches; expanded folders and multi-selection are local. Moving cards onto rows uses `@dnd-kit/core` with a pointer sensor and a keyboard sensor: Space picks up the focused card, the arrow keys move it, Space drops and Escape cancels. Desktop drops use the native drag events and stop propagating once handled, so the app-level drop handler does not import the same files twice. While a card drags, `reportAssetDrag` tells any drop zone under the pointer, such as a board, about the move and the drop.

Below 600 pixels wide, as in the Design workspace, the editor hides the details panel and narrows the folder tree with a container query.
