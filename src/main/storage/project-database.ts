import { randomUUID } from 'node:crypto';
import { constants, copyFile, mkdir, open, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { projectInfoSchema, projectNameSchema, type ProjectInfo } from '@shared/project';
import { exists, hasErrorCode } from './fs';
import { UnsupportedVersionError } from './migrations';
import { projectMigrations } from './project-migrations';
import { migrateDatabase, readApplicationId } from './sql-migrations';

export const LOOPY_APPLICATION_ID = 0x4c4f4f50;

const SQLITE_HEADER = Buffer.from('SQLite format 3\0', 'latin1');

export type ProjectFileErrorCode =
  'NOT_FOUND' | 'ALREADY_EXISTS' | 'NOT_A_PROJECT' | 'UNSUPPORTED_VERSION' | 'CORRUPT';

export class ProjectFileError extends Error {
  constructor(
    public readonly code: ProjectFileErrorCode,
    public readonly path: string,
    cause?: unknown,
  ) {
    super(`${code}: ${path}`, { cause });
    this.name = 'ProjectFileError';
  }
}

export interface ProjectDatabase {
  readonly path: string;
  readonly db: DatabaseSync;
  close(): void;
}

async function assertSqliteHeader(path: string): Promise<void> {
  let handle;
  try {
    handle = await open(path, 'r');
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT')) throw new ProjectFileError('NOT_FOUND', path, error);
    throw error;
  }
  try {
    const header = Buffer.alloc(SQLITE_HEADER.length);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    if (bytesRead !== header.length || !header.equals(SQLITE_HEADER)) {
      throw new ProjectFileError('NOT_A_PROJECT', path);
    }
  } finally {
    await handle.close();
  }
}

async function removeDatabaseFiles(path: string): Promise<void> {
  await Promise.all([path, `${path}-wal`, `${path}-shm`].map((file) => rm(file, { force: true })));
}

function openDatabase(path: string): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA synchronous = NORMAL');
  db.exec('PRAGMA foreign_keys = ON');
  return db;
}

function wrap(path: string, db: DatabaseSync): ProjectDatabase {
  return {
    path,
    db,
    close: () => {
      db.close();
    },
  };
}

export async function isProjectFile(path: string): Promise<boolean> {
  try {
    await assertSqliteHeader(path);
  } catch (error) {
    if (error instanceof ProjectFileError && error.code === 'NOT_A_PROJECT') return false;
    throw error;
  }
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    return readApplicationId(db) === LOOPY_APPLICATION_ID;
  } finally {
    db.close();
  }
}

export function readProjectInfo(project: ProjectDatabase): ProjectInfo {
  const row = project.db
    .prepare(
      'SELECT id, name, created_at AS createdAt, updated_at AS updatedAt FROM project WHERE singleton = 1',
    )
    .get();
  const result = projectInfoSchema.safeParse(row);
  if (!result.success) throw new ProjectFileError('CORRUPT', project.path, result.error);
  return result.data;
}

export async function createProject(
  path: string,
  name: string,
  now: Date = new Date(),
): Promise<ProjectDatabase> {
  const projectName = projectNameSchema.parse(name);
  if (await exists(path)) throw new ProjectFileError('ALREADY_EXISTS', path);
  await mkdir(dirname(path), { recursive: true });

  const db = openDatabase(path);
  try {
    db.exec(`PRAGMA application_id = ${LOOPY_APPLICATION_ID}`);
    migrateDatabase(db, projectMigrations);
    const timestamp = now.toISOString();
    db.prepare(
      'INSERT INTO project (singleton, id, name, created_at, updated_at) VALUES (1, ?, ?, ?, ?)',
    ).run(randomUUID(), projectName, timestamp, timestamp);
  } catch (error) {
    db.close();
    await removeDatabaseFiles(path);
    throw error;
  }
  return wrap(path, db);
}

export async function openProject(path: string): Promise<ProjectDatabase> {
  await assertSqliteHeader(path);
  const db = openDatabase(path);
  try {
    if (readApplicationId(db) !== LOOPY_APPLICATION_ID) throw new ProjectFileError('NOT_A_PROJECT', path);
    try {
      migrateDatabase(db, projectMigrations);
    } catch (error) {
      if (error instanceof UnsupportedVersionError)
        throw new ProjectFileError('UNSUPPORTED_VERSION', path, error);
      throw error;
    }
    const project = wrap(path, db);
    readProjectInfo(project);
    return project;
  } catch (error) {
    db.close();
    throw error;
  }
}

export async function exportProject(project: ProjectDatabase, destination: string): Promise<void> {
  await mkdir(dirname(destination), { recursive: true });
  await removeDatabaseFiles(destination);
  project.db.exec(`VACUUM INTO '${destination.replaceAll("'", "''")}'`);
}

export async function importProject(source: string, destination: string): Promise<ProjectDatabase> {
  await assertSqliteHeader(source);
  if (await exists(destination)) throw new ProjectFileError('ALREADY_EXISTS', destination);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination, constants.COPYFILE_EXCL);
  try {
    return await openProject(destination);
  } catch (error) {
    await removeDatabaseFiles(destination);
    throw error;
  }
}
