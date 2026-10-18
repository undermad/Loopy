import { stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { IpcMain } from 'electron';
import {
  IpcChannel,
  projectIdSchema,
  projectPathSchema,
  type OpenProjectResult,
  type ProjectFailureCode,
  type ProjectState,
  type RecentProjectEntry,
  type SaveProjectResult,
} from '@shared/ipc';
import { PROJECT_FILE_EXTENSION, type ProjectInfo, type RecoverableProject } from '@shared/project';
import type { SaveChoice } from '../open-file';
import type { DeviceStateService } from '../services/device-state';
import { exists } from '../storage/fs';
import type { StoragePaths } from '../storage/paths';
import { ProjectFileError, type ProjectDatabase } from '../storage/project-database';
import {
  collectOrphans,
  createSession,
  discardOrphan,
  openSession,
  restoreSession,
  type ProjectSession,
} from '../storage/project-session';
import type { Broadcast } from './settings';
import type { FileDialogs } from './themes';

export interface ProjectHandlerDeps {
  paths: StoragePaths;
  deviceState: DeviceStateService;
  dialogs: FileDialogs;
  broadcast: Broadcast;
  revealInFolder: (path: string) => void;
  confirmSave: (name: string) => Promise<SaveChoice>;
}

export interface ProjectService {
  current(): ProjectDatabase | null;
  state(): ProjectState;
  needsSave(): boolean;
  markDirty(): Promise<void>;
  guard(): Promise<boolean>;
  openFile(path: string): Promise<OpenProjectResult>;
  dispose(): void;
}

const projectFilters = [{ name: 'Loopy project', extensions: [PROJECT_FILE_EXTENSION] }];
const MAX_RECENT = 10;

function failureCode(error: unknown): ProjectFailureCode {
  if (error instanceof ProjectFileError && error.code !== 'ALREADY_EXISTS') return error.code;
  return 'CORRUPT';
}

export async function registerProjectHandlers(
  ipc: Pick<IpcMain, 'handle'>,
  deps: ProjectHandlerDeps,
): Promise<ProjectService> {
  let session: ProjectSession | null = null;
  let recoverable: RecoverableProject[] = await collectOrphans(deps.paths.working);

  const recent = () => deps.deviceState.get().recentProjects;
  const state = (): ProjectState => ({
    current: session?.info() ?? null,
    path: session?.savedPath ?? null,
    dirty: session?.dirty ?? false,
    recent: recent(),
    recoverable,
  });
  const notify = () => {
    deps.broadcast(IpcChannel.projectChanged, state());
  };

  function knownPath(raw: unknown): string {
    const path = resolve(projectPathSchema.parse(raw));
    if (!recent().some((entry) => resolve(entry.path) === path) && session?.savedPath !== path) {
      throw new Error(`Unknown project path ${path}`);
    }
    return path;
  }

  async function touchRecent(info: ProjectInfo, path: string): Promise<void> {
    const entry = { id: info.id, name: info.name, path, openedAt: new Date().toISOString() };
    const others = recent().filter((item) => resolve(item.path) !== resolve(path));
    await deps.deviceState.update({ recentProjects: [entry, ...others].slice(0, MAX_RECENT) });
  }

  function end(): void {
    session?.discard();
    session = null;
  }

  async function adopt(next: ProjectSession): Promise<OpenProjectResult> {
    end();
    session = next;
    if (next.savedPath) await touchRecent(next.info(), next.savedPath);
    notify();
    return { status: 'opened', project: next.info() };
  }

  async function saveTo(path: string): Promise<SaveProjectResult> {
    if (!session) return { status: 'cancelled' };
    try {
      await session.saveTo(path);
    } catch {
      notify();
      return { status: 'failed' };
    }
    await touchRecent(session.info(), path);
    notify();
    return { status: 'saved' };
  }

  async function defaultFolder(): Promise<string | undefined> {
    const latest = recent()[0];
    if (latest) return dirname(latest.path);
    return (await exists(deps.paths.projects)) ? deps.paths.projects : undefined;
  }

  async function saveAs(): Promise<SaveProjectResult> {
    if (!session) return { status: 'cancelled' };
    const fileName = `${session.info().name}.${PROJECT_FILE_EXTENSION}`;
    const folder = session.savedPath ? dirname(session.savedPath) : await defaultFolder();
    const picked = await deps.dialogs.showSaveDialog({
      defaultPath: folder ? join(folder, fileName) : fileName,
      filters: projectFilters,
    });
    if (picked.canceled || !picked.filePath) return { status: 'cancelled' };
    return saveTo(resolve(picked.filePath));
  }

  function save(): Promise<SaveProjectResult> {
    if (session?.savedPath) return saveTo(session.savedPath);
    return saveAs();
  }

  async function guard(): Promise<boolean> {
    if (!session?.needsSave) return true;
    const choice = await deps.confirmSave(session.info().name);
    if (choice === 'cancel') return false;
    if (choice === 'discard') return true;
    return (await save()).status === 'saved';
  }

  async function create(rawName: unknown): Promise<OpenProjectResult> {
    if (!(await guard())) return { status: 'cancelled' };
    return adopt(await createSession(deps.paths.working, String(rawName)));
  }

  async function openPath(path: string): Promise<OpenProjectResult> {
    const location = resolve(path);
    if (session?.savedPath === location) return { status: 'opened', project: session.info() };
    if (!(await guard())) return { status: 'cancelled' };
    try {
      return await adopt(await openSession(deps.paths.working, location));
    } catch (error) {
      return { status: 'failed', code: failureCode(error) };
    }
  }

  async function open(): Promise<OpenProjectResult> {
    const folder = session?.savedPath ? dirname(session.savedPath) : await defaultFolder();
    const picked = await deps.dialogs.showOpenDialog({
      ...(folder ? { defaultPath: folder } : {}),
      properties: ['openFile'],
      filters: projectFilters,
    });
    const source = picked.filePaths[0];
    if (picked.canceled || !source) return { status: 'cancelled' };
    return openPath(source);
  }

  async function close(): Promise<void> {
    if (!session || !(await guard())) return;
    end();
    notify();
  }

  async function rename(rawName: unknown): Promise<ProjectInfo> {
    if (!session) throw new Error('No project is open');
    const info = await session.rename(String(rawName));
    notify();
    return info;
  }

  async function markDirty(): Promise<void> {
    if (!session || session.dirty) return;
    await session.markDirty();
    notify();
  }

  function offered(raw: unknown): string {
    const id = projectIdSchema.parse(raw);
    if (!recoverable.some((item) => item.id === id)) throw new Error(`Nothing to recover for ${id}`);
    return id;
  }

  async function recover(raw: unknown): Promise<OpenProjectResult> {
    const id = offered(raw);
    if (!(await guard())) return { status: 'cancelled' };
    recoverable = recoverable.filter((item) => item.id !== id);
    try {
      return await adopt(await restoreSession(deps.paths.working, id));
    } catch (error) {
      discardOrphan(deps.paths.working, id);
      notify();
      return { status: 'failed', code: failureCode(error) };
    }
  }

  function discardRecovery(raw: unknown): ProjectState {
    const id = offered(raw);
    discardOrphan(deps.paths.working, id);
    recoverable = recoverable.filter((item) => item.id !== id);
    notify();
    return state();
  }

  async function list(): Promise<RecentProjectEntry[]> {
    return Promise.all(
      recent().map(async (entry) => ({
        ...entry,
        missing: !(await stat(entry.path).then(
          (info) => info.isFile(),
          () => false,
        )),
      })),
    );
  }

  async function removeRecent(raw: unknown): Promise<ProjectState> {
    const path = knownPath(raw);
    await deps.deviceState.update({ recentProjects: recent().filter((item) => resolve(item.path) !== path) });
    notify();
    return state();
  }

  ipc.handle(IpcChannel.projectList, () => list());
  ipc.handle(IpcChannel.projectCreate, (_event, name: unknown) => create(name));
  ipc.handle(IpcChannel.projectOpen, () => open());
  ipc.handle(IpcChannel.projectOpenRecent, async (_event, path: unknown) => openPath(knownPath(path)));
  ipc.handle(IpcChannel.projectClose, () => close());
  ipc.handle(IpcChannel.projectState, () => state());
  ipc.handle(IpcChannel.projectSave, () => save());
  ipc.handle(IpcChannel.projectSaveAs, () => saveAs());
  ipc.handle(IpcChannel.projectRename, (_event, name: unknown) => rename(name));
  ipc.handle(IpcChannel.projectRecover, (_event, id: unknown) => recover(id));
  ipc.handle(IpcChannel.projectDiscardRecovery, (_event, id: unknown) =>
    Promise.resolve(id).then(discardRecovery),
  );
  ipc.handle(IpcChannel.projectReveal, (_event, path: unknown) =>
    Promise.resolve(path).then((raw) => {
      deps.revealInFolder(knownPath(raw));
    }),
  );
  ipc.handle(IpcChannel.projectRemoveRecent, (_event, path: unknown) => removeRecent(path));

  return {
    current: () => session?.project ?? null,
    state,
    needsSave: () => session?.needsSave ?? false,
    markDirty,
    guard,
    openFile: openPath,
    dispose: end,
  };
}
