import type { BoardNode } from '@shared/board';
import { absoluteRect, withData, type Point, type Rect } from './items';

export type DockSide = 'left' | 'right' | 'top' | 'bottom';

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface DockSnap {
  targetId: string;
  side: DockSide;
  dx: number;
  dy: number;
  segment: Segment;
}

export interface Seam {
  a: string;
  b: string;
  point: Point;
}

const MIN_OVERLAP = 0.3;
const TOUCH = 1;

function dockOf(node: BoardNode): string | null {
  const dock = node.data['dock'];
  return typeof dock === 'string' && dock ? dock : null;
}

function overlap(start1: number, end1: number, start2: number, end2: number): number {
  return Math.min(end1, end2) - Math.max(start1, start2);
}

function alignOffset(
  moving: number,
  movingSize: number,
  target: number,
  targetSize: number,
  threshold: number,
) {
  const options = [target - moving, target + targetSize - (moving + movingSize)];
  const best = options.reduce((a, b) => (Math.abs(b) < Math.abs(a) ? b : a));
  return Math.abs(best) <= threshold ? best : 0;
}

export function findDock(
  moving: Rect,
  candidates: { id: string; rect: Rect }[],
  threshold: number,
): DockSnap | null {
  let best: DockSnap | null = null;
  let bestGap = Infinity;
  for (const { id, rect } of candidates) {
    const vertical = overlap(moving.y, moving.y + moving.height, rect.y, rect.y + rect.height);
    const horizontal = overlap(moving.x, moving.x + moving.width, rect.x, rect.x + rect.width);
    const needV = Math.min(moving.height, rect.height) * MIN_OVERLAP;
    const needH = Math.min(moving.width, rect.width) * MIN_OVERLAP;
    const options: { side: DockSide; gap: number; axis: 'x' | 'y' }[] = [];
    if (vertical >= needV) {
      options.push({ side: 'right', gap: rect.x - (moving.x + moving.width), axis: 'x' });
      options.push({ side: 'left', gap: rect.x + rect.width - moving.x, axis: 'x' });
    }
    if (horizontal >= needH) {
      options.push({ side: 'bottom', gap: rect.y - (moving.y + moving.height), axis: 'y' });
      options.push({ side: 'top', gap: rect.y + rect.height - moving.y, axis: 'y' });
    }
    for (const option of options) {
      if (Math.abs(option.gap) > threshold || Math.abs(option.gap) >= bestGap) continue;
      const dx =
        option.axis === 'x' ? option.gap : alignOffset(moving.x, moving.width, rect.x, rect.width, threshold);
      const dy =
        option.axis === 'y'
          ? option.gap
          : alignOffset(moving.y, moving.height, rect.y, rect.height, threshold);
      const snapped = { x: moving.x + dx, y: moving.y + dy };
      const edge =
        option.side === 'right'
          ? rect.x
          : option.side === 'left'
            ? rect.x + rect.width
            : option.side === 'bottom'
              ? rect.y
              : rect.y + rect.height;
      const segment: Segment =
        option.axis === 'x'
          ? {
              x1: edge,
              x2: edge,
              y1: Math.max(snapped.y, rect.y),
              y2: Math.min(snapped.y + moving.height, rect.y + rect.height),
            }
          : {
              y1: edge,
              y2: edge,
              x1: Math.max(snapped.x, rect.x),
              x2: Math.min(snapped.x + moving.width, rect.x + rect.width),
            };
      best = { targetId: id, side: option.side, dx, dy, segment };
      bestGap = Math.abs(option.gap);
    }
  }
  return best;
}

export function dockCluster(id: string, nodes: BoardNode[]): string[] {
  const node = nodes.find((candidate) => candidate.id === id);
  const dock = node ? dockOf(node) : null;
  if (!dock) return [id];
  return nodes.filter((candidate) => dockOf(candidate) === dock).map((candidate) => candidate.id);
}

export function dockItems(moverIds: string[], targetId: string, nodes: BoardNode[]): BoardNode[] {
  const target = nodes.find((node) => node.id === targetId);
  if (!target) return [];
  const movers = nodes.filter((node) => moverIds.includes(node.id));
  const docks = new Set([target, ...movers].map(dockOf).filter((dock): dock is string => dock !== null));
  const dock = dockOf(target) ?? movers.map(dockOf).find((value) => value !== null) ?? crypto.randomUUID();
  return nodes
    .filter((node) => node.id === targetId || moverIds.includes(node.id) || docks.has(dockOf(node) ?? ''))
    .filter((node) => dockOf(node) !== dock)
    .map((node) => withData(node, { dock }));
}

function settle(nodes: BoardNode[], changed: Map<string, string | null>): BoardNode[] {
  const after = (node: BoardNode) => (changed.has(node.id) ? (changed.get(node.id) ?? null) : dockOf(node));
  const counts = new Map<string, number>();
  for (const node of nodes) {
    const dock = after(node);
    if (dock) counts.set(dock, (counts.get(dock) ?? 0) + 1);
  }
  for (const node of nodes) {
    const dock = after(node);
    if (dock && counts.get(dock) === 1) changed.set(node.id, null);
  }
  return nodes
    .filter((node) => changed.has(node.id) && (changed.get(node.id) ?? null) !== dockOf(node))
    .map((node) => withData(node, { dock: changed.get(node.id) ?? null }));
}

export function undock(ids: string[], nodes: BoardNode[]): BoardNode[] {
  return settle(nodes, new Map(ids.map((id) => [id, null])));
}

function touching(a: Rect, b: Rect): Point | null {
  const vertical = overlap(a.y, a.y + a.height, b.y, b.y + b.height);
  const horizontal = overlap(a.x, a.x + a.width, b.x, b.x + b.width);
  const middleY = (Math.max(a.y, b.y) + Math.min(a.y + a.height, b.y + b.height)) / 2;
  const middleX = (Math.max(a.x, b.x) + Math.min(a.x + a.width, b.x + b.width)) / 2;
  if (vertical > 0 && Math.abs(a.x + a.width - b.x) <= TOUCH) return { x: b.x, y: middleY };
  if (vertical > 0 && Math.abs(b.x + b.width - a.x) <= TOUCH) return { x: a.x, y: middleY };
  if (horizontal > 0 && Math.abs(a.y + a.height - b.y) <= TOUCH) return { x: middleX, y: b.y };
  if (horizontal > 0 && Math.abs(b.y + b.height - a.y) <= TOUCH) return { x: middleX, y: a.y };
  return null;
}

export function seams(clusterIds: string[], nodes: BoardNode[]): Seam[] {
  const members = nodes.filter((node) => clusterIds.includes(node.id));
  const rects = new Map(members.map((node) => [node.id, absoluteRect(node, nodes)]));
  const result: Seam[] = [];
  members.forEach((a, index) => {
    for (const b of members.slice(index + 1)) {
      const rectA = rects.get(a.id);
      const rectB = rects.get(b.id);
      const point = rectA && rectB ? touching(rectA, rectB) : null;
      if (point) result.push({ a: a.id, b: b.id, point });
    }
  });
  return result;
}

export function splitSeam(seam: Seam, nodes: BoardNode[]): BoardNode[] {
  const cluster = dockCluster(seam.a, nodes);
  const links = seams(cluster, nodes).filter(
    (link) => !(link.a === seam.a && link.b === seam.b) && !(link.a === seam.b && link.b === seam.a),
  );
  const component = new Set([seam.a]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const link of links) {
      const hasA = component.has(link.a);
      const hasB = component.has(link.b);
      if (hasA !== hasB) {
        component.add(hasA ? link.b : link.a);
        grew = true;
      }
    }
  }
  if (component.has(seam.b)) return undock([seam.b], nodes);
  const fresh = crypto.randomUUID();
  return settle(nodes, new Map(cluster.filter((id) => !component.has(id)).map((id) => [id, fresh])));
}
