import { z } from 'zod';
import { FONT_FAMILIES, cardValueSchema, itemStyleSchema } from '../board';
import { colourValueSchema } from '../colours';
import { cardFieldSchema } from './fields';

export * from './fields';

export const CARD_MAX_FIELDS = 60;
export const ACCENT_PLACEMENTS = ['top', 'left', 'border', 'header', 'none'] as const;
export const BACKGROUND_FITS = ['cover', 'contain'] as const;

export const cardBackgroundSchema = z.object({
  image: z.string().min(1).nullable().default(null),
  fit: z.enum(BACKGROUND_FITS).default('cover'),
  overlay: z.number().min(0).max(1).default(0),
  gradient: z
    .object({ colour: colourValueSchema, angle: z.number().min(0).max(360).default(180) })
    .nullable()
    .default(null),
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
  background: cardBackgroundSchema.default({ image: null, fit: 'cover', overlay: 0, gradient: null }),
  accentPlacement: z.enum(ACCENT_PLACEMENTS).default('top'),
  accentField: z.string().min(1).max(64).nullable().default(null),
  font: z.enum(FONT_FAMILIES).default('default'),
  autoHeight: z.boolean().default(false),
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
    background: cardBackgroundSchema,
    accentPlacement: z.enum(ACCENT_PLACEMENTS),
    accentField: z.string().min(1).max(64).nullable(),
    font: z.enum(FONT_FAMILIES),
    autoHeight: z.boolean(),
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
export type CardLayout = z.infer<typeof cardLayoutSchema>;
export type AccentPlacement = (typeof ACCENT_PLACEMENTS)[number];
export type CardTemplate = z.infer<typeof cardTemplateSchema>;
export type CardTemplateInput = z.input<typeof cardTemplateInputSchema>;
export type CardTemplatePatch = z.input<typeof cardTemplatePatchSchema>;
