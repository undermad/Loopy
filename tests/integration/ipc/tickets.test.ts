import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IpcChannel } from '@shared/ipc';
import type { TicketsSnapshot } from '@shared/tickets';
import { registerTicketsHandlers } from '../../../src/main/ipc/tickets';
import { createProject, type ProjectDatabase } from '../../../src/main/storage';

type Handler = (event: unknown, ...args: unknown[]) => unknown;

let directory: string;
let project: ProjectDatabase;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'loopy-tickets-'));
  project = await createProject(join(directory, 'demo.loopy'), 'Demo');
});

afterEach(async () => {
  project.close();
  await rm(directory, { recursive: true, force: true });
});

function setup(open = true) {
  const handlers = new Map<string, Handler>();
  const ipc = { handle: vi.fn((channel: string, handler: Handler) => handlers.set(channel, handler)) };
  registerTicketsHandlers(ipc, { project: () => (open ? project : null) });
  return <T = TicketsSnapshot>(channel: string, ...args: unknown[]) =>
    Promise.resolve().then(() => handlers.get(channel)?.({}, ...args)) as Promise<T>;
}

describe('tickets IPC handlers', () => {
  it('starts with the three default states and no tickets', async () => {
    const call = setup();
    const snapshot = await call(IpcChannel.ticketsSnapshot);
    expect(snapshot.states.map((state) => [state.id, state.category])).toEqual([
      ['todo', 'todo'],
      ['doing', 'doing'],
      ['done', 'done'],
    ]);
    expect(snapshot.tickets).toEqual([]);
  });

  it('creates, numbers, moves, resolves, updates and deletes tickets', async () => {
    const call = setup();
    let snapshot = await call(IpcChannel.ticketsCreate, { title: 'First', stateId: 'todo' });
    snapshot = await call(IpcChannel.ticketsCreate, {
      title: 'Second',
      stateId: 'todo',
      type: 'bug',
      priority: 'high',
    });
    snapshot = await call(IpcChannel.ticketsCreate, { title: 'Backlog item' });
    expect(snapshot.tickets.map((ticket) => ticket.number).sort()).toEqual([1, 2, 3]);
    const byNumber = [...snapshot.tickets].sort((a, b) => a.number - b.number);
    const [first, second, backlog] = byNumber;
    expect(first && second && backlog).toBeTruthy();
    expect(backlog?.stateId).toBeNull();
    expect(first && second && first.position < second.position).toBe(true);

    snapshot = await call(IpcChannel.ticketsMove, { id: second?.id, stateId: 'done', position: 'a' });
    const moved = snapshot.tickets.find((ticket) => ticket.id === second?.id);
    expect(moved?.stateId).toBe('done');
    expect(moved?.resolvedAt).not.toBeNull();

    snapshot = await call(IpcChannel.ticketsUpdate, second?.id, { stateId: 'doing', title: 'Renamed' });
    const updated = snapshot.tickets.find((ticket) => ticket.id === second?.id);
    expect(updated).toMatchObject({ stateId: 'doing', title: 'Renamed', resolvedAt: null });

    snapshot = await call(IpcChannel.ticketsDelete, first?.id);
    expect(snapshot.tickets).toHaveLength(2);
    await expect(call(IpcChannel.ticketsCreate, { title: '' })).rejects.toThrow();
    await expect(
      call(IpcChannel.ticketsMove, { id: 'nope', stateId: null, position: 'a' }),
    ).rejects.toThrow();
  });

  it('manages states, reorders them and moves tickets out of a deleted state', async () => {
    const call = setup();
    let snapshot = await call(IpcChannel.statesCreate, { name: 'Review' });
    const review = snapshot.states.at(-1);
    expect(review).toMatchObject({ name: 'Review', category: 'doing' });

    snapshot = await call(IpcChannel.statesMove, review?.id, '0');
    expect(snapshot.states[0]?.id).toBe(review?.id);

    snapshot = await call(IpcChannel.ticketsCreate, { title: 'In review', stateId: review?.id });
    snapshot = await call(IpcChannel.statesUpdate, review?.id, { category: 'done', color: '#123456' });
    expect(snapshot.tickets[0]?.resolvedAt).not.toBeNull();
    expect(snapshot.states.find((state) => state.id === review?.id)).toMatchObject({
      category: 'done',
      color: '#123456',
    });

    snapshot = await call(IpcChannel.statesDelete, review?.id, 'todo');
    expect(snapshot.states).toHaveLength(3);
    expect(snapshot.tickets[0]).toMatchObject({ stateId: 'todo', resolvedAt: null });
  });

  it('manages labels and ticket labels', async () => {
    const call = setup();
    let snapshot = await call(IpcChannel.labelsCreate, { name: 'Art', color: '#ff0000' });
    snapshot = await call(IpcChannel.labelsCreate, { name: 'Code', color: '#00ff00' });
    snapshot = await call(IpcChannel.ticketsCreate, { title: 'Labelled' });
    const ticket = snapshot.tickets[0];
    const ids = snapshot.labels.map((label) => label.id);
    snapshot = await call(IpcChannel.ticketsSetLabels, ticket?.id, ids);
    expect(snapshot.ticketLabels).toHaveLength(2);

    snapshot = await call(IpcChannel.labelsUpdate, ids[0], { name: 'Artwork' });
    expect(snapshot.labels.map((label) => label.name)).toEqual(['Artwork', 'Code']);

    snapshot = await call(IpcChannel.labelsDelete, ids[0]);
    expect(snapshot.ticketLabels).toHaveLength(1);
    await expect(call(IpcChannel.labelsCreate, { name: 'Code', color: '#00ff00' })).rejects.toThrow();
  });

  it('refuses every channel when no project is open', async () => {
    const call = setup(false);
    await expect(call(IpcChannel.ticketsSnapshot)).rejects.toThrow(/No project/);
  });
});
