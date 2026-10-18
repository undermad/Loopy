import { z } from 'zod';
import { colourRefSchema, colourValueSchema } from './colours';
import { hexColorSchema } from './theme';

export const boardUnitSchema = z.enum(['px', 'mm', 'cm', 'm', 'km']);

export const boardSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  backgroundColor: hexColorSchema,
  gridColor: hexColorSchema,
  backgroundRef: colourRefSchema.nullable().default(null),
  gridRef: colourRefSchema.nullable().default(null),
  unit: boardUnitSchema,
  unitScale: z.number().positive().max(1_000_000),
  folderId: z.string().min(1).nullable().default(null),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const BOARD_NODE_TYPES = ['text', 'image', 'container', 'card', 'file', 'link'] as const;
export const boardNodeTypeSchema = z.enum(BOARD_NODE_TYPES);

export const ITEM_SHAPES = ['rectangle', 'rounded', 'ellipse', 'diamond', 'pill'] as const;
export const STROKE_STYLES = ['solid', 'dashed', 'dotted'] as const;
export const FONT_WEIGHTS = ['normal', 'medium', 'bold'] as const;
export const TEXT_ALIGNS = ['left', 'center', 'right'] as const;
export const VERTICAL_ALIGNS = ['top', 'middle', 'bottom'] as const;
export const IMAGE_FITS = ['cover', 'contain', 'fill'] as const;

export const strokeStyleSchema = z.enum(STROKE_STYLES);

export const itemStyleSchema = z.object({
  shape: z.enum(ITEM_SHAPES).optional(),
  fill: colourValueSchema.nullable().optional(),
  stroke: colourValueSchema.nullable().optional(),
  strokeWidth: z.number().min(0).max(32).optional(),
  strokeStyle: strokeStyleSchema.optional(),
  radius: z.number().min(0).max(400).optional(),
  opacity: z.number().min(0).max(1).optional(),
  shadow: z.boolean().optional(),
  padding: z.number().min(0).max(200).optional(),
  textColour: colourValueSchema.nullable().optional(),
  fontSize: z.number().min(6).max(400).optional(),
  fontWeight: z.enum(FONT_WEIGHTS).optional(),
  align: z.enum(TEXT_ALIGNS).optional(),
  verticalAlign: z.enum(VERTICAL_ALIGNS).optional(),
});

export const cardValueSchema = z.union([
  z.string().max(5000),
  z.number(),
  z.boolean(),
  z.array(z.string().max(80)).max(50),
  z.null(),
]);

const itemDataSchema = z.object({
  style: itemStyleSchema.default({}),
  name: z.string().max(80).default(''),
  locked: z.boolean().default(false),
  hidden: z.boolean().default(false),
  dock: z.string().min(1).nullable().default(null),
  rotation: z.number().min(0).max(360).default(0),
});

export const textDataSchema = itemDataSchema.extend({
  text: z.string().max(20_000).default(''),
});

export const imageDataSchema = itemDataSchema.extend({
  assetId: z.string().min(1).nullable().default(null),
  fit: z.enum(IMAGE_FITS).default('contain'),
  alt: z.string().max(200).default(''),
});

export const containerDataSchema = itemDataSchema.extend({
  title: z.string().max(80).default(''),
  showTitle: z.boolean().default(true),
});

export const cardDataSchema = itemDataSchema.extend({
  templateId: z.string().min(1).nullable().default(null),
  values: z.record(z.string(), cardValueSchema).default({}),
});

export const fileDataSchema = itemDataSchema.extend({
  assetId: z.string().min(1).nullable().default(null),
});

export const BOARD_LINK_KINDS = ['board', 'palette'] as const;
export const boardLinkSchema = z.object({ kind: z.enum(BOARD_LINK_KINDS), id: z.string().min(1) });
export type BoardLink = z.infer<typeof boardLinkSchema>;

export const linkDataSchema = itemDataSchema.extend({
  target: boardLinkSchema.nullable().default(null),
});

export const itemDataSchemas = {
  text: textDataSchema,
  image: imageDataSchema,
  container: containerDataSchema,
  card: cardDataSchema,
  file: fileDataSchema,
  link: linkDataSchema,
} as const;

export const boardNodeSchema = z.object({
  id: z.string().min(1),
  boardId: z.string().min(1),
  parentId: z.string().min(1).nullable().default(null),
  type: boardNodeTypeSchema,
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  z: z.number().int(),
  data: z.record(z.string(), z.unknown()).default({}),
});

export const EDGE_MARKERS = ['none', 'arrow', 'arrowClosed', 'circle'] as const;
export const EDGE_PATHS = ['bezier', 'straight', 'step', 'smoothstep'] as const;
export const EDGE_HANDLES = ['top', 'right', 'bottom', 'left'] as const;

export const edgeDataSchema = z.object({
  sourceHandle: z.enum(EDGE_HANDLES).nullable().default(null),
  targetHandle: z.enum(EDGE_HANDLES).nullable().default(null),
  label: z.string().max(200).default(''),
  colour: colourValueSchema.nullable().default(null),
  width: z.number().min(0.5).max(24).default(2),
  dash: strokeStyleSchema.default('solid'),
  path: z.enum(EDGE_PATHS).default('bezier'),
  startMarker: z.enum(EDGE_MARKERS).default('none'),
  endMarker: z.enum(EDGE_MARKERS).default('arrowClosed'),
  animated: z.boolean().default(false),
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
  gridColor: hexColorSchema.optional(),
  backgroundRef: colourRefSchema.nullable().optional(),
  gridRef: colourRefSchema.nullable().optional(),
  unit: boardUnitSchema.optional(),
  unitScale: boardSchema.shape.unitScale.optional(),
});

export const boardPatchSchema = z
  .object({
    name: boardSchema.shape.name,
    backgroundColor: hexColorSchema,
    gridColor: hexColorSchema,
    backgroundRef: colourRefSchema.nullable(),
    gridRef: colourRefSchema.nullable(),
    unit: boardUnitSchema,
    unitScale: boardSchema.shape.unitScale,
    folderId: z.string().min(1).nullable(),
  })
  .partial();

export const boardChangesSchema = z.object({
  upsertNodes: z.array(boardNodeSchema).default([]),
  removeNodeIds: z.array(z.string().min(1)).default([]),
  upsertEdges: z.array(boardEdgeSchema).default([]),
  removeEdgeIds: z.array(z.string().min(1)).default([]),
});

export const DEFAULT_BOARD_BACKGROUND = '#f4f4f5';
export const DEFAULT_BOARD_GRID = '#808080';
export const DEFAULT_STICKY_FILL = '#fde68a';
export const MIN_ITEM_SIZE = { width: 20, height: 20 };
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
export type ItemStyle = z.infer<typeof itemStyleSchema>;
export type CardValue = z.infer<typeof cardValueSchema>;
export type EdgeData = z.infer<typeof edgeDataSchema>;
export type EdgeHandle = (typeof EDGE_HANDLES)[number];
export type EdgeMarker = (typeof EDGE_MARKERS)[number];
