import type { Node } from '@xyflow/react';
import { describe, expect, it } from 'vitest';
import { asDropData, isTicketDrag, targetIndex } from '@renderer/components/editors/Tickets/dnd';
import {
  newEdge,
  newNote,
  nodeFromFlow,
  readViewport,
  toFlowEdges,
  toFlowNodes,
} from '@renderer/components/editors/Board/boardFlow';
import { emptyTicketsSnapshot } from '../helpers/tickets-fake';

describe('ticket drag helpers', () => {
  const snapshot = emptyTicketsSnapshot();
  const ticket = (id: string, stateId: string | null, position: string) => ({
    id,
    number: 1,
    title: id,
    description: '',
    type: 'task' as const,
    priority: 'low' as const,
    stateId,
    position,
    createdAt: '2026-10-17T09:00:00.000Z',
    updatedAt: '2026-10-17T09:00:00.000Z',
    resolvedAt: null,
  });
  snapshot.tickets = [ticket('a', 'todo', 'a'), ticket('b', 'todo', 'b'), ticket('c', 'todo', 'c')];
  const drag = { type: 'ticket' as const, id: 'a', stateId: 'todo' };

  it('recognises drag and drop payloads', () => {
    expect(isTicketDrag({ type: 'ticket', id: 'a' })).toBe(true);
    expect(isTicketDrag({ type: 'card', id: 'a' })).toBe(false);
    expect(asDropData({ type: 'column', stateId: 'done' })).toEqual({ type: 'column', stateId: 'done' });
    expect(asDropData({ type: 'card', id: 'b' })).toEqual({ type: 'card', id: 'b', stateId: null });
    expect(asDropData({ type: 'other' })).toBeNull();
  });

  it('computes the target index without the dragged ticket', () => {
    expect(targetIndex(snapshot, drag, { type: 'column', stateId: 'todo' }, null)).toBe(2);
    expect(targetIndex(snapshot, drag, { type: 'card', id: 'c', stateId: 'todo' }, 'top')).toBe(1);
    expect(targetIndex(snapshot, drag, { type: 'card', id: 'c', stateId: 'todo' }, 'bottom')).toBe(2);
    expect(targetIndex(snapshot, drag, { type: 'card', id: 'missing', stateId: 'todo' }, 'top')).toBe(2);
  });
});

describe('board flow helpers', () => {
  it('maps snapshot nodes and edges to React Flow and back', () => {
    const note = newNote('board', 10, 20, 3);
    const edge = newEdge('board', note.id, 'other');
    const snapshot = {
      board: { id: 'board', name: 'B', backgroundColor: '#ffffff', createdAt: '', updatedAt: '' },
      nodes: [note],
      edges: [edge],
    };
    const changes: string[] = [];
    const nodes = toFlowNodes(snapshot, (id, text) => changes.push(`${id}:${text}`));
    expect(nodes[0]).toMatchObject({
      id: note.id,
      type: 'note',
      position: { x: 10, y: 20 },
      width: 200,
      zIndex: 3,
    });
    (nodes[0]?.data as { onChange: (text: string) => void }).onChange('hello');
    expect(changes).toEqual([`${note.id}:hello`]);
    expect(toFlowEdges(snapshot)[0]).toMatchObject({ id: edge.id, source: note.id, target: 'other' });
    expect(nodeFromFlow(note, { position: { x: 1, y: 2 }, width: 300 })).toMatchObject({
      x: 1,
      y: 2,
      width: 300,
      height: 120,
    });
  });

  it('reads a viewport from area state with a safe default', () => {
    expect(readViewport({})).toEqual({ x: 0, y: 0, zoom: 1 });
    expect(readViewport({ viewport: { x: 'a' } })).toEqual({ x: 0, y: 0, zoom: 1 });
    expect(readViewport({ viewport: { x: 5, y: 6, zoom: 2 } })).toEqual({ x: 5, y: 6, zoom: 2 });
  });
});

describe('settleNodeChanges', () => {
  it('commits moved and resized nodes only when the gesture ends, and collects removals', async () => {
    const { settleNodeChanges, newNote } = await import('@renderer/components/editors/Board/boardFlow');
    const note = newNote('board', 0, 0, 1);
    const pending = new Map<string, Node>();
    const moving = [{ id: note.id, type: 'position' as const, position: { x: 5, y: 5 }, dragging: true }];
    const nextMoving = [{ id: note.id, position: { x: 5, y: 5 }, data: {} }];
    expect(settleNodeChanges(moving, nextMoving, [note], pending)).toEqual({ updates: [], removed: [] });
    expect(pending.size).toBe(1);

    const settled = [{ id: note.id, type: 'position' as const, position: { x: 9, y: 9 }, dragging: false }];
    const nextSettled = [{ id: note.id, position: { x: 9, y: 9 }, data: {} }];
    const result = settleNodeChanges(settled, nextSettled, [note], pending);
    expect(result.updates[0]).toMatchObject({ x: 9, y: 9 });
    expect(pending.size).toBe(0);

    const resized = [
      { id: note.id, type: 'dimensions' as const, dimensions: { width: 320, height: 200 }, resizing: false },
    ];
    const nextResized = [{ id: note.id, position: { x: 9, y: 9 }, width: 320, height: 200, data: {} }];
    expect(settleNodeChanges(resized, nextResized, [note], pending).updates[0]).toMatchObject({
      width: 320,
      height: 200,
    });

    const removal = [
      { id: note.id, type: 'remove' as const },
      { id: 'ghost', type: 'position' as const, position: { x: 0, y: 0 }, dragging: false },
    ];
    expect(settleNodeChanges(removal, [], [note], pending)).toEqual({ updates: [], removed: [note.id] });
  });
});
