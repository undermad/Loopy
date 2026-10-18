import type { BoardEdge, BoardNode } from '@shared/board';
import { absoluteRect, createEdge, nextZ, type Rect } from './items';

export interface Guide {
  axis: 'x' | 'y';
  position: number;
  from: number;
  to: number;
}

export type Alignment = 'left' | 'centre' | 'right' | 'top' | 'middle' | 'bottom';
export type Side = 'left' | 'right' | 'top' | 'bottom';

const OPPOSITE: Record<Side, Side> = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' };

function stops(rect: Rect, axis: 'x' | 'y'): number[] {
  return axis === 'x'
    ? [rect.x, rect.x + rect.width / 2, rect.x + rect.width]
    : [rect.y, rect.y + rect.height / 2, rect.y + rect.height];
}

function bestOffset(moving: Rect, others: Rect[], axis: 'x' | 'y', threshold: number): number | null {
  let best: number | null = null;
  for (const other of others) {
    for (const from of stops(moving, axis)) {
      for (const to of stops(other, axis)) {
        const offset = to - from;
        if (Math.abs(offset) <= threshold && (best === null || Math.abs(offset) < Math.abs(best)))
          best = offset;
      }
    }
  }
  return best;
}

function linesFor(moving: Rect, others: Rect[], axis: 'x' | 'y'): Guide[] {
  const guides: Guide[] = [];
  for (const other of others) {
    for (const value of stops(moving, axis)) {
      if (!stops(other, axis).some((stop) => Math.abs(stop - value) < 0.5)) continue;
      const [start, end] =
        axis === 'x'
          ? [Math.min(moving.y, other.y), Math.max(moving.y + moving.height, other.y + other.height)]
          : [Math.min(moving.x, other.x), Math.max(moving.x + moving.width, other.x + other.width)];
      guides.push({ axis, position: value, from: start, to: end });
    }
  }
  return guides;
}

export function snapGuides(
  moving: Rect,
  others: Rect[],
  threshold: number,
): { dx: number; dy: number; guides: Guide[] } {
  const dx = bestOffset(moving, others, 'x', threshold) ?? 0;
  const dy = bestOffset(moving, others, 'y', threshold) ?? 0;
  const snapped = { ...moving, x: moving.x + dx, y: moving.y + dy };
  return { dx, dy, guides: [...linesFor(snapped, others, 'x'), ...linesFor(snapped, others, 'y')] };
}

function bounds(rects: Rect[]): Rect {
  const left = Math.min(...rects.map((rect) => rect.x));
  const top = Math.min(...rects.map((rect) => rect.y));
  const right = Math.max(...rects.map((rect) => rect.x + rect.width));
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function moveTo(node: BoardNode, rect: Rect, x: number, y: number): BoardNode {
  return { ...node, x: node.x + (x - rect.x), y: node.y + (y - rect.y) };
}

export function alignItems(ids: string[], nodes: BoardNode[], alignment: Alignment): BoardNode[] {
  const items = nodes.filter((node) => ids.includes(node.id));
  if (items.length < 2) return [];
  const rects = new Map(items.map((node) => [node.id, absoluteRect(node, nodes)]));
  const box = bounds([...rects.values()]);
  return items.flatMap((node) => {
    const rect = rects.get(node.id);
    if (!rect) return [];
    const x =
      alignment === 'left'
        ? box.x
        : alignment === 'centre'
          ? box.x + (box.width - rect.width) / 2
          : alignment === 'right'
            ? box.x + box.width - rect.width
            : rect.x;
    const y =
      alignment === 'top'
        ? box.y
        : alignment === 'middle'
          ? box.y + (box.height - rect.height) / 2
          : alignment === 'bottom'
            ? box.y + box.height - rect.height
            : rect.y;
    return x === rect.x && y === rect.y ? [] : [moveTo(node, rect, x, y)];
  });
}

export function distributeItems(
  ids: string[],
  nodes: BoardNode[],
  axis: 'horizontal' | 'vertical',
): BoardNode[] {
  const items = nodes.filter((node) => ids.includes(node.id));
  if (items.length < 3) return [];
  const horizontal = axis === 'horizontal';
  const placed = items
    .map((node) => ({ node, rect: absoluteRect(node, nodes) }))
    .sort((a, b) => (horizontal ? a.rect.x - b.rect.x : a.rect.y - b.rect.y));
  const box = bounds(placed.map((item) => item.rect));
  const total = placed.reduce((sum, item) => sum + (horizontal ? item.rect.width : item.rect.height), 0);
  const gap = ((horizontal ? box.width : box.height) - total) / (placed.length - 1);
  let cursor = horizontal ? box.x : box.y;
  return placed.flatMap(({ node, rect }) => {
    const x = horizontal ? cursor : rect.x;
    const y = horizontal ? rect.y : cursor;
    cursor += (horizontal ? rect.width : rect.height) + gap;
    return Math.abs(x - rect.x) < 0.01 && Math.abs(y - rect.y) < 0.01 ? [] : [moveTo(node, rect, x, y)];
  });
}

function emptyData(node: BoardNode): Record<string, unknown> {
  const { style, name: _name, locked: _locked, dock: _dock, hidden: _hidden, ...rest } = node.data;
  if (node.type === 'text') return { style, text: '' };
  if (node.type === 'container') return { ...rest, style, title: '' };
  if (node.type === 'card') return { style, templateId: rest['templateId'] ?? null, values: {} };
  return { style, ...rest };
}

export function quickCreate(
  source: BoardNode,
  side: Side,
  nodes: BoardNode[],
  gap = 48,
): { node: BoardNode; edge: BoardEdge } {
  const horizontal = side === 'left' || side === 'right';
  const direction = side === 'left' || side === 'top' ? -1 : 1;
  const node: BoardNode = {
    ...source,
    id: crypto.randomUUID(),
    x: horizontal ? source.x + direction * (source.width + gap) : source.x,
    y: horizontal ? source.y : source.y + direction * (source.height + gap),
    z: nextZ(nodes),
    data: structuredClone(emptyData(source)),
  };
  const edge = createEdge(source.boardId, source.id, node.id, {
    sourceHandle: side,
    targetHandle: OPPOSITE[side],
  });
  return { node, edge };
}
