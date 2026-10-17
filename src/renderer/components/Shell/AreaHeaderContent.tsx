import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useAreaContext } from './AreaContext';

export function AreaHeaderContent({ children }: { children: ReactNode }) {
  const { headerSlot } = useAreaContext();
  return headerSlot ? createPortal(children, headerSlot) : null;
}
