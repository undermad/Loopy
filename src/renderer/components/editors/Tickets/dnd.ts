import type { TicketsSnapshot } from '@shared/tickets';
import { ticketsInState } from '@renderer/lib/tickets';

export interface TicketDragData {
  type: 'ticket';
  id: string;
  stateId: string | null;
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
export type Edge = 'top' | 'bottom';

export function isTicketDrag(
  data: Record<string | symbol, unknown>,
): data is Record<string | symbol, unknown> & TicketDragData {
  return data['type'] === 'ticket' && typeof data['id'] === 'string';
}

export function asDropData(data: Record<string | symbol, unknown>): DropData | null {
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
