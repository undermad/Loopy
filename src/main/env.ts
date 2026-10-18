import { join } from 'node:path';
import { z } from 'zod';

const DEV_USER_DATA = 'loopy-dev';

const envSchema = z.object({
  LOOPY_LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  LOOPY_USER_DATA: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Invalid environment:\n${issues.join('\n')}`);
  }
  return result.data;
}

export function userDataOverride(
  env: Pick<Env, 'LOOPY_USER_DATA'>,
  runtime: { packaged: boolean; appData: string },
): string | null {
  if (env.LOOPY_USER_DATA) return env.LOOPY_USER_DATA;
  if (!runtime.packaged) return join(runtime.appData, DEV_USER_DATA);
  return null;
}
