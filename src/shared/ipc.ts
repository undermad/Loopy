import { z } from 'zod';
import {
  appSettingsPatchSchema,
  appSettingsSchema,
  type AppSettings,
  type AppSettingsPatch,
} from './app-settings';
import { recentProjectSchema } from './device-state';
import { projectInfoSchema, projectNameSchema, type ProjectInfo } from './project';
import { themeSchema, type Theme } from './theme';

export const IpcChannel = {
  getAppVersion: 'app:getVersion',
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  settingsChanged: 'settings:changed',
  shellGetNativeTheme: 'shell:getNativeTheme',
  shellNativeThemeChanged: 'shell:nativeThemeChanged',
  shellGetLocale: 'shell:getLocale',
  themesList: 'themes:list',
  themesSave: 'themes:save',
  themesDelete: 'themes:delete',
  themesExport: 'themes:export',
  themesImport: 'themes:import',
  projectList: 'project:list',
  projectCreate: 'project:create',
  projectOpen: 'project:open',
  projectClose: 'project:close',
  projectState: 'project:state',
  projectImport: 'project:import',
  projectExport: 'project:export',
  projectDelete: 'project:delete',
  projectReveal: 'project:reveal',
  projectRemoveRecent: 'project:removeRecent',
  projectChanged: 'project:changed',
} as const;

export type IpcChannelName = (typeof IpcChannel)[keyof typeof IpcChannel];

export const appVersionSchema = z.object({
  app: z.string().min(1),
  electron: z.string().min(1),
});

export const colorSchemeSchema = z.enum(['light', 'dark']);
export const localeSchema = z.string().min(2);
export const themeIdSchema = z.string().min(1);
export const themeListSchema = z.array(themeSchema);
export const projectIdSchema = z.uuid();

export const exportResultSchema = z.object({ status: z.enum(['exported', 'cancelled']) });

export const importThemeResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('imported'), theme: themeSchema }),
  z.object({ status: z.literal('cancelled') }),
  z.object({ status: z.literal('invalid') }),
]);

export const projectFailureCodeSchema = z.enum([
  'NOT_FOUND',
  'NOT_A_PROJECT',
  'UNSUPPORTED_VERSION',
  'CORRUPT',
]);

export const projectSummarySchema = projectInfoSchema.extend({ lastOpenedAt: z.iso.datetime().optional() });
export const projectListSchema = z.array(projectSummarySchema);

export const projectStateSchema = z.object({
  current: projectInfoSchema.nullable(),
  recent: z.array(recentProjectSchema),
});

export const openProjectResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('opened'), project: projectInfoSchema }),
  z.object({ status: z.literal('failed'), code: projectFailureCodeSchema }),
]);

export const importProjectResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('imported'), project: projectInfoSchema }),
  z.object({ status: z.literal('cancelled') }),
  z.object({ status: z.literal('failed'), code: projectFailureCodeSchema }),
]);

export { appSettingsPatchSchema, appSettingsSchema, projectInfoSchema, projectNameSchema, themeSchema };

export type AppVersion = z.infer<typeof appVersionSchema>;
export type ColorScheme = z.infer<typeof colorSchemeSchema>;
export type ExportResult = z.infer<typeof exportResultSchema>;
export type ImportThemeResult = z.infer<typeof importThemeResultSchema>;
export type ProjectFailureCode = z.infer<typeof projectFailureCodeSchema>;
export type ProjectSummary = z.infer<typeof projectSummarySchema>;
export type ProjectState = z.infer<typeof projectStateSchema>;
export type OpenProjectResult = z.infer<typeof openProjectResultSchema>;
export type ImportProjectResult = z.infer<typeof importProjectResultSchema>;
export type Unsubscribe = () => void;

export interface LoopyApi {
  getAppVersion: () => Promise<AppVersion>;
  getSettings: () => Promise<AppSettings>;
  setSettings: (patch: AppSettingsPatch) => Promise<AppSettings>;
  onSettingsChanged: (listener: (settings: AppSettings) => void) => Unsubscribe;
  getNativeTheme: () => Promise<ColorScheme>;
  onNativeThemeChanged: (listener: (scheme: ColorScheme) => void) => Unsubscribe;
  getLocale: () => Promise<string>;
  listThemes: () => Promise<Theme[]>;
  saveTheme: (theme: Theme) => Promise<Theme>;
  deleteTheme: (id: string) => Promise<void>;
  exportTheme: (id: string) => Promise<ExportResult>;
  importTheme: () => Promise<ImportThemeResult>;
  listProjects: () => Promise<ProjectSummary[]>;
  createProject: (name: string) => Promise<ProjectInfo>;
  openProject: (id: string) => Promise<OpenProjectResult>;
  closeProject: () => Promise<void>;
  getProjectState: () => Promise<ProjectState>;
  importProject: () => Promise<ImportProjectResult>;
  exportProject: () => Promise<ExportResult>;
  deleteProject: (id: string) => Promise<void>;
  revealProject: (id: string) => Promise<void>;
  removeRecentProject: (id: string) => Promise<ProjectState>;
  onProjectChanged: (listener: (state: ProjectState) => void) => Unsubscribe;
}
