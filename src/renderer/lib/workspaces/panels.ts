import type { Workspace } from '@shared/layout';
import { collectAreas } from '@renderer/lib/layout';
import { areaActions } from './areas';
import { workspacesStore } from './store';

function activeWorkspace(): Workspace | null {
  const { workspaces, activeId } = workspacesStore.getState();
  return workspaces.find((workspace) => workspace.id === activeId) ?? null;
}

export function panelAreaIds(workspace: Workspace | null, editor: string): string[] {
  return workspace
    ? collectAreas(workspace.root)
        .filter((area) => area.editor === editor)
        .map((area) => area.id)
    : [];
}

export function panelRatio(containerWidth: number, panelWidth: number): number {
  return containerWidth > panelWidth * 2 ? 1 - panelWidth / containerWidth : 0.7;
}

export const panelActions = {
  open(areaId: string, editor: string, containerWidth: number, panelWidth: number): string {
    const existing = panelAreaIds(activeWorkspace(), editor);
    const first = existing[0];
    if (first) return first;
    return areaActions.split(areaId, 'row', panelRatio(containerWidth, panelWidth), editor);
  },
  close(editor: string): void {
    for (const id of panelAreaIds(activeWorkspace(), editor)) areaActions.close(id);
  },
  toggle(areaId: string, editor: string, containerWidth: number, panelWidth: number): void {
    if (panelAreaIds(activeWorkspace(), editor).length > 0) panelActions.close(editor);
    else panelActions.open(areaId, editor, containerWidth, panelWidth);
  },
};
