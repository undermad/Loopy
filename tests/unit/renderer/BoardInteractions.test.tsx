import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BoardChanges, BoardNode } from '@shared/board';
import { BoardEditor } from '@renderer/components/editors/Board/BoardEditor';
import { AreaContext } from '@renderer/components/Shell/AreaContext';
import { importFiles, reportAssetDrag } from '@renderer/lib/assets';
import {
  commitChanges,
  createBoard,
  createItem,
  getBoardNodes,
  getBoardSelection,
  loadBoard,
  setBoardSelection,
} from '@renderer/lib/board';
import { runEditCommand } from '@renderer/lib/commands';
import { ToastProvider, TooltipProvider } from '@renderer/ui';
import { bootTestApp, makeProject, type FakeApi } from './helpers/api';

let api: FakeApi;
let boardId = '';

function Harness() {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [state, setState] = useState<Record<string, unknown>>({});
  return (
    <TooltipProvider>
      <ToastProvider closeLabel="Dismiss" regionLabel="Notifications">
        <div ref={setSlot} />
        <AreaContext value={{ areaId: 'a', headerSlot: slot }}>
          <BoardEditor
            areaId="a"
            state={state}
            setState={(patch) => {
              setState((current) => ({ ...current, ...patch }));
            }}
          />
        </AreaContext>
      </ToastProvider>
    </TooltipProvider>
  );
}

function sticky(id: string, x: number, y: number, extra: Partial<BoardNode> = {}): BoardNode {
  return {
    ...createItem({ boardId, preset: 'sticky', rect: { x, y }, z: 1, data: { text: id } }),
    id,
    ...extra,
  };
}

function room(): BoardNode {
  return {
    ...createItem({ boardId, preset: 'container', rect: { x: 0, y: 0, width: 600, height: 400 }, z: 1 }),
    id: 'room',
    data: { title: 'Room' },
  };
}

async function open(nodes: BoardNode[]) {
  await commitChanges(boardId, { upsertNodes: nodes }, { history: false });
  render(<Harness />);
  await screen.findByRole('toolbar', { name: 'Board tools' });
  const surface = document.querySelector<HTMLElement>('[data-tool]');
  if (!surface) throw new Error('missing surface');
  return surface;
}

function changes(): BoardChanges[] {
  return vi.mocked(api.applyBoardChanges).mock.calls.map((call) => call[1]);
}

function selected(): string[] {
  return getBoardSelection(boardId).nodeIds;
}

function selectIds(ids: string[]) {
  act(() => {
    setBoardSelection(boardId, ids);
  });
}

function clipboard(initial: Record<string, string> = {}, files: File[] = []) {
  const data: Record<string, string> = { ...initial };
  return {
    data,
    clipboardData: {
      files,
      setData: (type: string, value: string) => {
        data[type] = value;
      },
      getData: (type: string) => data[type] ?? '',
    },
  };
}

beforeEach(async () => {
  api = await bootTestApp();
  const project = makeProject('Space Game');
  api.projects = [project];
  api.current = project;
  api.emitProject();
  const board = await createBoard({ name: 'Ideas' });
  boardId = board.id;
  await loadBoard(boardId);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('board interactions', () => {
  it('reaches inner items only after their container and steps in and out', async () => {
    const surface = await open([room(), sticky('inside', 10, 40, { parentId: 'room' })]);
    const inner = () => document.querySelector<HTMLElement>('.react-flow__node[data-id="inside"]');
    expect(inner()?.style.pointerEvents).toBe('none');

    selectIds(['room']);
    expect(inner()?.style.pointerEvents).not.toBe('none');
    fireEvent.keyDown(surface, { key: 'Enter' });
    expect(selected()).toEqual(['inside']);
    fireEvent.keyDown(surface, { key: 'Escape' });
    expect(selected()).toEqual(['room']);
    fireEvent.keyDown(surface, { key: 'Escape' });
    expect(selected()).toEqual([]);

    fireEvent.keyDown(window, { key: 'Control', ctrlKey: true });
    expect(inner()?.style.pointerEvents).not.toBe('none');
    fireEvent.keyUp(window, { key: 'Control' });
    expect(inner()?.style.pointerEvents).toBe('none');

    const frame = document.querySelector('.react-flow__node[data-id="room"]');
    if (!frame) throw new Error('missing room');
    fireEvent.doubleClick(frame, { clientX: 50, clientY: 60 });
    expect(selected()).toEqual(['inside']);

    fireEvent.keyDown(surface, { key: 'a', ctrlKey: true });
    expect(selected()).toEqual(['inside']);
  });

  it('aligns, distributes, duplicates, locks and orders from the keyboard', async () => {
    const surface = await open([sticky('a', 0, 0), sticky('b', 300, 60), sticky('c', 900, 20)]);
    selectIds(['a', 'b', 'c']);
    fireEvent.keyDown(surface, { key: 'å', code: 'KeyW', altKey: true });
    expect(
      changes()
        .at(-1)
        ?.upsertNodes?.map((node) => [node.id, node.y]),
    ).toEqual([
      ['b', 0],
      ['c', 0],
    ]);
    fireEvent.keyDown(surface, { key: 'H', code: 'KeyH', altKey: true, shiftKey: true });
    expect(
      changes()
        .at(-1)
        ?.upsertNodes?.map((node) => node.id),
    ).toEqual(['b']);
    fireEvent.keyDown(surface, { key: ']' });
    fireEvent.keyDown(surface, { key: '[' });
    fireEvent.keyDown(surface, { key: 'l', ctrlKey: true });
    expect(
      changes()
        .at(-1)
        ?.upsertNodes?.every((node) => node.data['locked'] === true),
    ).toBe(true);
    fireEvent.keyDown(surface, { key: 'd', ctrlKey: true });
    expect(getBoardNodes(boardId)).toHaveLength(6);
    selectIds(['a']);
    fireEvent.keyDown(surface, { key: 'a', code: 'KeyA', altKey: true });
    expect(getBoardNodes(boardId)).toHaveLength(6);
  });

  it('copies, cuts and pastes items, text and files', async () => {
    const surface = await open([sticky('a', 0, 0)]);
    selectIds(['a']);
    const copied = clipboard();
    fireEvent.copy(surface, { clipboardData: copied.clipboardData });
    expect(copied.data['text/plain']).toBe('a');
    expect(copied.data['application/x-loopy-board']).toContain('"version":1');

    fireEvent.paste(surface, { clipboardData: clipboard(copied.data).clipboardData });
    expect(getBoardNodes(boardId)).toHaveLength(2);
    fireEvent.paste(surface, { clipboardData: clipboard({ 'text/plain': 'a' }).clipboardData });
    expect(getBoardNodes(boardId)).toHaveLength(3);
    fireEvent.paste(surface, { clipboardData: clipboard({ 'text/plain': 'Fresh idea' }).clipboardData });
    expect(getBoardNodes(boardId).some((node) => node.data['text'] === 'Fresh idea')).toBe(true);
    fireEvent.paste(surface, { clipboardData: clipboard().clipboardData });
    expect(getBoardNodes(boardId)).toHaveLength(4);

    const image = new File(['png'], 'shot.png', { type: 'image/png' });
    fireEvent.paste(surface, { clipboardData: clipboard({}, [image]).clipboardData });
    await waitFor(() => {
      expect(getBoardNodes(boardId).some((node) => node.type === 'image')).toBe(true);
    });

    selectIds(['a']);
    fireEvent.cut(surface, { clipboardData: clipboard().clipboardData });
    expect(getBoardNodes(boardId).some((node) => node.id === 'a')).toBe(false);
    selectIds([]);
    const empty = clipboard();
    fireEvent.copy(surface, { clipboardData: empty.clipboardData });
    expect(empty.data).toEqual({});
  });

  it('answers Edit menu commands while the board has focus', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    const read = vi.fn(() =>
      Promise.resolve([{ types: ['text/plain'], getType: () => Promise.resolve(new Blob(['From menu'])) }]),
    );
    Object.defineProperty(navigator, 'clipboard', { value: { writeText, read }, configurable: true });
    const surface = await open([sticky('a', 0, 0), sticky('b', 300, 0)]);
    act(() => {
      surface.focus();
    });

    act(() => {
      expect(runEditCommand('selectAll')).toBe(true);
    });
    expect(selected()).toEqual(['a', 'b']);
    act(() => {
      runEditCommand('copy');
    });
    expect(writeText).toHaveBeenCalledWith('a\n\nb');
    await act(async () => {
      runEditCommand('paste');
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(getBoardNodes(boardId).some((node) => node.data['text'] === 'From menu')).toBe(true);
    });
    read.mockRejectedValueOnce(new Error('denied'));
    await act(async () => {
      runEditCommand('paste');
      await Promise.resolve();
    });
    expect(await screen.findByText("Couldn't read the clipboard")).toBeInTheDocument();
    selectIds(['a']);
    act(() => {
      runEditCommand('cut');
    });
    expect(getBoardNodes(boardId).some((node) => node.id === 'a')).toBe(false);
    selectIds(['b']);
    act(() => {
      runEditCommand('delete');
    });
    expect(getBoardNodes(boardId).some((node) => node.id === 'b')).toBe(false);
    await act(async () => {
      expect(runEditCommand('undo')).toBe(true);
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(getBoardNodes(boardId).some((node) => node.id === 'b')).toBe(true);
    });
  });

  it('places assets dragged from the assets panel and dropped files', async () => {
    const { ids } = await act(() =>
      importFiles(
        [
          new File(['p'], 'map.png', { type: 'image/png' }),
          new File(['a'], 'theme.mp3', { type: 'audio/mpeg' }),
        ],
        'auto',
      ),
    );
    const [imageId = '', audioId = ''] = ids;
    const picture = {
      ...createItem({ boardId, preset: 'image', rect: { x: 700, y: 0 }, z: 1, data: { assetId: null } }),
      id: 'picture',
    };
    const surface = await open([room(), picture]);
    vi.spyOn(document, 'elementsFromPoint').mockReturnValue([surface]);

    act(() => {
      reportAssetDrag([imageId], 100, 100, 'move');
    });
    expect(screen.getByText('Add to Room')).toBeInTheDocument();
    act(() => {
      reportAssetDrag([imageId], 100, 100, 'drop');
    });
    expect(screen.queryByText('Add to Room')).not.toBeInTheDocument();
    const placed = getBoardNodes(boardId).find((node) => node.type === 'image' && node.id !== 'picture');
    expect(placed).toMatchObject({ parentId: 'room', data: { assetId: imageId } });

    act(() => {
      reportAssetDrag([imageId], 750, 50, 'drop');
    });
    expect(getBoardNodes(boardId).find((node) => node.id === 'picture')?.data['assetId']).toBe(imageId);
    act(() => {
      reportAssetDrag([audioId, imageId], 1000, 600, 'drop');
    });
    expect(getBoardNodes(boardId).filter((node) => node.type === 'file')).toHaveLength(1);

    const files = [
      new File(['v'], 'intro.mp4', { type: 'video/mp4' }),
      new File(['t'], 'notes.txt', { type: 'text/plain' }),
    ];
    fireEvent.dragOver(surface, {
      clientX: 100,
      clientY: 100,
      dataTransfer: { types: ['Files'], files: [] },
    });
    fireEvent.dragLeave(surface, { relatedTarget: document.body });
    fireEvent.dragOver(surface, {
      clientX: 2000,
      clientY: 2000,
      dataTransfer: { types: ['text/plain'], files: [] },
    });
    fireEvent.drop(surface, { clientX: 1200, clientY: 900, dataTransfer: { types: ['Files'], files } });
    await waitFor(() => {
      expect(getBoardNodes(boardId).filter((node) => node.type === 'file')).toHaveLength(3);
    });
  });

  it('adds connected items from the + buttons and splits docks at a seam', async () => {
    await open([
      sticky('a', 0, 0, { data: { text: 'a', dock: 'd' } }),
      sticky('b', 200, 0, { data: { text: 'b', dock: 'd' } }),
    ]);
    selectIds(['a']);
    expect(document.querySelector('[class*="dockedPeer"]')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Detach these items' }));
    expect(getBoardNodes(boardId).map((node) => node.data['dock'])).toEqual([null, null]);

    selectIds(['b']);
    fireEvent.click(screen.getByRole('button', { name: 'Add a connected item below' }));
    const last = changes().at(-1);
    expect(last?.upsertNodes?.[0]).toMatchObject({ x: 200, y: 168, data: { text: '' } });
    expect(last?.upsertEdges?.[0]).toMatchObject({
      sourceId: 'b',
      data: { sourceHandle: 'bottom', targetHandle: 'top' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => {
      expect(getBoardNodes(boardId)).toHaveLength(2);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }));
    await waitFor(() => {
      expect(getBoardNodes(boardId)).toHaveLength(3);
    });
  });
});
