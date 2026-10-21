import { createContext, useContext } from 'react';
import type { CardField } from '@shared/cards';
import type { FieldPresetId } from '@renderer/lib/cards';

export interface Resizing {
  id: string;
  span: number | null;
  height: number | null;
}

export interface CanvasApi {
  gap: number;
  selected: readonly string[];
  renaming: string | null;
  showGrid: boolean;
  resizing: Resizing | null;
  overflowing: readonly string[];
  setResizing: (resizing: Resizing | null) => void;
  select: (id: string, mode: 'only' | 'toggle') => void;
  change: (field: CardField, key?: string) => void;
  rename: (id: string, label: string | null) => void;
  startRename: (id: string) => void;
  addAfter: (id: string, preset: FieldPresetId) => void;
  duplicate: (id: string) => void;
  remove: (id: string) => void;
  moveBy: (id: string, delta: -1 | 1) => void;
  moveToZone: (id: string, zone: CardField['zone']) => void;
}

export const CanvasContext = createContext<CanvasApi | null>(null);

export function useCanvas(): CanvasApi {
  const api = useContext(CanvasContext);
  if (!api) throw new Error('Card canvas parts need a DesignCanvas');
  return api;
}
