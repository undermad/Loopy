---
sidebar_position: 12
description: The tickets board, backlog with sprints, completed view, the ticket window, templates and where they are stored.
---

# Tickets

The Tickets editor is a Jira-style board with far less of Jira: a board for the active sprint, a backlog that plans sprints, a completed view, and a ticket window that follows the selected card. It anchors the Planning workspace.

## Model

Project migration 2 adds the first four tables; migration 7 adds sprints, comments, templates and three ticket columns. Migration 12 adds `links`, a JSON list of linked assets.

| Table              | Holds                                                                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ticket_states`    | Columns: name, position key, category `todo`, `doing` or `done`, colour. Three ship by default                                                               |
| `tickets`          | Number, title, HTML description, type, priority, nullable `state_id` and `sprint_id`, `estimate` in points, `due_at` date, position key, timestamps, `links` |
| `labels`           | Name and colour, unique by name                                                                                                                              |
| `ticket_labels`    | Ticket to label links, removed with either side                                                                                                              |
| `sprints`          | Name, goal, status `planned`, `active` or `completed`, position key, started and completed timestamps                                                        |
| `ticket_comments`  | HTML body per ticket, removed with the ticket                                                                                                                |
| `ticket_templates` | Name plus the title, description, type, priority, estimate and label ids a new ticket starts from                                                            |

A ticket's key is the first three letters of the project name plus its number, so `SPA-12` in a project called Space Game. Moving a ticket into a `done` state sets `resolved_at`; moving it out clears it. A ticket with no sprint is in the backlog whatever its state; a ticket that joins a sprint while it has no state gets the first `todo` state, so it has a column on the board.

Order inside a list is a string key from `src/shared/ordering.ts`: `keyBetween(before, after)` returns a key that sorts between two neighbours, so a move changes one row and never renumbers the rest. The same key orders a ticket within its board column and within its sprint.

### Sprints

One sprint is active at a time. Starting a planned sprint stamps `started_at`; completing the active sprint stamps `completed_at`, keeps its resolved tickets and moves the unfinished ones to the backlog or to a planned sprint of the user's choice. A completed sprint cannot take tickets again. Deleting a sprint returns its tickets to the backlog.

## Channels

`src/main/ipc/tickets.ts` works on the open project and refuses every call when none is open. Each mutation returns the whole snapshot, so a change made in one area reaches every other area in the same round trip.

| Channel                                                                                   | Does                                                                                    |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `tickets:snapshot`                                                                        | States, tickets, labels, links, sprints, comments and templates                         |
| `tickets:create`, `tickets:update`, `tickets:move`, `tickets:delete`                      | Ticket lifecycle; create takes every field and label ids, move takes an optional sprint |
| `tickets:setLabels`                                                                       | Replaces a ticket's labels                                                              |
| `states:create`, `states:update`, `states:move`, `states:delete`                          | Column lifecycle; delete moves tickets elsewhere                                        |
| `labels:create`, `labels:update`, `labels:delete`                                         | Label lifecycle                                                                         |
| `sprints:create`, `sprints:update`, `sprints:start`, `sprints:complete`, `sprints:delete` | Sprint lifecycle; complete names where unfinished tickets go                            |
| `comments:create`, `comments:update`, `comments:delete`                                   | Comments on a ticket                                                                    |
| `templates:create`, `templates:update`, `templates:delete`                                | Ticket templates                                                                        |

The repository for sprints, comments and templates is `src/main/storage/sprints-repository.ts`; tickets, states and labels stay in `tickets-repository.ts`.

## Renderer

`src/renderer/lib/tickets` keeps the snapshot and the selected ticket, reloads when the project changes, and exposes `ticketActions`, `stateActions`, `labelActions`, `sprintActions`, `commentActions` and `templateActions`. `ticketActions.moveTo(id, stateId, index)` places a ticket in a board column, `place(id, sprintId, index, siblings)` places it in a sprint or the backlog, and `fromTemplate(template)` creates a ticket from a template. Selectors such as `activeSprint`, `boardTickets`, `ticketsInSprint`, `completedSprints`, `completedTickets` and `commentsOf` derive the views.

The editor components live in `src/renderer/components/editors/Tickets`. The Tickets editor has Board, Backlog and Completed modes in its header, a search box, a New ticket menu (blank or from a template, plus template management) and a toggle for the ticket panel. Modes and search are area state.

### Board

The board shows the tickets of the active sprint by state, or every ticket with a state when no sprint is active, and names the sprint in the header. Quick add in a column creates the ticket inside the active sprint. Drag and drop uses `@dnd-kit/core` and `@dnd-kit/sortable` with a pointer sensor, so it works in Electron and under Playwright's mouse. While a card drags, the other cards slide out of its way to show where it lands and a copy follows the pointer in a `DragOverlay`; the grip in a column header drags the whole column the same way. The gesture keeps a local copy of the orders, calls `tickets:move` or `states:reorder` once on release, and holds the settled order on screen until the reply lands. The keyboard does the same: Space picks up the focused card or grip, the arrow keys move it, Space drops it and Escape cancels, while Enter on a card selects it. Column menus rename, recolour, recategorise, reorder and delete states.

### Backlog

The backlog lists every open sprint, the active one first, then the backlog itself, each as a section with a count, the points total, a quick add and its own drop target. Cards drag between sections with the same dnd-kit gesture as the board. A planned sprint has a Start button, disabled while another sprint is active; the active sprint has Complete, which asks where unfinished tickets go. The section menu edits the name and goal or deletes the sprint. Each row shows the state, points and due date, and its menu adds the ticket to a sprint or removes it.

### Completed

The completed view groups completed sprints, newest first, each collapsible with its tickets, dates and points, followed by resolved tickets that never belonged to a sprint. Rows select the ticket like anywhere else, so the ticket window opens to reopen or edit it.

### Ticket window

The Ticket editor follows the selected ticket. Selecting a card opens it: the Tickets editor splits its area to the right at 420 px when no Ticket area is open in the workspace, and the header button toggles it, through the same panel helper in `src/renderer/lib/workspaces` the board uses for Properties. The window edits the title inline, the description in a rich text editor, and state, sprint, type, priority, estimate, due date and labels in a details grid; it lists comments with inline editing and a compose box, saves the ticket as a template, shows created, updated and resolved times and deletes behind a confirmation.

### Linked assets

Linked assets ties boards, colour palettes and files to a ticket. Link asset opens a searchable list grouped by Boards, Colour palettes, Notes and Files; a switch links or unlinks each one. Each link shows as a card with the asset's icon or preview, its name and its type, drawn by `AssetLinkCard`, the same card a board link item uses. Clicking a card opens the asset as described on the assets page: in an open editor of that kind if there is one, otherwise in its home workspace. A link whose asset was deleted shows as Missing asset and stays until it is unlinked. Dragging files, boards or palettes from the Assets editor onto the ticket window links them all; the Linked assets section lights up while you hover.

A link is `{ kind, id }` with kind `board`, `palette`, `asset` or `note`. A note link opens the note in the Idea Map workspace, see the notes page. `tickets:update` takes the whole list as `links` and drops duplicates.

### Rich text

`RichText` in `src/renderer/ui` wraps TipTap with a toolbar for bold, italic, strikethrough, inline code, two heading levels, bullet, numbered and task lists, quotes, code blocks, dividers, links, undo and redo; Ctrl+Enter submits where a submit handler is given. Text is stored as HTML, and `RichContent` renders it through the same schema so unknown markup is dropped. See [ADR 0019](./decisions/0019-tiptap.md).
