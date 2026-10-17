import type { TicketsSnapshot } from '@shared/tickets';
import { ticketsInState } from '@renderer/lib/tickets';

export interface TicketDragData {
  type: 'ticket';
  id: string;
  stateId: string | null;
}

export interface StateDragData {
  type: 'state';
  id: string;
}

export interface CardDropData {
  type: 'card';
  id: string;
  stateId: string | null;
}

export interface ColumnDropData {
  type: 'column';
  stateId: string | null;
}

export type DropData = CardDropData | ColumnDropData;
export type Edge = 'top' | 'bottom' | 'left' | 'right';

type Data = Record<string | symbol, unknown>;

export function isTicketDrag(data: Data): data is Data & TicketDragData {
  return data['type'] === 'ticket' && typeof data['id'] === 'string';
}

export function isStateDrag(data: Data): data is Data & StateDragData {
  return data['type'] === 'state' && typeof data['id'] === 'string';
}

export function asDropData(data: Data): DropData | null {
  if (data['type'] === 'column')
    return { type: 'column', stateId: (data['stateId'] as string | null | undefined) ?? null };
  if (data['type'] === 'card' && typeof data['id'] === 'string') {
    return { type: 'card', id: data['id'], stateId: (data['stateId'] as string | null | undefined) ?? null };
  }
  return null;
}

export function targetIndex(
  snapshot: TicketsSnapshot,
  drag: TicketDragData,
  drop: DropData,
  edge: Edge | null,
): number {
  const column = ticketsInState(snapshot, drop.stateId).filter((ticket) => ticket.id !== drag.id);
  if (drop.type === 'column') return column.length;
  const index = column.findIndex((ticket) => ticket.id === drop.id);
  if (index < 0) return column.length;
  return edge === 'bottom' ? index + 1 : index;
}

export function columnTargetIndex(
  snapshot: TicketsSnapshot,
  dragId: string,
  overStateId: string,
  edge: Edge | null,
): number {
  const others = snapshot.states.filter((state) => state.id !== dragId);
  const index = others.findIndex((state) => state.id === overStateId);
  if (index < 0) return others.length;
  return edge === 'right' ? index + 1 : index;
}

export interface TicketPreview {
  kind: 'ticket';
  stateId: string | null;
  index: number;
}

export interface StatePreview {
  kind: 'state';
  index: number;
}

export type DragPreview = TicketPreview | StatePreview;
