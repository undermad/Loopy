import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { brushStateSchema } from '@shared/brushes';
import { createAppSettingsStore } from '../../../src/main/storage';

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'loopy-settings-'));
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe('app settings migration from version 1', () => {
  it('turns the theme enum into a theme preference and keeps the other keys', async () => {
    const path = join(directory, 'settings.json');
    await writeFile(
      path,
      JSON.stringify({ schemaVersion: 1, theme: 'dark', uiFont: 'Georgia', fontSize: 16 }),
      'utf8',
    );

    await expect(createAppSettingsStore(path).load()).resolves.toEqual({
      schemaVersion: 4,
      theme: { mode: 'dark', light: 'light', dark: 'dark' },
      language: 'system',
      uiFont: 'Georgia',
      fontSize: 16,
      defaultLayoutId: 'default',
      editors: {
        board: { grid: true, snap: false, minimap: false, wheel: 'zoom', quickButtons: true },
        assets: { layout: 'grid', details: true },
      },
      brushes: brushStateSchema.parse({}),
    });
  });

  it('adds editor defaults when upgrading from version 2', async () => {
    const path = join(directory, 'settings.json');
    await writeFile(path, JSON.stringify({ schemaVersion: 2, fontSize: 18 }), 'utf8');

    const settings = await createAppSettingsStore(path).load();
    expect(settings).toMatchObject({ schemaVersion: 4, fontSize: 18 });
    expect(settings.editors.board.wheel).toBe('zoom');
    expect(settings.editors.assets.layout).toBe('grid');
  });

  it('adds brush defaults when upgrading from version 3 and keeps the rest', async () => {
    const path = join(directory, 'settings.json');
    await writeFile(path, JSON.stringify({ schemaVersion: 3, uiFont: 'Georgia' }), 'utf8');

    const settings = await createAppSettingsStore(path).load();
    expect(settings).toMatchObject({ schemaVersion: 4, uiFont: 'Georgia' });
    expect(settings.brushes.brush.preset).toBe('pen');
    expect(settings.brushes.eraser.preset).toBe('hard-eraser');
    expect(settings.brushes.colour).toEqual({ hex: '#1f2937', ref: null });
  });

  it('maps an unknown old theme value to system mode', async () => {
    const path = join(directory, 'settings.json');
    await writeFile(path, JSON.stringify({ schemaVersion: 1, theme: 'sepia' }), 'utf8');

    const settings = await createAppSettingsStore(path).load();
    expect(settings.theme.mode).toBe('system');
  });
});
