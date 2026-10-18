import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CURRENT_PROJECT_SCHEMA_VERSION,
  LOOPY_APPLICATION_ID,
  createProject,
  exportProject,
  importProject,
  isProjectFile,
  openProject,
  readProjectInfo,
  type ProjectDatabase,
  type ProjectFileError,
} from '../../../src/main/storage';
import { projectMigrations } from '../../../src/main/storage/project-migrations';
import {
  migrateDatabase,
  readApplicationId,
  readUserVersion,
} from '../../../src/main/storage/sql-migrations';

let directory: string;
const open: ProjectDatabase[] = [];

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'loopy-db-'));
});

afterEach(async () => {
  for (const project of open.splice(0)) project.close();
  await rm(directory, { recursive: true, force: true });
});

async function track(promise: Promise<ProjectDatabase>): Promise<ProjectDatabase> {
  const project = await promise;
  open.push(project);
  return project;
}

async function expectErrorCode(promise: Promise<unknown>, code: ProjectFileError['code']): Promise<void> {
  await expect(promise).rejects.toMatchObject({ name: 'ProjectFileError', code });
}

function writeForeignDatabase(path: string, applicationId = 0, userVersion = 0): void {
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA application_id = ${applicationId}`);
  db.exec(`PRAGMA user_version = ${userVersion}`);
  db.exec('CREATE TABLE other (id INTEGER PRIMARY KEY)');
  db.close();
}

describe('project database', () => {
  it('creates a project with its metadata, application id and schema version', async () => {
    const path = join(directory, 'nested', 'demo.loopy');
    const now = new Date('2026-10-17T09:00:00.000Z');

    const project = await track(createProject(path, '  Demo  ', now));

    expect(readProjectInfo(project)).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/) as string,
      name: 'Demo',
      createdAt: '2026-10-17T09:00:00.000Z',
      updatedAt: '2026-10-17T09:00:00.000Z',
    });
    expect(readApplicationId(project.db)).toBe(LOOPY_APPLICATION_ID);
    expect(readUserVersion(project.db)).toBe(CURRENT_PROJECT_SCHEMA_VERSION);
  });

  it('reopens a project after closing it and leaves one file behind', async () => {
    const path = join(directory, 'demo.loopy');
    const created = await createProject(path, 'Demo');
    const info = readProjectInfo(created);
    created.close();

    await expect(readdir(directory)).resolves.toEqual(['demo.loopy']);
    const reopened = await track(openProject(path));
    expect(readProjectInfo(reopened)).toEqual(info);
  });

  it('refuses to create over an existing file and to create with a blank name', async () => {
    const path = join(directory, 'demo.loopy');
    await writeFile(path, 'taken', 'utf8');

    await expectErrorCode(createProject(path, 'Demo'), 'ALREADY_EXISTS');
    await expect(createProject(join(directory, 'blank.loopy'), '   ')).rejects.toThrow();
    await expect(readdir(directory)).resolves.toEqual(['demo.loopy']);
  });

  it('reports a missing file', async () => {
    await expectErrorCode(openProject(join(directory, 'missing.loopy')), 'NOT_FOUND');
    await expect(isProjectFile(join(directory, 'missing.loopy'))).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('rejects a file that is not SQLite or not a Loopy database', async () => {
    const text = join(directory, 'text.loopy');
    await writeFile(text, '{"schemaVersion":1}', 'utf8');
    await expectErrorCode(openProject(text), 'NOT_A_PROJECT');
    await expect(isProjectFile(text)).resolves.toBe(false);

    const empty = join(directory, 'empty.loopy');
    await writeFile(empty, '', 'utf8');
    await expectErrorCode(openProject(empty), 'NOT_A_PROJECT');

    const foreign = join(directory, 'foreign.loopy');
    writeForeignDatabase(foreign);
    await expectErrorCode(openProject(foreign), 'NOT_A_PROJECT');
    await expect(isProjectFile(foreign)).resolves.toBe(false);
  });

  it('recognises a Loopy database by its application id', async () => {
    const path = join(directory, 'demo.loopy');
    const project = await createProject(path, 'Demo');
    project.close();

    await expect(isProjectFile(path)).resolves.toBe(true);
  });

  it('rejects a schema version newer than the app knows', async () => {
    const future = join(directory, 'future.loopy');
    writeForeignDatabase(future, LOOPY_APPLICATION_ID, CURRENT_PROJECT_SCHEMA_VERSION + 1);

    await expectErrorCode(openProject(future), 'UNSUPPORTED_VERSION');
  });

  it('reports a Loopy database whose project row is missing', async () => {
    const path = join(directory, 'hollow.loopy');
    const project = await createProject(path, 'Demo');
    project.db.exec('DELETE FROM project');
    project.close();

    await expectErrorCode(openProject(path), 'CORRUPT');
  });

  it('exports a compacted copy and imports it as a new project', async () => {
    const original = await track(createProject(join(directory, 'demo.loopy'), 'Demo'));
    original.db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('colour', '"#ff0000"');
    const exported = join(directory, 'shared', 'demo-export.loopy');

    await exportProject(original, exported);
    await exportProject(original, exported);

    await expect(readdir(join(directory, 'shared'))).resolves.toEqual(['demo-export.loopy']);
    const imported = await track(importProject(exported, join(directory, 'imported.loopy')));
    expect(readProjectInfo(imported)).toEqual(readProjectInfo(original));
    expect(imported.db.prepare('SELECT value FROM settings WHERE key = ?').get('colour')).toEqual({
      value: '"#ff0000"',
    });
  });

  it('refuses to import over an existing project or from a foreign file', async () => {
    const source = join(directory, 'demo.loopy');
    const project = await createProject(source, 'Demo');
    project.close();
    const destination = join(directory, 'taken.loopy');
    await writeFile(destination, 'taken', 'utf8');
    await expectErrorCode(importProject(source, destination), 'ALREADY_EXISTS');

    const foreign = join(directory, 'foreign.loopy');
    writeForeignDatabase(foreign);
    await expectErrorCode(importProject(foreign, join(directory, 'copy.loopy')), 'NOT_A_PROJECT');
    await expect(readdir(directory)).resolves.toEqual(['demo.loopy', 'foreign.loopy', 'taken.loopy']);
  });

  it('adds drawing tiles that cascade with their layer when upgrading from version 12', () => {
    const db = new DatabaseSync(join(directory, 'sketch.loopy'));
    db.exec('PRAGMA foreign_keys = ON');
    migrateDatabase(db, projectMigrations.slice(0, 12));
    const stamp = '2026-01-01T00:00:00.000Z';
    db.prepare(
      `INSERT INTO boards (id, name, background_color, grid_color, unit, unit_scale, created_at, updated_at)
       VALUES ('b', 'Sketch', '#ffffff', '#808080', 'm', 100, ?, ?)`,
    ).run(stamp, stamp);
    db.prepare(
      `INSERT INTO board_nodes (id, board_id, type, x, y, width, height, z, data, created_at, updated_at)
       VALUES ('ink', 'b', 'drawing', 0, 0, 10, 10, 1, '{}', ?, ?)`,
    ).run(stamp, stamp);
    migrateDatabase(db, projectMigrations);
    expect(readUserVersion(db)).toBe(projectMigrations.length);
    db.prepare(
      "INSERT INTO board_tiles (node_id, tx, ty, bytes, updated_at) VALUES ('ink', 0, -1, ?, ?)",
    ).run(new Uint8Array([1, 2]), stamp);
    const count = () =>
      (db.prepare('SELECT COUNT(*) AS count FROM board_tiles').get() as { count: number }).count;
    expect(count()).toBe(1);
    db.prepare("DELETE FROM board_nodes WHERE id = 'ink'").run();
    expect(count()).toBe(0);
    db.close();
  });
});
