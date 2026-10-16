import { z } from 'zod';

export const IpcChannel = {
  getAppVersion: 'app:getVersion',
} as const;

export const appVersionSchema = z.object({
  app: z.string().min(1),
  electron: z.string().min(1),
});

export type AppVersion = z.infer<typeof appVersionSchema>;

export interface LoopyApi {
  getAppVersion: () => Promise<AppVersion>;
}
