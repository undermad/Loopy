import { createStore } from 'zustand/vanilla';
import type {
  LoopyApi,
  OpenProjectResult,
  ProjectState,
  RecentProjectEntry,
  SaveProjectResult,
} from '@shared/ipc';
import type { ProjectInfo, RecoverableProject } from '@shared/project';

export type ProjectApi = Pick<
  LoopyApi,
  | 'listProjects'
  | 'createProject'
  | 'openProject'
  | 'openRecentProject'
  | 'closeProject'
  | 'getProjectState'
  | 'saveProject'
  | 'saveProjectAs'
  | 'renameProject'
  | 'recoverProject'
  | 'discardRecovery'
  | 'revealProject'
  | 'removeRecentProject'
  | 'onProjectChanged'
  | 'quitApp'
>;

interface ProjectStoreState {
  current: ProjectInfo | null;
  path: string | null;
  dirty: boolean;
  recent: RecentProjectEntry[];
  recoverable: RecoverableProject[];
  creating: boolean;
  api: ProjectApi | null;
}

const initialState = (): ProjectStoreState => ({
  current: null,
  path: null,
  dirty: false,
  recent: [],
  recoverable: [],
  creating: false,
  api: null,
});

export const projectStore = createStore<ProjectStoreState>(initialState);

function requireApi(): ProjectApi {
  const { api } = projectStore.getState();
  if (!api) throw new Error('Projects are not loaded');
  return api;
}

function applyState(state: ProjectState): void {
  projectStore.setState({
    current: state.current,
    path: state.path,
    dirty: state.dirty,
    recoverable: state.recoverable,
  });
}

async function refreshRecent(): Promise<void> {
  projectStore.setState({ recent: await requireApi().listProjects() });
}

export async function bootProject(api: ProjectApi): Promise<void> {
  projectStore.setState({ api });
  const [state, recent] = await Promise.all([api.getProjectState(), api.listProjects()]);
  applyState(state);
  projectStore.setState({ recent });
  api.onProjectChanged((next) => {
    applyState(next);
    void refreshRecent();
  });
}

export function startCreatingProject(): void {
  projectStore.setState({ creating: true });
}

export function stopCreatingProject(): void {
  projectStore.setState({ creating: false });
}

export async function createProject(name: string): Promise<OpenProjectResult> {
  const result = await requireApi().createProject(name);
  if (result.status === 'opened') stopCreatingProject();
  return result;
}

export function openProject(): Promise<OpenProjectResult> {
  return requireApi().openProject();
}

export function openRecentProject(path: string): Promise<OpenProjectResult> {
  return requireApi().openRecentProject(path);
}

export function closeProject(): Promise<void> {
  return requireApi().closeProject();
}

export function saveProject(): Promise<SaveProjectResult> {
  return requireApi().saveProject();
}

export function saveProjectAs(): Promise<SaveProjectResult> {
  return requireApi().saveProjectAs();
}

export function renameProject(name: string): Promise<ProjectInfo> {
  return requireApi().renameProject(name);
}

export function recoverProject(id: string): Promise<OpenProjectResult> {
  return requireApi().recoverProject(id);
}

export async function discardRecovery(id: string): Promise<void> {
  applyState(await requireApi().discardRecovery(id));
}

export function revealProject(path: string): Promise<void> {
  return requireApi().revealProject(path);
}

export async function removeRecentProject(path: string): Promise<void> {
  applyState(await requireApi().removeRecentProject(path));
  await refreshRecent();
}

export function quitApp(): Promise<void> {
  return requireApi().quitApp();
}

export function currentProject(): ProjectInfo | null {
  return projectStore.getState().current;
}

export function subscribeCurrentProject(listener: (project: ProjectInfo | null) => void): () => void {
  let previous = projectStore.getState().current;
  return projectStore.subscribe((state) => {
    if (state.current?.id !== previous?.id) {
      previous = state.current;
      listener(state.current);
    }
  });
}

export function windowTitle(appName: string, project: ProjectInfo | null, dirty: boolean): string {
  if (!project) return appName;
  return `${dirty ? '• ' : ''}${project.name} — ${appName}`;
}

export function resetProjectStore(): void {
  projectStore.setState(initialState());
}
