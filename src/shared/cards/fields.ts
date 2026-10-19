import { z } from 'zod';
import {
  FONT_WEIGHTS,
  TEXT_ALIGNS,
  boardLinkKindSchema,
  checklistItemSchema,
  numberRangeSchema,
} from '../board';
import { colourValueSchema } from '../colours';

export const CARD_FIELD_KINDS = [
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
  'select',
  'multiSelect',
  'checkbox',
  'tags',
  'checklist',
  'image',
  'icon',
  'colour',
  'link',
  'divider',
  'spacer',
] as const;

export const CARD_SPANS = [12, 9, 8, 6, 4, 3] as const;
export const CARD_TEXT_SIZES = ['xs', 'sm', 'md', 'lg', 'xl'] as const;
export const CARD_MAX_OPTIONS = 30;
export const CARD_MAX_ROWS = 20;
export const RATING_SYMBOLS = ['star', 'heart', 'circle', 'pip'] as const;
export const VISIBILITY_OPS = ['filled', 'empty', 'equals', 'notEquals', 'above', 'below'] as const;

export const cardFieldKindSchema = z.enum(CARD_FIELD_KINDS);

export const cardFieldStyleSchema = z.object({
  size: z.enum(CARD_TEXT_SIZES).optional(),
  weight: z.enum(FONT_WEIGHTS).optional(),
  colour: colourValueSchema.nullable().optional(),
  align: z.enum(TEXT_ALIGNS).optional(),
});

export const visibilityRuleSchema = z.object({
  field: z.string().min(1).max(64),
  op: z.enum(VISIBILITY_OPS),
  value: z.string().max(80).default(''),
});

const spanSchema = z
  .number()
  .int()
  .refine((value) => (CARD_SPANS as readonly number[]).includes(value));

const base = {
  id: z.string().min(1).max(64),
  label: z.string().max(80).default(''),
  showLabel: z.boolean().default(true),
  span: spanSchema.default(12),
  style: cardFieldStyleSchema.default({}),
  help: z.string().max(200).default(''),
  hidden: z.boolean().default(false),
  visibleWhen: visibilityRuleSchema.nullable().default(null),
};

const fallback = <T extends z.ZodType>(schema: T) => schema.nullable().default(null).catch(null);

const textDefault = fallback(z.string().max(5000));
const numberDefault = fallback(z.number());
const listDefault = fallback(z.array(z.string().max(80)).max(50));
const placeholder = z.string().max(120).default('');
const bound = z.number().nullable().default(null);
const affix = z.string().max(12).default('');

export const choiceOptionSchema = z.preprocess(
  (raw) => (typeof raw === 'string' ? { value: raw } : raw),
  z.object({
    value: z.string().trim().min(1).max(40),
    colour: colourValueSchema.nullable().default(null),
  }),
);

const options = z.array(choiceOptionSchema).max(CARD_MAX_OPTIONS).default([]);

const textKind = <K extends 'heading' | 'text' | 'longText'>(kind: K) =>
  z.object({ ...base, kind: z.literal(kind), placeholder, defaultValue: textDefault });

export const headingFieldSchema = textKind('heading');
export const textFieldSchema = textKind('text');
export const longTextFieldSchema = textKind('longText');

export const staticTextFieldSchema = z.object({
  ...base,
  kind: z.literal('staticText'),
  showLabel: z.boolean().default(false),
  text: z.string().max(2000).default(''),
});

export const dateFieldSchema = z.object({
  ...base,
  kind: z.literal('date'),
  defaultValue: fallback(z.iso.date()),
});

export const numberFieldSchema = z.object({
  ...base,
  kind: z.literal('number'),
  min: bound,
  max: bound,
  prefix: affix,
  suffix: affix,
  defaultValue: numberDefault,
});

export const statFieldSchema = z.object({
  ...base,
  kind: z.literal('stat'),
  min: bound,
  max: bound,
  prefix: affix,
  suffix: affix,
  defaultValue: numberDefault,
});

export const ratingFieldSchema = z.object({
  ...base,
  kind: z.literal('rating'),
  max: z.number().int().min(1).max(10).default(5),
  symbol: z.enum(RATING_SYMBOLS).default('star'),
  defaultValue: numberDefault,
});

export const rangeFieldSchema = z.object({
  ...base,
  kind: z.literal('range'),
  min: bound,
  max: bound,
  prefix: affix,
  suffix: affix,
  defaultValue: fallback(numberRangeSchema),
});

export const attributeRowSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().trim().min(1).max(40),
});

export const attributesFieldSchema = z.object({
  ...base,
  kind: z.literal('attributes'),
  rows: z.array(attributeRowSchema).max(CARD_MAX_ROWS).default([]),
});

export const formulaFieldSchema = z.object({
  ...base,
  kind: z.literal('formula'),
  expression: z.string().max(500).default(''),
  decimals: z.number().int().min(0).max(6).nullable().default(null),
  prefix: affix,
  suffix: affix,
});

export const diceFieldSchema = z.object({
  ...base,
  kind: z.literal('dice'),
  placeholder,
  defaultValue: fallback(z.string().max(40)),
});

export const selectFieldSchema = z.object({
  ...base,
  kind: z.literal('select'),
  placeholder,
  options,
  defaultValue: textDefault,
});

export const multiSelectFieldSchema = z.object({
  ...base,
  kind: z.literal('multiSelect'),
  options,
  defaultValue: listDefault,
});

export const checkboxFieldSchema = z.object({
  ...base,
  kind: z.literal('checkbox'),
  defaultValue: fallback(z.boolean()),
});

export const tagsFieldSchema = z.object({ ...base, kind: z.literal('tags'), defaultValue: listDefault });

export const checklistFieldSchema = z.object({
  ...base,
  kind: z.literal('checklist'),
  defaultValue: fallback(z.array(checklistItemSchema).max(50)),
});

export const imageFieldSchema = z.object({ ...base, kind: z.literal('image') });

export const iconFieldSchema = z.object({
  ...base,
  kind: z.literal('icon'),
  defaultValue: fallback(z.string().max(40)),
});

export const colourFieldSchema = z.object({
  ...base,
  kind: z.literal('colour'),
  defaultValue: fallback(z.string().regex(/^#[0-9a-f]{6}$/i)),
});

export const linkFieldSchema = z.object({
  ...base,
  kind: z.literal('link'),
  linkKinds: z.array(boardLinkKindSchema).max(8).default([]),
  multiple: z.boolean().default(false),
});

export const dividerFieldSchema = z.object({
  ...base,
  kind: z.literal('divider'),
  showLabel: z.boolean().default(false),
});

export const spacerFieldSchema = z.object({
  ...base,
  kind: z.literal('spacer'),
  showLabel: z.boolean().default(false),
  size: z.number().min(4).max(200).default(16),
});

export const cardFieldSchema = z.discriminatedUnion('kind', [
  headingFieldSchema,
  textFieldSchema,
  longTextFieldSchema,
  staticTextFieldSchema,
  dateFieldSchema,
  numberFieldSchema,
  statFieldSchema,
  ratingFieldSchema,
  rangeFieldSchema,
  attributesFieldSchema,
  formulaFieldSchema,
  diceFieldSchema,
  selectFieldSchema,
  multiSelectFieldSchema,
  checkboxFieldSchema,
  tagsFieldSchema,
  checklistFieldSchema,
  imageFieldSchema,
  iconFieldSchema,
  colourFieldSchema,
  linkFieldSchema,
  dividerFieldSchema,
  spacerFieldSchema,
]);

export type CardFieldKind = z.infer<typeof cardFieldKindSchema>;
export type CardSpan = (typeof CARD_SPANS)[number];
export type CardTextSize = (typeof CARD_TEXT_SIZES)[number];
export type CardField = z.infer<typeof cardFieldSchema>;
export type FieldOf<K extends CardFieldKind> = Extract<CardField, { kind: K }>;
export type ChoiceOption = z.infer<typeof choiceOptionSchema>;
export type VisibilityOp = (typeof VISIBILITY_OPS)[number];
