import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { projectNameSchema, type ProjectInfo, type RecoverableProject } from '@shared/project';
import { hasErrorCode } from './fs';
import {
  createProject,
  importProject,
  openProject,
  readProjectInfo,
  renameProject,
  saveProjectFile,
  type ProjectDatabase,
} from './project-database';

const manifestSchema = z.object({
  savedPath: z.string().min(1).nullable(),
  name: projectNameSchema,
  dirty: z.boolean(),
});

type Manifest = z.infer<typeof manifestSchema>;

export interface ProjectSession {
  readonly id: string;
  readonly project: ProjectDatabase;
  readonly savedPath: string | null;
  readonly dirty: boolean;
  readonly needsSave: boolean;
  info(): ProjectInfo;
  markDirty(): Promise<void>;
  rename(name: string): Promise<ProjectInfo>;
  saveTo(path: string): Promise<void>;
  close(): void;
  discard(): void;
}

const databaseFile = (directory: string, id: string) => join(directory, `${id}.loopy`);
const manifestFile = (directory: string, id: string) => join(directory, `${id}.json`);

async function writeManifest(directory: string, id: string, manifest: Manifest): Promise<void> {
  const path = manifestFile(directory, id);
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(manifest), 'utf8');
  await rename(temporary, path);
}

function removeSessionFiles(directory: string, id: string): void {
  const database = databaseFile(directory, id);
  for (const file of [database, `${database}-wal`, `${database}-shm`, manifestFile(directory, id)]) {
    rmSync(file, { force: true });
  }
}

function session(directory: string, id: string, project: ProjectDatabase, initial: Manifest): ProjectSession {
  let { savedPath, dirty } = initial;
  let revision = 0;
  let open = true;
  const persist = () =>
    writeManifest(directory, id, { savedPath, dirty, name: readProjectInfo(project).name });

  const close = () => {
    if (!open) return;
    open = false;
    project.close();
  };

  return {
    id,
    project,
    get savedPath() {
      return savedPath;
    },
    get dirty() {
      return dirty;
    },
    get needsSave() {
      return dirty || savedPath === null;
    },
    info: () => readProjectInfo(project),
    async markDirty() {
      revision += 1;
      if (dirty) return;
      dirty = true;
      await persist();
    },
    async rename(name) {
      const info = renameProject(project, name);
      revision += 1;
      dirty = true;
      await persist();
      return info;
    },
    async saveTo(path) {
      const saving = revision;
      await saveProjectFile(project, path);
      savedPath = path;
      if (revision === saving) dirty = false;
      await persist();
    },
    close,
    discard() {
      close();
      removeSessionFiles(directory, id);
    },
  };
}

async function start(directory: string, id: string, project: ProjectDatabase, manifest: Manifest) {
  try {
    await writeManifest(directory, id, manifest);
  } catch (error) {
    project.close();
    removeSessionFiles(directory, id);
    throw error;
  }
  return session(directory, id, project, manifest);
}

export async function createSession(directory: string, name: string): Promise<ProjectSession> {
  const id = randomUUID();
  await mkdir(directory, { recursive: true });
  const project = await createProject(databaseFile(directory, id), name);
  return start(directory, id, project, {
    savedPath: null,
    dirty: false,
    name: readProjectInfo(project).name,
  });
}

export async function openSession(directory: string, source: string): Promise<ProjectSession> {
  const id = randomUUID();
  await mkdir(directory, { recursive: true });
  const project = await importProject(source, databaseFile(directory, id));
  return start(directory, id, project, {
    savedPath: source,
    dirty: false,
    name: readProjectInfo(project).name,
  });
}

async function readManifest(directory: string, id: string): Promise<Manifest | null> {
  try {
    const parsed = manifestSchema.safeParse(JSON.parse(await readFile(manifestFile(directory, id), 'utf8')));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function restoreSession(directory: string, rawId: string): Promise<ProjectSession> {
  const id = z.uuid().parse(rawId);
  const manifest = await readManifest(directory, id);
  if (!manifest) throw new Error(`No recoverable session ${id}`);
  const project = await openProject(databaseFile(directory, id));
  return session(directory, id, project, manifest);
}

async function modifiedAt(path: string): Promise<string> {
  const times = await Promise.all(
    [path, `${path}-wal`].map((file) =>
      stat(file).then(
        (info) => info.mtimeMs,
        () => 0,
      ),
    ),
  );
  return new Date(Math.max(...times)).toISOString();
}

export async function collectOrphans(directory: string): Promise<RecoverableProject[]> {
  let entries: string[];
  try {
    entries = await readdir(directory);
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT')) return [];
    throw error;
  }
  const recoverable: RecoverableProject[] = [];
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;
    const id = entry.slice(0, -'.json'.length);
    if (!z.uuid().safeParse(id).success || !entries.includes(`${id}.loopy`)) continue;
    const manifest = await readManifest(directory, id);
    if (!manifest || !(manifest.dirty || manifest.savedPath === null)) continue;
    recoverable.push({
      id,
      name: manifest.name,
      path: manifest.savedPath,
      modifiedAt: await modifiedAt(databaseFile(directory, id)),
    });
  }
  const keep = new Set(recoverable.map((item) => item.id));
  await Promise.all(
    entries
      .filter((entry) => !keep.has(entry.split('.')[0] ?? ''))
      .map((entry) => rm(join(directory, entry), { force: true })),
  );
  return recoverable;
}

export function discardOrphan(directory: string, rawId: string): void {
  removeSessionFiles(directory, z.uuid().parse(rawId));
}
