import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { storagePaths } from '../../../src/main/storage';

describe('storagePaths', () => {
  it('places settings, state, projects, themes and layouts under the user data directory', () => {
    const userData = join('C:', 'Users', 'demo', 'AppData', 'Roaming', 'loopy');
    const paths = storagePaths(userData);

    expect(paths.settings).toBe(join(userData, 'settings.json'));
    expect(paths.deviceState).toBe(join(userData, 'state.json'));
    expect(paths.projects).toBe(join(userData, 'projects'));
    expect(paths.themes).toBe(join(userData, 'themes'));
    expect(paths.layouts).toBe(join(userData, 'layouts'));
    expect(paths.projectFile('0b5d1a8e-2c4f-4e7a-9b3c-1d2e3f4a5b6c')).toBe(
      join(userData, 'projects', '0b5d1a8e-2c4f-4e7a-9b3c-1d2e3f4a5b6c.loopy'),
    );
  });
});
