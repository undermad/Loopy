import { describe, expect, it } from 'vitest';
import type { BoardNode, BoardNodeType, ItemStyle } from '@shared/board';
import {
  ITEM_KINDS,
  copiedItemStyle,
  copyItemStyle,
  itemTextStyle,
  pasteItemStyle,
  patchStyle,
  resolveItemStyle,
  sharedStyleValue,
} from '@renderer/lib/board';

function node(id: string, style: ItemStyle, type: BoardNodeType = 'text'): BoardNode {
  return { id, boardId: 'b', parentId: null, type, x: 0, y: 0, width: 10, height: 10, z: 1, data: { style } };
}

describe('item style helpers', () => {
  it('resolves the new text and effect styles with defaults', () => {
    expect(resolveItemStyle('text')).toMatchObject({
      fontFamily: 'default',
      lineHeight: 1.3,
      italic: false,
      underline: false,
      strike: false,
      textCase: 'none',
      shadowSize: 'md',
      gradient: null,
    });
  });

  it('turns a resolved style into text styling', () => {
    const style = resolveItemStyle('text', {
      fontFamily: 'serif',
      lineHeight: 1.6,
      italic: true,
      underline: true,
      strike: true,
      textCase: 'title',
    });
    expect(itemTextStyle(style)).toMatchObject({
      fontStyle: 'italic',
      textDecoration: 'underline line-through',
      textTransform: 'capitalize',
      lineHeight: 1.6,
    });
    expect(itemTextStyle(style).fontFamily).toContain('serif');
    expect(itemTextStyle(resolveItemStyle('text'))).toMatchObject({
      fontStyle: 'normal',
      textDecoration: 'none',
      textTransform: 'none',
    });
    expect(itemTextStyle(resolveItemStyle('text', { textCase: 'upper' })).textTransform).toBe('uppercase');
    expect(itemTextStyle(resolveItemStyle('text', { textCase: 'lower' })).textTransform).toBe('lowercase');
  });

  it('patches a style and drops keys set to undefined', () => {
    expect(patchStyle({ fill: null, italic: true }, { italic: undefined, fontSize: 20 })).toEqual({
      fill: null,
      fontSize: 20,
    });
  });

  it('reports a shared value or mixed across several items', () => {
    const nodes = [node('a', { fontSize: 20 }), node('b', { fontSize: 20 }), node('c', { fontSize: 12 })];
    expect(sharedStyleValue(nodes.slice(0, 2), 'fontSize')).toEqual({ value: 20, mixed: false });
    expect(sharedStyleValue(nodes, 'fontSize')).toEqual({ value: 20, mixed: true });
  });

  it('copies one item style and pastes it onto others', () => {
    expect(copiedItemStyle()).toBeNull();
    copyItemStyle(node('a', { fill: { hex: '#ff0000', ref: null }, italic: true }));
    expect(copiedItemStyle()).toEqual({ fill: { hex: '#ff0000', ref: null }, italic: true });
    const pasted = pasteItemStyle([node('b', { fontSize: 30 }), node('c', {})]);
    expect(pasted.map((item) => item.data['style'])).toEqual([
      { fill: { hex: '#ff0000', ref: null }, italic: true },
      { fill: { hex: '#ff0000', ref: null }, italic: true },
    ]);
  });

  it('describes what each item kind can do', () => {
    expect(ITEM_KINDS.drawing).toMatchObject({
      appearance: false,
      text: false,
      rotatable: false,
      resizable: false,
    });
    expect(ITEM_KINDS.image).toMatchObject({ appearance: true, text: false });
    expect(ITEM_KINDS.card).toMatchObject({ appearance: true, text: true, rotatable: true, resizable: true });
  });
});
