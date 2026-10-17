import { createContext, useContext } from 'react';
import type { BoardEdge, BoardNode } from '@shared/board';

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
}

export const BoardActionsContext = createContext<BoardActions | null>(null);

export function useBoardActions(): BoardActions {
  const actions = useContext(BoardActionsContext);
  if (!actions) throw new Error('Board items need a BoardActionsContext');
  return actions;
}
