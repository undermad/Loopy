import { useCallback, useSyncExternalStore } from 'react';
import { layerCoords, subscribeLayer } from './cache';

export function useLayerCoords(nodeId: string, boardId: string): string[] {
  const subscribe = useCallback(
    (notify: () => void) =>
      subscribeLayer(nodeId, boardId, (change) => {
        if (change.coords === null) notify();
      }),
    [boardId, nodeId],
  );
  return useSyncExternalStore(subscribe, () => layerCoords(nodeId));
}
