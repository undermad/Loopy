import type { SplitDirection, Workspace } from '@shared/layout';
import {
  collectAreas,
  findArea,
  joinAreas,
  patchAreaState,
  removeArea,
  resizeSplit,
  setAreaEditor,
  splitArea,
  swapAreas,
} from '@renderer/lib/layout';
import { updateWorkspace, workspacesStore } from './store';

function updateActive(update: (workspace: Workspace) => Workspace): void {
  updateWorkspace(workspacesStore.getState().activeId, update);
}

export const areaActions = {
  split(areaId: string, direction: SplitDirection, ratio = 0.5, editor?: string): string {
    let newAreaId = areaId;
    updateActive((workspace) => {
      const result = splitArea(workspace.root, areaId, direction, ratio, editor);
      newAreaId = result.newAreaId;
      return { ...workspace, root: result.root };
    });
    return newAreaId;
  },
  join(keepId: string, removeId: string): void {
    updateActive((workspace) => {
      const { maximisedAreaId: _ignored, ...rest } = workspace;
      return { ...rest, root: joinAreas(workspace.root, keepId, removeId) };
    });
  },
  close(areaId: string): void {
    updateActive((workspace) => {
      if (collectAreas(workspace.root).length <= 1) return workspace;
      const { maximisedAreaId: _ignored, ...rest } = workspace;
      return { ...rest, root: removeArea(workspace.root, areaId) };
    });
  },
  swap(firstId: string, secondId: string): void {
    updateActive((workspace) => ({ ...workspace, root: swapAreas(workspace.root, firstId, secondId) }));
  },
  setEditor(areaId: string, editor: string, state: Record<string, unknown> = {}): void {
    updateActive((workspace) => ({
      ...workspace,
      root: setAreaEditor(workspace.root, areaId, editor, state),
    }));
  },
  patchState(areaId: string, patch: Record<string, unknown>): void {
    updateActive((workspace) => ({ ...workspace, root: patchAreaState(workspace.root, areaId, patch) }));
  },
  resize(splitId: string, sizes: number[]): void {
    updateActive((workspace) => ({ ...workspace, root: resizeSplit(workspace.root, splitId, sizes) }));
  },
  toggleMaximise(areaId: string): void {
    updateActive((workspace) => {
      if (workspace.maximisedAreaId === areaId || !findArea(workspace.root, areaId)) {
        const { maximisedAreaId: _ignored, ...rest } = workspace;
        return rest;
      }
      return { ...workspace, maximisedAreaId: areaId };
    });
  },
};

export function setHoveredArea(areaId: string | null): void {
  if (workspacesStore.getState().hoveredAreaId !== areaId)
    workspacesStore.setState({ hoveredAreaId: areaId });
}
