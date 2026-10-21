import { z } from 'zod';
import { boardLinkKindSchema, boardLinkSchema } from '../board';
import { choiceOptionSchema } from '../cards';

export const TABLE_COLUMN_KINDS = [
  'text',
  'number',
  'checkbox',
  'choice',
  'date',
  'colour',
  'image',
  'link',
  'reference',
  'formula',
  'dice',
] as const;

export const TABLE_MAX_COLUMNS = 100;
export const TABLE_MAX_ROWS = 50_000;
export const TABLE_MAX_OPTIONS = 100;
export const COLUMN_ID_PATTERN = /^[a-z_][a-z0-9_]{0,47}$/;

export const tableColumnKindSchema = z.enum(TABLE_COLUMN_KINDS);
export const columnIdSchema = z.string().regex(COLUMN_ID_PATTERN);

const base = {
  id: columnIdSchema,
  label: z.string().trim().max(80).default(''),
  width: z.number().int().min(48).max(800).default(140),
  required: z.boolean().default(false),
  unique: z.boolean().default(false),
  description: z.string().max(300).default(''),
};

const fallback = <T extends z.ZodType>(schema: T) => schema.nullable().catch(null).default(null);
const bound = z.number().nullable().default(null);

export const textColumnSchema = z.object({
  ...base,
  kind: z.literal('text'),
  multiline: z.boolean().default(false),
  maxLength: z.number().int().positive().max(5000).nullable().default(null),
  defaultValue: fallback(z.string().max(5000)),
});

export const numberColumnSchema = z.object({
  ...base,
  kind: z.literal('number'),
  integer: z.boolean().default(false),
  min: bound,
  max: bound,
  defaultValue: fallback(z.number()),
});

export const checkboxColumnSchema = z.object({
  ...base,
  kind: z.literal('checkbox'),
  defaultValue: z.boolean().catch(false).default(false),
});

export const choiceColumnSchema = z.object({
  ...base,
  kind: z.literal('choice'),
  options: z.array(choiceOptionSchema).max(TABLE_MAX_OPTIONS).default([]),
  multiple: z.boolean().default(false),
});

export const dateColumnSchema = z.object({ ...base, kind: z.literal('date') });

export const colourColumnSchema = z.object({
  ...base,
  kind: z.literal('colour'),
  defaultValue: fallback(z.string().regex(/^#[0-9a-f]{6}$/i)),
});

export const imageColumnSchema = z.object({ ...base, kind: z.literal('image') });

export const linkColumnSchema = z.object({
  ...base,
  kind: z.literal('link'),
  linkKinds: z.array(boardLinkKindSchema).max(8).default([]),
  multiple: z.boolean().default(false),
});

export const referenceColumnSchema = z.object({
  ...base,
  kind: z.literal('reference'),
  tableId: z.string().min(1).nullable().default(null),
  multiple: z.boolean().default(false),
});

export const formulaColumnSchema = z.object({
  ...base,
  kind: z.literal('formula'),
  expression: z.string().max(500).default(''),
  decimals: z.number().int().min(0).max(6).nullable().default(null),
});

export const diceColumnSchema = z.object({ ...base, kind: z.literal('dice') });

export const tableColumnSchema = z.discriminatedUnion('kind', [
  textColumnSchema,
  numberColumnSchema,
  checkboxColumnSchema,
  choiceColumnSchema,
  dateColumnSchema,
  colourColumnSchema,
  imageColumnSchema,
  linkColumnSchema,
  referenceColumnSchema,
  formulaColumnSchema,
  diceColumnSchema,
]);

export const tableCellSchema = z.union([
  z.string().max(5000),
  z.number(),
  z.boolean(),
  z.array(z.string().max(200)).max(200),
  boardLinkSchema,
  z.array(boardLinkSchema).max(50),
  z.null(),
]);

export const tableCellsSchema = z.record(z.string().max(64), tableCellSchema);

export const rowKeySchema = z.string().trim().min(1).max(120);
export const tableNameSchema = z.string().trim().min(1).max(80);

const columnsSchema = z.array(tableColumnSchema).max(TABLE_MAX_COLUMNS);

function checkColumns(
  value: { keyName?: string | undefined; columns?: { id: string }[] | undefined },
  context: z.RefinementCtx,
): void {
  const seen = new Set<string>(value.keyName === undefined ? [] : [value.keyName]);
  for (const column of value.columns ?? []) {
    if (seen.has(column.id)) {
      context.addIssue({ code: 'custom', message: `Duplicate column id ${column.id}`, path: ['columns'] });
    }
    seen.add(column.id);
  }
}

export const dataTableSchema = z.object({
  id: z.string().min(1),
  folderId: z.string().min(1).nullable(),
  name: tableNameSchema,
  keyName: columnIdSchema,
  columns: columnsSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const dataTableSummarySchema = dataTableSchema.extend({ rowCount: z.number().int().nonnegative() });
export const dataTableSummaryListSchema = z.array(dataTableSummarySchema);

export const tableRowSchema = z.object({
  id: z.string().min(1),
  key: rowKeySchema,
  position: z.string().min(1),
  cells: tableCellsSchema,
  updatedAt: z.iso.datetime(),
});

export const rowInputSchema = z.object({
  key: rowKeySchema,
  cells: tableCellsSchema.default({}),
});

export const tableSnapshotSchema = z.object({
  table: dataTableSchema,
  rows: z.array(tableRowSchema),
});

export const dataTableInputSchema = z
  .object({
    name: tableNameSchema,
    folderId: z.string().min(1).nullable().default(null),
    keyName: columnIdSchema.default('id'),
    columns: columnsSchema.default([]),
    rows: z.array(rowInputSchema).max(TABLE_MAX_ROWS).default([]),
  })
  .superRefine(checkColumns);

export const dataTablePatchSchema = z
  .object({
    name: tableNameSchema,
    folderId: z.string().min(1).nullable(),
    keyName: columnIdSchema,
    columns: columnsSchema,
  })
  .partial()
  .superRefine(checkColumns);

const after = z.string().min(1).nullable().optional();

export const rowOpSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('insert'),
    id: z.string().min(1).optional(),
    key: rowKeySchema,
    cells: tableCellsSchema.default({}),
    after,
  }),
  z.object({
    op: z.literal('update'),
    id: z.string().min(1),
    key: rowKeySchema.optional(),
    cells: tableCellsSchema.optional(),
  }),
  z.object({ op: z.literal('move'), id: z.string().min(1), after: z.string().min(1).nullable() }),
  z.object({ op: z.literal('delete'), id: z.string().min(1) }),
]);

export const rowOpsSchema = z.array(rowOpSchema).min(1).max(TABLE_MAX_ROWS);

export const rowChangesSchema = z.object({
  rows: z.array(tableRowSchema),
  removed: z.array(z.string()),
});

export type TableColumnKind = z.infer<typeof tableColumnKindSchema>;
export type TableColumn = z.infer<typeof tableColumnSchema>;
export type TableColumnInput = z.input<typeof tableColumnSchema>;
export type TableCell = z.infer<typeof tableCellSchema>;
export type TableCells = z.infer<typeof tableCellsSchema>;
export type DataTable = z.infer<typeof dataTableSchema>;
export type DataTableSummary = z.infer<typeof dataTableSummarySchema>;
export type TableRow = z.infer<typeof tableRowSchema>;
export type TableSnapshot = z.infer<typeof tableSnapshotSchema>;
export type DataTableInput = z.input<typeof dataTableInputSchema>;
export type DataTablePatch = z.input<typeof dataTablePatchSchema>;
export type RowOp = z.input<typeof rowOpSchema>;
export type RowChanges = z.infer<typeof rowChangesSchema>;

const MAX_ID = 44;

function slug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, MAX_ID);
}

export function columnIdFrom(
  label: string,
  existing: readonly string[],
  reserved: readonly string[] = [],
): string {
  const raw = slug(label);
  const base = raw === '' ? 'column' : /^\d/.test(raw) ? `c_${raw}`.slice(0, MAX_ID) : raw;
  const taken = new Set([...existing, ...reserved]);
  if (!taken.has(base)) return base;
  let index = 2;
  while (taken.has(`${base}_${String(index)}`)) index += 1;
  return `${base}_${String(index)}`;
}
