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
  'text',
  'date',
  'number',
  'attributes',
  'formula',
  'dice',
  'choice',
  'checkbox',
  'checklist',
  'image',
  'icon',
  'colour',
  'link',
  'separator',
] as const;

export const CARD_SPANS = [12, 9, 8, 6, 4, 3] as const;
export const CARD_TEXT_SIZES = ['xs', 'sm', 'md', 'lg', 'xl'] as const;
export const CARD_MAX_OPTIONS = 30;
export const CARD_MAX_ROWS = 20;
export const RATING_SYMBOLS = ['star', 'heart', 'circle', 'pip'] as const;
export const NUMBER_DISPLAYS = ['number', 'bar', 'symbols'] as const;
export const TEXT_LINES = ['single', 'multi'] as const;
export const CARD_ZONES = ['header', 'body', 'footer'] as const;
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
  zone: z.enum(CARD_ZONES).default('body'),
};

const fallback = <T extends z.ZodType>(schema: T) => schema.nullable().default(null).catch(null);

const textDefault = fallback(z.string().max(5000));
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

export const textFieldSchema = z.object({
  ...base,
  kind: z.literal('text'),
  lines: z.enum(TEXT_LINES).default('single'),
  fixed: z.boolean().default(false),
  text: z.string().max(2000).default(''),
  placeholder,
  defaultValue: textDefault,
});

export const dateFieldSchema = z.object({
  ...base,
  kind: z.literal('date'),
  defaultValue: fallback(z.iso.date()),
});

export const numberFieldSchema = z.object({
  ...base,
  kind: z.literal('number'),
  display: z.enum(NUMBER_DISPLAYS).default('number'),
  symbol: z.enum(RATING_SYMBOLS).default('star'),
  range: z.boolean().default(false),
  min: bound,
  max: bound,
  prefix: affix,
  suffix: affix,
  defaultValue: fallback(z.union([z.number(), numberRangeSchema])),
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

export const choiceFieldSchema = z.object({
  ...base,
  kind: z.literal('choice'),
  multiple: z.boolean().default(false),
  allowNew: z.boolean().default(false),
  placeholder,
  options,
  defaultValue: fallback(z.union([z.string().max(80), z.array(z.string().max(80)).max(50)])),
});

export const checkboxFieldSchema = z.object({
  ...base,
  kind: z.literal('checkbox'),
  defaultValue: fallback(z.boolean()),
});

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

export const separatorFieldSchema = z.object({
  ...base,
  kind: z.literal('separator'),
  showLabel: z.boolean().default(false),
  line: z.boolean().default(true),
  size: z.number().min(4).max(200).default(16),
});

export const cardFieldSchema = z.discriminatedUnion('kind', [
  textFieldSchema,
  dateFieldSchema,
  numberFieldSchema,
  attributesFieldSchema,
  formulaFieldSchema,
  diceFieldSchema,
  choiceFieldSchema,
  checkboxFieldSchema,
  checklistFieldSchema,
  imageFieldSchema,
  iconFieldSchema,
  colourFieldSchema,
  linkFieldSchema,
  separatorFieldSchema,
]);

export type CardFieldKind = z.infer<typeof cardFieldKindSchema>;
export type CardSpan = (typeof CARD_SPANS)[number];
export type CardTextSize = (typeof CARD_TEXT_SIZES)[number];
export type CardField = z.infer<typeof cardFieldSchema>;
export type FieldOf<K extends CardFieldKind> = Extract<CardField, { kind: K }>;
export type ChoiceOption = z.infer<typeof choiceOptionSchema>;
export type VisibilityOp = (typeof VISIBILITY_OPS)[number];
