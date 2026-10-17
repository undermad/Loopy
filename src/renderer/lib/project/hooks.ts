import { useStore } from 'zustand';
import type { RecentProject } from '@shared/device-state';
import type { ProjectSummary } from '@shared/ipc';
import type { ProjectInfo } from '@shared/project';
import { projectStore } from './store';

export function useCurrentProject(): ProjectInfo | null {
  return useStore(projectStore, (state) => state.current);
}

export function useProjectList(): ProjectSummary[] {
  return useStore(projectStore, (state) => state.projects);
}

export function useRecentProjects(): RecentProject[] {
  return useStore(projectStore, (state) => state.recent);
}
