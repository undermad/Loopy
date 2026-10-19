import { describe, expect, it } from 'vitest';
import {
  ITEM_KINDS,
  addStep,
  createItem,
  itemData,
  removeStep,
  resizeTable,
  setCell,
  stepProgress,
  tableSize,
  toggleStep,
} from '@renderer/lib/board';

describe('new item kinds', () => {
  it('creates icon, checklist, table and embed items with their defaults', () => {
    const make = (preset: 'icon' | 'checklist' | 'table' | 'embed') =>
      createItem({ boardId: 'b', preset, rect: { x: 0, y: 0 }, z: 1 });
    expect(make('icon')).toMatchObject({ type: 'icon', width: 96, height: 96 });
    expect(itemData({ type: 'icon', data: make('icon').data })).toMatchObject({ icon: 'star' });
    expect(make('checklist')).toMatchObject({ type: 'checklist', width: 240 });
    expect(itemData({ type: 'checklist', data: make('checklist').data })).toMatchObject({
      title: '',
      items: [],
      showProgress: true,
    });
    expect(itemData({ type: 'table', data: make('table').data })).toMatchObject({
      header: true,
      rows: [
        ['', '', ''],
        ['', '', ''],
        ['', '', ''],
      ],
    });
    expect(itemData({ type: 'embed', data: make('embed').data })).toMatchObject({ target: null });
    expect(ITEM_KINDS.icon).toMatchObject({ appearance: true, text: true });
    expect(ITEM_KINDS.embed).toMatchObject({ text: false });
  });
});

describe('checklist steps', () => {
  it('adds, ticks, removes and counts steps', () => {
    const first = addStep([], '  Find the key ');
    expect(first).toEqual([{ id: expect.any(String) as string, text: 'Find the key', done: false }]);
    expect(addStep(first, '   ')).toBe(first);
    const two = addStep(first, 'Open the door');
    const id = two[0]?.id ?? '';
    const ticked = toggleStep(two, id);
    expect(ticked[0]?.done).toBe(true);
    expect(stepProgress(ticked)).toEqual({ done: 1, total: 2 });
    expect(removeStep(ticked, id).map((step) => step.text)).toEqual(['Open the door']);
    expect(new Set(addStep(two, 'Leave').map((step) => step.id)).size).toBe(3);
  });
});

describe('table cells', () => {
  it('resizes a table and edits one cell', () => {
    const rows = [
      ['a', 'b'],
      ['c', 'd'],
    ];
    expect(tableSize(rows)).toEqual({ rows: 2, columns: 2 });
    expect(resizeTable(rows, 3, 3)).toEqual([
      ['a', 'b', ''],
      ['c', 'd', ''],
      ['', '', ''],
    ]);
    expect(resizeTable(rows, 1, 1)).toEqual([['a']]);
    expect(resizeTable(rows, 99, 99)).toHaveLength(50);
    expect(resizeTable(rows, 0, 0)).toEqual([['a']]);
    expect(setCell(rows, 1, 0, 'x')).toEqual([
      ['a', 'b'],
      ['x', 'd'],
    ]);
    expect(setCell(rows, 5, 5, 'x')).toBe(rows);
    expect(tableSize([])).toEqual({ rows: 0, columns: 0 });
  });
});
