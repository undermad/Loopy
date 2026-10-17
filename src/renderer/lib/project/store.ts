import { createStore } from 'zustand/vanilla';
import type { RecentProject } from '@shared/device-state';
import type { LoopyApi, ProjectState, ProjectSummary } from '@shared/ipc';
import type { ProjectInfo } from '@shared/project';

export type ProjectApi = Pick<
  LoopyApi,
  | 'listProjects'
  | 'createProject'
  | 'openProject'
  | 'closeProject'
  | 'getProjectState'
  | 'importProject'
  | 'exportProject'
  | 'deleteProject'
  | 'revealProject'
  | 'removeRecentProject'
  | 'onProjectChanged'
>;

interface ProjectStoreState {
  current: ProjectInfo | null;
  recent: RecentProject[];
  projects: ProjectSummary[];
  api: ProjectApi | null;
}

export const projectStore = createStore<ProjectStoreState>(() => ({
  current: null,
  recent: [],
  projects: [],
  api: null,
}));

function requireApi(): ProjectApi {
  const { api } = projectStore.getState();
  if (!api) throw new Error('Projects are not loaded');
  return api;
}

function applyState(state: ProjectState): void {
  projectStore.setState({ current: state.current, recent: state.recent });
}

export async function refreshProjects(): Promise<ProjectSummary[]> {
  const projects = await requireApi().listProjects();
  projectStore.setState({ projects });
  return projects;
}

export async function bootProject(api: ProjectApi): Promise<void> {
  projectStore.setState({ api });
  const [state, projects] = await Promise.all([api.getProjectState(), api.listProjects()]);
  projectStore.setState({ current: state.current, recent: state.recent, projects });
  api.onProjectChanged((next) => {
    applyState(next);
    void refreshProjects();
  });
}

export async function createProject(name: string): Promise<ProjectInfo> {
  const project = await requireApi().createProject(name);
  await refreshProjects();
  return project;
}

export function openProject(id: string) {
  return requireApi().openProject(id);
}

export function closeProject(): Promise<void> {
  return requireApi().closeProject();
}

export function importProject() {
  return requireApi().importProject();
}

export function exportProject() {
  return requireApi().exportProject();
}

export async function deleteProject(id: string): Promise<void> {
  await requireApi().deleteProject(id);
  await refreshProjects();
}

export function revealProject(id: string): Promise<void> {
  return requireApi().revealProject(id);
}

export async function removeRecentProject(id: string): Promise<void> {
  applyState(await requireApi().removeRecentProject(id));
}

export function resetProjectStore(): void {
  projectStore.setState({ current: null, recent: [], projects: [], api: null });
}
