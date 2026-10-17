import { z } from 'zod';
import { hexColorSchema } from './theme';

export const boardUnitSchema = z.enum(['px', 'mm', 'cm', 'm', 'km']);

export const boardSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  backgroundColor: hexColorSchema,
  unit: boardUnitSchema,
  unitScale: z.number().positive().max(1_000_000),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const boardNodeTypeSchema = z.enum(['note']);

export const noteDataSchema = z.object({ text: z.string().max(5000).default('') });

export const boardNodeSchema = z.object({
  id: z.string().min(1),
  boardId: z.string().min(1),
  type: boardNodeTypeSchema,
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  z: z.number().int(),
  data: z.record(z.string(), z.unknown()).default({}),
});

export const boardEdgeSchema = z.object({
  id: z.string().min(1),
  boardId: z.string().min(1),
  sourceId: z.string().min(1),
  targetId: z.string().min(1),
  data: z.record(z.string(), z.unknown()).default({}),
});

export const boardSnapshotSchema = z.object({
  board: boardSchema,
  nodes: z.array(boardNodeSchema),
  edges: z.array(boardEdgeSchema),
});

export const boardListSchema = z.array(boardSchema);

export const boardInputSchema = z.object({
  name: boardSchema.shape.name,
  backgroundColor: hexColorSchema.optional(),
  unit: boardUnitSchema.optional(),
  unitScale: boardSchema.shape.unitScale.optional(),
});

export const boardPatchSchema = z
  .object({
    name: boardSchema.shape.name,
    backgroundColor: hexColorSchema,
    unit: boardUnitSchema,
    unitScale: boardSchema.shape.unitScale,
  })
  .partial();

export const boardChangesSchema = z.object({
  upsertNodes: z.array(boardNodeSchema).default([]),
  removeNodeIds: z.array(z.string().min(1)).default([]),
  upsertEdges: z.array(boardEdgeSchema).default([]),
  removeEdgeIds: z.array(z.string().min(1)).default([]),
});

export const DEFAULT_BOARD_BACKGROUND = '#f4f4f5';
export const DEFAULT_NOTE_SIZE = { width: 200, height: 120 };
export const DEFAULT_BOARD_UNIT: BoardUnit = 'm';
export const DEFAULT_BOARD_UNIT_SCALE = 100;

export type BoardNodeType = z.infer<typeof boardNodeTypeSchema>;
export type BoardUnit = z.infer<typeof boardUnitSchema>;
export type Board = z.infer<typeof boardSchema>;
export type BoardNode = z.infer<typeof boardNodeSchema>;
export type BoardEdge = z.infer<typeof boardEdgeSchema>;
export type BoardSnapshot = z.infer<typeof boardSnapshotSchema>;
export type BoardInput = z.input<typeof boardInputSchema>;
export type BoardPatch = z.infer<typeof boardPatchSchema>;
export type BoardChanges = Partial<z.infer<typeof boardChangesSchema>>;
