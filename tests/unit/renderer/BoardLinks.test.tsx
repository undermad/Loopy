import { useState } from 'react';
import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Board } from '@shared/board';
import { BoardEditor } from '@renderer/components/editors/Board/BoardEditor';
import { AreaContext } from '@renderer/components/Shell/AreaContext';
import { importFiles, reportAssetDrag } from '@renderer/lib/assets';
import {
  commitChanges,
  createBoard,
  createItem,
  getBoardNodes,
  setBoardSelection,
} from '@renderer/lib/board';
import { createPalette } from '@renderer/lib/palettes';
import { useActiveWorkspace } from '@renderer/lib/workspaces';
import { ToastProvider, TooltipProvider } from '@renderer/ui';
import { bootTestApp, makeProject } from './helpers/api';

let overworld: Board;
let dungeon: Board;
let cave: Board;
let state: Record<string, unknown> = {};

function Harness({ initial }: { initial: Record<string, unknown> }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [current, setCurrent] = useState<Record<string, unknown>>(initial);
  state = current;
  return (
    <TooltipProvider>
      <ToastProvider closeLabel="Dismiss" regionLabel="Notifications">
        <div ref={setSlot} />
        <AreaContext value={{ areaId: 'a', headerSlot: slot }}>
          <BoardEditor
            areaId="a"
            state={current}
            setState={(patch) => {
              setCurrent((previous) => ({ ...previous, ...patch }));
            }}
          />
        </AreaContext>
      </ToastProvider>
    </TooltipProvider>
  );
}

function linkNode(boardId: string, id: string, target: { kind: 'board' | 'palette'; id: string } | null) {
  return { ...createItem({ boardId, preset: 'link', rect: { x: 40, y: 40 }, z: 1, data: { target } }), id };
}

async function openCard(name: RegExp) {
  const card = await screen.findByRole('button', { name });
  fireEvent.click(card);
}

beforeEach(async () => {
  const api = await bootTestApp();
  const project = makeProject('Space Game');
  api.projects = [project];
  api.current = project;
  api.emitProject();
  overworld = await createBoard({ name: 'Overworld' });
  dungeon = await createBoard({ name: 'Dungeon' });
  cave = await createBoard({ name: 'Cave' });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('internal assets on a board', () => {
  it('places dropped boards and palettes as link items, but not the board itself', async () => {
    const palette = await createPalette({
      name: 'Dusk',
      harmony: 'custom',
      baseIndex: 0,
      source: 'wheel',
      colours: [{ name: '', hex: '#ff8800' }],
    });
    render(<Harness initial={{ boardId: overworld.id }} />);
    await screen.findByRole('toolbar', { name: 'Board tools' });
    const surface = document.querySelector<HTMLElement>('[data-tool]');
    if (!surface) throw new Error('missing surface');
    vi.spyOn(document, 'elementsFromPoint').mockReturnValue([surface]);

    act(() => {
      reportAssetDrag([], 200, 200, 'drop', [{ kind: 'board', id: overworld.id }]);
    });
    expect(getBoardNodes(overworld.id)).toHaveLength(0);
    act(() => {
      reportAssetDrag([], 200, 200, 'drop', [
        { kind: 'board', id: dungeon.id },
        { kind: 'palette', id: palette.id },
      ]);
    });
    const links = getBoardNodes(overworld.id);
    expect(links.map((node) => [node.type, node.data['target']])).toEqual([
      ['link', { kind: 'board', id: dungeon.id }],
      ['link', { kind: 'palette', id: palette.id }],
    ]);
    const dungeonCard = await screen.findByRole('button', { name: /^Dungeon/ });
    expect(dungeonCard).toHaveAttribute('data-kind', 'board');
    expect(dungeonCard).not.toHaveAttribute('tabindex');
    expect(screen.getByRole('button', { name: /^Dusk/ })).not.toHaveAttribute('tabindex');

    const second = links[1];
    act(() => {
      setBoardSelection(overworld.id, [second?.id ?? '']);
    });
    await openCard(/^Dusk/);
    const active = renderHook(() => useActiveWorkspace()).result.current;
    expect(active?.name).toBe('Palette');
  });

  it('jumps into linked boards, keeps a nested trail and steps back', async () => {
    await commitChanges(
      overworld.id,
      { upsertNodes: [linkNode(overworld.id, 'to-dungeon', { kind: 'board', id: dungeon.id })] },
      { history: false },
    );
    await commitChanges(
      dungeon.id,
      {
        upsertNodes: [
          linkNode(dungeon.id, 'to-cave', { kind: 'board', id: cave.id }),
          linkNode(dungeon.id, 'empty', null),
        ],
      },
      { history: false },
    );
    render(<Harness initial={{ boardId: overworld.id }} />);
    expect(screen.queryByRole('button', { name: /^Back to/ })).not.toBeInTheDocument();

    act(() => {
      setBoardSelection(overworld.id, ['to-dungeon']);
    });
    const card = await screen.findByRole('button', { name: /^Dungeon/ });
    const holder = card.parentElement;
    if (!holder) throw new Error('missing holder');
    fireEvent.pointerDown(holder, { clientX: 0, clientY: 0 });
    fireEvent.click(card, { clientX: 40, clientY: 0 });
    expect(state['boardId']).toBe(overworld.id);
    fireEvent.click(card, { clientX: 40, clientY: 0 });
    expect(state).toMatchObject({ boardId: dungeon.id, boardTrail: [overworld.id] });

    expect(await screen.findByText('Missing asset')).toBeInTheDocument();
    act(() => {
      setBoardSelection(dungeon.id, ['to-cave']);
    });
    await openCard(/^Cave/);
    expect(state).toMatchObject({ boardId: cave.id, boardTrail: [overworld.id, dungeon.id] });

    const back = await screen.findByRole('button', { name: 'Back to Dungeon' });
    const dock = back.parentElement;
    if (!dock) throw new Error('missing dock');
    expect(within(dock).getByRole('toolbar', { name: 'Board tools' })).toBeInTheDocument();
    fireEvent.click(back);
    expect(state).toMatchObject({ boardId: dungeon.id, boardTrail: [overworld.id] });
    fireEvent.click(await screen.findByRole('button', { name: 'Back to Overworld' }));
    expect(state).toMatchObject({ boardId: overworld.id, boardTrail: [] });
    expect(screen.queryByRole('button', { name: /^Back to/ })).not.toBeInTheDocument();
  });

  it('stacks several dropped files and links one under another', async () => {
    const { ids } = await act(() =>
      importFiles(
        [
          new File(['t'], 'notes.txt', { type: 'text/plain' }),
          new File(['a'], 'theme.mp3', { type: 'audio/mpeg' }),
        ],
        'auto',
      ),
    );
    render(<Harness initial={{ boardId: overworld.id }} />);
    await screen.findByRole('toolbar', { name: 'Board tools' });
    const surface = document.querySelector<HTMLElement>('[data-tool]');
    if (!surface) throw new Error('missing surface');
    vi.spyOn(document, 'elementsFromPoint').mockReturnValue([surface]);
    act(() => {
      reportAssetDrag(ids, 300, 200, 'drop', [{ kind: 'board', id: dungeon.id }]);
    });
    const placed = getBoardNodes(overworld.id);
    expect(placed.map((node) => node.type)).toEqual(['file', 'file', 'link']);
    const [first, second, third] = placed;
    if (!first || !second || !third) throw new Error('missing items');
    expect(second.x).toBe(first.x);
    expect(third.x).toBe(first.x);
    expect(second.y).toBe(first.y + first.height + 16);
    expect(third.y).toBe(second.y + second.height + 16);
  });
});
