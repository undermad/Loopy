export type DesignerAction =
  | 'selectNext'
  | 'selectPrevious'
  | 'moveEarlier'
  | 'moveLater'
  | 'narrower'
  | 'wider'
  | 'duplicate'
  | 'delete'
  | 'deselect'
  | 'selectAll'
  | 'copy'
  | 'cut'
  | 'paste'
  | 'undo'
  | 'redo'
  | 'toggleMode'
  | 'addField'
  | 'rename';

interface KeyInput {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

const COMMANDS: Record<string, DesignerAction> = {
  d: 'duplicate',
  a: 'selectAll',
  c: 'copy',
  x: 'cut',
  v: 'paste',
  y: 'redo',
  e: 'toggleMode',
};

const PLAIN: Record<string, DesignerAction> = {
  ArrowDown: 'selectNext',
  ArrowRight: 'selectNext',
  ArrowUp: 'selectPrevious',
  ArrowLeft: 'selectPrevious',
  '[': 'narrower',
  ']': 'wider',
  Delete: 'delete',
  Backspace: 'delete',
  Escape: 'deselect',
  '/': 'addField',
  Enter: 'rename',
};

export function designerKeyAction(event: KeyInput): DesignerAction | null {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (event.ctrlKey || event.metaKey) {
    if (key === 'z') return event.shiftKey ? 'redo' : 'undo';
    return event.altKey ? null : (COMMANDS[key] ?? null);
  }
  if (event.altKey) {
    if (key === 'ArrowUp' || key === 'ArrowLeft') return 'moveEarlier';
    if (key === 'ArrowDown' || key === 'ArrowRight') return 'moveLater';
    return null;
  }
  return PLAIN[key] ?? null;
}

let dirty = false;

export function setDesignerDirty(next: boolean): void {
  dirty = next;
}

export function isDesignerDirty(): boolean {
  return dirty;
}
