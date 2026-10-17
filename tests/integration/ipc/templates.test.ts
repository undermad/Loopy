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
  directory = await mkdtemp(join(tmpdir(), 'loopy-templates-'));
  project = await createProject(join(directory, 'demo.loopy'), 'Demo');
});

afterEach(async () => {
  project.close();
  await rm(directory, { recursive: true, force: true });
});

function setup() {
  const handlers = new Map<string, Handler>();
  const ipc = { handle: vi.fn((channel: string, handler: Handler) => handlers.set(channel, handler)) };
  registerTicketsHandlers(ipc, { project: () => project });
  return (channel: string, ...args: unknown[]) =>
    Promise.resolve().then(() => handlers.get(channel)?.({}, ...args)) as Promise<TicketsSnapshot>;
}

describe('comments', () => {
  it('adds, edits and deletes comments with the ticket', async () => {
    const call = setup();
    let snapshot = await call(IpcChannel.ticketsCreate, { title: 'Discuss' });
    const ticket = snapshot.tickets[0];
    if (!ticket) throw new Error('missing ticket');
    snapshot = await call(IpcChannel.commentsCreate, { ticketId: ticket.id, body: '<p>First</p>' });
    const comment = snapshot.comments[0];
    if (!comment) throw new Error('missing comment');
    expect(comment).toMatchObject({ ticketId: ticket.id, body: '<p>First</p>' });
    snapshot = await call(IpcChannel.commentsUpdate, comment.id, '<p>Edited</p>');
    expect(snapshot.comments[0]?.body).toBe('<p>Edited</p>');
    await expect(call(IpcChannel.commentsUpdate, 'missing', '<p>x</p>')).rejects.toThrow(/Unknown comment/);
    await expect(call(IpcChannel.commentsUpdate, comment.id, '')).rejects.toThrow();
    snapshot = await call(IpcChannel.commentsDelete, comment.id);
    expect(snapshot.comments).toHaveLength(0);
    snapshot = await call(IpcChannel.commentsCreate, { ticketId: ticket.id, body: '<p>Again</p>' });
    snapshot = await call(IpcChannel.ticketsDelete, ticket.id);
    expect(snapshot.comments).toHaveLength(0);
  });
});

describe('templates', () => {
  it('stores templates with labels and creates tickets from them', async () => {
    const call = setup();
    let snapshot = await call(IpcChannel.labelsCreate, { name: 'Art', color: '#9333ea' });
    const label = snapshot.labels[0];
    if (!label) throw new Error('missing label');
    snapshot = await call(IpcChannel.templatesCreate, {
      name: 'Bug report',
      title: 'Bug: ',
      description: '<h2>Steps</h2>',
      type: 'bug',
      priority: 'high',
      estimate: 2,
      labelIds: [label.id],
    });
    const template = snapshot.templates[0];
    if (!template) throw new Error('missing template');
    expect(template).toMatchObject({ name: 'Bug report', type: 'bug', labelIds: [label.id] });
    snapshot = await call(IpcChannel.templatesUpdate, template.id, { priority: 'urgent', labelIds: [] });
    expect(snapshot.templates[0]).toMatchObject({ priority: 'urgent', labelIds: [] });
    await expect(call(IpcChannel.templatesUpdate, 'missing', { name: 'x' })).rejects.toThrow(
      /Unknown template/,
    );

    snapshot = await call(IpcChannel.ticketsCreate, {
      title: 'Bug: crash',
      description: template.description,
      type: template.type,
      priority: 'urgent',
      labelIds: [label.id, label.id],
    });
    expect(snapshot.tickets[0]).toMatchObject({
      type: 'bug',
      priority: 'urgent',
      description: '<h2>Steps</h2>',
    });
    expect(snapshot.ticketLabels).toEqual([{ ticketId: snapshot.tickets[0]?.id, labelId: label.id }]);

    snapshot = await call(IpcChannel.templatesDelete, template.id);
    expect(snapshot.templates).toHaveLength(0);
  });
});
