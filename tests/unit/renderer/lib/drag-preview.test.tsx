import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { previewFor } from '@renderer/components/editors/Tickets/BoardView';
import { columnTargetIndex, isStateDrag } from '@renderer/components/editors/Tickets/dnd';
import { stateActions, useTicketsSnapshot } from '@renderer/lib/tickets';
import { bootTestApp, makeProject } from '../helpers/api';
import { emptyTicketsSnapshot } from '../helpers/tickets-fake';

const snapshot = emptyTicketsSnapshot();
const ticket = (id: string, position: string) => ({
  id,
  number: 1,
  title: id,
  description: '',
  type: 'task' as const,
  priority: 'low' as const,
  stateId: 'todo',
  position,
  createdAt: '2026-10-17T09:00:00.000Z',
  updatedAt: '2026-10-17T09:00:00.000Z',
  resolvedAt: null,
});
snapshot.tickets = [ticket('a', 'a'), ticket('b', 'b')];

const location = (data: Record<string | symbol, unknown> | null) => ({
  current: { dropTargets: data ? [{ data }] : [] },
});
const edge = Symbol.for('closestEdge');

describe('previewFor', () => {
  it('resolves ticket drops onto cards, columns and nothing', () => {
    const source = { data: { type: 'ticket', id: 'a', stateId: 'todo' } };
    expect(previewFor(snapshot, source, location(null))).toBeNull();
    expect(previewFor(snapshot, source, location({ type: 'column', stateId: 'done' }))).toEqual({
      kind: 'ticket',
      stateId: 'done',
      index: 0,
    });
    expect(
      previewFor(snapshot, source, location({ type: 'card', id: 'b', stateId: 'todo', [edge]: 'bottom' })),
    ).toEqual({
      kind: 'ticket',
      stateId: 'todo',
      index: 1,
    });
    expect(previewFor(snapshot, source, location({ type: 'other' }))).toBeNull();
  });

  it('resolves column drops by edge and ignores unknown sources', () => {
    const source = { data: { type: 'state', id: 'todo' } };
    expect(isStateDrag(source.data)).toBe(true);
    expect(
      previewFor(snapshot, source, location({ type: 'column', stateId: 'done', [edge]: 'right' })),
    ).toEqual({ kind: 'state', index: 2 });
    expect(
      previewFor(snapshot, source, location({ type: 'column', stateId: 'doing', [edge]: 'left' })),
    ).toEqual({ kind: 'state', index: 0 });
    expect(previewFor(snapshot, source, location({ type: 'card', id: 'a' }))).toBeNull();
    expect(
      previewFor(snapshot, { data: { type: 'mystery' } }, location({ type: 'column', stateId: 'done' })),
    ).toBeNull();
    expect(columnTargetIndex(snapshot, 'todo', 'missing', null)).toBe(2);
  });
});

describe('stateActions.reorder', () => {
  it('moves a state to an index and clamps out-of-range targets', async () => {
    const api = await bootTestApp();
    const project = makeProject('Space Game');
    api.projects = [project];
    api.current = project;
    api.emitProject();
    await act(async () => {
      await Promise.resolve();
    });
    const { result } = renderHook(() => useTicketsSnapshot());

    await act(async () => {
      await stateActions.reorder('done', 0);
    });
    expect(result.current.states.map((state) => state.id)).toEqual(['done', 'todo', 'doing']);

    await act(async () => {
      await stateActions.reorder('done', 99);
    });
    expect(result.current.states.map((state) => state.id)).toEqual(['todo', 'doing', 'done']);
    expect(api.moveState).toHaveBeenCalledTimes(2);
  });
});
