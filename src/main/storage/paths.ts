import { join } from 'node:path';

export interface StoragePaths {
  readonly settings: string;
  readonly deviceState: string;
  readonly projects: string;
  readonly working: string;
  readonly themes: string;
  readonly layouts: string;
}

export function storagePaths(userData: string): StoragePaths {
  const projects = join(userData, 'projects');
  return {
    settings: join(userData, 'settings.json'),
    deviceState: join(userData, 'state.json'),
    projects,
    working: join(userData, 'working'),
    themes: join(userData, 'themes'),
    layouts: join(userData, 'layouts'),
  };
}
