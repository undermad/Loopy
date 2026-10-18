import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { APP_SETTINGS_SCHEMA_VERSION } from '@shared/app-settings';
import { DEVICE_STATE_SCHEMA_VERSION, type DeviceState } from '@shared/device-state';
import {
  createAppSettingsStore,
  createDeviceStateStore,
  type JsonStoreError,
} from '../../../src/main/storage';
import { createJsonStore } from '../../../src/main/storage/json-store';

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'loopy-json-'));
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

async function expectErrorCode(load: Promise<unknown>, code: JsonStoreError['code']): Promise<void> {
  await expect(load).rejects.toMatchObject({ name: 'JsonStoreError', code });
}

describe('app settings store', () => {
  it('returns defaults when the file does not exist', async () => {
    const store = createAppSettingsStore(join(directory, 'settings.json'));

    await expect(store.load()).resolves.toEqual(store.defaults());
    await expect(readdir(directory)).resolves.toEqual([]);
  });

  it('saves and loads settings without changing them', async () => {
    const store = createAppSettingsStore(join(directory, 'nested', 'settings.json'));
    const settings = {
      ...store.defaults(),
      theme: { mode: 'dark' as const, light: 'light', dark: 'dark' },
      fontSize: 16,
    };

    await store.save(settings);

    await expect(store.load()).resolves.toEqual(settings);
    await expect(readdir(join(directory, 'nested'))).resolves.toEqual(['settings.json']);
  });

  it('fills defaults for keys missing from an older file', async () => {
    const path = join(directory, 'settings.json');
    await writeFile(
      path,
      JSON.stringify({ schemaVersion: APP_SETTINGS_SCHEMA_VERSION, theme: { mode: 'light' } }),
      'utf8',
    );

    await expect(createAppSettingsStore(path).load()).resolves.toEqual({
      schemaVersion: APP_SETTINGS_SCHEMA_VERSION,
      theme: { mode: 'light', light: 'light', dark: 'dark' },
      language: 'system',
      uiFont: 'Inter',
      fontSize: 14,
      defaultLayoutId: 'default',
      editors: {
        board: { grid: true, snap: false, minimap: false, wheel: 'zoom', quickButtons: true },
        assets: { layout: 'grid', details: true },
      },
    });
  });

  it('reports a file that is not JSON or not an object', async () => {
    const broken = join(directory, 'broken.json');
    await writeFile(broken, '{ not json', 'utf8');
    await expectErrorCode(createAppSettingsStore(broken).load(), 'CORRUPT');

    const list = join(directory, 'list.json');
    await writeFile(list, '[]', 'utf8');
    await expectErrorCode(createAppSettingsStore(list).load(), 'CORRUPT');
  });

  it('reports a schema version it cannot migrate', async () => {
    const future = join(directory, 'future.json');
    await writeFile(future, JSON.stringify({ schemaVersion: 99 }), 'utf8');
    await expectErrorCode(createAppSettingsStore(future).load(), 'UNSUPPORTED_VERSION');
  });

  it('reports a file at the current version with invalid content', async () => {
    const invalid = join(directory, 'invalid.json');
    await writeFile(
      invalid,
      JSON.stringify({ schemaVersion: APP_SETTINGS_SCHEMA_VERSION, theme: 'sepia' }),
      'utf8',
    );
    await expectErrorCode(createAppSettingsStore(invalid).load(), 'INVALID');
  });
});

describe('device state store', () => {
  it('round-trips window bounds and recent projects', async () => {
    const store = createDeviceStateStore(join(directory, 'state.json'));
    const id = '0b5d1a8e-2c4f-4e7a-9b3c-1d2e3f4a5b6c';
    const state: DeviceState = {
      schemaVersion: DEVICE_STATE_SCHEMA_VERSION,
      windowBounds: { x: 10, y: 20, width: 1280, height: 800 },
      lastProjectId: id,
      recentProjects: [{ id, name: 'Demo', openedAt: '2026-10-17T09:00:00.000Z' }],
      statusBar: true,
    };

    await store.save(state);

    await expect(store.load()).resolves.toEqual(state);
    expect(JSON.parse(await readFile(store.path, 'utf8'))).toEqual(state);
  });
});

describe('createJsonStore migrations', () => {
  const schema = z.object({
    schemaVersion: z.literal(2),
    title: z.string(),
    tags: z.array(z.string()).default([]),
  });

  it('migrates an older file before validating it', async () => {
    const path = join(directory, 'legacy.json');
    await writeFile(path, JSON.stringify({ schemaVersion: 1, name: 'Old' }), 'utf8');
    const store = createJsonStore({
      path,
      schema,
      version: 2,
      migrations: { 1: ({ name, ...rest }) => ({ ...rest, title: name }) },
    });

    await expect(store.load()).resolves.toEqual({ schemaVersion: 2, title: 'Old', tags: [] });
  });

  it('rejects an older file whose migration path is missing', async () => {
    const path = join(directory, 'legacy.json');
    await writeFile(path, JSON.stringify({ schemaVersion: 1, name: 'Old' }), 'utf8');
    const store = createJsonStore({ path, schema, version: 2, migrations: {} });

    await expectErrorCode(store.load(), 'UNSUPPORTED_VERSION');
  });
});
