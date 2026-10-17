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
  directory = await mkdtemp(join(tmpdir(), 'loopy-sprints-'));
  project = await createProject(join(directory, 'demo.loopy'), 'Demo');
});

afterEach(async () => {
  project.close();
  await rm(directory, { recursive: true, force: true });
});

function setupTickets(db: () => ProjectDatabase) {
  const handlers = new Map<string, Handler>();
  const ipc = { handle: vi.fn((channel: string, handler: Handler) => handlers.set(channel, handler)) };
  registerTicketsHandlers(ipc, { project: db });
  return (channel: string, ...args: unknown[]) =>
    Promise.resolve().then(() => handlers.get(channel)?.({}, ...args)) as Promise<TicketsSnapshot>;
}

describe('sprints', () => {
  it('runs a sprint from planned to completed and moves unfinished work on', async () => {
    const call = setupTickets(() => project);
    let snapshot = await call(IpcChannel.sprintsCreate, { name: 'Sprint 1', goal: 'Ship the hero' });
    const first = snapshot.sprints[0];
    if (!first) throw new Error('missing sprint');
    expect(first).toMatchObject({ name: 'Sprint 1', goal: 'Ship the hero', status: 'planned' });
    snapshot = await call(IpcChannel.sprintsCreate, { name: 'Sprint 2' });
    const second = snapshot.sprints[1];
    if (!second) throw new Error('missing sprint');

    snapshot = await call(IpcChannel.ticketsCreate, { title: 'Hero art', sprintId: first.id });
    expect(snapshot.tickets[0]).toMatchObject({ sprintId: first.id, stateId: 'todo' });
    snapshot = await call(IpcChannel.ticketsCreate, {
      title: 'Hero code',
      sprintId: first.id,
      stateId: 'done',
    });
    expect(snapshot.tickets[1]?.resolvedAt).not.toBeNull();
    await expect(call(IpcChannel.ticketsCreate, { title: 'Nope', sprintId: 'missing' })).rejects.toThrow(
      /Unknown sprint/,
    );

    snapshot = await call(IpcChannel.sprintsStart, first.id);
    expect(snapshot.sprints[0]).toMatchObject({ status: 'active' });
    expect(snapshot.sprints[0]?.startedAt).not.toBeNull();
    await expect(call(IpcChannel.sprintsStart, second.id)).rejects.toThrow(/already active/);
    await expect(call(IpcChannel.sprintsStart, first.id)).rejects.toThrow(/not planned/);

    snapshot = await call(IpcChannel.sprintsUpdate, first.id, { goal: 'Ship everything' });
    expect(snapshot.sprints[0]?.goal).toBe('Ship everything');

    snapshot = await call(IpcChannel.sprintsComplete, { id: first.id, moveTo: second.id });
    expect(snapshot.sprints[0]).toMatchObject({ status: 'completed' });
    expect(snapshot.tickets.find((ticket) => ticket.title === 'Hero art')?.sprintId).toBe(second.id);
    expect(snapshot.tickets.find((ticket) => ticket.title === 'Hero code')?.sprintId).toBe(first.id);
    await expect(call(IpcChannel.sprintsComplete, { id: first.id })).rejects.toThrow(/not active/);
    const open = snapshot.tickets.find((ticket) => ticket.title === 'Hero art');
    await expect(call(IpcChannel.ticketsUpdate, open?.id, { sprintId: first.id })).rejects.toThrow(
      /completed/,
    );

    snapshot = await call(IpcChannel.sprintsDelete, second.id);
    expect(snapshot.sprints).toHaveLength(1);
    expect(snapshot.tickets.find((ticket) => ticket.title === 'Hero art')?.sprintId).toBeNull();
    await expect(call(IpcChannel.sprintsDelete, 'missing')).rejects.toThrow(/Unknown sprint/);
  });

  it('assigns a state when a backlog ticket joins a sprint and keeps it on moves', async () => {
    const call = setupTickets(() => project);
    let snapshot = await call(IpcChannel.sprintsCreate, { name: 'Sprint 1' });
    const sprint = snapshot.sprints[0];
    if (!sprint) throw new Error('missing sprint');
    snapshot = await call(IpcChannel.ticketsCreate, { title: 'Idea', estimate: 3, dueAt: '2026-11-01' });
    const ticket = snapshot.tickets[0];
    if (!ticket) throw new Error('missing ticket');
    expect(ticket).toMatchObject({ stateId: null, sprintId: null, estimate: 3, dueAt: '2026-11-01' });

    snapshot = await call(IpcChannel.ticketsUpdate, ticket.id, { sprintId: sprint.id });
    expect(snapshot.tickets[0]).toMatchObject({ sprintId: sprint.id, stateId: 'todo' });
    snapshot = await call(IpcChannel.ticketsUpdate, ticket.id, {
      sprintId: null,
      estimate: null,
      dueAt: null,
    });
    expect(snapshot.tickets[0]).toMatchObject({
      sprintId: null,
      stateId: 'todo',
      estimate: null,
      dueAt: null,
    });

    snapshot = await call(IpcChannel.ticketsMove, {
      id: ticket.id,
      stateId: null,
      sprintId: sprint.id,
      position: 'm',
    });
    expect(snapshot.tickets[0]).toMatchObject({ sprintId: sprint.id, stateId: 'todo', position: 'm' });
    snapshot = await call(IpcChannel.ticketsMove, { id: ticket.id, stateId: 'doing', position: 'n' });
    expect(snapshot.tickets[0]).toMatchObject({ sprintId: sprint.id, stateId: 'doing' });
  });
});
