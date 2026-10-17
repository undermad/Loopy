import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { dataOf } from '@renderer/components/editors/Tickets/BoardView';
import {
  columnId,
  dropTicket,
  findColumn,
  moveAcross,
  moveWithin,
  ordersFrom,
  overTicket,
  resolveDrop,
} from '@renderer/components/editors/Tickets/dnd';
import { stateActions, useTicketsSnapshot } from '@renderer/lib/tickets';
import { bootTestApp, makeProject } from '../helpers/api';
import { emptyTicketsSnapshot } from '../helpers/tickets-fake';

const snapshot = emptyTicketsSnapshot();
const ticket = (id: string, stateId: string | null, position: string) => ({
  id,
  number: 1,
  title: id,
  description: '',
  type: 'task' as const,
  priority: 'low' as const,
  stateId,
  position,
  createdAt: '2026-10-17T09:00:00.000Z',
  updatedAt: '2026-10-17T09:00:00.000Z',
  resolvedAt: null,
});
snapshot.tickets = [ticket('a', 'todo', 'a'), ticket('b', 'todo', 'b'), ticket('c', null, 'c')];

describe('board drag orders', () => {
  it('builds column orders from the snapshot and resolves drops', () => {
    const orders = ordersFrom(snapshot, () => true);
    expect(orders).toEqual({ backlog: ['c'], todo: ['a', 'b'], doing: [], done: [] });
    expect(ordersFrom(snapshot, (id) => id !== 'a')['todo']).toEqual(['b']);
    expect(findColumn(orders, 'c')).toBe('backlog');
    expect(findColumn(orders, 'missing')).toBeNull();
    expect(columnId(null)).toBe('column:backlog');
    expect(resolveDrop(orders, 'b')).toEqual({ stateId: 'todo', index: 1 });
    expect(resolveDrop(orders, 'c')).toEqual({ stateId: null, index: 0 });
    expect(resolveDrop(orders, 'missing')).toBeNull();
  });

  it('moves within a column and across columns, keeping unknown ids put', () => {
    const orders = ordersFrom(snapshot, () => true);
    expect(moveWithin(orders, 'a', 'b')['todo']).toEqual(['b', 'a']);
    expect(moveWithin(orders, 'a', 'a')).toBe(orders);
    expect(moveWithin(orders, 'missing', 'a')).toBe(orders);
    expect(moveWithin(orders, 'a', 'missing')).toBe(orders);
    const across = moveAcross(orders, 'a', 'doing', null);
    expect(across['todo']).toEqual(['b']);
    expect(across['doing']).toEqual(['a']);
    expect(moveAcross(orders, 'c', 'todo', 'b')['todo']).toEqual(['a', 'c', 'b']);
    expect(moveAcross(orders, 'c', 'todo', 'missing')['todo']).toEqual(['a', 'b', 'c']);
    expect(moveAcross(orders, 'a', 'todo', null)).toBe(orders);
    expect(moveAcross(orders, 'missing', 'todo', null)).toBe(orders);
  });

  it('previews cross-column moves while dragging and settles same-column sorts on drop', () => {
    const orders = ordersFrom(snapshot, () => true);
    const overB = { type: 'ticket' as const, id: 'b', stateId: 'todo' };
    expect(overTicket(orders, 'a', null)).toBe(orders);
    expect(overTicket(orders, 'a', { type: 'state', id: 'todo' })).toBe(orders);
    expect(overTicket(orders, 'a', overB)).toBe(orders);
    expect(overTicket(orders, 'a', { type: 'ticket', id: 'missing', stateId: 'todo' })).toBe(orders);
    expect(overTicket(orders, 'a', { type: 'column', stateId: 'doing' })['doing']).toEqual(['a']);
    expect(overTicket(orders, 'c', overB)['todo']).toEqual(['a', 'c', 'b']);

    expect(dropTicket(orders, 'a', overB, 'todo')).toEqual({ stateId: 'todo', index: 1 });
    const crossed = overTicket(orders, 'c', overB);
    expect(dropTicket(crossed, 'c', overB, 'backlog')).toEqual({ stateId: 'todo', index: 1 });
    expect(dropTicket(orders, 'a', { type: 'column', stateId: 'todo' }, 'todo')).toEqual({
      stateId: 'todo',
      index: 0,
    });
    expect(dropTicket(orders, 'a', null, 'todo')).toEqual({ stateId: 'todo', index: 0 });
    expect(dropTicket(orders, 'missing', null, 'todo')).toBeNull();
  });

  it('reads drag data only from items that carry a type', () => {
    expect(dataOf(null)).toBeNull();
    expect(dataOf({ data: {} })).toBeNull();
    expect(dataOf({ data: { current: 'text' } })).toBeNull();
    expect(dataOf({ data: { current: { type: 'state', id: 'todo' } } })).toEqual({
      type: 'state',
      id: 'todo',
    });
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
