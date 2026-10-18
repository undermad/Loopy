import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import type { Side } from '@renderer/lib/layout';

export type DockZone = Side | 'centre' | 'outside';

export interface AreaDrag {
  sourceId: string;
  targetId: string | null;
  zone: DockZone | null;
}

const dragStore = createStore<{ drag: AreaDrag | null }>(() => ({ drag: null }));

const EDGE = 0.25;

export function setAreaDrag(drag: AreaDrag | null): void {
  dragStore.setState({ drag });
}

export function useAreaDrag(): AreaDrag | null {
  return useStore(dragStore, (state) => state.drag);
}

export function dockZoneAt(x: number, y: number, sourceId: string): Omit<AreaDrag, 'sourceId'> {
  if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight)
    return { targetId: null, zone: 'outside' };
  for (const element of document.elementsFromPoint(x, y)) {
    const area = element.closest<HTMLElement>('[data-area-id]');
    if (!area) continue;
    const id = area.dataset['areaId'];
    if (!id || id === sourceId) return { targetId: null, zone: null };
    const rect = area.getBoundingClientRect();
    const fx = rect.width > 0 ? (x - rect.left) / rect.width : 0.5;
    const fy = rect.height > 0 ? (y - rect.top) / rect.height : 0.5;
    const edges: [Side, number][] = [
      ['left', fx],
      ['right', 1 - fx],
      ['top', fy],
      ['bottom', 1 - fy],
    ];
    const [side, distance] = edges.reduce((best, edge) => (edge[1] < best[1] ? edge : best));
    return { targetId: id, zone: distance > EDGE ? 'centre' : side };
  }
  return { targetId: null, zone: null };
}
