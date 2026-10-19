import type { FontFamily } from '@shared/board';

const STACKS: Record<FontFamily, string | undefined> = {
  default: undefined,
  serif: 'Georgia, "Times New Roman", serif',
  mono: 'var(--font-family-mono), ui-monospace, monospace',
  rounded: 'ui-rounded, system-ui, sans-serif',
  condensed: '"Arial Narrow", sans-serif',
  handwritten: '"Comic Sans MS", cursive',
};

export function fontStack(family: FontFamily): string | undefined {
  return STACKS[family];
}
