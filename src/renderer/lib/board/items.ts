import {
  DEFAULT_STICKY_FILL,
  edgeDataSchema,
  itemDataSchemas,
  type BoardEdge,
  type BoardNode,
  type BoardNodeType,
  type EdgeData,
  type EdgeHandle,
  type ItemStyle,
} from '@shared/board';
import type { ColourValue } from '@shared/colours';

export type ItemPreset =
  'text' | 'sticky' | 'rectangle' | 'ellipse' | 'diamond' | 'image' | 'container' | 'card';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

const colour = (hex: string): ColourValue => ({ hex, ref: null });

const shapeStyle = (shape: ItemStyle['shape']): ItemStyle => ({
  shape,
  fill: colour('#ffffff'),
  stroke: colour('#334155'),
  strokeWidth: 2,
  padding: 12,
  align: 'center',
  verticalAlign: 'middle',
});

interface PresetDefinition {
  type: BoardNodeType;
  width: number;
  height: number;
  style: ItemStyle;
  data?: Record<string, unknown>;
}

const PRESETS: Record<ItemPreset, PresetDefinition> = {
  text: { type: 'text', width: 240, height: 48, style: { fontSize: 18, padding: 4 } },
  sticky: {
    type: 'text',
    width: 200,
    height: 120,
    style: { fill: colour(DEFAULT_STICKY_FILL), shadow: true, padding: 12, radius: 4 },
  },
  rectangle: { type: 'text', width: 160, height: 100, style: { ...shapeStyle('rounded'), radius: 8 } },
  ellipse: { type: 'text', width: 160, height: 100, style: shapeStyle('ellipse') },
  diamond: { type: 'text', width: 160, height: 120, style: shapeStyle('diamond') },
  image: { type: 'image', width: 240, height: 180, style: { radius: 4 } },
  container: { type: 'container', width: 480, height: 320, style: {}, data: { title: '' } },
  card: { type: 'card', width: 320, height: 360, style: {} },
};

export function presetSize(preset: ItemPreset): { width: number; height: number } {
  const { width, height } = PRESETS[preset];
  return { width, height };
}

export interface ResolvedStyle {
  shape: NonNullable<ItemStyle['shape']>;
  fill: ColourValue | null;
  stroke: ColourValue | null;
  strokeWidth: number;
  strokeStyle: NonNullable<ItemStyle['strokeStyle']>;
  radius: number;
  opacity: number;
  shadow: boolean;
  padding: number;
  textColour: ColourValue | null;
  fontSize: number;
  fontWeight: NonNullable<ItemStyle['fontWeight']>;
  align: NonNullable<ItemStyle['align']>;
  verticalAlign: NonNullable<ItemStyle['verticalAlign']>;
}

const BASE_STYLE: ResolvedStyle = {
  shape: 'rectangle',
  fill: null,
  stroke: null,
  strokeWidth: 0,
  strokeStyle: 'solid',
  radius: 0,
  opacity: 1,
  shadow: false,
  padding: 8,
  textColour: null,
  fontSize: 14,
  fontWeight: 'normal',
  align: 'left',
  verticalAlign: 'top',
};

const TYPE_STYLE: Record<BoardNodeType, Partial<ResolvedStyle>> = {
  text: {},
  image: { padding: 0 },
  container: {
    fill: colour('#ffffff'),
    stroke: colour('#cbd5e1'),
    strokeWidth: 1,
    radius: 8,
    padding: 12,
    fontWeight: 'bold',
  },
  card: {
    fill: colour('#ffffff'),
    stroke: colour('#cbd5e1'),
    strokeWidth: 1,
    radius: 10,
    shadow: true,
    padding: 12,
  },
};

export function resolveItemStyle(type: BoardNodeType, ...layers: (ItemStyle | undefined)[]): ResolvedStyle {
  const resolved: ResolvedStyle = { ...BASE_STYLE, ...TYPE_STYLE[type] };
  for (const layer of layers) {
    if (!layer) continue;
    for (const [key, value] of Object.entries(layer)) {
      if (value !== undefined) (resolved as unknown as Record<string, unknown>)[key] = value;
    }
  }
  return resolved;
}

export function itemData<T extends BoardNodeType>(
  node: Pick<BoardNode, 'type' | 'data'> & { type: T },
): ReturnType<(typeof itemDataSchemas)[T]['parse']> {
  const schema = itemDataSchemas[node.type];
  const parsed = schema.safeParse(node.data);
  return (parsed.success ? parsed.data : schema.parse({})) as ReturnType<
    (typeof itemDataSchemas)[T]['parse']
  >;
}

export function edgeData(edge: Pick<BoardEdge, 'data'>): EdgeData {
  const parsed = edgeDataSchema.safeParse(edge.data);
  return parsed.success ? parsed.data : edgeDataSchema.parse({});
}

export function nextZ(nodes: Pick<BoardNode, 'z'>[]): number {
  return nodes.reduce((max, node) => Math.max(max, node.z), 0) + 1;
}

export interface CreateItemOptions {
  boardId: string;
  preset: ItemPreset;
  rect: Point & Partial<Pick<Rect, 'width' | 'height'>>;
  z: number;
  parentId?: string | null;
  data?: Record<string, unknown>;
}

export function createItem({
  boardId,
  preset,
  rect,
  z,
  parentId = null,
  data = {},
}: CreateItemOptions): BoardNode {
  const definition = PRESETS[preset];
  return {
    id: crypto.randomUUID(),
    boardId,
    parentId,
    type: definition.type,
    x: rect.x,
    y: rect.y,
    width: Math.max(1, rect.width ?? definition.width),
    height: Math.max(1, rect.height ?? definition.height),
    z,
    data: { ...definition.data, style: { ...definition.style }, ...data },
  };
}

export function createEdge(
  boardId: string,
  sourceId: string,
  targetId: string,
  data: Partial<EdgeData> = {},
): BoardEdge {
  return { id: crypto.randomUUID(), boardId, sourceId, targetId, data: { ...data } };
}

export function withData(node: BoardNode, patch: Record<string, unknown>): BoardNode {
  return { ...node, data: { ...node.data, ...patch } };
}

export function withStyle(node: BoardNode, patch: ItemStyle): BoardNode {
  const current = (node.data['style'] ?? {}) as ItemStyle;
  return withData(node, { style: { ...current, ...patch } });
}

export function absolutePosition(node: Pick<BoardNode, 'x' | 'y' | 'parentId'>, nodes: BoardNode[]): Point {
  let x = node.x;
  let y = node.y;
  let parentId = node.parentId;
  const seen = new Set<string>();
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = nodes.find((candidate) => candidate.id === parentId);
    if (!parent) break;
    x += parent.x;
    y += parent.y;
    parentId = parent.parentId;
  }
  return { x, y };
}

export function absoluteRect(node: BoardNode, nodes: BoardNode[]): Rect {
  return { ...absolutePosition(node, nodes), width: node.width, height: node.height };
}

export function descendants(id: string, nodes: BoardNode[]): string[] {
  const found: string[] = [];
  const queue = [id];
  while (queue.length > 0) {
    const current = queue.shift();
    for (const node of nodes) {
      if (node.parentId === current && !found.includes(node.id)) {
        found.push(node.id);
        queue.push(node.id);
      }
    }
  }
  return found;
}

function contains(rect: Rect, point: Point): boolean {
  return (
    point.x >= rect.x &&
    point.y >= rect.y &&
    point.x <= rect.x + rect.width &&
    point.y <= rect.y + rect.height
  );
}

function depth(node: BoardNode, nodes: BoardNode[]): number {
  let level = 0;
  let parentId = node.parentId;
  while (parentId && level < nodes.length) {
    level += 1;
    parentId = nodes.find((candidate) => candidate.id === parentId)?.parentId ?? null;
  }
  return level;
}

export function containerAt(point: Point, nodes: BoardNode[], exclude: string[] = []): BoardNode | null {
  const blocked = new Set(exclude.flatMap((id) => [id, ...descendants(id, nodes)]));
  const candidates = nodes.filter(
    (node) =>
      node.type === 'container' && !blocked.has(node.id) && contains(absoluteRect(node, nodes), point),
  );
  candidates.sort((a, b) => depth(b, nodes) - depth(a, nodes) || b.z - a.z);
  return candidates[0] ?? null;
}

export function reparent(node: BoardNode, parentId: string | null, nodes: BoardNode[]): BoardNode {
  if (node.parentId === parentId) return node;
  const absolute = absolutePosition(node, nodes);
  const parent = parentId ? nodes.find((candidate) => candidate.id === parentId) : null;
  const origin = parent ? absolutePosition(parent, nodes) : { x: 0, y: 0 };
  return { ...node, parentId: parent ? parent.id : null, x: absolute.x - origin.x, y: absolute.y - origin.y };
}

export function parentsFirst(nodes: BoardNode[]): BoardNode[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const ordered: BoardNode[] = [];
  const placed = new Set<string>();
  const place = (node: BoardNode, trail: Set<string>) => {
    if (placed.has(node.id) || trail.has(node.id)) return;
    trail.add(node.id);
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent) place(parent, trail);
    placed.add(node.id);
    ordered.push(node);
  };
  for (const node of nodes) place(node, new Set());
  return ordered;
}

export interface Duplicated {
  nodes: BoardNode[];
  edges: BoardEdge[];
  ids: string[];
}

export function duplicateItems(
  ids: string[],
  nodes: BoardNode[],
  edges: BoardEdge[],
  offset: Point = { x: 24, y: 24 },
): Duplicated {
  const roots = ids.filter((id) => {
    const node = nodes.find((candidate) => candidate.id === id);
    return node && !ids.some((other) => other !== id && descendants(other, nodes).includes(id));
  });
  const included = [...new Set(roots.flatMap((id) => [id, ...descendants(id, nodes)]))];
  const mapping = new Map(included.map((id) => [id, crypto.randomUUID()]));
  let z = nextZ(nodes);
  const copies = parentsFirst(nodes.filter((node) => mapping.has(node.id))).map((node) => {
    const isRoot = roots.includes(node.id);
    const parentId = node.parentId ? (mapping.get(node.parentId) ?? node.parentId) : null;
    const copy: BoardNode = {
      ...node,
      id: mapping.get(node.id) ?? node.id,
      parentId,
      x: isRoot ? node.x + offset.x : node.x,
      y: isRoot ? node.y + offset.y : node.y,
      z,
      data: structuredClone(node.data),
    };
    z += 1;
    return copy;
  });
  const edgeCopies = edges
    .filter((edge) => mapping.has(edge.sourceId) && mapping.has(edge.targetId))
    .map((edge) => ({
      ...edge,
      id: crypto.randomUUID(),
      sourceId: mapping.get(edge.sourceId) ?? edge.sourceId,
      targetId: mapping.get(edge.targetId) ?? edge.targetId,
      data: structuredClone(edge.data),
    }));
  return {
    nodes: copies,
    edges: edgeCopies,
    ids: roots.map((id) => mapping.get(id) ?? id),
  };
}

export function bringToFront(ids: string[], nodes: BoardNode[]): BoardNode[] {
  let z = nextZ(nodes);
  return nodes
    .filter((node) => ids.includes(node.id))
    .sort((a, b) => a.z - b.z)
    .map((node) => ({ ...node, z: z++ }));
}

export function sendToBack(ids: string[], nodes: BoardNode[]): BoardNode[] {
  const lowest = nodes.reduce((min, node) => Math.min(min, node.z), 0);
  const moving = nodes.filter((node) => ids.includes(node.id)).sort((a, b) => a.z - b.z);
  let z = lowest - moving.length;
  return moving.map((node) => ({ ...node, z: z++ }));
}

export function itemAt(point: Point, nodes: BoardNode[], exclude: string[] = []): BoardNode | null {
  const candidates = nodes.filter(
    (node) => !exclude.includes(node.id) && contains(absoluteRect(node, nodes), point),
  );
  candidates.sort((a, b) => effectiveZ(b, nodes) - effectiveZ(a, nodes));
  return candidates[0] ?? null;
}

export function effectiveZ(node: BoardNode, nodes: BoardNode[]): number {
  let z = node.z;
  let parentId = node.parentId;
  let level = 0;
  while (parentId && level < nodes.length) {
    const parent = nodes.find((candidate) => candidate.id === parentId);
    if (!parent) break;
    z = Math.max(z, parent.z + 1);
    parentId = parent.parentId;
    level += 1;
  }
  return z + level * 1000;
}

export function sidesBetween(from: Rect, to: Rect): { source: EdgeHandle; target: EdgeHandle } {
  const dx = to.x + to.width / 2 - (from.x + from.width / 2);
  const dy = to.y + to.height / 2 - (from.y + from.height / 2);
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? { source: 'right', target: 'left' } : { source: 'left', target: 'right' };
  }
  return dy >= 0 ? { source: 'bottom', target: 'top' } : { source: 'top', target: 'bottom' };
}

export function fitSize(width: number, height: number, max = 320): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: max, height: Math.round((max * 3) / 4) };
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export async function measureImage(url: string): Promise<{ width: number; height: number }> {
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return { width: image.naturalWidth, height: image.naturalHeight };
  } catch {
    return { width: 0, height: 0 };
  }
}

export function normaliseRect(from: Point, to: Point): Rect {
  return {
    x: Math.min(from.x, to.x),
    y: Math.min(from.y, to.y),
    width: Math.abs(to.x - from.x),
    height: Math.abs(to.y - from.y),
  };
}
