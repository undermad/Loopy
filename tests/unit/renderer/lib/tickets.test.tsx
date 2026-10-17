import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  firstTodoState,
  labelActions,
  labelsOf,
  matchesSearch,
  selectTicket,
  stateActions,
  ticketActions,
  ticketsInState,
  useSelectedTicket,
  useTicketsSnapshot,
} from '@renderer/lib/tickets';
import { bootTestApp, makeProject, type FakeApi } from '../helpers/api';

function must<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Missing value');
  return value;
}

async function bootWithProject(): Promise<FakeApi> {
  const api = await bootTestApp();
  const project = makeProject('Space Game');
  api.projects = [project];
  api.current = project;
  api.emitProject();
  await act(async () => {
    await Promise.resolve();
  });
  return api;
}

describe('tickets library actions', () => {
  it('creates, moves within and across columns, and updates tickets', async () => {
    const api = await bootWithProject();
    const { result } = renderHook(() => ({ snapshot: useTicketsSnapshot(), selected: useSelectedTicket() }));

    await act(async () => {
      await ticketActions.create({ title: 'A', stateId: 'todo' });
      await ticketActions.create({ title: 'B', stateId: 'todo' });
      await ticketActions.create({ title: 'C', stateId: 'todo' });
    });
    const inTodo = () => ticketsInState(result.current.snapshot, 'todo').map((ticket) => ticket.id);
    expect(inTodo()).toEqual(['ticket-1', 'ticket-2', 'ticket-3']);

    await act(async () => {
      await ticketActions.moveTo('ticket-3', 'todo', 0);
    });
    expect(inTodo()).toEqual(['ticket-3', 'ticket-1', 'ticket-2']);

    await act(async () => {
      await ticketActions.moveTo('ticket-1', 'doing', 0);
      await ticketActions.moveTo('ticket-2', 'doing', 1);
    });
    expect(ticketsInState(result.current.snapshot, 'doing').map((ticket) => ticket.id)).toEqual([
      'ticket-1',
      'ticket-2',
    ]);
    expect(api.moveTicket).toHaveBeenCalledTimes(3);

    act(() => {
      selectTicket('ticket-1');
    });
    expect(result.current.selected?.title).toBe('A');
    await act(async () => {
      await ticketActions.update('ticket-1', { title: 'A2', priority: 'urgent' });
    });
    expect(result.current.selected).toMatchObject({ title: 'A2', priority: 'urgent' });

    await act(async () => {
      await ticketActions.remove('ticket-1');
    });
    expect(result.current.selected).toBeNull();
    const remaining = must(result.current.snapshot.tickets[0]);
    expect(matchesSearch(remaining, 'SPA-2', 'spa-2')).toBe(true);
    expect(matchesSearch(remaining, 'SPA-2', 'zzz')).toBe(false);
  });

  it('manages states and labels', async () => {
    const api = await bootWithProject();
    const { result } = renderHook(() => useTicketsSnapshot());

    await act(async () => {
      await stateActions.create({ name: 'Review' });
      await stateActions.move('state-4', -3);
      await stateActions.update('state-4', { color: '#123456' });
    });
    expect(result.current.states[0]).toMatchObject({ name: 'Review', color: '#123456' });
    expect(firstTodoState(result.current)).toBe('todo');

    await act(async () => {
      await stateActions.move('nope', 1);
      await stateActions.move('state-4', -1);
      await stateActions.remove('state-4', null);
    });
    expect(result.current.states.map((state) => state.id)).toEqual(['todo', 'doing', 'done']);

    await act(async () => {
      await ticketActions.create({ title: 'Labelled' });
      await labelActions.create({ name: 'Art', color: '#ff0000' });
      await labelActions.update('label-1', { name: 'Artwork' });
      await ticketActions.setLabels('ticket-1', ['label-1']);
    });
    expect(labelsOf(result.current, 'ticket-1').map((label) => label.name)).toEqual(['Artwork']);

    await act(async () => {
      await labelActions.remove('label-1');
    });
    expect(result.current.labels).toEqual([]);
    expect(api.deleteLabel).toHaveBeenCalledWith('label-1');
  });
});
