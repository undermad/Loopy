---
sidebar_position: 4
description: Plan for an MCP server that lets AI assistants read and later edit the open Loopy project.
---

# MCP server

:::note Status
Planned. Nothing here is implemented yet.
:::

## Goal

An assistant such as Claude Desktop or Claude Code connects to the installed app and works on the project that is open on screen. The first release reads only. Writes and visual feedback follow once reads are stable.

## Shape

```text
MCP client ──stdio──> Loopy.exe --mcp ──pipe──> running Loopy (main process)
                      (bridge, no window)        MCP server -> repositories -> SQLite
```

1. The client spawns `Loopy.exe --mcp`. That process is a byte bridge between stdio and a local pipe. It holds no MCP logic and opens no project.
2. The running app hosts the MCP server in the main process. Tools call the existing repository functions, such as `listBoards` and `readBoard`, on `projects.current()`.
3. Only the running app touches the project. It owns the temporary session copy, the dirty flag and the save prompt, so a second process opening the `.loopy` file would break that model.

`node:sqlite` is synchronous and the main process is single-threaded, so MCP calls and IPC calls never interleave inside a query. No locking is needed.

## Decisions

| Question        | Choice                                                                              | Reason                                                                  |
| --------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Transport       | stdio bridge to a local pipe                                                        | Every desktop MCP client supports stdio. No open TCP port.              |
| Where MCP runs  | Main process of the primary instance                                                | Tools reuse repositories and tests run with an in-memory transport.     |
| Pipe name       | `\\.\pipe\loopy-mcp-<hash of userData>` on Windows, `<userData>/mcp.sock` elsewhere | Dev, e2e and packaged builds use different user data and never collide. |
| Authentication  | Random token in `<userData>/mcp-token`, sent by the bridge as the first line        | The default Windows pipe ACL lets other local accounts connect.         |
| Opt-in          | `ai.enabled` setting, off by default; the pipe listens only while it is on          | Local-only app; access is an explicit user choice.                      |
| App not running | Bridge starts the app detached and retries the pipe for 15 seconds                  | The client sees a slow first call, not a failure.                       |
| No project open | Tool error `No project is open in Loopy`, reusing `NoProjectError`                  | The assistant can tell the user what to do.                             |
| SDK             | `@modelcontextprotocol/sdk` as a main-process dependency                            | Official SDK with stdio, stream transports and `InMemoryTransport`.     |

This gets ADR `0023-mcp-bridge.md` in `docs/docs/decisions`.

## Phase 0: spike

Answer two questions before writing tools. Throw the spike away afterwards.

1. Do `process.stdin` and `process.stdout` work in a packaged Windows Electron build when a parent spawns it with pipes? If not, the bridge runs as `ELECTRON_RUN_AS_NODE=1 Loopy.exe <path to bridge.cjs>` and the client config changes to match.
2. Does the installed SDK version accept Zod 4 schemas for `inputSchema` and `outputSchema`? If not, convert with `z.toJSONSchema`.

## Phase 1: read tools and bridge

### Bridge

1. `src/main/mcp/bridge.ts`: connect to the pipe, write the token line, then pipe stdin to the socket and the socket to stdout. Exit when either side closes. Log to stderr only, because stdout carries the protocol.
2. `src/main/index.ts`: branch on `--mcp` straight after the user data override and before `requestSingleInstanceLock`. The bridge must not take the lock, create windows or register protocols.
3. `projectPathFromArgv` already ignores arguments starting with `-`, so `--mcp` is never opened as a file.

### Server

1. `src/main/mcp/server.ts`: `createMcpServer({ project, appVersion })` returns an SDK `McpServer` with the tools below. It knows nothing about pipes.
2. `src/main/mcp/listener.ts`: starts `net.createServer` on the pipe name, checks the token, then connects each socket to a fresh server instance. Starts and stops when `ai.enabled` changes, through the settings service.
3. `src/main/mcp/paths.ts`: pipe name and token path from `storagePaths`. Shared by bridge and listener.

### Tools

All tools set `readOnlyHint: true` and return `structuredContent` plus the same JSON as text.

| Tool                  | Calls                                 | Notes                                 |
| --------------------- | ------------------------------------- | ------------------------------------- |
| `get_project`         | `projects.current()` info             | Name, saved path, dirty flag          |
| `list_boards`         | `listBoards`                          | Ids and names                         |
| `read_board`          | `readBoard`, `readTiles`              | Full snapshot for one board           |
| `list_cards`          | `listCards`                           | Saved cards with field values         |
| `list_card_templates` | card templates repository             | Field definitions for cards           |
| `list_notes`          | `listNotes`                           | Ids, titles and links only, no bodies |
| `read_notes`          | `readNotes`                           | Bodies for up to 20 ids               |
| `list_palettes`       | `listPalettes`, `listPaletteClusters` | Colours as hex                        |
| `read_tickets`        | `readSnapshot`                        | States, sprints, labels and tickets   |

Input schemas use `entityIdSchema` from `src/shared/ipc.ts`. Output schemas reuse the existing schemas in `src/shared`, so the tool contract and the IPC contract cannot drift.

### Settings

1. `src/shared/app-settings.ts`: add `ai: { enabled: boolean }` with default `false` and bump `APP_SETTINGS_SCHEMA_VERSION` to 5.
2. Add the 4 to 5 migration in the settings store under `src/main/storage`.
3. The settings dialog gets an AI tab: the switch, the connection state and a button that copies the client config for this install, built from `process.execPath`.

### Tests

| Layer       | File                                                       | Covers                                                                      |
| ----------- | ---------------------------------------------------------- | --------------------------------------------------------------------------- |
| Integration | `tests/integration/mcp/tools.test.ts`                      | Each tool against a temp project via `InMemoryTransport`; no-project error  |
| Integration | `tests/integration/mcp/listener.test.ts`                   | Wrong or missing token is dropped; turning access off closes the pipe       |
| Integration | `tests/integration/storage/app-settings-migration.test.ts` | A version 4 file gains `ai.enabled: false`                                  |
| Unit        | `tests/unit/main/mcp/paths.test.ts`                        | Pipe name per platform and per user data path                               |
| E2E         | `tests/e2e/mcp.spec.ts`                                    | Built app with access on; spawn `--mcp`; `list_boards` returns seeded board |

The temp project setup matches `tests/integration/ipc/boards.test.ts`.

### Docs

1. New page `docs/docs/ai.md`: turning access on, client config for Claude Desktop and Claude Code, the tool list, and what the assistant can and cannot see.
2. `docs/docs/architecture.md`: the bridge and where the server lives.
3. `docs/docs/testing.md`: the new `tests/integration/mcp` folder.
4. ADR 0023.

## Phase 2: write tools

1. Change `DataNotifier` in `src/main/ipc/sync.ts` to take a sender id or `null`. MCP writes pass `null`, mark the project dirty and notify every window through `projectDataChanged`.
2. Tools: `create_board`, `apply_board_changes`, `create_card`, `update_card`, `create_note`, `update_note`, `create_palette`, `create_ticket`, `move_ticket`. Renames go through `trackRename`, as the IPC handlers do.
3. Delete tools set `destructiveHint: true`, so clients ask the user each time.
4. The renderer shows a quiet indicator while an assistant is connected and names the domain it last changed.
5. Known gap: renderer undo does not cover assistant changes. Either group each tool call as one undo entry or document the gap.

## Phase 3: seeing the result

1. `capture_view` returns a PNG of the active editor through `webContents.capturePage`, so the assistant can check a layout it made.
2. Resources such as `loopy://board/<id>` for clients that prefer attached context to tool calls.
3. An `.mcpb` bundle or installer step that registers Loopy with Claude Desktop without editing config by hand.

## Open questions

1. Should the bridge start the app when it is closed, or fail fast with a message?
2. Which editor counts as design first: the board, cards or the Idea Map? That decides the first write tools.
3. Does `read_notes` need a size cap per note, or is the count cap enough?
