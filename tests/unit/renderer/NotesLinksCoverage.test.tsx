import { act, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LAYOUT_SCHEMA_VERSION } from '@shared/layout';
import { buildWorkspace } from '@shared/layout-presets';
import type { Sprint, Ticket, TicketsSnapshot } from '@shared/tickets';
import { AssetLinkCard } from '@renderer/components/AssetLinkCard/AssetLinkCard';
import {
  deleteInternal,
  isInternalKind,
  saveInternal,
} from '@renderer/components/editors/Assets/internalActions';
import { importFiles } from '@renderer/lib/assets';
import { createBoard, useBoards } from '@renderer/lib/board';
import { createNote, findNote } from '@renderer/lib/notes';
import { createPalette, usePalettes } from '@renderer/lib/palettes';
import {
  completedSprints,
  completedTickets,
  firstTodoState,
  openSprints,
  sprintActions,
  stateActions,
  templateActions,
  ticketActions,
  ticketsInSprint,
  useTicketsSnapshot,
} from '@renderer/lib/tickets';
import {
  addWorkspace,
  applyLayout,
  bootWorkspaces,
  cycleWorkspace,
  deleteLayout,
  deleteWorkspace,
  duplicateWorkspace,
  flushWorkspaces,
  moveWorkspace,
  renameWorkspace,
  resetWorkspacesStore,
  setActiveWorkspace,
  useActiveWorkspaceId,
  useWorkspaces,
} from '@renderer/lib/workspaces';
import { bootTestApp, createFakeApi, makeProject, type FakeApi } from './helpers/api';

const STAMP = '2026-10-17T09:00:00.000Z';

async function bootWithProject(): Promise<FakeApi> {
  const api = await bootTestApp();
  const project = makeProject('Space Game');
  api.projects = [project];
  api.current = project;
  await act(async () => {
    api.emitProject();
    await Promise.resolve();
  });
  return api;
}

function snapshotOf(api: FakeApi): TicketsSnapshot {
  return api.tickets.snapshot;
}

function ticket(id: string, overrides: Partial<Ticket> = {}): Ticket {
  return {
    id,
    number: 1,
    title: id,
    description: '',
    type: 'task',
    priority: 'medium',
    stateId: null,
    sprintId: null,
    estimate: null,
    dueAt: null,
    position: 'a',
    createdAt: STAMP,
    updatedAt: STAMP,
    resolvedAt: null,
    links: [],
    ...overrides,
  };
}

function sprint(id: string, overrides: Partial<Sprint> = {}): Sprint {
  return {
    id,
    name: id,
    goal: '',
    status: 'planned',
    position: 'a',
    startedAt: null,
    completedAt: null,
    createdAt: STAMP,
    updatedAt: STAMP,
    ...overrides,
  };
}

function snapshot(overrides: Partial<TicketsSnapshot>): TicketsSnapshot {
  return {
    states: [],
    tickets: [],
    labels: [],
    ticketLabels: [],
    sprints: [],
    comments: [],
    templates: [],
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('internal asset actions', () => {
  it('recognises internal kinds', () => {
    expect(isInternalKind('board')).toBe(true);
    expect(isInternalKind('palette')).toBe(true);
    expect(isInternalKind('note')).toBe(true);
    expect(isInternalKind('image')).toBe(false);
  });

  it('saves and deletes boards, palettes and notes', async () => {
    const api = await bootWithProject();
    const board = await createBoard({ name: 'Level' });
    const palette = await createPalette({
      name: 'Dusk',
      harmony: 'custom',
      baseIndex: 0,
      source: 'wheel',
      colours: [{ name: '', hex: '#ff8800' }],
    });
    const note = await createNote({ title: 'Pitch' });

    await saveInternal('board', board.id, { name: 'Forest' });
    expect(api.updateBoard).toHaveBeenLastCalledWith(board.id, { name: 'Forest' });
    await saveInternal('palette', palette.id, { name: 'Dawn' });
    expect(api.updatePalette).toHaveBeenLastCalledWith(palette.id, { name: 'Dawn' });

    await saveInternal('note', note.id, { name: 'Big: pitch?' });
    expect(api.updateNote).toHaveBeenLastCalledWith(note.id, { title: 'Big pitch' });
    expect(findNote(note.id)?.title).toBe('Big pitch');
    await saveInternal('note', note.id, { folderId: null });
    expect(api.updateNote).toHaveBeenLastCalledWith(note.id, { folderId: null });
    await saveInternal('note', note.id, {});
    expect(api.updateNote).toHaveBeenLastCalledWith(note.id, {});

    await deleteInternal('board', board.id);
    expect(api.deleteBoard).toHaveBeenCalledWith(board.id);
    await deleteInternal('palette', palette.id);
    expect(api.deletePalette).toHaveBeenCalledWith(palette.id);
    await deleteInternal('note', note.id);
    expect(api.deleteNotes).toHaveBeenCalledWith([note.id]);
    expect(findNote(note.id)).toBeNull();
  });
});

describe('asset link cards', () => {
  it('shows missing boards and palettes before they load', async () => {
    await bootTestApp();
    expect(renderHook(() => useBoards()).result.current).toBeNull();
    expect(renderHook(() => usePalettes()).result.current).toBeNull();
    render(
      <>
        <AssetLinkCard link={{ kind: 'board', id: 'gone' }} onOpen={() => undefined} />
        <AssetLinkCard link={{ kind: 'palette', id: 'gone' }} onOpen={() => undefined} inert />
        <AssetLinkCard link={{ kind: 'note', id: 'gone' }} onOpen={() => undefined} />
      </>,
    );
    const cards = screen.getAllByRole('button', { name: /^Missing asset/ });
    expect(cards).toHaveLength(3);
    expect(cards.map((card) => card.getAttribute('data-kind'))).toEqual(['board', 'palette', 'note']);
    expect(cards[1]).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('button', { name: /Note$/ })).toBeDisabled();
  });

  it('shows notes, palettes, boards and files with their icons and details', async () => {
    await bootWithProject();
    const board = await createBoard({ name: 'Level' });
    const palette = await createPalette({
      name: 'Dusk',
      harmony: 'custom',
      baseIndex: 0,
      source: 'wheel',
      colours: [
        { name: '', hex: '#ff8800' },
        { name: '', hex: '#0088ff' },
      ],
    });
    const headed = await createNote({ title: 'Headed', body: '---\na: 1\n---\n# Only a heading\n\n' });
    const prose = await createNote({ title: 'Prose', body: '# Title\nSee [[Other|the other]] note' });
    const { ids } = await importFiles(
      [
        new File([new Uint8Array([137, 80, 78, 71])], 'hero.png', { type: 'image/png' }),
        new File([new Uint8Array([1])], 'theme.mp3', { type: 'audio/mpeg' }),
      ],
      null,
    );
    const onOpen = vi.fn();
    render(
      <>
        <AssetLinkCard link={{ kind: 'note', id: headed.id }} onOpen={onOpen} className="extra" />
        <AssetLinkCard link={{ kind: 'note', id: prose.id }} onOpen={onOpen} />
        <AssetLinkCard link={{ kind: 'palette', id: palette.id }} onOpen={onOpen} />
        <AssetLinkCard link={{ kind: 'board', id: board.id }} onOpen={onOpen} />
        <AssetLinkCard link={{ kind: 'asset', id: ids[0] ?? '' }} onOpen={onOpen} />
        <AssetLinkCard link={{ kind: 'asset', id: ids[1] ?? '' }} onOpen={onOpen} />
      </>,
    );

    const headedCard = screen.getByRole('button', { name: 'HeadedNote' });
    expect(headedCard).toHaveClass('extra');
    expect(headedCard).toHaveAttribute('title', 'Open Headed');
    expect(screen.getByRole('button', { name: 'ProseSee the other note' })).toBeEnabled();

    const dusk = screen.getByRole('button', { name: 'DuskColour palette' });
    const swatches = dusk.querySelectorAll<HTMLElement>('[aria-hidden="true"] > span');
    expect([...swatches].map((swatch) => swatch.style.background)).toEqual([
      'rgb(255, 136, 0)',
      'rgb(0, 136, 255)',
    ]);
    expect(screen.getByRole('button', { name: 'LevelBoard' }).querySelector('svg')).not.toBeNull();

    const image = screen.getByRole('button', { name: 'hero.pngFile' });
    expect(image.querySelector('img')?.getAttribute('src')).toContain(ids[0] ?? 'missing');
    const audio = screen.getByRole('button', { name: 'theme.mp3File' });
    expect(audio.querySelector('img')).toBeNull();
    expect(audio.querySelector('svg')).not.toBeNull();

    act(() => {
      audio.click();
    });
    expect(onOpen).toHaveBeenCalledWith({ kind: 'asset', id: ids[1] });
  });
});

describe('ticket selectors', () => {
  it('orders open sprints with the active one first, then by position', () => {
    const data = snapshot({
      sprints: [
        sprint('later', { position: 'c' }),
        sprint('earlier', { position: 'b' }),
        sprint('active', { status: 'active', position: 'z' }),
        sprint('done', { status: 'completed' }),
      ],
    });
    expect(openSprints(data).map((item) => item.id)).toEqual(['active', 'earlier', 'later']);
  });

  it('orders completed sprints and tickets newest first, with missing dates last', () => {
    const data = snapshot({
      sprints: [
        sprint('old', { status: 'completed', completedAt: '2026-01-01T00:00:00.000Z' }),
        sprint('unknown', { status: 'completed' }),
        sprint('new', { status: 'completed', completedAt: '2026-05-01T00:00:00.000Z' }),
        sprint('open'),
      ],
      tickets: [
        ticket('first', { resolvedAt: '2026-01-01T00:00:00.000Z' }),
        ticket('in-closed', { resolvedAt: '2026-09-01T00:00:00.000Z', sprintId: 'old' }),
        ticket('in-open', { resolvedAt: '2026-06-01T00:00:00.000Z', sprintId: 'open' }),
        ticket('unresolved'),
        ticket('second', { resolvedAt: '2026-03-01T00:00:00.000Z' }),
      ],
    });
    expect(completedSprints(data).map((item) => item.id)).toEqual(['new', 'old', 'unknown']);
    expect(completedTickets(data).map((item) => item.id)).toEqual(['in-open', 'second', 'first']);
    expect(ticketsInSprint(data, null).map((item) => item.id)).toEqual(['first', 'unresolved', 'second']);
  });

  it('falls back to the first state, or none, without a todo state', () => {
    const state = { name: 'Doing', position: 'a', category: 'doing' as const, color: '#000000' };
    expect(firstTodoState(snapshot({ states: [{ id: 'doing', ...state }] }))).toBe('doing');
    expect(firstTodoState(snapshot({}))).toBeNull();
  });
});

describe('ticket actions edge cases', () => {
  it('does nothing before tickets load', async () => {
    const api = await bootTestApp();
    expect(renderHook(() => useTicketsSnapshot()).result.current).toBeDefined();
    await expect(ticketActions.moveTo('x', 'todo', 0)).resolves.toBeNull();
    await expect(ticketActions.place('x', null, 0, [])).resolves.toBeNull();
    await expect(stateActions.move('todo', 1)).resolves.toBeNull();
    await expect(stateActions.reorder('todo', 1)).resolves.toBeNull();
    expect(api.moveTicket).not.toHaveBeenCalled();
    expect(api.moveState).not.toHaveBeenCalled();
  });

  it('places tickets among siblings and moves them out of every column', async () => {
    const api = await bootWithProject();
    await ticketActions.create({ title: 'A', stateId: 'todo' });
    await ticketActions.create({ title: 'B', stateId: 'todo' });
    await ticketActions.create({ title: 'C', stateId: 'doing' });
    await sprintActions.create({ name: 'Sprint one' });

    const before = snapshotOf(api).tickets;
    const unknown = await ticketActions.place('missing', 'sprint-1', 0, before);
    expect(unknown?.tickets).toHaveLength(3);
    expect(api.moveTicket).not.toHaveBeenCalled();

    await ticketActions.place('ticket-2', 'sprint-1', 5, before);
    expect(api.moveTicket).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'ticket-2', stateId: 'todo', sprintId: 'sprint-1' }),
    );
    const placed = snapshotOf(api).tickets.find((item) => item.id === 'ticket-2');
    expect(placed?.sprintId).toBe('sprint-1');
    expect((placed?.position ?? '') > (before.find((item) => item.id === 'ticket-3')?.position ?? '')).toBe(
      true,
    );

    await ticketActions.place('ticket-1', null, -3, before);
    const first = snapshotOf(api).tickets.find((item) => item.id === 'ticket-1');
    expect((first?.position ?? '') < (before.find((item) => item.id === 'ticket-3')?.position ?? 'z')).toBe(
      true,
    );

    await ticketActions.moveTo('ticket-3', null, 0);
    expect(api.moveTicket).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'ticket-3', stateId: null }),
    );
  });

  it('uses the template name when its title is empty and removes templates', async () => {
    const api = await bootWithProject();
    const created = await templateActions.create({ name: 'Bug report' });
    const template = created.templates[0];
    if (!template) throw new Error('missing template');
    await ticketActions.fromTemplate(template);
    expect(snapshotOf(api).tickets[0]?.title).toBe('Bug report');
    await ticketActions.fromTemplate({ ...template, title: 'Crash' }, { stateId: 'doing' });
    expect(snapshotOf(api).tickets[1]).toMatchObject({ title: 'Crash', stateId: 'doing' });

    const after = await templateActions.remove(template.id);
    expect(after.templates).toEqual([]);
  });

  it('moves a state to the end and ignores moves past either edge', async () => {
    const api = await bootWithProject();
    await stateActions.move('todo', -1);
    await stateActions.move('done', 1);
    await stateActions.move('missing', 1);
    expect(api.moveState).not.toHaveBeenCalled();

    await stateActions.move('todo', 2);
    expect(snapshotOf(api).states.map((state) => state.id)).toEqual(['doing', 'done', 'todo']);
    await stateActions.move('todo', -2);
    expect(snapshotOf(api).states.map((state) => state.id)).toEqual(['todo', 'doing', 'done']);
    await stateActions.reorder('done', -4);
    expect(snapshotOf(api).states.map((state) => state.id)).toEqual(['done', 'todo', 'doing']);
  });
});

describe('workspaces store edges', () => {
  it('refuses layout calls before the workspaces boot', async () => {
    resetWorkspacesStore();
    await expect(deleteLayout('x')).rejects.toThrow('Workspaces are not loaded');
    await expect(flushWorkspaces()).resolves.toBeUndefined();
  });

  it('throws when there are no workspaces to boot', async () => {
    resetWorkspacesStore();
    const api = createFakeApi();
    await expect(bootWorkspaces(api, () => [])).rejects.toThrow('No workspaces');
  });

  it('restores the saved active workspace and flushes on unload', async () => {
    resetWorkspacesStore();
    vi.useFakeTimers();
    const api = createFakeApi();
    const one = buildWorkspace('planning', 'One');
    const two = buildWorkspace('design', 'Two');
    api.shell = {
      workspaces: { schemaVersion: LAYOUT_SCHEMA_VERSION, items: [one, two], activeId: two.id },
      statusBar: false,
    };
    await bootWorkspaces(api, () => []);
    const active = renderHook(() => useActiveWorkspaceId());
    expect(active.result.current).toBe(two.id);

    act(() => {
      renameWorkspace(one.id, 'Renamed');
    });
    window.dispatchEvent(new Event('beforeunload'));
    await Promise.resolve();
    expect(api.setShellState).toHaveBeenCalledTimes(1);

    api.shell = {
      workspaces: { schemaVersion: LAYOUT_SCHEMA_VERSION, items: [one], activeId: 'gone' },
      statusBar: true,
    };
    await bootWorkspaces(api, () => []);
    active.rerender();
    expect(active.result.current).toBe(one.id);
  });

  it('ignores invalid workspace edits and survives a failed save', async () => {
    const api = await bootTestApp();
    vi.useFakeTimers();
    const list = renderHook(() => useWorkspaces());
    const active = renderHook(() => useActiveWorkspaceId());
    const names = () => list.result.current.map((item) => item.name);
    const start = names();

    act(() => {
      setActiveWorkspace('missing');
      duplicateWorkspace('missing');
      renameWorkspace(list.result.current[0]?.id ?? '', '   ');
      moveWorkspace('missing', 1);
      moveWorkspace(list.result.current[0]?.id ?? '', -1);
      moveWorkspace(list.result.current[0]?.id ?? '', start.length);
    });
    list.rerender();
    expect(names()).toEqual(start);

    act(() => {
      duplicateWorkspace(list.result.current[0]?.id ?? '', 'Copy');
    });
    list.rerender();
    expect(names()[1]).toBe('Copy');

    vi.mocked(api.setShellState).mockRejectedValueOnce(new Error('disk full'));
    await vi.advanceTimersByTimeAsync(600);
    await expect(flushWorkspaces()).resolves.toBeUndefined();

    act(() => {
      applyLayout({ schemaVersion: LAYOUT_SCHEMA_VERSION, id: 'empty', name: 'Empty', workspaces: [] });
    });
    list.rerender();
    active.rerender();
    expect(list.result.current).toEqual([]);
    expect(active.result.current).toBe('');
    act(() => {
      cycleWorkspace(1);
      deleteWorkspace('anything');
    });
    list.rerender();
    expect(list.result.current).toEqual([]);

    let added = '';
    act(() => {
      added = addWorkspace('empty', 'Solo').id;
    });
    act(() => {
      deleteWorkspace(added);
    });
    list.rerender();
    expect(list.result.current.map((item) => item.id)).toEqual([added]);
  });

  it('skips the delayed save once the store is reset', async () => {
    const api = await bootTestApp();
    vi.useFakeTimers();
    const id = renderHook(() => useWorkspaces()).result.current[1]?.id ?? '';
    act(() => {
      setActiveWorkspace(id);
    });
    const calls = vi.mocked(api.setShellState).mock.calls.length;
    resetWorkspacesStore();
    act(() => {
      addWorkspace('empty', 'Late');
    });
    await vi.advanceTimersByTimeAsync(600);
    expect(vi.mocked(api.setShellState).mock.calls.length).toBe(calls);
  });
});
