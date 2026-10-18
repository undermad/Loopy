import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { storagePaths } from '../../../src/main/storage';

describe('storagePaths', () => {
  it('places settings, state, projects, working copies, themes and layouts under the user data directory', () => {
    const userData = join('C:', 'Users', 'demo', 'AppData', 'Roaming', 'loopy');
    const paths = storagePaths(userData);

    expect(paths.settings).toBe(join(userData, 'settings.json'));
    expect(paths.deviceState).toBe(join(userData, 'state.json'));
    expect(paths.projects).toBe(join(userData, 'projects'));
    expect(paths.themes).toBe(join(userData, 'themes'));
    expect(paths.layouts).toBe(join(userData, 'layouts'));
    expect(paths.working).toBe(join(userData, 'working'));
  });
});
