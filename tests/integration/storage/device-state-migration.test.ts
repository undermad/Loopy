import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEVICE_STATE_SCHEMA_VERSION } from '@shared/device-state';
import { createDeviceStateStore } from '../../../src/main/storage';

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'loopy-state-'));
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe('device state migration from version 1', () => {
  it('points each recent project at its file in the old projects folder and drops the last project id', async () => {
    const id = '0b5d1a8e-2c4f-4e7a-9b3c-1d2e3f4a5b6c';
    const path = join(directory, 'state.json');
    await writeFile(
      path,
      JSON.stringify({
        schemaVersion: 1,
        lastProjectId: id,
        recentProjects: [{ id, name: 'Demo', openedAt: '2026-10-17T09:00:00.000Z' }],
        statusBar: false,
      }),
      'utf8',
    );

    await expect(createDeviceStateStore(path).load()).resolves.toEqual({
      schemaVersion: DEVICE_STATE_SCHEMA_VERSION,
      recentProjects: [
        {
          id,
          name: 'Demo',
          path: join(directory, 'projects', `${id}.loopy`),
          openedAt: '2026-10-17T09:00:00.000Z',
        },
      ],
      statusBar: false,
    });
  });

  it('keeps a version 1 file without recent projects valid', async () => {
    const path = join(directory, 'state.json');
    await writeFile(path, JSON.stringify({ schemaVersion: 1 }), 'utf8');

    await expect(createDeviceStateStore(path).load()).resolves.toMatchObject({
      schemaVersion: DEVICE_STATE_SCHEMA_VERSION,
      recentProjects: [],
    });
  });
});
