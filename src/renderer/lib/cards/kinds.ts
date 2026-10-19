import { CARD_FIELD_KINDS, type CardFieldKind, type CardSpan } from '@shared/cards';

export const FIELD_GROUPS = ['text', 'number', 'choice', 'media', 'reference', 'layout'] as const;

export type FieldGroup = (typeof FIELD_GROUPS)[number];

export interface FieldKindDefinition {
  group: FieldGroup;
  span: CardSpan;
  textStyle: boolean;
  defaults?: Record<string, unknown>;
}

const OPTIONS = { options: ['Option 1', 'Option 2'] };
const NO_LABEL = { showLabel: false };

export const FIELD_KINDS: Record<CardFieldKind, FieldKindDefinition> = {
  heading: { group: 'text', span: 12, textStyle: true },
  text: { group: 'text', span: 12, textStyle: true },
  longText: { group: 'text', span: 12, textStyle: true },
  date: { group: 'text', span: 6, textStyle: true },
  number: { group: 'number', span: 6, textStyle: true },
  stat: { group: 'number', span: 12, textStyle: true, defaults: { min: 0, max: 100, defaultValue: 50 } },
  rating: { group: 'number', span: 6, textStyle: true },
  range: { group: 'number', span: 6, textStyle: true },
  attributes: {
    group: 'number',
    span: 12,
    textStyle: true,
    defaults: {
      rows: [
        { id: 'strength', label: 'Strength' },
        { id: 'agility', label: 'Agility' },
      ],
    },
  },
  formula: { group: 'number', span: 6, textStyle: true },
  dice: { group: 'number', span: 6, textStyle: true },
  select: { group: 'choice', span: 6, textStyle: true, defaults: OPTIONS },
  multiSelect: { group: 'choice', span: 12, textStyle: true, defaults: OPTIONS },
  checkbox: { group: 'choice', span: 6, textStyle: true },
  tags: { group: 'choice', span: 12, textStyle: true },
  checklist: { group: 'choice', span: 12, textStyle: true },
  image: { group: 'media', span: 12, textStyle: false },
  icon: { group: 'media', span: 4, textStyle: true },
  colour: { group: 'media', span: 6, textStyle: true },
  link: { group: 'reference', span: 12, textStyle: true },
  staticText: { group: 'layout', span: 12, textStyle: true, defaults: NO_LABEL },
  divider: { group: 'layout', span: 12, textStyle: false, defaults: NO_LABEL },
  spacer: { group: 'layout', span: 12, textStyle: false, defaults: NO_LABEL },
};

export function fieldKindsByGroup(): { group: FieldGroup; kinds: CardFieldKind[] }[] {
  return FIELD_GROUPS.map((group) => ({
    group,
    kinds: CARD_FIELD_KINDS.filter((kind) => FIELD_KINDS[kind].group === group),
  }));
}
