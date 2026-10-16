import { describe, expect, it } from 'vitest';
import { migrate, UnsupportedVersionError, type MigrationMap } from '../../../src/main/storage/migrations';

const migrations: MigrationMap = {
  1: (data) => ({ ...data, title: data['name'] }),
  2: (data) => ({ ...data, tags: [] }),
};

describe('migrate', () => {
  it('returns the data untouched when already at the target version', () => {
    const data = { schemaVersion: 3, name: 'Demo' };
    expect(migrate(data, migrations, 3)).toBe(data);
  });

  it('applies every migration in order and stamps the new version', () => {
    const result = migrate({ schemaVersion: 1, name: 'Demo' }, migrations, 3);
    expect(result).toEqual({ schemaVersion: 3, name: 'Demo', title: 'Demo', tags: [] });
  });

  it('rejects a version newer than the target', () => {
    expect(() => migrate({ schemaVersion: 4 }, migrations, 3)).toThrow(UnsupportedVersionError);
  });

  it('rejects a version with no migration path', () => {
    expect(() => migrate({ schemaVersion: 1 }, {}, 2)).toThrow(UnsupportedVersionError);
  });

  it('rejects a missing or malformed schema version', () => {
    expect(() => migrate({}, migrations, 3)).toThrow(UnsupportedVersionError);
    expect(() => migrate({ schemaVersion: '1' }, migrations, 3)).toThrow(UnsupportedVersionError);
    expect(() => migrate({ schemaVersion: 0 }, migrations, 3)).toThrow(UnsupportedVersionError);
  });
});
