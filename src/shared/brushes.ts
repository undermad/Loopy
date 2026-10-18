import { z } from 'zod';
import { colourValueSchema } from './colours';

export const BRUSH_TOOLS = ['brush', 'eraser'] as const;
export const BRUSH_TIPS = ['round', 'square'] as const;
export const BRUSH_GRAINS = ['none', 'paper', 'rough'] as const;
export const BRUSH_CONTROLS = ['off', 'pressure', 'tilt'] as const;

export type BrushTool = (typeof BRUSH_TOOLS)[number];
export type BrushGrain = (typeof BRUSH_GRAINS)[number];

function dynamicSchema(max: number) {
  return z
    .object({
      amount: z.number().min(0).max(max).default(0),
      control: z.enum(BRUSH_CONTROLS).default('off'),
    })
    .prefault({});
}

export const brushSettingsSchema = z.object({
  size: z.number().min(0.5).max(1000).default(12),
  opacity: z.number().min(0).max(1).default(1),
  flow: z.number().min(0.01).max(1).default(1),
  tip: z.enum(BRUSH_TIPS).default('round'),
  hardness: z.number().min(0).max(1).default(1),
  roundness: z.number().min(0.05).max(1).default(1),
  angle: z.number().min(0).max(360).default(0),
  spacing: z.number().min(0.01).max(2).default(0.1),
  smoothing: z.number().min(0).max(1).default(0),
  minSize: z.number().min(0).max(1).default(0),
  sizeJitter: dynamicSchema(1),
  opacityJitter: dynamicSchema(1),
  angleJitter: dynamicSchema(1),
  scatter: dynamicSchema(5),
  count: z.number().int().min(1).max(16).default(1),
  grain: z.enum(BRUSH_GRAINS).default('none'),
  grainScale: z.number().min(0.1).max(4).default(1),
  grainDepth: z.number().min(0).max(1).default(0.5),
});

export type BrushSettings = z.infer<typeof brushSettingsSchema>;
type BrushSettingsInput = z.input<typeof brushSettingsSchema>;

export interface BrushPreset {
  id: string;
  tool: BrushTool;
  settings: BrushSettingsInput;
}

export const BRUSH_PRESETS: readonly BrushPreset[] = [
  { id: 'pen', tool: 'brush', settings: { size: 4, spacing: 0.05, smoothing: 0.35 } },
  {
    id: 'pencil',
    tool: 'brush',
    settings: {
      size: 3,
      hardness: 0.85,
      opacity: 0.9,
      flow: 0.7,
      smoothing: 0.15,
      grain: 'paper',
      grainDepth: 0.7,
    },
  },
  {
    id: 'marker',
    tool: 'brush',
    settings: {
      size: 18,
      tip: 'square',
      roundness: 0.35,
      angle: 45,
      hardness: 0.9,
      opacity: 0.6,
      spacing: 0.04,
      smoothing: 0.2,
    },
  },
  { id: 'hard-round', tool: 'brush', settings: { size: 16 } },
  { id: 'soft-round', tool: 'brush', settings: { size: 48, hardness: 0, flow: 0.6 } },
  { id: 'airbrush', tool: 'brush', settings: { size: 80, hardness: 0, flow: 0.08, spacing: 0.05 } },
  { id: 'ink', tool: 'brush', settings: { size: 6, hardness: 0.95, spacing: 0.03, smoothing: 0.7 } },
  {
    id: 'chalk',
    tool: 'brush',
    settings: {
      size: 22,
      hardness: 0.6,
      roundness: 0.8,
      flow: 0.8,
      spacing: 0.15,
      sizeJitter: { amount: 0.2 },
      angleJitter: { amount: 1 },
      grain: 'rough',
      grainScale: 1.5,
      grainDepth: 0.9,
    },
  },
  {
    id: 'splatter',
    tool: 'brush',
    settings: {
      size: 6,
      hardness: 0.8,
      spacing: 0.5,
      count: 6,
      scatter: { amount: 2.5 },
      sizeJitter: { amount: 0.8 },
      opacityJitter: { amount: 0.5 },
    },
  },
  {
    id: 'highlighter',
    tool: 'brush',
    settings: { size: 24, tip: 'square', roundness: 0.4, opacity: 0.35, spacing: 0.04 },
  },
  { id: 'hard-eraser', tool: 'eraser', settings: { size: 24 } },
  { id: 'soft-eraser', tool: 'eraser', settings: { size: 64, hardness: 0, flow: 0.5 } },
];

const DEFAULT_BRUSH_PRESET: Record<BrushTool, string> = { brush: 'pen', eraser: 'hard-eraser' };

export function findBrushPreset(id: string): BrushPreset | null {
  return BRUSH_PRESETS.find((preset) => preset.id === id) ?? null;
}

export function presetSettings(id: string): BrushSettings {
  return brushSettingsSchema.parse(findBrushPreset(id)?.settings ?? {});
}

function toolStateSchema(tool: BrushTool) {
  return z
    .object({
      preset: z.string().min(1).default(DEFAULT_BRUSH_PRESET[tool]),
      settings: brushSettingsSchema.default(() => presetSettings(DEFAULT_BRUSH_PRESET[tool])),
    })
    .prefault({});
}

export const DEFAULT_BRUSH_COLOUR = '#1f2937';

export const brushStateSchema = z.object({
  colour: colourValueSchema.default({ hex: DEFAULT_BRUSH_COLOUR, ref: null }),
  brush: toolStateSchema('brush'),
  eraser: toolStateSchema('eraser'),
});

export type BrushState = z.infer<typeof brushStateSchema>;
