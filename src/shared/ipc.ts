import { z } from 'zod';
import {
  appSettingsPatchSchema,
  appSettingsSchema,
  type AppSettings,
  type AppSettingsPatch,
} from './app-settings';
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

export const exportResultSchema = z.object({ status: z.enum(['exported', 'cancelled']) });

export const importThemeResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('imported'), theme: themeSchema }),
  z.object({ status: z.literal('cancelled') }),
  z.object({ status: z.literal('invalid') }),
]);

export { appSettingsPatchSchema, appSettingsSchema, themeSchema };

export type AppVersion = z.infer<typeof appVersionSchema>;
export type ColorScheme = z.infer<typeof colorSchemeSchema>;
export type ExportResult = z.infer<typeof exportResultSchema>;
export type ImportThemeResult = z.infer<typeof importThemeResultSchema>;
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
}
