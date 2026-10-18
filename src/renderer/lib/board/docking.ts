import { MIN_ITEM_SIZE, type BoardNode } from '@shared/board';
import { absoluteRect, descendants, withData, type Point, type Rect } from './items';
import { normaliseAngle, rotatePoint, rotateVector, rotationOf } from './rotation';

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

export interface DockGroup {
  dock: string;
  ids: string[];
  rotation: number;
  rect: Rect;
}

export interface GroupTransform {
  rect: Rect;
  rotation: number;
}

export interface Seam {
  a: string;
  b: string;
  point: Point;
}

const MIN_OVERLAP = 0.3;
const TOUCH = 1;

export function dockOf(node: BoardNode): string | null {
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

function centreOf(rect: Rect): Point {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

function sharedRotation(members: BoardNode[]): number {
  const angles = new Set(members.map((node) => rotationOf(node.data)));
  return angles.size === 1 ? ([...angles][0] ?? 0) : 0;
}

export function seams(clusterIds: string[], nodes: BoardNode[]): Seam[] {
  const members = nodes.filter((node) => clusterIds.includes(node.id));
  const angle = sharedRotation(members);
  const first = members[0];
  const pivot = first ? centreOf(absoluteRect(first, nodes)) : { x: 0, y: 0 };
  const rects = new Map(
    members.map((node) => {
      const rect = absoluteRect(node, nodes);
      if (!angle) return [node.id, rect];
      const centre = rotatePoint(centreOf(rect), pivot, -angle);
      return [node.id, { ...rect, x: centre.x - rect.width / 2, y: centre.y - rect.height / 2 }];
    }),
  );
  const result: Seam[] = [];
  members.forEach((a, index) => {
    for (const b of members.slice(index + 1)) {
      const rectA = rects.get(a.id);
      const rectB = rects.get(b.id);
      const point = rectA && rectB ? touching(rectA, rectB) : null;
      if (point) result.push({ a: a.id, b: b.id, point: angle ? rotatePoint(point, pivot, angle) : point });
    }
  });
  return result;
}

export function carryContents(updated: BoardNode[], nodes: BoardNode[]): BoardNode[] {
  const changed = new Map(updated.map((node) => [node.id, node]));
  const after = () => nodes.map((node) => changed.get(node.id) ?? node);
  for (const next of updated) {
    const before = nodes.find((node) => node.id === next.id);
    if (!before) continue;
    const delta = rotationOf(next.data) - rotationOf(before.data);
    if (!delta) continue;
    const from = centreOf(absoluteRect(before, nodes));
    for (const id of descendants(next.id, nodes)) {
      if (changed.has(id) && !updated.some((node) => node.id === id)) continue;
      const child = nodes.find((node) => node.id === id);
      if (!child) continue;
      const current = after();
      const to = centreOf(absoluteRect(changed.get(next.id) ?? next, current));
      const centre = centreOf(absoluteRect(child, nodes));
      const moved = rotateVector({ x: centre.x - from.x, y: centre.y - from.y }, delta);
      const parent = current.find((node) => node.id === child.parentId);
      const origin = parent ? absoluteRect(parent, current) : { x: 0, y: 0 };
      changed.set(id, {
        ...child,
        x: to.x + moved.x - child.width / 2 - origin.x,
        y: to.y + moved.y - child.height / 2 - origin.y,
        data: { ...child.data, rotation: normaliseAngle(rotationOf(child.data) + delta) },
      });
    }
  }
  return [...changed.values()];
}

export function dockGroup(dock: string, nodes: BoardNode[]): DockGroup | null {
  const members = nodes.filter((node) => dockOf(node) === dock);
  const first = members[0];
  if (!first || members.length < 2) return null;
  const rotation = sharedRotation(members);
  const pivot = centreOf(absoluteRect(first, nodes));
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const member of members) {
    const rect = absoluteRect(member, nodes);
    const centre = rotatePoint(centreOf(rect), pivot, -rotation);
    const turn = rotationOf(member.data) - rotation;
    for (const corner of [
      { x: -rect.width / 2, y: -rect.height / 2 },
      { x: rect.width / 2, y: -rect.height / 2 },
      { x: rect.width / 2, y: rect.height / 2 },
      { x: -rect.width / 2, y: rect.height / 2 },
    ]) {
      const point = rotateVector(corner, turn);
      minX = Math.min(minX, centre.x + point.x);
      minY = Math.min(minY, centre.y + point.y);
      maxX = Math.max(maxX, centre.x + point.x);
      maxY = Math.max(maxY, centre.y + point.y);
    }
  }
  const width = maxX - minX;
  const height = maxY - minY;
  const centre = rotatePoint({ x: minX + width / 2, y: minY + height / 2 }, pivot, rotation);
  return {
    dock,
    ids: members.map((member) => member.id),
    rotation,
    rect: { x: centre.x - width / 2, y: centre.y - height / 2, width, height },
  };
}

export function selectedDockGroup(selectedIds: string[], nodes: BoardNode[]): DockGroup | null {
  const first = nodes.find((node) => node.id === selectedIds[0]);
  const dock = first ? dockOf(first) : null;
  const group = dock ? dockGroup(dock, nodes) : null;
  if (group?.ids.length !== selectedIds.length) return null;
  return group.ids.every((id) => selectedIds.includes(id)) ? group : null;
}

export function transformGroup(group: DockGroup, next: GroupTransform, nodes: BoardNode[]): BoardNode[] {
  const scaleX = group.rect.width > 0 ? next.rect.width / group.rect.width : 1;
  const scaleY = group.rect.height > 0 ? next.rect.height / group.rect.height : 1;
  const from = centreOf(group.rect);
  const to = centreOf(next.rect);
  const delta = next.rotation - group.rotation;
  const members = nodes
    .filter((node) => group.ids.includes(node.id))
    .map((member) => {
      const rect = absoluteRect(member, nodes);
      const centre = centreOf(rect);
      const offset = rotateVector({ x: centre.x - from.x, y: centre.y - from.y }, -group.rotation);
      const moved = rotateVector({ x: offset.x * scaleX, y: offset.y * scaleY }, next.rotation);
      const across = Math.round(normaliseAngle(rotationOf(member.data) - group.rotation) / 90) % 2 === 1;
      const width = Math.max(MIN_ITEM_SIZE.width, member.width * (across ? scaleY : scaleX));
      const height = Math.max(MIN_ITEM_SIZE.height, member.height * (across ? scaleX : scaleY));
      return {
        ...member,
        x: member.x + to.x + moved.x - width / 2 - rect.x,
        y: member.y + to.y + moved.y - height / 2 - rect.y,
        width,
        height,
        data: { ...member.data, rotation: normaliseAngle(rotationOf(member.data) + delta) },
      };
    });
  return carryContents(members, nodes);
}

export function rotateCluster(id: string, angle: number, nodes: BoardNode[]): BoardNode[] {
  const node = nodes.find((candidate) => candidate.id === id);
  if (!node) return [];
  const dock = dockOf(node);
  const group = dock ? dockGroup(dock, nodes) : null;
  if (!group) return carryContents([withData(node, { rotation: normaliseAngle(angle) })], nodes);
  const rotation = group.rotation + angle - rotationOf(node.data);
  return transformGroup(group, { rect: group.rect, rotation }, nodes);
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

export function settleDocks(nodes: BoardNode[], docks: Iterable<string>): BoardNode[] {
  const updates: BoardNode[] = [];
  for (const dock of new Set(docks)) {
    const members = nodes.filter((node) => dockOf(node) === dock);
    const links = seams(
      members.map((member) => member.id),
      nodes,
    );
    const seen = new Set<string>();
    let kept = false;
    for (const member of members) {
      if (seen.has(member.id)) continue;
      const group = [member.id];
      seen.add(member.id);
      for (const current of group) {
        for (const link of links) {
          const other = link.a === current ? link.b : link.b === current ? link.a : null;
          if (other && !seen.has(other)) {
            seen.add(other);
            group.push(other);
          }
        }
      }
      let next: string | null = null;
      if (group.length > 1) {
        next = kept ? crypto.randomUUID() : dock;
        kept = true;
      }
      for (const id of group) {
        const node = members.find((candidate) => candidate.id === id);
        if (node && dockOf(node) !== next) updates.push(withData(node, { dock: next }));
      }
    }
  }
  return updates;
}
