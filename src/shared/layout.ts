import { z } from 'zod';

export const LAYOUT_SCHEMA_VERSION = 1;

export type SplitDirection = 'row' | 'column';

export interface AreaNode {
  kind: 'area';
  id: string;
  editor: string;
  state: Record<string, unknown>;
}

export interface SplitNode {
  kind: 'split';
  id: string;
  direction: SplitDirection;
  children: LayoutNode[];
  sizes: number[];
}

export type LayoutNode = AreaNode | SplitNode;

export const splitDirectionSchema = z.enum(['row', 'column']);

export const areaNodeSchema = z.object({
  kind: z.literal('area'),
  id: z.string().min(1),
  editor: z.string().min(1),
  state: z.record(z.string(), z.unknown()).default({}),
});

export const layoutNodeSchema: z.ZodType<LayoutNode> = z.lazy(() =>
  z.union([
    areaNodeSchema,
    z.object({
      kind: z.literal('split'),
      id: z.string().min(1),
      direction: splitDirectionSchema,
      children: z.array(layoutNodeSchema).min(2),
      sizes: z.array(z.number().positive()).min(2),
    }),
  ]),
);

export const workspaceNameSchema = z.string().trim().min(1).max(60);

export const workspaceSchema = z.object({
  id: z.string().min(1),
  name: workspaceNameSchema,
  root: layoutNodeSchema,
  maximisedAreaId: z.string().min(1).optional(),
});

export const workspacesSchema = z.object({
  schemaVersion: z.literal(LAYOUT_SCHEMA_VERSION),
  items: z.array(workspaceSchema).min(1),
  activeId: z.string().min(1),
});

export const layoutPresetSchema = z.object({
  schemaVersion: z.literal(LAYOUT_SCHEMA_VERSION),
  id: z.string().min(1).max(80),
  name: z.string().trim().min(1).max(60),
  workspaces: z.array(workspaceSchema).min(1),
});

export type Workspace = z.infer<typeof workspaceSchema>;
export type Workspaces = z.infer<typeof workspacesSchema>;
export type LayoutPreset = z.infer<typeof layoutPresetSchema>;
