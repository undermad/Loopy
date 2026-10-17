---
sidebar_position: 12
description: The tickets board, the backlog, states, labels and where they are stored.
---

# Tickets

The Tickets editor is a Jira-style board with far less of Jira: columns for states, a backlog, drag and drop between them, and a Ticket editor that follows the selected card. It anchors the Planning workspace.

## Model

Project migration 2 adds four tables.

| Table           | Holds                                                                                                                |
| --------------- | -------------------------------------------------------------------------------------------------------------------- |
| `ticket_states` | Columns: name, position key, category `todo`, `doing` or `done`, colour. Three ship by default                       |
| `tickets`       | Number, title, description, type (`task`, `spike` or `bug`), priority, nullable `state_id`, position key, timestamps |
| `labels`        | Name and colour, unique by name                                                                                      |
| `ticket_labels` | Ticket to label links, removed with either side                                                                      |

A ticket with no state is in the backlog. Its key is the first three letters of the project name plus its number, so `SPA-12` in a project called Space Game. Moving a ticket into a `done` state sets `resolved_at`; moving it out clears it.

Order inside a column is a string key from `src/shared/ordering.ts`: `keyBetween(before, after)` returns a key that sorts between two neighbours, so a move changes one row and never renumbers the rest.

## Channels

`src/main/ipc/tickets.ts` works on the open project and refuses every call when none is open. Each mutation returns the whole snapshot, so a change made in one area reaches every other area in the same round trip.

| Channel                                                              | Does                                             |
| -------------------------------------------------------------------- | ------------------------------------------------ |
| `tickets:snapshot`                                                   | States, tickets, labels and links                |
| `tickets:create`, `tickets:update`, `tickets:move`, `tickets:delete` | Ticket lifecycle; create appends to its column   |
| `tickets:setLabels`                                                  | Replaces a ticket's labels                       |
| `states:create`, `states:update`, `states:move`, `states:delete`     | Column lifecycle; delete moves tickets elsewhere |
| `labels:create`, `labels:update`, `labels:delete`                    | Label lifecycle                                  |

## Renderer

`src/renderer/lib/tickets` keeps the snapshot and the selected ticket, reloads when the project changes, and exposes `ticketActions`, `stateActions` and `labelActions`. `ticketActions.moveTo(id, stateId, index)` turns an index into a position key between the neighbours.

The editor components live in `src/renderer/components/editors/Tickets`. The Tickets editor has Board and Backlog modes in its header and a search box, both kept in area state. Drag and drop uses `@dnd-kit/core` and `@dnd-kit/sortable` with a pointer sensor, so it works in Electron and under Playwright's mouse; backlogs over 100 rows are virtualised with `@tanstack/react-virtual`. While a card drags, the other cards slide out of its way to show where it lands and a copy follows the pointer in a `DragOverlay`; the grip in a column header drags the whole column the same way. The gesture keeps a local copy of the column orders and calls `tickets:move` or `states:reorder` once on release. The keyboard does the same: Space picks up the focused card or column grip, the arrow keys move it, Space drops it and Escape cancels, while Enter on a card selects it. Column menus rename, recolour, recategorise, reorder and delete states. Migration 4 narrows ticket types to task, spike and bug and maps the earlier idea type to task. The Ticket editor edits title, state, type, priority, labels and description, and deletes behind a confirmation.
