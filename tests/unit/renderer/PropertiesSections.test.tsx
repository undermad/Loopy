import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BoardNode } from '@shared/board';
import { NodeProperties } from '@renderer/components/editors/Properties/NodeProperties';
import { SelectionProperties } from '@renderer/components/editors/Properties/SelectionProperties';
import { commitChanges, createBoard, createItem, loadBoard, useBoardSnapshot } from '@renderer/lib/board';
import { createItemStyle } from '@renderer/lib/itemStyles';
import { ToastProvider, TooltipProvider } from '@renderer/ui';
import { bootTestApp, makeProject, type FakeApi } from './helpers/api';

let api: FakeApi;

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <ToastProvider closeLabel="Dismiss" regionLabel="Notifications">
        {children}
      </ToastProvider>
    </TooltipProvider>
  );
}

function Live({ boardId, ids }: { boardId: string; ids: string[] }) {
  const snapshot = useBoardSnapshot(boardId);
  if (!snapshot) return null;
  const selected = snapshot.nodes.filter((node) => ids.includes(node.id));
  const [first] = selected;
  if (!first) return null;
  return selected.length > 1 ? (
    <SelectionProperties board={snapshot.board} nodes={snapshot.nodes} selected={selected} />
  ) : (
    <NodeProperties board={snapshot.board} node={first} nodes={snapshot.nodes} />
  );
}

async function show(items: ((boardId: string) => BoardNode)[]) {
  const board = await createBoard({ name: 'Ideas', unit: 'px' });
  await loadBoard(board.id);
  const nodes = items.map((make) => make(board.id));
  await commitChanges(board.id, { upsertNodes: nodes }, { history: false });
  render(
    <Providers>
      <Live boardId={board.id} ids={nodes.map((node) => node.id)} />
    </Providers>,
  );
  return nodes;
}

const text =
  (style: Record<string, unknown> = {}) =>
  (boardId: string) =>
    createItem({ boardId, preset: 'rectangle', rect: { x: 0, y: 0 }, z: 1, data: { text: 'Hi', style } });

function styleOf(id: string): Record<string, unknown> | undefined {
  const calls = vi.mocked(api.applyBoardChanges).mock.calls;
  for (let index = calls.length - 1; index >= 0; index -= 1) {
    const found = calls[index]?.[1].upsertNodes?.find((node) => node.id === id);
    if (found) return found.data['style'] as Record<string, unknown>;
  }
  return undefined;
}

async function pick(user: ReturnType<typeof userEvent.setup>, name: string, option: string) {
  await user.click(screen.getByRole('combobox', { name }));
  await user.click(await screen.findByRole('option', { name: option }));
}

beforeEach(async () => {
  api = await bootTestApp();
  api.current = makeProject('Space Game');
  api.emitProject();
  await act(async () => {
    await Promise.resolve();
  });
});

describe('item properties sections', () => {
  it('shows identity, content, layout, appearance, text style and behaviour in that order', async () => {
    await show([text()]);
    const section = screen.getByRole('region', { name: 'Text' });
    const headings = within(section)
      .getAllByRole('button', { expanded: true })
      .map((button) => button.textContent);
    expect(headings).toEqual(['Item', 'Content', 'Layout', 'Appearance', 'Text style', 'Behaviour']);
  });

  it('keeps the new text styles behind More', async () => {
    const user = userEvent.setup();
    const [item] = await show([text()]);
    expect(screen.queryByRole('combobox', { name: 'Font' })).not.toBeInTheDocument();
    const more = screen.getAllByRole('button', { name: 'More' });
    for (const button of more) await user.click(button);
    await pick(user, 'Font', 'Serif');
    expect(styleOf(item?.id ?? '')).toMatchObject({ fontFamily: 'serif' });
    await user.click(screen.getByRole('switch', { name: 'Italic' }));
    expect(styleOf(item?.id ?? '')).toMatchObject({ italic: true });
    await pick(user, 'Text case', 'Upper case');
    expect(styleOf(item?.id ?? '')).toMatchObject({ textCase: 'upper' });
    const line = screen.getByRole('spinbutton', { name: 'Line height' });
    fireEvent.change(line, { target: { value: '9' } });
    fireEvent.blur(line);
    expect(styleOf(item?.id ?? '')).toMatchObject({ lineHeight: 3 });
    await user.click(screen.getByRole('switch', { name: 'Gradient' }));
    expect(styleOf(item?.id ?? '')).toMatchObject({ gradient: { angle: 180 } });
    await user.click(screen.getByRole('switch', { name: 'Shadow' }));
    await pick(user, 'Shadow size', 'Large');
    expect(styleOf(item?.id ?? '')).toMatchObject({ shadowSize: 'lg' });
  });

  it('copies a style from one item and pastes it on another', async () => {
    const user = userEvent.setup();
    await show([text({ italic: true, fontSize: 30 })]);
    await user.click(screen.getByRole('button', { name: 'Copy style' }));
    const others = await show([text({ fontSize: 10 })]);
    const pasteButtons = screen.getAllByRole('button', { name: 'Paste style' });
    const paste = pasteButtons.at(-1);
    if (!paste) throw new Error('missing paste button');
    await user.click(paste);
    expect(styleOf(others[0]?.id ?? '')).toMatchObject({ italic: true, fontSize: 30 });
  });

  it('applies and saves style presets', async () => {
    const user = userEvent.setup();
    await act(() => createItemStyle({ name: 'Warning', style: { fontWeight: 'bold', underline: true } }));
    const [item] = await show([text()]);
    await pick(user, 'Style preset', 'Warning');
    expect(styleOf(item?.id ?? '')).toMatchObject({ fontWeight: 'bold', underline: true });

    await user.click(screen.getByRole('button', { name: 'Save style as preset' }));
    await user.type(await screen.findByRole('textbox', { name: 'Preset name' }), 'Loud');
    await user.click(screen.getByRole('button', { name: 'Save preset' }));
    expect(api.createItemStyle).toHaveBeenLastCalledWith({
      name: 'Loud',
      style: expect.objectContaining({ fontWeight: 'bold', underline: true }) as object,
    });
  });

  it('edits the shared style of several items and marks mixed values', async () => {
    const user = userEvent.setup();
    const [a, b] = await show([text({ fontSize: 20 }), text({ fontSize: 12 })]);
    expect(screen.getByRole('region', { name: '2 items selected' })).toBeInTheDocument();
    expect(screen.getByText('Font size: mixed')).toBeInTheDocument();
    const size = screen.getByRole('spinbutton', { name: 'Font size' });
    fireEvent.change(size, { target: { value: '16' } });
    fireEvent.blur(size);
    expect(styleOf(a?.id ?? '')).toMatchObject({ fontSize: 16 });
    expect(styleOf(b?.id ?? '')).toMatchObject({ fontSize: 16 });
    await user.click(screen.getByRole('switch', { name: 'Shadow' }));
    expect(styleOf(a?.id ?? '')).toHaveProperty('shadow');
    expect(styleOf(b?.id ?? '')).toHaveProperty('shadow');
  });
});
