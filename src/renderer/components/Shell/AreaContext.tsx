import { createContext, useContext } from 'react';

export interface AreaContextValue {
  areaId: string;
  headerSlot: HTMLElement | null;
}

export const AreaContext = createContext<AreaContextValue | null>(null);

export function useAreaContext(): AreaContextValue {
  const value = useContext(AreaContext);
  if (!value) throw new Error('useAreaContext must be used inside an Area');
  return value;
}
