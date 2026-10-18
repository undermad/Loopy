import { useEffect } from 'react';
import { useStore } from 'zustand';
import type { RecentProjectEntry } from '@shared/ipc';
import type { ProjectInfo, RecoverableProject } from '@shared/project';
import { projectStore, windowTitle } from './store';

export function useCurrentProject(): ProjectInfo | null {
  return useStore(projectStore, (state) => state.current);
}

export function useCreatingProject(): boolean {
  return useStore(projectStore, (state) => state.creating);
}

export function useProjectDirty(): boolean {
  return useStore(projectStore, (state) => state.dirty);
}

export function useRecentProjects(): RecentProjectEntry[] {
  return useStore(projectStore, (state) => state.recent);
}

export function useRecoverableProjects(): RecoverableProject[] {
  return useStore(projectStore, (state) => state.recoverable);
}

export function useWindowTitle(appName: string): void {
  const project = useCurrentProject();
  const dirty = useProjectDirty();
  useEffect(() => {
    document.title = windowTitle(appName, project, dirty);
  }, [appName, project, dirty]);
}
