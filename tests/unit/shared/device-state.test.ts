import { describe, expect, it } from 'vitest';
import { DEVICE_STATE_SCHEMA_VERSION, deviceStateSchema } from '@shared/device-state';

const id = '0b5d1a8e-2c4f-4e7a-9b3c-1d2e3f4a5b6c';

describe('device state schema', () => {
  it('starts empty apart from the version', () => {
    expect(deviceStateSchema.parse({ schemaVersion: DEVICE_STATE_SCHEMA_VERSION })).toEqual({
      schemaVersion: DEVICE_STATE_SCHEMA_VERSION,
      recentProjects: [],
      statusBar: true,
    });
  });

  it('accepts window bounds, the last project and recent projects', () => {
    const state = {
      schemaVersion: DEVICE_STATE_SCHEMA_VERSION,
      windowBounds: { x: -8, y: 0, width: 1280, height: 800 },
      lastProjectId: id,
      recentProjects: [{ id, name: 'Demo', openedAt: '2026-10-17T09:00:00.000Z' }],
      statusBar: false,
    };
    expect(deviceStateSchema.parse(state)).toEqual(state);
  });

  it('rejects a zero-sized window, a malformed id and more than ten recent projects', () => {
    const valid = { schemaVersion: DEVICE_STATE_SCHEMA_VERSION };
    expect(
      deviceStateSchema.safeParse({ ...valid, windowBounds: { x: 0, y: 0, width: 0, height: 1 } }).success,
    ).toBe(false);
    expect(deviceStateSchema.safeParse({ ...valid, lastProjectId: 'demo' }).success).toBe(false);
    const recent = { id, name: 'Demo', openedAt: '2026-10-17T09:00:00.000Z' };
    expect(
      deviceStateSchema.safeParse({ ...valid, recentProjects: Array<typeof recent>(11).fill(recent) })
        .success,
    ).toBe(false);
  });
});
