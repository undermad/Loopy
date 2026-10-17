import type { Node, NodeChange, Viewport } from '@xyflow/react';
import type { BoardNode, BoardSnapshot } from '@shared/board';
import { edgeData, effectiveZ, parentsFirst } from '@renderer/lib/board';
import type { ArrowFlowEdge } from './ArrowEdge';
import type { ItemFlowNode } from './items/TextItem';

export const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 };

export function toFlowNodes(snapshot: BoardSnapshot): ItemFlowNode[] {
  return parentsFirst(snapshot.nodes).map((node) => ({
    id: node.id,
    type: node.type,
    position: { x: node.x, y: node.y },
    width: node.width,
    height: node.height,
    zIndex: effectiveZ(node, snapshot.nodes),
    ...(node.parentId ? { parentId: node.parentId } : {}),
    draggable: node.data['locked'] !== true,
    data: { node },
  }));
}

export function toFlowEdges(snapshot: BoardSnapshot): ArrowFlowEdge[] {
  return snapshot.edges.map((edge) => {
    const style = edgeData(edge);
    return {
      id: edge.id,
      type: 'arrow',
      source: edge.sourceId,
      target: edge.targetId,
      ...(style.sourceHandle ? { sourceHandle: style.sourceHandle } : {}),
      ...(style.targetHandle ? { targetHandle: style.targetHandle } : {}),
      animated: style.animated,
      data: { edge },
    };
  });
}

export function nodeFromFlow(
  original: BoardNode,
  flow: Pick<Node, 'position' | 'width' | 'height'>,
): BoardNode {
  return {
    ...original,
    x: flow.position.x,
    y: flow.position.y,
    width: flow.width ?? original.width,
    height: flow.height ?? original.height,
  };
}

export function readViewport(state: Record<string, unknown>): Viewport {
  const raw = state['viewport'];
  if (typeof raw !== 'object' || raw === null) return DEFAULT_VIEWPORT;
  const { x, y, zoom } = raw as Record<string, unknown>;
  return typeof x === 'number' && typeof y === 'number' && typeof zoom === 'number'
    ? { x, y, zoom }
    : DEFAULT_VIEWPORT;
}

export interface NodeCommit {
  updates: BoardNode[];
  removed: string[];
  moved: string[];
}

export function settleNodeChanges(
  changes: NodeChange[],
  next: Node[],
  original: BoardNode[],
  pending: Map<string, Node>,
): NodeCommit {
  const removed = changes.filter((change) => change.type === 'remove').map((change) => change.id);
  const settled: string[] = [];
  const moved: string[] = [];
  for (const change of changes) {
    if (change.type !== 'position' && change.type !== 'dimensions') continue;
    const flowNode = next.find((candidate) => candidate.id === change.id);
    if (flowNode) pending.set(change.id, flowNode);
    const finished = change.type === 'position' ? change.dragging === false : change.resizing === false;
    if (finished) {
      settled.push(change.id);
      if (change.type === 'position') moved.push(change.id);
    }
  }
  const updates = settled.flatMap((id) => {
    const flowNode = pending.get(id);
    const source = original.find((candidate) => candidate.id === id);
    pending.delete(id);
    return flowNode && source ? [nodeFromFlow(source, flowNode)] : [];
  });
  return { updates, removed, moved };
}
