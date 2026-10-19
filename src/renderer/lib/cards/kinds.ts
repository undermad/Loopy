import { CARD_FIELD_KINDS, type CardFieldKind, type CardSpan } from '@shared/cards';

export const FIELD_GROUPS = ['text', 'number', 'choice', 'media', 'reference', 'layout'] as const;

export type FieldGroup = (typeof FIELD_GROUPS)[number];
export type FieldValueKind = 'text' | 'number' | 'boolean' | 'list' | 'link' | 'none';

export interface FieldKindDefinition {
  group: FieldGroup;
  span: CardSpan;
  value: FieldValueKind;
  textStyle: boolean;
  defaults?: Record<string, unknown>;
}

export const FIELD_KINDS: Record<CardFieldKind, FieldKindDefinition> = {
  heading: { group: 'text', span: 12, value: 'text', textStyle: true },
  text: { group: 'text', span: 12, value: 'text', textStyle: true },
  longText: { group: 'text', span: 12, value: 'text', textStyle: true },
  number: { group: 'number', span: 6, value: 'number', textStyle: true },
  stat: {
    group: 'number',
    span: 12,
    value: 'number',
    textStyle: true,
    defaults: { min: 0, max: 100, defaultValue: 50 },
  },
  select: {
    group: 'choice',
    span: 6,
    value: 'text',
    textStyle: true,
    defaults: { options: ['Option 1', 'Option 2'] },
  },
  checkbox: { group: 'choice', span: 6, value: 'boolean', textStyle: true },
  tags: { group: 'choice', span: 12, value: 'list', textStyle: true },
  image: { group: 'media', span: 12, value: 'text', textStyle: false },
  colour: { group: 'media', span: 6, value: 'text', textStyle: true },
  link: { group: 'reference', span: 12, value: 'link', textStyle: true },
  divider: { group: 'layout', span: 12, value: 'none', textStyle: false, defaults: { showLabel: false } },
};

export function fieldKindsByGroup(): { group: FieldGroup; kinds: CardFieldKind[] }[] {
  return FIELD_GROUPS.map((group) => ({
    group,
    kinds: CARD_FIELD_KINDS.filter((kind) => FIELD_KINDS[kind].group === group),
  }));
}
