import { useState } from 'react';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { useWorkspaces } from '@renderer/lib/workspaces';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BoardNode } from '@shared/board';
import { BoardEditor } from '@renderer/components/editors/Board/BoardEditor';
import { AreaContext } from '@renderer/components/Shell/AreaContext';
import { commitChanges, createBoard, createItem, loadBoard } from '@renderer/lib/board';
import { createCardTemplate } from '@renderer/lib/cards';
import { ToastProvider, TooltipProvider } from '@renderer/ui';
import { bootTestApp, makeProject, type FakeApi } from './helpers/api';

let api: FakeApi;

function first(items: HTMLElement[]): HTMLElement {
  const [item] = items;
  if (!item) throw new Error('missing element');
  return item;
}

let latest: Record<string, unknown> = {};

function Harness({ initial = {} }: { initial?: Record<string, unknown> }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [state, setState] = useState<Record<string, unknown>>(initial);
  latest = state;
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

beforeEach(async () => {
  api = await bootTestApp();
  const project = makeProject('Space Game');
  api.current = project;
  api.emitProject();
  await act(async () => {
    await Promise.resolve();
  });
});

function lastNodes(): BoardNode[] {
  const calls = vi.mocked(api.applyBoardChanges).mock.calls;
  return calls[calls.length - 1]?.[1].upsertNodes ?? [];
}

async function place(x: number, y: number, toX = x, toY = y) {
  const overlay = await screen.findByTestId('creation-overlay');
  fireEvent.pointerDown(overlay, { button: 0, clientX: x, clientY: y, pointerId: 1 });
  fireEvent.pointerMove(overlay, { clientX: toX, clientY: toY, pointerId: 1 });
  fireEvent.pointerUp(overlay, { clientX: toX, clientY: toY, pointerId: 1 });
}

describe('board tools', () => {
  it('places items with each creation tool and returns to select', async () => {
    const user = userEvent.setup();
    await createBoard({ name: 'Ideas' });
    render(<Harness />);
    expect(await screen.findByRole('toolbar', { name: 'Board tools' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Sticky note (N)' }));
    expect(latest['tool']).toBe('sticky');
    await place(300, 200);
    expect(lastNodes()[0]).toMatchObject({ type: 'text', width: 200, height: 120, x: 200, y: 140 });
    expect(latest['tool']).toBe('select');

    await user.click(screen.getByRole('button', { name: 'Container (F)' }));
    await place(10, 10, 410, 310);
    expect(lastNodes()[0]).toMatchObject({ type: 'container', x: 10, y: 10, width: 400, height: 300 });

    await user.click(screen.getByRole('button', { name: 'Text (T)' }));
    await place(100, 100);
    expect(lastNodes()[0]).toMatchObject({ type: 'text', parentId: expect.any(String) as string });

    await user.click(screen.getByRole('button', { name: 'Shape' }));
    await user.click(await screen.findByRole('menuitem', { name: /Ellipse/ }));
    expect(latest).toMatchObject({ tool: 'ellipse', shape: 'ellipse' });
    await place(900, 900);
    expect(lastNodes()[0]?.data['style']).toMatchObject({ shape: 'ellipse' });
  });

  it('connects two items with the arrow tool and picks the facing sides', async () => {
    const board = await createBoard({ name: 'Flow' });
    await loadBoard(board.id);
    const left = {
      ...createItem({ boardId: board.id, preset: 'rectangle', rect: { x: 0, y: 0 }, z: 1 }),
      id: 'left',
    };
    const right = {
      ...createItem({ boardId: board.id, preset: 'rectangle', rect: { x: 500, y: 0 }, z: 2 }),
      id: 'right',
    };
    await commitChanges(board.id, { upsertNodes: [left, right] });
    render(<Harness initial={{ tool: 'arrow' }} />);

    const overlay = await screen.findByTestId('creation-overlay');
    fireEvent.pointerDown(overlay, { button: 0, clientX: 50, clientY: 50, pointerId: 1 });
    fireEvent.pointerMove(overlay, { clientX: 300, clientY: 50, pointerId: 1 });
    fireEvent.pointerUp(overlay, { clientX: 550, clientY: 50, pointerId: 1 });
    const calls = vi.mocked(api.applyBoardChanges).mock.calls;
    expect(calls[calls.length - 1]?.[1].upsertEdges?.[0]).toMatchObject({
      sourceId: 'left',
      targetId: 'right',
      data: { sourceHandle: 'right', targetHandle: 'left' },
    });

    const before = calls.length;
    fireEvent.pointerDown(overlay, { button: 0, clientX: 3000, clientY: 3000, pointerId: 1 });
    fireEvent.pointerUp(overlay, { clientX: 550, clientY: 50, pointerId: 1 });
    expect(vi.mocked(api.applyBoardChanges).mock.calls).toHaveLength(before);
  });

  it('switches tools from the keyboard and places a card from the chosen template', async () => {
    await createBoard({ name: 'Cards' });
    const template = await createCardTemplate({
      name: 'Hero',
      width: 280,
      height: 300,
      fields: [{ id: 'name', kind: 'text' }],
    });
    render(<Harness />);
    await screen.findByRole('toolbar', { name: 'Board tools' });
    const surface = document.querySelector('[data-tool]');
    if (!surface) throw new Error('missing surface');
    fireEvent.keyDown(surface, { key: 'n' });
    expect(latest['tool']).toBe('sticky');
    fireEvent.keyDown(surface, { key: 'Escape' });
    expect(latest['tool']).toBe('select');
    fireEvent.keyDown(surface, { key: 'd' });
    expect(latest).toMatchObject({ tool: 'diamond', shape: 'diamond' });
    fireEvent.keyDown(surface, { key: 'c' });
    await place(400, 400);
    expect(lastNodes()[0]).toMatchObject({
      type: 'card',
      width: 280,
      height: 300,
      data: { templateId: template.id, values: {} },
    });
  });

  it('opens the template editor when a card is placed without templates', async () => {
    await createBoard({ name: 'Empty' });
    render(<Harness initial={{ tool: 'card' }} />);
    await place(100, 100);
    await vi.waitFor(() => {
      expect(JSON.stringify(renderHook(() => useWorkspaces()).result.current)).toContain(
        '"editor":"cardDesigner"',
      );
    });
  });

  it('duplicates, reorders, locks and deletes items from the context menu', async () => {
    const user = userEvent.setup();
    const board = await createBoard({ name: 'Menu' });
    await loadBoard(board.id);
    const frame = {
      ...createItem({ boardId: board.id, preset: 'container', rect: { x: 0, y: 0 }, z: 1 }),
      id: 'frame',
    };
    const child = {
      ...createItem({
        boardId: board.id,
        preset: 'sticky',
        rect: { x: 10, y: 40 },
        z: 2,
        data: { text: 'Inside' },
      }),
      id: 'child',
      parentId: 'frame',
    };
    await commitChanges(board.id, { upsertNodes: [frame, child] });
    render(<Harness />);

    fireEvent.contextMenu(await screen.findByRole('group', { name: 'Inside' }));
    await user.click(await screen.findByRole('menuitem', { name: /Duplicate/ }));
    expect(lastNodes()).toHaveLength(1);
    expect(lastNodes()[0]).toMatchObject({ parentId: 'frame', data: { text: 'Inside' } });

    fireEvent.contextMenu(await screen.findByRole('group', { name: 'Container' }));
    await user.click(await screen.findByRole('menuitem', { name: /Lock/ }));
    expect(lastNodes()[0]).toMatchObject({ id: 'frame', data: { locked: true } });

    fireEvent.contextMenu(first(screen.getAllByRole('group', { name: 'Inside' })));
    await user.click(await screen.findByRole('menuitem', { name: 'Take out of container' }));
    expect(lastNodes()[0]).toMatchObject({ parentId: null });

    fireEvent.contextMenu(first(screen.getAllByRole('group', { name: 'Inside' })));
    await user.click(await screen.findByRole('menuitem', { name: /Bring to front/ }));
    expect(lastNodes()[0]?.z).toBeGreaterThan(2);

    fireEvent.contextMenu(await screen.findByRole('group', { name: 'Container' }));
    await user.click(await screen.findByRole('menuitem', { name: /Unlock/ }));
    fireEvent.contextMenu(await screen.findByRole('group', { name: 'Container' }));
    await user.click(await screen.findByRole('menuitem', { name: /^Delete/ }));
    const calls = vi.mocked(api.applyBoardChanges).mock.calls;
    expect(calls[calls.length - 1]?.[1].removeNodeIds).toEqual(expect.arrayContaining(['frame']));
  });
});
