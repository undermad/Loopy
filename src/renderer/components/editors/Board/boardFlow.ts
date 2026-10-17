import type { Edge, Node, Viewport } from '@xyflow/react';
import { DEFAULT_NOTE_SIZE, type BoardEdge, type BoardNode, type BoardSnapshot } from '@shared/board';

export const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 };

export function toFlowNodes(
  snapshot: BoardSnapshot,
  onNoteChange: (id: string, text: string) => void,
): Node[] {
  return snapshot.nodes.map((node) => ({
    id: node.id,
    type: node.type,
    position: { x: node.x, y: node.y },
    width: node.width,
    height: node.height,
    zIndex: node.z,
    data: {
      ...node.data,
      onChange: (text: string) => {
        onNoteChange(node.id, text);
      },
    },
  }));
}

export function toFlowEdges(snapshot: BoardSnapshot): Edge[] {
  return snapshot.edges.map((edge) => ({
    id: edge.id,
    source: edge.sourceId,
    target: edge.targetId,
    data: edge.data,
  }));
}

export function newNote(boardId: string, x: number, y: number, z: number): BoardNode {
  return {
    id: crypto.randomUUID(),
    boardId,
    type: 'note',
    x,
    y,
    width: DEFAULT_NOTE_SIZE.width,
    height: DEFAULT_NOTE_SIZE.height,
    z,
    data: { text: '' },
  };
}

export function newEdge(boardId: string, sourceId: string, targetId: string): BoardEdge {
  return { id: crypto.randomUUID(), boardId, sourceId, targetId, data: {} };
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
