import { act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  boardScopeProps,
  bootBoardShortcuts,
  commitChanges,
  createBoard,
  createItem,
  getBoardNodes,
  loadBoard,
  setActiveBoard,
} from '@renderer/lib/board';
import { isEditable, registerEditTarget, runEditCommand } from '@renderer/lib/commands';
import { bootTestApp, makeProject } from '../helpers/api';

function mount(html: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.append(host);
  return host;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('edit command routing', () => {
  it('sends a command to the target holding focus and ignores menus', () => {
    const host = mount(
      '<div id="a"><button id="inA">A</button></div><div id="b"><button id="inB">B</button></div><div role="menubar"><button id="menu">M</button></div>',
    );
    const handled = vi.fn(() => true);
    const skipped = vi.fn(() => false);
    const a = host.querySelector<HTMLElement>('#a');
    const b = host.querySelector<HTMLElement>('#b');
    const stopA = registerEditTarget((focused) => a?.contains(focused) ?? false, handled);
    const stopB = registerEditTarget((focused) => b?.contains(focused) ?? false, skipped);

    host.querySelector<HTMLElement>('#inA')?.focus();
    host.querySelector<HTMLElement>('#menu')?.focus();
    expect(runEditCommand('copy')).toBe(true);
    expect(handled).toHaveBeenCalledWith('copy', host.querySelector('#inA'));

    host.querySelector<HTMLElement>('#inB')?.focus();
    expect(runEditCommand('paste')).toBe(false);
    expect(skipped).toHaveBeenCalledWith('paste', host.querySelector('#inB'));

    stopA();
    stopB();
    host.querySelector<HTMLElement>('#inA')?.focus();
    expect(runEditCommand('copy')).toBe(false);
    host.remove();
    expect(runEditCommand('copy')).toBe(false);
  });

  it('knows which elements edit text themselves', () => {
    const host = mount(
      '<input id="i" /><textarea id="t"></textarea><div id="d"></div><div id="c" contenteditable="true"></div>',
    );
    const pick = (selector: string): HTMLElement => {
      const found = host.querySelector<HTMLElement>(selector);
      if (!found) throw new Error(selector);
      return found;
    };
    expect(isEditable(pick('#i'))).toBe(true);
    expect(isEditable(pick('#t'))).toBe(true);
    expect(isEditable(pick('#d'))).toBe(false);
    const editable = pick('#c');
    Object.defineProperty(editable, 'isContentEditable', { value: true });
    expect(isEditable(editable)).toBe(true);
  });
});

describe('board shortcuts', () => {
  it('undoes and redoes the active board from any board panel', async () => {
    const api = await bootTestApp();
    const project = makeProject('Keys');
    api.current = project;
    api.emitProject();
    const board = await createBoard({ name: 'Keys' });
    await loadBoard(board.id);
    setActiveBoard(board.id);
    const stop = bootBoardShortcuts();
    const host = mount(
      '<div><button id="in">In</button><input id="field" /></div><button id="out">Out</button>',
    );
    const scope = host.firstElementChild as HTMLElement;
    scope.setAttribute(Object.keys(boardScopeProps)[0] ?? '', '');
    const inside = host.querySelector<HTMLElement>('#in');
    const field = host.querySelector<HTMLElement>('#field');
    const outside = host.querySelector<HTMLElement>('#out');

    await commitChanges(board.id, {
      upsertNodes: [createItem({ boardId: board.id, preset: 'sticky', rect: { x: 0, y: 0 }, z: 1 })],
    });
    const press = async (target: HTMLElement | null, init: KeyboardEventInit) => {
      await act(async () => {
        target?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));
        await Promise.resolve();
      });
    };

    await press(outside, { key: 'z', ctrlKey: true });
    await press(field, { key: 'z', ctrlKey: true });
    await press(inside, { key: 'z', altKey: true, ctrlKey: true });
    await press(inside, { key: 'x', ctrlKey: true });
    expect(getBoardNodes(board.id)).toHaveLength(1);
    await press(inside, { key: 'z', ctrlKey: true });
    expect(getBoardNodes(board.id)).toHaveLength(0);
    await press(inside, { key: 'y', ctrlKey: true });
    expect(getBoardNodes(board.id)).toHaveLength(1);
    await press(inside, { key: 'Z', ctrlKey: true, shiftKey: true });
    expect(getBoardNodes(board.id)).toHaveLength(1);

    inside?.focus();
    expect(runEditCommand('undo')).toBe(true);
    await act(async () => {
      await Promise.resolve();
    });
    expect(getBoardNodes(board.id)).toHaveLength(0);
    expect(runEditCommand('redo')).toBe(true);
    expect(runEditCommand('copy')).toBe(false);
    setActiveBoard(null);
    expect(runEditCommand('undo')).toBe(false);
    stop();
  });
});
