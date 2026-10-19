import { z } from 'zod';
import { itemStyleSchema } from './board';

export const itemStylePresetSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  style: itemStyleSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const itemStylePresetListSchema = z.array(itemStylePresetSchema);

export const itemStylePresetInputSchema = z.object({
  name: itemStylePresetSchema.shape.name,
  style: itemStyleSchema.default({}),
});

export const itemStylePresetPatchSchema = z
  .object({ name: itemStylePresetSchema.shape.name, style: itemStyleSchema })
  .partial();

export type ItemStylePreset = z.infer<typeof itemStylePresetSchema>;
export type ItemStylePresetInput = z.input<typeof itemStylePresetInputSchema>;
export type ItemStylePresetPatch = z.input<typeof itemStylePresetPatchSchema>;
