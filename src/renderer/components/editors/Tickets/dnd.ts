import type { TicketsSnapshot } from '@shared/tickets';
import { boardTickets } from '@renderer/lib/tickets';

export const BACKLOG_KEY = 'backlog';

export type ColumnKey = string;

export type Orders = Record<ColumnKey, string[]>;

export interface TicketDragData {
  type: 'ticket';
  id: string;
  stateId: string | null;
}

export interface StateDragData {
  type: 'state';
  id: string;
}

export interface ColumnDropData {
  type: 'column';
  key: ColumnKey;
}

export type DragData = TicketDragData | StateDragData | ColumnDropData;

export function columnKey(id: string | null): ColumnKey {
  return id ?? BACKLOG_KEY;
}

export function stateIdOf(key: ColumnKey): string | null {
  return key === BACKLOG_KEY ? null : key;
}

export function columnId(id: string | null): string {
  return `column:${columnKey(id)}`;
}

export function dataOf(item: { data: { current?: unknown } } | null | undefined): DragData | null {
  const current = item?.data.current;
  return typeof current === 'object' && current !== null && 'type' in current ? (current as DragData) : null;
}

export function ordersFrom(snapshot: TicketsSnapshot, visible: (id: string) => boolean): Orders {
  const orders: Orders = {};
  for (const state of snapshot.states) {
    orders[state.id] = boardTickets(snapshot, state.id)
      .map((ticket) => ticket.id)
      .filter(visible);
  }
  return orders;
}

export function ordersFromLists(lists: Record<ColumnKey, { id: string }[]>): Orders {
  return Object.fromEntries(Object.entries(lists).map(([key, items]) => [key, items.map((item) => item.id)]));
}

export function findColumn(orders: Orders, ticketId: string): ColumnKey | null {
  return Object.keys(orders).find((key) => orders[key]?.includes(ticketId)) ?? null;
}

export function arrayMove<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  const [moved] = next.splice(from, 1);
  if (moved === undefined) return items;
  next.splice(to, 0, moved);
  return next;
}

export function moveWithin(orders: Orders, ticketId: string, overId: string): Orders {
  const key = findColumn(orders, ticketId);
  const list = key ? orders[key] : undefined;
  if (!key || !list) return orders;
  const from = list.indexOf(ticketId);
  const to = list.indexOf(overId);
  if (from < 0 || to < 0 || from === to) return orders;
  return { ...orders, [key]: arrayMove(list, from, to) };
}

export function moveAcross(
  orders: Orders,
  ticketId: string,
  targetKey: ColumnKey,
  overTicketId: string | null,
): Orders {
  const sourceKey = findColumn(orders, ticketId);
  if (!sourceKey || sourceKey === targetKey) return orders;
  const source = (orders[sourceKey] ?? []).filter((id) => id !== ticketId);
  const target = [...(orders[targetKey] ?? [])];
  const overIndex = overTicketId ? target.indexOf(overTicketId) : -1;
  target.splice(overIndex >= 0 ? overIndex : target.length, 0, ticketId);
  return { ...orders, [sourceKey]: source, [targetKey]: target };
}

export function resolveDrop(
  orders: Orders,
  ticketId: string,
): { stateId: string | null; index: number } | null {
  const key = findColumn(orders, ticketId);
  if (!key) return null;
  return { stateId: stateIdOf(key), index: orders[key]?.indexOf(ticketId) ?? 0 };
}

export function overTicket(orders: Orders, ticketId: string, target: DragData | null): Orders {
  if (!target || target.type === 'state') return orders;
  const targetKey = target.type === 'ticket' ? findColumn(orders, target.id) : target.key;
  if (!targetKey || findColumn(orders, ticketId) === targetKey) return orders;
  return moveAcross(orders, ticketId, targetKey, target.type === 'ticket' ? target.id : null);
}

export interface TicketDrop {
  orders: Orders;
  stateId: string | null;
  index: number;
}

export function dropTicket(
  orders: Orders,
  ticketId: string,
  target: DragData | null,
  fromKey: ColumnKey,
): TicketDrop | null {
  const settled =
    target?.type === 'ticket' &&
    findColumn(orders, ticketId) === fromKey &&
    findColumn(orders, target.id) === fromKey
      ? moveWithin(orders, ticketId, target.id)
      : orders;
  const drop = resolveDrop(settled, ticketId);
  return drop ? { orders: settled, ...drop } : null;
}
