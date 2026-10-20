import type { CardField, CardFieldKind, CardSpan } from '@shared/cards';

export const FIELD_GROUPS = ['text', 'number', 'choice', 'media', 'reference', 'layout'] as const;

export type FieldGroup = (typeof FIELD_GROUPS)[number];

export const FIELD_PRESET_IDS = [
  'heading',
  'text',
  'longText',
  'staticText',
  'date',
  'number',
  'stat',
  'rating',
  'range',
  'attributes',
  'formula',
  'dice',
  'choice',
  'multiChoice',
  'tags',
  'checkbox',
  'checklist',
  'image',
  'icon',
  'colour',
  'link',
  'divider',
  'spacer',
] as const;

export type FieldPresetId = (typeof FIELD_PRESET_IDS)[number];

export interface FieldPreset {
  id: FieldPresetId;
  kind: CardFieldKind;
  group: FieldGroup;
  span: CardSpan;
  defaults?: Record<string, unknown>;
}

export interface FieldKindDefinition {
  textStyle: boolean;
  preset: FieldPresetId;
}

export const FIELD_KINDS: Record<CardFieldKind, FieldKindDefinition> = {
  text: { textStyle: true, preset: 'text' },
  date: { textStyle: true, preset: 'date' },
  number: { textStyle: true, preset: 'number' },
  attributes: { textStyle: true, preset: 'attributes' },
  formula: { textStyle: true, preset: 'formula' },
  dice: { textStyle: true, preset: 'dice' },
  choice: { textStyle: true, preset: 'choice' },
  checkbox: { textStyle: true, preset: 'checkbox' },
  checklist: { textStyle: true, preset: 'checklist' },
  image: { textStyle: false, preset: 'image' },
  icon: { textStyle: true, preset: 'icon' },
  colour: { textStyle: true, preset: 'colour' },
  link: { textStyle: true, preset: 'link' },
  separator: { textStyle: false, preset: 'divider' },
};

const OPTIONS = { options: ['Option 1', 'Option 2'] };
const NO_LABEL = { showLabel: false };

export const FIELD_PRESETS: readonly FieldPreset[] = [
  {
    id: 'heading',
    kind: 'text',
    group: 'text',
    span: 12,
    defaults: { ...NO_LABEL, style: { size: 'lg', weight: 'bold' } },
  },
  { id: 'text', kind: 'text', group: 'text', span: 12 },
  { id: 'longText', kind: 'text', group: 'text', span: 12, defaults: { lines: 'multi' } },
  { id: 'staticText', kind: 'text', group: 'text', span: 12, defaults: { ...NO_LABEL, fixed: true } },
  { id: 'date', kind: 'date', group: 'text', span: 6 },
  { id: 'number', kind: 'number', group: 'number', span: 6 },
  {
    id: 'stat',
    kind: 'number',
    group: 'number',
    span: 12,
    defaults: { display: 'bar', min: 0, max: 100, defaultValue: 50 },
  },
  { id: 'rating', kind: 'number', group: 'number', span: 6, defaults: { display: 'symbols', max: 5 } },
  { id: 'range', kind: 'number', group: 'number', span: 6, defaults: { range: true } },
  {
    id: 'attributes',
    kind: 'attributes',
    group: 'number',
    span: 12,
    defaults: {
      rows: [
        { id: 'strength', label: 'Strength' },
        { id: 'agility', label: 'Agility' },
      ],
    },
  },
  { id: 'formula', kind: 'formula', group: 'number', span: 6 },
  { id: 'dice', kind: 'dice', group: 'number', span: 6 },
  { id: 'choice', kind: 'choice', group: 'choice', span: 6, defaults: OPTIONS },
  { id: 'multiChoice', kind: 'choice', group: 'choice', span: 12, defaults: { ...OPTIONS, multiple: true } },
  { id: 'tags', kind: 'choice', group: 'choice', span: 12, defaults: { multiple: true, allowNew: true } },
  { id: 'checkbox', kind: 'checkbox', group: 'choice', span: 6 },
  { id: 'checklist', kind: 'checklist', group: 'choice', span: 12 },
  { id: 'image', kind: 'image', group: 'media', span: 12 },
  { id: 'icon', kind: 'icon', group: 'media', span: 4 },
  { id: 'colour', kind: 'colour', group: 'media', span: 6 },
  { id: 'link', kind: 'link', group: 'reference', span: 12 },
  { id: 'divider', kind: 'separator', group: 'layout', span: 12 },
  { id: 'spacer', kind: 'separator', group: 'layout', span: 12, defaults: { line: false } },
];

export function findPreset(id: FieldPresetId): FieldPreset {
  const preset = FIELD_PRESETS.find((item) => item.id === id);
  if (!preset) throw new Error(`Unknown field preset ${id}`);
  return preset;
}

export function fieldPresetsByGroup(): { group: FieldGroup; presets: FieldPreset[] }[] {
  return FIELD_GROUPS.map((group) => ({
    group,
    presets: FIELD_PRESETS.filter((preset) => preset.group === group),
  }));
}

export function presetOf(field: CardField): FieldPresetId {
  switch (field.kind) {
    case 'text':
      if (field.fixed) return 'staticText';
      if (field.lines === 'multi') return 'longText';
      return field.style.size === 'lg' && field.style.weight === 'bold' ? 'heading' : 'text';
    case 'number':
      if (field.range) return 'range';
      return field.display === 'bar' ? 'stat' : field.display === 'symbols' ? 'rating' : 'number';
    case 'choice':
      if (!field.multiple) return 'choice';
      return field.allowNew ? 'tags' : 'multiChoice';
    case 'separator':
      return field.line ? 'divider' : 'spacer';
    default:
      return FIELD_KINDS[field.kind].preset;
  }
}
