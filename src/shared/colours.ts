import { z } from 'zod';
import { hexColorSchema } from './theme';

export const HARMONIES = [
  'analogous',
  'monochromatic',
  'triad',
  'complementary',
  'splitComplementary',
  'square',
  'compound',
  'shades',
  'custom',
] as const;

export const harmonySchema = z.preprocess(
  (value) => (value === 'doubleSplitComplementary' ? 'custom' : value),
  z.enum(HARMONIES),
);
export const paletteSourceSchema = z.enum(['wheel', 'image', 'preset']);

export const PALETTE_MIN_COLOURS = 1;
export const PALETTE_MAX_COLOURS = 12;
export const HARMONY_COLOUR_COUNT = 5;
export const DEFAULT_BASE_INDEX = 0;

export const paletteColourSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().max(40),
  hex: hexColorSchema,
});

export const paletteSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  harmony: harmonySchema,
  baseIndex: z.number().int().nonnegative(),
  source: paletteSourceSchema,
  colours: z.array(paletteColourSchema).min(PALETTE_MIN_COLOURS).max(PALETTE_MAX_COLOURS),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const paletteListSchema = z.array(paletteSchema);

export const paletteColourInputSchema = z.object({
  id: z.string().min(1).optional(),
  name: paletteColourSchema.shape.name.default(''),
  hex: hexColorSchema,
});

export const paletteInputSchema = z.object({
  name: paletteSchema.shape.name,
  harmony: harmonySchema.default('analogous'),
  baseIndex: paletteSchema.shape.baseIndex.default(DEFAULT_BASE_INDEX),
  source: paletteSourceSchema.default('wheel'),
  colours: z.array(paletteColourInputSchema).min(PALETTE_MIN_COLOURS).max(PALETTE_MAX_COLOURS),
});

export const palettePatchSchema = z
  .object({
    name: paletteSchema.shape.name,
    harmony: harmonySchema,
    baseIndex: paletteSchema.shape.baseIndex,
    colours: z.array(paletteColourInputSchema).min(PALETTE_MIN_COLOURS).max(PALETTE_MAX_COLOURS),
  })
  .partial();

export const colourRefSchema = z.object({
  paletteId: z.string().min(1),
  colourId: z.string().min(1),
});

export const colourValueSchema = z.object({
  hex: hexColorSchema,
  ref: colourRefSchema.nullable().default(null),
});

export type Harmony = z.infer<typeof harmonySchema>;
export type PaletteColour = z.infer<typeof paletteColourSchema>;
export type Palette = z.infer<typeof paletteSchema>;
export type PaletteColourInput = z.input<typeof paletteColourInputSchema>;
export type PaletteInput = z.input<typeof paletteInputSchema>;
export type PalettePatch = z.input<typeof palettePatchSchema>;
export type ColourRef = z.infer<typeof colourRefSchema>;
export type ColourValue = z.infer<typeof colourValueSchema>;

export function sameRef(a: ColourRef | null | undefined, b: ColourRef | null | undefined): boolean {
  if (!a || !b) return !a && !b;
  return a.paletteId === b.paletteId && a.colourId === b.colourId;
}
