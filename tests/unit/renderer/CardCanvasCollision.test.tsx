import { describe, expect, it } from 'vitest';
import type { ClientRect, CollisionDetection } from '@dnd-kit/core';
import { collide } from '@renderer/components/editors/Cards/canvas/collision';

type Args = Parameters<CollisionDetection>[0];

const rect = (left: number, top: number, width: number, height: number): ClientRect => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
});

const RECTS: Record<string, ClientRect> = {
  'zone:header': rect(0, 0, 200, 40),
  'zone:body': rect(0, 50, 200, 200),
  'zone:footer': rect(0, 260, 200, 40),
  title: rect(0, 50, 200, 30),
  bio: rect(0, 90, 200, 30),
  notes: rect(0, 260, 200, 30),
};

const CONTAINERS: Record<string, string | undefined> = { title: 'body', bio: 'body', notes: 'footer' };

function args(pointer: { x: number; y: number } | null, dragged = rect(0, 200, 200, 30)): Args {
  const ids = Object.keys(RECTS);
  return {
    active: { id: 'dragged' },
    collisionRect: dragged,
    droppableRects: new Map(Object.entries(RECTS)),
    droppableContainers: ids.map((id) => ({
      id,
      data: { current: CONTAINERS[id] ? { sortable: { containerId: CONTAINERS[id] } } : undefined },
    })),
    pointerCoordinates: pointer,
  } as unknown as Args;
}

const first = (pointer: { x: number; y: number } | null, dragged?: ClientRect) =>
  collide(args(pointer, dragged))[0]?.id;

describe('canvas collision', () => {
  it('prefers the field under the pointer', () => {
    expect(first({ x: 20, y: 95 })).toBe('bio');
    expect(first({ x: 20, y: 270 })).toBe('notes');
  });

  it('picks the nearest field in the zone under the pointer when between fields', () => {
    expect(first({ x: 20, y: 200 }, rect(0, 195, 200, 30))).toBe('bio');
  });

  it('falls back to an empty zone and then to the nearest field', () => {
    expect(first({ x: 20, y: 10 })).toBe('zone:header');
    expect(first({ x: 400, y: 400 }, rect(0, 255, 200, 30))).toBe('notes');
    expect(first(null, rect(0, 45, 200, 30))).toBe('title');
  });
});
