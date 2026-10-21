import { describe, expect, it } from 'vitest';
import { designerKeyAction, isDesignerDirty, setDesignerDirty } from '@renderer/lib/cards';
import { SHORTCUT_CATEGORIES } from '@renderer/lib/shortcuts';
import shell from '../../../../src/shared/locales/en/shell.json';

const key = (
  value: string,
  extra: Partial<Record<'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey', boolean>> = {},
) => ({
  key: value,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...extra,
});

describe('designer keys', () => {
  it('maps keys to designer actions', () => {
    const cases: [ReturnType<typeof key>, string | null][] = [
      [key('ArrowDown'), 'selectNext'],
      [key('ArrowRight'), 'selectNext'],
      [key('ArrowUp'), 'selectPrevious'],
      [key('ArrowLeft'), 'selectPrevious'],
      [key('ArrowUp', { altKey: true }), 'moveEarlier'],
      [key('ArrowDown', { altKey: true }), 'moveLater'],
      [key('['), 'narrower'],
      [key(']'), 'wider'],
      [key('d', { ctrlKey: true }), 'duplicate'],
      [key('Delete'), 'delete'],
      [key('Backspace'), 'delete'],
      [key('Escape'), 'deselect'],
      [key('a', { metaKey: true }), 'selectAll'],
      [key('c', { ctrlKey: true }), 'copy'],
      [key('x', { ctrlKey: true }), 'cut'],
      [key('v', { ctrlKey: true }), 'paste'],
      [key('z', { ctrlKey: true }), 'undo'],
      [key('Z', { ctrlKey: true, shiftKey: true }), 'redo'],
      [key('y', { ctrlKey: true }), 'redo'],
      [key('e', { ctrlKey: true }), 'toggleMode'],
      [key('/'), 'addField'],
      [key('Enter'), 'rename'],
      [key('q'), null],
      [key('c'), null],
    ];
    for (const [event, action] of cases) expect(designerKeyAction(event), event.key).toBe(action);
  });

  it('remembers whether the designer has unsaved changes', () => {
    expect(isDesignerDirty()).toBe(false);
    setDesignerDirty(true);
    expect(isDesignerDirty()).toBe(true);
    setDesignerDirty(false);
    expect(isDesignerDirty()).toBe(false);
  });

  it('lists the card designer keys in the shortcuts dialog', () => {
    const category = SHORTCUT_CATEGORIES.find((item) => item.id === 'cardDesigner');
    expect(category?.entries.map((entry) => entry.keys)).toEqual([
      '$mod+E',
      'Arrow keys',
      'Alt+Arrow keys',
      '[ / ]',
      '$mod+D',
      '$mod+C / $mod+X / $mod+V',
      '/',
      'Enter',
      'Shift+Click',
    ]);
    const items = shell.shortcuts.items as Record<string, string>;
    for (const entry of category?.entries ?? []) expect(items[entry.id], entry.id).toBeTruthy();
    expect((shell.shortcuts.categories as Record<string, string>)['cardDesigner']).toBe('Card designer');
  });
});
