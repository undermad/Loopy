import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LayoutNode } from '@shared/layout';
import { TicketEditor } from '@renderer/components/editors/Tickets/TicketEditor';
import { importFiles, reportAssetDrag } from '@renderer/lib/assets';
import { createBoard } from '@renderer/lib/board';
import { createPalette } from '@renderer/lib/palettes';
import { selectTicket, ticketActions } from '@renderer/lib/tickets';
import {
  areaActions,
  useWorkspaces,
  deleteWorkspace,
  linkTarget,
  openInEditor,
  setActiveWorkspace,
  useActiveWorkspaceId,
} from '@renderer/lib/workspaces';
import { ToastProvider, TooltipProvider } from '@renderer/ui';
import { bootTestApp, makeProject, type FakeApi } from './helpers/api';

let api: FakeApi;
const NAMES = {
  planning: 'Planning',
  design: 'Design',
  palette: 'Palette',
  assets: 'Assets',
  ideas: 'Idea Map',
  cards: 'Cards',
};

function areasOf(node: LayoutNode): { id: string; editor: string; state: Record<string, unknown> }[] {
  return node.kind === 'area' ? [node] : node.children.flatMap(areasOf);
}

function workspace(name: string) {
  const found = renderHook(() => useWorkspaces()).result.current.find((item) => item.name === name);
  if (!found) throw new Error(`No workspace ${name}`);
  return found;
}

function Harness() {
  return (
    <TooltipProvider>
      <ToastProvider closeLabel="Dismiss" regionLabel="Notifications">
        <TicketEditor areaId="b" state={{}} setState={() => undefined} />
      </ToastProvider>
    </TooltipProvider>
  );
}

beforeEach(async () => {
  api = await bootTestApp();
  const project = makeProject('Space Game');
  api.current = project;
  api.emitProject();
});

describe('opening linked assets', () => {
  it('maps each link kind to its editor, state and home workspace', () => {
    expect(linkTarget({ kind: 'board', id: 'b' }, NAMES)).toMatchObject({
      editor: 'board',
      state: { boardId: 'b' },
      workspaceName: 'Design',
    });
    expect(linkTarget({ kind: 'palette', id: 'p' }, NAMES)).toMatchObject({
      editor: 'colours',
      state: { paletteId: 'p', tab: 'wheel' },
      template: 'palette',
    });
    expect(linkTarget({ kind: 'asset', id: 'a' }, NAMES)).toMatchObject({
      editor: 'assets',
      state: { scope: 'files', selectedId: 'a', details: true },
    });
  });

  it('loads into an open editor, switching workspace when it lives elsewhere', () => {
    const active = renderHook(() => useActiveWorkspaceId());
    const design = workspace('Design');
    const boardArea = areasOf(design.root).find((area) => area.editor === 'board');
    act(() => {
      openInEditor(linkTarget({ kind: 'board', id: 'board-9' }, NAMES));
    });
    active.rerender();
    expect(active.result.current).toBe(design.id);
    expect(areasOf(workspace('Design').root).find((area) => area.id === boardArea?.id)?.state).toMatchObject({
      boardId: 'board-9',
    });
  });

  it('adds the editor to its home workspace, or creates that workspace when it is gone', () => {
    const palette = workspace('Palette');
    const only = areasOf(palette.root)[0]?.id ?? '';
    act(() => {
      setActiveWorkspace(palette.id);
    });
    act(() => {
      areaActions.setEditor(only, 'empty');
    });
    act(() => {
      openInEditor(linkTarget({ kind: 'palette', id: 'p1' }, NAMES));
    });
    const opened = areasOf(workspace('Palette').root);
    expect(opened.map((area) => area.editor)).toEqual(['colours']);
    expect(opened[0]?.state).toMatchObject({ paletteId: 'p1' });

    const colours = areasOf(workspace('Palette').root)[0]?.id ?? '';
    act(() => {
      areaActions.setEditor(colours, 'tickets');
    });
    act(() => {
      openInEditor(linkTarget({ kind: 'palette', id: 'p2' }, NAMES));
    });
    expect(areasOf(workspace('Palette').root).map((area) => area.editor)).toEqual(['tickets', 'colours']);

    const doomed = [workspace('Palette').id, workspace('Design').id];
    act(() => {
      doomed.forEach(deleteWorkspace);
    });
    act(() => {
      openInEditor(linkTarget({ kind: 'board', id: 'b2' }, NAMES));
    });
    const created = areasOf(workspace('Design').root).find((area) => area.editor === 'board');
    expect(created?.state).toMatchObject({ boardId: 'b2' });
  });

  it('opens a note in a split note area when the workspace has one instead of a note area', () => {
    act(() => {
      openInEditor(linkTarget({ kind: 'note', id: 'n1' }, NAMES));
    });
    const noteArea = areasOf(workspace('Idea Map').root).find((area) => area.editor === 'note');
    act(() => {
      areaActions.setEditor(noteArea?.id ?? '', 'noteSplit', { view: 'split' });
    });
    act(() => {
      openInEditor(linkTarget({ kind: 'note', id: 'n2' }, NAMES));
    });
    const areas = areasOf(workspace('Idea Map').root);
    expect(areas.filter((area) => area.editor === 'note')).toHaveLength(0);
    expect(areas.find((area) => area.id === noteArea?.id)?.state).toMatchObject({
      noteId: 'n2',
      view: 'split',
    });
  });
});

describe('linked assets on a ticket', () => {
  it('links boards, palettes and files, shows them as chips and opens them', async () => {
    const user = userEvent.setup();
    const board = await createBoard({ name: 'Level map' });
    await createPalette({
      name: 'Dusk',
      harmony: 'custom',
      baseIndex: 0,
      source: 'wheel',
      colours: [{ name: '', hex: '#ff8800' }],
    });
    await importFiles([new File([new Uint8Array([1])], 'notes.txt', { type: 'text/plain' })], null);
    await ticketActions.create({ title: 'Build the level', stateId: 'todo' });
    selectTicket('ticket-1');
    render(<Harness />);

    const section = screen.getByRole('region', { name: 'Linked assets' });
    await user.click(within(section).getByRole('button', { name: 'Link asset' }));
    const boards = screen.getByRole('group', { name: 'Boards' });
    await user.click(within(boards).getByRole('switch', { name: 'Level map' }));
    await user.click(within(screen.getByRole('group', { name: 'Colour palettes' })).getByRole('switch'));
    expect(screen.queryByRole('group', { name: 'Files' })).toBeInTheDocument();
    await user.type(
      screen.getByRole('searchbox', { name: 'Search boards, palettes, notes, cards and files' }),
      'zzz',
    );
    expect(screen.getByText('Nothing to link yet')).toBeInTheDocument();
    await user.keyboard('{Escape}');

    expect(api.updateTicket).toHaveBeenLastCalledWith('ticket-1', {
      links: [
        { kind: 'board', id: board.id },
        { kind: 'palette', id: 'palette-1' },
      ],
    });
    const list = within(section).getByRole('list', { name: 'Linked assets' });
    const chip = within(list).getByRole('button', { name: /^Level map/ });
    expect(within(list).getByRole('button', { name: /^Dusk/ })).toHaveAttribute('data-kind', 'palette');

    const active = renderHook(() => useActiveWorkspaceId());
    fireEvent.click(chip);
    active.rerender();
    expect(active.result.current).toBe(workspace('Design').id);
    expect(areasOf(workspace('Design').root).find((area) => area.editor === 'board')?.state).toMatchObject({
      boardId: board.id,
    });

    await user.click(within(list).getByRole('button', { name: 'Unlink Dusk' }));
    expect(api.updateTicket).toHaveBeenLastCalledWith('ticket-1', {
      links: [{ kind: 'board', id: board.id }],
    });
  });

  it('marks links whose asset was deleted', async () => {
    await ticketActions.create({ title: 'Orphan', stateId: 'todo' });
    await ticketActions.update('ticket-1', { links: [{ kind: 'asset', id: 'gone' }] });
    selectTicket('ticket-1');
    render(<Harness />);
    const chip = screen.getByRole('button', { name: /^Missing asset/ });
    expect(chip).toBeDisabled();
    expect(chip).toHaveAttribute('title', 'This asset was deleted');
  });

  it('links files, boards and palettes dropped on the ticket window', async () => {
    const board = await createBoard({ name: 'Level map' });
    const { ids } = await importFiles(
      [new File([new Uint8Array([1])], 'notes.txt', { type: 'text/plain' })],
      null,
    );
    await ticketActions.create({ title: 'Build the level', stateId: 'todo' });
    selectTicket('ticket-1');
    render(<Harness />);
    const zone = document.querySelector<HTMLElement>('[data-asset-drop]');
    if (!zone) throw new Error('missing zone');
    const spy = vi.spyOn(document, 'elementsFromPoint').mockReturnValue([zone]);
    const section = screen.getByRole('region', { name: 'Linked assets' });

    act(() => {
      reportAssetDrag(ids, 50, 50, 'move', [{ kind: 'board', id: board.id }]);
    });
    expect(section.className).toMatch(/linkTarget/);
    act(() => {
      reportAssetDrag(ids, 50, 50, 'drop', [{ kind: 'board', id: board.id }]);
    });
    expect(section.className).not.toMatch(/linkTarget/);
    expect(api.updateTicket).toHaveBeenLastCalledWith('ticket-1', {
      links: [
        { kind: 'asset', id: ids[0] },
        { kind: 'board', id: board.id },
      ],
    });
    spy.mockRestore();
  });
});
