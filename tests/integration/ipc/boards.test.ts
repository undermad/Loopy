import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Board, BoardSnapshot } from '@shared/board';
import { IpcChannel } from '@shared/ipc';
import { registerBoardsHandlers } from '../../../src/main/ipc/boards';
import { createProject, type ProjectDatabase } from '../../../src/main/storage';

type Handler = (event: unknown, ...args: unknown[]) => unknown;

let directory: string;
let project: ProjectDatabase;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'loopy-boards-'));
  project = await createProject(join(directory, 'demo.loopy'), 'Demo');
});

afterEach(async () => {
  project.close();
  await rm(directory, { recursive: true, force: true });
});

function setup(open = true) {
  const handlers = new Map<string, Handler>();
  const ipc = { handle: vi.fn((channel: string, handler: Handler) => handlers.set(channel, handler)) };
  registerBoardsHandlers(ipc, { project: () => (open ? project : null) });
  return <T>(channel: string, ...args: unknown[]) =>
    Promise.resolve().then(() => handlers.get(channel)?.({}, ...args)) as Promise<T>;
}

describe('boards IPC handlers', () => {
  it('creates, lists, renames, recolours and deletes boards', async () => {
    const call = setup();
    await expect(call(IpcChannel.boardsList)).resolves.toEqual([]);
    const board = await call<Board>(IpcChannel.boardsCreate, { name: 'Ideas' });
    expect(board).toMatchObject({
      name: 'Ideas',
      backgroundColor: '#f4f4f5',
      gridColor: '#808080',
      unit: 'm',
      unitScale: 100,
    });

    const renamed = await call<Board>(IpcChannel.boardsUpdate, board.id, {
      name: 'Level 1',
      backgroundColor: '#112233',
    });
    expect(renamed).toMatchObject({ name: 'Level 1', backgroundColor: '#112233' });
    const metric = await call<Board>(IpcChannel.boardsUpdate, board.id, {
      unit: 'cm',
      unitScale: 12.5,
      gridColor: '#445566',
    });
    expect(metric).toMatchObject({ unit: 'cm', unitScale: 12.5, gridColor: '#445566' });
    await expect(call(IpcChannel.boardsUpdate, board.id, { unit: 'inch' })).rejects.toThrow();
    await expect(call(IpcChannel.boardsUpdate, board.id, { unitScale: 0 })).rejects.toThrow();
    await expect(call(IpcChannel.boardsUpdate, board.id, { backgroundColor: 'red' })).rejects.toThrow();

    await expect(call(IpcChannel.boardsDelete, board.id)).resolves.toEqual([]);
    await expect(call(IpcChannel.boardsRead, board.id)).rejects.toThrow(/Unknown board/);
  });

  it('applies node and edge changes and refuses foreign board ids', async () => {
    const call = setup();
    const board = await call<Board>(IpcChannel.boardsCreate, { name: 'Flow' });
    const node = (id: string, x: number) => ({
      id,
      boardId: board.id,
      type: 'text',
      x,
      y: 0,
      width: 200,
      height: 120,
      z: 1,
      data: { text: `note ${id}` },
    });

    let snapshot = await call<BoardSnapshot>(IpcChannel.boardsApplyChanges, board.id, {
      upsertNodes: [node('a', 0), node('b', 300)],
      upsertEdges: [{ id: 'e1', boardId: board.id, sourceId: 'a', targetId: 'b', data: {} }],
    });
    expect(snapshot.nodes.map((item) => item.id)).toEqual(['a', 'b']);
    expect(snapshot.edges).toHaveLength(1);
    expect(snapshot.nodes[0]?.data).toEqual({ text: 'note a' });

    snapshot = await call<BoardSnapshot>(IpcChannel.boardsApplyChanges, board.id, {
      upsertNodes: [{ ...node('a', 50), data: { text: 'moved' } }],
    });
    expect(snapshot.nodes.find((item) => item.id === 'a')).toMatchObject({ x: 50, data: { text: 'moved' } });

    snapshot = await call<BoardSnapshot>(IpcChannel.boardsApplyChanges, board.id, {
      upsertNodes: [
        { ...node('file', 600), type: 'file', data: { assetId: 'asset-1', dock: 'd', hidden: true } },
      ],
    });
    expect(snapshot.nodes.find((item) => item.id === 'file')).toMatchObject({
      type: 'file',
      data: { assetId: 'asset-1', dock: 'd', hidden: true },
    });

    snapshot = await call<BoardSnapshot>(IpcChannel.boardsApplyChanges, board.id, {
      removeNodeIds: ['b', 'file'],
    });
    expect(snapshot.nodes).toHaveLength(1);
    expect(snapshot.edges).toHaveLength(0);

    await expect(
      call(IpcChannel.boardsApplyChanges, board.id, { upsertNodes: [{ ...node('c', 0), boardId: 'other' }] }),
    ).rejects.toThrow(/another board/);
    await expect(call(IpcChannel.boardsRead, board.id)).resolves.toMatchObject({ board: { id: board.id } });
  });

  it('nests items in containers, stores parents first and removes children with their container', async () => {
    const call = setup();
    const board = await call<Board>(IpcChannel.boardsCreate, { name: 'Nest' });
    const item = (id: string, parentId: string | null, type = 'text') => ({
      id,
      boardId: board.id,
      parentId,
      type,
      x: 10,
      y: 10,
      width: 100,
      height: 80,
      z: 1,
      data: {},
    });

    let snapshot = await call<BoardSnapshot>(IpcChannel.boardsApplyChanges, board.id, {
      upsertNodes: [item('child', 'frame'), item('inner', 'child'), item('frame', null, 'container')],
      upsertEdges: [{ id: 'e', boardId: board.id, sourceId: 'inner', targetId: 'frame', data: {} }],
    });
    expect(snapshot.nodes.find((node) => node.id === 'inner')?.parentId).toBe('child');
    expect(snapshot.nodes.find((node) => node.id === 'frame')?.parentId).toBeNull();

    await expect(
      call(IpcChannel.boardsApplyChanges, board.id, { upsertNodes: [item('frame', 'inner', 'container')] }),
    ).rejects.toThrow(/contain itself/);
    await expect(
      call(IpcChannel.boardsApplyChanges, board.id, { upsertNodes: [item('lost', 'missing')] }),
    ).rejects.toThrow(/Unknown parent/);
    const other = await call<Board>(IpcChannel.boardsCreate, { name: 'Other' });
    await call(IpcChannel.boardsApplyChanges, other.id, {
      upsertNodes: [{ ...item('foreign', null), boardId: other.id }],
    });
    await expect(
      call(IpcChannel.boardsApplyChanges, board.id, { upsertNodes: [item('stray', 'foreign')] }),
    ).rejects.toThrow(/Unknown parent/);

    snapshot = await call<BoardSnapshot>(IpcChannel.boardsApplyChanges, board.id, {
      removeNodeIds: ['frame'],
    });
    expect(snapshot.nodes).toEqual([]);
    expect(snapshot.edges).toEqual([]);
  });

  it('turns old notes into styled text items when upgrading a project', async () => {
    const { DatabaseSync } = await import('node:sqlite');
    const { migrateDatabase } = await import('../../../src/main/storage/sql-migrations');
    const { projectMigrations } = await import('../../../src/main/storage/project-migrations');
    const db = new DatabaseSync(join(directory, 'legacy.loopy'));
    db.exec('PRAGMA foreign_keys = ON');
    migrateDatabase(db, projectMigrations.slice(0, -1));
    db.prepare(
      `INSERT INTO boards (id, name, background_color, grid_color, unit, unit_scale, created_at, updated_at)
       VALUES ('b', 'Old', '#ffffff', '#808080', 'm', 100, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
    ).run();
    const insert = db.prepare(
      `INSERT INTO board_nodes (id, board_id, type, x, y, width, height, z, data, created_at, updated_at)
       VALUES (?, 'b', 'note', 0, 0, 200, 120, 1, ?, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
    );
    insert.run('plain', JSON.stringify({ text: 'Hello' }));
    insert.run('filled', JSON.stringify({ text: 'Sea', fill: { hex: '#112233', ref: null } }));
    migrateDatabase(db, projectMigrations);
    const rows = db
      .prepare('SELECT id, type, parent_id AS parentId, data FROM board_nodes ORDER BY id')
      .all() as {
      id: string;
      type: string;
      parentId: string | null;
      data: string;
    }[];
    const templates = db.prepare('SELECT COUNT(*) AS count FROM card_templates').get() as { count: number };
    db.close();
    expect(rows.map((row) => [row.id, row.type, row.parentId])).toEqual([
      ['filled', 'text', null],
      ['plain', 'text', null],
    ]);
    expect(JSON.parse(rows[0]?.data ?? '{}')).toEqual({
      text: 'Sea',
      style: { fill: { hex: '#112233', ref: null }, shadow: true, padding: 12, radius: 4 },
    });
    expect(JSON.parse(rows[1]?.data ?? '{}')).toMatchObject({
      text: 'Hello',
      style: { fill: { hex: '#fde68a', ref: null } },
    });
    expect(templates.count).toBe(0);
  });

  it('refuses every channel when no project is open', async () => {
    const call = setup(false);
    await expect(call(IpcChannel.boardsList)).rejects.toThrow(/No project/);
  });
});
