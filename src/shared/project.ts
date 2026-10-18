import { z } from 'zod';

export const PROJECT_FILE_EXTENSION = 'loopy';

export const projectNameSchema = z.string().trim().min(1).max(200);

export const projectInfoSchema = z.object({
  id: z.uuid(),
  name: projectNameSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type ProjectInfo = z.infer<typeof projectInfoSchema>;

export const recoverableProjectSchema = z.object({
  id: z.uuid(),
  name: projectNameSchema,
  path: z.string().min(1).nullable(),
  modifiedAt: z.iso.datetime(),
});

export type RecoverableProject = z.infer<typeof recoverableProjectSchema>;
