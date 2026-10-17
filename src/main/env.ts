import { z } from 'zod';

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
