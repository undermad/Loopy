import { LAYOUT_SCHEMA_VERSION, type LayoutPreset, type Workspace } from '@shared/layout';
import { cloneWorkspace } from '@shared/layout-presets';
import { commitWorkspaces, requireApi, workspacesStore } from './store';

function stripMaximised(workspace: Workspace): Workspace {
  const { maximisedAreaId: _ignored, ...rest } = workspace;
  return rest;
}

export function currentLayout(name: string, id = crypto.randomUUID()): LayoutPreset {
  return {
    schemaVersion: LAYOUT_SCHEMA_VERSION,
    id,
    name,
    workspaces: workspacesStore
      .getState()
      .workspaces.map((workspace) => cloneWorkspace(stripMaximised(workspace))),
  };
}

export function applyLayout(preset: LayoutPreset): void {
  const workspaces = preset.workspaces.map((workspace) => cloneWorkspace(workspace));
  commitWorkspaces(workspaces, workspaces[0]?.id);
}

async function refreshPresets(): Promise<void> {
  workspacesStore.setState({ presets: await requireApi().listLayouts() });
}

export async function saveCurrentLayout(name: string): Promise<LayoutPreset> {
  const saved = await requireApi().saveLayout(currentLayout(name));
  await refreshPresets();
  return saved;
}

export async function deleteLayout(id: string): Promise<void> {
  await requireApi().deleteLayout(id);
  await refreshPresets();
}

export function exportLayout(preset: LayoutPreset) {
  return requireApi().exportLayout(preset);
}

export async function importLayout() {
  const result = await requireApi().importLayout();
  if (result.status === 'imported') await refreshPresets();
  return result;
}

export async function setStatusBarVisible(statusBar: boolean): Promise<void> {
  workspacesStore.setState({ statusBar });
  await requireApi().setShellState({ statusBar });
}

export function toggleFullscreen(): Promise<boolean> {
  return requireApi().toggleFullscreen();
}
