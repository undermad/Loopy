import { randomUUID } from 'node:crypto';
import { readdir, rename, stat } from 'node:fs/promises';
import { basename, dirname, extname, resolve } from 'node:path';
import type { IpcMain } from 'electron';
import {
  IpcChannel,
  projectIdSchema,
  projectNameSchema,
  type ExportResult,
  type ImportProjectResult,
  type OpenProjectResult,
  type ProjectFailureCode,
  type ProjectState,
  type ProjectSummary,
} from '@shared/ipc';
import { PROJECT_FILE_EXTENSION, type ProjectInfo } from '@shared/project';
import type { DeviceStateService } from '../services/device-state';
import type { StoragePaths } from '../storage/paths';
import {
  createProject,
  exportProject,
  importProject,
  openProject,
  ProjectFileError,
  readProjectInfo,
  removeDatabaseFiles,
  type ProjectDatabase,
} from '../storage/project-database';
import type { Broadcast } from './settings';
import type { FileDialogs } from './themes';

export interface ProjectHandlerDeps {
  paths: StoragePaths;
  deviceState: DeviceStateService;
  dialogs: FileDialogs;
  broadcast: Broadcast;
  revealInFolder: (path: string) => void;
  confirmReplace: (name: string) => Promise<boolean>;
}

export interface ProjectService {
  current(): ProjectDatabase | null;
  state(): ProjectState;
  close(): Promise<void>;
  openFile(path: string): Promise<ImportProjectResult | OpenProjectResult>;
}

type ImportOutcome = ImportProjectResult | { status: 'kept'; id: string };

const projectFilters = [{ name: 'Loopy project', extensions: [PROJECT_FILE_EXTENSION] }];
const MAX_RECENT = 10;

function failureCode(error: unknown): ProjectFailureCode {
  if (error instanceof ProjectFileError && error.code !== 'ALREADY_EXISTS') return error.code;
  return 'CORRUPT';
}

async function modifiedAt(path: string): Promise<number> {
  const times = await Promise.all(
    [path, `${path}-wal`].map((file) =>
      stat(file).then(
        (info) => info.mtimeMs,
        () => 0,
      ),
    ),
  );
  return Math.max(...times);
}

export function registerProjectHandlers(
  ipc: Pick<IpcMain, 'handle'>,
  deps: ProjectHandlerDeps,
): ProjectService {
  let current: ProjectDatabase | null = null;
  let currentInfo: ProjectInfo | null = null;

  const state = (): ProjectState => ({ current: currentInfo, recent: deps.deviceState.get().recentProjects });
  const notify = () => {
    deps.broadcast(IpcChannel.projectChanged, state());
  };

  async function touchRecent(info: ProjectInfo): Promise<void> {
    const entry = { id: info.id, name: info.name, openedAt: new Date().toISOString() };
    const recent = deps.deviceState.get().recentProjects.filter((item) => item.id !== info.id);
    await deps.deviceState.update({
      recentProjects: [entry, ...recent].slice(0, MAX_RECENT),
      lastProjectId: info.id,
    });
  }

  function close(): Promise<void> {
    if (current) {
      current.close();
      current = null;
      currentInfo = null;
      notify();
    }
    return Promise.resolve();
  }

  async function adopt(database: ProjectDatabase): Promise<ProjectInfo> {
    await close();
    current = database;
    currentInfo = readProjectInfo(database);
    await touchRecent(currentInfo);
    notify();
    return currentInfo;
  }

  async function list(): Promise<ProjectSummary[]> {
    let entries: string[];
    try {
      entries = await readdir(deps.paths.projects);
    } catch {
      return [];
    }
    const lastOpened = new Map(deps.deviceState.get().recentProjects.map((item) => [item.id, item.openedAt]));
    const summaries: ProjectSummary[] = [];
    for (const entry of entries) {
      if (extname(entry) !== `.${PROJECT_FILE_EXTENSION}`) continue;
      const path = deps.paths.projectFile(basename(entry, `.${PROJECT_FILE_EXTENSION}`));
      let info: ProjectInfo | null;
      if (currentInfo && current?.path === path) {
        info = currentInfo;
      } else {
        try {
          const database = await openProject(path);
          try {
            info = readProjectInfo(database);
          } finally {
            database.close();
          }
        } catch {
          info = null;
        }
      }
      if (!info) continue;
      const openedAt = lastOpened.get(info.id);
      summaries.push(openedAt ? { ...info, lastOpenedAt: openedAt } : info);
    }
    return summaries.sort((a, b) =>
      (b.lastOpenedAt ?? b.updatedAt).localeCompare(a.lastOpenedAt ?? a.updatedAt),
    );
  }

  async function create(rawName: unknown): Promise<ProjectInfo> {
    const name = projectNameSchema.parse(rawName);
    const id = randomUUID();
    const database = await createProject(deps.paths.projectFile(id), name, new Date(), id);
    return adopt(database);
  }

  async function open(rawId: unknown): Promise<OpenProjectResult> {
    const id = projectIdSchema.parse(rawId);
    if (currentInfo?.id === id) return { status: 'opened', project: currentInfo };
    try {
      const database = await openProject(deps.paths.projectFile(id));
      return { status: 'opened', project: await adopt(database) };
    } catch (error) {
      return { status: 'failed', code: failureCode(error) };
    }
  }

  async function localName(id: string): Promise<string | null> {
    if (currentInfo?.id === id) return currentInfo.name;
    try {
      const database = await openProject(deps.paths.projectFile(id));
      try {
        return readProjectInfo(database).name;
      } finally {
        database.close();
      }
    } catch {
      return null;
    }
  }

  async function keepLocal(id: string, source: string): Promise<boolean> {
    const target = deps.paths.projectFile(id);
    const [localTime, sourceTime] = await Promise.all([modifiedAt(target), modifiedAt(source)]);
    if (localTime <= sourceTime) return false;
    const name = await localName(id);
    return name !== null && !(await deps.confirmReplace(name));
  }

  async function importFrom(source: string): Promise<ImportOutcome> {
    const temporary = deps.paths.projectFile(randomUUID());
    try {
      const copy = await importProject(source, temporary);
      const info = readProjectInfo(copy);
      copy.close();
      if (await keepLocal(info.id, source)) {
        await removeDatabaseFiles(temporary);
        return { status: 'kept', id: info.id };
      }
      const target = deps.paths.projectFile(info.id);
      if (currentInfo?.id === info.id) await close();
      await removeDatabaseFiles(target);
      await rename(temporary, target);
      return { status: 'imported', project: await adopt(await openProject(target)) };
    } catch (error) {
      await removeDatabaseFiles(temporary);
      return { status: 'failed', code: failureCode(error) };
    }
  }

  async function importFromFile(): Promise<ImportProjectResult> {
    const picked = await deps.dialogs.showOpenDialog({ properties: ['openFile'], filters: projectFilters });
    const source = picked.filePaths[0];
    if (picked.canceled || !source) return { status: 'cancelled' };
    const outcome = await importFrom(source);
    return outcome.status === 'kept' ? { status: 'cancelled' } : outcome;
  }

  async function openFile(path: string): Promise<ImportProjectResult | OpenProjectResult> {
    const location = resolve(path);
    if (dirname(location) === resolve(deps.paths.projects)) {
      const id = projectIdSchema.safeParse(basename(location, `.${PROJECT_FILE_EXTENSION}`));
      if (id.success) return open(id.data);
    }
    const outcome = await importFrom(location);
    return outcome.status === 'kept' ? open(outcome.id) : outcome;
  }

  async function exportCurrent(): Promise<ExportResult> {
    if (!current || !currentInfo) return { status: 'cancelled' };
    const picked = await deps.dialogs.showSaveDialog({
      defaultPath: `${currentInfo.name}.${PROJECT_FILE_EXTENSION}`,
      filters: projectFilters,
    });
    if (picked.canceled || !picked.filePath) return { status: 'cancelled' };
    await exportProject(current, picked.filePath);
    return { status: 'exported' };
  }

  async function remove(rawId: unknown): Promise<void> {
    const id = projectIdSchema.parse(rawId);
    if (currentInfo?.id === id) await close();
    await removeDatabaseFiles(deps.paths.projectFile(id));
    await deps.deviceState.update({
      recentProjects: deps.deviceState.get().recentProjects.filter((item) => item.id !== id),
    });
    notify();
  }

  async function removeRecent(rawId: unknown): Promise<ProjectState> {
    const id = projectIdSchema.parse(rawId);
    await deps.deviceState.update({
      recentProjects: deps.deviceState.get().recentProjects.filter((item) => item.id !== id),
    });
    return state();
  }

  ipc.handle(IpcChannel.projectList, () => list());
  ipc.handle(IpcChannel.projectCreate, (_event, name: unknown) => create(name));
  ipc.handle(IpcChannel.projectOpen, (_event, id: unknown) => open(id));
  ipc.handle(IpcChannel.projectClose, () => close());
  ipc.handle(IpcChannel.projectState, () => state());
  ipc.handle(IpcChannel.projectImport, () => importFromFile());
  ipc.handle(IpcChannel.projectExport, () => exportCurrent());
  ipc.handle(IpcChannel.projectDelete, (_event, id: unknown) => remove(id));
  ipc.handle(IpcChannel.projectReveal, (_event, rawId: unknown) => {
    deps.revealInFolder(deps.paths.projectFile(projectIdSchema.parse(rawId)));
  });
  ipc.handle(IpcChannel.projectRemoveRecent, (_event, id: unknown) => removeRecent(id));

  return { current: () => current, state, close, openFile };
}
