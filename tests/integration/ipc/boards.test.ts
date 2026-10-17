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
      type: 'note',
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

    snapshot = await call<BoardSnapshot>(IpcChannel.boardsApplyChanges, board.id, { removeNodeIds: ['b'] });
    expect(snapshot.nodes).toHaveLength(1);
    expect(snapshot.edges).toHaveLength(0);

    await expect(
      call(IpcChannel.boardsApplyChanges, board.id, { upsertNodes: [{ ...node('c', 0), boardId: 'other' }] }),
    ).rejects.toThrow(/another board/);
    await expect(call(IpcChannel.boardsRead, board.id)).resolves.toMatchObject({ board: { id: board.id } });
  });

  it('refuses every channel when no project is open', async () => {
    const call = setup(false);
    await expect(call(IpcChannel.boardsList)).rejects.toThrow(/No project/);
  });
});
