import { useEffect, useRef } from 'react';
import { tinykeys } from 'tinykeys';
import { SHORTCUT_IDS, keymap, type ShortcutId } from './keymap';

export type ShortcutHandlers = Partial<Record<ShortcutId, (event: KeyboardEvent) => void>>;

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

export function useShortcuts(handlers: ShortcutHandlers, enabled = true): void {
  const latest = useRef<ShortcutHandlers>({});

  useEffect(() => {
    latest.current = handlers;
  });

  useEffect(() => {
    if (!enabled) return;
    const bindings: Record<string, (event: KeyboardEvent) => void> = {};
    for (const id of SHORTCUT_IDS) {
      bindings[keymap[id].keys] = (event: KeyboardEvent) => {
        const handler = latest.current[id];
        if (!handler || (isEditable(event.target) && id !== 'preferences')) return;
        event.preventDefault();
        handler(event);
      };
    }
    return tinykeys(window, bindings);
  }, [enabled]);
}
