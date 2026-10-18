import type { EditCommand } from '@shared/ipc';

export type EditHandler = (command: EditCommand, focused: Element) => boolean;
export type EditScope = (focused: Element) => boolean;

interface Target {
  matches: EditScope;
  handler: EditHandler;
}

const targets = new Set<Target>();
let focused: Element | null = null;
let listening = false;

function track(event: FocusEvent) {
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (target.closest('[role="menubar"], [role="menu"]')) return;
  focused = target;
}

export function registerEditTarget(matches: EditScope, handler: EditHandler): () => void {
  if (!listening) {
    document.addEventListener('focusin', track);
    listening = true;
  }
  const target = { matches, handler };
  targets.add(target);
  return () => {
    targets.delete(target);
  };
}

export function runEditCommand(command: EditCommand): boolean {
  const current = focused;
  if (!current?.isConnected) return false;
  for (const target of targets) {
    if (target.matches(current) && target.handler(command, current)) return true;
  }
  return false;
}

export function isEditable(element: Element): boolean {
  return (
    (element instanceof HTMLElement && element.isContentEditable) ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)
  );
}
