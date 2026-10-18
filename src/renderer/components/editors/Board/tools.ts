import type { ItemPreset } from '@renderer/lib/board';

export const BOARD_TOOLS = [
  'select',
  'hand',
  'text',
  'sticky',
  'rectangle',
  'ellipse',
  'diamond',
  'container',
  'card',
  'arrow',
] as const;

export type BoardTool = (typeof BOARD_TOOLS)[number];

export const TOOL_KEYS: Record<BoardTool, string> = {
  select: 'V',
  hand: 'H',
  text: 'T',
  sticky: 'N',
  rectangle: 'R',
  ellipse: 'O',
  diamond: 'D',
  container: 'F',
  card: 'C',
  arrow: 'A',
};

export const SHAPE_TOOLS = ['rectangle', 'ellipse', 'diamond'] as const;
export type ShapeTool = (typeof SHAPE_TOOLS)[number];

const PRESET_BY_TOOL: Partial<Record<BoardTool, ItemPreset>> = {
  text: 'text',
  sticky: 'sticky',
  rectangle: 'rectangle',
  ellipse: 'ellipse',
  diamond: 'diamond',
  container: 'container',
  card: 'card',
};

export function presetForTool(tool: BoardTool): ItemPreset | null {
  return PRESET_BY_TOOL[tool] ?? null;
}

export function readTool(state: Record<string, unknown>): BoardTool {
  return BOARD_TOOLS.find((tool) => tool === state['tool']) ?? 'select';
}

export function readShape(state: Record<string, unknown>): ShapeTool {
  return SHAPE_TOOLS.find((shape) => shape === state['shape']) ?? 'rectangle';
}

export function toolForKey(key: string): BoardTool | null {
  const upper = key.toUpperCase();
  return BOARD_TOOLS.find((tool) => TOOL_KEYS[tool] === upper) ?? null;
}
