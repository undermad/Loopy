import { createStore } from 'zustand/vanilla';
import type { LoopyApi } from '@shared/ipc';
import { LAYOUT_SCHEMA_VERSION, type LayoutPreset, type Workspace, type Workspaces } from '@shared/layout';
import { buildWorkspace, cloneWorkspace, type WorkspaceTemplate } from '@shared/layout-presets';

export type WorkspacesApi = Pick<
  LoopyApi,
  | 'getShellState'
  | 'setShellState'
  | 'listLayouts'
  | 'saveLayout'
  | 'deleteLayout'
  | 'exportLayout'
  | 'importLayout'
  | 'toggleFullscreen'
>;

export interface WorkspacesState {
  workspaces: Workspace[];
  activeId: string;
  statusBar: boolean;
  presets: LayoutPreset[];
  hoveredAreaId: string | null;
  api: WorkspacesApi | null;
}

const PERSIST_DELAY = 500;

export const workspacesStore = createStore<WorkspacesState>(() => ({
  workspaces: [],
  activeId: '',
  statusBar: true,
  presets: [],
  hoveredAreaId: null,
  api: null,
}));

let timer: ReturnType<typeof setTimeout> | null = null;
let pending: Promise<unknown> = Promise.resolve();

export function requireApi(): WorkspacesApi {
  const { api } = workspacesStore.getState();
  if (!api) throw new Error('Workspaces are not loaded');
  return api;
}

function snapshot(): Workspaces {
  const { workspaces, activeId } = workspacesStore.getState();
  return { schemaVersion: LAYOUT_SCHEMA_VERSION, items: workspaces, activeId };
}

export function flushWorkspaces(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
    const { api } = workspacesStore.getState();
    if (api) pending = api.setShellState({ workspaces: snapshot() });
  }
  return pending.then(() => undefined);
}

function schedulePersist(): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    const { api } = workspacesStore.getState();
    if (api) pending = api.setShellState({ workspaces: snapshot() }).catch(() => undefined);
  }, PERSIST_DELAY);
}

export function commitWorkspaces(workspaces: Workspace[], activeId?: string): void {
  const current = workspacesStore.getState();
  const nextActive =
    activeId && workspaces.some((item) => item.id === activeId)
      ? activeId
      : workspaces.some((item) => item.id === current.activeId)
        ? current.activeId
        : (workspaces[0]?.id ?? '');
  workspacesStore.setState({ workspaces, activeId: nextActive });
  schedulePersist();
}

export async function bootWorkspaces(api: WorkspacesApi, defaults: () => Workspace[]): Promise<void> {
  const [state, presets] = await Promise.all([api.getShellState(), api.listLayouts()]);
  const items = state.workspaces?.items ?? defaults();
  const first = items[0];
  if (!first) throw new Error('No workspaces');
  const activeId = items.some((item) => item.id === state.workspaces?.activeId)
    ? state.workspaces?.activeId
    : first.id;
  workspacesStore.setState({
    api,
    workspaces: items,
    activeId: activeId ?? first.id,
    statusBar: state.statusBar,
    presets,
  });
  window.addEventListener('beforeunload', () => {
    void flushWorkspaces();
  });
}

export function setActiveWorkspace(id: string): void {
  const { workspaces } = workspacesStore.getState();
  if (workspaces.some((item) => item.id === id)) commitWorkspaces(workspaces, id);
}

export function cycleWorkspace(delta: number): void {
  const { workspaces, activeId } = workspacesStore.getState();
  const index = workspaces.findIndex((item) => item.id === activeId);
  const next = workspaces[(index + delta + workspaces.length) % workspaces.length];
  if (next) commitWorkspaces(workspaces, next.id);
}

export function addWorkspace(templateId: WorkspaceTemplate['id'], name: string): Workspace {
  const workspace = buildWorkspace(templateId, name);
  commitWorkspaces([...workspacesStore.getState().workspaces, workspace], workspace.id);
  return workspace;
}

export function duplicateWorkspace(id: string, name?: string): void {
  const { workspaces } = workspacesStore.getState();
  const index = workspaces.findIndex((item) => item.id === id);
  const source = workspaces[index];
  if (!source) return;
  const copy = cloneWorkspace(source, name ?? source.name);
  const next = [...workspaces];
  next.splice(index + 1, 0, copy);
  commitWorkspaces(next, copy.id);
}

export function renameWorkspace(id: string, name: string): void {
  const trimmed = name.trim();
  if (!trimmed) return;
  commitWorkspaces(
    workspacesStore.getState().workspaces.map((item) => (item.id === id ? { ...item, name: trimmed } : item)),
  );
}

export function deleteWorkspace(id: string): void {
  const { workspaces, activeId } = workspacesStore.getState();
  if (workspaces.length <= 1) return;
  const index = workspaces.findIndex((item) => item.id === id);
  const next = workspaces.filter((item) => item.id !== id);
  const fallback = next[Math.min(index, next.length - 1)];
  commitWorkspaces(next, activeId === id ? fallback?.id : activeId);
}

export function moveWorkspace(id: string, delta: number): void {
  const { workspaces } = workspacesStore.getState();
  const index = workspaces.findIndex((item) => item.id === id);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= workspaces.length) return;
  const next = [...workspaces];
  const [moved] = next.splice(index, 1);
  if (moved) next.splice(target, 0, moved);
  commitWorkspaces(next);
}

export function updateWorkspace(id: string, update: (workspace: Workspace) => Workspace): void {
  commitWorkspaces(
    workspacesStore.getState().workspaces.map((item) => (item.id === id ? update(item) : item)),
  );
}

export function resetWorkspacesStore(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  workspacesStore.setState({
    workspaces: [],
    activeId: '',
    statusBar: true,
    presets: [],
    hoveredAreaId: null,
    api: null,
  });
}
