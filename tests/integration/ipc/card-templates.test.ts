import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CardTemplate } from '@shared/cards';
import { IpcChannel } from '@shared/ipc';
import { registerCardTemplatesHandlers } from '../../../src/main/ipc/card-templates';
import { createProject, type ProjectDatabase } from '../../../src/main/storage';

type Handler = (event: unknown, ...args: unknown[]) => unknown;

let directory: string;
let project: ProjectDatabase;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'loopy-cards-'));
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

describe('card templates IPC handlers', () => {
  it('keeps card styling through a save and a reload', async () => {
    const call = setup();
    const styling = {
      background: {
        image: 'img1',
        fit: 'contain',
        overlay: 0.3,
        gradient: { colour: { hex: '#000000', ref: null }, angle: 90 },
      },
      accentPlacement: 'left',
      accentField: 'rarity',
      font: 'serif',
      autoHeight: true,
    };
    const created = await call<CardTemplate>(IpcChannel.cardTemplatesCreate, { name: 'Item', ...styling });
    expect(created).toMatchObject(styling);
    const updated = await call<CardTemplate>(IpcChannel.cardTemplatesUpdate, created.id, { font: 'mono' });
    expect(updated).toMatchObject({ ...styling, font: 'mono' });
    const [listed] = await call<CardTemplate[]>(IpcChannel.cardTemplatesList);
    expect(listed).toMatchObject({ ...styling, font: 'mono' });
  });

  it('creates, lists, updates and deletes templates with their fields', async () => {
    const call = setup();
    await expect(call(IpcChannel.cardTemplatesList)).resolves.toEqual([]);

    const template = await call<CardTemplate>(IpcChannel.cardTemplatesCreate, {
      name: 'Character',
      fields: [
        { id: 'name', kind: 'heading', label: 'Name', span: 9 },
        { id: 'rarity', kind: 'select', label: 'Rarity', span: 3, options: ['Common', 'Rare'] },
        { id: 'hp', kind: 'stat', label: 'HP', min: 0, max: 100, defaultValue: 50 },
      ],
    });
    expect(template).toMatchObject({ name: 'Character', width: 320, height: 360, gap: 8, accent: null });
    expect(template.fields.map((field) => [field.id, field.span])).toEqual([
      ['name', 9],
      ['rarity', 3],
      ['hp', 12],
    ]);
    expect(template.fields[2]).toMatchObject({ showLabel: true, defaultValue: 50, min: 0, max: 100 });

    const renamed = await call<CardTemplate>(IpcChannel.cardTemplatesUpdate, template.id, { name: 'Hero' });
    expect(renamed.name).toBe('Hero');
    expect(renamed.fields).toHaveLength(3);

    const resized = await call<CardTemplate>(IpcChannel.cardTemplatesUpdate, template.id, {
      width: 400,
      accent: { hex: '#ff0000', ref: null },
      fields: [{ id: 'name', kind: 'heading' }],
    });
    expect(resized).toMatchObject({ name: 'Hero', width: 400, accent: { hex: '#ff0000' } });
    expect(resized.fields.map((field) => field.id)).toEqual(['name']);

    await expect(call(IpcChannel.cardTemplatesUpdate, template.id, { width: 10 })).rejects.toThrow();
    await expect(
      call(IpcChannel.cardTemplatesUpdate, template.id, { fields: [{ id: 'x', kind: 'video' }] }),
    ).rejects.toThrow();
    await expect(
      call(IpcChannel.cardTemplatesUpdate, template.id, {
        fields: [
          { id: 'x', kind: 'text' },
          { id: 'x', kind: 'number' },
        ],
      }),
    ).rejects.toThrow(/Duplicate field id/);
    await expect(
      call(IpcChannel.cardTemplatesCreate, { name: 'Bad', fields: [{ id: 'a', kind: 'text', span: 5 }] }),
    ).rejects.toThrow();
    await expect(call(IpcChannel.cardTemplatesUpdate, 'missing', { name: 'x' })).rejects.toThrow(
      /Unknown card template/,
    );

    await expect(call<CardTemplate[]>(IpcChannel.cardTemplatesList)).resolves.toHaveLength(1);
    await expect(call(IpcChannel.cardTemplatesDelete, template.id)).resolves.toEqual([]);
  });

  it('refuses every channel when no project is open', async () => {
    const call = setup(false);
    await expect(call(IpcChannel.cardTemplatesList)).rejects.toThrow(/No project/);
  });
});
