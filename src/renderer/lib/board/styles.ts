import type { BoardNode, ItemStyle } from '@shared/board';
import { fontStack } from './fonts';
import { resolveItemStyle, withData, type ResolvedStyle } from './items';

export interface TextStyle {
  fontFamily: string | undefined;
  lineHeight: number;
  fontStyle: 'italic' | 'normal';
  textDecoration: string;
  textTransform: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
}

const CASES: Record<ResolvedStyle['textCase'], TextStyle['textTransform']> = {
  none: 'none',
  upper: 'uppercase',
  lower: 'lowercase',
  title: 'capitalize',
};

export function itemTextStyle(style: ResolvedStyle): TextStyle {
  const lines = [style.underline ? 'underline' : '', style.strike ? 'line-through' : ''].filter(Boolean);
  return {
    fontFamily: fontStack(style.fontFamily),
    lineHeight: style.lineHeight,
    fontStyle: style.italic ? 'italic' : 'normal',
    textDecoration: lines.length > 0 ? lines.join(' ') : 'none',
    textTransform: CASES[style.textCase],
  };
}

export type StylePatch = { [K in keyof ItemStyle]?: ItemStyle[K] | undefined };

export function patchStyle(style: ItemStyle, patch: StylePatch): ItemStyle {
  const merged: Record<string, unknown> = { ...style, ...patch };
  return Object.fromEntries(Object.entries(merged).filter(([, value]) => value !== undefined));
}

export function ownStyle(node: Pick<BoardNode, 'data'>): ItemStyle {
  return node.data['style'] ?? {};
}

export function sharedStyleValue<K extends keyof ResolvedStyle>(
  nodes: readonly BoardNode[],
  key: K,
): { value: ResolvedStyle[K] | undefined; mixed: boolean } {
  const values = nodes.map((node) => resolveItemStyle(node.type, ownStyle(node))[key]);
  const [first] = values;
  const mixed = values.some((value) => JSON.stringify(value) !== JSON.stringify(first));
  return { value: first, mixed };
}

let copied: ItemStyle | null = null;

export function copyItemStyle(node: Pick<BoardNode, 'data'>): void {
  copied = structuredClone(ownStyle(node));
}

export function copiedItemStyle(): ItemStyle | null {
  return copied ? structuredClone(copied) : null;
}

export function pasteItemStyle(nodes: readonly BoardNode[]): BoardNode[] {
  if (!copied) return [];
  const style = copied;
  return nodes.map((node) => withData(node, { style: structuredClone(style) }));
}
