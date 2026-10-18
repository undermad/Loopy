import type { BoardNode } from '@shared/board';
import { dockCluster } from './docking';
import { itemAt, type Point } from './items';

export function enteredScopes(selectedIds: string[], nodes: BoardNode[]): Set<string> {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const entered = new Set<string>();
  for (const id of selectedIds) {
    let current = byId.get(id);
    while (current && !entered.has(current.id)) {
      entered.add(current.id);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
  }
  return entered;
}

export function isReachable(node: Pick<BoardNode, 'parentId'>, entered: Set<string>): boolean {
  return node.parentId === null || entered.has(node.parentId);
}

export function parentSelection(selectedIds: string[], nodes: BoardNode[]): string[] {
  const parents = selectedIds
    .map((id) => nodes.find((node) => node.id === id)?.parentId ?? null)
    .filter((id): id is string => id !== null);
  return [...new Set(parents)];
}

export function childSelection(selectedIds: string[], nodes: BoardNode[]): string[] {
  const children = nodes.filter((node) => node.parentId !== null && selectedIds.includes(node.parentId));
  return children.length > 0 ? children.map((node) => node.id) : selectedIds;
}

export function drillTarget(point: Point, scopeId: string, nodes: BoardNode[]): BoardNode | null {
  const outside = nodes.filter((node) => node.parentId !== scopeId).map((node) => node.id);
  return itemAt(point, nodes, outside);
}

export function clusterSelection(clicked: string, previous: string[], nodes: BoardNode[]): string[] {
  const group = dockCluster(clicked, nodes);
  if (group.length < 2) return [clicked];
  const whole = previous.length === group.length && group.every((id) => previous.includes(id));
  const inside = previous.length === 1 && group.includes(previous[0] ?? '');
  return whole || inside ? [clicked] : group;
}
