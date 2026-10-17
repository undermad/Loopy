import type { SplitDirection, Workspace } from '@shared/layout';
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

export interface PanelPlacement {
  side?: 'before' | 'after';
  anchor?: string;
  direction?: SplitDirection;
}

export const panelActions = {
  open(
    areaId: string,
    editor: string,
    containerWidth: number,
    panelWidth: number,
    placement: PanelPlacement = {},
  ): string {
    const workspace = activeWorkspace();
    const first = panelAreaIds(workspace, editor)[0];
    if (first) return first;
    const anchorId = placement.anchor ? panelAreaIds(workspace, placement.anchor)[0] : undefined;
    if (anchorId) return areaActions.split(anchorId, placement.direction ?? 'column', 0.55, editor);
    const ratio = panelRatio(containerWidth, panelWidth);
    if (placement.side === 'before') return areaActions.split(areaId, 'row', ratio, editor, true);
    return areaActions.split(areaId, 'row', ratio, editor);
  },
  close(editor: string): void {
    for (const id of panelAreaIds(activeWorkspace(), editor)) areaActions.close(id);
  },
  toggle(
    areaId: string,
    editor: string,
    containerWidth: number,
    panelWidth: number,
    placement: PanelPlacement = {},
  ): void {
    if (panelAreaIds(activeWorkspace(), editor).length > 0) panelActions.close(editor);
    else panelActions.open(areaId, editor, containerWidth, panelWidth, placement);
  },
};
