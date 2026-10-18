import { z } from 'zod';
import { FONT_WEIGHTS, TEXT_ALIGNS, boardLinkKindSchema, cardValueSchema, itemStyleSchema } from './board';
import { colourValueSchema } from './colours';

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
export const CARD_MAX_FIELDS = 60;
export const CARD_MAX_OPTIONS = 30;

export const cardFieldKindSchema = z.enum(CARD_FIELD_KINDS);

export const cardFieldStyleSchema = z.object({
  size: z.enum(CARD_TEXT_SIZES).optional(),
  weight: z.enum(FONT_WEIGHTS).optional(),
  colour: colourValueSchema.nullable().optional(),
  align: z.enum(TEXT_ALIGNS).optional(),
});

export const cardFieldSchema = z.object({
  id: z.string().min(1).max(64),
  kind: cardFieldKindSchema,
  label: z.string().max(80).default(''),
  showLabel: z.boolean().default(true),
  span: z
    .number()
    .int()
    .refine((value) => (CARD_SPANS as readonly number[]).includes(value))
    .default(12),
  placeholder: z.string().max(120).default(''),
  defaultValue: cardValueSchema.default(null),
  options: z.array(z.string().trim().min(1).max(40)).max(CARD_MAX_OPTIONS).default([]),
  min: z.number().nullable().default(null),
  max: z.number().nullable().default(null),
  linkKinds: z.array(boardLinkKindSchema).max(8).default([]),
  multiple: z.boolean().default(false),
  style: cardFieldStyleSchema.default({}),
});

const cardWidthSchema = z.number().min(120).max(2000);
const cardHeightSchema = z.number().min(80).max(4000);
const cardGapSchema = z.number().min(0).max(64);
const cardFieldsSchema = z.array(cardFieldSchema).max(CARD_MAX_FIELDS);

export const cardLayoutSchema = z.object({
  width: cardWidthSchema.default(320),
  height: cardHeightSchema.default(360),
  style: itemStyleSchema.default({}),
  accent: colourValueSchema.nullable().default(null),
  gap: cardGapSchema.default(8),
  fields: cardFieldsSchema.default([]),
});

export const cardTemplateSchema = cardLayoutSchema.extend({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const cardTemplateListSchema = z.array(cardTemplateSchema);

export const cardTemplateInputSchema = cardLayoutSchema.extend({
  name: cardTemplateSchema.shape.name,
});

export const cardTemplatePatchSchema = z
  .object({
    name: cardTemplateSchema.shape.name,
    width: cardWidthSchema,
    height: cardHeightSchema,
    style: itemStyleSchema,
    accent: colourValueSchema.nullable(),
    gap: cardGapSchema,
    fields: cardFieldsSchema,
  })
  .partial();

const cardValuesSchema = z.record(z.string(), cardValueSchema);

export const savedCardSchema = z.object({
  id: z.string().min(1),
  folderId: z.string().min(1).nullable(),
  name: z.string().trim().min(1).max(80),
  templateId: z.string().min(1).nullable(),
  layout: cardLayoutSchema.nullable(),
  values: cardValuesSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const savedCardListSchema = z.array(savedCardSchema);

export const savedCardInputSchema = z.object({
  name: savedCardSchema.shape.name,
  folderId: savedCardSchema.shape.folderId.default(null),
  templateId: savedCardSchema.shape.templateId.default(null),
  layout: cardLayoutSchema.nullable().default(null),
  values: cardValuesSchema.default({}),
});

export const savedCardPatchSchema = z
  .object({
    name: savedCardSchema.shape.name,
    folderId: savedCardSchema.shape.folderId,
    templateId: savedCardSchema.shape.templateId,
    layout: cardLayoutSchema.nullable(),
    values: cardValuesSchema,
  })
  .partial();

export type SavedCard = z.infer<typeof savedCardSchema>;
export type SavedCardInput = z.input<typeof savedCardInputSchema>;
export type SavedCardPatch = z.input<typeof savedCardPatchSchema>;
export type CardFieldKind = z.infer<typeof cardFieldKindSchema>;
export type CardSpan = (typeof CARD_SPANS)[number];
export type CardTextSize = (typeof CARD_TEXT_SIZES)[number];
export type CardField = z.infer<typeof cardFieldSchema>;
export type CardLayout = z.infer<typeof cardLayoutSchema>;
export type CardTemplate = z.infer<typeof cardTemplateSchema>;
export type CardTemplateInput = z.input<typeof cardTemplateInputSchema>;
export type CardTemplatePatch = z.input<typeof cardTemplatePatchSchema>;
