import { isEditable, registerEditTarget } from '@renderer/lib/commands';
import { boardStore, redoBoard, undoBoard } from './store';

const SCOPE = 'data-board-scope';

export const boardScopeProps = { [SCOPE]: '' } as const;

function inScope(element: Element): boolean {
  return element.closest(`[${SCOPE}]`) !== null && !isEditable(element);
}

function run(redo: boolean): boolean {
  const boardId = boardStore.getState().activeBoardId;
  if (!boardId) return false;
  void (redo ? redoBoard(boardId) : undoBoard(boardId));
  return true;
}

function onKeyDown(event: KeyboardEvent) {
  if (event.defaultPrevented || !(event.ctrlKey || event.metaKey) || event.altKey) return;
  const key = event.key.toLowerCase();
  if (key !== 'z' && key !== 'y') return;
  if (!(event.target instanceof Element) || !inScope(event.target)) return;
  if (run(key === 'y' || event.shiftKey)) event.preventDefault();
}

export function bootBoardShortcuts(): () => void {
  document.addEventListener('keydown', onKeyDown);
  const unregister = registerEditTarget(inScope, (command) =>
    command === 'undo' ? run(false) : command === 'redo' ? run(true) : false,
  );
  return () => {
    document.removeEventListener('keydown', onKeyDown);
    unregister();
  };
}
