import { z } from 'zod';
import { projectNameSchema } from './project';

export const DEVICE_STATE_SCHEMA_VERSION = 1;

export const windowBoundsSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export const recentProjectSchema = z.object({
  id: z.uuid(),
  name: projectNameSchema,
  openedAt: z.iso.datetime(),
});

export const deviceStateSchema = z.object({
  schemaVersion: z.literal(DEVICE_STATE_SCHEMA_VERSION),
  windowBounds: windowBoundsSchema.optional(),
  lastProjectId: z.uuid().optional(),
  recentProjects: z.array(recentProjectSchema).max(10).default([]),
});

export type DeviceState = z.infer<typeof deviceStateSchema>;

export type WindowBounds = z.infer<typeof windowBoundsSchema>;
export type RecentProject = z.infer<typeof recentProjectSchema>;
