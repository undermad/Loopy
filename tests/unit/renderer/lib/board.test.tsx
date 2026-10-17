import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  commitChanges,
  createBoard,
  deleteBoard,
  loadBoard,
  updateBoard,
  useBoardSnapshot,
  useBoards,
} from '@renderer/lib/board';
import { newEdge, newNote } from '@renderer/components/editors/Board/boardFlow';
import { bootTestApp, makeProject } from '../helpers/api';

describe('board library', () => {
  it('creates boards, commits changes locally first and keeps snapshots in sync', async () => {
    const api = await bootTestApp();
    const project = makeProject('Space Game');
    api.projects = [project];
    api.current = project;
    api.emitProject();

    const board = await createBoard({ name: 'Ideas' });
    const { result } = renderHook(() => ({ boards: useBoards(), snapshot: useBoardSnapshot(board.id) }));
    expect(result.current.boards?.map((item) => item.name)).toEqual(['Ideas']);

    await act(async () => {
      await loadBoard(board.id);
    });
    expect(result.current.snapshot?.nodes).toEqual([]);

    const note = newNote(board.id, 0, 0, 1);
    const other = newNote(board.id, 50, 50, 2);
    await act(async () => {
      await commitChanges(board.id, {
        upsertNodes: [note, other],
        upsertEdges: [newEdge(board.id, note.id, other.id)],
      });
    });
    expect(result.current.snapshot?.nodes).toHaveLength(2);
    expect(result.current.snapshot?.edges).toHaveLength(1);

    await act(async () => {
      await commitChanges(board.id, { upsertNodes: [{ ...note, x: 99 }], removeNodeIds: [other.id] });
    });
    expect(result.current.snapshot?.nodes).toHaveLength(1);
    expect(result.current.snapshot?.nodes[0]?.x).toBe(99);
    expect(result.current.snapshot?.edges).toHaveLength(0);

    await act(async () => {
      await updateBoard(board.id, { name: 'Level', backgroundColor: '#000000' });
    });
    expect(result.current.snapshot?.board).toMatchObject({ name: 'Level', backgroundColor: '#000000' });
    expect(result.current.boards?.[0]?.name).toBe('Level');

    await act(async () => {
      await deleteBoard(board.id);
    });
    expect(result.current.boards).toEqual([]);
    expect(result.current.snapshot).toBeNull();
  });
});
