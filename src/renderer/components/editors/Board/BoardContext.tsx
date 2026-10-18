import { createContext, useContext } from 'react';
import type { BoardEdge, BoardLink, BoardNode } from '@shared/board';
import type { Rect } from '@renderer/lib/board';

export interface DropTarget {
  id: string;
  kind: 'move' | 'add' | 'stay';
}

export interface BoardActions {
  boardId: string;
  textColour: string;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  updateNode: (node: BoardNode) => void;
  updateEdge: (edge: BoardEdge) => void;
  openTemplateEditor: (templateId: string | null) => void;
  dropTarget: DropTarget | null;
  dockedPeers: ReadonlySet<string>;
  wholeGroup: ReadonlySet<string>;
  snapping: boolean;
  keepRatio: boolean;
  previewRotation: (id: string, angle: number | null) => void;
  rotateItem: (node: BoardNode, angle: number) => void;
  previewGeometry: (id: string, rect: Rect | null) => void;
  setTransforming: (active: boolean) => void;
  gridStep: (zoom: number) => number;
  openLink: (link: BoardLink) => void;
}

export const BoardActionsContext = createContext<BoardActions | null>(null);

export function useBoardActions(): BoardActions {
  const actions = useContext(BoardActionsContext);
  if (!actions) throw new Error('Board items need a BoardActionsContext');
  return actions;
}
