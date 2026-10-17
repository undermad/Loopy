import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { z } from 'zod';
import { hasErrorCode } from './fs';
import { migrate, UnsupportedVersionError, type MigrationMap } from './migrations';

export type JsonStoreErrorCode = 'CORRUPT' | 'UNSUPPORTED_VERSION' | 'INVALID';

export class JsonStoreError extends Error {
  constructor(
    public readonly code: JsonStoreErrorCode,
    public readonly path: string,
    cause?: unknown,
  ) {
    super(`${code}: ${path}`, { cause });
    this.name = 'JsonStoreError';
  }
}

export interface JsonStoreOptions<T> {
  path: string;
  schema: z.ZodType<T>;
  version: number;
  migrations: MigrationMap;
}

export interface JsonStore<T> {
  readonly path: string;
  defaults(): T;
  load(): Promise<T>;
  save(value: T): Promise<void>;
}

export function createJsonStore<T>(options: JsonStoreOptions<T>): JsonStore<T> {
  const { path, schema, version, migrations } = options;
  const defaults = (): T => schema.parse({ schemaVersion: version });

  async function load(): Promise<T> {
    let raw: string;
    try {
      raw = await readFile(path, 'utf8');
    } catch (error) {
      if (hasErrorCode(error, 'ENOENT')) return defaults();
      throw error;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new JsonStoreError('CORRUPT', path, error);
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new JsonStoreError('CORRUPT', path);
    }

    let migrated: Record<string, unknown>;
    try {
      migrated = migrate(parsed as Record<string, unknown>, migrations, version);
    } catch (error) {
      if (error instanceof UnsupportedVersionError)
        throw new JsonStoreError('UNSUPPORTED_VERSION', path, error);
      throw error;
    }

    const result = schema.safeParse(migrated);
    if (!result.success) throw new JsonStoreError('INVALID', path, result.error);
    return result.data;
  }

  async function save(value: T): Promise<void> {
    const data = schema.parse(value);
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.tmp`;
    await writeFile(temporary, JSON.stringify(data, null, 2), 'utf8');
    await rename(temporary, path);
  }

  return { path, defaults, load, save };
}
