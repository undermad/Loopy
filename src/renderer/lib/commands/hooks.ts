import { useEffect, useRef, type RefObject } from 'react';
import { registerEditTarget, type EditHandler } from './targets';

export function useEditTarget(ref: RefObject<HTMLElement | null>, handler: EditHandler): void {
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  useEffect(
    () =>
      registerEditTarget(
        (focused) => ref.current?.contains(focused) ?? false,
        (command, focused) => latest.current(command, focused),
      ),
    [ref],
  );
}
