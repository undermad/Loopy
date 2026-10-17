import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { z } from 'zod';
import { hasErrorCode } from './fs';

export interface JsonDirectoryStoreOptions<T extends { id: string }> {
  directory: string;
  schema: z.ZodType<T>;
}

export interface JsonDirectoryStore<T extends { id: string }> {
  readonly directory: string;
  list(): Promise<T[]>;
  read(id: string): Promise<T | null>;
  save(value: T): Promise<T>;
  remove(id: string): Promise<void>;
}

const SAFE_ID = /^[A-Za-z0-9_-]{1,80}$/;

export function createJsonDirectoryStore<T extends { id: string }>(
  options: JsonDirectoryStoreOptions<T>,
): JsonDirectoryStore<T> {
  const { directory, schema } = options;

  function pathFor(id: string): string {
    if (!SAFE_ID.test(id)) throw new Error(`Invalid id: ${id}`);
    return join(directory, `${id}.json`);
  }

  async function read(id: string): Promise<T | null> {
    let raw: string;
    try {
      raw = await readFile(pathFor(id), 'utf8');
    } catch (error) {
      if (hasErrorCode(error, 'ENOENT')) return null;
      throw error;
    }
    const result = schema.safeParse(JSON.parse(raw));
    return result.success && result.data.id === id ? result.data : null;
  }

  async function list(): Promise<T[]> {
    let entries: string[];
    try {
      entries = await readdir(directory);
    } catch (error) {
      if (hasErrorCode(error, 'ENOENT')) return [];
      throw error;
    }
    const ids = entries
      .filter((name) => name.endsWith('.json'))
      .map((name) => name.slice(0, -'.json'.length));
    const values = await Promise.all(ids.filter((id) => SAFE_ID.test(id)).map((id) => read(id)));
    const found: T[] = [];
    for (const value of values) if (value !== null) found.push(value);
    return found;
  }

  async function save(value: T): Promise<T> {
    const data = schema.parse(value);
    const path = pathFor(data.id);
    await mkdir(directory, { recursive: true });
    const temporary = `${path}.tmp`;
    await writeFile(temporary, JSON.stringify(data, null, 2), 'utf8');
    await rename(temporary, path);
    return data;
  }

  async function remove(id: string): Promise<void> {
    await rm(pathFor(id), { force: true });
  }

  return { directory, list, read, save, remove };
}
