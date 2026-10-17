import { useStore } from 'zustand';
import type { LayoutPreset, Workspace } from '@shared/layout';
import { panelAreaIds } from './panels';
import { workspacesStore } from './store';

export function useWorkspaces(): Workspace[] {
  return useStore(workspacesStore, (state) => state.workspaces);
}

export function useActiveWorkspaceId(): string {
  return useStore(workspacesStore, (state) => state.activeId);
}

export function useActiveWorkspace(): Workspace | null {
  return useStore(
    workspacesStore,
    (state) => state.workspaces.find((workspace) => workspace.id === state.activeId) ?? null,
  );
}

export function useStatusBarVisible(): boolean {
  return useStore(workspacesStore, (state) => state.statusBar);
}

export function useLayoutPresets(): LayoutPreset[] {
  return useStore(workspacesStore, (state) => state.presets);
}

export function useHoveredAreaId(): string | null {
  return useStore(workspacesStore, (state) => state.hoveredAreaId);
}

export function usePanelOpen(editor: string): boolean {
  return useStore(
    workspacesStore,
    (state) =>
      panelAreaIds(state.workspaces.find((workspace) => workspace.id === state.activeId) ?? null, editor)
        .length > 0,
  );
}
