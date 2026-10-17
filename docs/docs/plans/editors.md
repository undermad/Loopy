---
sidebar_position: 2
description: Welcome screen, the infinite board and the tickets board, with their data model, libraries and phases.
---

# Welcome screen and first editors

:::note Status
Implemented in the first iteration. The pages linked from the sidebar describe what shipped; this page keeps the reasoning and the parts still open.
:::

## Goals

1. A welcome screen when no project is open: create a project, open an existing one, pick a recent one.
2. A Design workspace with an infinite board. Empty at first, with pan, zoom and a background colour, ready for images, diagrams and notes later.
3. A Planning workspace with a Jira-style tickets board: a backlog, columns for states, adding states and tickets, and moving tickets between states. Jira as inspiration, with far less of it.

## Libraries

| Package                                 | Use                                                                                       | Why this one                                                                                                                                                                                                   |
| --------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@xyflow/react` (React Flow 12)         | Infinite board                                                                            | MIT, React 19. Viewport, pan, zoom, minimap, selection and a dotted background come built in. Nodes are React components, so images, notes and diagram boxes share one model, and edges give diagrams for free |
| `@dnd-kit/core` and `@dnd-kit/sortable` | Dragging cards between columns, reordering backlog rows and columns, later workspace tabs | MIT, pointer-driven rather than native HTML5 drag, so it works in Electron and under Playwright's mouse. Sortable lists animate neighbours out of the way, which is the drop preview                           |
| `fractional-indexing`                   | Order of cards, states and board layers                                                   | One row changes per move, no renumbering of siblings                                                                                                                                                           |
| `@tanstack/react-virtual`               | Backlog list                                                                              | A backlog with thousands of rows stays smooth                                                                                                                                                                  |
| `react-colorful`                        | Board background colour, later the theme editor                                           | MIT, under 3 kB, no dependencies, keyboard accessible                                                                                                                                                          |

Considered and not chosen:

- `tldraw` is the most complete whiteboard, but its licence is not open source and the free tier carries a watermark.
- `@excalidraw/excalidraw` is MIT and handles images and drawings well, but it ships its own toolbar, menus and theme that cannot be rebuilt from Loopy's tokens and components. It stays an option as an import or embed later.
- `react-konva` draws to a canvas with full control, at the cost of writing viewport, selection, text editing and hit testing by hand.
- `@atlaskit/pragmatic-drag-and-drop` was the first choice. Its native HTML5 drag events did not fire from Playwright's Electron driver, so it was replaced by `@dnd-kit/core`, whose stable 6.x line is used rather than the 0.x `@dnd-kit/react`.

## Welcome screen

Shown instead of the workspaces whenever no project is open. The menu bar stays, with File and Help active, and no workspace tabs.

| Region   | Shows                                                                                                                       |
| -------- | --------------------------------------------------------------------------------------------------------------------------- |
| Actions  | New project, Open file. New project asks for a name and creates it in the projects directory                                |
| Projects | Every project in `userData/projects`, name and last opened, newest first. Click opens. Context menu: reveal, export, delete |
| Recent   | `recentProjects` from `state.json`, at most 10. A missing file is greyed out with a Remove action                           |

Open file goes through `importProject`, which copies the `.loopy` file into the projects directory, as the architecture page describes. The dialog says so before copying. Project names validate with `projectNameSchema`.

Code: `src/renderer/lib/project` owns the current project, the project list, recent projects and the open, create, close and import actions. `src/renderer/components/Welcome` renders it.

| Channel                                           | Does                                                   |
| ------------------------------------------------- | ------------------------------------------------------ |
| `project:list`                                    | Projects in the directory with id, name, timestamps    |
| `project:create`, `project:open`, `project:close` | Lifecycle. Open and create return the project info     |
| `project:import`, `project:export`                | File dialogs in main, then the storage functions       |
| `project:removeRecent`                            | Drops an entry from `state.json`                       |
| `project:changed`                                 | Main to renderer: the current project opened or closed |

## Infinite board

Editor id `board`, anchored in the Design workspace. React Flow renders it; Loopy owns the data.

### First version

| Feature           | Behaviour                                                                                                 |
| ----------------- | --------------------------------------------------------------------------------------------------------- |
| Pan               | Middle mouse drag, Space and left drag, two-finger scroll                                                 |
| Zoom              | Ctrl and wheel around the pointer, buttons in the header, Home key fits the content, 1 key resets to 100% |
| Background colour | Per board, picked in the header with `react-colorful`, stored in the project                              |
| Grid              | Dot grid toggle in the View menu, drawn by React Flow's `Background`                                      |
| Minimap           | Toggle in the View menu                                                                                   |
| Boards            | A project holds several boards. The header has the board dropdown, rename, add and delete                 |

The viewport, grid and minimap toggles are area state, so two areas can show the same board at different zoom levels and the choice survives a workspace switch. The board's content and background colour live in the project.

### Later

Images dropped or pasted onto the board, sticky notes, shapes, connectors as edges, frames that group nodes, alignment guides. Images go into an `assets` table and reach the renderer through a `loopy-asset://` protocol handler in main, never as base64 over IPC.

### Data

Project migration 2:

| Table         | Columns                                                                             |
| ------------- | ----------------------------------------------------------------------------------- |
| `boards`      | `id`, `name`, `background_color`, `created_at`, `updated_at`                        |
| `board_nodes` | `id`, `board_id`, `type`, `x`, `y`, `width`, `height`, `z`, `data` JSON, timestamps |
| `board_edges` | `id`, `board_id`, `source_id`, `target_id`, `data` JSON                             |
| `assets`      | `id`, `mime`, `size`, `sha256`, `bytes` BLOB, `created_at`                          |

Nodes carry a `type` and a JSON `data` column validated by a zod schema per type in `src/shared/board.ts`, the same pattern the layout tree uses for area state. Channels: `board:list`, `board:create`, `board:update`, `board:delete`, `board:getNodes`, `board:applyChanges` for a batch of node and edge changes, debounced from React Flow's change events.

Code: `src/renderer/lib/board` holds the store, the mapping between rows and React Flow nodes, and the debounced writer. `src/renderer/components/editors/Board` renders the canvas, the header and the node components. React Flow's CSS variables map to Loopy's tokens in one stylesheet so themes apply to the canvas chrome.

## Tickets

Editor id `tickets`, anchored in the Planning workspace, with two modes in the header dropdown the way a Blender editor switches modes: Board and Backlog. A second editor, `ticket`, shows the selected ticket and sits beside it, like the Properties editor follows the active object.

### Model

Project migration 3:

| Table           | Columns                                                                                                                                                                                            |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `states`        | `id`, `name`, `position`, `category` (`todo`, `doing`, `done`), `color`                                                                                                                            |
| `tickets`       | `id`, `number`, `title`, `description`, `type` (`task`, `bug`, `idea`), `priority` (`low`, `medium`, `high`, `urgent`), `state_id` nullable, `position`, `created_at`, `updated_at`, `resolved_at` |
| `labels`        | `id`, `name`, `color`                                                                                                                                                                              |
| `ticket_labels` | `ticket_id`, `label_id`                                                                                                                                                                            |

A ticket with no `state_id` is in the backlog. A ticket's key is the project prefix plus `number`, the prefix defaulting to the first three letters of the project name and editable in project settings. `number` comes from the maximum plus one inside the insert transaction. A fresh project gets three states: To do, In progress and Done. Moving a ticket into a `done` state sets `resolved_at`; moving it out clears it.

### Board mode

| Element    | Behaviour                                                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Columns    | One per state in `position` order, header with name, colour dot and count, horizontal scroll when they overflow                            |
| Cards      | Key, title, type icon, priority marker, label chips. Drag within and between columns with a drop indicator, keyboard move through the menu |
| Quick add  | A text field at the bottom of each column creates a ticket in that state                                                                   |
| Add state  | A button after the last column. New states start as `doing`                                                                                |
| State menu | Rename, colour, category, move left or right, delete. Deleting asks where the column's tickets go                                          |
| Search     | A text filter in the header hides cards that do not match the key or title                                                                 |

### Backlog mode

A single virtualised list in `position` order with quick add at the top, drag to reorder, and a Move to board action that puts the ticket in the first `todo` state. A card can also be dragged from the backlog onto a board column in a split view.

### Ticket editor

Title edited in place, description as plain text in the first version with Markdown later, type, priority, state, labels, created and updated times, and Delete behind a confirmation. It follows the selected ticket in the tickets library, so clicking a card updates every ticket editor in the workspace.

### Left out on purpose

Sprints, assignees, comments, workflow rules, sub-tasks and time tracking. Local-only use needs none of them yet, and each can arrive as a migration without changing what exists.

### Code and channels

`src/renderer/lib/tickets` holds the store, the selection, and pure functions for ordering and moving that are unit tested with no React: `moveTicket(tickets, id, stateId, index)` returns the one changed row. Channels: `tickets:list`, `tickets:create`, `tickets:update`, `tickets:move`, `tickets:delete`, `states:list`, `states:create`, `states:update`, `states:reorder`, `states:delete`, `labels:list`, `labels:create`, `labels:update`, `labels:delete`. Writes are optimistic in the store and reconciled with the reply.

## Area state

| Editor    | State                                            |
| --------- | ------------------------------------------------ |
| `board`   | `boardId`, `viewport`, `grid`, `snap`, `minimap` |
| `tickets` | `mode`, `search`                                 |
| `ticket`  | none, it follows the selection                   |

## Phases

| Phase | Delivers                                                                                                                               | Depends on                         |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| A     | Component library tiers 1 and 2 from the [component library plan](./components.md)                                                     | Nothing, runs beside shell phase 1 |
| B     | Project library, project channels, welcome screen replacing the current `App` body, recent projects in `state.json`                    | Shell phase 1, tier 1 components   |
| C     | Tickets: migration 3, channels, library, board mode, backlog mode, ticket editor, rendered in a single area until the area tree exists | B                                  |
| D     | Board: migration 2, channels, library, React Flow canvas, pan, zoom, fit, background colour, board dropdown                            | B                                  |
| E     | Design and Planning presets wired to real editors, header modes, Properties follows selection                                          | Shell phase 2, C, D                |
| F     | Images and the asset protocol, notes, edges, label filters, Markdown descriptions                                                      | E                                  |

Tests per phase: unit tests for ordering and move logic, integration tests for each migration and channel, component tests for the welcome screen, columns and cards, and E2E flows: create a project from the welcome screen, add a state, add a ticket, drag it to Done, reopen the app and find it there.

## Open questions

1. Several boards per project, as planned, or one board and frames inside it.
2. Assets as BLOBs in the `.loopy` file keep export a single copy. Revisit with a sidecar folder if projects pass a few hundred megabytes.
3. Whether the ticket key prefix is worth exposing at all before projects are shared.
