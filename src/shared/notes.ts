import { z } from 'zod';

export const NOTE_MAX_BODY = 2_000_000;

export const noteTitleSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .refine((title) => !/[[\]|#^\\/:*?"<>]/.test(title), { message: 'Invalid note title' });

export const noteSchema = z.object({
  id: z.string().min(1),
  folderId: z.string().min(1).nullable(),
  title: noteTitleSchema,
  body: z.string().max(NOTE_MAX_BODY),
  starred: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const noteListSchema = z.array(noteSchema);

export const noteVersionSchema = z.object({
  id: z.string().min(1),
  noteId: z.string().min(1),
  title: z.string().min(1),
  body: z.string().max(NOTE_MAX_BODY),
  createdAt: z.iso.datetime(),
});

export const noteVersionListSchema = z.array(noteVersionSchema);

export const noteInputSchema = z.object({
  title: noteTitleSchema,
  body: noteSchema.shape.body.default(''),
  folderId: z.string().min(1).nullable().default(null),
});

export const notePatchSchema = z
  .object({
    title: noteTitleSchema,
    body: noteSchema.shape.body,
    folderId: z.string().min(1).nullable(),
    starred: z.boolean(),
  })
  .partial();

export const noteFileSchema = z.object({
  path: z.string().trim().min(1).max(1024),
  body: noteSchema.shape.body,
});

export const noteImportSchema = z.object({
  folderId: z.string().min(1).nullable().default(null),
  files: z.array(noteFileSchema).min(1).max(5000),
});

export const noteImportResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('imported'), notes: noteListSchema, ids: z.array(z.string()) }),
  z.object({ status: z.literal('cancelled') }),
]);

export const noteExportSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
  loopyLinks: z.enum(['keep', 'plain']).default('keep'),
});

export type Note = z.infer<typeof noteSchema>;
export type NoteVersion = z.infer<typeof noteVersionSchema>;
export type NoteInput = z.input<typeof noteInputSchema>;
export type NotePatch = z.infer<typeof notePatchSchema>;
export type NoteFile = z.infer<typeof noteFileSchema>;
export type NoteImport = z.input<typeof noteImportSchema>;
export type NoteImportResult = z.infer<typeof noteImportResultSchema>;
export type NoteExport = z.input<typeof noteExportSchema>;

export function sanitiseNoteTitle(raw: string): string {
  const cleaned = raw
    .replace(/\.(md|markdown)$/i, '')
    .replace(/[[\]|#^\\/:*?"<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200)
    .trim();
  return cleaned.length > 0 ? cleaned : 'Untitled';
}

export function uniqueNoteTitle(wanted: string, taken: Iterable<string>): string {
  const used = new Set(Array.from(taken, (title) => title.toLowerCase()));
  const base = sanitiseNoteTitle(wanted);
  if (!used.has(base.toLowerCase())) return base;
  for (let index = 2; ; index += 1) {
    const candidate = `${base.slice(0, 195)} ${String(index)}`;
    if (!used.has(candidate.toLowerCase())) return candidate;
  }
}
