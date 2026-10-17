import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { darkTheme, lightTheme } from '@shared/theme';
import { createThemesStore } from '../../../src/main/storage';

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'loopy-themes-'));
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

const custom = { ...lightTheme, id: 'sepia', name: 'Sepia' };

describe('themes store', () => {
  it('lists nothing when the directory is missing', async () => {
    await expect(createThemesStore(join(directory, 'themes')).list()).resolves.toEqual([]);
  });

  it('saves, reads, lists and removes themes as one file each', async () => {
    const store = createThemesStore(join(directory, 'themes'));

    await store.save(custom);
    await store.save({ ...darkTheme, id: 'midnight', name: 'Midnight' });

    await expect(readdir(store.directory)).resolves.toEqual(['midnight.json', 'sepia.json']);
    await expect(store.read('sepia')).resolves.toEqual(custom);
    await expect(store.list()).resolves.toHaveLength(2);

    await store.remove('sepia');
    await expect(store.read('sepia')).resolves.toBeNull();
    await expect(store.list()).resolves.toHaveLength(1);
  });

  it('ignores files that are not valid themes or whose id does not match the file name', async () => {
    const store = createThemesStore(directory);
    await writeFile(join(directory, 'broken.json'), '{ not json', 'utf8');
    await writeFile(join(directory, 'wrong.json'), JSON.stringify(custom), 'utf8');
    await writeFile(join(directory, 'notes.txt'), 'ignored', 'utf8');

    await expect(store.list()).rejects.toThrow();
    await rm(join(directory, 'broken.json'));
    await expect(store.list()).resolves.toEqual([]);
  });

  it('refuses ids that could escape the directory', async () => {
    const store = createThemesStore(directory);

    await expect(store.save({ ...custom, id: '../escape' })).rejects.toThrow(/Invalid id/);
  });
});
