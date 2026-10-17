import { join } from 'node:path';
import { PROJECT_FILE_EXTENSION } from '@shared/project';

export interface StoragePaths {
  readonly settings: string;
  readonly deviceState: string;
  readonly projects: string;
  readonly themes: string;
  readonly layouts: string;
  projectFile(id: string): string;
}

export function storagePaths(userData: string): StoragePaths {
  const projects = join(userData, 'projects');
  return {
    settings: join(userData, 'settings.json'),
    deviceState: join(userData, 'state.json'),
    projects,
    themes: join(userData, 'themes'),
    layouts: join(userData, 'layouts'),
    projectFile: (id) => join(projects, `${id}.${PROJECT_FILE_EXTENSION}`),
  };
}
