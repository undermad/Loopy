import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createProjectFile } from '@shared/project-file';
import { loadProject, saveProject, type ProjectFileError } from '../../../src/main/storage';

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'loopy-store-'));
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

async function expectErrorCode(path: string, code: ProjectFileError['code']): Promise<void> {
  await expect(loadProject(path)).rejects.toMatchObject({ name: 'ProjectFileError', code, path });
}

describe('project store', () => {
  it('saves and loads a project without changing it', async () => {
    const path = join(directory, 'nested', 'demo.loopy.json');
    const project = createProjectFile('Demo');

    await saveProject(path, project);

    await expect(loadProject(path)).resolves.toEqual(project);
    await expect(readdir(join(directory, 'nested'))).resolves.toEqual(['demo.loopy.json']);
  });

  it('reports a missing file', async () => {
    await expectErrorCode(join(directory, 'missing.json'), 'NOT_FOUND');
  });

  it('reports a file that is not JSON or not an object', async () => {
    const broken = join(directory, 'broken.json');
    await writeFile(broken, '{ not json', 'utf8');
    await expectErrorCode(broken, 'CORRUPT');

    const list = join(directory, 'list.json');
    await writeFile(list, '[]', 'utf8');
    await expectErrorCode(list, 'CORRUPT');
  });

  it('reports a schema version it cannot migrate', async () => {
    const future = join(directory, 'future.json');
    await writeFile(future, JSON.stringify({ schemaVersion: 99, name: 'Demo' }), 'utf8');
    await expectErrorCode(future, 'UNSUPPORTED_VERSION');
  });

  it('reports a file at the current version with invalid content', async () => {
    const invalid = join(directory, 'invalid.json');
    await writeFile(invalid, JSON.stringify({ schemaVersion: 1, name: '' }), 'utf8');
    await expectErrorCode(invalid, 'INVALID');
  });

  it('rejects a legacy file whose migration path is missing', async () => {
    const legacy = join(directory, 'legacy.json');
    await writeFile(legacy, JSON.stringify({ schemaVersion: 1, title: 'Old' }), 'utf8');

    await expect(loadProject(legacy, {})).rejects.toMatchObject({ code: 'INVALID' });
  });
});
