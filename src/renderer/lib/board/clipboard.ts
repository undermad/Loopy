import { z } from 'zod';
import {
  boardEdgeSchema,
  boardNodeSchema,
  type BoardEdge,
  type BoardNode,
  type BoardTile,
} from '@shared/board';
import { absolutePosition, copyTiles, descendants, itemData, nextZ, parentsFirst, type Point } from './items';

export const BOARD_CLIPBOARD_TYPE = 'application/x-loopy-board';

const clipSchema = z.object({
  version: z.literal(1),
  nodes: z.array(boardNodeSchema),
  edges: z.array(boardEdgeSchema),
});

export type BoardClip = z.infer<typeof clipSchema> & { tiles?: BoardTile[] };

export interface Pasted {
  nodes: BoardNode[];
  edges: BoardEdge[];
  tiles: BoardTile[];
  ids: string[];
}

export function copyItems(
  ids: string[],
  nodes: BoardNode[],
  edges: BoardEdge[],
  tiles: Record<string, BoardTile> = {},
): BoardClip {
  const roots = ids.filter(
    (id) => !ids.some((other) => other !== id && descendants(other, nodes).includes(id)),
  );
  const included = new Set(roots.flatMap((id) => [id, ...descendants(id, nodes)]));
  const copied = parentsFirst(nodes.filter((node) => included.has(node.id))).map((node) => {
    if (!roots.includes(node.id)) return node;
    const position = absolutePosition(node, nodes);
    return { ...node, parentId: null, x: position.x, y: position.y };
  });
  return {
    version: 1,
    nodes: copied,
    edges: edges.filter((edge) => included.has(edge.sourceId) && included.has(edge.targetId)),
    tiles: Object.values(tiles).filter((tile) => included.has(tile.nodeId)),
  };
}

export function clipText(clip: BoardClip): string {
  return clip.nodes
    .flatMap((node) => {
      if (node.type === 'text') return [itemData({ type: 'text', data: node.data }).text];
      if (node.type === 'container') return [itemData({ type: 'container', data: node.data }).title];
      return [itemData(node).name];
    })
    .filter((text) => text.trim())
    .join('\n\n');
}

let remembered: { text: string; clip: BoardClip } | null = null;

export function rememberClip(clip: BoardClip, fallback: string): string {
  const text = clipText(clip) || fallback;
  remembered = { text, clip };
  return text;
}

export function recallClip(text: string): BoardClip | null {
  return remembered?.text === text ? remembered.clip : null;
}

export function serialiseClip(clip: BoardClip): string {
  const { tiles: _tiles, ...rest } = clip;
  return JSON.stringify(rest);
}

export function parseClip(text: string): BoardClip | null {
  try {
    const parsed = clipSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function pasteItems(
  clip: BoardClip,
  boardId: string,
  at: Point | null,
  existing: BoardNode[],
): Pasted {
  const roots = clip.nodes.filter((node) => node.parentId === null);
  const left = Math.min(...roots.map((node) => node.x));
  const top = Math.min(...roots.map((node) => node.y));
  const offset = at ? { x: at.x - left, y: at.y - top } : { x: 24, y: 24 };
  const ids = new Map(clip.nodes.map((node) => [node.id, crypto.randomUUID()]));
  const docks = new Map<string, string>();
  let z = nextZ(existing);
  const nodes = clip.nodes.map((node) => {
    const root = node.parentId === null;
    const dock = itemData(node).dock;
    const data = structuredClone(node.data);
    if (dock) {
      if (!docks.has(dock)) docks.set(dock, crypto.randomUUID());
      data['dock'] = docks.get(dock);
    }
    const copy: BoardNode = {
      ...node,
      id: ids.get(node.id) ?? crypto.randomUUID(),
      boardId,
      parentId: node.parentId ? (ids.get(node.parentId) ?? null) : null,
      x: root ? node.x + offset.x : node.x,
      y: root ? node.y + offset.y : node.y,
      z,
      data,
    };
    z += 1;
    return copy;
  });
  const edges = clip.edges.map((edge) => ({
    ...edge,
    id: crypto.randomUUID(),
    boardId,
    sourceId: ids.get(edge.sourceId) ?? edge.sourceId,
    targetId: ids.get(edge.targetId) ?? edge.targetId,
    data: structuredClone(edge.data),
  }));
  const sources = new Map([...ids].map(([source, copy]) => [copy, source]));
  const tiles = copyTiles(
    sources,
    Object.fromEntries((clip.tiles ?? []).map((tile, index) => [index, tile])),
  );
  return { nodes, edges, tiles, ids: roots.map((node) => ids.get(node.id) ?? node.id) };
}
