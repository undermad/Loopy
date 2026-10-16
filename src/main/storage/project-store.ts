import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { CURRENT_SCHEMA_VERSION, projectFileSchema, type ProjectFile } from '@shared/project-file';
import { migrate, UnsupportedVersionError, type MigrationMap } from './migrations';
import { projectFileMigrations } from './project-file-migrations';

export type ProjectFileErrorCode = 'NOT_FOUND' | 'CORRUPT' | 'UNSUPPORTED_VERSION' | 'INVALID';

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

export async function saveProject(path: string, project: ProjectFile): Promise<void> {
  const data = projectFileSchema.parse(project);
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, JSON.stringify(data, null, 2), 'utf8');
  await rename(temporary, path);
}

export async function loadProject(
  path: string,
  migrations: MigrationMap = projectFileMigrations,
): Promise<ProjectFile> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch (error) {
    throw new ProjectFileError('NOT_FOUND', path, error);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new ProjectFileError('CORRUPT', path, error);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new ProjectFileError('CORRUPT', path);
  }

  let migrated: Record<string, unknown>;
  try {
    migrated = migrate(parsed as Record<string, unknown>, migrations, CURRENT_SCHEMA_VERSION);
  } catch (error) {
    if (error instanceof UnsupportedVersionError)
      throw new ProjectFileError('UNSUPPORTED_VERSION', path, error);
    throw error;
  }

  const result = projectFileSchema.safeParse(migrated);
  if (!result.success) throw new ProjectFileError('INVALID', path, result.error);
  return result.data;
}
