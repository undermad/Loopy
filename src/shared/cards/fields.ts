import { z } from 'zod';
import { FONT_WEIGHTS, TEXT_ALIGNS, boardLinkKindSchema } from '../board';
import { colourValueSchema } from '../colours';

export const CARD_FIELD_KINDS = [
  'heading',
  'text',
  'longText',
  'number',
  'select',
  'checkbox',
  'tags',
  'image',
  'stat',
  'colour',
  'link',
  'divider',
] as const;

export const CARD_SPANS = [12, 9, 8, 6, 4, 3] as const;
export const CARD_TEXT_SIZES = ['xs', 'sm', 'md', 'lg', 'xl'] as const;
export const CARD_MAX_OPTIONS = 30;

export const cardFieldKindSchema = z.enum(CARD_FIELD_KINDS);

export const cardFieldStyleSchema = z.object({
  size: z.enum(CARD_TEXT_SIZES).optional(),
  weight: z.enum(FONT_WEIGHTS).optional(),
  colour: colourValueSchema.nullable().optional(),
  align: z.enum(TEXT_ALIGNS).optional(),
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
};

const fallback = <T extends z.ZodType>(schema: T) => schema.nullable().default(null).catch(null);

const textDefault = fallback(z.string().max(5000));
const numberDefault = fallback(z.number());
const listDefault = fallback(z.array(z.string().max(80)).max(50));
const placeholder = z.string().max(120).default('');
const bound = z.number().nullable().default(null);
const affix = z.string().max(12).default('');

const options = z.array(z.string().trim().min(1).max(40)).max(CARD_MAX_OPTIONS).default([]);

const textKind = <K extends 'heading' | 'text' | 'longText'>(kind: K) =>
  z.object({ ...base, kind: z.literal(kind), placeholder, defaultValue: textDefault });

export const headingFieldSchema = textKind('heading');
export const textFieldSchema = textKind('text');
export const longTextFieldSchema = textKind('longText');

export const numberFieldSchema = z.object({
  ...base,
  kind: z.literal('number'),
  min: bound,
  max: bound,
  prefix: affix,
  suffix: affix,
  defaultValue: numberDefault,
});

export const selectFieldSchema = z.object({
  ...base,
  kind: z.literal('select'),
  placeholder,
  options,
  defaultValue: textDefault,
});

export const checkboxFieldSchema = z.object({
  ...base,
  kind: z.literal('checkbox'),
  defaultValue: fallback(z.boolean()),
});

export const tagsFieldSchema = z.object({ ...base, kind: z.literal('tags'), defaultValue: listDefault });

export const imageFieldSchema = z.object({ ...base, kind: z.literal('image') });

export const statFieldSchema = z.object({
  ...base,
  kind: z.literal('stat'),
  min: bound,
  max: bound,
  prefix: affix,
  suffix: affix,
  defaultValue: numberDefault,
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

export const dividerFieldSchema = z.object({ ...base, kind: z.literal('divider') });

export const cardFieldSchema = z.discriminatedUnion('kind', [
  headingFieldSchema,
  textFieldSchema,
  longTextFieldSchema,
  numberFieldSchema,
  selectFieldSchema,
  checkboxFieldSchema,
  tagsFieldSchema,
  imageFieldSchema,
  statFieldSchema,
  colourFieldSchema,
  linkFieldSchema,
  dividerFieldSchema,
]);

export type CardFieldKind = z.infer<typeof cardFieldKindSchema>;
export type CardSpan = (typeof CARD_SPANS)[number];
export type CardTextSize = (typeof CARD_TEXT_SIZES)[number];
export type CardField = z.infer<typeof cardFieldSchema>;
export type FieldOf<K extends CardFieldKind> = Extract<CardField, { kind: K }>;
