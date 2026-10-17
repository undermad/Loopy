import { useEffect, useRef, type RefObject } from 'react';

export type AssetDragPhase = 'move' | 'leave' | 'drop';

export interface AssetDragDetail {
  ids: string[];
  x: number;
  y: number;
  phase: AssetDragPhase;
}

const EVENT = 'loopy:asset-drag';
const ZONE = 'data-asset-drop';

let current: Element | null = null;

function zoneAt(x: number, y: number): Element | null {
  for (const element of document.elementsFromPoint(x, y)) {
    const zone = element.closest(`[${ZONE}]`);
    if (zone) return zone;
  }
  return null;
}

function send(zone: Element, detail: AssetDragDetail) {
  zone.dispatchEvent(new CustomEvent<AssetDragDetail>(EVENT, { detail, bubbles: true }));
}

export function reportAssetDrag(
  ids: string[],
  x: number,
  y: number,
  phase: 'move' | 'drop' | 'cancel',
): boolean {
  const zone = phase === 'cancel' || !Number.isFinite(x) ? null : zoneAt(x, y);
  if (current && current !== zone) send(current, { ids, x, y, phase: 'leave' });
  if (zone && phase !== 'cancel') send(zone, { ids, x, y, phase });
  current = phase === 'move' ? zone : null;
  return zone !== null;
}

export const assetDropZoneProps = { [ZONE]: '' } as const;

export function useAssetDropZone(
  ref: RefObject<HTMLElement | null>,
  handler: (detail: AssetDragDetail) => void,
): void {
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  useEffect(() => {
    const listener = (event: Event) => {
      if (ref.current && event.target === ref.current) {
        latest.current((event as CustomEvent<AssetDragDetail>).detail);
      }
    };
    window.addEventListener(EVENT, listener);
    return () => {
      window.removeEventListener(EVENT, listener);
    };
  }, [ref]);
}
