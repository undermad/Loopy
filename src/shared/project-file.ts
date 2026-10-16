import { z } from 'zod';

export const CURRENT_SCHEMA_VERSION = 1;

export const projectFileSchema = z.object({
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  name: z.string().min(1),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type ProjectFile = z.infer<typeof projectFileSchema>;

export function createProjectFile(name: string, now: Date = new Date()): ProjectFile {
  const timestamp = now.toISOString();
  return { schemaVersion: CURRENT_SCHEMA_VERSION, name, createdAt: timestamp, updatedAt: timestamp };
}
