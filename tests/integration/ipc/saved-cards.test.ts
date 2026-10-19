import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CardTemplate, SavedCard } from '@shared/cards';
import { IpcChannel } from '@shared/ipc';
import { registerCardTemplatesHandlers } from '../../../src/main/ipc/card-templates';
import { createProject, type ProjectDatabase } from '../../../src/main/storage';
import { createFolder, deleteFolder } from '../../../src/main/storage/assets-repository';
import { createNote, listNotes } from '../../../src/main/storage/notes-repository';

type Handler = (event: unknown, ...args: unknown[]) => unknown;

let directory: string;
let project: ProjectDatabase;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'loopy-saved-cards-'));
  project = await createProject(join(directory, 'demo.loopy'), 'Demo');
});

afterEach(async () => {
  project.close();
  await rm(directory, { recursive: true, force: true });
});

function setup(open = true) {
  const handlers = new Map<string, Handler>();
  const ipc = { handle: vi.fn((channel: string, handler: Handler) => handlers.set(channel, handler)) };
  registerCardTemplatesHandlers(ipc, { project: () => (open ? project : null) });
  return <T>(channel: string, ...args: unknown[]) =>
    Promise.resolve().then(() => handlers.get(channel)?.({}, ...args)) as Promise<T>;
}

function folder(scope: 'cards' | 'boards', name: string, parentId: string | null = null): string {
  const snapshot = createFolder(project.db, { name, scope, parentId });
  const created = snapshot.folders.find((item) => item.name === name && item.scope === scope);
  if (!created) throw new Error('folder not created');
  return created.id;
}

async function template(call: ReturnType<typeof setup>): Promise<CardTemplate> {
  return call<CardTemplate>(IpcChannel.cardTemplatesCreate, {
    name: 'Character',
    width: 280,
    fields: [
      { id: 'name', kind: 'heading' },
      { id: 'home', kind: 'link', linkKinds: ['board'] },
    ],
  });
}

describe('saved cards IPC handlers', () => {
  it('creates a card on a template that keeps no layout of its own', async () => {
    const call = setup();
    const hero = await template(call);
    await expect(call(IpcChannel.cardsList)).resolves.toEqual([]);

    const card = await call<SavedCard>(IpcChannel.cardsCreate, {
      name: 'Knight',
      templateId: hero.id,
      values: { name: 'Sir Loop', home: { kind: 'board', id: 'b1' } },
    });

    expect(card).toMatchObject({
      name: 'Knight',
      folderId: null,
      templateId: hero.id,
      layout: null,
      values: { name: 'Sir Loop', home: { kind: 'board', id: 'b1' } },
    });
    await expect(call(IpcChannel.cardsList)).resolves.toEqual([card]);
  });

  it('gives a card without a template a default layout', async () => {
    const call = setup();
    const card = await call<SavedCard>(IpcChannel.cardsCreate, { name: 'Loose' });
    expect(card.templateId).toBeNull();
    expect(card.layout).toMatchObject({ width: 320, height: 360, fields: [] });
  });

  it('refuses unknown templates, wrong folders and duplicate field ids', async () => {
    const call = setup();
    const boards = folder('boards', 'Levels');
    await expect(call(IpcChannel.cardsCreate, { name: 'X', templateId: 'nope' })).rejects.toThrow(
      /Unknown card template/,
    );
    await expect(call(IpcChannel.cardsCreate, { name: 'X', folderId: boards })).rejects.toThrow(
      /does not hold/,
    );
    await expect(
      call(IpcChannel.cardsCreate, {
        name: 'X',
        layout: {
          fields: [
            { id: 'a', kind: 'text' },
            { id: 'a', kind: 'text' },
          ],
        },
      }),
    ).rejects.toThrow(/Duplicate field id/);
    await expect(call(IpcChannel.cardsUpdate, 'missing', { name: 'Y' })).rejects.toThrow(/Unknown card/);
  });

  it('renames, files, detaches and reattaches a card', async () => {
    const call = setup();
    const hero = await template(call);
    const heroes = folder('cards', 'Heroes');
    const card = await call<SavedCard>(IpcChannel.cardsCreate, { name: 'Knight', templateId: hero.id });

    const moved = await call<SavedCard>(IpcChannel.cardsUpdate, card.id, {
      name: 'Paladin',
      folderId: heroes,
    });
    expect(moved).toMatchObject({ name: 'Paladin', folderId: heroes });

    const detached = await call<SavedCard>(IpcChannel.cardsUpdate, card.id, { templateId: null });
    expect(detached.templateId).toBeNull();
    expect(detached.layout).toMatchObject({ width: 280 });
    expect(detached.layout?.fields.map((field) => field.id)).toEqual(['name', 'home']);

    const reattached = await call<SavedCard>(IpcChannel.cardsUpdate, card.id, { templateId: hero.id });
    expect(reattached).toMatchObject({ templateId: hero.id, layout: null });

    const ownLayout = await call<SavedCard>(IpcChannel.cardsUpdate, card.id, {
      templateId: null,
      layout: { width: 500 },
    });
    expect(ownLayout.layout).toMatchObject({ width: 500, fields: [] });
  });

  it('turns cards into standalone cards when their template is deleted', async () => {
    const call = setup();
    const hero = await template(call);
    const card = await call<SavedCard>(IpcChannel.cardsCreate, { name: 'Knight', templateId: hero.id });
    await call(IpcChannel.cardTemplatesUpdate, hero.id, { font: 'serif', accentPlacement: 'left' });

    await call(IpcChannel.cardTemplatesDelete, hero.id);

    const [after] = await call<SavedCard[]>(IpcChannel.cardsList);
    expect(after).toMatchObject({
      id: card.id,
      templateId: null,
      layout: { width: 280, font: 'serif', accentPlacement: 'left' },
    });
  });

  it('deletes cards and moves them up when their folder goes', async () => {
    const call = setup();
    const top = folder('cards', 'All');
    const child = folder('cards', 'Heroes', top);
    const card = await call<SavedCard>(IpcChannel.cardsCreate, { name: 'Knight', folderId: child });

    deleteFolder(project.db, child);
    const [moved] = await call<SavedCard[]>(IpcChannel.cardsList);
    expect(moved?.folderId).toBe(top);

    await expect(call(IpcChannel.cardsDelete, card.id)).resolves.toEqual([]);
  });

  it('rewrites card links in notes when a card is renamed and keeps them when it is deleted', async () => {
    const call = setup();
    const card = await call<SavedCard>(IpcChannel.cardsCreate, { name: 'Knight' });
    createNote(project.db, { title: 'Cast', body: 'Lead: [[card:Knight]], see ![[card:knight|the hero]]' });

    await call(IpcChannel.cardsUpdate, card.id, { values: { title: 'x' } });
    expect(listNotes(project.db)[0]?.body).toBe('Lead: [[card:Knight]], see ![[card:knight|the hero]]');

    await call(IpcChannel.cardsUpdate, card.id, { name: 'Paladin' });
    expect(listNotes(project.db)[0]?.body).toBe('Lead: [[card:Paladin]], see ![[card:Paladin|the hero]]');

    await call(IpcChannel.cardsDelete, card.id);
    expect(listNotes(project.db)[0]?.body).toContain('[[card:Paladin]]');
  });

  it('needs an open project', async () => {
    const call = setup(false);
    await expect(call(IpcChannel.cardsList)).rejects.toThrow();
  });
});
