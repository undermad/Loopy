import type { BoardNode } from '@shared/board';

export interface LayerRow {
  node: BoardNode;
  depth: number;
  hasChildren: boolean;
}

function siblings(parentId: string | null, nodes: BoardNode[]): BoardNode[] {
  return nodes
    .filter((node) => node.parentId === parentId)
    .sort((a, b) => a.z - b.z || a.id.localeCompare(b.id));
}

function renumber(before: BoardNode[], after: BoardNode[]): BoardNode[] {
  const values = before.map((node) => node.z);
  const base = before[0]?.z ?? 0;
  const slots = new Set(values).size === values.length ? values : values.map((_, index) => base + index);
  return after.flatMap((node, index) => {
    const z = slots[index] ?? node.z;
    const original = before.find((candidate) => candidate.id === node.id);
    return z === original?.z ? [] : [{ ...node, z }];
  });
}

function step(ids: string[], nodes: BoardNode[], direction: 1 | -1): BoardNode[] {
  const parents = new Set(nodes.filter((node) => ids.includes(node.id)).map((node) => node.parentId));
  return [...parents].flatMap((parentId) => {
    const before = siblings(parentId, nodes);
    const order = [...before];
    const indexes = order.map((_, index) => index);
    if (direction === 1) indexes.reverse();
    for (const index of indexes) {
      const node = order[index];
      const other = order[index + direction];
      if (!node || !other || !ids.includes(node.id) || ids.includes(other.id)) continue;
      order[index] = other;
      order[index + direction] = node;
    }
    return renumber(before, order);
  });
}

export function bringForward(ids: string[], nodes: BoardNode[]): BoardNode[] {
  return step(ids, nodes, 1);
}

export function sendBackward(ids: string[], nodes: BoardNode[]): BoardNode[] {
  return step(ids, nodes, -1);
}

export function moveLayer(id: string, index: number, nodes: BoardNode[]): BoardNode[] {
  const node = nodes.find((candidate) => candidate.id === id);
  if (!node) return [];
  const before = siblings(node.parentId, nodes);
  const order = before.filter((candidate) => candidate.id !== id);
  order.splice(Math.max(0, Math.min(order.length, index)), 0, node);
  return renumber(before, order);
}

export function layerPosition(id: string, nodes: BoardNode[]): { index: number; count: number } {
  const node = nodes.find((candidate) => candidate.id === id);
  if (!node) return { index: 0, count: 0 };
  const list = siblings(node.parentId, nodes);
  return { index: list.findIndex((candidate) => candidate.id === id), count: list.length };
}

export function layerRows(nodes: BoardNode[], collapsed: ReadonlySet<string> = new Set()): LayerRow[] {
  const rows: LayerRow[] = [];
  const visit = (parentId: string | null, depth: number) => {
    for (const node of siblings(parentId, nodes).reverse()) {
      const hasChildren = nodes.some((candidate) => candidate.parentId === node.id);
      rows.push({ node, depth, hasChildren });
      if (hasChildren && !collapsed.has(node.id)) visit(node.id, depth + 1);
    }
  };
  visit(null, 0);
  return rows;
}
